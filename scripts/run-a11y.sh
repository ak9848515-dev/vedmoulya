#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# VedMoulya — Accessibility Test Runner
# Runs Playwright accessibility audit tests
# BLD-016-B — Web Application Quality — Accessibility
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

echo "♿ Running accessibility audit..."
echo ""

# Check if the web app is built
if [ ! -d "apps/web/.next" ]; then
  echo "📦 Building web application..."
  npm run build -w apps/web
fi

# Fail closed on a missing or incomplete build: the gate must never audit a
# stale or wrong server. In CI the production build runs as an explicit step
# immediately before this script; locally the build-if-missing above keeps
# the runner self-sufficient. BUILD_ID is written last by `next build`, so
# its presence proves the production build completed.
if [ ! -f "apps/web/.next/BUILD_ID" ]; then
  echo "❌ apps/web/.next/BUILD_ID not found — production build missing or incomplete." >&2
  echo "   Run 'npm run build -w apps/web' first." >&2
  exit 1
fi

# Set CI flag to use production server
export CI=true
export A11Y_PORT="${A11Y_PORT:-3100}"
export PORT="$A11Y_PORT"
export BASE_URL="http://localhost:${A11Y_PORT}"
export A11Y_ALLOW_UI_ONLY_READINESS=true
# This is an ephemeral test-only signing key; production credentials remain
# platform-injected and are never committed.
export AUTH_JWT_SECRET="${AUTH_JWT_SECRET:-a11y-local-test-only-signing-key}"

# Run accessibility tests
echo ""
echo "🧪 Running accessibility tests..."
cd apps/web
npx playwright test e2e/a11y-release.spec.ts --config playwright.a11y.config.ts
