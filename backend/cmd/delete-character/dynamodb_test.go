package main

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
)

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
