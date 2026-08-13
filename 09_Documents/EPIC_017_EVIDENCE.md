# EPIC-017 — VedMoulya Live Intelligence Bridge: Evidence

**Status:** IMPLEMENTED + DETERMINISTICALLY VERIFIED (2026-08-11)

This document records the verification evidence for the Live Intelligence Bridge.
All tests are deterministic and hermetic (no live AI, no network, no secrets).
Live/external verification is explicitly marked OPERATOR REQUIRED where
credentials or external services are unavailable.

---

## 1. Implementation surface

### New workspace — `@vedmoulya/live-intelligence-bridge`

- `src/types/bridge-types.ts` — 16 BridgeStage values, 18 BridgeLoopStatus values,
  9 AcquisitionClass values, 12 BridgeNotificationKind values, and the structured
  view models (`BridgeCandidate`, `BridgeComparison`, `BridgeRecommendation`,
  `BridgeApproval`, `BridgeExecutionHandoff`, `BridgeOutcomeEvaluation`,
  `BridgePerformanceFact`, `BridgeNotificationEvent`, `BridgeLoopRun`).
- `src/contracts/bridge-ports.ts` — 7 bridge ports + re-exported
  `BrainCandidatePort` / `BrainPreferencePort` (single source seam).
- `src/domain/` — AcquisitionClassifier, BridgeCandidateAssembler,
  BridgeComparisonBuilder, BridgeRecommendationBuilder, BridgeApprovalPolicy,
  BridgeOutcomeEvaluator, BridgePreferenceFeedback, BridgeNotificationMapper.
- `src/infrastructure/InMemoryBridgeLoopStore.ts` — owner-scoped bounded store.
- `src/application/LiveIntelligenceBridgeService.ts` — the orchestrator
  (`start · discover · compare · recommend · approve · reject · handOff ·
verify · evaluateAndLearn · get · list · performanceProfile ·
emitNotification`).
- `src/__tests__/` — 45 deterministic tests (2 files).

### Gateway — `services/api`

- `src/routers/LiveIntelligenceBridgeRouter.ts` — `liveIntelligence.*` namespace
  (start/discover/compare/recommend/approve/reject/handOff/verify/
  evaluateAndLearn/get/list/emitNotification) with auth + rate limits + zod.
- `src/infrastructure/LiveIntelligenceBridgePorts.ts` — deterministic facades
  over the real services + AI World emission mapping.
- `src/services/ApiApplicationService.ts` + `RouterRegistry.ts` — wiring.
- `src/__tests__/LiveIntelligenceBridgeRouter.test.ts` — 7/7 through the real
  tRPC pipeline (incl. cross-user IDOR refusal).

### Web — `apps/web`

- `/live-intelligence` page + `bridge-panels.tsx` + `bridge-ui.ts`.
- api-client hooks (`useLiveIntelligence*`), nav entry ("Live Intelligence").
- Real Chrome journey `e2e/live-intelligence-bridge.spec.ts`.

### Benchmark — `scripts/live-intelligence-bridge-benchmark.ts`

- Wired as `npm run bridge:benchmark`, included in the `benchmarks` chain,
  the CI `benchmarks` job, and the release validation step.

## 2. Test counts (live runs, 2026-08-11)

| Suite                   | Command                                                  | Result                 |
| ----------------------- | -------------------------------------------------------- | ---------------------- |
| Bridge package          | `cd packages/live-intelligence-bridge && npx vitest run` | **45/45**              |
| Gateway full suite      | `cd services/api && npx vitest run`                      | **660/660** (31 files) |
| Bridge router (gateway) | `LiveIntelligenceBridgeRouter.test.ts`                   | **7/7**                |
| Web full suite          | `cd apps/web && npx vitest run`                          | **159/159** (15 files) |
| Bridge benchmark        | `npm run bridge:benchmark`                               | **10/10 PASS**         |
| Brain benchmark         | `npm run brain:benchmark`                                | 12/12 PASS (unchanged) |
| Intelligence benchmark  | `npm run intelligence:benchmark`                         | 12/12 PASS (unchanged) |
| Execution benchmark     | `npm run execution:benchmark`                            | 8/8 PASS (unchanged)   |
| Quality gates           | `npm run quality:gates:verify`                           | 16/16 PASS (unchanged) |
| E2E — Bridge journey    | `live-intelligence-bridge.spec.ts` (real Chrome)         | **PASS (1.4m)**        |
| E2E — Brain journey     | `brain.spec.ts` (real Chrome)                            | PASS (unchanged)       |
| E2E — Execution journey | `execution-journey.spec.ts` (real Chrome)                | PASS (unchanged)       |

Typecheck: `tsc -b` (root) 0 · `services/api` 0 · `apps/web` 0 ·
`packages/live-intelligence-bridge` 0. ESLint: full repository **0 errors /
0 warnings**.

## 3. Benchmark scenarios (10/10 PASS)

| #   | Scenario                                                                                                           | Verdict |
| --- | ------------------------------------------------------------------------------------------------------------------ | ------- |
| 1   | Full loop (accept) → COMPLETED with recommendation + approval + performance + preference event + AI World emission | ✅      |
| 2   | Decline is never task failure (outcome.userApproval=REJECTED, loop completes)                                      | ✅      |
| 3   | Paid capability gated behind approval (AWAITING_APPROVAL · REQUIRED · PAID)                                        | ✅      |
| 4   | GitHub candidate stays untrusted (GITHUB_PROJECT · SECURITY_REVIEW_REQUIRED · approvalRequired)                    | ✅      |
| 5   | Quality-first comparison (96 > 70, evidence-backed, material improvement, structured why)                          | ✅      |
| 6   | Free/local fallback honesty (unavailable local model never invented)                                               | ✅      |
| 7   | Execution failure is honest (simulated start failure → handoff failure, no fabricated result)                      | ✅      |
| 8   | Notification relevance gating (low relevance dropped, high relevance emitted)                                      | ✅      |
| 9   | Owner scoping / IDOR (foreign get → NOT_FOUND, foreign list → 0, owner list → 1)                                   | ✅      |
| 10  | Short objective rejected (INVALID_INPUT before any work)                                                           | ✅      |

## 4. E2E journey evidence (real Chrome)

`live-intelligence-bridge.spec.ts`:

1. User enters the Bridge at `/live-intelligence`.
2. Creates a meaningful task (Blog post example).
3. The Bridge understands it through the real `liveIntelligence.start` gateway.
4. Identifies required capabilities (RESEARCH, TEXT_GENERATION, …).
5. Discovers capability candidates with evidence
   ("Evidence: Registry provider OpenAI supports the required AI features …").
6. Compares current vs better for each capability (structured reasons).
7. When the environment evidences a materially better option, the recommendation
   pauses for explicit approval; when it does not, the honest
   "No materially better option requires activation" state is asserted —
   nothing is fabricated.
8. Hand-off to execution via the real gateway.
9. Honest terminal state (outcome evaluation when completed, or hand-off card at
   a configure/manual boundary) — never fabricated success.
10. Task-specific performance feedback recorded when completed.
11. Recent Bridge loops history reflects the run.
12. Zero page-level JS errors.

## 5. Security evidence (see SECURITY_MODEL for details)

- IDOR refusal verified in gateway router tests + benchmark scenario 9.
- GitHub candidates: `SECURITY_REVIEW_REQUIRED`, approval always required.
- External applications: never assumed executable (hand-off boundary).
- No secrets in any output; e2e asserts no console errors.
- Fail-closed execution: budget exhaustion and validation failure block (frozen
  EPIC-014 guards reused, benchmark scenario 7).

## 6. Operator-required / not-yet-live

| Item                                  | Status                                                      |
| ------------------------------------- | ----------------------------------------------------------- |
| Deterministic loop (all above)        | IMPLEMENTED + VERIFIED                                      |
| Live provider execution               | OPERATOR REQUIRED (no credentials on this machine)          |
| Live GitHub OAuth exchange            | OPERATOR REQUIRED                                           |
| Live ecosystem discovery              | OPERATOR REQUIRED (static catalog default)                  |
| Real repository acquisition / sandbox | OPERATOR REQUIRED (EPIC-015 pipeline)                       |
| Postgres-backed loop store            | OPERATOR REQUIRED (in-memory store is the hermetic default) |

No fabricated live-provider/GitHub claims are made anywhere.
