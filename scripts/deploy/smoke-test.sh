#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# VedMoulya — Deployment Smoke Test
# PR-002 / T6 — Deployment Verification
#
# Verifies a deployed gateway is live and ready before a release is
# considered complete. Polls the health endpoints until ready or timeout.
#
# Usage:
#   bash scripts/deploy/smoke-test.sh https://yourdomain.com
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BASE_URL="${1:-}"
[[ -n "$BASE_URL" ]] || { echo "Usage: bash scripts/deploy/smoke-test.sh <base-url>" >&2; exit 1; }
BASE_URL="${BASE_URL%/}"

TIMEOUT_SECS=120
POLL_SECS=10

echo "==> Smoke test: $BASE_URL"
echo "==> Waiting up to ${TIMEOUT_SECS}s for the gateway to become ready..."

started=$(date +%s)
while :; do
  now=$(date +%s)
  elapsed=$((now - started))
  if (( elapsed >= TIMEOUT_SECS )); then
    echo "ERROR: gateway did not become ready within ${TIMEOUT_SECS}s" >&2
    exit 1
  fi

  # Liveness: the endpoint must respond (2xx/3xx).
  if curl -fsS -o /dev/null --max-time 10 "$BASE_URL/api/trpc/health.live" 2>/dev/null; then
    echo "  live: OK"
    # Readiness: must report "ready" — a "not_ready" response means the
    # deployment is still booting, so keep polling.
    ready=$(curl -fsS --max-time 10 "$BASE_URL/api/trpc/health.ready" 2>/dev/null || true)
    if [[ "$ready" == *'"ready"'* ]]; then
      echo "  ready: OK"
      echo "==> Smoke test PASSED"
      exit 0
    fi
    echo "  ...gateway responding but not ready yet (${elapsed}s)"
  else
    echo "  ...not responding yet (${elapsed}s)"
  fi
  sleep "$POLL_SECS"
done
