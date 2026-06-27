# ── Stage 1: deps ──────────────────────────────────────────────
FROM node:20-alpine AS deps

RUN corepack enable && corepack prepare pnpm@11 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY apps/web/package.json ./apps/web/
RUN apk add --no-cache python3 make g++ \
    && pnpm install --frozen-lockfile --ignore-scripts

# ── Stage 2: build ─────────────────────────────────────────────
FROM node:20-alpine AS build

RUN corepack enable && corepack prepare pnpm@11 --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY . .

RUN cd apps/web && pnpm build && ls -la /app/apps/web/.output/server/workers/ 2>/dev/null || echo "NO worker output"

# ── Stage 3: production ───────────────────────────────────────
FROM node:20-alpine AS production

RUN corepack enable && corepack prepare pnpm@11 --activate \
    && addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY apps/web/package.json ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts \
    && pnpm store prune

COPY --from=build /app/apps/web/.output ./.output

RUN chown -R appuser:appgroup /app
USER appuser

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=1024"

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", ".output/server/index.mjs"]
