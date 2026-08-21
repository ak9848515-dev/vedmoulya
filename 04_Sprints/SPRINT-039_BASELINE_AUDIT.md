# SPRINT-039 — BASELINE AUDIT

**VedMoulya Founder Evidence Loop** · forensic recon from source · 2026-08-15

## Scope

Forensically map the observation/prospect/evidence estate that SPRINT-039 must
COMPOSE (never duplicate) so the founder's real-world evidence loop lands on the
frozen estate with zero new engines.

## Audited seams (from source)

| Seam                              | File                                                                                         | State at audit                                                                                                                                  |
| --------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Problem representation + evidence | `packages/world-model/src/domain/OpportunityDiscovery.ts`                                    | `BusinessProblem` + `ProblemEvidence`, sanitized, provenance-aware, stable-key idempotent, verified-payment-only revenue ladder — authoritative |
| SPRINT-038 scoring                | same                                                                                         | Three scores (problem/opportunity/experiment), documented weights, UNKNOWN never zero — authoritative                                           |
| Problem lifecycle                 | same                                                                                         | Bounded transitions; no idea→business jump — authoritative                                                                                      |
| Owner-scoped stores               | `packages/world-model/src/contracts/world-ports.ts`                                          | Problems store (in-memory + Postgres `world_problems`, bounded FIFO)                                                                            |
| WorldModelService                 | `packages/world-model/src/application/WorldModelService.ts`                                  | registerProblem/assessProblem/advanceProblem/recordVerifiedPayment/… — the composition seam                                                     |
| Gateway                           | `services/api/src/routers/WorldRouter.ts`                                                    | `world.*` 60+ procedures; auth + rate tier + central IDOR + zod                                                                                 |
| Command Center                    | `apps/web/src/components/CommandCenter.tsx`                                                  | INTELLIGENCE tab radar; no per-opportunity evidence/prospect drill-down yet                                                                     |
| Voice command center              | `packages/voice/src/domain/CommandCenterQuestionRouter.ts` + `CommandCenterPresentationPort` | read-only presentation; VOICE ≠ AUTHORIZATION established                                                                                       |
| Evidence calibration seam         | `packages/world-model/src/benchmark/CalibrationScenarios.ts`                                 | SPRINT-035 `FEEDBACK_DELTA_MAX` 0.05 discipline — the calibration bound to mirror                                                               |
| Persistence bundle                | `services/api/src/infrastructure/PersistenceStores.ts`                                       | shared WriteThroughDocumentStore wiring for all world stores                                                                                    |

## Findings

1. **No observation ledger exists** — the world graph `observe`/`link` records
   typed graph facts, but there is no bounded founder-observation record with
   explicit evidence states and mandatory provenance. GAP.
2. **No prospect ledger exists** — `recordCustomerSignal` records a signal on a
   problem, but there is no evidence-oriented per-prospect discovery record with
   a bounded status chain (discovery ≠ validation). GAP.
3. **Evidence quality is implicit** — problem confidence is derived at
   registration/assessment; there is no deterministic multi-dimension evidence
   quality view over observations + prospects + verified evidence. GAP.
4. **Calibration exists only for SPRINT-035 outcome feedback** — the bounded-Δ
   discipline (0.05) exists; founder-observation → factor calibration does not.
   COMPOSE the discipline, do not re-invent it.
5. **Next best action is advisory but hard-coded to lifecycle** — a richer
   evidence-quality + revenue-state + conversation-count driven NEXT BEST ACTION
   (incl. STOP) is missing. GAP.
6. **Comparison is score-driven** — `opportunityPipeline` ranks by score; an
   evidence-state comparison (STRONG_EVIDENCE/PROMISING/INSUFFICIENT_EVIDENCE/
   NEEDS_CUSTOMER_VALIDATION/STOP/UNKNOWN) is missing. GAP.
7. **Drill-down is thin** — Command Center shows radar counts; per-opportunity
   evidence/prospect/experiment/provider/decision drill-down is missing. GAP.
8. **Security posture confirmed** — central IDOR guard, owner-scoped stores,
   sanitization at the boundary, no new approval/spend/execute surface on
   problems (structural). Keep it.

## Verdict

**COMPOSITION SPRINT** — every gap above is filled by adding typed records +
deterministic domain functions over the existing stores and read models.
Nothing requires a new engine, a new authority, or a new runtime path.
