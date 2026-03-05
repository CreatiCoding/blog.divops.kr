FROM node:22-alpine AS base
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn
COPY services/blog/package.json ./services/blog/
COPY packages/fixtures/package.json ./packages/fixtures/
COPY packages/testing/package.json ./packages/testing/
RUN yarn install --immutable
COPY . .
RUN yarn workspace @blog/service build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/services/blog/public ./services/blog/public
COPY --from=builder --chown=nextjs:nodejs /app/services/blog/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/services/blog/.next/static ./services/blog/.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "services/blog/server.js"]
