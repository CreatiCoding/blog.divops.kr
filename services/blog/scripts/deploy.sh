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

# 프로젝트 전용 로컬 캐시 생성 (글로벌 캐시에서 필요한 것만 추출)
CACHE_DIR="$REPO_ROOT/.yarn-docker-cache"
echo "▶ Preparing project-only yarn cache..."
rm -rf "$CACHE_DIR"
mkdir -p "$CACHE_DIR"
YARN_BERRY_CACHE="$(yarn config get globalFolder 2>/dev/null)/cache"
# .pnp.cjs에서 패키지 이름 추출 후 캐시에서 매칭되는 파일 복사
/usr/bin/grep -oE '[^/]+\.zip' .pnp.cjs | sed 's/-[^-]*\.zip$//' | sort -u | while read -r prefix; do
  for f in "$YARN_BERRY_CACHE/$prefix"-*.zip; do
    [ -f "$f" ] && cp "$f" "$CACHE_DIR/" && break
  done
done
echo "  Cache size: $(du -sh "$CACHE_DIR" | cut -f1)"

# 로컬 .next 캐시 경로
NEXT_CACHE_DIR="$REPO_ROOT/services/blog/.next"
if [ ! -d "$NEXT_CACHE_DIR" ]; then
  mkdir -p "$NEXT_CACHE_DIR/cache"
fi

echo "▶ Building Docker image..."
DOCKER_BUILDKIT=1 docker build \
  -f services/blog/scripts/Dockerfile.deploy \
  --build-context yarn-cache="$CACHE_DIR" \
  --build-context next-cache="$NEXT_CACHE_DIR" \
  -t "$IMAGE" .

echo "▶ Pushing image..."
echo "$REGISTRY_PASSWORD" | docker login "$REGISTRY_URL" -u "$REGISTRY_USERNAME" --password-stdin 2>/dev/null
docker push "$IMAGE"

echo "▶ Triggering Dokploy deploy..."
curl -sf -X POST "${DOKPLOY_API_URL}/application.deploy" \
  -H "x-api-key: ${DOKPLOY_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"applicationId\":\"${DOKPLOY_APP_ID}\"}" > /dev/null

# 임시 캐시 정리
rm -rf "$CACHE_DIR"

echo "✅ Deploy complete! https://blog.divops.kr"
