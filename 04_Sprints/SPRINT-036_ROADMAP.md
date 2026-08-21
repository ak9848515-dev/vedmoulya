# SPRINT-036 — PRODUCTION MULTI-PROVIDER ORCHESTRATION · ROADMAP

**VedMoulya** · 2026-08-15 · composition sprint · **NEW ENGINES CREATED: 0**

## Mission

Move VedMoulya from _"multi-provider orchestration architecture exists"_ to
_"VedMoulya can safely and measurably plan bounded real workflows using multiple
AI providers/capabilities"_ — SAFE · DYNAMIC · COST-AWARE · PRIVACY-AWARE ·
CAPABILITY-AWARE · VERIFIABLE · FAILURE-TOLERANT · AUDITABLE · BOUNDED.

Not a provider-count sprint. Capability coverage, not provider count.

## Absolute rule

NO new engine: no AI Provider Engine, Agent Engine, Model Router Engine,
Workflow Engine, Cost Engine, Verification Engine, Memory Engine. The Brain,
Intelligence Fabric, Provider Registry, Proactive Intelligence, World Model,
WorkflowFactory, WorkflowExecutionBlueprint, ActionClassPolicy, AutonomyPolicy,
Approval, Execution Bridge, CostLedger, RunBudgetGuard, CostPolicyGuard,
Memory, Verification, Voice, Scheduler, Notification and Audit remain frozen
and authoritative.

## Baseline audit (from source)

| Capability                                          | Existing authority                                                 | SPRINT-036 change                                                             | Risk |
| --------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ---- |
| Bounded decomposition                               | `WorkflowFactory.decompose` + fabric `WorkflowBounds`              | reused as-is                                                                  | none |
| Advisory provider selection                         | fabric `selectStrategy` (CHEAP/FAST/QUALITY/PRIVATE/BALANCED)      | reused as-is                                                                  | none |
| Provider health                                     | fabric `ProviderHealthLedger` (UNKNOWN until observed)             | reused + honest mapping to plan states                                        | none |
| Cost accounting                                     | CostLedger / CostPolicyGuard / RunBudgetGuard                      | reused (measure-only via `WorldCostPort`; cost bounds via `validateWorkflow`) | none |
| Per-step action classes                             | `ActionClassPolicy` (A/B/C/D)                                      | reused as-is                                                                  | none |
| Verification                                        | fabric `VerificationChainPolicy` + execution bridge `StepVerifier` | reused (disagreement → NEEDS_REVIEW)                                          | none |
| Result normalization                                | fabric `ResultNormalizer`                                          | reused at execution time                                                      | none |
| Execution                                           | `ExecutionRunService` (execution bridge)                           | remains the ONLY runtime path                                                 | none |
| Approval                                            | Brain `approve`/`reject`                                           | remains the ONLY authority                                                    | none |
| **Per-step provider binding + WHY + expected cost** | — (missing)                                                        | **`MultiProviderOrchestrator`** (composition seam)                            | low  |
| **Bounded retry/fallback policy**                   | — (missing)                                                        | **`decideRetryPolicy`** (deterministic table)                                 | low  |
| **Orchestration benchmark**                         | — (missing)                                                        | **`ProviderOrchestrationScenarios`** + `provider:benchmark`                   | low  |

## Deliverables

1. `MultiProviderOrchestrator` — bounded orchestration plan seam (world-model).
2. `decideRetryPolicy` — deterministic RETRY/FALLBACK/STOP/NEEDS_REVIEW table.
3. Orchestration-plan store family (in-memory + Postgres, stable-key idempotent).
4. Deterministic provider fixtures + scenario engine (11 verification points).
5. `provider:benchmark` harness (18th in the `npm run benchmarks` chain).
6. Gateway `world.orchestratePlan` + `world.listOrchestrationPlans`.
7. 12 sprint docs + 7 canonical docs synced.

## Acceptance gates

- NEW ENGINES CREATED = 0
- full suite green · typecheck 0 · lint 0 · `next build` PASS · benchmarks chain green
- coverage gate 45/45 (world-model 92.49 stmts / 82.72 branches; api 80.32 branches)

## Out of scope (unchanged)

Autonomy levels are NOT increased. No live-provider integration is claimed —
live providers remain OPERATOR-REQUIRED. The plan is a REPRESENTATION
(`executed:false` structural); the runtime path remains the execution bridge.
