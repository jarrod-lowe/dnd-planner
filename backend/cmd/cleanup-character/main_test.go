package main

import (
	"context"
	"errors"
	"log/slog"
	"testing"

	"github.com/aws/aws-lambda-go/events"
)

func TestExtractCharacterId_FromRemoveEvent(t *testing.T) {
	event := events.DynamoDBEvent{
		Records: []events.DynamoDBEventRecord{
			{
				EventName: "REMOVE",
				Change: events.DynamoDBStreamRecord{
					Keys: map[string]events.DynamoDBAttributeValue{
						"PK": events.NewStringAttribute("USER#user-123"),
						"SK": events.NewStringAttribute("CHAR#char-456"),
					},
				},
			},
		},
	}

	characterId, err := extractCharacterId(event.Records[0])
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if characterId != "char-456" {
		t.Errorf("expected characterId char-456, got %s", characterId)
	}
}

func TestExtractCharacterId_MissingSKPrefix_ReturnsError(t *testing.T) {
	event := events.DynamoDBEvent{
		Records: []events.DynamoDBEventRecord{
			{
				EventName: "REMOVE",
				Change: events.DynamoDBStreamRecord{
					Keys: map[string]events.DynamoDBAttributeValue{
						"PK": events.NewStringAttribute("USER#user-123"),
						"SK": events.NewStringAttribute("OTHER#something"),
					},
				},
			},
		},
	}

	_, err := extractCharacterId(event.Records[0])
	if err == nil {
		t.Fatal("expected error for non-CHAR# SK prefix, got nil")
	}
}

func TestExtractCharacterId_InsertEvent_Skipped(t *testing.T) {
	event := events.DynamoDBEvent{
		Records: []events.DynamoDBEventRecord{
			{
				EventName: "INSERT",
				Change: events.DynamoDBStreamRecord{
					Keys: map[string]events.DynamoDBAttributeValue{
						"PK": events.NewStringAttribute("USER#user-123"),
						"SK": events.NewStringAttribute("CHAR#char-456"),
					},
				},
			},
		},
	}

	_, err := extractCharacterId(event.Records[0])
	if err == nil {
		t.Fatal("expected error for INSERT event, got nil")
	}
}

func TestHandle_ProcessesRemoveEvents(t *testing.T) {
	ctx := context.Background()

	processed := []string{}
	cleanupFunc := func(ctx context.Context, characterId string) error {
		processed = append(processed, characterId)
		return nil
	}

	h := &handler{
		cleanup: cleanupFunc,
	}

	event := events.DynamoDBEvent{
		Records: []events.DynamoDBEventRecord{
			{
				EventName: "REMOVE",
				Change: events.DynamoDBStreamRecord{
					Keys: map[string]events.DynamoDBAttributeValue{
						"PK": events.NewStringAttribute("USER#user-123"),
						"SK": events.NewStringAttribute("CHAR#char-456"),
					},
				},
			},
		},
	}

	resp, err := h.handle(ctx, event)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if len(resp.BatchItemFailures) != 0 {
		t.Errorf("expected no batch item failures, got %d", len(resp.BatchItemFailures))
	}

	if len(processed) != 1 {
		t.Fatalf("expected 1 character processed, got %d", len(processed))
	}
	if processed[0] != "char-456" {
		t.Errorf("expected characterId char-456, got %s", processed[0])
	}
}

func TestHandle_SkipsNonRemoveEvents(t *testing.T) {
	ctx := context.Background()

	processed := []string{}
	cleanupFunc := func(ctx context.Context, characterId string) error {
		processed = append(processed, characterId)
		return nil
	}

	h := &handler{
		cleanup: cleanupFunc,
	}

	event := events.DynamoDBEvent{
		Records: []events.DynamoDBEventRecord{
			{
				EventName: "INSERT",
				Change: events.DynamoDBStreamRecord{
					Keys: map[string]events.DynamoDBAttributeValue{
						"PK": events.NewStringAttribute("USER#user-123"),
						"SK": events.NewStringAttribute("CHAR#char-456"),
					},
				},
			},
			{
				EventName: "MODIFY",
				Change: events.DynamoDBStreamRecord{
					Keys: map[string]events.DynamoDBAttributeValue{
						"PK": events.NewStringAttribute("USER#user-123"),
						"SK": events.NewStringAttribute("CHAR#char-789"),
					},
				},
			},
		},
	}

	resp, err := h.handle(ctx, event)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if len(resp.BatchItemFailures) != 0 {
		t.Errorf("expected no batch item failures, got %d", len(resp.BatchItemFailures))
	}

	if len(processed) != 0 {
		t.Errorf("expected 0 characters processed, got %d", len(processed))
	}
}

func TestHandle_CleanupFailure_ReturnsBatchItemFailure(t *testing.T) {
	ctx := context.Background()

	cleanupFunc := func(ctx context.Context, characterId string) error {
		return errors.New("cleanup failed")
	}

	h := &handler{
		cleanup: cleanupFunc,
		logger:  slog.Default(),
	}

	event := events.DynamoDBEvent{
		Records: []events.DynamoDBEventRecord{
			{
				EventName: "REMOVE",
				Change: events.DynamoDBStreamRecord{
					SequenceNumber: "seq-001",
					Keys: map[string]events.DynamoDBAttributeValue{
						"PK": events.NewStringAttribute("USER#user-123"),
						"SK": events.NewStringAttribute("CHAR#char-456"),
					},
				},
			},
		},
	}

	resp, err := h.handle(ctx, event)
	if err != nil {
		t.Fatalf("expected no error from handle, got: %v", err)
	}

	if len(resp.BatchItemFailures) != 1 {
		t.Fatalf("expected 1 batch item failure, got %d", len(resp.BatchItemFailures))
	}

	if resp.BatchItemFailures[0].ItemIdentifier != "seq-001" {
		t.Errorf("expected failure for seq-001, got %s", resp.BatchItemFailures[0].ItemIdentifier)
	}
}

func TestHandle_MixedResults_PartialFailures(t *testing.T) {
	ctx := context.Background()

	cleanupFunc := func(ctx context.Context, characterId string) error {
		if characterId == "char-fail" {
			return errors.New("cleanup failed")
		}
		return nil
	}

	h := &handler{
		cleanup: cleanupFunc,
		logger:  slog.Default(),
	}

	event := events.DynamoDBEvent{
		Records: []events.DynamoDBEventRecord{
			{
				EventName: "REMOVE",
				Change: events.DynamoDBStreamRecord{
					SequenceNumber: "seq-001",
					Keys: map[string]events.DynamoDBAttributeValue{
						"PK": events.NewStringAttribute("USER#user-123"),
						"SK": events.NewStringAttribute("CHAR#char-ok"),
					},
				},
			},
			{
				EventName: "REMOVE",
				Change: events.DynamoDBStreamRecord{
					SequenceNumber: "seq-002",
					Keys: map[string]events.DynamoDBAttributeValue{
						"PK": events.NewStringAttribute("USER#user-456"),
						"SK": events.NewStringAttribute("CHAR#char-fail"),
					},
				},
			},
		},
	}

	resp, err := h.handle(ctx, event)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if len(resp.BatchItemFailures) != 1 {
		t.Fatalf("expected 1 batch item failure, got %d", len(resp.BatchItemFailures))
	}

	if resp.BatchItemFailures[0].ItemIdentifier != "seq-002" {
		t.Errorf("expected failure for seq-002, got %s", resp.BatchItemFailures[0].ItemIdentifier)
	}
}
