package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/aws/aws-lambda-go/events"
	"github.com/google/uuid"
)

// mockDB implements seed.DynamoDBClient for testing
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

func TestHandle_ValidRequest_Returns201(t *testing.T) {
	// Arrange
	ctx := context.Background()
	userID := "user-123"
	charName := "Gandalf"
	charSpecies := "human"

	seedRecords := []map[string]any{
		{
			"PK":          "SEED#USER#$(userId)",
			"SK":          "CHAR#$(characterId)",
			"gsiSeedPK":   "SEED#CHAR",
			"type":        "CHAR",
			"characterId": "$(characterId)",
			"userId":      "$(userId)",
			"name":        "$(name)",
			"species":     "$(species)",
			"createdAt":   "$(now)",
			"updatedAt":   "$(now)",
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

	h := newHandler(db)

	body := `{"name":"` + charName + `","species":"` + charSpecies + `"}`
	event := events.APIGatewayProxyRequest{
		Body: body,
		RequestContext: events.APIGatewayProxyRequestContext{
			Authorizer: map[string]any{
				"claims": map[string]any{
					"sub": userID,
				},
			},
		},
	}

	// Act
	resp, err := h.handle(ctx, event)

	// Assert
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if resp.StatusCode != http.StatusCreated {
		t.Errorf("expected status 201, got %d", resp.StatusCode)
	}

	// Verify Location header
	location, ok := resp.Headers["Location"]
	if !ok {
		t.Fatal("expected Location header to be present")
	}
	if !strings.HasPrefix(location, "/api/characters/") {
		t.Errorf("expected Location header to start with /api/characters/, got %s", location)
	}

	// Verify Content-Type
	if resp.Headers["Content-Type"] != "application/json" {
		t.Errorf("expected Content-Type application/json, got %s", resp.Headers["Content-Type"])
	}
}

func TestHandle_ValidRequest_ReturnsCharacterFields(t *testing.T) {
	// Arrange
	ctx := context.Background()
	userID := "user-456"
	charName := "Frodo"
	charSpecies := "hobbit"

	seedRecords := []map[string]any{
		{
			"PK":          "SEED#USER#$(userId)",
			"SK":          "CHAR#$(characterId)",
			"gsiSeedPK":   "SEED#CHAR",
			"type":        "CHAR",
			"characterId": "$(characterId)",
			"userId":      "$(userId)",
			"name":        "$(name)",
			"species":     "$(species)",
			"createdAt":   "$(now)",
			"updatedAt":   "$(now)",
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

	h := newHandler(db)

	body := `{"name":"` + charName + `","species":"` + charSpecies + `"}`
	event := events.APIGatewayProxyRequest{
		Body: body,
		RequestContext: events.APIGatewayProxyRequestContext{
			Authorizer: map[string]any{
				"claims": map[string]any{
					"sub": userID,
				},
			},
		},
	}

	// Act
	resp, err := h.handle(ctx, event)

	// Assert
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	// Parse response body
	var responseBody map[string]any
	if err := json.Unmarshal([]byte(resp.Body), &responseBody); err != nil {
		t.Fatalf("failed to parse response body: %v", err)
	}

	// Verify character fields
	if responseBody["type"] != "CHAR" {
		t.Errorf("expected type CHAR, got %v", responseBody["type"])
	}

	if responseBody["userId"] != userID {
		t.Errorf("expected userId %s, got %v", userID, responseBody["userId"])
	}

	if responseBody["name"] != charName {
		t.Errorf("expected name %s, got %v", charName, responseBody["name"])
	}

	if responseBody["species"] != charSpecies {
		t.Errorf("expected species %s, got %v", charSpecies, responseBody["species"])
	}

	characterID, ok := responseBody["characterId"].(string)
	if !ok || characterID == "" {
		t.Errorf("expected non-empty characterId, got %v", responseBody["characterId"])
	}

	// Verify ruleGroupIds array
	ruleGroupIds, ok := responseBody["ruleGroupIds"].([]any)
	if !ok {
		t.Fatalf("expected ruleGroupIds to be an array, got %v", responseBody["ruleGroupIds"])
	}
	if len(ruleGroupIds) != 1 || ruleGroupIds[0] != "base" {
		t.Errorf("expected ruleGroupIds [base], got %v", ruleGroupIds)
	}

	// Verify internal fields NOT present
	if _, exists := responseBody["PK"]; exists {
		t.Error("expected PK to NOT be in response")
	}
	if _, exists := responseBody["SK"]; exists {
		t.Error("expected SK to NOT be in response")
	}
	if _, exists := responseBody["gsiSeedPK"]; exists {
		t.Error("expected gsiSeedPK to NOT be in response")
	}
}

func TestHandle_MissingName_Returns400(t *testing.T) {
	// Arrange
	ctx := context.Background()

	db := &mockDB{}
	h := newHandler(db)

	event := events.APIGatewayProxyRequest{
		Body: `{"species":"human"}`,
		RequestContext: events.APIGatewayProxyRequestContext{
			Authorizer: map[string]any{
				"claims": map[string]any{
					"sub": "user-123",
				},
			},
		},
	}

	// Act
	resp, err := h.handle(ctx, event)

	// Assert
	if err != nil {
		t.Fatalf("expected no error (validation error in response), got: %v", err)
	}

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", resp.StatusCode)
	}

	// Should NOT call DynamoDB
	if db.queryByGsiSeedPKCalled {
		t.Error("expected queryByGsiSeedPK NOT to be called when validation fails")
	}
}

func TestHandle_MissingSpecies_Returns400(t *testing.T) {
	// Arrange
	ctx := context.Background()

	db := &mockDB{}
	h := newHandler(db)

	event := events.APIGatewayProxyRequest{
		Body: `{"name":"Gandalf"}`,
		RequestContext: events.APIGatewayProxyRequestContext{
			Authorizer: map[string]any{
				"claims": map[string]any{
					"sub": "user-123",
				},
			},
		},
	}

	// Act
	resp, err := h.handle(ctx, event)

	// Assert
	if err != nil {
		t.Fatalf("expected no error (validation error in response), got: %v", err)
	}

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", resp.StatusCode)
	}

	// Should NOT call DynamoDB
	if db.queryByGsiSeedPKCalled {
		t.Error("expected queryByGsiSeedPK NOT to be called when validation fails")
	}
}

func TestHandle_EmptyName_Returns400(t *testing.T) {
	// Arrange
	ctx := context.Background()

	db := &mockDB{}
	h := newHandler(db)

	event := events.APIGatewayProxyRequest{
		Body: `{"name":"","species":"human"}`,
		RequestContext: events.APIGatewayProxyRequestContext{
			Authorizer: map[string]any{
				"claims": map[string]any{
					"sub": "user-123",
				},
			},
		},
	}

	// Act
	resp, err := h.handle(ctx, event)

	// Assert
	if err != nil {
		t.Fatalf("expected no error (validation error in response), got: %v", err)
	}

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", resp.StatusCode)
	}
}

func TestHandle_EmptySpecies_Returns400(t *testing.T) {
	// Arrange
	ctx := context.Background()

	db := &mockDB{}
	h := newHandler(db)

	event := events.APIGatewayProxyRequest{
		Body: `{"name":"Gandalf","species":""}`,
		RequestContext: events.APIGatewayProxyRequestContext{
			Authorizer: map[string]any{
				"claims": map[string]any{
					"sub": "user-123",
				},
			},
		},
	}

	// Act
	resp, err := h.handle(ctx, event)

	// Assert
	if err != nil {
		t.Fatalf("expected no error (validation error in response), got: %v", err)
	}

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", resp.StatusCode)
	}
}

func TestHandle_ExtractsUserIdFromJWT(t *testing.T) {
	// Arrange
	ctx := context.Background()
	userID := "jwt-user-789"

	seedRecords := []map[string]any{
		{
			"PK":          "SEED#USER#$(userId)",
			"SK":          "CHAR#$(characterId)",
			"gsiSeedPK":   "SEED#CHAR",
			"characterId": "$(characterId)",
			"userId":      "$(userId)",
			"name":        "$(name)",
			"species":     "$(species)",
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

	h := newHandler(db)

	event := events.APIGatewayProxyRequest{
		Body: `{"name":"Test","species":"human"}`,
		RequestContext: events.APIGatewayProxyRequestContext{
			Authorizer: map[string]any{
				"claims": map[string]any{
					"sub": userID,
				},
			},
		},
	}

	// Act
	_, err := h.handle(ctx, event)

	// Assert
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	// Verify userId was substituted in the written records
	if len(db.batchWriteItemsPayloads) == 0 {
		t.Fatal("expected records to be written")
	}

	// Find the CHAR record and check userId
	for _, record := range db.batchWriteItemsPayloads {
		if sk, ok := record["SK"].(string); ok && strings.HasPrefix(sk, "CHAR#") {
			if record["userId"] != userID {
				t.Errorf("expected userId to be %s, got %v", userID, record["userId"])
			}
		}
	}
}

func TestHandle_QueriesCharSeeds(t *testing.T) {
	// Arrange
	ctx := context.Background()

	seedRecords := []map[string]any{
		{
			"PK":        "SEED#USER#$(userId)",
			"SK":        "CHAR#$(characterId)",
			"gsiSeedPK": "SEED#CHAR",
			"species":   "$(species)",
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

	h := newHandler(db)

	event := events.APIGatewayProxyRequest{
		Body: `{"name":"Test","species":"human"}`,
		RequestContext: events.APIGatewayProxyRequestContext{
			Authorizer: map[string]any{
				"claims": map[string]any{
					"sub": "user-123",
				},
			},
		},
	}

	// Act
	_, err := h.handle(ctx, event)

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

func TestHandle_GeneratesValidUUID(t *testing.T) {
	// Arrange
	ctx := context.Background()

	seedRecords := []map[string]any{
		{
			"PK":          "SEED#USER#$(userId)",
			"SK":          "CHAR#$(characterId)",
			"gsiSeedPK":   "SEED#CHAR",
			"characterId": "$(characterId)",
			"species":     "$(species)",
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

	h := newHandler(db)

	event := events.APIGatewayProxyRequest{
		Body: `{"name":"Test","species":"human"}`,
		RequestContext: events.APIGatewayProxyRequestContext{
			Authorizer: map[string]any{
				"claims": map[string]any{
					"sub": "user-123",
				},
			},
		},
	}

	// Act
	resp, err := h.handle(ctx, event)

	// Assert
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	var responseBody map[string]any
	if err := json.Unmarshal([]byte(resp.Body), &responseBody); err != nil {
		t.Fatalf("failed to parse response body: %v", err)
	}

	characterID, ok := responseBody["characterId"].(string)
	if !ok {
		t.Fatalf("expected characterId to be string, got %v", responseBody["characterId"])
	}

	// Verify it's a valid UUID
	if _, err := uuid.Parse(characterID); err != nil {
		t.Errorf("expected characterId to be valid UUID, got %s (err: %v)", characterID, err)
	}
}

func TestBuildCharacterResponse_FieldAgnostic(t *testing.T) {
	// This test verifies that buildCharacterResponse is field-agnostic:
	// it copies ALL fields from CHAR record except internal ones (PK, SK, gsiSeedPK),
	// and adds ruleGroupIds from RULEGROUP records.

	// Arrange - simulate records after seed instantiation
	characterID := "char-123"
	records := []map[string]any{
		{
			"PK":          "USER#user-123",
			"SK":          "CHAR#" + characterID,
			"type":        "CHAR",
			"characterId": characterID,
			"userId":      "user-123",
			"name":        "Gandalf",
			"createdAt":   "2026-03-23T10:00:00Z",
			"updatedAt":   "2026-03-23T10:00:00Z",
			// "Unknown" fields that should still be copied
			"customField":  "custom-value",
			"futureField":  42,
			"nestedObject": map[string]any{"key": "value"},
		},
		{
			"PK":          "CHAR#" + characterID,
			"SK":          "RULEGROUP#base",
			"ruleGroupId": "base",
			"enabled":     true,
		},
		{
			"PK":          "CHAR#" + characterID,
			"SK":          "RULEGROUP#phb",
			"ruleGroupId": "phb",
			"enabled":     true,
		},
	}

	// Act
	response := buildCharacterResponse(records)

	// Assert - verify expected fields
	if response["type"] != "CHAR" {
		t.Errorf("expected type CHAR, got %v", response["type"])
	}
	if response["characterId"] != characterID {
		t.Errorf("expected characterId %s, got %v", characterID, response["characterId"])
	}
	if response["name"] != "Gandalf" {
		t.Errorf("expected name Gandalf, got %v", response["name"])
	}

	// Assert - verify unknown fields are copied (field-agnostic)
	if response["customField"] != "custom-value" {
		t.Errorf("expected customField custom-value, got %v", response["customField"])
	}
	if response["futureField"] != 42 {
		t.Errorf("expected futureField 42, got %v", response["futureField"])
	}

	// Assert - verify internal fields are NOT present
	if _, exists := response["PK"]; exists {
		t.Error("expected PK to NOT be in response")
	}
	if _, exists := response["SK"]; exists {
		t.Error("expected SK to NOT be in response")
	}
	if _, exists := response["gsiSeedPK"]; exists {
		t.Error("expected gsiSeedPK to NOT be in response")
	}

	// Assert - verify ruleGroupIds
	ruleGroupIds, ok := response["ruleGroupIds"].([]string)
	if !ok {
		t.Fatalf("expected ruleGroupIds to be []string, got %v", response["ruleGroupIds"])
	}
	if len(ruleGroupIds) != 2 {
		t.Errorf("expected 2 ruleGroupIds, got %d", len(ruleGroupIds))
	}
	// Verify both rule groups are present (order may vary)
	foundBase := false
	foundPhb := false
	for _, id := range ruleGroupIds {
		if id == "base" {
			foundBase = true
		}
		if id == "phb" {
			foundPhb = true
		}
	}
	if !foundBase {
		t.Error("expected ruleGroupIds to contain 'base'")
	}
	if !foundPhb {
		t.Error("expected ruleGroupIds to contain 'phb'")
	}
}

func TestHandle_SeedQueryFails_Returns500(t *testing.T) {
	// Arrange
	ctx := context.Background()

	db := &mockDB{
		queryByGsiSeedPKFunc: func(ctx context.Context, gsiSeedPK string) ([]map[string]any, error) {
			return nil, errors.New("dynamoDB error")
		},
	}

	h := newHandler(db)

	event := events.APIGatewayProxyRequest{
		Body: `{"name":"Test","species":"human"}`,
		RequestContext: events.APIGatewayProxyRequestContext{
			Authorizer: map[string]any{
				"claims": map[string]any{
					"sub": "user-123",
				},
			},
		},
	}

	// Act
	resp, err := h.handle(ctx, event)

	// Assert
	if err != nil {
		t.Fatalf("expected no error (error in response), got: %v", err)
	}

	if resp.StatusCode != http.StatusInternalServerError {
		t.Errorf("expected status 500, got %d", resp.StatusCode)
	}

	// Should NOT attempt to write
	if db.batchWriteItemsCalled {
		t.Error("expected batchWriteItems NOT to be called when query fails")
	}
}

func TestHandle_WriteFails_Returns500(t *testing.T) {
	// Arrange
	ctx := context.Background()

	seedRecords := []map[string]any{
		{
			"PK":        "SEED#USER#$(userId)",
			"SK":        "CHAR#$(characterId)",
			"gsiSeedPK": "SEED#CHAR",
			"species":   "$(species)",
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

	h := newHandler(db)

	event := events.APIGatewayProxyRequest{
		Body: `{"name":"Test","species":"human"}`,
		RequestContext: events.APIGatewayProxyRequestContext{
			Authorizer: map[string]any{
				"claims": map[string]any{
					"sub": "user-123",
				},
			},
		},
	}

	// Act
	resp, err := h.handle(ctx, event)

	// Assert
	if err != nil {
		t.Fatalf("expected no error (error in response), got: %v", err)
	}

	if resp.StatusCode != http.StatusInternalServerError {
		t.Errorf("expected status 500, got %d", resp.StatusCode)
	}
}

func TestHandle_MissingAuthClaims_Returns401(t *testing.T) {
	// Arrange
	ctx := context.Background()

	db := &mockDB{}
	h := newHandler(db)

	// Event with no authorizer claims
	event := events.APIGatewayProxyRequest{
		Body: `{"name":"Test"}`,
		RequestContext: events.APIGatewayProxyRequestContext{
			Authorizer: nil,
		},
	}

	// Act
	resp, err := h.handle(ctx, event)

	// Assert
	if err != nil {
		t.Fatalf("expected no error (error in response), got: %v", err)
	}

	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected status 401, got %d", resp.StatusCode)
	}
}
