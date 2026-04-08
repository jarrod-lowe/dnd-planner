package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

type dbClient struct {
	client    *dynamodb.Client
	tableName string
	logger    *slog.Logger
}

func newDBClient(client *dynamodb.Client, tableName string, logger *slog.Logger) *dbClient {
	return &dbClient{
		client:    client,
		tableName: tableName,
		logger:    logger,
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
		var ccfe *types.ConditionalCheckFailedException
		if errors.As(err, &ccfe) {
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

				_, err = d.client.BatchWriteItem(ctx, &dynamodb.BatchWriteItemInput{
					RequestItems: map[string][]types.WriteRequest{
						d.tableName: writeRequests,
					},
				})
				if err != nil {
					d.logger.Error("failed to batch delete rule group assignments", "error", err, "characterId", characterId)
					// Continue trying remaining batches
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
