# ─────────────────────────────────────────────────────────────────────────────
# VedMoulya — API Gateway Dockerfile
# PH-002 — Enterprise Operations & Reliability (T8 Deployment Verification)
# ─────────────────────────────────────────────────────────────────────────────

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# Install dependencies (workspace-aware)
COPY package.json package-lock.json ./
COPY apps apps
COPY packages packages
COPY services services
COPY tsconfig.base.json tsconfig.json vitest.workspace.ts ./

RUN npm ci --ignore-scripts

# Build the core foundation first, then the api service
RUN npm run build:core
RUN npm run build -w packages/domain -w packages/ai -w packages/services
RUN npm run build -w services/api

# ── Runtime stage ────────────────────────────────────────────────────────────
# Note: @vedmoulya/api is a tRPC router LIBRARY (no standalone HTTP server).
# The web app (apps/web) hosts the gateway via its Next.js route handlers;
# this image exists so the gateway can be bundled/deployed alongside services.
# Wire a real server entrypoint here once one is added to services/api.
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/packages /app/packages
COPY --from=build /app/services /app/services
COPY --from=build /app/node_modules /app/node_modules

EXPOSE 3000
USER node
CMD ["node", "-e", "console.log('@vedmoulya/api is a library — serve the gateway via apps/web'); process.exit(0)"]
