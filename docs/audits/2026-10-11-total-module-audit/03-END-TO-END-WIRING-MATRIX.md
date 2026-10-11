# End-to-End Wiring Matrix

Trace of the production path, source-verified. Runtime evidence column records
only fresh evidence gathered in **this** pass; historical artifacts are labelled
as such. Ownership rule preserved: **Mission owns the autonomous lifecycle; Brain
supplies reusable intelligence.** No second autonomous lifecycle is introduced.

| #   | Transition                       | Caller → Callee                                               | Data contract                                   | Error handling                         | Authorization                           | Persistence                                                        | Test coverage                     | Runtime evidence (this pass)                                 |
| --- | -------------------------------- | ------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------- | --------------------------------------- | ------------------------------------------------------------------ | --------------------------------- | ------------------------------------------------------------ |
| 1   | USER GOAL → IDENTITY/CONTEXT     | Next.js route → tRPC → `IdentityRouter` → `services/identity` | `TRPCContext {userId,email,role}`               | tRPC error middleware                  | JWT + ownership guard                   | Postgres identity repos                                            | 33 test files                     | Unit-level only (not re-run live)                            |
| 2   | IDENTITY → MISSION               | `MissionRouter` → `MissionService` → `MissionRuntime`         | Mission DTO                                     | Typed errors; lazy construction        | owner-scoped by `userId`                | Durable Postgres mission store when configured; in-memory dev/test | `mission-runtime` 22 files        | 90-file focused run: **PASS (exit 0)**                       |
| 3   | MISSION → BRAIN/PLANNING         | `MissionRuntime` → `BrainApplicationService` → `planning`     | plan/step contract                              | Bounded; deterministic fallback        | inherits mission owner                  | outcome memory                                                     | `brain` 9 + `planning` 8          | Focused run: **PASS**                                        |
| 4   | PLANNING → PROVIDER SELECTION    | `AIOrchestrationService.selectProvider`                       | `ProviderAdapter` + `ProviderStatus`            | fail-closed; typed `MODEL_NOT_FOUND`   | platform key or owner-scoped credential | CostLedger                                                         | `providers` 18, `orchestrator` 11 | Focused run: **PASS**                                        |
| 5   | PROVIDER → GOVERNED EXECUTION    | `agent-execution` engine                                      | tool allowlist/schema/timeout/rate-limit/audit  | per-step tool allowlist; path jail     | IDOR guard on `userId`                  | audit trail                                                        | `agent-execution` 10              | Focused run: **PASS**                                        |
| 6   | EXECUTION → VERIFICATION         | verification step → `agent_execution_verification`            | verified/unverified result                      | independent verification pass          | mission owner                           | verification record                                                | Included in focused run           | Historically proven (local Ollama run); not re-run live here |
| 7   | VERIFICATION → PERSISTENCE       | repositories                                                  | read-back equality                              | fail-closed on mismatch                | owner-scoped                            | Postgres / in-memory                                               | repo tests                        | Not re-run live                                              |
| 8   | PERSISTENCE → MEMORY/LEARNING    | `execution-memory`, `learning-intelligence`                   | outcome memory record                           | bounded                                | owner-scoped                            | durable outcome memory                                             | package tests                     | Not re-run live                                              |
| 9   | MEMORY → RESULT SCREEN           | Next.js missions route → tRPC                                 | mission status DTO                              | loading/error/empty states             | owner-scoped                            | —                                                                  | 48 page tests                     | Source-verified; no fresh browser run                        |
| 10  | RESULT → HUMAN APPROVAL/DELIVERY | `opportunityProposal` port                                    | draft `{pendingApproval:true, submitted:false}` | preparation-only; **no submit method** | owner-scoped                            | draft store                                                        | service tests                     | Historically proven; not re-run live                         |

## Composition roots

- **API gateway:** `services/api/src/router.ts` → lazy `getServices()` /
  `getAppRouter()`; `ApiApplicationService` wires every engine at first request
  (inert at module scope so `next build` can bundle without env). 49 routers via
  `RouterRegistry.createAppRouter`.
- **Web → API:** `apps/web/src/app/api/trpc/[trpc]/route.ts`; client via
  `apps/web/src/lib/api-client.ts`.
- **Provider composition:** `services/orchestrator/src/index.ts`
  `registerPlatformProviders` registers OpenAI/Vercel / DeepSeek / Google /
  OpenRouter / Ollama / custom, gated by resolved keys; mock only when
  `AI_ENABLE_MOCK=true` (non-production) or explicit production opt-in.

## Structural observations

- Every mission step reaches providers through the single canonical
  `AIOrchestrationService` — **except** that `ApiApplicationService.ts:2799`
  additionally constructs the orchestration-fabric with `enableProviderRouting: true`
  and mounts `OrchestrationFabricRouter`. This is the deferred **G-17** seam and
  the only place a second routing authority is advertised (see D-05).
- Approval/delivery is genuinely draft-only by construction (the proposal port has
  no submission method), so step 10 cannot emit an external action.
