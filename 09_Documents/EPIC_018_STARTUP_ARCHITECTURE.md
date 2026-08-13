# EPIC-018 — VedMoulya Production Startup & Environment Reliability: Startup Architecture

**Status:** IMPLEMENTED + VERIFIED (2026-08-11)
**Verdict:** 🟢 **GREEN — IMPLEMENTATION VERIFIED**

This document is the startup-mode audit (Phase 1) and the AI-provider
classification (Phase 7). Every claim was verified from the repository — nothing
is assumed. Terminology: **IMPLEMENTED** (code exists) · **VERIFIED** (a command
was run and passed) · **OPERATOR REQUIRED** (needs a real environment/credential)
· **NOT AVAILABLE** (does not exist).

---

## 1. Startup modes

| Mode                  | Command                                                   | NODE_ENV                                   | Config strictness                | Infrastructure                  | Build                          | AI provider                                              | Verdict on this machine                                                |
| --------------------- | --------------------------------------------------------- | ------------------------------------------ | -------------------------------- | ------------------------------- | ------------------------------ | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| DEV                   | `npm run dev` (or `bash scripts/startup.sh --dev`)        | development                                | Lenient except `AUTH_JWT_SECRET` | Optional (in-memory convention) | None (compiled on demand)      | Mock registered automatically (or OpenAI if key present) | ✅ VERIFIED (ready in ~4s, HTTP 200)                                   |
| TEST                  | `npm test` (vitest)                                       | test                                       | Lenient                          | None (in-memory doubles)        | None                           | Mock via `tests/vitest.setup.ts`                         | ✅ VERIFIED (7,756/7,756)                                              |
| CI                    | `.github/workflows/ci.yml` (Node 22, ubuntu)              | production during build, test during tests | —                                | None (hermetic)                 | `next build`                   | `AI_ENABLE_MOCK=true` in e2e                             | ✅ VERIFIED (pipeline green; local mirror `scripts/ci/run.sh`)         |
| LOCAL PRODUCTION-LIKE | `bash scripts/startup.sh` + `.env.local` + Docker Desktop | production                                 | Strict (fail-fast)               | Docker Postgres/Redis           | `next build` then `next start` | `AI_OPENAI_API_KEY` or `AI_ENABLE_MOCK=true`             | ⚠️ BLOCKED without Docker + build + secrets (actionable via preflight) |
| STAGING               | Platform env (Railway/Vercel style)                       | staging                                    | Strict (same as production)      | Postgres/Redis (non-loopback)   | CI build                       | Real provider key                                        | 🔧 OPERATOR REQUIRED (not configured in repo)                          |
| PRODUCTION            | Platform env                                              | production                                 | Strict                           | Postgres/Redis (non-loopback)   | CI build                       | Real provider key                                        | 🔧 OPERATOR REQUIRED (not configured in repo)                          |

### 1.1 Verified startup paths (2026-08-11)

- **`npm run dev`** — VERIFIED. Next.js 15.5.22 loads `apps/web/.env.local`
  (gitignored, holds `AUTH_JWT_SECRET`), compiles the monorepo TS sources, and
  serves `/` with HTTP 200; `health.check` returns success; unauthenticated
  `aiWorldScheduler.getStatus` returns the expected 401 (auth guard working).
- **`bash scripts/startup.sh --dev`** — VERIFIED (EPIC-018 rewrite). Runs the
  preflight (READY), warns when Docker is unavailable, continues on the
  in-memory convention, and starts the dev server.
- **`npm test`** — VERIFIED. Full suite **619 files / 7,756 tests / 0 failures**
  (exit 0) on Node v24.18.0 + Vitest 4.1.10. The historical Aug-09
  `Cannot read properties of undefined (reading 'config')` crash no longer
  reproduces.
- **`npm start` without a build** — previously BLOCKED ("Could not find a
  production build"). Now the preflight reports `PRODUCTION BUILD — BLOCKED`
  with the exact fix, and `startup.sh` builds automatically when missing.

### 1.2 services/api startup

The API gateway (`services/api`) is a **library served by the web app**
(Next.js server bundle — `apps/web/Dockerfile`, `services/api/Dockerfile` note).
There is no standalone API process to start. Its construction happens lazily on
the first real request; the gateway's `ApiApplicationService` constructor runs
`validateProductionAIConfig()` (fail-fast in production/staging).

---

## 2. Environment variables by mode (verified from `packages/core/src/config`, `services/api/src/infrastructure/ProductionAIConfig.ts`)

| Variable                               | Server-only  | DEV         | TEST             | CI              | LOCAL PROD-LIKE | STAGING/PROD           | Notes                                                                                                   |
| -------------------------------------- | ------------ | ----------- | ---------------- | --------------- | --------------- | ---------------------- | ------------------------------------------------------------------------------------------------------- |
| `AUTH_JWT_SECRET`                      | ✅           | REQUIRED    | REQUIRED (setup) | n/a             | REQUIRED        | REQUIRED               | No default; strength ≥ 32 chars, fail-fast in every mode                                                |
| `IDENTITY_DATABASE_URL`                | ✅           | optional    | n/a              | n/a             | REQUIRED        | REQUIRED               | Loopback refused in strict modes                                                                        |
| `REDIS_URL`                            | ✅           | optional    | n/a              | n/a             | REQUIRED        | REQUIRED               | Loopback refused in strict modes                                                                        |
| `AI_OPENAI_API_KEY` / `OPENAI_API_KEY` | ✅           | optional    | optional         | e2e uses mock   | one REQUIRED    | one REQUIRED           | Wired runtime provider (Vercel AI SDK)                                                                  |
| `AI_DEEPSEEK_API_KEY`                  | ✅           | optional    | optional         | —               | one REQUIRED    | one REQUIRED           | Wired runtime provider (OpenAI-compatible Vercel AI SDK)                                                |
| `AI_ENABLE_MOCK`                       | ✅           | n/a         | n/a              | `true` (e2e)    | optional opt-in | `false` (never silent) | Production mock requires explicit opt-in                                                                |
| `AI_DEFAULT_PROVIDER`                  | ✅           | openai      | openai           | openai          | openai/deepseek | openai/deepseek        | `openai` and `deepseek` are both executable today; the default provider's key is required in production |
| `NODE_ENV`                             | ✅           | development | test             | production/test | production      | production/staging     | Drives config strictness                                                                                |
| `NEXT_PUBLIC_*`                        | ❌ (browser) | as needed   | —                | —               | —               | —                      | Only non-secret values may use this prefix                                                              |

All secrets are **server-only**. The gateway never sends `process.env` secrets to
the client; `apps/web/src/lib/api-client.ts` exposes only typed procedures.

---

## 3. AI provider classification (Phase 7 — verified from `services/orchestrator/src/index.ts` + `VercelAIProvider.ts`)

| Provider            | Taxonomy (catalog/docs) | Config keys accepted                                       | Runtime adapter                                                                                                | Executable | Classification                                                                                                                                |
| ------------------- | ----------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenAI              | ✅                      | `AI_OPENAI_API_KEY` (canonical), `OPENAI_API_KEY` (legacy) | `VercelAIProvider` (Vercel AI SDK `@ai-sdk/openai`) — **the primary production path**                          | ✅         | **REGISTERED + EXECUTABLE + VERIFIED** (SDK adapter tests 12/12; live call reached the real API and was honest-reported quota-blocked)        |
| DeepSeek            | ✅                      | `AI_DEEPSEEK_API_KEY` (canonical, validated)               | `DeepSeekProvider` (Vercel AI SDK `createOpenAI` pointed at `https://api.deepseek.com`, Chat Completions path) | ✅         | **REGISTERED + EXECUTABLE** (adapter tests 16/16 deterministic; no live call fabricated — live execution is an operator step with a real key) |
| Mock                | ✅                      | `AI_ENABLE_MOCK=true` (prod) / auto (dev)                  | `MockProvider`                                                                                                 | ✅         | **REGISTERED + EXECUTABLE** (deterministic; never silently in production)                                                                     |
| Anthropic           | ✅                      | `AI_ANTHROPIC_API_KEY` (validated if set)                  | — none —                                                                                                       | ❌         | **TAXONOMY ONLY / NOT AVAILABLE** — key is never consumed by any adapter                                                                      |
| Google (Gemini)     | ✅                      | `AI_GOOGLE_API_KEY` (validated if set)                     | — none —                                                                                                       | ❌         | **TAXONOMY ONLY / NOT AVAILABLE**                                                                                                             |
| OpenRouter / Ollama | ✅ (catalog + AI World) | — none —                                                   | — none — (Ollama discovery exists in Provider Intelligence UI)                                                 | ❌         | **TAXONOMY ONLY / NOT AVAILABLE** as runtime adapters                                                                                         |

Honest statement: setting `AI_DEFAULT_PROVIDER=deepseek` now activates the
DeepSeek runtime provider **when `AI_DEEPSEEK_API_KEY` is present** —
`registerPlatformProviders` registers the `DeepSeekProvider` (Vercel AI SDK,
OpenAI-compatible) alongside the OpenAI SDK adapter and (conditionally) the
Mock provider. `AI_DEFAULT_PROVIDER=anthropic` / `=google` / `=openrouter` /
`=ollama` still does NOT activate anything — those remain taxonomy-only. Live
DeepSeek execution is an **operator step** (requires a real key; the adapter's
16 deterministic tests never fabricate a live call).
