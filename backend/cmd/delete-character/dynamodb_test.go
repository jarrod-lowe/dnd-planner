package main

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
)

// mockDynamoDB implements dynamoDBAPI for testing
type mockDynamoDB struct {
	transactWriteFunc func(ctx context.Context, params *dynamodb.TransactWriteItemsInput, optFns ...func(*dynamodb.Options)) (*dynamodb.TransactWriteItemsOutput, error)
	queryFunc         func(ctx context.Context, params *dynamodb.QueryInput, optFns ...func(*dynamodb.Options)) (*dynamodb.QueryOutput, error)
	batchWriteFunc    func(ctx context.Context, params *dynamodb.BatchWriteItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.BatchWriteItemOutput, error)
}

func (m *mockDynamoDB) TransactWriteItems(ctx context.Context, params *dynamodb.TransactWriteItemsInput, optFns ...func(*dynamodb.Options)) (*dynamodb.TransactWriteItemsOutput, error) {
	if m.transactWriteFunc != nil {
		return m.transactWriteFunc(ctx, params, optFns...)
	}
	return &dynamodb.TransactWriteItemsOutput{}, nil
}

func (m *mockDynamoDB) Query(ctx context.Context, params *dynamodb.QueryInput, optFns ...func(*dynamodb.Options)) (*dynamodb.QueryOutput, error) {
	if m.queryFunc != nil {
		return m.queryFunc(ctx, params, optFns...)
	}
	return &dynamodb.QueryOutput{}, nil
}

func (m *mockDynamoDB) BatchWriteItem(ctx context.Context, params *dynamodb.BatchWriteItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.BatchWriteItemOutput, error) {
	if m.batchWriteFunc != nil {
		return m.batchWriteFunc(ctx, params, optFns...)
	}
	return &dynamodb.BatchWriteItemOutput{}, nil
}

func TestIsConditionFailure_TransactionCanceledWithConditionCheck(t *testing.T) {
	err := &types.TransactionCanceledException{
		CancellationReasons: []types.CancellationReason{
			{Code: aws.String("ConditionalCheckFailed")},
			{Code: aws.String("None")},
			{Code: aws.String("None")},
		},
	}
	if !isConditionFailure(err) {
		t.Error("expected TransactionCanceledException with ConditionalCheckFailed to be true")
	}
}

func TestIsConditionFailure_TransactionCanceledWithOtherReason(t *testing.T) {
	err := &types.TransactionCanceledException{
		CancellationReasons: []types.CancellationReason{
			{Code: aws.String("None")},
			{Code: aws.String("None")},
			{Code: aws.String("None")},
		},
	}
	if isConditionFailure(err) {
		t.Error("expected TransactionCanceledException without ConditionalCheckFailed to be false")
	}
}

func TestIsConditionFailure_ConditionalCheckFailedException(t *testing.T) {
	err := &types.ConditionalCheckFailedException{}
	if !isConditionFailure(err) {
		t.Error("expected ConditionalCheckFailedException to be true")
	}
}

func TestIsConditionFailure_OtherError(t *testing.T) {
	if isConditionFailure(errors.New("something else")) {
		t.Error("expected generic error to be false")
	}
}

// mockSQS captures SendMessage calls
type mockSQS struct {
	messages []string
	sendErr  error
}

func (m *mockSQS) SendMessage(_ context.Context, params *sqs.SendMessageInput, _ ...func(*sqs.Options)) (*sqs.SendMessageOutput, error) {
	if m.sendErr != nil {
		return nil, m.sendErr
	}
	m.messages = append(m.messages, *params.MessageBody)
	return &sqs.SendMessageOutput{MessageId: aws.String("msg-1")}, nil
}

func TestNotifyFailedCleanup_SendsCorrectMessage(t *testing.T) {
	mock := &mockSQS{}
	client := &dbClient{
		sqs:    mock,
		sqsURL: "https://sqs.us-east-1.amazonaws.com/123456789/my-queue",
		logger: slog.Default(),
	}

	batch := []map[string]types.AttributeValue{
		{
			"PK": &types.AttributeValueMemberS{Value: "CHAR#abc-123"},
			"SK": &types.AttributeValueMemberS{Value: "RULEGROUP#turn-rest"},
		},
		{
			"PK": &types.AttributeValueMemberS{Value: "CHAR#abc-123"},
			"SK": &types.AttributeValueMemberS{Value: "RULEGROUP#action-economy"},
		},
	}

	client.notifyFailedCleanup(context.Background(), "user-456", "abc-123", batch, errors.New("some error"))

	if len(mock.messages) != 1 {
		t.Fatalf("expected 1 SQS message, got %d", len(mock.messages))
	}

	var msg cleanupFailureMessage
	if err := json.Unmarshal([]byte(mock.messages[0]), &msg); err != nil {
		t.Fatalf("failed to unmarshal message: %v", err)
	}

	if msg.Action != "DELETE_CHARACTER" {
		t.Errorf("expected action DELETE_CHARACTER, got %s", msg.Action)
	}
	if msg.CharacterId != "abc-123" {
		t.Errorf("expected characterId abc-123, got %s", msg.CharacterId)
	}
	if msg.UserId != "user-456" {
		t.Errorf("expected userId user-456, got %s", msg.UserId)
	}
	if msg.Error != "some error" {
		t.Errorf("expected error 'some error', got %s", msg.Error)
	}
	if len(msg.FailedItems) != 2 {
		t.Fatalf("expected 2 failed items, got %d", len(msg.FailedItems))
	}
	if msg.FailedItems[0]["PK"] != "CHAR#abc-123" || msg.FailedItems[0]["SK"] != "RULEGROUP#turn-rest" {
		t.Errorf("unexpected first failed item: %v", msg.FailedItems[0])
	}
	if msg.FailedItems[1]["SK"] != "RULEGROUP#action-economy" {
		t.Errorf("unexpected second failed item SK: %s", msg.FailedItems[1]["SK"])
	}
	if msg.Timestamp == "" {
		t.Error("expected timestamp to be set")
	}
}

func TestNotifyFailedCleanup_SkipsWhenSQSNotConfigured(t *testing.T) {
	client := &dbClient{
		sqs:    nil,
		sqsURL: "",
		logger: slog.Default(),
	}

	batch := []map[string]types.AttributeValue{
		{
			"PK": &types.AttributeValueMemberS{Value: "CHAR#abc"},
			"SK": &types.AttributeValueMemberS{Value: "RULEGROUP#x"},
		},
	}

	// Should not panic
	client.notifyFailedCleanup(context.Background(), "user-1", "abc", batch, errors.New("err"))
}

func TestNotifyFailedCleanup_GracefulOnSQSFailure(t *testing.T) {
	mock := &mockSQS{
		sendErr: errors.New("SQS is down"),
	}
	client := &dbClient{
		sqs:    mock,
		sqsURL: "https://sqs.us-east-1.amazonaws.com/123456789/my-queue",
		logger: slog.Default(),
	}

	batch := []map[string]types.AttributeValue{
		{
			"PK": &types.AttributeValueMemberS{Value: "CHAR#abc"},
			"SK": &types.AttributeValueMemberS{Value: "RULEGROUP#x"},
		},
	}

	// Should not panic when SQS send fails
	client.notifyFailedCleanup(context.Background(), "user-1", "abc", batch, errors.New("dynamodb error"))
}

func TestDeleteCharacter_QueryFailure_SendsToSQS(t *testing.T) {
	sqsMock := &mockSQS{}
	dbMock := &mockDynamoDB{
		queryFunc: func(ctx context.Context, params *dynamodb.QueryInput, optFns ...func(*dynamodb.Options)) (*dynamodb.QueryOutput, error) {
			return nil, errors.New("query failed")
		},
	}
	client := &dbClient{
		client:    dbMock,
		tableName: "test-table",
		logger:    slog.Default(),
		sqs:       sqsMock,
		sqsURL:    "https://sqs.us-east-1.amazonaws.com/123456789/my-queue",
	}

	err := client.DeleteCharacter(context.Background(), "user-1", "char-1")
	if err != nil {
		t.Fatalf("expected no error (character already deleted), got: %v", err)
	}

	if len(sqsMock.messages) != 1 {
		t.Fatalf("expected 1 SQS message on query failure, got %d", len(sqsMock.messages))
	}

	var msg cleanupFailureMessage
	if err := json.Unmarshal([]byte(sqsMock.messages[0]), &msg); err != nil {
		t.Fatalf("failed to unmarshal message: %v", err)
	}
	if msg.Action != "DELETE_CHARACTER" {
		t.Errorf("expected action DELETE_CHARACTER, got %s", msg.Action)
	}
	if msg.CharacterId != "char-1" {
		t.Errorf("expected characterId char-1, got %s", msg.CharacterId)
	}
}

func TestDeleteCharacter_UnprocessedItems_SentToSQS(t *testing.T) {
	sqsMock := &mockSQS{}
	dbMock := &mockDynamoDB{
		queryFunc: func(ctx context.Context, params *dynamodb.QueryInput, optFns ...func(*dynamodb.Options)) (*dynamodb.QueryOutput, error) {
			return &dynamodb.QueryOutput{
				Items: []map[string]types.AttributeValue{
					{
						"PK": &types.AttributeValueMemberS{Value: "CHAR#char-1"},
						"SK": &types.AttributeValueMemberS{Value: "RULEGROUP#turn-rest"},
					},
				},
			}, nil
		},
		batchWriteFunc: func(ctx context.Context, params *dynamodb.BatchWriteItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.BatchWriteItemOutput, error) {
			return &dynamodb.BatchWriteItemOutput{
				UnprocessedItems: map[string][]types.WriteRequest{
					"test-table": {
						{
							DeleteRequest: &types.DeleteRequest{
								Key: map[string]types.AttributeValue{
									"PK": &types.AttributeValueMemberS{Value: "CHAR#char-1"},
									"SK": &types.AttributeValueMemberS{Value: "RULEGROUP#turn-rest"},
								},
							},
						},
					},
				},
			}, nil
		},
	}
	client := &dbClient{
		client:    dbMock,
		tableName: "test-table",
		logger:    slog.Default(),
		sqs:       sqsMock,
		sqsURL:    "https://sqs.us-east-1.amazonaws.com/123456789/my-queue",
	}

	err := client.DeleteCharacter(context.Background(), "user-1", "char-1")
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if len(sqsMock.messages) != 1 {
		t.Fatalf("expected 1 SQS message for unprocessed items, got %d", len(sqsMock.messages))
	}

	var msg cleanupFailureMessage
	if err := json.Unmarshal([]byte(sqsMock.messages[0]), &msg); err != nil {
		t.Fatalf("failed to unmarshal message: %v", err)
	}
	if msg.Action != "DELETE_CHARACTER" {
		t.Errorf("expected action DELETE_CHARACTER, got %s", msg.Action)
	}
	if len(msg.FailedItems) != 1 {
		t.Fatalf("expected 1 failed item, got %d", len(msg.FailedItems))
	}
	if msg.FailedItems[0]["PK"] != "CHAR#char-1" {
		t.Errorf("expected PK CHAR#char-1, got %s", msg.FailedItems[0]["PK"])
	}
}
