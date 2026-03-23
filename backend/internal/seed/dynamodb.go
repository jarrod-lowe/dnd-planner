package seed

import (
	"context"
	"log/slog"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

// Client wraps the DynamoDB client with seed library operations.
type Client struct {
	client    *dynamodb.Client
	tableName string
	logger    *slog.Logger
}

// NewClient creates a new DynamoDB client for the seed library.
func NewClient(client *dynamodb.Client, tableName string, logger *slog.Logger) *Client {
	return &Client{
		client:    client,
		tableName: tableName,
		logger:    logger,
	}
}

// QueryByGsiSeedPK queries the gsiSeed index by gsiSeedPK.
func (c *Client) QueryByGsiSeedPK(ctx context.Context, gsiSeedPK string) ([]map[string]any, error) {
	result, err := c.client.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(c.tableName),
		IndexName:              aws.String("gsiSeed"),
		KeyConditionExpression: aws.String("gsiSeedPK = :gsiSeedPK"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":gsiSeedPK": &types.AttributeValueMemberS{Value: gsiSeedPK},
		},
	})
	if err != nil {
		c.logger.Error("failed to query gsiSeed index", "error", err, "gsiSeedPK", gsiSeedPK)
		return nil, err
	}

	items := make([]map[string]any, 0, len(result.Items))
	for _, item := range result.Items {
		var m map[string]any
		if err := attributevalue.UnmarshalMap(item, &m); err != nil {
			c.logger.Error("failed to unmarshal item", "error", err)
			return nil, err
		}
		items = append(items, m)
	}

	c.logger.Info("queried seed records", "gsiSeedPK", gsiSeedPK, "count", len(items))
	return items, nil
}

// BatchWriteItems writes multiple items to DynamoDB using BatchWriteItem.
func (c *Client) BatchWriteItems(ctx context.Context, items []map[string]any) error {
	if len(items) == 0 {
		return nil
	}

	// BatchWriteItem supports up to 25 items per request
	// For simplicity, we'll write one at a time (can optimize later if needed)
	for _, item := range items {
		av, err := attributevalue.MarshalMap(item)
		if err != nil {
			c.logger.Error("failed to marshal item", "error", err)
			return err
		}

		_, err = c.client.PutItem(ctx, &dynamodb.PutItemInput{
			TableName: aws.String(c.tableName),
			Item:      av,
		})
		if err != nil {
			c.logger.Error("failed to put item to DynamoDB", "error", err)
			return err
		}
	}

	c.logger.Info("wrote records to DynamoDB", "count", len(items))
	return nil
}
