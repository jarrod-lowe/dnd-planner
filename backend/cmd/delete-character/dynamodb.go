package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
)

type sqsSender interface {
	SendMessage(ctx context.Context, params *sqs.SendMessageInput, optFns ...func(*sqs.Options)) (*sqs.SendMessageOutput, error)
}

type dynamoDBAPI interface {
	TransactWriteItems(ctx context.Context, params *dynamodb.TransactWriteItemsInput, optFns ...func(*dynamodb.Options)) (*dynamodb.TransactWriteItemsOutput, error)
	Query(ctx context.Context, params *dynamodb.QueryInput, optFns ...func(*dynamodb.Options)) (*dynamodb.QueryOutput, error)
	BatchWriteItem(ctx context.Context, params *dynamodb.BatchWriteItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.BatchWriteItemOutput, error)
}

type dbClient struct {
	client    dynamoDBAPI
	tableName string
	logger    *slog.Logger
	sqs       sqsSender
	sqsURL    string
}

func newDBClient(client dynamoDBAPI, tableName string, logger *slog.Logger, sqsClient sqsSender, sqsURL string) *dbClient {
	return &dbClient{
		client:    client,
		tableName: tableName,
		logger:    logger,
		sqs:       sqsClient,
		sqsURL:    sqsURL,
	}
}

func (d *dbClient) DeleteCharacter(ctx context.Context, userId, characterId string) error {
	// 1. TransactWriteItems: delete CHAR record, custom rule group definition, refund quota
	_, err := d.client.TransactWriteItems(ctx, &dynamodb.TransactWriteItemsInput{
		TransactItems: []types.TransactWriteItem{
			{
				Delete: &types.Delete{
					TableName: aws.String(d.tableName),
					Key: map[string]types.AttributeValue{
						"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("USER#%s", userId)},
						"SK": &types.AttributeValueMemberS{Value: fmt.Sprintf("CHAR#%s", characterId)},
					},
					ConditionExpression: aws.String("attribute_exists(PK)"),
				},
			},
			{
				Delete: &types.Delete{
					TableName: aws.String(d.tableName),
					Key: map[string]types.AttributeValue{
						"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("RULEGROUP#custom-%s", characterId)},
						"SK": &types.AttributeValueMemberS{Value: "META#"},
					},
				},
			},
			{
				Update: &types.Update{
					TableName: aws.String(d.tableName),
					Key: map[string]types.AttributeValue{
						"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("USER#%s", userId)},
						"SK": &types.AttributeValueMemberS{Value: "META#"},
					},
					UpdateExpression: aws.String("ADD charQuotaRemaining :inc"),
					ExpressionAttributeValues: map[string]types.AttributeValue{
						":inc": &types.AttributeValueMemberN{Value: "1"},
					},
				},
			},
		},
	})
	if err != nil {
		if isConditionFailure(err) {
			return ErrNotFound
		}
		return fmt.Errorf("transaction delete: %w", err)
	}

	// 2. Query + BatchWriteItem to delete all rule group assignments under CHAR#{characterId}
	pk := fmt.Sprintf("CHAR#%s", characterId)
	var exclusiveStartKey map[string]types.AttributeValue

	for {
		// Query a page of items
		queryOut, err := d.client.Query(ctx, &dynamodb.QueryInput{
			TableName:              aws.String(d.tableName),
			KeyConditionExpression: aws.String("PK = :pk"),
			ExpressionAttributeValues: map[string]types.AttributeValue{
				":pk": &types.AttributeValueMemberS{Value: pk},
			},
			ProjectionExpression: aws.String("PK, SK"),
			ExclusiveStartKey:    exclusiveStartKey,
		})
		if err != nil {
			d.logger.Error("failed to query rule group assignments", "error", err, "characterId", characterId)
			d.notifyFailedCleanup(ctx, userId, characterId, nil, err)
			return nil
		}

		if len(queryOut.Items) > 0 {
			// Chunk into batches of 25 (BatchWriteItem limit)
			for i := 0; i < len(queryOut.Items); i += 25 {
				end := i + 25
				if end > len(queryOut.Items) {
					end = len(queryOut.Items)
				}
				batch := queryOut.Items[i:end]

				writeRequests := make([]types.WriteRequest, len(batch))
				for j, item := range batch {
					writeRequests[j] = types.WriteRequest{
						DeleteRequest: &types.DeleteRequest{
							Key: item,
						},
					}
				}

				out, err := d.client.BatchWriteItem(ctx, &dynamodb.BatchWriteItemInput{
					RequestItems: map[string][]types.WriteRequest{
						d.tableName: writeRequests,
					},
				})
				if err != nil {
					d.logger.Error("failed to batch delete rule group assignments", "error", err, "characterId", characterId)
					d.notifyFailedCleanup(ctx, userId, characterId, batch, err)
				} else if unprocessed := out.UnprocessedItems[d.tableName]; len(unprocessed) > 0 {
					failedKeys := make([]map[string]types.AttributeValue, len(unprocessed))
					for i, req := range unprocessed {
						failedKeys[i] = req.DeleteRequest.Key
					}
					d.notifyFailedCleanup(ctx, userId, characterId, failedKeys, fmt.Errorf("batch write returned %d unprocessed items", len(unprocessed)))
				}
			}
		}

		if queryOut.LastEvaluatedKey == nil {
			break
		}
		exclusiveStartKey = queryOut.LastEvaluatedKey
	}

	return nil
}

type cleanupFailureMessage struct {
	Action      string              `json:"action"`
	CharacterId string              `json:"characterId"`
	UserId      string              `json:"userId"`
	FailedItems []map[string]string `json:"failedItems"`
	Error       string              `json:"error"`
	Timestamp   string              `json:"timestamp"`
}

func (d *dbClient) notifyFailedCleanup(ctx context.Context, userId, characterId string, batch []map[string]types.AttributeValue, batchErr error) {
	if d.sqs == nil || d.sqsURL == "" {
		return
	}

	var failedItems []map[string]string
	if batch != nil {
		failedItems = make([]map[string]string, len(batch))
		for i, item := range batch {
			failedItems[i] = map[string]string{
				"PK": stringValue(item["PK"]),
				"SK": stringValue(item["SK"]),
			}
		}
	}

	msg := cleanupFailureMessage{
		Action:      "DELETE_CHARACTER",
		CharacterId: characterId,
		UserId:      userId,
		FailedItems: failedItems,
		Error:       batchErr.Error(),
		Timestamp:   time.Now().UTC().Format(time.RFC3339),
	}

	body, err := json.Marshal(msg)
	if err != nil {
		d.logger.Error("failed to marshal cleanup failure message", "error", err)
		return
	}

	_, err = d.sqs.SendMessage(ctx, &sqs.SendMessageInput{
		QueueUrl:    aws.String(d.sqsURL),
		MessageBody: aws.String(string(body)),
	})
	if err != nil {
		d.logger.Error("failed to send cleanup failure to SQS", "error", err, "characterId", characterId)
	}
}

func stringValue(v types.AttributeValue) string {
	if s, ok := v.(*types.AttributeValueMemberS); ok {
		return s.Value
	}
	return ""
}

// isConditionFailure returns true if the error is a condition check failure,
// whether from a single-item operation (ConditionalCheckFailedException) or
// a transaction (TransactionCanceledException with ConditionalCheckFailed reason).
func isConditionFailure(err error) bool {
	var tce *types.TransactionCanceledException
	if errors.As(err, &tce) {
		for _, reason := range tce.CancellationReasons {
			if reason.Code != nil && *reason.Code == "ConditionalCheckFailed" {
				return true
			}
		}
		return false
	}
	var ccfe *types.ConditionalCheckFailedException
	return errors.As(err, &ccfe)
}
