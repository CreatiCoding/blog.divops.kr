FROM node:22-alpine
RUN corepack enable

WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 1. 의존성 (변경 안 되면 여기까지 캐시)
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn
COPY services/blog/package.json ./services/blog/
COPY packages/fixtures/package.json ./packages/fixtures/
COPY packages/testing/package.json ./packages/testing/
RUN yarn install --immutable
RUN yarn workspaces focus @blog/service --production

# 2. 소스 복사 + 빌드
COPY . .
RUN --mount=type=cache,target=/app/services/blog/.next/cache \
    yarn workspace @blog/service build

RUN chmod -R a+r /root/.yarn
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["yarn", "workspace", "@blog/service", "start"]
