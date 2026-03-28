package response

import (
	"encoding/json"
	"net/http"

	"github.com/aws/aws-lambda-go/events"
)

func OK(body any) events.APIGatewayProxyResponse {
	b, _ := json.Marshal(body)
	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusOK,
		Headers:    map[string]string{"Content-Type": "application/json"},
		Body:       string(b),
	}
}

func Created(body any) events.APIGatewayProxyResponse {
	b, _ := json.Marshal(body)
	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusCreated,
		Headers:    map[string]string{"Content-Type": "application/json"},
		Body:       string(b),
	}
}

func NoContent() events.APIGatewayProxyResponse {
	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusNoContent,
	}
}

func Error(status int, message string) events.APIGatewayProxyResponse {
	body, _ := json.Marshal(map[string]string{"error": message})
	return events.APIGatewayProxyResponse{
		StatusCode: status,
		Headers:    map[string]string{"Content-Type": "application/json"},
		Body:       string(body),
	}
}
