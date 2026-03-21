package main

import (
	"context"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/jarrod/dnd-planner/backend/internal/response"
)

func handle(_ context.Context, _ events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	return response.OK(map[string]string{"status": "ok"}), nil
}

func main() {
	lambda.Start(handle)
}
