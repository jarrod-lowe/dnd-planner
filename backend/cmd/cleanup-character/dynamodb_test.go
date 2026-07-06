package main

import (
	"context"
	"errors"
	"testing"

	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

func TestQueryRuleGroupAssignments_ReturnsItems(t *testing.T) {
	ctx := context.Background()
	characterId := "char-456"

	db := &mockDB{
		queryFunc: func(ctx context.Context, pk string) ([]map[string]types.AttributeValue, error) {
			if pk != "CHAR#char-456" {
				t.Errorf("expected PK CHAR#char-456, got %s", pk)
			}
			return []map[string]types.AttributeValue{
				{
					"PK": &types.AttributeValueMemberS{Value: "CHAR#char-456"},
					"SK": &types.AttributeValueMemberS{Value: "RULEGROUP#turn-rest"},
				},
				{
					"PK": &types.AttributeValueMemberS{Value: "CHAR#char-456"},
					"SK": &types.AttributeValueMemberS{Value: "RULEGROUP#action-economy"},
				},
			}, nil
		},
	}

	items, err := queryRuleGroupAssignments(ctx, db, characterId)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if len(items) != 2 {
		t.Errorf("expected 2 items, got %d", len(items))
	}
}

func TestQueryRuleGroupAssignments_EmptyResult(t *testing.T) {
	ctx := context.Background()
	characterId := "char-empty"

	db := &mockDB{
		queryFunc: func(ctx context.Context, pk string) ([]map[string]types.AttributeValue, error) {
			return []map[string]types.AttributeValue{}, nil
		},
	}

	items, err := queryRuleGroupAssignments(ctx, db, characterId)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if len(items) != 0 {
		t.Errorf("expected 0 items, got %d", len(items))
	}
}

func TestBatchDeleteItems_DeletesInChunksOf25(t *testing.T) {
	ctx := context.Background()

	// Create 30 items to verify chunking
	items := make([]map[string]types.AttributeValue, 30)
	for i := 0; i < 30; i++ {
		items[i] = map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: "CHAR#char-456"},
			"SK": &types.AttributeValueMemberS{Value: "RULEGROUP#group-" + string(rune('a'+i))},
		}
	}

	batchCalls := 0
	deletedItems := []map[string]types.AttributeValue{}

	db := &mockDB{
		batchWriteFunc: func(ctx context.Context, writeRequests []types.WriteRequest) error {
			batchCalls++
			if len(writeRequests) > 25 {
				t.Errorf("expected at most 25 items per batch, got %d", len(writeRequests))
			}
			for _, wr := range writeRequests {
				deletedItems = append(deletedItems, wr.DeleteRequest.Key)
			}
			return nil
		},
	}

	err := batchDeleteItems(ctx, db, items)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if batchCalls != 2 {
		t.Errorf("expected 2 batch calls, got %d", batchCalls)
	}

	if len(deletedItems) != 30 {
		t.Errorf("expected 30 deleted items, got %d", len(deletedItems))
	}
}

func TestBatchDeleteItems_ExtractsOnlyKeyAttributes(t *testing.T) {
	ctx := context.Background()

	// Items have extra fields beyond PK/SK (as DynamoDB Query returns)
	items := []map[string]types.AttributeValue{
		{
			"PK":          &types.AttributeValueMemberS{Value: "CHAR#char-456"},
			"SK":          &types.AttributeValueMemberS{Value: "RULEGROUP#turn-rest"},
			"ruleGroupId": &types.AttributeValueMemberS{Value: "turn-rest"},
			"enabled":     &types.AttributeValueMemberBOOL{Value: true},
			"userId":      &types.AttributeValueMemberS{Value: "user-123"},
		},
		{
			"PK":          &types.AttributeValueMemberS{Value: "CHAR#char-456"},
			"SK":          &types.AttributeValueMemberS{Value: "RULEGROUP#action-economy"},
			"ruleGroupId": &types.AttributeValueMemberS{Value: "action-economy"},
			"enabled":     &types.AttributeValueMemberBOOL{Value: true},
		},
	}

	db := &mockDB{
		batchWriteFunc: func(ctx context.Context, writeRequests []types.WriteRequest) error {
			if len(writeRequests) != 2 {
				t.Fatalf("expected 2 write requests, got %d", len(writeRequests))
			}
			for _, wr := range writeRequests {
				key := wr.DeleteRequest.Key
				// DeleteRequest key must ONLY contain PK and SK
				if len(key) != 2 {
					t.Errorf("expected key to have exactly 2 attributes (PK, SK), got %d: %v", len(key), key)
				}
				if _, ok := key["PK"]; !ok {
					t.Error("expected key to contain PK")
				}
				if _, ok := key["SK"]; !ok {
					t.Error("expected key to contain SK")
				}
				if _, ok := key["ruleGroupId"]; ok {
					t.Error("expected key NOT to contain ruleGroupId")
				}
				if _, ok := key["enabled"]; ok {
					t.Error("expected key NOT to contain enabled")
				}
			}
			return nil
		},
	}

	err := batchDeleteItems(ctx, db, items)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
}

func TestCleanupCharacter_SendsToDLQOnBatchDeleteFailure(t *testing.T) {
	ctx := context.Background()
	characterId := "char-fail"

	dlqCalled := false
	db := &mockDB{
		queryFunc: func(ctx context.Context, pk string) ([]map[string]types.AttributeValue, error) {
			return []map[string]types.AttributeValue{
				{
					"PK": &types.AttributeValueMemberS{Value: "CHAR#char-fail"},
					"SK": &types.AttributeValueMemberS{Value: "RULEGROUP#turn-rest"},
				},
			}, nil
		},
		batchWriteFunc: func(ctx context.Context, writeRequests []types.WriteRequest) error {
			return errors.New("batch write failed")
		},
		sendToDLQFunc: func(ctx context.Context, cid string, err error) error {
			dlqCalled = true
			if cid != characterId {
				t.Errorf("expected characterId %s, got %s", characterId, cid)
			}
			return nil
		},
	}

	err := cleanupCharacter(ctx, db, characterId)
	if err == nil {
		t.Fatal("expected error from cleanupCharacter")
	}

	if !dlqCalled {
		t.Error("expected DLQ notification to be sent")
	}
}
