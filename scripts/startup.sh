#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# VedMoulya — Production Startup Script
# EPIC-018 + EPIC-019 — deterministic, environment-aware startup
#
# Flow (every failure answers WHAT / WHY / REQUIRED / CONTINUES / ACTION):
#   1. ENV CHECK          → load the environment (npx tsx scripts/load-env.ts)
#   2. DEPENDENCY CHECK   → detect the Docker daemon (skip infra when down)
#   3. DATABASE/REDIS CHECK → preflight (npx tsx scripts/preflight.ts)
#   4. BUILD CHECK        → production REQUIRES apps/web/.next/BUILD_ID
#   5. PORT CHECK         → never silently move off :3000 (menu or --ci fail)
#   6. SERVER START       → next dev (--dev) or next start (production)
#   7. HEALTH CHECK       → bounded poll of /api/trpc/health.check
#
# Flags:
#   bash scripts/startup.sh               # production server (next start)
#   bash scripts/startup.sh --dev         # Next.js dev server (local dev)
#   bash scripts/startup.sh --profile observability
#   bash scripts/startup.sh --port 3001   # web port (conflicts never silent)
#   bash scripts/startup.sh --timeout 120 # bounded run (verification/CI)
#   bash scripts/startup.sh --ci          # deterministic: no prompts, port
#                                         #   conflict → exit 1
#
# Bounded & clean: every subcommand is time-bounded where practical; the web
# server is terminated on INT/TERM/EXIT via a process-tree cleanup; --timeout
# runs stop the server after N seconds and exit deterministically.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."
REPO_ROOT="$(pwd)"

PROFILE=""
DEV_MODE=""
MODE="production"
WEB_PORT="3000"
TIMEOUT_SECS=""
CI_MODE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile) PROFILE="${2:-}"; shift 2 ;;
    --dev) DEV_MODE="1"; MODE="development"; shift ;;
    --port) WEB_PORT="${2:-3000}"; shift 2 ;;
    --timeout) TIMEOUT_SECS="${2:-}"; shift 2 ;;
    --ci) CI_MODE="1"; shift ;;
    *) shift ;;
  esac
done

if ! [[ "$WEB_PORT" =~ ^[0-9]+$ ]] || [[ "$WEB_PORT" -lt 1 || "$WEB_PORT" -gt 65535 ]]; then
  echo "ERROR: --port must be a number between 1 and 65535 (got \"$WEB_PORT\")." >&2
  exit 2
fi
if [[ -n "$TIMEOUT_SECS" ]] && ! [[ "$TIMEOUT_SECS" =~ ^[0-9]+$ ]]; then
  echo "ERROR: --timeout must be a number of seconds (got \"$TIMEOUT_SECS\")." >&2
  exit 2
fi

echo "==> VedMoulya startup (mode: $MODE, port: $WEB_PORT) from $REPO_ROOT"

# ── 0. ENV CHECK — one authoritative load (npx tsx + built-in loader). ──────
# scripts/load-env.ts emits ONLY `export KEY='...'` lines (safe to eval) for
# the dotenv-format files of this mode; the preflight AND the launched
# processes then share exactly the same settings. Existing shell variables
# win (precedence) — never overridden. Never echo the exports. The loader is
# the same shared surface the preflight/doctor use (@vedmoulya/core
# loadEnvFilesSafe → process.loadEnvFile — no dotenv dependency).
echo "==> Loading environment (npx tsx + built-in loader)"
if ! ENV_EXPORTS="$(npx tsx scripts/load-env.ts --mode "$MODE")"; then
  echo "ERROR: failed to load the environment (scripts/load-env.ts)." >&2
  echo "  Why:      the repository's TS runtime could not run the env loader." >&2
  echo "  Required: yes — configuration validation needs the environment." >&2
  echo "  Action:   ensure the repository is installed (npm install) and rerun." >&2
  exit 1
fi
eval "$ENV_EXPORTS"

# ── 1. DEPENDENCY CHECK — detect the Docker daemon (never assume). ──────────
DOCKER_READY=1
if docker info >/dev/null 2>&1; then
  DOCKER_READY=0
fi

SKIP_DOCKER=""
if [[ "$DOCKER_READY" -eq 1 ]]; then
  echo "WARNING: Docker daemon unavailable — Postgres/Redis containers will be SKIPPED."
  echo "         The app continues DEGRADED: in-memory stores in development; production"
  echo "         features that need Postgres/Redis report their own runtime health"
  echo "         (health.check). Run the preflight with --skip-docker (automatic)."
  SKIP_DOCKER="--skip-docker"
fi

# ── 2. DATABASE/REDIS/AI CHECK — preflight, deterministic + actionable. ─────
# One gate for environment, config, authentication, database, redis, AI
# configuration, provider registry, production build and Docker. Production
# BLOCKS on a missing build — startup.sh REQUIRES the build and never builds
# implicitly (builds stay explicit: `npm run build -w apps/web`).
if [[ "$DEV_MODE" == "1" ]]; then
  echo "==> Preflight (development)"
  if ! npx tsx scripts/preflight.ts --mode development $SKIP_DOCKER; then
    echo "ERROR: development preflight failed a REQUIRED check (see above)." >&2
    exit 1
  fi
else
  echo "==> Preflight (production)"
  if ! npx tsx scripts/preflight.ts --mode production $SKIP_DOCKER; then
    echo "ERROR: production preflight failed — resolve the blocked checks above and rerun." >&2
    echo "       A missing production build is NOT built automatically:" >&2
    echo "       npm run build -w apps/web && bash scripts/startup.sh" >&2
    exit 1
  fi
fi

# ── 3. Infrastructure (Postgres + Redis via Docker Compose, when available). ─
if [[ "$DOCKER_READY" -eq 0 ]]; then
  echo "==> Starting infrastructure (Postgres + Redis)"
  if [[ -n "$PROFILE" ]]; then
    if command -v timeout >/dev/null 2>&1; then
      timeout 180 docker compose --profile "$PROFILE" up -d postgres redis
    else
      docker compose --profile "$PROFILE" up -d postgres redis
    fi
  else
    if command -v timeout >/dev/null 2>&1; then
      timeout 180 docker compose up -d postgres redis
    else
      docker compose up -d postgres redis
    fi
  fi
  echo "    Containers started (verify with: docker compose ps)"
else
  echo "==> Skipping infrastructure (Docker daemon unavailable)."
fi

# ── 4. BUILD CHECK (production only) ────────────────────────────────────────
if [[ "$DEV_MODE" != "1" ]] && [[ ! -f "$REPO_ROOT/apps/web/.next/BUILD_ID" ]]; then
  echo "ERROR: no production build exists (apps/web/.next/BUILD_ID missing)." >&2
  echo "  Why:       next start serves a pre-built bundle and refuses to boot without one." >&2
  echo "  Required:  yes (production mode)." >&2
  echo "  Action:    npm run build -w apps/web, then rerun: bash scripts/startup.sh" >&2
  exit 1
fi

# ── 5. PORT CHECK — never silently move off the requested port. ─────────────
# Probe via the same @vedmoulya/core probe `npm run doctor` uses. Interactive
# terminals get a choice ([1] stop [2] another port [3] cancel); --ci / no
# TTY fail deterministically with an actionable message.
port_status() { npx tsx scripts/check-port.ts --port "$1" 2>/dev/null || echo "ERROR probe-failed"; }

port_is_free() {
  case "$(port_status "$1")" in
    AVAILABLE) return 0 ;;
    OCCUPIED*) return 1 ;;
    *) return 2 ;;
  esac
}

ensure_port_free() {
  local check
  check="$(port_status "$WEB_PORT")"
  case "$check" in
    AVAILABLE) return 0 ;;
    ERROR*) echo "ERROR: could not probe port $WEB_PORT ($check)." >&2; exit 1 ;;
  esac

  local pid cmd who
  pid="$(echo "$check" | awk '{print $2}')"
  cmd="$(echo "$check" | cut -d' ' -f3-)"
  who=""
  if [[ -n "$pid" ]]; then who=" by PID $pid"; fi
  if [[ -n "$cmd" ]]; then who="$who ($cmd)"; fi

  if [[ -n "$CI_MODE" ]] || ! [[ -t 0 ]]; then
    echo "ERROR: Port $WEB_PORT is occupied$who." >&2
    echo "  Why:      the web server must never silently move to another port." >&2
    echo "  Required: yes — the server cannot bind $WEB_PORT." >&2
    echo "  Action:   stop the process on port $WEB_PORT, or rerun with --port <free-port>." >&2
    exit 1
  fi

  while true; do
    echo ""
    echo "Port $WEB_PORT is occupied$who."
    echo "Choose:"
    echo "  [1] stop existing process"
    echo "  [2] use another port"
    echo "  [3] cancel"
    read -r -p "> " choice || { echo ""; exit 1; }
    case "$choice" in
      1)
        if [[ -z "$pid" ]]; then
          echo "  The owner PID could not be determined — stop the process manually and rerun."
          continue
        fi
        if kill "$pid" 2>/dev/null; then
          echo "  Stopped PID $pid."
          sleep 1
          if port_is_free "$WEB_PORT"; then return 0; fi
          echo "  Port $WEB_PORT is still occupied."
        else
          echo "  Could not stop PID $pid (check permissions)."
        fi
        ;;
      2)
        read -r -p "  New port: " WEB_PORT || { echo ""; exit 1; }
        if ! [[ "$WEB_PORT" =~ ^[0-9]+$ ]] || [[ "$WEB_PORT" -lt 1 || "$WEB_PORT" -gt 65535 ]]; then
          echo "  Invalid port."
          continue
        fi
        if port_is_free "$WEB_PORT"; then return 0; fi
        echo "  Port $WEB_PORT is also occupied."
        ;;
      3)
        echo "Cancelled."
        exit 1
        ;;
      *) echo "  Invalid choice (1, 2 or 3)." ;;
    esac
  done
}

echo "==> Port check (:${WEB_PORT})"
ensure_port_free
echo "    Port $WEB_PORT is available."

# ── 6. SERVER START ─────────────────────────────────────────────────────────
# Process-tree cleanup: INT/TERM/EXIT terminate the web server and its
# children (taskkill /T on Windows, pkill -P + kill on POSIX) so no
# verification or dev session leaves a background server behind.
WEB_PID=""
# The npm/cmd wrapper's process tree can leave the REAL next server (the
# process holding the listening socket) behind on Windows. stop_web therefore
# kills the port holder first, then the wrapper tree — bounded and idempotent.
stop_web() {
  if [[ -n "$WEB_PID" ]]; then
    local pid="$WEB_PID"
    # 1) The real server owns the socket — kill it (regardless of wrapper).
    local holder=""
    if command -v netstat >/dev/null 2>&1; then
      holder="$(netstat -ano 2>/dev/null | grep -iE "[.:]${WEB_PORT}[[:space:]]+" | grep -i LISTENING | awk '{print $NF}' | head -1 || true)"
    fi
    if [[ -n "$holder" ]] && [[ "$holder" =~ ^[0-9]+$ ]] && [[ "$holder" != "$pid" ]]; then
      if command -v taskkill >/dev/null 2>&1 && [[ "$(uname -s)" == *MINGW* || "$(uname -s)" == *MSYS* ]]; then
        taskkill //T //F //PID "$holder" >/dev/null 2>&1 || true
      else
        kill "$holder" 2>/dev/null || true
      fi
    fi
    # 2) The npm/cmd wrapper tree.
    if command -v taskkill >/dev/null 2>&1 && [[ "$(uname -s)" == *MINGW* || "$(uname -s)" == *MSYS* ]]; then
      taskkill //T //F //PID "$pid" >/dev/null 2>&1 || true
    else
      pkill -TERM -P "$pid" 2>/dev/null || true
      kill "$pid" 2>/dev/null || true
    fi
    # 3) Bounded reap: never let a stubborn Windows job entry block shutdown.
    local i
    for i in $(seq 1 10); do
      if ! kill -0 "$pid" 2>/dev/null; then break; fi
      sleep 1
    done
    WEB_PID=""
  fi
}
trap 'stop_web' INT TERM EXIT

if [[ "$DEV_MODE" == "1" ]]; then
  echo "==> Starting web app (dev server) on :$WEB_PORT"
  npm run dev -w apps/web -- -p "$WEB_PORT" &
else
  echo "==> Starting web app (production server) on :$WEB_PORT"
  (cd apps/web && npm run start -- -p "$WEB_PORT") &
fi
WEB_PID=$!
echo "==> Web server PID $WEB_PID"

# ── 7. HEALTH CHECK — bounded poll, never an unbounded wait. ────────────────
health_check() {
  local url="http://localhost:${WEB_PORT}/api/trpc/health.check"
  echo "==> Health check (bounded): $url"
  local i
  for i in $(seq 1 45); do
    if curl -sf "$url" >/dev/null 2>&1; then
      echo "    Health check PASSED (attempt $i)."
      return 0
    fi
    sleep 2
  done
  echo "WARNING: health check did not return 200 within 90s." >&2
  echo "         Development compiles on first request; check the server log above." >&2
  return 1
}
HEALTH_OK=0
if health_check; then
  HEALTH_OK=1
fi

# ── 8. RUN (bounded or foreground) ──────────────────────────────────────────
if [[ -n "$TIMEOUT_SECS" ]]; then
  ( sleep "$TIMEOUT_SECS" ) &
  SLEEP_PID=$!
  wait -n "$WEB_PID" "$SLEEP_PID" 2>/dev/null || true
  if kill -0 "$WEB_PID" 2>/dev/null; then
    echo "==> Bounded run complete after ${TIMEOUT_SECS}s (--timeout). Stopping web server."
    stop_web
    exit 0
  fi
  echo "ERROR: web server exited before the ${TIMEOUT_SECS}s bounded run finished." >&2
  exit 1
fi

echo "==> Startup complete. PID $WEB_PID"
echo "    Health: http://localhost:${WEB_PORT}/api/trpc/health.check"
if [[ "$HEALTH_OK" -ne 1 && "$MODE" == "production" ]]; then
  echo "ERROR: production server did not pass its health check." >&2
  exit 1
fi
wait "$WEB_PID"
