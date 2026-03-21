package main

import (
	"context"
	"log/slog"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

// dynamoDBClient is the real DynamoDB client implementation
type dynamoDBClient struct {
	client    *dynamodb.Client
	tableName string
	logger    *slog.Logger
}

// newDynamoDBClient creates a new DynamoDB client
func newDynamoDBClient(client *dynamodb.Client, tableName string, logger *slog.Logger) *dynamoDBClient {
	return &dynamoDBClient{
		client:    client,
		tableName: tableName,
		logger:    logger,
	}
}

func (d *dynamoDBClient) getItem(ctx context.Context, pk, sk string) (map[string]any, error) {
	key, err := attributevalue.MarshalMap(map[string]string{
		"PK": pk,
		"SK": sk,
	})
	if err != nil {
		d.logger.Error("failed to marshal key", "error", err, "pk", pk, "sk", sk)
		return nil, err
	}

	result, err := d.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(d.tableName),
		Key:       key,
	})
	if err != nil {
		d.logger.Error("failed to get item from DynamoDB", "error", err, "pk", pk, "sk", sk)
		return nil, err
	}

	if result.Item == nil {
		d.logger.Warn("item not found", "pk", pk, "sk", sk)
		return nil, &types.ResourceNotFoundException{}
	}

	var item map[string]any
	if err := attributevalue.UnmarshalMap(result.Item, &item); err != nil {
		d.logger.Error("failed to unmarshal item", "error", err)
		return nil, err
	}

	return item, nil
}

func (d *dynamoDBClient) putItem(ctx context.Context, item map[string]any) error {
	av, err := attributevalue.MarshalMap(item)
	if err != nil {
		d.logger.Error("failed to marshal item", "error", err)
		return err
	}

	_, err = d.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(d.tableName),
		Item:      av,
	})
	if err != nil {
		d.logger.Error("failed to put item to DynamoDB", "error", err)
		return err
	}

	return nil
}
