package seed

import (
	"context"
	"errors"
	"testing"
)

// mockDB is a mock DynamoDB client for testing
type mockDB struct {
	queryByGsiSeedPKFunc    func(ctx context.Context, gsiSeedPK string) ([]map[string]any, error)
	batchWriteItemsFunc     func(ctx context.Context, items []map[string]any) error
	queryByGsiSeedPKCalled  bool
	batchWriteItemsCalled   bool
	queryByGsiSeedPKParam   string
	batchWriteItemsPayloads []map[string]any
}

func (m *mockDB) QueryByGsiSeedPK(ctx context.Context, gsiSeedPK string) ([]map[string]any, error) {
	m.queryByGsiSeedPKCalled = true
	m.queryByGsiSeedPKParam = gsiSeedPK
	if m.queryByGsiSeedPKFunc != nil {
		return m.queryByGsiSeedPKFunc(ctx, gsiSeedPK)
	}
	return nil, errors.New("not implemented")
}

func (m *mockDB) BatchWriteItems(ctx context.Context, items []map[string]any) error {
	m.batchWriteItemsCalled = true
	m.batchWriteItemsPayloads = items
	if m.batchWriteItemsFunc != nil {
		return m.batchWriteItemsFunc(ctx, items)
	}
	return errors.New("not implemented")
}

func TestInstantiate_QueriesByGsiSeedPK(t *testing.T) {
	// Arrange
	ctx := context.Background()
	db := &mockDB{
		queryByGsiSeedPKFunc: func(ctx context.Context, gsiSeedPK string) ([]map[string]any, error) {
			return []map[string]any{}, nil
		},
		batchWriteItemsFunc: func(ctx context.Context, items []map[string]any) error {
			return nil
		},
	}
	vars := map[string]string{"userId": "test-user"}

	// Act
	_, err := Instantiate(ctx, db, "SEED#CHAR", vars)

	// Assert
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if !db.queryByGsiSeedPKCalled {
		t.Error("expected queryByGsiSeedPK to be called")
	}

	if db.queryByGsiSeedPKParam != "SEED#CHAR" {
		t.Errorf("expected queryByGsiSeedPK with SEED#CHAR, got %s", db.queryByGsiSeedPKParam)
	}
}

func TestInstantiate_StripsSeedPrefix(t *testing.T) {
	// Arrange
	ctx := context.Background()
	seedRecords := []map[string]any{
		{
			"PK":          "SEED#USER#test-user",
			"SK":          "CHAR#test-char",
			"gsiSeedPK":   "SEED#CHAR",
			"characterId": "test-char",
		},
	}
	db := &mockDB{
		queryByGsiSeedPKFunc: func(ctx context.Context, gsiSeedPK string) ([]map[string]any, error) {
			return seedRecords, nil
		},
		batchWriteItemsFunc: func(ctx context.Context, items []map[string]any) error {
			return nil
		},
	}
	vars := map[string]string{"userId": "test-user", "characterId": "test-char"}

	// Act
	records, err := Instantiate(ctx, db, "SEED#CHAR", vars)

	// Assert
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if len(records) != 1 {
		t.Fatalf("expected 1 record, got %d", len(records))
	}

	// PK should have SEED# prefix stripped
	if records[0]["PK"] != "USER#test-user" {
		t.Errorf("expected PK to be USER#test-user (SEED# stripped), got %v", records[0]["PK"])
	}
}

func TestInstantiate_RemovesGsiSeedPK(t *testing.T) {
	// Arrange
	ctx := context.Background()
	seedRecords := []map[string]any{
		{
			"PK":          "SEED#USER#test-user",
			"SK":          "CHAR#test-char",
			"gsiSeedPK":   "SEED#CHAR",
			"characterId": "test-char",
		},
	}
	db := &mockDB{
		queryByGsiSeedPKFunc: func(ctx context.Context, gsiSeedPK string) ([]map[string]any, error) {
			return seedRecords, nil
		},
		batchWriteItemsFunc: func(ctx context.Context, items []map[string]any) error {
			return nil
		},
	}
	vars := map[string]string{"userId": "test-user", "characterId": "test-char"}

	// Act
	records, err := Instantiate(ctx, db, "SEED#CHAR", vars)

	// Assert
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if len(records) != 1 {
		t.Fatalf("expected 1 record, got %d", len(records))
	}

	// gsiSeedPK should be removed from output
	if _, exists := records[0]["gsiSeedPK"]; exists {
		t.Error("expected gsiSeedPK to be removed from output record")
	}
}

func TestInstantiate_SubstitutesVariables(t *testing.T) {
	// Arrange
	ctx := context.Background()
	seedRecords := []map[string]any{
		{
			"PK":          "SEED#USER#$(userId)",
			"SK":          "CHAR#$(characterId)",
			"gsiSeedPK":   "SEED#CHAR",
			"characterId": "$(characterId)",
			"userId":      "$(userId)",
			"name":        "$(name)",
		},
	}
	db := &mockDB{
		queryByGsiSeedPKFunc: func(ctx context.Context, gsiSeedPK string) ([]map[string]any, error) {
			return seedRecords, nil
		},
		batchWriteItemsFunc: func(ctx context.Context, items []map[string]any) error {
			return nil
		},
	}
	vars := map[string]string{
		"userId":      "user-123",
		"characterId": "char-456",
		"name":        "Gandalf",
	}

	// Act
	records, err := Instantiate(ctx, db, "SEED#CHAR", vars)

	// Assert
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if len(records) != 1 {
		t.Fatalf("expected 1 record, got %d", len(records))
	}

	// Verify variable substitution in PK (after SEED# stripped)
	if records[0]["PK"] != "USER#user-123" {
		t.Errorf("expected PK to be USER#user-123, got %v", records[0]["PK"])
	}

	// Verify variable substitution in SK
	if records[0]["SK"] != "CHAR#char-456" {
		t.Errorf("expected SK to be CHAR#char-456, got %v", records[0]["SK"])
	}

	// Verify variable substitution in other fields
	if records[0]["characterId"] != "char-456" {
		t.Errorf("expected characterId to be char-456, got %v", records[0]["characterId"])
	}

	if records[0]["userId"] != "user-123" {
		t.Errorf("expected userId to be user-123, got %v", records[0]["userId"])
	}

	if records[0]["name"] != "Gandalf" {
		t.Errorf("expected name to be Gandalf, got %v", records[0]["name"])
	}
}

func TestInstantiate_CopiesAllFields(t *testing.T) {
	// This test verifies field-agnostic behavior: ALL fields from seed are copied,
	// even ones we don't know about. This makes it easy to add new fields without code changes.

	// Arrange
	ctx := context.Background()
	seedRecords := []map[string]any{
		{
			"PK":          "SEED#USER#$(userId)",
			"SK":          "CHAR#$(characterId)",
			"gsiSeedPK":   "SEED#CHAR",
			"characterId": "$(characterId)",
			"userId":      "$(userId)",
			"name":        "$(name)",
			// These fields are "unknown" to the code but should still be copied
			"futureField1": "static-value",
			"futureField2": "$(futureVar)",
			"customData":   "some-data",
		},
	}
	db := &mockDB{
		queryByGsiSeedPKFunc: func(ctx context.Context, gsiSeedPK string) ([]map[string]any, error) {
			return seedRecords, nil
		},
		batchWriteItemsFunc: func(ctx context.Context, items []map[string]any) error {
			return nil
		},
	}
	vars := map[string]string{
		"userId":      "user-123",
		"characterId": "char-456",
		"name":        "Gandalf",
		"futureVar":   "future-value",
	}

	// Act
	records, err := Instantiate(ctx, db, "SEED#CHAR", vars)

	// Assert
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if len(records) != 1 {
		t.Fatalf("expected 1 record, got %d", len(records))
	}

	// Verify unknown fields are copied
	if records[0]["futureField1"] != "static-value" {
		t.Errorf("expected futureField1 to be static-value, got %v", records[0]["futureField1"])
	}

	if records[0]["futureField2"] != "future-value" {
		t.Errorf("expected futureField2 to be future-value (substituted), got %v", records[0]["futureField2"])
	}

	if records[0]["customData"] != "some-data" {
		t.Errorf("expected customData to be some-data, got %v", records[0]["customData"])
	}
}

func TestInstantiate_PreservesNonStringTypes(t *testing.T) {
	// Arrange
	ctx := context.Background()
	seedRecords := []map[string]any{
		{
			"PK":                "SEED#USER#$(userId)",
			"SK":                "CHAR#$(characterId)",
			"gsiSeedPK":         "SEED#CHAR",
			"characterId":       "$(characterId)",
			"charQuotaRemaining": 10,      // number
			"enabled":           true,     // boolean
			"nestedData":        map[string]any{"key": "value"}, // map
		},
	}
	db := &mockDB{
		queryByGsiSeedPKFunc: func(ctx context.Context, gsiSeedPK string) ([]map[string]any, error) {
			return seedRecords, nil
		},
		batchWriteItemsFunc: func(ctx context.Context, items []map[string]any) error {
			return nil
		},
	}
	vars := map[string]string{
		"userId":      "user-123",
		"characterId": "char-456",
	}

	// Act
	records, err := Instantiate(ctx, db, "SEED#CHAR", vars)

	// Assert
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if len(records) != 1 {
		t.Fatalf("expected 1 record, got %d", len(records))
	}

	// Verify non-string types are preserved
	if records[0]["charQuotaRemaining"] != 10 {
		t.Errorf("expected charQuotaRemaining to be 10, got %v", records[0]["charQuotaRemaining"])
	}

	if records[0]["enabled"] != true {
		t.Errorf("expected enabled to be true, got %v", records[0]["enabled"])
	}

	nestedData, ok := records[0]["nestedData"].(map[string]any)
	if !ok {
		t.Fatalf("expected nestedData to be a map, got %T", records[0]["nestedData"])
	}
	if nestedData["key"] != "value" {
		t.Errorf("expected nestedData.key to be value, got %v", nestedData["key"])
	}
}

func TestInstantiate_WritesToDynamoDB(t *testing.T) {
	// Arrange
	ctx := context.Background()
	seedRecords := []map[string]any{
		{
			"PK":          "SEED#USER#$(userId)",
			"SK":          "CHAR#$(characterId)",
			"gsiSeedPK":   "SEED#CHAR",
			"characterId": "$(characterId)",
		},
		{
			"PK":          "SEED#CHAR#$(characterId)",
			"SK":          "RULEGROUP#base",
			"gsiSeedPK":   "SEED#CHAR",
			"ruleGroupId": "base",
			"enabled":     true,
		},
	}
	db := &mockDB{
		queryByGsiSeedPKFunc: func(ctx context.Context, gsiSeedPK string) ([]map[string]any, error) {
			return seedRecords, nil
		},
		batchWriteItemsFunc: func(ctx context.Context, items []map[string]any) error {
			return nil
		},
	}
	vars := map[string]string{
		"userId":      "user-123",
		"characterId": "char-456",
	}

	// Act
	_, err := Instantiate(ctx, db, "SEED#CHAR", vars)

	// Assert
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if !db.batchWriteItemsCalled {
		t.Error("expected batchWriteItems to be called")
	}

	// Verify both records were written
	if len(db.batchWriteItemsPayloads) != 2 {
		t.Errorf("expected 2 records to be written, got %d", len(db.batchWriteItemsPayloads))
	}
}

func TestInstantiate_QueryFails_ReturnsError(t *testing.T) {
	// Arrange
	ctx := context.Background()
	db := &mockDB{
		queryByGsiSeedPKFunc: func(ctx context.Context, gsiSeedPK string) ([]map[string]any, error) {
			return nil, errors.New("query failed")
		},
	}
	vars := map[string]string{"userId": "test-user"}

	// Act
	_, err := Instantiate(ctx, db, "SEED#CHAR", vars)

	// Assert
	if err == nil {
		t.Fatal("expected error when query fails, got nil")
	}

	if db.batchWriteItemsCalled {
		t.Error("expected batchWriteItems NOT to be called when query fails")
	}
}

func TestInstantiate_WriteFails_ReturnsError(t *testing.T) {
	// Arrange
	ctx := context.Background()
	seedRecords := []map[string]any{
		{
			"PK":        "SEED#USER#$(userId)",
			"SK":        "CHAR#$(characterId)",
			"gsiSeedPK": "SEED#CHAR",
		},
	}
	db := &mockDB{
		queryByGsiSeedPKFunc: func(ctx context.Context, gsiSeedPK string) ([]map[string]any, error) {
			return seedRecords, nil
		},
		batchWriteItemsFunc: func(ctx context.Context, items []map[string]any) error {
			return errors.New("write failed")
		},
	}
	vars := map[string]string{
		"userId":      "user-123",
		"characterId": "char-456",
	}

	// Act
	_, err := Instantiate(ctx, db, "SEED#CHAR", vars)

	// Assert
	if err == nil {
		t.Fatal("expected error when write fails, got nil")
	}
}
