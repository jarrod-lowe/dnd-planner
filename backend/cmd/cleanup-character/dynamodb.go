package main

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

type dbClient interface {
	query(ctx context.Context, pk string) ([]map[string]types.AttributeValue, error)
	batchWrite(ctx context.Context, writeRequests []types.WriteRequest) error
	delete(ctx context.Context, pk, sk string) error
	sendToDLQ(ctx context.Context, characterId string, err error) error
}

type mockDB struct {
	queryFunc    func(ctx context.Context, pk string) ([]map[string]types.AttributeValue, error)
	batchWriteFunc func(ctx context.Context, writeRequests []types.WriteRequest) error
	deleteFunc   func(ctx context.Context, pk, sk string) error
	sendToDLQFunc func(ctx context.Context, characterId string, err error) error
}

func (m *mockDB) query(ctx context.Context, pk string) ([]map[string]types.AttributeValue, error) {
	if m.queryFunc != nil {
		return m.queryFunc(ctx, pk)
	}
	return nil, fmt.Errorf("not implemented")
}

func (m *mockDB) batchWrite(ctx context.Context, writeRequests []types.WriteRequest) error {
	if m.batchWriteFunc != nil {
		return m.batchWriteFunc(ctx, writeRequests)
	}
	return fmt.Errorf("not implemented")
}

func (m *mockDB) delete(ctx context.Context, pk, sk string) error {
	if m.deleteFunc != nil {
		return m.deleteFunc(ctx, pk, sk)
	}
	return fmt.Errorf("not implemented")
}

func (m *mockDB) sendToDLQ(ctx context.Context, characterId string, err error) error {
	if m.sendToDLQFunc != nil {
		return m.sendToDLQFunc(ctx, characterId, err)
	}
	return fmt.Errorf("not implemented")
}

func queryRuleGroupAssignments(ctx context.Context, db dbClient, characterId string) ([]map[string]types.AttributeValue, error) {
	return db.query(ctx, "CHAR#"+characterId)
}

func batchDeleteItems(ctx context.Context, db dbClient, items []map[string]types.AttributeValue) error {
	for i := 0; i < len(items); i += 25 {
		end := i + 25
		if end > len(items) {
			end = len(items)
		}

		writeRequests := make([]types.WriteRequest, 0, end-i)
		for _, item := range items[i:end] {
			writeRequests = append(writeRequests, types.WriteRequest{
				DeleteRequest: &types.DeleteRequest{Key: item},
			})
		}

		if err := db.batchWrite(ctx, writeRequests); err != nil {
			return err
		}
	}
	return nil
}

func deleteCustomRuleGroup(ctx context.Context, db dbClient, characterId string) error {
	return db.delete(ctx, "RULEGROUP#custom-"+characterId, "META#")
}

func cleanupCharacter(ctx context.Context, db dbClient, characterId string) error {
	items, err := queryRuleGroupAssignments(ctx, db, characterId)
	if err != nil {
		_ = db.sendToDLQ(ctx, characterId, err)
		return err
	}

	if len(items) > 0 {
		if err := batchDeleteItems(ctx, db, items); err != nil {
			_ = db.sendToDLQ(ctx, characterId, err)
			return err
		}
	}

	if err := deleteCustomRuleGroup(ctx, db, characterId); err != nil {
		_ = db.sendToDLQ(ctx, characterId, err)
		return err
	}

	return nil
}
