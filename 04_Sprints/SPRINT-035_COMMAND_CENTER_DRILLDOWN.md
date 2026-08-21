# SPRINT-035 — COMMAND CENTER DRILL-DOWN

**Founder Command Center completion — drill-downs, timeline, cost view**
**Date:** 2026-08-15 · **Presentation/composition only — no new engine, no second dashboard architecture**

## Principle

The SPRINT-034 Command Center (`apps/web/src/components/CommandCenter.tsx`) is EXTENDED,
not replaced. Every section remains a composition over the EXISTING read models
(`world.commandCenter`, `world.revenueRanking`, `world.listRevenueStreams`,
`world.opportunityPipeline`, `world.timeline`) — no data logic is duplicated in the UI,
and the component creates no engine.

## Drill-down model

Each section item is now an expandable card (`ReadonlySet<string>` expand state, keyboard

- ARIA + screen-reader labels, focus ring, chevron affordance). Expanded detail answers
  WHAT / WHY / EVIDENCE / COST / RISK / NEXT ACTION for every item.

| Section      | Item                   | Drill-down shows                                                                                                                                                                                               | Source                                                                           |
| ------------ | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| TODAY        | attention items        | title, category, reason, what-happened, why-it-matters, evidence, confidence, recommended next action, estimated cost, risk, approval requirement                                                              | `commandCenter.today.attention`                                                  |
| TODAY        | pending approvals      | action, reason, business, workflow, step, provider, estimated cost, risk, data scope, expected outcome, reversibility, authority required, current status                                                      | `commandCenter.approvals` + `decideBlueprintApproval` (existing Brain authority) |
| PORTFOLIO    | revenue streams        | identity, purpose, opportunities, revenue evidence (ESTIMATED/VERIFIED), cost evidence, verified margin, risks, recent outcomes; UNKNOWN stays UNKNOWN                                                         | `listRevenueStreams` + `revenueRanking`                                          |
| PORTFOLIO    | opportunity pipeline   | category, evidence, economic factors, advisory score, feedback trail, provenance, cost, expected margin, founder involvement, recommendation                                                                   | `opportunityPipeline`                                                            |
| INTELLIGENCE | world signals          | per-kind signal health — status (AVAILABLE / UNAVAILABLE / ERROR), last success, last error, configured; provenance where present; never fabricated "live"                                                     | `world.signalHealth`                                                             |
| AUTOMATION   | workflows + blueprints | workflow, steps, action classes (A/B/C/D), gates, provider/capability, expected outcome, actual outcome, execution status, approval status                                                                     | `commandCenter.automation`                                                       |
| APPROVALS    | approval requests      | requested action, business, workflow, step, provider, estimated cost, risk, data scope, expected outcome, reversibility, authority, current status + **Approve / Reject through the existing Brain authority** | `world.listBlueprintApprovals` + `world.decideBlueprintApproval`                 |

## Timeline (bounded, owner-scoped, composed — NOT a new event store)

`world.timeline({ userId, limit, offset })` composes events from the EXISTING stores:

- **SIGNAL** — from opportunity lifecycle records
- **OUTCOME** — from outcome evidence (stable-key dedup)
- **APPROVAL** — from blueprint approval requests (stable-key dedup)
- **REVENUE / COST** — from revenue stream lifecycle

Constraints enforced in the service: **bounded** (`limit` ≤ 50), **owner-scoped** (only
the caller's own events), **idempotent** (stable-key upsert — re-recording never
duplicates), **paginated** (`hasMore` + `offset`). No unbounded history queries; no
O(N²) scans — each store is owner-indexed.

## Cost view

`commandCenter.portfolio` exposes **costDailyUsd / costProviderUsd** from the real
CostLedger (owner aggregate via `WorldCostPort`), plus **revenueVsCost** with an honest
status label (OBSERVED / ESTIMATED / UNKNOWN).

Discipline (tested):

- **UNKNOWN is never displayed as zero** — absent evidence renders "no measured cost evidence".
- **ROI is never calculated without evidence** — `roiUsd` only when both revenue and cost evidence exist.
- **profitability is never claimed without actual evidence** — the revenue vs cost row is advisory with its status exposed.

## UX states

Every state is honest and explicit: loading · empty · error · **UNKNOWN** · **UNAVAILABLE** ·
**NEEDS_REVIEW** (approval refusal). No misleading success states. Every action
communicates whether it is INFORMATION / RECOMMENDATION / APPROVAL REQUIRED / EXECUTING /
COMPLETED / FAILED / NEEDS REVIEW.

## Verification

- `CommandCenter.test.tsx` — **13 tests** (tabs, drill-down expansion, decision through the authority, honest empty/unknown/unavailable states, owner scoping at the UI layer).
- Lint: 0 errors / 0 warnings (drill-down expand state refactored to `ReadonlySet` — no object-injection sinks).
- Mobile: stacked sections, touch-friendly targets, no information loss (drill-downs render inline).
