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
	queryOwnershipFunc    func(ctx context.Context, userId, characterId string) (bool, error)
	putRuleGroupFunc      func(ctx context.Context, characterId, ruleGroupId, userId string) (string, error)
	deleteRuleGroupFunc   func(ctx context.Context, characterId, ruleGroupId string) error
	queryOwnershipCalled  bool
	putRuleGroupCalled    bool
	deleteRuleGroupCalled bool
	queryOwnershipParams  [2]string
	putRuleGroupParams    [3]string
	deleteRuleGroupParams [2]string
}

func (m *mockDB) QueryOwnership(ctx context.Context, userId, characterId string) (bool, error) {
	m.queryOwnershipCalled = true
	m.queryOwnershipParams = [2]string{userId, characterId}
	if m.queryOwnershipFunc != nil {
		return m.queryOwnershipFunc(ctx, userId, characterId)
	}
	return false, errors.New("not implemented")
}

func (m *mockDB) PutRuleGroup(ctx context.Context, characterId, ruleGroupId, userId string) (string, error) {
	m.putRuleGroupCalled = true
	m.putRuleGroupParams = [3]string{characterId, ruleGroupId, userId}
	if m.putRuleGroupFunc != nil {
		return m.putRuleGroupFunc(ctx, characterId, ruleGroupId, userId)
	}
	return "", errors.New("not implemented")
}

func (m *mockDB) DeleteRuleGroup(ctx context.Context, characterId, ruleGroupId string) error {
	m.deleteRuleGroupCalled = true
	m.deleteRuleGroupParams = [2]string{characterId, ruleGroupId}
	if m.deleteRuleGroupFunc != nil {
		return m.deleteRuleGroupFunc(ctx, characterId, ruleGroupId)
	}
	return errors.New("not implemented")
}

func TestPostMissingRuleGroupId_Returns400(t *testing.T) {
	ctx := context.Background()

	db := &mockDB{}
	h := newHandler(db)

	event := events.APIGatewayProxyRequest{
		HTTPMethod: "POST",
		PathParameters: map[string]string{
			"characterId": "char-123",
		},
		Body: `{}`,
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
	if db.queryOwnershipCalled {
		t.Error("expected QueryOwnership NOT to be called")
	}
}

func TestPostEmptyRuleGroupId_Returns400(t *testing.T) {
	ctx := context.Background()

	db := &mockDB{}
	h := newHandler(db)

	event := events.APIGatewayProxyRequest{
		HTTPMethod: "POST",
		PathParameters: map[string]string{
			"characterId": "char-123",
		},
		Body: `{"ruleGroupId": ""}`,
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
	if db.queryOwnershipCalled {
		t.Error("expected QueryOwnership NOT to be called")
	}
}

func TestPostCharacterNotOwned_Returns403(t *testing.T) {
	ctx := context.Background()

	db := &mockDB{
		queryOwnershipFunc: func(ctx context.Context, uid, cid string) (bool, error) {
			return false, nil
		},
	}
	h := newHandler(db)

	event := events.APIGatewayProxyRequest{
		HTTPMethod: "POST",
		PathParameters: map[string]string{
			"characterId": "char-123",
		},
		Body: `{"ruleGroupId": "fireball"}`,
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
	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("expected 403, got %d", resp.StatusCode)
	}
	if db.putRuleGroupCalled {
		t.Error("expected PutRuleGroup NOT to be called")
	}
}

func TestDeleteCharacterNotOwned_Returns403(t *testing.T) {
	ctx := context.Background()

	db := &mockDB{
		queryOwnershipFunc: func(ctx context.Context, uid, cid string) (bool, error) {
			return false, nil
		},
	}
	h := newHandler(db)

	event := events.APIGatewayProxyRequest{
		HTTPMethod: "DELETE",
		PathParameters: map[string]string{
			"characterId": "char-123",
			"ruleGroupId": "fireball",
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
	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("expected 403, got %d", resp.StatusCode)
	}
	if db.deleteRuleGroupCalled {
		t.Error("expected DeleteRuleGroup NOT to be called")
	}
}

func TestPostSuccess_Returns201(t *testing.T) {
	ctx := context.Background()
	userId := "user-123"
	characterId := "char-456"
	ruleGroupId := "fireball"
	createdAt := "2026-03-28T10:00:00Z"

	db := &mockDB{
		queryOwnershipFunc: func(ctx context.Context, uid, cid string) (bool, error) {
			return uid == userId && cid == characterId, nil
		},
		putRuleGroupFunc: func(ctx context.Context, cid, rid, uid string) (string, error) {
			return createdAt, nil
		},
	}
	h := newHandler(db)

	event := events.APIGatewayProxyRequest{
		HTTPMethod: "POST",
		PathParameters: map[string]string{
			"characterId": characterId,
		},
		Body: `{"ruleGroupId": "` + ruleGroupId + `"}`,
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
	if resp.StatusCode != http.StatusCreated {
		t.Errorf("expected 201, got %d", resp.StatusCode)
	}
	if !db.queryOwnershipCalled {
		t.Error("expected QueryOwnership to be called")
	}
	if !db.putRuleGroupCalled {
		t.Error("expected PutRuleGroup to be called")
	}
	if db.putRuleGroupParams != [3]string{characterId, ruleGroupId, userId} {
		t.Errorf("expected params [char-456, fireball, user-123], got %v", db.putRuleGroupParams)
	}
}

func TestDeleteSuccess_Returns204(t *testing.T) {
	ctx := context.Background()
	userId := "user-123"
	characterId := "char-456"
	ruleGroupId := "fireball"

	db := &mockDB{
		queryOwnershipFunc: func(ctx context.Context, uid, cid string) (bool, error) {
			return uid == userId && cid == characterId, nil
		},
		deleteRuleGroupFunc: func(ctx context.Context, cid, rid string) error {
			return nil
		},
	}
	h := newHandler(db)

	event := events.APIGatewayProxyRequest{
		HTTPMethod: "DELETE",
		PathParameters: map[string]string{
			"characterId": characterId,
			"ruleGroupId": ruleGroupId,
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
	if !db.deleteRuleGroupCalled {
		t.Error("expected DeleteRuleGroup to be called")
	}
	if db.deleteRuleGroupParams != [2]string{characterId, ruleGroupId} {
		t.Errorf("expected params [char-456, fireball], got %v", db.deleteRuleGroupParams)
	}
}

func TestPostDuplicateRuleGroup_Returns409(t *testing.T) {
	ctx := context.Background()

	db := &mockDB{
		queryOwnershipFunc: func(ctx context.Context, uid, cid string) (bool, error) {
			return true, nil
		},
		putRuleGroupFunc: func(ctx context.Context, cid, rid, uid string) (string, error) {
			return "", ErrConditionalCheckFailed
		},
	}
	h := newHandler(db)

	event := events.APIGatewayProxyRequest{
		HTTPMethod: "POST",
		PathParameters: map[string]string{
			"characterId": "char-456",
		},
		Body: `{"ruleGroupId": "fireball"}`,
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
	if resp.StatusCode != http.StatusConflict {
		t.Errorf("expected 409, got %d", resp.StatusCode)
	}
}

func TestDeleteNotFound_Returns404(t *testing.T) {
	ctx := context.Background()

	db := &mockDB{
		queryOwnershipFunc: func(ctx context.Context, uid, cid string) (bool, error) {
			return true, nil
		},
		deleteRuleGroupFunc: func(ctx context.Context, cid, rid string) error {
			return ErrNotFound
		},
	}
	h := newHandler(db)

	event := events.APIGatewayProxyRequest{
		HTTPMethod: "DELETE",
		PathParameters: map[string]string{
			"characterId": "char-456",
			"ruleGroupId": "nonexistent",
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

func TestMethodNotAllowed_Returns405(t *testing.T) {
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

func TestPostMissingAuth_Returns401(t *testing.T) {
	ctx := context.Background()

	db := &mockDB{}
	h := newHandler(db)

	event := events.APIGatewayProxyRequest{
		HTTPMethod: "POST",
		PathParameters: map[string]string{
			"characterId": "char-123",
		},
		Body: `{"ruleGroupId": "fireball"}`,
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
}

func TestDeleteMissingAuth_Returns401(t *testing.T) {
	ctx := context.Background()

	db := &mockDB{}
	h := newHandler(db)

	event := events.APIGatewayProxyRequest{
		HTTPMethod: "DELETE",
		PathParameters: map[string]string{
			"characterId": "char-123",
			"ruleGroupId": "fireball",
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
}
