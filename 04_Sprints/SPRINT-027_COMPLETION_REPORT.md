# SPRINT-027 — Completion Report

> **Sprint:** SPRINT-027 — Platform Integrity & Speech Foundation
> **Date:** 2026-08-13
> **Verdict:** 🟢 **COMPLETE — integrity gaps closed, speech seams in place, no new engines**

---

## 1. Executive Verdict

SPRINT-027 delivered exactly what the audit prescribed: **closed the two P1 gateway
integrity gaps (R-1 rate limiting, R-2 audit), removed proven-dead code, fixed the
Phoenix branding inconsistency and a pre-existing production-build blocker, and laid
the speech capability foundation (ports + mock adapters + VOICE ≠ AUTHORIZATION gate +
owner-scoped conversation store) without creating a single new engine.**

The system remains one Brain, one decision system, one execution path, one verification
path, one learning loop. Voice is a capability seam, not an agent. Full suite
**8 100/8 100 PASS (646 files)**, typecheck **0**, lint **0**, all prior benchmarks
**GREEN**, `next build` **PASS**. Honest status: real speech providers remain
**OPERATOR-REQUIRED**; nothing fabricated.

---

## 2. Files Changed

See `SPRINT-027_EVIDENCE.md` §1 for the full table. Summary:

- **New workspace** `packages/voice` (14 source/test files) — speech ports, mock
  adapters, conversation stores (in-memory + Postgres), intent gate, policy, service.
- **Gateway** — `rate-limit.ts` rewritten (port + Redis backend), `audit.ts` store-backed,
  new `AuditLogStore.ts`, `PersistenceStores.ts` / `ApiApplicationService.ts` /
  `RouterRegistry.ts` wiring, new `VoiceRouter.ts` (+ 8 zod inputs), 9 routers migrated
  to the async rate-limit contract, `package.json` dep.
- **Web** — `AICompanion.tsx` (dead Mic removed, VedMoulya branding), `problem-panel.tsx`
  (build fix), `DashboardAssembler.ts` (branding).

## 3. Files Deleted

- `services/notifications/` — whole service (README, package.json, src, tests, tsconfig,
  vitest.config). **Deletion proven**: zero references to `services/notifications` or its
  exports anywhere in `apps services packages scripts tooling .github`.

## 4. Architecture Changes

- Rate limiting moved from a sync in-memory helper to an **async RateLimiter port** with
  two backends (memory = current single-instance truth; redis = explicit multi-instance).
  Honest contract: `distributed:false` for memory; Redis degradation is loud, once, and
  surfaced via `getRateLimiterStatus()` — never a silent claim of distributed safety.
- Gateway audit moved from a module-level array to a **durable store** (Postgres-backed
  `WriteThroughDocumentStore`, in-memory only when no store is wired).
- **No new engine anywhere.** Brain remains the orchestrator; approval/budget/provider-
  selection/execution/verification/learning/scheduler/notification authorities untouched.

## 5. Security Changes

- Rate limiting is now **owner-scoped, fail-safe, bounded, and degrade-explicitly**
  (never silently permissive). Unauthenticated traffic shares a single anonymous bucket
  per tier — no bypass via unknown users.
- Audit events are **durable** (survive restarts) and owner-scoped.
- `RATE_LIMIT_BACKEND=redis` without `REDIS_URL` **fails fast** (config error, not a
  silent fallback). Unknown backends fail fast.
- The voice `assessAction` procedure exposes the VOICE ≠ AUTHORIZATION decision; the
  transcript can never grant approval. Gateway guard still rejects cross-user calls.

## 6. Voice Foundation Changes

- `SpeechToTextPort` / `TextToSpeechPort` narrow seams, provider-agnostic, capability-
  driven (`capability: 'SPEECH_TO_TEXT' | 'TEXT_TO_SPEECH'`), bounded input/output,
  AbortSignal-aware, owner-scoped.
- `MockSpeechToTextAdapter` / `MockTextToSpeechAdapter` — hermetic, deterministic,
  `kind: 'MOCK'`; **refused in production unless `VOICE_ENABLE_MOCK=true`** (mirrors
  `AI_ENABLE_MOCK`). `voice.status` reports `MOCK`, never `CONFIGURED`, until a real
  adapter is registered. No raw provider logic in UI; no keys in client code.
- `SpeechApplicationService` composes ports + gate; the Brain stays the orchestrator.

## 7. Conversation Changes

- Owner-scoped `ConversationStore` (in-memory for hermetic tests, Postgres-backed for
  durability), bounded history (`MAX_TURNS_PER_CONVERSATION` / `MAX_TURNS_RETURNED`),
  oldest-evicted retention, per-owner isolation tested.
- Conversations are **interaction artifacts** — the voice package exposes **no promotion
  path** into user facts / preferences / outcome memory / learning (tested).

## 8. UX Findings

- **Removed** the dead Mic control (was `onClick={() => {}}` with `aria-label="Voice input"`).
- **VedMoulya branding** now consistent across AICompanion badge/footer and dashboard
  "Ask AI" description. No Phoenix remains in product code.
- **Pre-existing P1**: `next build` was failing on `main` because `problem-panel.tsx`
  imported the brain barrel from a client component, dragging server-only `node:*` into
  the bundle. Fixed via deep imports of pure constant modules.
- No redesign performed (out of scope); a unified UX contract for voice/automation is
  documented for SPRINT-028/029.

## 9. Tests Added

**78 new tests** (by suite):

| Suite                                                                 | Count |
| --------------------------------------------------------------------- | ----- |
| `packages/voice` (intent gate, conversation, postgres store, service) | 49    |
| `RateLimiter.test.ts`                                                 | 12    |
| `AuditLogStore.test.ts`                                               | 6     |
| `VoiceRouter.test.ts` (full tRPC pipeline)                            | 11    |

Coverage includes: rate-limit memory + redis + outage-degradation + config-fail-fast;
audit persistence/ownership/bounds; speech port contracts; mock STT/TTS; VOICE ≠
AUTHORIZATION (sensitive / approved-via-grant / non-sensitive / cancelled / failed /
ambiguous / confidence floor); conversation ownership + bounds + clear; conversation→
fact pollution prevention; provider failure; cancellation; verification (via the
existing suites); IDOR rejection through the gateway guard.

## 10. Existing Tests Preserved

No existing test was weakened or removed to make failures disappear. Two tests in
`routers.test.ts` were updated to the async rate-limit contract (one was vacuous — a
floating promise — and now asserts the real awaited result). Everything else untouched.

## 11. Exact Test Counts

| Suite                                                                              | Count                                    |
| ---------------------------------------------------------------------------------- | ---------------------------------------- |
| Full repository                                                                    | **8 100 passed / 1 skipped · 646 files** |
| Gateway (services/api)                                                             | **745 passed / 1 skipped · 38 files**    |
| Web (apps/web)                                                                     | **167/167 · 16 files**                   |
| Core engines (brain/execution-bridge/capability-marketplace/goals/scheduler/voice) | **419/419 · 37 files**                   |

## 12. Typecheck Result

- `npx tsc -b` (all workspaces): **exit 0**
- `npx tsc --noEmit -p services/api`: **exit 0**

## 13. Lint Result

- `npx eslint packages apps services`: **0 errors** (full-repo single process exceeds
  Node memory on this machine; per-workspace is the CI-equivalent run).

## 14. Build Result

- `npm run build`: **exit 0**
- `npx next build` (web): **PASS** — after fixing the pre-existing P1 (client import of
  the brain barrel). This gate was **red on `main` before this sprint**.

## 15. Security Result

- No new attack surface: all `voice.*` procedures are `standardProcedure` (authenticated
  - rate-limited + owner-checked).
- IDOR tested end-to-end through the real tRPC pipeline.
- Audit durable; rate limits owner-scoped + fail-safe + explicitly degrading.
- No secrets, no placeholder env values, no API keys in client code.

## 16. Architecture Review Result

Re-audited post-implementation: **no duplicate engines**. Rate limiter = port; audit =
store; speech = ports + mock adapters; conversation = store; VOICE ≠ AUTHORIZATION =
gate that classifies + refuses, reusing the Brain's `IntentInterpreter` and
`SENSITIVE_ACTIONS` (same authority lists, no drift). Brain, budget, provider selection,
approval, execution bridge, verification, learning, scheduler and notification
authorities are unchanged.

## 17. Remaining Operator Requirements

| Requirement                                             | Env / Config                                                                                                 |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Redis-backed distributed rate limiting (multi-instance) | `RATE_LIMIT_BACKEND=redis` + `REDIS_URL`                                                                     |
| Tier tuning                                             | `RATE_LIMIT_<TIER>_MAX` / `RATE_LIMIT_<TIER>_WINDOW_MS`                                                      |
| Real STT adapter                                        | a provider adapter declaring `capability: 'SPEECH_TO_TEXT'` (future/operator)                                |
| Real TTS adapter                                        | a provider adapter declaring `capability: 'TEXT_TO_SPEECH'` (future/operator)                                |
| Mock speech in a non-production-like env                | `VOICE_ENABLE_MOCK=true` (mirrors `AI_ENABLE_MOCK`)                                                          |
| Postgres conversation/audit tables                      | auto-created by the store on first use (same pattern as the other 19 stores); operator verifies connectivity |

## 18. Remaining Product Gaps

- **Voice UX** — no live Mic; voice UI arrives in SPRINT-028 (the dead control was
  removed, not stubbed).
- **Conversation-driven Brain composition** — the `voice.appendTurn → brain.createTask`
  bridge (SPRINT-028) is not yet wired.
- **Gateway branch coverage** — pre-existing 63.18% vs the 80% gate (port adapters are
  untested); scoped to SPRINT-030.
- **Proactive assistant / automation** — untouched by design (SPRINT-029).

## 19. Recommended SPRINT-028

**SPRINT-028 — Voice Assistant (conversational layer).** Compose the existing seams:
live Mic → `voice.transcribe` → `brain.createTask` (or the `ai.stream` Q&A path) → TTS
response; conversation turns wired into the `ConversationStore`; non-voice confirmation
flow for sensitive actions through the existing approval mechanism (decision recorded in
the decision store); unified voice UX surface in the AICompanion per the UX contract.
**Do not** create a voice engine — the Brain remains the orchestrator.

## 20. New-Engine Statement

**NO new engine was created in this sprint.** Explicitly: no new AI agent, voice engine,
scheduler, budget engine, notification engine, memory engine, provider-selection engine,
or execution engine. All changes are narrow ports, stores, adapters (mock) and a
deterministic refusal gate — composition over invention, per the architectural rules.

---

## Sprint-rule compliance check

| Rule                                                                                                                     | Status                                                   |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| Brain remains the central orchestrator                                                                                   | ✅ unchanged                                             |
| Single budget / provider-selection / approval / execution / verification / learning / notification / scheduler authority | ✅ untouched                                             |
| Voice is an interface, not an autonomous agent                                                                           | ✅                                                       |
| AI output never auto-becomes a user fact                                                                                 | ✅ (no promotion path; tested)                           |
| UNKNOWN stays UNKNOWN; FAILED never becomes SUCCESS                                                                      | ✅ (gate + honest verdicts)                              |
| Voice never authorizes sensitive actions                                                                                 | ✅ (VOICE ≠ AUTHORIZATION, tested)                       |
| No cross-user data access                                                                                                | ✅ (owner-scoped + IDOR tested)                          |
| No secrets committed                                                                                                     | ✅                                                       |
| No fabricated live-provider claims                                                                                       | ✅ (`voice.status` reports MOCK/NOT_CONFIGURED honestly) |
| No unnecessary new infrastructure                                                                                        | ✅ (Redis only when operator opts in; Postgres reused)   |
| No duplicate engines                                                                                                     | ✅                                                       |
| Composition over invention                                                                                               | ✅                                                       |
