# SPRINT-035 — BASELINE AUDIT

**VedMoulya Production Hardening, Calibration & Founder Command Center Completion**
**Date:** 2026-08-15 · **Verified from source** (source code is the ultimate source of truth)

## Purpose

Reconcile the SPRINT-034 verified state before hardening. Every row below maps an
existing capability to its implementation, its test evidence, its known limitation
and the SPRINT-035 action. **No working architecture is redesigned.**

---

## Capability Audit

| #   | Existing capability                          | Current implementation                                                                                                                                                                                                                                      | Tests                                               | Known limitation                                                               | SPRINT-035 action                                                                                                          |
| --- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| 1   | Founder Command Center                       | `apps/web/src/components/CommandCenter.tsx` — 5 tabs (TODAY / PORTFOLIO / INTELLIGENCE / AUTOMATION / APPROVALS) composed over `world.commandCenter` + `world.revenueRanking` + `world.listRevenueStreams` + `world.opportunityPipeline` + `world.timeline` | `CommandCenter.test.tsx` (13)                       | Flat lists only — no drill-down, no timeline, no cost view                     | Expandable drill-downs per section; bounded timeline; cost evidence view                                                   |
| 2   | OutcomeEvidence (revenue → outcome feedback) | `packages/world-model/src/domain/OutcomeEvidence.ts` — VERIFIED-only actuals; Δ ≤ 0.05 clamp; evidence trail                                                                                                                                                | `OutcomeEvidence.test.ts` + service tests           | Calibration of the feedback boundary never measured end-to-end                 | Deterministic calibration benchmark (13 scenarios) proving the 8 calibration contracts                                     |
| 3   | CostWeightedRevenue                          | `packages/world-model/src/domain/CostWeightedRevenue.ts` — margin/ROI-aware ranking, UNKNOWN never 0                                                                                                                                                        | `CostWeightedRevenue.test.ts` + router tests        | Cost view not surfaced in UI; cost evidence not displayed per stream           | Cost visualization in Command Center (OBSERVED / ESTIMATED / UNKNOWN labels)                                               |
| 4   | BlueprintApprovalFactory                     | `packages/world-model/src/domain/BlueprintApprovalFactory.ts` — requests for C/D-gated steps only; `executed:false` structural; decisions via Brain authority                                                                                               | `BlueprintApprovalFactory.test.ts` + router tests   | Approval request detail not exposed in the Command Center APPROVALS drill-down | Approval drill-down (action/reason/business/workflow/step/provider/cost/risk/scope/outcome/reversibility/authority/status) |
| 5   | LiveSignalAdapter                            | `packages/world-model/src/infrastructure/LiveSignalAdapter.ts` — operator env-config, provenance-required, sanitized, bounded, honest AVAILABLE/UNAVAILABLE/ERROR                                                                                           | `LiveSignalAdapter.test.ts` (13)                    | No health metadata; operator runbook absent                                    | Per-kind health (lastSuccess/lastError), signal operator runbook                                                           |
| 6   | Voice Assistant                              | `packages/voice` — `VoiceAssistantService` + `VoiceIntentGate`; VOICE ≠ AUTHORIZATION enforced                                                                                                                                                              | `VoiceAssistantService.test.ts` (29) + router tests | Cannot present Command Center information                                      | Read-only `CommandCenterQuestionRouter` + presentation port; presentation only — no authorization                          |
| 7   | World Model                                  | `packages/world-model` — `WorldModelService` + 21 stores + graph + business units + workforce + workflow factory                                                                                                                                            | 200 tests                                           | No bounded cross-entity timeline                                               | `timeline()` composing existing stores (no new event store)                                                                |
| 8   | Signal health                                | Adapter-internal fetch only                                                                                                                                                                                                                                 | —                                                   | No honest per-source health exposed                                            | `signalHealth()` per-kind + gateway `world.signalHealth`                                                                   |
| 9   | Production config                            | Env surface in `.env.example`                                                                                                                                                                                                                               | —                                                   | No operator checklist                                                          | `scripts/production-config-check.ts` (CONFIGURED / NOT_CONFIGURED / OPTIONAL / OPERATOR_REQUIRED)                          |
| 10  | Coverage                                     | Per-workspace 80% gate (`scripts/coverage-gate.mjs`)                                                                                                                                                                                                        | 45/45 workspaces                                    | SPRINT-034 did not recompute; api branch below gate                            | Full recompute; new `WorldBridgePorts.test.ts` (34) restored api branch to 80.32%                                          |
| 11  | Data integrity                               | Stable-key upserts across stores; bounded FIFO; owner scoping                                                                                                                                                                                               | store + service tests                               | Duplicate/prevention across new timeline not proven                            | Timeline idempotency + owner-isolation tests                                                                               |
| 12  | Security                                     | Existing authorities: Brain (approval), ActionClassPolicy, AutonomyPolicy, CostLedger, execution bridge                                                                                                                                                     | security suites                                     | No cross-business timeline access test                                         | Timeline owner-isolation; malicious signal/evidence regression                                                             |

---

## Verified Source Facts (2026-08-15)

- `WorldBridgePorts.ts` implements the ONLY seams to Brain/control-plane/fabric/proactive/cost — previously **untested** (2.1% branch). SPRINT-035 adds `WorldBridgePorts.test.ts` covering every factory (34 tests).
- `services/api` branch coverage was **76.7%** before the new tests — below the 80% gate. After: **80.32%**.
- The `react-hooks/exhaustive-deps` disable comment in the Command Center referenced an unregistered rule — removed; drill-down state refactored from `Record<string, boolean>` to `ReadonlySet<string>` to eliminate 4 object-injection warnings (lint 0/0 restored).
- Signals are **read-through** (never stored) — duplicate-signal dedup is N/A by design; duplicate outcome/approval/revenue/timeline are all covered by stable-key idempotency tests.

## SPRINT-035 Scope (accepted)

1. Full coverage recompute (statements / branches / functions / lines) across the estate.
2. Command Center drill-downs (TODAY / PORTFOLIO / INTELLIGENCE / AUTOMATION / APPROVALS).
3. Bounded owner-scoped timeline composed from existing stores.
4. Cost view over CostLedger with OBSERVED / ESTIMATED / UNKNOWN discipline.
5. Outcome/score calibration benchmark (deterministic, 13 scenarios, safety boundary intact).
6. Voice presentation of Command Center read models (VOICE ≠ AUTHORIZATION preserved).
7. Signal operator runbook + signal health.
8. Production configuration check.
9. Security regression + data integrity tests.
10. Documentation synchronization (12 SPRINT-035 docs + 7 canonical docs).

## Out of scope (unchanged)

- No new engines (Company/Founder/Revenue/Calibration/Signal/Voice/Analytics/Dashboard/Agent/Knowledge-Graph/Workflow).
- Existing authorities remain frozen and authoritative: Brain · Intelligence Fabric · ActionClassPolicy · AutonomyPolicy · Execution Bridge · CostLedger · Memory · Verification · Scheduler · Notification · Voice · World Model.
- No silent assumption of production infrastructure — everything not configured stays OPERATOR_REQUIRED.
