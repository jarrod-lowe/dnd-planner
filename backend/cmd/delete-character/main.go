package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/jarrod/dnd-planner/backend/internal/auth"
	"github.com/jarrod/dnd-planner/backend/internal/response"
)

var (
	ErrNotFound = errors.New("not found")
)

type DynamoDBClient interface {
	DeleteCharacter(ctx context.Context, userId, characterId string) error
}

type handler struct {
	db     DynamoDBClient
	logger *slog.Logger
}

func newHandler(db DynamoDBClient) *handler {
	return &handler{
		db:     db,
		logger: slog.Default(),
	}
}

func (h *handler) handle(ctx context.Context, event events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	switch event.HTTPMethod {
	case "DELETE":
		return h.handleDelete(ctx, event)
	default:
		return response.Error(http.StatusMethodNotAllowed, "method not allowed"), nil
	}
}

func (h *handler) handleDelete(ctx context.Context, event events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	// 1. Extract userId from JWT claims
	userId, err := auth.ExtractUserId(event)
	if err != nil {
		h.logger.Warn("failed to extract user ID from claims", "error", err)
		return response.Error(http.StatusUnauthorized, "unauthorized"), nil
	}

	// 2. Get and validate characterId from path
	characterId := event.PathParameters["characterId"]
	if characterId == "" {
		return response.Error(http.StatusBadRequest, "characterId is required"), nil
	}

	// 3. Delete the character and all related data
	if err := h.db.DeleteCharacter(ctx, userId, characterId); err != nil {
		if errors.Is(err, ErrNotFound) {
			return response.Error(http.StatusNotFound, "character not found"), nil
		}
		h.logger.Error("failed to delete character", "error", err, "userId", userId, "characterId", characterId)
		return response.Error(http.StatusInternalServerError, "failed to delete character"), nil
	}

	return response.NoContent(), nil
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
