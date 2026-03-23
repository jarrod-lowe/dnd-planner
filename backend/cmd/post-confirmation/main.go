package main

import (
	"context"
	"log/slog"
	"os"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/jarrod/dnd-planner/backend/internal/seed"
)

// handler handles Cognito post-confirmation events
type handler struct {
	db     seed.DynamoDBClient
	logger *slog.Logger
}

// newHandler creates a new post-confirmation handler
func newHandler(db seed.DynamoDBClient, logger *slog.Logger) *handler {
	return &handler{
		db:     db,
		logger: logger,
	}
}

// handle processes the post-confirmation event
func (h *handler) handle(ctx context.Context, event events.CognitoEventUserPoolsPostConfirmation) (events.CognitoEventUserPoolsPostConfirmation, error) {
	userID := event.UserName

	h.logger.Info("processing post-confirmation event",
		"userId", userID,
		"userPoolId", event.UserPoolID,
	)

	// Build variable map for template substitution
	vars := map[string]string{
		"userId": userID,
		"now":    time.Now().UTC().Format(time.RFC3339),
		"email":  event.Request.UserAttributes["email"],
	}

	// Instantiate user records from seeds using the generic seed library
	// This queries the gsiSeed index for gsiSeedPK = "SEED#USER"
	_, err := seed.Instantiate(ctx, h.db, "SEED#USER", vars)
	if err != nil {
		h.logger.Error("failed to create user record",
			"error", err,
			"userId", userID,
		)
		return event, err
	}

	h.logger.Info("created user record",
		"userId", userID,
	)

	return event, nil
}

func main() {
	// Load AWS configuration
	cfg, err := config.LoadDefaultConfig(context.Background())
	if err != nil {
		slog.Error("failed to load AWS config", "error", err)
		panic(err)
	}

	// Get table name from environment variable
	tableName := os.Getenv("TABLE_NAME")
	if tableName == "" {
		slog.Error("TABLE_NAME environment variable is required")
		panic("TABLE_NAME environment variable is required")
	}

	// Create DynamoDB client for seed library
	dbClient := seed.NewClient(dynamodb.NewFromConfig(cfg), tableName, slog.Default())

	// Create handler
	h := newHandler(dbClient, slog.Default())

	// Start Lambda
	lambda.Start(h.handle)
}
