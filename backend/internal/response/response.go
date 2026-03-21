package response

import (
	"encoding/json"

	"github.com/aws/aws-lambda-go/events"
)

func OK(body any) events.APIGatewayProxyResponse {
	b, _ := json.Marshal(body)
	return events.APIGatewayProxyResponse{
		StatusCode: 200,
		Headers:    map[string]string{"Content-Type": "application/json"},
		Body:       string(b),
	}
}
