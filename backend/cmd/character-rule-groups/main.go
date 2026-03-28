package main

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/jarrod/dnd-planner/backend/internal/auth"
	"github.com/jarrod/dnd-planner/backend/internal/response"
)

// Sentinel errors for specific error conditions
var (
	ErrConditionalCheckFailed = errors.New("conditional check failed")
	ErrNotFound               = errors.New("not found")
)

// DynamoDBClient defines the interface for DynamoDB operations
type DynamoDBClient interface {
	QueryOwnership(ctx context.Context, userId, characterId string) (bool, error)
	PutRuleGroup(ctx context.Context, characterId, ruleGroupId, userId string) (string, error)
	DeleteRuleGroup(ctx context.Context, characterId, ruleGroupId string) error
}

// handler handles API Gateway requests for character rule groups
type handler struct {
	db     DynamoDBClient
	logger *slog.Logger
}

// newHandler creates a new handler
func newHandler(db DynamoDBClient) *handler {
	return &handler{
		db:     db,
		logger: slog.Default(),
	}
}

// handlePost handles POST requests to add a rule group to a character
func (h *handler) handlePost(ctx context.Context, event events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	// 1. Extract userId from JWT claims
	userId, err := auth.ExtractUserId(event)
	if err != nil {
		h.logger.Warn("failed to extract user ID from claims", "error", err)
		return response.Error(http.StatusUnauthorized, "unauthorized"), nil
	}

	// 2. Parse request body
	var body struct {
		RuleGroupId string `json:"ruleGroupId"`
	}
	if err := json.Unmarshal([]byte(event.Body), &body); err != nil {
		return response.Error(http.StatusBadRequest, "invalid request body"), nil
	}

	// 3. Validate ruleGroupId
	ruleGroupId := strings.TrimSpace(body.RuleGroupId)
	if ruleGroupId == "" {
		return response.Error(http.StatusBadRequest, "ruleGroupId is required"), nil
	}

	// 4. Get and validate characterId from path
	characterId := event.PathParameters["characterId"]
	if characterId == "" {
		return response.Error(http.StatusBadRequest, "characterId is required"), nil
	}

	// 5. Verify character ownership
	owns, err := h.db.QueryOwnership(ctx, userId, characterId)
	if err != nil {
		h.logger.Error("failed to query ownership", "error", err, "userId", userId, "characterId", characterId)
		return response.Error(http.StatusInternalServerError, "failed to verify ownership"), nil
	}
	if !owns {
		return response.Error(http.StatusForbidden, "forbidden"), nil
	}

	// 6. Add the rule group assignment
	createdAt, err := h.db.PutRuleGroup(ctx, characterId, ruleGroupId, userId)
	if err != nil {
		if errors.Is(err, ErrConditionalCheckFailed) {
			return response.Error(http.StatusConflict, "rule group already assigned to character"), nil
		}
		h.logger.Error("failed to put rule group", "error", err, "characterId", characterId, "ruleGroupId", ruleGroupId)
		return response.Error(http.StatusInternalServerError, "failed to add rule group"), nil
	}

	// 7. Build response using the actual timestamp from the DB write
	return response.Created(map[string]any{
		"userId":      userId,
		"characterId": characterId,
		"ruleGroupId": ruleGroupId,
		"createdAt":   createdAt,
	}), nil
}

// handleDelete handles DELETE requests to remove a rule group from a character
func (h *handler) handleDelete(ctx context.Context, event events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	// 1. Extract userId from JWT claims
	userId, err := auth.ExtractUserId(event)
	if err != nil {
		h.logger.Warn("failed to extract user ID from claims", "error", err)
		return response.Error(http.StatusUnauthorized, "unauthorized"), nil
	}

	// 2. Get and validate path parameters
	characterId := event.PathParameters["characterId"]
	if characterId == "" {
		return response.Error(http.StatusBadRequest, "characterId is required"), nil
	}
	ruleGroupId := event.PathParameters["ruleGroupId"]
	if ruleGroupId == "" {
		return response.Error(http.StatusBadRequest, "ruleGroupId is required"), nil
	}

	// 3. Verify character ownership
	owns, err := h.db.QueryOwnership(ctx, userId, characterId)
	if err != nil {
		h.logger.Error("failed to query ownership", "error", err, "userId", userId, "characterId", characterId)
		return response.Error(http.StatusInternalServerError, "failed to verify ownership"), nil
	}
	if !owns {
		return response.Error(http.StatusForbidden, "forbidden"), nil
	}

	// 4. Delete the rule group assignment
	if err := h.db.DeleteRuleGroup(ctx, characterId, ruleGroupId); err != nil {
		if errors.Is(err, ErrNotFound) {
			return response.Error(http.StatusNotFound, "rule group not assigned to character"), nil
		}
		h.logger.Error("failed to delete rule group", "error", err, "characterId", characterId, "ruleGroupId", ruleGroupId)
		return response.Error(http.StatusInternalServerError, "failed to remove rule group"), nil
	}

	return response.NoContent(), nil
}

// handle processes the API Gateway request (router)
func (h *handler) handle(ctx context.Context, event events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	switch event.HTTPMethod {
	case "POST":
		return h.handlePost(ctx, event)
	case "DELETE":
		return h.handleDelete(ctx, event)
	default:
		return response.Error(http.StatusMethodNotAllowed, "method not allowed"), nil
	}
}

// formatNow returns the current UTC time in RFC3339 format
func formatNow() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func main() {
	cfg, err := config.LoadDefaultConfig(context.Background())
	if err != nil {
		slog.Error("failed to load AWS config", "error", err)
		panic(err)
	}

	tableName := os.Getenv("TABLE_NAME")
	if tableName == "" {
		slog.Error("TABLE_NAME environment variable is required")
		panic("TABLE_NAME environment variable is required")
	}

	db := newDBClient(dynamodb.NewFromConfig(cfg), tableName, slog.Default())
	h := newHandler(db)

	lambda.Start(h.handle)
}
