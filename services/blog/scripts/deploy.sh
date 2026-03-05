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

echo "▶ Installing dependencies..."
yarn install

echo "▶ Building Docker image (skip yarn install, build only)..."
docker build \
  -f services/blog/scripts/Dockerfile.deploy \
  --build-context dockerignore="$SCRIPT_DIR" \
  -t "$IMAGE" .

echo "▶ Pushing image..."
echo "$REGISTRY_PASSWORD" | docker login "$REGISTRY_URL" -u "$REGISTRY_USERNAME" --password-stdin 2>/dev/null
docker push "$IMAGE"

echo "▶ Triggering Dokploy redeploy..."
curl -sf -X POST "${DOKPLOY_API_URL}/application.redeploy" \
  -H "x-api-key: ${DOKPLOY_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"applicationId\":\"${DOKPLOY_APP_ID}\"}" > /dev/null

echo "✅ Deploy complete!"
