package seed

import (
	"context"
	"regexp"
	"strings"
)

// variableRegex matches $(variableName) placeholders
var variableRegex = regexp.MustCompile(`\$\((\w+)\)`)

// DynamoDBClient is the interface for DynamoDB operations needed by the seed library.
type DynamoDBClient interface {
	QueryByGsiSeedPK(ctx context.Context, gsiSeedPK string) ([]map[string]any, error)
	BatchWriteItems(ctx context.Context, items []map[string]any) error
}

// Instantiate queries seed records by gsiSeedPK, transforms them, and writes to DynamoDB.
// Returns the created records (useful for generating response).
// Field-agnostic: processes ALL fields generically, no assumptions about field names.
func Instantiate(ctx context.Context, db DynamoDBClient, gsiSeedPK string, vars map[string]string) ([]map[string]any, error) {
	// Query seed records by gsiSeedPK
	seeds, err := db.QueryByGsiSeedPK(ctx, gsiSeedPK)
	if err != nil {
		return nil, err
	}

	// Transform each seed record
	records := make([]map[string]any, 0, len(seeds))
	for _, seed := range seeds {
		record := transformSeed(seed, vars)
		records = append(records, record)
	}

	// Write all transformed records to DynamoDB
	if err := db.BatchWriteItems(ctx, records); err != nil {
		return nil, err
	}

	return records, nil
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

// transformSeed copies the seed record and applies transformations.
// Field-agnostic: processes ALL fields generically.
func transformSeed(seed map[string]any, vars map[string]string) map[string]any {
	result := make(map[string]any, len(seed))

	for key, value := range seed {
		// Skip gsiSeedPK entirely (remove from output)
		if key == "gsiSeedPK" {
			continue
		}

		switch v := value.(type) {
		case string:
			// Special handling for PK: strip SEED# prefix before substitution
			if key == "PK" && strings.HasPrefix(v, "SEED#") {
				v = strings.TrimPrefix(v, "SEED#")
			}
			result[key] = substituteVariables(v, vars)
		default:
			// Copy non-string values as-is (numbers, booleans, maps, etc.)
			result[key] = v
		}
	}

	return result
}
