package main

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/aws/aws-lambda-go/events"
)

// mockDB is a mock DynamoDB client for testing
type mockDB struct {
	getItemFunc    func(ctx context.Context, pk, sk string) (map[string]any, error)
	putItemFunc    func(ctx context.Context, item map[string]any) error
	getItemCalled  bool
	putItemCalled  bool
	getItemPK      string
	getItemSK      string
	putItemPayload map[string]any
}

func (m *mockDB) getItem(ctx context.Context, pk, sk string) (map[string]any, error) {
	m.getItemCalled = true
	m.getItemPK = pk
	m.getItemSK = sk
	if m.getItemFunc != nil {
		return m.getItemFunc(ctx, pk, sk)
	}
	return nil, errors.New("not implemented")
}

func (m *mockDB) putItem(ctx context.Context, item map[string]any) error {
	m.putItemCalled = true
	m.putItemPayload = item
	if m.putItemFunc != nil {
		return m.putItemFunc(ctx, item)
	}
	return errors.New("not implemented")
}

func TestHandlePostConfirmation_CreatesUserRecord(t *testing.T) {
	// Arrange
	ctx := context.Background()
	userID := "test-user-123"

	seedRecord := map[string]any{
		"PK":                 "SEED#USER#$(userId)",
		"SK":                 "META#",
		"type":               "USER",
		"userId":             "$(userId)",
		"charQuotaRemaining": 10,
		"createdAt":          "$(now)",
		"updatedAt":          "$(now)",
		"customField":        "copied-from-seed", // proves we copy from seed, not hardcode
	}

	db := &mockDB{
		getItemFunc: func(ctx context.Context, pk, sk string) (map[string]any, error) {
			return seedRecord, nil
		},
		putItemFunc: func(ctx context.Context, item map[string]any) error {
			return nil
		},
	}

	handler := newHandler(db, "test-table")

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

	if !db.getItemCalled {
		t.Error("expected GetItem to be called")
	}

	if db.getItemPK != "SEED#USER" || db.getItemSK != "META#" {
		t.Errorf("expected GetItem with SEED#USER/META#, got %s/%s", db.getItemPK, db.getItemSK)
	}

	if !db.putItemCalled {
		t.Error("expected PutItem to be called")
	}

	// Verify the user record has correct PK (SEED# stripped, userId substituted)
	if db.putItemPayload["PK"] != "USER#"+userID {
		t.Errorf("expected PK to be USER#%s, got %v", userID, db.putItemPayload["PK"])
	}

	if db.putItemPayload["SK"] != "META#" {
		t.Errorf("expected SK to be META#, got %v", db.putItemPayload["SK"])
	}

	if db.putItemPayload["type"] != "USER" {
		t.Errorf("expected type to be USER, got %v", db.putItemPayload["type"])
	}

	if db.putItemPayload["charQuotaRemaining"] != 10 {
		t.Errorf("expected charQuotaRemaining to be 10, got %v", db.putItemPayload["charQuotaRemaining"])
	}

	if db.putItemPayload["userId"] != userID {
		t.Errorf("expected userId to be %s, got %v", userID, db.putItemPayload["userId"])
	}
	// Verify userId was substituted, not literal "$(userId)"
	if db.putItemPayload["userId"] == "$(userId)" {
		t.Error("expected userId to be substituted, got literal $(userId)")
	}

	// Verify customField was copied from seed (proves generic copy, not hardcoded)
	if db.putItemPayload["customField"] != "copied-from-seed" {
		t.Errorf("expected customField to be copied-from-seed, got %v", db.putItemPayload["customField"])
	}

	// Verify createdAt and updatedAt are RFC3339 timestamps (not literal "$(now)")
	createdAt, ok := db.putItemPayload["createdAt"].(string)
	if !ok {
		t.Fatal("expected createdAt to be a string")
	}
	if createdAt == "$(now)" {
		t.Error("expected createdAt to be substituted, got literal $(now)")
	}
	// Verify it's a valid RFC3339 timestamp
	if _, err := time.Parse(time.RFC3339, createdAt); err != nil {
		t.Errorf("expected createdAt to be RFC3339, got: %s (err: %v)", createdAt, err)
	}

	updatedAt, ok := db.putItemPayload["updatedAt"].(string)
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
		getItemFunc: func(ctx context.Context, pk, sk string) (map[string]any, error) {
			return nil, errors.New("item not found")
		},
	}

	handler := newHandler(db, "test-table")

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

	if db.putItemCalled {
		t.Error("expected PutItem NOT to be called when seed is missing")
	}
}

func TestHandlePostConfirmation_SubstitutesEmail(t *testing.T) {
	// Arrange
	ctx := context.Background()
	userID := "test-user-email"
	userEmail := "test@example.com"

	seedRecord := map[string]any{
		"PK":     "SEED#USER#$(userId)",
		"SK":     "META#",
		"userId": "$(userId)",
		"email":  "$(email)",
	}

	db := &mockDB{
		getItemFunc: func(ctx context.Context, pk, sk string) (map[string]any, error) {
			return seedRecord, nil
		},
		putItemFunc: func(ctx context.Context, item map[string]any) error {
			return nil
		},
	}

	handler := newHandler(db, "test-table")

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

	if db.putItemPayload["email"] != userEmail {
		t.Errorf("expected email to be %s, got %v", userEmail, db.putItemPayload["email"])
	}
	if db.putItemPayload["email"] == "$(email)" {
		t.Error("expected email to be substituted, got literal $(email)")
	}
}

func TestHandlePostConfirmation_DynamoDBPutFails_ReturnsError(t *testing.T) {
	// Arrange
	ctx := context.Background()
	userID := "test-user-789"

	seedRecord := map[string]any{
		"PK":                 "SEED#USER#$(userId)",
		"SK":                 "META#",
		"type":               "USER",
		"userId":             "$(userId)",
		"charQuotaRemaining": 10,
		"createdAt":          "$(now)",
		"updatedAt":          "$(now)",
	}

	db := &mockDB{
		getItemFunc: func(ctx context.Context, pk, sk string) (map[string]any, error) {
			return seedRecord, nil
		},
		putItemFunc: func(ctx context.Context, item map[string]any) error {
			return errors.New("dynamoDB unavailable")
		},
	}

	handler := newHandler(db, "test-table")

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
		t.Fatal("expected error when DynamoDB put fails, got nil")
	}
}
