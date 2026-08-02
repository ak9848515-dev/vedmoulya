#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# VedMoulya — CI Quality Gates (local mirror of .github/workflows/ci.yml)
# PR-002 / T6 — Deployment Verification
#
# Runs the same gates CI runs, so engineers can validate locally before push:
#   G1-G2  Architecture & code quality (lint, format, typecheck)
#   G3     Tests + coverage gate
#   G6     Security audit (critical-blocking)
#   Build  All workspaces compile
#
# Usage:
#   bash scripts/ci/run.sh [--skip-audit] [--skip-build]
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/../.."

SKIP_AUDIT=""
SKIP_BUILD=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-audit) SKIP_AUDIT="1"; shift ;;
    --skip-build) SKIP_BUILD="1"; shift ;;
    *) shift ;;
  esac
done

echo "==> G1-G2: Architecture & code quality"
npm run lint
npm run format
npm run typecheck

echo "==> G3: Tests + coverage gate"
npm run test:coverage

if [[ -z "$SKIP_AUDIT" ]]; then
  echo "==> G6: Security audit (critical-blocking)"
  npm audit --audit-level=critical
fi

if [[ -z "$SKIP_BUILD" ]]; then
  echo "==> Build: all workspaces"
  npm run build
fi

echo "==> ✅ CI gates passed (local)"
