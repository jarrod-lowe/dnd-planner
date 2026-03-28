package main

import (
	"context"
	"errors"
	"log/slog"
	"testing"
	"time"

	"github.com/aws/aws-lambda-go/events"
)

// mockDB implements seed.DynamoDBClient for testing
type mockDB struct {
	queryByGsiSeedPKFunc      func(ctx context.Context, gsiSeedPK string) ([]map[string]any, error)
	batchWriteItemsFunc       func(ctx context.Context, items []map[string]any) error
	queryByGsiSeedPKCalled    bool
	batchWriteItemsCalled     bool
	queryByGsiSeedPKParam     string
	batchWriteItemsPayloads   []map[string]any
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

func TestHandlePostConfirmation_CreatesUserRecord(t *testing.T) {
	// Arrange
	ctx := context.Background()
	userID := "test-user-123"

	seedRecords := []map[string]any{
		{
			"PK":                 "SEED#USER#$(userId)",
			"SK":                 "META#",
			"gsiSeedPK":          "SEED#USER",
			"type":               "USER",
			"userId":             "$(userId)",
			"charQuotaRemaining": 10,
			"createdAt":          "$(now)",
			"updatedAt":          "$(now)",
			"customField":        "copied-from-seed",
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

	handler := newHandler(db, slog.Default())

	event := events.CognitoEventUserPoolsPostConfirmation{
		CognitoEventUserPoolsHeader: events.CognitoEventUserPoolsHeader{
			UserPoolID: "test-pool",
			UserName:   userID,
		},
		Request: events.CognitoEventUserPoolsPostConfirmationRequest{
			UserAttributes: map[string]string{
				"sub": userID,
			},
		},
	}

	// Act
	_, err := handler.handle(ctx, event)

	// Assert
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if !db.queryByGsiSeedPKCalled {
		t.Error("expected QueryByGsiSeedPK to be called")
	}

	if db.queryByGsiSeedPKParam != "SEED#USER" {
		t.Errorf("expected QueryByGsiSeedPK with SEED#USER, got %s", db.queryByGsiSeedPKParam)
	}

	if !db.batchWriteItemsCalled {
		t.Error("expected BatchWriteItems to be called")
	}

	if len(db.batchWriteItemsPayloads) != 1 {
		t.Fatalf("expected 1 item to be written, got %d", len(db.batchWriteItemsPayloads))
	}

	written := db.batchWriteItemsPayloads[0]

	// Verify the user record has correct PK (SEED# stripped, userId substituted)
	if written["PK"] != "USER#"+userID {
		t.Errorf("expected PK to be USER#%s, got %v", userID, written["PK"])
	}

	if written["SK"] != "META#" {
		t.Errorf("expected SK to be META#, got %v", written["SK"])
	}

	if written["type"] != "USER" {
		t.Errorf("expected type to be USER, got %v", written["type"])
	}

	if written["charQuotaRemaining"] != 10 {
		t.Errorf("expected charQuotaRemaining to be 10, got %v", written["charQuotaRemaining"])
	}

	if written["userId"] != userID {
		t.Errorf("expected userId to be %s, got %v", userID, written["userId"])
	}
	if written["userId"] == "$(userId)" {
		t.Error("expected userId to be substituted, got literal $(userId)")
	}

	// Verify customField was copied from seed (proves generic copy, not hardcoded)
	if written["customField"] != "copied-from-seed" {
		t.Errorf("expected customField to be copied-from-seed, got %v", written["customField"])
	}

	// Verify gsiSeedPK is NOT in the written record
	if _, exists := written["gsiSeedPK"]; exists {
		t.Error("expected gsiSeedPK to NOT be in written record")
	}

	// Verify createdAt and updatedAt are RFC3339 timestamps (not literal "$(now)")
	createdAt, ok := written["createdAt"].(string)
	if !ok {
		t.Fatal("expected createdAt to be a string")
	}
	if createdAt == "$(now)" {
		t.Error("expected createdAt to be substituted, got literal $(now)")
	}
	if _, err := time.Parse(time.RFC3339, createdAt); err != nil {
		t.Errorf("expected createdAt to be RFC3339, got: %s (err: %v)", createdAt, err)
	}

	updatedAt, ok := written["updatedAt"].(string)
	if !ok {
		t.Fatal("expected updatedAt to be a string")
	}
	if updatedAt == "$(now)" {
		t.Error("expected updatedAt to be substituted, got literal $(now)")
	}
	if _, err := time.Parse(time.RFC3339, updatedAt); err != nil {
		t.Errorf("expected updatedAt to be RFC3339, got: %s (err: %v)", updatedAt, err)
	}
}

func TestHandlePostConfirmation_SeedRecordMissing_ReturnsError(t *testing.T) {
	// Arrange
	ctx := context.Background()
	userID := "test-user-456"

	db := &mockDB{
		queryByGsiSeedPKFunc: func(ctx context.Context, gsiSeedPK string) ([]map[string]any, error) {
			return nil, errors.New("item not found")
		},
	}

	handler := newHandler(db, slog.Default())

	event := events.CognitoEventUserPoolsPostConfirmation{
		CognitoEventUserPoolsHeader: events.CognitoEventUserPoolsHeader{
			UserPoolID: "test-pool",
			UserName:   userID,
		},
		Request: events.CognitoEventUserPoolsPostConfirmationRequest{
			UserAttributes: map[string]string{
				"sub": userID,
			},
		},
	}

	// Act
	_, err := handler.handle(ctx, event)

	// Assert
	if err == nil {
		t.Fatal("expected error when seed record is missing, got nil")
	}

	if db.batchWriteItemsCalled {
		t.Error("expected BatchWriteItems NOT to be called when seed query fails")
	}
}

func TestHandlePostConfirmation_SubstitutesEmail(t *testing.T) {
	// Arrange
	ctx := context.Background()
	userID := "test-user-email"
	userEmail := "test@example.com"

	seedRecords := []map[string]any{
		{
			"PK":        "SEED#USER#$(userId)",
			"SK":        "META#",
			"gsiSeedPK": "SEED#USER",
			"userId":    "$(userId)",
			"email":     "$(email)",
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

	handler := newHandler(db, slog.Default())

	event := events.CognitoEventUserPoolsPostConfirmation{
		CognitoEventUserPoolsHeader: events.CognitoEventUserPoolsHeader{
			UserPoolID: "test-pool",
			UserName:   userID,
		},
		Request: events.CognitoEventUserPoolsPostConfirmationRequest{
			UserAttributes: map[string]string{
				"sub":   userID,
				"email": userEmail,
			},
		},
	}

	// Act
	_, err := handler.handle(ctx, event)

	// Assert
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	written := db.batchWriteItemsPayloads[0]
	if written["email"] != userEmail {
		t.Errorf("expected email to be %s, got %v", userEmail, written["email"])
	}
	if written["email"] == "$(email)" {
		t.Error("expected email to be substituted, got literal $(email)")
	}
}

func TestHandlePostConfirmation_DynamoDBPutFails_ReturnsError(t *testing.T) {
	// Arrange
	ctx := context.Background()
	userID := "test-user-789"

	seedRecords := []map[string]any{
		{
			"PK":                 "SEED#USER#$(userId)",
			"SK":                 "META#",
			"gsiSeedPK":          "SEED#USER",
			"type":               "USER",
			"userId":             "$(userId)",
			"charQuotaRemaining": 10,
			"createdAt":          "$(now)",
			"updatedAt":          "$(now)",
		},
	}

	db := &mockDB{
		queryByGsiSeedPKFunc: func(ctx context.Context, gsiSeedPK string) ([]map[string]any, error) {
			return seedRecords, nil
		},
		batchWriteItemsFunc: func(ctx context.Context, items []map[string]any) error {
			return errors.New("dynamoDB unavailable")
		},
	}

	handler := newHandler(db, slog.Default())

	event := events.CognitoEventUserPoolsPostConfirmation{
		CognitoEventUserPoolsHeader: events.CognitoEventUserPoolsHeader{
			UserPoolID: "test-pool",
			UserName:   userID,
		},
		Request: events.CognitoEventUserPoolsPostConfirmationRequest{
			UserAttributes: map[string]string{
				"sub": userID,
			},
		},
	}

	// Act
	_, err := handler.handle(ctx, event)

	// Assert
	if err == nil {
		t.Fatal("expected error when DynamoDB write fails, got nil")
	}
}
