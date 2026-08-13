# EPIC-018 — VedMoulya Production Startup & Environment Reliability: Preflight

**Status:** IMPLEMENTED + VERIFIED (2026-08-11)

The deterministic startup diagnostic (Phase 4/8/9). Every startup failure now
answers: **WHAT failed · WHY · is it REQUIRED · what CONTINUES · WHAT to do.**

---

## 1. Where it lives

- **Engine:** `packages/core/src/startup/preflight.ts` — pure, injectable
  `PreflightEngine` (no I/O; every probe arrives through the
  `PreflightEnvironment` interface). Exported from `@vedmoulya/core`.
- **CLI:** `scripts/preflight.ts` — `npm run preflight` (development) /
  `npm run preflight -- --mode production`. Loads the environment files, binds
  the real probes, prints the report.
- **Tests:** `packages/core/src/startup/__tests__/preflight.test.ts` — 20/20 (incl. DeepSeek-key production cases).
- **Startup:** `scripts/startup.sh` runs the preflight before anything else.

## 2. Checks

| Check                                                  | Development                | Production/Staging             |
| ------------------------------------------------------ | -------------------------- | ------------------------------ |
| Environment (config evaluation via `getConfig()`)      | required                   | required                       |
| Authentication (`AUTH_JWT_SECRET` present + ≥32 chars) | required                   | required                       |
| AI configuration (key or explicit mock)                | NOT_CONFIGURED (mock)      | MISCONFIGURED without key/mock |
| Database (`IDENTITY_DATABASE_URL`, loopback refused)   | NOT_CONFIGURED (in-memory) | required                       |
| Redis (`REDIS_URL`, loopback refused)                  | NOT_CONFIGURED (in-memory) | required                       |

When the URL is configured and the Docker daemon is up, the check additionally
**probes the actual service** with a synchronous 1.5s TCP connect to the URL's
host:port (via a child Node process — the preflight stays synchronous):
unreachable service → `DEPENDENCY_UNAVAILABLE` (production) / soft
`NOT_CONFIGURED` (development). So "Database/Redis detection" is URL config +
Docker daemon + **real service reachability** — not a guess.
| Provider registry (≥1 runtime provider) | READY (mock) | BLOCKED without key/mock |
| Production build (`.next/BUILD_ID`) | READY (n/a) | required |
| Docker daemon | NOT_CONFIGURED (optional) | DEPENDENCY_UNAVAILABLE |

**Statuses** (shared vocabulary with the existing runtime health model — no new
health engine): `READY` · `DEGRADED` · `BLOCKED` · `MISCONFIGURED` ·
`DEPENDENCY_UNAVAILABLE` · `NOT_CONFIGURED`.

**Exit code:** `0` = no required check failed (optional gaps print as warnings);
`1` = blocked; `2` = invalid CLI usage.

## 3. Verified output (this machine, 2026-08-11)

Development (`npm run preflight` — exit 0):

```
VedMoulya Preflight — mode: development
──────────────────────────────────────────────
  Environment        ✓ READY
  Authentication     ✓ READY
  AI configuration   ✓ READY
  Database           - NOT_CONFIGURED
  Redis              - NOT_CONFIGURED
  Provider registry  ✓ READY
  Production build   ✓ READY
  Docker             - NOT_CONFIGURED

READY

Optional gaps (development continues, production must resolve):
  - Database: IDENTITY_DATABASE_URL is not set — using the development in-memory convention.
  ...
```

Production (`npm run preflight -- --mode production` — exit 1) prints each
blocker in the WHAT/WHY/REQUIRED/CONTINUES/ACTION format, e.g.:

```
AUTHENTICATION — MISCONFIGURED
  Reason:    AUTH_JWT_SECRET is missing or too short (< 32 chars).
  Why:       The gateway signs session tokens with AUTH_JWT_SECRET — it has no
             default and is required in every mode (fail-fast).
  Required:  yes (production)
  Continues: Nothing that authenticates users can start without it.
  Action:    Generate one and put it in your .env.local (gitignored): node -e "..."

PRODUCTION BUILD — BLOCKED
  Reason:    No production build exists (apps/web/.next/BUILD_ID not found).
  Why:       next start serves a pre-built bundle; without a build it refuses to boot.
  Required:  yes (production)
  Continues: Nothing can start in production until the build exists.
  Action:    Run: npm run build -w apps/web  (startup.sh builds it automatically when missing).
```

## 4. Distinctions the preflight makes (Phase 6)

- **"No production build exists"** → `production-build` BLOCKED (and
  `startup.sh` builds automatically when missing).
- **"Build exists but configuration is invalid"** → `environment` /
  `authentication` / `ai-configuration` MISCONFIGURED.
- **"Infrastructure unavailable"** → `docker` / `database` / `redis`
  DEPENDENCY_UNAVAILABLE (vs MISCONFIGURED when the URL is absent/loopback).

## 5. Reuse — no duplicate health engine (Phase 9)

Runtime health remains owned by the existing `HealthChecker`
(`@vedmoulya/core`), the gateway `InfrastructureHealthProbe`, `health.*` tRPC
procedures and `ops.getDiagnostics`. The preflight is a **pre-process**
diagnostic using the same status vocabulary; it does not replace them.
