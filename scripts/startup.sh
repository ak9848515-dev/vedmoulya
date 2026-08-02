#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# VedMoulya — Production Startup Script
# PR-002 / T6 — Deployment Verification
#
# Starts the platform services in production order:
#   1. cd to repo root (so @vedmoulya/* resolves)
#   2. Validate the environment (fail-fast on missing/invalid secrets)
#   3. Start infrastructure (Postgres + Redis; + optional observability)
#   4. Start the API gateway / web app
#
# Modes:
#   bash scripts/startup.sh              # production server (next start)
#   bash scripts/startup.sh --dev        # Next.js dev server (local dev)
#   bash scripts/startup.sh --profile observability
#
# NOTE: production deployments target Vercel/Railway (see docs/ops/
# DEPLOYMENT_GUIDE.md); this script orchestrates a self-hosted instance.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."

PROFILE=""
DEV_MODE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile) PROFILE="$2"; shift 2 ;;
    --dev) DEV_MODE="1"; shift ;;
    *) shift ;;
  esac
done

echo "==> VedMoulya startup (v1.0.0) from $(pwd)"

# 1. Validate environment — @vedmoulya/core defers configuration evaluation
#    until the first access (so bundlers/build pipelines can import the
#    package without env vars), so we force evaluation here via getConfig().
#    This runs the fail-fast config and rejects missing/placeholder/localhost
#    secrets before anything starts.
if ENV_OUTPUT="$(node -e "require('@vedmoulya/core').getConfig()" 2>&1)"; then
  echo "Environment OK"
elif [[ -z "$DEV_MODE" ]]; then
  # Production/staging: a fail-fast validation failure must abort startup.
  echo "ERROR: environment validation failed:" >&2
  echo "$ENV_OUTPUT" >&2
  exit 1
else
  echo "WARNING: environment validation skipped (dev mode / package not built?)" >&2
fi

# 2. Start infrastructure (Postgres + Redis; + observability profile).
if [[ -n "$PROFILE" ]]; then
  docker compose --profile "$PROFILE" up -d postgres redis
else
  docker compose up -d postgres redis
fi

# 3. Build core packages (idempotent) and start the gateway / web app.
npm run build:core

if [[ -n "$DEV_MODE" ]]; then
  echo "==> Starting web app (dev server) on :3000"
  npm run dev -w apps/web &
else
  echo "==> Building + starting web app (production server) on :3000"
  npm run build -w apps/web
  (cd apps/web && npm run start) &
fi

WEB_PID=$!
echo "==> Startup complete. PID $WEB_PID"
echo "    Health: http://localhost:3000/api/trpc/health.check"
wait $WEB_PID
