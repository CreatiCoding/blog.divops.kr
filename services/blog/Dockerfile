FROM node:22-alpine AS base
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn
COPY services/blog/package.json ./services/blog/
COPY packages/fixtures/package.json ./packages/fixtures/
COPY packages/testing/package.json ./packages/testing/
RUN yarn install --immutable

FROM base AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/.pnp.cjs /app/.pnp.loader.mjs ./
COPY --from=deps /app/.yarn ./.yarn
RUN --mount=type=cache,target=/app/services/blog/.next/cache \
    yarn workspace @blog/service build
# production 의존성만 남기기 (dev 캐시 제거)
RUN yarn workspaces focus @blog/service --production

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/package.json /app/yarn.lock /app/.yarnrc.yml ./
COPY --from=builder --chown=nextjs:nodejs /app/.yarn ./.yarn
COPY --from=builder --chown=nextjs:nodejs /app/.pnp.cjs /app/.pnp.loader.mjs ./
COPY --from=builder --chown=nextjs:nodejs /app/services/blog/package.json ./services/blog/
COPY --from=builder --chown=nextjs:nodejs /app/packages/fixtures/package.json ./packages/fixtures/
COPY --from=builder --chown=nextjs:nodejs /app/packages/testing/package.json ./packages/testing/
COPY --from=builder --chown=nextjs:nodejs /app/services/blog/.next ./services/blog/.next
COPY --from=builder --chown=nextjs:nodejs /app/services/blog/next.config.ts ./services/blog/

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["yarn", "workspace", "@blog/service", "start"]
