# Generic Seed Templating for Post-Confirmation Lambda

## Problem

The post-confirmation Lambda currently hardcodes the user record structure, manually copying individual fields from the seed. This is brittle and requires code changes whenever the user record schema evolves.

## Solution

Make the Lambda a dumb template processor that:
1. Fetches the seed record
2. Copies all fields
3. Applies variable substitution to string values
4. Strips `SEED#` prefix from PK

## Template Syntax

- Placeholders: `$(variableName)`
- Supported variables:
  - `$(userId)` - Cognito user ID from the event
  - `$(now)` - Current UTC timestamp in RFC3339 format

## Algorithm

```
1. Fetch seed record at PK="SEED#USER", SK="META#"
2. Build variable map:
   - userId = event.UserName
   - now = time.Now().UTC().Format(time.RFC3339)
3. For each field in seed record:
   - If string value: apply regex substitution for $(\w+)
   - If number/other: copy as-is
4. For PK field specifically:
   - Remove "SEED#" prefix first
   - Then apply variable substitution
5. Put the resulting record
```

## Example

**Seed record:**
```
PK = "SEED#USER#$(userId)"
SK = "META#"
type = "USER"
userId = "$(userId)"
charQuotaRemaining = 10
updatedAt = "$(now)"
createdAt = "$(now)"
```

**Result for user "abc123":**
```
PK = "USER#abc123"
SK = "META#"
type = "USER"
userId = "abc123"
charQuotaRemaining = 10
updatedAt = "2026-03-22T10:30:00Z"
createdAt = "2026-03-22T10:30:00Z"
```

## Implementation

1. Add a `substituteVariables` function that takes a string and variable map, returns substituted string
2. Add a `transformSeed` function that deep-copies the seed record, applying substitution
3. Update `handle` to use `transformSeed` instead of manual field construction
4. Update tests to reflect the new approach

## Benefits

- Lambda is agnostic to record shape
- Schema changes only require Terraform updates to the seed
- Easy to add new variables later
- No code deployment needed for simple field additions
