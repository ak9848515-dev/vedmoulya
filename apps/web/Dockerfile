# ─────────────────────────────────────────────────────────────────────────────
# VedMoulya — Web Application Dockerfile
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
COPY tsconfig.base.json tsconfig.json ./

RUN npm ci --ignore-scripts

# Build core foundation then the web app
RUN npm run build:core
# Build all workspaces in dependency order (explicit -w lists omitted deps
# such as packages/information, breaking tsc with TS6305 in CI).
RUN npm run build --workspaces --if-present

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/packages /app/packages
COPY --from=build /app/services /app/services
COPY --from=build /app/apps /app/apps
COPY --from=build /app/node_modules /app/node_modules

EXPOSE 3000
USER node
CMD ["npm", "run", "start", "-w", "apps/web"]
