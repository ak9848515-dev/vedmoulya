#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# VedMoulya — Deployment Smoke Test
# PR-002 / T6 — Deployment Verification
#
# Verifies a deployed gateway is live and ready before a release is
# considered complete. Polls the health endpoints until ready or timeout.
#
# PROD-02A — the deploy gate now uses the DOCUMENTED readiness contract
# (the apps/web HTTP endpoints), not the application-layer tRPC procedure:
#   GET /health/live   → process liveness (any 2xx/3xx response)
#   GET /health/ready  → gateway initialized AND the database answers a real
#                        SELECT 1; returns 503 until both are satisfied
# tRPC `health.ready` only reports the LifeOS service layer (isHealthy()) — it
# does NOT prove the database is reachable. It is therefore kept ONLY as a
# liveness fallback for builds that predate the HTTP routes, and never as the
# readiness gate: a deployment with an unreachable database must NOT pass.
#
# Usage:
#   bash scripts/deploy/smoke-test.sh https://yourdomain.com
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BASE_URL="${1:-}"
[[ -n "$BASE_URL" ]] || {
  echo "Usage: bash scripts/deploy/smoke-test.sh <base-url>" >&2
  exit 1
}
BASE_URL="${BASE_URL%/}"

TIMEOUT_SECS=120
POLL_SECS=10

BODY_FILE="$(mktemp 2>/dev/null || echo "/tmp/vedmoulya-smoke-body.$$")"
# shellcheck disable=SC2329 # invoked via trap
cleanup() { rm -f "$BODY_FILE"; }
trap cleanup EXIT

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

  # Liveness: the HTTP endpoint must respond (2xx/3xx). The tRPC procedure is
  # the fallback for builds that predate the HTTP contract.
  if curl -fsS -o /dev/null --max-time 10 "$BASE_URL/health/live" 2>/dev/null ||
    curl -fsS -o /dev/null --max-time 10 "$BASE_URL/api/trpc/health.live" 2>/dev/null; then
    echo "  live: OK"

    # Readiness: HTTP 200 AND an explicit "ready" status. A 503 ("not_ready")
    # means the deployment is still booting — or its database is unreachable.
    readiness_code=""
    readiness_code="$(
      curl -sS -o "$BODY_FILE" -w '%{http_code}' --max-time 10 \
        "$BASE_URL/health/ready" 2>/dev/null || true
    )"
    if [[ "$readiness_code" == "200" ]] &&
      grep -qE '"status":[[:space:]]*"ready"' "$BODY_FILE" 2>/dev/null; then
      echo "  ready: OK (HTTP 200 — gateway initialized, database reachable)"
      echo "==> Smoke test PASSED"
      exit 0
    fi
    if [[ -n "$readiness_code" && "$readiness_code" != "000" ]]; then
      echo "  ...gateway responding but not ready yet (HTTP ${readiness_code}, ${elapsed}s)"
    else
      echo "  ...readiness endpoint not reachable yet (${elapsed}s)"
    fi
  else
    echo "  ...not responding yet (${elapsed}s)"
  fi
  sleep "$POLL_SECS"
done
