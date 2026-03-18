#!/bin/bash
set -euo pipefail

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
BUCKET_NAME="dnd-planner-iac-state-${ACCOUNT_ID}"

# Check/create bucket
if ! aws s3 ls "s3://${BUCKET_NAME}" 2>/dev/null; then
  aws s3api create-bucket --bucket "$BUCKET_NAME"
  aws s3api put-bucket-versioning --bucket "$BUCKET_NAME" --versioning-configuration Status=Enabled
  aws s3api put-bucket-encryption --bucket "$BUCKET_NAME" --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
  aws s3api put-public-access-block --bucket "$BUCKET_NAME" --public-access-block-configuration '{
    "BlockPublicAcls":true,"IgnorePublicAcls":true,"BlockPublicPolicy":true,"RestrictPublicBuckets":true}'
fi

echo "TERRAFORM_STATE_BUCKET=$BUCKET_NAME"
