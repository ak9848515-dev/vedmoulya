#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# VedMoulya — Graceful Shutdown Script
# PR-002 / T6 — Deployment Verification
#
# Sends SIGTERM (graceful) to the app/server processes so the ordered
# shutdown sequence runs (stop accepting → drain → flush metrics → close
# DB/Redis/AI/workers). Falls back to SIGKILL after a timeout.
#
# Usage:
#   bash scripts/shutdown.sh [--timeout 15]
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

TIMEOUT=15
while [[ $# -gt 0 ]]; do
  case "$1" in
    --timeout) TIMEOUT="$2"; shift 2 ;;
    *) shift ;;
  esac
done

echo "==> VedMoulya graceful shutdown"

# Graceful shutdown signal (handled by packages/core lifecycle).
pkill -TERM -f "next dev" 2>/dev/null || true
pkill -TERM -f "next-server" 2>/dev/null || true
pkill -TERM -f "tsx watch" 2>/dev/null || true
pkill -TERM -f "node dist/index" 2>/dev/null || true

echo "==> Waiting up to ${TIMEOUT}s for graceful drain..."
sleep "$TIMEOUT"

# Hard kill anything still alive (last resort).
pkill -KILL -f "next dev" 2>/dev/null || true
pkill -KILL -f "next-server" 2>/dev/null || true

echo "==> Shutdown complete"
