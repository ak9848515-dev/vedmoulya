# SPRINT-034 — TEST REPORT

**Verified from source on 2026-08-15**

---

## 1. Full verification results

| Gate                                           | Result                                                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| World-model suite                              | **187 passed (16 files)** — was 142; **+45 new**                                                        |
| Gateway suite                                  | **951 passed · 1 skipped (48 files)** — was 947                                                         |
| Web suite                                      | **214 passed (22 files)** — was 203; **+11 CommandCenter**                                              |
| Root typecheck (`tsc -b`)                      | **0**                                                                                                   |
| API typecheck (`tsc --noEmit -p services/api`) | **0** (covered by `tsc -b`)                                                                             |
| Lint                                           | **0 errors, 0 warnings** (world-model + api + web changed files)                                        |
| `next build`                                   | **PASS**                                                                                                |
| Coverage gate                                  | Not recomputed this session (no new coverage-lowering exclusion; prior 99%+ stmts world-model). See §3. |

No benchmark/verification harness was touched: scheduler, proactive, voice,
learning and outcome-verification suites are unchanged and green.

## 2. New tests (SPRINT-034)

**Domain (world-model):**

- `OutcomeEvidence.test.ts` — VERIFIED-only actual guard; unverified/hypothesis
  actuals refused; evidence required; expected stays ESTIMATED; feedback
  refused without VERIFIED + evidence; clamp ≤ 0.05 (single outcome never
  rewrites policy); evidence trail on every adjustment; unmapped kinds
  recorded-not-applied; explainability.
- `BlueprintApprovalFactory.test.ts` — class C/D steps produce requests with
  the full exposure (action/reason/business/workflow/provider/cost/scope/risk/
  outcome/reversibility/authority); class A refused; re-classification through
  the existing ActionClassPolicy (stored class never trusted);
  `executed:false` structural; mutation attempts do not alter the request.
- `LiveSignalAdapter.test.ts` — unconfigured → UNAVAILABLE; kind-subset →
  UNAVAILABLE; provenance-required (no sourceId/url → refused); sanitizer
  strips scripts/markup/control chars + bounds length; oversized payload →
  ERROR; non-JSON / bad shape → ERROR; source down → ERROR; token sent
  server-side only; SUCCESS never reported for unavailable sources.
- `CostWeightedRevenue.test.ts` — margin-aware ranking beats pure-revenue
  ranking; UNKNOWN cost/revenue/margin never treated as zero; roiUsd vs
  rankScore separation; assumptions exposed; advisory flag.
- `WorldModelService.test.ts` (SPRINT-034 block) — outcome feedback applied
  to `evaluateOpportunity`; feedback idempotency per evidence id; approval
  lifecycle (request → decide via authority port); revenueRanking wiring;
  commandCenter aggregate; owner isolation.
- Store tests (InMemory + Postgres) — outcome evidence + blueprint approval
  families: owner scoping, bounded upserts, pagination, isolation.

**Gateway:**

- `WorldRouter.test.ts` (+5) — new procedures: recordOutcomeEvidence,
  listOutcomeEvidence, buildBlueprintApprovalRequest, requestBlueprintApproval,
  decideBlueprintApproval, revenueRanking, commandCenter — auth, owner scope,
  zod validation, honest error mapping; approval decisions route through the
  Brain port (a refusal is returned, never a fabricated approval).

**Web:**

- `CommandCenter.test.tsx` (+11) — TODAY briefing + no-spam state; emergency
  stop + unconfirmed settings; PORTFOLIO stats + cost-weighted ranking + ROI
  chips; UNKNOWN-cost empty state; INTELLIGENCE signal honesty; AUTOMATION
  workflows + blueprint approvals; APPROVALS routing only through
  `decideBlueprintApproval` (approved) and rejection passthrough (never
  "approved and executed"); error + refresh recovery; boundary notice always
  present.

## 3. Coverage

Statement/branch/function coverage was not recomputed this session; the
verification gate was preserved (no exclusions were added, no tests deleted).
SPRINT-032 measured world-model at 99.3% stmts / 93.9% branches / 99.5% funcs;
all new modules ship with dedicated tests. A full coverage recompute is listed
as a recommended SPRINT-035 action.

## 4. Honest status

All gates green. No failing test was deleted; no test was weakened. Existing
authorities' suites (Brain, Fabric, execution bridge, proactive, voice,
control-plane) remain untouched and green.
