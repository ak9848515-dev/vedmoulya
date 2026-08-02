#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# VedMoulya — Deploy Orchestration (local / self-hosted)
# PR-002 / T6 — Deployment Verification
#
# Builds and deploys the platform to a self-hosted target, then smoke-tests
# the gateway. For Vercel/Railway-managed deploys prefer the GitHub Actions
# release pipeline (.github/workflows/release.yml); this script targets a
# Docker/VPS self-hosted instance.
#
# Usage:
#   bash scripts/deploy/deploy.sh --host example.com [--profile observability]
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/../.."

HOST=""
PROFILE=""
REGISTRY=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --host) HOST="$2"; shift 2 ;;
    --profile) PROFILE="$2"; shift 2 ;;
    --registry) REGISTRY="$2"; shift 2 ;;
    *) shift ;;
  esac
done

[[ -n "$HOST" ]] || {
  echo "Usage: bash scripts/deploy/deploy.sh --host <host> [--profile observability] [--registry ghcr.io/org]" >&2
  exit 1
}

echo "==> VedMoulya deploy → $HOST"

# 1. Build core + web (production bundle).
npm run build:core
npm run build -w apps/web

# 2. Build the web image (optionally push to a registry, then run infra).
IMAGE="vedmoulya/web:latest"
if [[ -n "$REGISTRY" ]]; then
  IMAGE="$REGISTRY/vedmoulya-web:latest"
  docker build -f apps/web/Dockerfile -t "$IMAGE" .
  docker push "$IMAGE"
else
  docker build -f apps/web/Dockerfile -t "$IMAGE" .
fi

docker compose up -d --build postgres redis
if [[ -n "$PROFILE" ]]; then
  docker compose --profile "$PROFILE" up -d
fi

# 3. Smoke test the deployed gateway.
bash scripts/deploy/smoke-test.sh "https://$HOST"

echo "==> Deploy complete → https://$HOST"
