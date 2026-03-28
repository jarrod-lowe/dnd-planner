package auth

import (
	"fmt"

	"github.com/aws/aws-lambda-go/events"
)

// ExtractUserId extracts the user ID from JWT claims in the API Gateway event
func ExtractUserId(event events.APIGatewayProxyRequest) (string, error) {
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
