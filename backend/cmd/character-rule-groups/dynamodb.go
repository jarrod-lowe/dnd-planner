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

// dbClient implements DynamoDBClient with real DynamoDB operations
type dbClient struct {
	client    *dynamodb.Client
	tableName string
	logger    *slog.Logger
}

// newDBClient creates a new DynamoDB client
func newDBClient(client *dynamodb.Client, tableName string, logger *slog.Logger) *dbClient {
	return &dbClient{
		client:    client,
		tableName: tableName,
		logger:    logger,
	}
}

// QueryOwnership checks if a user owns a character by querying USER#{userId}/CHAR#{characterId}
func (d *dbClient) QueryOwnership(ctx context.Context, userId, characterId string) (bool, error) {
	result, err := d.client.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(d.tableName),
		KeyConditionExpression: aws.String("PK = :pk AND SK = :sk"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":pk": &types.AttributeValueMemberS{Value: fmt.Sprintf("USER#%s", userId)},
			":sk": &types.AttributeValueMemberS{Value: fmt.Sprintf("CHAR#%s", characterId)},
		},
	})
	if err != nil {
		return false, fmt.Errorf("query ownership: %w", err)
	}
	return len(result.Items) > 0, nil
}

// PutRuleGroup adds a rule group assignment to a character.
// Returns the createdAt timestamp of the written record.
// Returns ErrConditionalCheckFailed if the assignment already exists.
func (d *dbClient) PutRuleGroup(ctx context.Context, characterId, ruleGroupId, userId string) (string, error) {
	now := formatNow()
	_, err := d.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(d.tableName),
		Item: map[string]types.AttributeValue{
			"PK":          &types.AttributeValueMemberS{Value: fmt.Sprintf("CHAR#%s", characterId)},
			"SK":          &types.AttributeValueMemberS{Value: fmt.Sprintf("RULEGROUP#%s", ruleGroupId)},
			"type":        &types.AttributeValueMemberS{Value: "CHAR_RULEGROUP"},
			"characterId": &types.AttributeValueMemberS{Value: characterId},
			"ruleGroupId": &types.AttributeValueMemberS{Value: ruleGroupId},
			"userId":      &types.AttributeValueMemberS{Value: userId},
			"enabled":     &types.AttributeValueMemberBOOL{Value: true},
			"createdAt":   &types.AttributeValueMemberS{Value: now},
			"updatedAt":   &types.AttributeValueMemberS{Value: now},
		},
		ConditionExpression: aws.String("attribute_not_exists(PK)"),
	})
	if err != nil {
		var ccfe *types.ConditionalCheckFailedException
		if errors.As(err, &ccfe) {
			return "", ErrConditionalCheckFailed
		}
		return "", fmt.Errorf("put rule group: %w", err)
	}
	return now, nil
}

// DeleteRuleGroup removes a rule group assignment from a character.
// Returns ErrNotFound if the assignment does not exist.
func (d *dbClient) DeleteRuleGroup(ctx context.Context, characterId, ruleGroupId string) error {
	_, err := d.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(d.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("CHAR#%s", characterId)},
			"SK": &types.AttributeValueMemberS{Value: fmt.Sprintf("RULEGROUP#%s", ruleGroupId)},
		},
		ConditionExpression: aws.String("attribute_exists(PK)"),
	})
	if err != nil {
		var ccfe *types.ConditionalCheckFailedException
		if errors.As(err, &ccfe) {
			return ErrNotFound
		}
		return fmt.Errorf("delete rule group: %w", err)
	}
	return nil
}
