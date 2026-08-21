# SPRINT-034 — REVENUE INTELLIGENCE

**Cost-weighted revenue intelligence — CostLedger-composed, UNKNOWN ≠ 0**

---

## 1. What was built

`packages/world-model/src/domain/CostWeightedRevenue.ts` — margin-aware ranking
of revenue streams that considers **revenue, cost, margin and ROI** instead of
ranking purely by revenue. It composes the EXISTING CostLedger through a narrow
`WorldCostPort`; no new budget/cost engine.

## 2. CostLedger integration

- `WorldCostPort.costSnapshot(ownerId)` → the existing
  `CostPolicyGuard`/CostLedger measured snapshot (daily / provider USD).
- `WorldCostPort.streamCost(streamId)` → a per-stream figure **only where the
  ledger genuinely tracks it**; otherwise `undefined` — a stream-scoped figure
  is never synthesized from totals (that would be fabrication).

## 3. Ranking rules

- **Unknown cost is NOT zero.** A stream without cost evidence gets no
  fabricated margin/ROI — it is ranked below streams with evidence, and the
  UI shows _"no margin evidence"_.
- **Unknown revenue is NOT zero.** Unverified revenue is never treated as ₹0
  for ROI math; figures are labelled ESTIMATED vs ACTUAL.
- **Unknown margin is NOT zero.**
- `roiUsd` (unclamped, evidence-based) is reported separately from the clamped
  `rankScore` — the score is bounded, the evidence is not hidden.
- Every entry exposes `assumptions` (e.g. _"Estimated figures only — never a
  promise"_) and `advisory:true`.

## 4. Example (from the spec, now real)

| Stream | Revenue potential | Execution cost | Ranking           |
| ------ | ----------------- | -------------- | ----------------- |
| A      | ₹10,000           | ₹500           | higher (ROI ~20×) |
| B      | ₹12,000           | ₹5,000         | lower (ROI ~2.4×) |

Ranking by pure revenue would put B first; the cost-weighted ranking puts A
first and shows the assumptions. The system also weighs time, risk, confidence,
automation potential and founder effort where evidence exists.

## 5. Surfaces

- `world.revenueRanking` gateway procedure (authenticated, owner-scoped).
- PORTFOLIO tab of the Command Center (ranking card with ROI chips +
  assumptions; honest empty state).

## 6. Honest status

- Ranking + UNKNOWN handling: IMPLEMENTED + TESTED.
- Per-stream cost evidence: **OPERATOR-REQUIRED** (requires CostLedger to
  observe executions attributed to streams).
- "Verified ROI": only ever claimed from actual CostLedger observations —
  NOT CLAIMED without evidence.
