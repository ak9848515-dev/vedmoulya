# SPRINT-033 — REVENUE MODEL

**VedMoulya — revenue intelligence (Part F)**

---

## 1. What exists before

SPRINT-032's `BusinessUnit` carried `revenue: string[]` and `costs: string[]`
as **descriptors** only — there was no typed, evidence-carrying revenue model.
SPRINT-033 adds `RevenueIntelligence` in `packages/world-model` (Part F). It is
a REPRESENTATION model — it never spends, commits or fabricates.

## 2. Revenue streams

A `RevenueStream` is owner-scoped, optionally linked to a `businessUnitId`
(stable-key idempotent — same name upserts, never duplicates; bounded 25 per
owner):

| Field                                                | Kind            |
| ---------------------------------------------------- | --------------- |
| estimatedMonthlyRevenueUsd / actualMonthlyRevenueUsd | `RevenueFigure` |
| estimatedMonthlyCostUsd / actualMonthlyCostUsd       | `RevenueFigure` |
| automationPercentage (0..1)                          | `RevenueFigure` |
| humanEffortHoursMonthly                              | `RevenueFigure` |
| customerCount / conversionRate / retentionRate       | `RevenueFigure` |

A `RevenueFigure` is `{ value, status: VERIFIED | ESTIMATED, evidence }`.
**Honesty rules (tested):**

- A figure WITHOUT evidence is REFUSED (`NO_EVIDENCE`).
- An UNKNOWN figure is refused — leave the field unset instead.
- Percentages are clamped 0..1.
- Stream kinds: SERVICE · PRODUCT · SUBSCRIPTION · PROJECT · AFFILIATE ·
  ADVERTISING · LICENSING · OTHER.

## 3. Advisory snapshot (`revenueSnapshot`)

Totals are computed ONLY from evidence-backed figures across ACTIVE streams:

- `totalEstimatedMonthlyRevenueUsd` / `totalActualMonthlyRevenueUsd` /
  `totalEstimatedMonthlyCostUsd` / `totalActualMonthlyCostUsd`
- `estimatedMargin` / `actualMargin` — (revenue − cost) / revenue, ONLY when
  BOTH revenue and cost have evidence
- `averageAutomationPercentage` — over evidence-backed streams
- `totalHumanEffortHoursMonthly`
- per-stream margins + figures

`advisory:true` — the snapshot is never a promise.

## 4. Decision hints (`revenueDecisions`)

For each stream, an **advisory** BUILD / BUY / AUTOMATE / OUTSOURCE / STOP /
SCALE hint with reasons. Deterministic, evidence-derived:

| Evidence                       | Hint                           |
| ------------------------------ | ------------------------------ |
| no revenue/cost evidence       | **UNKNOWN** (honest default)   |
| cost ≥ revenue                 | **STOP** (restructure or stop) |
| revenue > 0 + automation ≥ 70% | **SCALE** (leverage)           |
| revenue > 0 + automation < 50% | **AUTOMATE**                   |
| anything else                  | **UNKNOWN**                    |

The system helps the founder decide — it never decides alone. No automatic
business launch; the founder decides.

## 5. ROI, conversion, retention

`conversionRate`/`retentionRate` are carried as evidence figures on each
stream; ROI is represented through margins + decision hints (a full ROI ledger
is FUTURE — no fabricated ROI).

## 6. Where it lives

- `packages/world-model/src/domain/RevenueIntelligence.ts` — model.
- `packages/world-model/src/types/world-types.ts` — types.
- Stores: in-memory + Postgres (`world_revenue_streams`) in the shared
  persistence bundle (owner-scoped, bounded, never secrets).
- `WorldModelService` — register/list/remove/snapshot/decide.
- Gateway `world.registerRevenueStream` / `listRevenueStreams` /
  `removeRevenueStream` / `revenueSnapshot` / `revenueDecisions` (auth + rate
  tier + IDOR + zod).
- WorldPanel — revenue snapshot card (evidence-only wording).
