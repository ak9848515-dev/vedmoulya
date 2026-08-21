# SPRINT-039 — CUSTOMER DISCOVERY LEDGER

**Evidence-oriented prospect records — discovery ≠ validation** · 2026-08-15

## The ledger is NOT a CRM (Part C)

The minimum evidence-oriented representation of a customer-discovery
conversation: prospectReference (never a real PII dump), customerSegment,
problemDiscussed, structured pain/frequency/current-solution fields, existing
spending / budget / WTP indications (all `RevenueFigure` evidence-carrying),
objection, desiredOutcome, nextStep, bounded evidence list, and mandatory
provenance. No unbounded free-text dumps, no PII collection.

## Bounded status chain

```
CONTACTED → CONVERSATION → PROBLEM_CONFIRMED → SOLUTION_INTEREST
         → WTP_SIGNAL → PAYMENT_REQUESTED → VERIFIED_PAYMENT
         ↘ LOST (from any active state)           ↘ LOST
```

`canAdvanceProspect` is the single deterministic guard — a prospect can NEVER
jump to `VERIFIED_PAYMENT` (tested: `CONTACTED → VERIFIED_PAYMENT` refused).
`prospectTransitionReason` explains every transition ("Only a VERIFIED payment
advances a prospect to VERIFIED_PAYMENT").

## Discovery ≠ validation; interest ≠ revenue; WTP ≠ payment

- A conversation is never a customer.
- `INTEREST` (or "sounds useful") never reaches `REVENUE_VERIFIED`.
- A stated WTP signal (`WTP_SIGNAL` / willingnessToPayIndication) is WTP
  EVIDENCE, never revenue — it progresses discovery only.
- ONLY a `verified_payment` evidence record (via `advanceProspect` →
  `VERIFIED_PAYMENT`) reaches the existing SPRINT-038 `REVENUE_VERIFIED` state
  and increments the verified-payment ladder (2 → REPEAT_REVENUE, 3+ →
  REPEATABLE_BUSINESS).

## Storage

Owner-scoped, stable-key idempotent (`prospectId` embeds the owner), bounded
per owner, in-memory + Postgres `world_prospects` in the shared persistence
bundle. Evidence capped per record (≤10), text sanitized at the boundary.
