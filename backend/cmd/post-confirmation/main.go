package main

import (
	"context"
	"log/slog"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
)

// variableRegex matches $(variableName) placeholders
var variableRegex = regexp.MustCompile(`\$\((\w+)\)`)

// dbClient is an interface for DynamoDB operations
type dbClient interface {
	getItem(ctx context.Context, pk, sk string) (map[string]any, error)
	putItem(ctx context.Context, item map[string]any) error
}

// handler handles Cognito post-confirmation events
type handler struct {
	db        dbClient
	tableName string
	logger    *slog.Logger
}

// newHandler creates a new post-confirmation handler
func newHandler(db dbClient, tableName string) *handler {
	return &handler{
		db:        db,
		tableName: tableName,
		logger:    slog.Default(),
	}
}

// newHandlerWithLogger creates a new post-confirmation handler with a custom logger
func newHandlerWithLogger(db dbClient, tableName string, logger *slog.Logger) *handler {
	return &handler{
		db:        db,
		tableName: tableName,
		logger:    logger,
	}
}

// substituteVariables replaces $(variable) placeholders in a string
func substituteVariables(s string, vars map[string]string) string {
	return variableRegex.ReplaceAllStringFunc(s, func(match string) string {
		// Extract variable name from $(name)
		name := variableRegex.FindStringSubmatch(match)[1]
		if val, ok := vars[name]; ok {
			return val
		}
		return match // leave unchanged if variable not found
	})
}

// transformSeed copies the seed record and applies variable substitution
func transformSeed(seed map[string]any, vars map[string]string) map[string]any {
	result := make(map[string]any, len(seed))

	for key, value := range seed {
		switch v := value.(type) {
		case string:
			// Special handling for PK: strip SEED# prefix before substitution
			if key == "PK" && strings.HasPrefix(v, "SEED#") {
				v = strings.TrimPrefix(v, "SEED#")
			}
			result[key] = substituteVariables(v, vars)
		default:
			// Copy non-string values as-is (numbers, booleans, etc.)
			result[key] = v
		}
	}

	return result
}

// handle processes the post-confirmation event
func (h *handler) handle(ctx context.Context, event events.CognitoEventUserPoolsPostConfirmation) (events.CognitoEventUserPoolsPostConfirmation, error) {
	userID := event.UserName

	h.logger.Info("processing post-confirmation event",
		"userId", userID,
		"userPoolId", event.UserPoolID,
	)

	// Fetch the seed record
	seed, err := h.db.getItem(ctx, "SEED#USER#$(userId)", "META#")
	if err != nil {
		h.logger.Error("failed to fetch seed record",
			"error", err,
			"userId", userID,
		)
		return event, err
	}

	// Build variable map for template substitution
	vars := map[string]string{
		"userId": userID,
		"now":    time.Now().UTC().Format(time.RFC3339),
		"email":  event.Request.UserAttributes["email"],
	}

	// Transform the seed record into a user record
	userRecord := transformSeed(seed, vars)

	// Write the user record
	if err := h.db.putItem(ctx, userRecord); err != nil {
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

	// Create DynamoDB client
	dbClient := newDynamoDBClient(dynamodb.NewFromConfig(cfg), tableName, slog.Default())

	// Create handler
	h := newHandlerWithLogger(dbClient, tableName, slog.Default())

	// Start Lambda
	lambda.Start(h.handle)
}
