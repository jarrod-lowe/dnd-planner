package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/google/uuid"
	"github.com/jarrod/dnd-planner/backend/internal/seed"
)

// handler handles API Gateway requests for character creation
type handler struct {
	db     seed.DynamoDBClient
	logger *slog.Logger
}

// newHandler creates a new character creation handler
func newHandler(db seed.DynamoDBClient) *handler {
	return &handler{
		db:     db,
		logger: slog.Default(),
	}
}

// handle processes the API Gateway request
func (h *handler) handle(ctx context.Context, event events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	// 1. Extract userId from JWT claims
	userId, err := extractUserId(event)
	if err != nil {
		h.logger.Warn("failed to extract user ID from claims", "error", err)
		return errorResponse(http.StatusUnauthorized, "unauthorized"), nil
	}

	// 2. Parse request body
	var body struct {
		Name    string `json:"name"`
		Species string `json:"species"`
	}
	if err := json.Unmarshal([]byte(event.Body), &body); err != nil {
		return errorResponse(http.StatusBadRequest, "invalid request body"), nil
	}

	// 3. Validate required fields
	name := strings.TrimSpace(body.Name)
	if name == "" {
		return errorResponse(http.StatusBadRequest, "name is required"), nil
	}

	species := strings.TrimSpace(body.Species)
	if species == "" {
		return errorResponse(http.StatusBadRequest, "species is required"), nil
	}

	// 4. Generate characterId (UUID)
	characterId := uuid.New().String()

	// 5. Build variables map
	vars := map[string]string{
		"userId":      userId,
		"characterId": characterId,
		"name":        name,
		"species":     species,
		"now":         time.Now().UTC().Format(time.RFC3339),
	}

	// 6. Instantiate seeds (field-agnostic)
	records, err := seed.Instantiate(ctx, h.db, "SEED#CHAR", vars)
	if err != nil {
		h.logger.Error("failed to instantiate character seeds", "error", err, "userId", userId)
		return errorResponse(http.StatusInternalServerError, "failed to create character"), nil
	}

	// 7. Build response (field-agnostic)
	response := buildCharacterResponse(records)

	responseBody, err := json.Marshal(response)
	if err != nil {
		h.logger.Error("failed to marshal response", "error", err)
		return errorResponse(http.StatusInternalServerError, "failed to create character"), nil
	}

	// 8. Return 201 with Location header
	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusCreated,
		Headers: map[string]string{
			"Content-Type": "application/json",
			"Location":     fmt.Sprintf("/api/characters/%s", characterId),
		},
		Body: string(responseBody),
	}, nil
}

// extractUserId extracts the user ID from JWT claims in the API Gateway event
func extractUserId(event events.APIGatewayProxyRequest) (string, error) {
	if event.RequestContext.Authorizer == nil {
		return "", fmt.Errorf("no authorizer in request")
	}

	claims, ok := event.RequestContext.Authorizer["claims"].(map[string]any)
	if !ok {
		return "", fmt.Errorf("no claims in authorizer")
	}

	sub, ok := claims["sub"].(string)
	if !ok || sub == "" {
		return "", fmt.Errorf("no sub claim in token")
	}

	return sub, nil
}

// buildCharacterResponse builds the response from seed-instantiated records.
// Field-agnostic: copies all fields from CHAR record except internal ones (PK, SK, gsiSeedPK),
// and adds ruleGroupIds from RULEGROUP records.
func buildCharacterResponse(records []map[string]any) map[string]any {
	response := make(map[string]any)
	ruleGroupIds := make([]string, 0)

	for _, record := range records {
		sk, _ := record["SK"].(string)

		// Find the CHAR record (SK starts with "CHAR#")
		if strings.HasPrefix(sk, "CHAR#") {
			// Copy all fields except internal ones
			for key, value := range record {
				switch key {
				case "PK", "SK", "gsiSeedPK":
					// Skip internal fields
				default:
					response[key] = value
				}
			}
		}

		// Find RULEGROUP records and collect ruleGroupIds
		if strings.HasPrefix(sk, "RULEGROUP#") {
			if ruleGroupId, ok := record["ruleGroupId"].(string); ok && ruleGroupId != "" {
				// Avoid duplicates
				found := false
				for _, existing := range ruleGroupIds {
					if existing == ruleGroupId {
						found = true
						break
					}
				}
				if !found {
					ruleGroupIds = append(ruleGroupIds, ruleGroupId)
				}
			}
		}
	}

	response["ruleGroupIds"] = ruleGroupIds

	return response
}

// errorResponse creates an error response
func errorResponse(status int, message string) events.APIGatewayProxyResponse {
	body, _ := json.Marshal(map[string]string{"error": message})
	return events.APIGatewayProxyResponse{
		StatusCode: status,
		Headers:    map[string]string{"Content-Type": "application/json"},
		Body:       string(body),
	}
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
	h := newHandler(dbClient)

	// Start Lambda
	lambda.Start(h.handle)
}
