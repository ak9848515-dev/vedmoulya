#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# VedMoulya — Deterministic Verification Runner (EPIC-019/9 + /10)
#
#   npm run verify          # doctor + tests + typecheck + lint (bounded)
#   npm run verify -- --skip-lint
#
# Two EPIC-019 guarantees:
#   • ANSI-free output (9) — every command runs with NO_COLOR=1 /
#     FORCE_COLOR=0 / CI=1 so captured logs (PowerShell, CI, agents) contain
#     no raw escape sequences. Application UI is never touched.
#   • Bounded timeouts (10) — every command runs under `timeout`; nothing may
#     wait indefinitely for next dev/start, docker, a database, redis,
#     Playwright or a background server.
#
# SECURITY: never prints environment values (key names only).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."

SKIP_LINT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-lint) SKIP_LINT="1"; shift ;;
    *) shift ;;
  esac
done

# Deterministic output: no raw ANSI escapes from any child tool.
export NO_COLOR=1
export FORCE_COLOR=0
export CI=1
export TERM=dumb

TIMEOUT_BIN=""
if command -v timeout >/dev/null 2>&1; then
  TIMEOUT_BIN="timeout"
fi

run_bounded() {
  local label="$1"
  local seconds="$2"
  shift 2
  echo "==> [$label] (bounded ${seconds}s)"
  if [[ -n "$TIMEOUT_BIN" ]]; then
    timeout "$seconds" "$@"
  else
    "$@"
  fi
}

# ── 1. Startup diagnostics (doctor — dev mode; must be deterministic) ───────
run_bounded "Startup doctor (development)" 240 npx tsx scripts/doctor.ts

# ── 2. Affected package tests (EPIC-019: core startup + config) ─────────────
run_bounded "Core package tests (startup + config)" 900 npx vitest run packages/core

# ── 3. Gateway tests (ProductionAIConfig, wiring) ───────────────────────────
run_bounded "Gateway tests (services/api)" 1200 npx vitest run services/api

# ── 4. Orchestrator tests (provider registration incl. DeepSeek) ────────────
run_bounded "Orchestrator tests (services/orchestrator)" 600 npx vitest run services/orchestrator

# ── 5. Web tests ────────────────────────────────────────────────────────────
run_bounded "Web tests (apps/web)" 900 npx vitest run apps/web

# ── 6. Typecheck ────────────────────────────────────────────────────────────
run_bounded "Typecheck" 900 npm run typecheck

# ── 7. Lint ─────────────────────────────────────────────────────────────────
if [[ -z "$SKIP_LINT" ]]; then
  # Whole-repo type-checked ESLint exceeds the default 2 GB Node heap on this
  # monorepo — raise it so the gate is memory-bounded, not OOM-flaky.
  export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=4096"
  run_bounded "Lint" 1200 npm run lint
fi

echo ""
echo "==> ✅ Verification complete (EPIC-019 final validation)."
