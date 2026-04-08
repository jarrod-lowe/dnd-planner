package main

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/aws/aws-lambda-go/events"
)

// mockDB implements DynamoDBClient for testing
type mockDB struct {
	deleteCharacterFunc     func(ctx context.Context, userId, characterId string) error
	deleteCharacterCalled   bool
	deleteCharacterParams   [2]string // userId, characterId
}

func (m *mockDB) DeleteCharacter(ctx context.Context, userId, characterId string) error {
	m.deleteCharacterCalled = true
	m.deleteCharacterParams = [2]string{userId, characterId}
	if m.deleteCharacterFunc != nil {
		return m.deleteCharacterFunc(ctx, userId, characterId)
	}
	return errors.New("not implemented")
}

func TestDeleteMissingAuth_Returns401(t *testing.T) {
	ctx := context.Background()

	db := &mockDB{}
	h := newHandler(db)

	event := events.APIGatewayProxyRequest{
		HTTPMethod: "DELETE",
		PathParameters: map[string]string{
			"characterId": "char-123",
		},
		RequestContext: events.APIGatewayProxyRequestContext{
			Authorizer: nil,
		},
	}

	resp, err := h.handle(ctx, event)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", resp.StatusCode)
	}
	if db.deleteCharacterCalled {
		t.Error("expected DeleteCharacter NOT to be called")
	}
}

func TestDeleteMissingCharacterId_Returns400(t *testing.T) {
	ctx := context.Background()

	db := &mockDB{}
	h := newHandler(db)

	event := events.APIGatewayProxyRequest{
		HTTPMethod: "DELETE",
		PathParameters: map[string]string{
			"characterId": "",
		},
		RequestContext: events.APIGatewayProxyRequestContext{
			Authorizer: map[string]any{
				"claims": map[string]any{"sub": "user-123"},
			},
		},
	}

	resp, err := h.handle(ctx, event)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
	if db.deleteCharacterCalled {
		t.Error("expected DeleteCharacter NOT to be called")
	}
}

func TestDeleteMethodNotAllowed_Returns405(t *testing.T) {
	ctx := context.Background()

	db := &mockDB{}
	h := newHandler(db)

	event := events.APIGatewayProxyRequest{
		HTTPMethod: "GET",
		PathParameters: map[string]string{
			"characterId": "char-123",
		},
		RequestContext: events.APIGatewayProxyRequestContext{
			Authorizer: map[string]any{
				"claims": map[string]any{"sub": "user-123"},
			},
		},
	}

	resp, err := h.handle(ctx, event)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if resp.StatusCode != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", resp.StatusCode)
	}
}

func TestDeleteSuccess_Returns204(t *testing.T) {
	ctx := context.Background()
	userId := "user-123"
	characterId := "char-456"

	db := &mockDB{
		deleteCharacterFunc: func(ctx context.Context, uid, cid string) error {
			return nil
		},
	}
	h := newHandler(db)

	event := events.APIGatewayProxyRequest{
		HTTPMethod: "DELETE",
		PathParameters: map[string]string{
			"characterId": characterId,
		},
		RequestContext: events.APIGatewayProxyRequestContext{
			Authorizer: map[string]any{
				"claims": map[string]any{"sub": userId},
			},
		},
	}

	resp, err := h.handle(ctx, event)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if resp.StatusCode != http.StatusNoContent {
		t.Errorf("expected 204, got %d", resp.StatusCode)
	}
	if !db.deleteCharacterCalled {
		t.Error("expected DeleteCharacter to be called")
	}
	if db.deleteCharacterParams != [2]string{userId, characterId} {
		t.Errorf("expected params [user-123, char-456], got %v", db.deleteCharacterParams)
	}
}

func TestDeleteCharacterNotFound_Returns404(t *testing.T) {
	ctx := context.Background()

	db := &mockDB{
		deleteCharacterFunc: func(ctx context.Context, uid, cid string) error {
			return ErrNotFound
		},
	}
	h := newHandler(db)

	event := events.APIGatewayProxyRequest{
		HTTPMethod: "DELETE",
		PathParameters: map[string]string{
			"characterId": "char-nonexistent",
		},
		RequestContext: events.APIGatewayProxyRequestContext{
			Authorizer: map[string]any{
				"claims": map[string]any{"sub": "user-123"},
			},
		},
	}

	resp, err := h.handle(ctx, event)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("expected 404, got %d", resp.StatusCode)
	}
}

func TestDeleteDBError_Returns500(t *testing.T) {
	ctx := context.Background()

	db := &mockDB{
		deleteCharacterFunc: func(ctx context.Context, uid, cid string) error {
			return errors.New("dynamoDB internal error")
		},
	}
	h := newHandler(db)

	event := events.APIGatewayProxyRequest{
		HTTPMethod: "DELETE",
		PathParameters: map[string]string{
			"characterId": "char-123",
		},
		RequestContext: events.APIGatewayProxyRequestContext{
			Authorizer: map[string]any{
				"claims": map[string]any{"sub": "user-123"},
			},
		},
	}

	resp, err := h.handle(ctx, event)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if resp.StatusCode != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", resp.StatusCode)
	}
}
