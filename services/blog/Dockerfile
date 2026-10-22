# Dokploy 앱이 이 경로(services/blog/Dockerfile, 컨텍스트는 저장소 루트)와 포트 3000 을 쓴다.
# 한 컨테이너 안에서 nginx(:3000, 정적 파일) + Go API·페이지 서버(127.0.0.1:8080)를 같이 돌린다.
# 런타임 이미지에는 Node 가 없다(Node 는 프론트 빌드 단계에서만 쓴다).

FROM node:22.23.4-alpine AS web
RUN corepack enable
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml tsconfig.json ./
COPY .yarn .yarn
COPY services/blog/package.json services/blog/
RUN yarn install --immutable
COPY services/blog services/blog
# Tailwind 가 Go 템플릿(services/api/pages.go)의 클래스도 읽는다
COPY services/api services/api
RUN yarn workspace @blog/service build

FROM golang:1.27.3-alpine AS api
WORKDIR /src
COPY services/api/go.mod services/api/go.sum ./
RUN go mod download
COPY services/api ./
# CI 대신 여기서 검사한다. 실패하면 빌드가 멈추고 Dokploy 는 기존 컨테이너를 그대로 둔다.
RUN test -z "$(gofmt -l .)" && CGO_ENABLED=0 go vet ./... && CGO_ENABLED=0 go test ./...
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/api .

FROM nginx:1.30.6-alpine
COPY services/blog/nginx.conf /etc/nginx/nginx.conf
COPY services/blog/entrypoint.sh /entrypoint.sh
COPY --from=web /app/services/blog/dist /usr/share/nginx/html
COPY --from=api /out/api /usr/local/bin/api
EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
