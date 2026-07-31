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

# Set CI flag to use production server
export CI=true
export BASE_URL="http://localhost:3000"

# Kill any existing process on port 3000
kill_port_3000() {
  local pid
  pid=$(lsof -ti:3000 2>/dev/null || true)
  if [ -n "$pid" ]; then
    kill "$pid" 2>/dev/null || true
    sleep 1
  fi
}

# Cleanup handler
cleanup() {
  echo ""
  echo "🧹 Cleaning up..."
  kill_port_3000
}
trap cleanup EXIT

# Start the production server
echo "🚀 Starting production server..."
cd apps/web
npx next start &
SERVER_PID=$!
cd ../..

# Wait for server to be ready
echo "⏳ Waiting for server..."
for i in $(seq 1 30); do
  if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Server is ready"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "❌ Server failed to start"
    exit 1
  fi
  sleep 1
done

# Run accessibility tests
echo ""
echo "🧪 Running accessibility tests..."
cd apps/web
npx playwright test --grep "Accessibility" --reporter=list
EXIT_CODE=$?
cd ../..

echo ""
if [ "$EXIT_CODE" -eq 0 ]; then
  echo "✅ Accessibility audit passed"
else
  echo "❌ Accessibility audit found issues"
fi

exit $EXIT_CODE
