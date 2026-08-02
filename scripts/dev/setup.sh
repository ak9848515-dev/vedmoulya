#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# VedMoulya — Local Dev Setup
# PR-002 / T6 — Deployment Verification
#
# Prepares a fresh checkout for local development:
#   1. Install dependencies
#   2. Build core packages
#   3. Create .env.local from the template (if absent)
#
# Usage:
#   bash scripts/dev/setup.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/../.."

echo "==> Installing dependencies"
npm install

echo "==> Building core packages"
npm run build:core

if [[ ! -f .env.local ]]; then
  echo "==> Creating .env.local from .env.example"
  cp .env.example .env.local
  echo "    ⚠ Edit .env.local and set AUTH_JWT_SECRET + DATABASE/REDIS URLs before running."
else
  echo "==> .env.local already exists (keeping it)"
fi

echo "==> ✅ Dev setup complete — run: npm run dev"
