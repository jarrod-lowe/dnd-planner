package main

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/aws/aws-lambda-go/events"
)

type handler struct {
	cleanup func(ctx context.Context, characterId string) error
	logger  *slog.Logger
}

func (h *handler) handle(ctx context.Context, event events.DynamoDBEvent) (events.DynamoDBEventResponse, error) {
	var failures []events.DynamoDBBatchItemFailure

	for _, record := range event.Records {
		if record.EventName != "REMOVE" {
			continue
		}

		characterId, err := extractCharacterId(record)
		if err != nil {
			h.logger.Warn("skipping record", "error", err)
			continue
		}

		if err := h.cleanup(ctx, characterId); err != nil {
			h.logger.Error("cleanup failed", "characterId", characterId, "error", err)
			failures = append(failures, events.DynamoDBBatchItemFailure{
				ItemIdentifier: record.Change.SequenceNumber,
			})
		}
	}

	return events.DynamoDBEventResponse{BatchItemFailures: failures}, nil
}

func extractCharacterId(record events.DynamoDBEventRecord) (string, error) {
	if record.EventName != "REMOVE" {
		return "", fmt.Errorf("unexpected event type: %s", record.EventName)
	}

	sk, ok := record.Change.Keys["SK"]
	if !ok {
		return "", fmt.Errorf("missing SK key")
	}
	skValue := sk.String()
	if !strings.HasPrefix(skValue, "CHAR#") {
		return "", fmt.Errorf("SK does not have CHAR# prefix: %s", skValue)
	}
	return strings.TrimPrefix(skValue, "CHAR#"), nil
}
