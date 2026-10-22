#!/bin/sh
# Go API 와 nginx 를 같이 띄운다. 둘 중 하나라도 죽으면 컨테이너를 끝내 Dokploy 가 다시 띄우게 한다.
set -e

api &
API_PID=$!
nginx -g 'daemon off;' &
NGINX_PID=$!

stop() {
  kill -TERM "$NGINX_PID" "$API_PID" 2>/dev/null || true
  wait
  exit 0
}
trap stop TERM INT

while kill -0 "$API_PID" 2>/dev/null && kill -0 "$NGINX_PID" 2>/dev/null; do
  sleep 2
done
echo "api 또는 nginx 가 종료됨" >&2
kill -TERM "$NGINX_PID" "$API_PID" 2>/dev/null || true
exit 1
