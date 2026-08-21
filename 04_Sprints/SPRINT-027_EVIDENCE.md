# SPRINT-027 — Evidence

> **Sprint:** SPRINT-027 — Platform Integrity & Speech Foundation
> **Date:** 2026-08-13
> Every row below was executed live in this sprint. No fabricated counts.

---

## 1. Files Changed

### New (speech foundation — `packages/voice`)

| File                                                             | Role                                                                                            |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `packages/voice/package.json`                                    | Workspace manifest (`@vedmoulya/voice`)                                                         |
| `packages/voice/tsconfig.json`                                   | Project config (ESM, strict, project references)                                                |
| `packages/voice/vitest.config.ts`                                | 80% coverage thresholds (repo gate)                                                             |
| `packages/voice/src/types/voice-types.ts`                        | Speech/conversation types only — no behavior                                                    |
| `packages/voice/src/contracts/voice-ports.ts`                    | `SpeechToTextPort`, `TextToSpeechPort`, `ConversationStore` — narrow seams                      |
| `packages/voice/src/domain/VoiceIntentGate.ts`                   | VOICE ≠ AUTHORIZATION gate (reuses Brain `IntentInterpreter` + `SENSITIVE_ACTIONS`)             |
| `packages/voice/src/domain/ConversationPolicy.ts`                | Bounds: `MAX_AUDIO_BYTES`, `MAX_SYNTHESIS_TEXT_LENGTH`, `MAX_TURNS_PER_CONVERSATION`, retention |
| `packages/voice/src/infrastructure/MockSpeechToTextAdapter.ts`   | Hermetic STT seam (MOCK kind — never claims real speech)                                        |
| `packages/voice/src/infrastructure/MockTextToSpeechAdapter.ts`   | Hermetic TTS seam (deterministic WAV placeholder)                                               |
| `packages/voice/src/infrastructure/InMemoryConversationStore.ts` | Owner-scoped, bounded, in-memory (hermetic tests / single-instance)                             |
| `packages/voice/src/infrastructure/PostgresConversationStore.ts` | Owner-scoped, bounded, durable (WriteThroughDocumentStore)                                      |
| `packages/voice/src/application/SpeechApplicationService.ts`     | Composition seam (no engine — delegates to ports + Brain gate)                                  |
| `packages/voice/src/index.ts`                                    | Barrel                                                                                          |

### Gateway (services/api)

| File                                      | Change                                                                                                                                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/middleware/rate-limit.ts`            | **R-1** — RateLimiter port: in-memory (default, honest `distributed:false`) + Redis backend (explicit `RATE_LIMIT_BACKEND=redis`, INCR+PEXPIRE, explicit loud degradation); async contract; env-configurable tiers |
| `src/middleware/audit.ts`                 | **R-2** — store-backed audit; in-memory fallback only when no store is wired                                                                                                                                       |
| `src/infrastructure/AuditLogStore.ts`     | **R-2** — durable owner-scoped audit entries via `WriteThroughDocumentStore` (bounded, oldest-evicted)                                                                                                             |
| `src/infrastructure/PersistenceStores.ts` | Wire audit store + voice conversation store into the persistence bundle                                                                                                                                            |
| `src/services/ApiApplicationService.ts`   | Compose `SpeechApplicationService` (mock STT/TTS + Postgres conversation store)                                                                                                                                    |
| `src/services/RouterRegistry.ts`          | Register `voice.*` namespace (8 procedures, all standardProcedure = auth + rate-limited); migrate all `assertRateLimit` call sites to async                                                                        |
| `src/routers/VoiceRouter.ts`              | Thin procedures over the speech service; honest error-code mapping preserving `voiceCode` in `details`                                                                                                             |
| `src/routers/*.ts` (9 routers)            | `await assertRateLimit(...)` migration (async contract)                                                                                                                                                            |
| `package.json`                            | Add `@vedmoulya/voice` workspace dep                                                                                                                                                                               |

### Hygiene (Phase 2)

| File                                                    | Change                                                                                                                                                                                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/AICompanion.tsx`               | Removed dead Mic button + `Mic` import; Phoenix badge → **VedMoulya**; footer → **VedMoulya Intelligence**                                                                                                                                  |
| `packages/services/src/dashboard/DashboardAssembler.ts` | "Ask Phoenix" → "Ask VedMoulya"                                                                                                                                                                                                             |
| `apps/web/src/app/goals/problem-panel.tsx`              | **Pre-existing P1 build fix**: deep-import `OUTCOME_VERDICTS`/`OUTCOME_VERDICT_LABELS` from pure constant modules instead of the brain barrel (barrel pulled server-only `node:net`/`node:fs` into the client bundle → `next build` failed) |
| `services/notifications/`                               | **Deleted** (proven dead: zero references outside itself)                                                                                                                                                                                   |

### Tests added

| File                                                             | Tests                                                                                                                            |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `packages/voice/src/__tests__/VoiceIntentGate.test.ts`           | 19 — classification, sensitive/ambiguous/failed/aborted transcripts, approval-only-via-grant, cancellation, confidence floor     |
| `packages/voice/src/__tests__/ConversationStore.test.ts`         | 8 — bounds, ownership, retention, clear                                                                                          |
| `packages/voice/src/__tests__/PostgresConversationStore.test.ts` | 5 — durable store via fake sql                                                                                                   |
| `packages/voice/src/__tests__/SpeechApplicationService.test.ts`  | 17 — transcribe/synthesize bounds, cancellation, provider failure, mock-in-production refusal, no-fact-promotion                 |
| `services/api/src/__tests__/RateLimiter.test.ts`                 | 12 — memory backend, redis backend (fixed window, TTL), outage → explicit degradation, config errors fail fast, anonymous bucket |
| `services/api/src/__tests__/AuditLogStore.test.ts`               | 6 — persistence, ownership, bound/eviction                                                                                       |
| `services/api/src/__tests__/VoiceRouter.test.ts`                 | 11 — full tRPC pipeline: status honesty, bounds, error mapping, VOICE ≠ AUTHORIZATION, owner isolation, IDOR                     |

### Tests updated (contract migration, no weakening)

| File                                            | Change                                                                                                            |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `services/api/src/__tests__/middleware.test.ts` | Rate-limit checks → async contract                                                                                |
| `services/api/src/__tests__/routers.test.ts`    | 2 stale sync rate-limit assertions → awaited (one was vacuous — a floating promise — now asserts the real result) |

---

## 2. Full Validation Matrix (Phase 8)

| Gate                                                                                         | Command                                                                                                                                             | Result                                                                                        |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Full test suite                                                                              | `npx vitest run`                                                                                                                                    | **8 100 passed / 1 skipped · 646 files**                                                      |
| Core engines (brain + execution-bridge + capability-marketplace + goals + scheduler + voice) | `npx vitest run packages/brain packages/execution-bridge packages/capability-marketplace packages/goals packages/ai-world-scheduler packages/voice` | **419/419**                                                                                   |
| Gateway                                                                                      | `cd services/api && npx vitest run`                                                                                                                 | **745 passed / 1 skipped · 38 files**                                                         |
| Web                                                                                          | `cd apps/web && npx vitest run`                                                                                                                     | **167/167**                                                                                   |
| Typecheck (all workspaces)                                                                   | `npx tsc -b`                                                                                                                                        | **exit 0**                                                                                    |
| API typecheck                                                                                | `npx tsc --noEmit -p services/api`                                                                                                                  | **exit 0**                                                                                    |
| Lint (per-workspace; full-repo single process exceeds memory)                                | `npx eslint packages apps services`                                                                                                                 | **0 errors**                                                                                  |
| Workspace build                                                                              | `npm run build`                                                                                                                                     | **exit 0**                                                                                    |
| Web production build                                                                         | `cd apps/web && npx next build`                                                                                                                     | **PASS** (after pre-existing P1 fix — was failing on `main`)                                  |
| SPRINT-024 runtime verification benchmark                                                    | `npx tsx scripts/runtime-verification-benchmark.ts`                                                                                                 | **36/36 PASS**                                                                                |
| SPRINT-025 learning benchmark                                                                | `npx tsx scripts/learning-benchmark.ts`                                                                                                             | **25/25 PASS**                                                                                |
| SPRINT-023 outcome journey benchmark                                                         | `npx tsx scripts/outcome-journey-benchmark.ts`                                                                                                      | **30/30 PASS**                                                                                |
| Coverage gate                                                                                | `COVERAGE_GATE_FILTER=packages/voice,services/api node scripts/coverage-gate.mjs`                                                                   | voice **96.2% stmts / 91.2% branch** ✅; services/api ❌ (pre-existing branch gap, see below) |

### services/api coverage — pre-existing, not a regression

| Metric       | Pristine tree (baseline, measured via stash) | With SPRINT-027 |
| ------------ | -------------------------------------------- | --------------- |
| Statements   | 83.11%                                       | 84.36%          |
| **Branches** | **62.14%**                                   | **63.18%**      |
| Functions    | 88.45%                                       | 89.56%          |
| Lines        | 84.67%                                       | 85.96%          |

The branch shortfall comes from **pre-existing port-adapter files** (e.g. `BrainPorts`
3.75%, `AttachmentPort` 0%, `IntelligencePorts` 0%, `SchedulerPorts` 0%) that predate
this sprint and are not exercised by any suite. SPRINT-027 **raised** every metric and
did not regress anything. Closing the gateway branch gate is scoped to the production-
readiness sprint (SPRINT-030) because it requires test suites for adapters outside this
sprint's integrity/speech scope.

---

## 3. Honest status of speech

| Claim                                               | Status                                                                                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `SpeechToTextPort` / `TextToSpeechPort` seams exist | ✅ IMPLEMENTED + TESTED                                                                                                               |
| Mock STT / TTS adapters exist                       | ✅ IMPLEMENTED + TESTED (hermetic)                                                                                                    |
| Real (provider-backed) speech adapters              | ⬜ **NOT IMPLEMENTED — OPERATOR-REQUIRED** (no provider adapter declares `speech`; `voice.status` reports `MOCK`, never `CONFIGURED`) |
| Voice UI (Mic live)                                 | ⬜ **FUTURE** (SPRINT-028) — the dead Mic was removed, not enabled                                                                    |
| Voice conversation persistence                      | ✅ IMPLEMENTED + TESTED (owner-scoped, bounded, Postgres-backed)                                                                      |
| VOICE ≠ AUTHORIZATION                               | ✅ IMPLEMENTED + TESTED                                                                                                               |
| Any new engine                                      | ❌ **NONE — verified composition only**                                                                                               |
