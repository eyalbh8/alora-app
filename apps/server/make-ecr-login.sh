#!/usr/bin/env bash
# ECR login for Alora server deploys (us-east-1 by default).
set -euo pipefail

AWS_PROFILE="${AWS_PROFILE:-default}"
AWS_REGION="${AWS_REGION:-us-east-1}"

if [[ -z "${ECR_REGISTRY:-}" ]]; then
  ACCOUNT_ID="$(aws sts get-caller-identity --profile "${AWS_PROFILE}" --region "${AWS_REGION}" --query Account --output text)"
  ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
fi

echo "Logging into ECR ${ECR_REGISTRY} (profile=${AWS_PROFILE}, region=${AWS_REGION})"
aws ecr get-login-password --profile "${AWS_PROFILE}" --region "${AWS_REGION}" \
  | docker login --username AWS --password-stdin "${ECR_REGISTRY}"
