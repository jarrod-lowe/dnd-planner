#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

PROFILE="${AWS_PROFILE:-dnd-planner-ro}"

echo "Fetching short-term credentials for profile: ${PROFILE}"

aws configure export-credentials \
  --profile "${PROFILE}" \
  --format env \
  | sed 's/^export //' \
  > "${ENV_FILE}"

# Remove the expiration line (not a recognized env var)
sed -i '' '/^AWS_CREDENTIAL_EXPIRATION=/d' "${ENV_FILE}" 2>/dev/null \
  || sed -i '/^AWS_CREDENTIAL_EXPIRATION=/d' "${ENV_FILE}"

if ! grep -q '^AWS_ACCESS_KEY_ID=' "${ENV_FILE}"; then
  echo "ERROR: Failed to fetch credentials. Is your SSO session active?" >&2
  echo "Run: aws sso login --profile ${PROFILE}" >&2
  exit 1
fi

echo "Credentials written to ${ENV_FILE}"
