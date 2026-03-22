#!/bin/bash
set -euo pipefail

# API Testing Helper Script
# Usage: ./scripts/api-get.sh /path/to/endpoint
#
# Credentials can be provided via:
#   1. Environment variables (TEST_USER_EMAIL, TEST_USER_PASSWORD)
#   2. .env file in project root
#
# Optional:
#   AWS_PROFILE - AWS profile to use (default: dnd-planner-ro)

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load .env file if it exists (env vars take precedence)
if [[ -f "$PROJECT_ROOT/.env" ]]; then
    # Disable history expansion to handle passwords with ! character
    set +H
    # shellcheck disable=SC1090
    source "$PROJECT_ROOT/.env"
fi

# Check required environment variables
if [[ -z "${TEST_USER_EMAIL:-}" || -z "${TEST_USER_PASSWORD:-}" ]]; then
    echo "Error: Required environment variables not set" >&2
    echo "" >&2
    echo "Set the following before running:" >&2
    echo "  export TEST_USER_EMAIL=\"test@example.com\"" >&2
    echo "  export TEST_USER_PASSWORD=\"your-password\"" >&2
    exit 1
fi

# Check for path argument
if [[ -z "${1:-}" ]]; then
    echo "Usage: $0 /path/to/endpoint" >&2
    echo "Example: $0 /user" >&2
    echo "         $0 /characters/abc123/rule-groups" >&2
    exit 1
fi

ENDPOINT_PATH="${1}"
PROFILE="${AWS_PROFILE:-dnd-planner-ro}"
REGION="${AWS_REGION:-ap-southeast-2}"
TERRAFORM_DIR="terraform/environment/test"

# Get terraform outputs
echo "Fetching configuration from terraform..." >&2

DOMAIN=$(AWS_PROFILE=$PROFILE AWS_REGION=$REGION terraform -chdir=$TERRAFORM_DIR output -raw cdn_nice_domain 2>/dev/null)
if [[ -z "$DOMAIN" ]]; then
    echo "Error: Failed to get cdn_nice_domain from terraform output" >&2
    exit 1
fi

CLIENT_ID=$(AWS_PROFILE=$PROFILE AWS_REGION=$REGION terraform -chdir=$TERRAFORM_DIR output -raw cognito_web_client_id 2>/dev/null)
if [[ -z "$CLIENT_ID" ]]; then
    echo "Error: Failed to get cognito_web_client_id from terraform output" >&2
    exit 1
fi

echo "Domain: $DOMAIN" >&2
echo "Client ID: $CLIENT_ID" >&2

# Get auth token from Cognito
echo "Authenticating..." >&2

AUTH_RESULT=$(AWS_PROFILE=$PROFILE aws cognito-idp initiate-auth \
    --auth-flow USER_PASSWORD_AUTH \
    --client-id "$CLIENT_ID" \
    --auth-parameters USERNAME="${TEST_USER_EMAIL}",PASSWORD="${TEST_USER_PASSWORD}" \
    --output json 2>&1) || {
    echo "Error: Authentication request failed" >&2
    echo "$AUTH_RESULT" >&2
    exit 1
}

# Check for auth error in response
if echo "$AUTH_RESULT" | jq -e '.AuthenticationResult' > /dev/null 2>&1; then
    # AuthenticationResult exists - this is success
    :
else
    # No AuthenticationResult - check for error
    AUTH_ERROR=$(echo "$AUTH_RESULT" | jq -r '.message // .error // "Unknown error"')
    echo "Error: Authentication failed: $AUTH_ERROR" >&2
    exit 1
fi

# Extract ID token
ID_TOKEN=$(echo "$AUTH_RESULT" | jq -r '.AuthenticationResult.IdToken // empty')
if [[ -z "$ID_TOKEN" ]]; then
    echo "Error: Failed to extract ID token from response" >&2
    echo "Response: $AUTH_RESULT" >&2
    exit 1
fi

echo "Authenticated successfully" >&2

# Make API request
URL="https://${DOMAIN}/api${ENDPOINT_PATH}"
echo "Requesting: GET $URL" >&2
echo "---" >&2

curl -s -w "\nHTTP Status: %{http_code}\n" \
    -H "Authorization: Bearer ${ID_TOKEN}" \
    "$URL"
