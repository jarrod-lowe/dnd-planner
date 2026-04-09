package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
)

type dynamoDBClient struct {
	client    *dynamodb.Client
	tableName string
}

func (d *dynamoDBClient) query(ctx context.Context, pk string) ([]map[string]types.AttributeValue, error) {
	var items []map[string]types.AttributeValue
	var lastKey map[string]types.AttributeValue

	for {
		out, err := d.client.Query(ctx, &dynamodb.QueryInput{
			TableName:              aws.String(d.tableName),
			KeyConditionExpression: aws.String("PK = :pk"),
			ExpressionAttributeValues: map[string]types.AttributeValue{
				":pk": &types.AttributeValueMemberS{Value: pk},
			},
			ExclusiveStartKey: lastKey,
			ConsistentRead:    aws.Bool(true),
		})
		if err != nil {
			return nil, err
		}
		items = append(items, out.Items...)
		if out.LastEvaluatedKey == nil {
			break
		}
		lastKey = out.LastEvaluatedKey
	}
	return items, nil
}

func (d *dynamoDBClient) batchWrite(ctx context.Context, writeRequests []types.WriteRequest) error {
	out, err := d.client.BatchWriteItem(ctx, &dynamodb.BatchWriteItemInput{
		RequestItems: map[string][]types.WriteRequest{
			d.tableName: writeRequests,
		},
	})
	if err != nil {
		return err
	}

	if unprocessed := out.UnprocessedItems; len(unprocessed) > 0 && len(unprocessed[d.tableName]) > 0 {
		return fmt.Errorf("BatchWriteItem: %d items unprocessed", len(unprocessed[d.tableName]))
	}
	return nil
}

func (d *dynamoDBClient) delete(ctx context.Context, pk, sk string) error {
	_, err := d.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(d.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: pk},
			"SK": &types.AttributeValueMemberS{Value: sk},
		},
	})
	return err
}

func (d *dynamoDBClient) sendToDLQ(ctx context.Context, characterId string, failureErr error) error {
	dlqURL := os.Getenv("DLQ_URL")
	if dlqURL == "" {
		return nil
	}

	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return fmt.Errorf("failed to load config for SQS: %w", err)
	}

	sqsClient := sqs.NewFromConfig(cfg)

	msg := map[string]string{
		"action":      "CLEANUP_CHARACTER",
		"characterId": characterId,
		"error":       failureErr.Error(),
		"timestamp":   time.Now().UTC().Format(time.RFC3339),
	}
	body, _ := json.Marshal(msg)

	_, err = sqsClient.SendMessage(ctx, &sqs.SendMessageInput{
		QueueUrl:    aws.String(dlqURL),
		MessageBody: aws.String(string(body)),
	})
	return err
}

func main() {
	cfg, err := config.LoadDefaultConfig(context.Background())
	if err != nil {
		slog.Error("failed to load AWS config", "error", err)
		panic(err)
	}

	tableName := os.Getenv("TABLE_NAME")
	if tableName == "" {
		slog.Error("TABLE_NAME environment variable is required")
		panic("TABLE_NAME environment variable is required")
	}

	db := &dynamoDBClient{
		client:    dynamodb.NewFromConfig(cfg),
		tableName: tableName,
	}

	h := &handler{
		cleanup: func(ctx context.Context, characterId string) error {
			return cleanupCharacter(ctx, db, characterId)
		},
		logger: slog.Default(),
	}

	lambda.Start(h.handle)
}
