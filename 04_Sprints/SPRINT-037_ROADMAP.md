# SPRINT-037 — Live Orchestration & Real-World Execution Proof — ROADMAP

**Project:** VedMoulya · **Date:** 2026-08-15 · **Baseline:** SPRINT-026…036 complete
**Type:** Composition + activation sprint · **NEW ENGINES CREATED: 0**

## Mission

Prove the first complete real-world execution loop — **CONFIGURE → PLAN → APPROVE → EXECUTE → VERIFY → MEASURE → RECORD OUTCOME** — through the EXISTING authorities. SPRINT-036 established the multi-provider orchestration representation; SPRINT-037 connects an APPROVED `OrchestrationPlan` to the EXISTING `ExecutionRunService`, and provides the operator test that runs it against a real provider when genuinely configured.

## Capability → authority gap matrix

| CAPABILITY               | EXISTING AUTHORITY                                     | CURRENT STATE (pre-SPRINT-037)                      | SPRINT-037 CHANGE                                                                                                   | RISK                                             |
| ------------------------ | ------------------------------------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Multi-provider plan      | `MultiProviderOrchestrator` (world-model, SPRINT-036)  | Planned representation; `executed:false` structural | — (unchanged)                                                                                                       | none                                             |
| Approval                 | Brain (`WorldApprovalPort`)                            | Blueprint approvals route through Brain             | `world.approveOrchestrationPlan` routes orchestration plans through the SAME Brain authority                        | none (same authority)                            |
| Execution                | `ExecutionRunService` + `StepExecutionPort` (EPIC-014) | Consumes capability-marketplace plans only          | Orchestration-aware plan source adapts an APPROVED orchestration plan into the bridge plan shape — ONE runtime path | low (structural gate: only APPROVED plans adapt) |
| Command Center lifecycle | `world.commandCenter` read model                       | No orchestration plans surfaced                     | `automation.orchestrationPlans` with honest status/approval state                                                   | none                                             |
| Live provider proof      | `scripts/ai-live-smoke.ts` pattern                     | Runtime smoke exists; no workflow-level loop        | `npm run integration:provider` — the full plan→approve→execute→verify loop with a real provider, strictly gated     | operator-required (needs a real key)             |

## Delivery steps

1. Forensic baseline (source of truth) → `SPRINT-037_BASELINE_AUDIT.md`.
2. World-model seam: `getOrchestrationPlan` + `approveOrchestrationPlan` (Brain-gated, `executed:false` structural).
3. Gateway `OrchestrationPlanSource`: APPROVED-only adaptation into `FactoryCapabilityPlan`; closed capability vocabulary.
4. Procedures `world.approveOrchestrationPlan` + `world.startOrchestrationPlan` (auth + rate + IDOR + zod).
5. Command Center AUTOMATION surfaces orchestration plans.
6. `integration:provider` operator test — fails clearly without credentials, strict limits, never fake adapters.
7. Hermetic tests + full verification (suites, typecheck, lint, build, benchmarks, coverage, production-config-check).
8. 11 docs + 7 canonical doc syncs.
