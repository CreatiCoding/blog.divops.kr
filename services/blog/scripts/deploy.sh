#!/usr/bin/env bash
set -euo pipefail

# .env 로드
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
fi

IMAGE="${REGISTRY_URL}/${REGISTRY_IMAGE_NAME}:latest"
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

echo "▶ Building Docker image..."
docker build -f services/blog/Dockerfile -t "$IMAGE" .

echo "▶ Logging in to registry..."
echo "$REGISTRY_PASSWORD" | docker login "$REGISTRY_URL" -u "$REGISTRY_USERNAME" --password-stdin

echo "▶ Pushing image..."
docker push "$IMAGE"

echo "▶ Triggering Dokploy redeploy..."
curl -sf -X POST "${DOKPLOY_API_URL}/application.redeploy" \
  -H "x-api-key: ${DOKPLOY_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"applicationId\":\"${DOKPLOY_APP_ID}\"}" > /dev/null

echo "✅ Deploy complete!"
