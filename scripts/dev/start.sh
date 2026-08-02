#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# VedMoulya — Local Dev Server
# PR-002 / T6 — Deployment Verification
#
# Starts Postgres + Redis (Docker) then the Next.js dev server.
#
# Usage:
#   bash scripts/dev/start.sh [--profile observability]
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/../.."

PROFILE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile) PROFILE="$2"; shift 2 ;;
    *) shift ;;
  esac
done

echo "==> Starting infrastructure (Postgres + Redis)"
if [[ -n "$PROFILE" ]]; then
  docker compose --profile "$PROFILE" up -d postgres redis
else
  docker compose up -d postgres redis
fi

echo "==> Starting Next.js dev server on :3000"
npm run dev -w apps/web
