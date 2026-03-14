FROM node:22-alpine
RUN corepack enable

WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    chown nextjs:nodejs /app

USER nextjs

# 1. 의존성 (변경 안 되면 여기까지 캐시)
COPY --chown=nextjs:nodejs package.json yarn.lock .yarnrc.yml ./
COPY --chown=nextjs:nodejs .yarn ./.yarn
COPY --chown=nextjs:nodejs services/blog/package.json ./services/blog/
COPY --chown=nextjs:nodejs packages/fixtures/package.json ./packages/fixtures/
COPY --chown=nextjs:nodejs packages/testing/package.json ./packages/testing/
RUN yarn install --immutable
RUN yarn workspaces focus @blog/service --production

# 2. 소스 복사 + 빌드
COPY --chown=nextjs:nodejs . .
RUN mkdir -p /app/services/blog/.next
RUN --mount=type=cache,target=/app/services/blog/.next/cache,uid=1001,gid=1001 \
    yarn workspace @blog/service build

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["sh", "-c", "yarn node services/blog/scripts/entrypoint.mjs || echo 'entrypoint failed, starting anyway'; yarn workspace @blog/service start"]
