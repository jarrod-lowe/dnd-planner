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

func TestDeleteCustomRuleGroup(t *testing.T) {
	ctx := context.Background()
	characterId := "char-456"

	deleted := false
	db := &mockDB{
		deleteFunc: func(ctx context.Context, pk, sk string) error {
			if pk != "RULEGROUP#custom-char-456" {
				t.Errorf("expected PK RULEGROUP#custom-char-456, got %s", pk)
			}
			if sk != "META#" {
				t.Errorf("expected SK META#, got %s", sk)
			}
			deleted = true
			return nil
		},
	}

	err := deleteCustomRuleGroup(ctx, db, characterId)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if !deleted {
		t.Error("expected delete to be called")
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
