# SPRINT-035 — COST INTELLIGENCE

**Measured economics over the existing CostLedger — UNKNOWN never zero**
**Date:** 2026-08-15 · **Measure-only — no new budget/cost engine**

## Sources of truth

- **CostLedger** (authoritative accounting — aggregates the trace spine by owner).
- **WorldCostPort** (`services/api/src/infrastructure/WorldBridgePorts.ts`) — the ONLY
  cost seam from the world layer to the ledger. Measure-only: it READS measured cost,
  never writes accounting.
- **CostWeightedRevenue** (domain) — margin/ROI-aware ranking over revenue streams +
  cost evidence.

## What is exposed

| Metric                                | Where                                                               | Evidence basis                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Total observed cost (owner aggregate) | `commandCenter.portfolio.costDailyUsd` / `costProviderUsd`          | CostLedger trace aggregate (`cost-ledger:owner-aggregate`)                                                                        |
| Revenue vs observed cost              | `commandCenter.portfolio.revenueVsCost`                             | revenue evidence + measured cost; status OBSERVED / ESTIMATED / UNKNOWN                                                           |
| Per-stream margin / ROI               | `revenueRanking` entries (`estimatedMargin`, `roiUsd`, `rankScore`) | revenue stream evidence + cost evidence; UNKNOWN never 0                                                                          |
| Per-workflow cost                     | —                                                                   | **Not fabricated** — the ledger has no per-workflow ledger key; the presentation port answers honestly ("I will not estimate it") |

## Honesty rules (tested)

1. **Unknown cost is never zero.** `measuredCostUsd` returns `undefined` when the ledger
   shows no spend — it never reports 0 for absent evidence.
2. **Unknown revenue is never zero.** Revenue ranking only ranks entries with BOTH
   evidence sides; entries without cost evidence appear in `unknownCost`, never ranked
   with a fabricated margin.
3. **Unknown margin is never zero.** `estimatedMargin` is `undefined` unless both
   revenue and cost exist.
4. **ROI is never computed without evidence.** `roiUsd` requires actual/verified revenue
   and cost figures.
5. **Per-stream cost is never attributed from the owner aggregate.** The ledger has no
   per-revenue-stream key — attributing the owner total to one stream would overstate
   it, so stream-scoped queries return `undefined` (honest absence).
6. **profitability is never claimed** without actual evidence — revenue vs cost rows are
   advisory with status labels.

## The cost-weighted ranking example (SPRINT-034 rule, now surfaced)

- Opportunity A: revenue ₹10,000 · cost ₹500 → high rank (margin-rich).
- Opportunity B: revenue ₹12,000 · cost ₹5,000 → lower rank (margin-thin).

The system ranks by revenue, cost, margin, time, risk, confidence, automation potential
and founder effort — never by revenue alone. All assumptions are exposed in the entry.

## Verification

- `CostWeightedRevenue.test.ts` — margin-aware ranking, UNKNOWN behavior.
- `WorldBridgePorts.test.ts` — real CostLedger owner aggregate (2.5 USD observed), stream
  scope → undefined, absent spend → undefined.
- `WorldRouter.test.ts` — `revenueRanking` UNKNOWN-cost entry has no rankScore.
- `WorldModelService.test.ts` — "lists revenue without a cost port honestly".
