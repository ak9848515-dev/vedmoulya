# SPRINT-038 — PROBLEM MODEL

**A PRACTICAL business-problem representation over the World Model**

## What a problem is

A bounded, owner-scoped representation of a REAL business problem — NOT a
universal knowledge-graph entry, NOT a fabricated opportunity. A problem can
represent (types in `packages/world-model/src/types/world-types.ts` →
`BusinessProblem`):

- `problemId`, `ownerId`, `stableKey` (owner + statement — idempotent upsert)
- customer/business, industry, workflow
- affected role, pain, frequency, human effort
- estimated current cost / revenue impact / error impact / urgency
- current solution, competitor alternatives, buyer
- AI suitability, automation potential, implementation complexity, estimated AI cost
- `evidence: ProblemEvidence[]` — PROVENANCE REQUIRED
- willingness-to-pay evidence (separate list, never revenue)
- confidence (VERIFIED / ESTIMATED / UNKNOWN — derived, never fabricated)
- `status` (bounded lifecycle) + `revenueState` (revenue-validation ladder)
- level + levelLabel (0–4, explainable)
- assessment (three scores + STOP recommendation) + stopReason
- createdAt / updatedAt

## Evidence / provenance (Part B)

`ProblemEvidence` carries: source, observedAt, reference, text (sanitized),
confidence, owner scope. Sources include customer interview, customer-provided
data, direct observation, public company information, public reviews, job
postings, marketplace demand, public pricing, industry reports, startup
databases, government data, existing VedMoulya observations, verified
experiment results and verified payment.

**Rules enforced structurally:**

- A problem with NO evidence is refused (`EVIDENCE_REQUIRED`).
- An evidence record with empty text is refused.
- Evidence text is SANITIZED at the boundary — markup/scripts/control
  characters stripped, length-bounded (`sanitizeEvidenceText`). External
  content is untrusted.
- Evidence NEVER becomes authorization. A problem has NO approve/execute/
  authorize surface (structural test asserts this).
- Confidence is derived from the evidence set — `VERIFIED` only when a
  VERIFIED record exists; `ESTIMATED` when any ESTIMATED record exists;
  otherwise `UNKNOWN`.

## Never fabricated

No evidence → UNKNOWN. The system never fabricates: customers, revenue, market
size, willingness to pay, competitor weakness, demand, savings or ROI. A
customer statement "this sounds useful" is INTEREST, not revenue. "I would pay
₹X" is willingness-to-pay EVIDENCE, not revenue. Only an actual VERIFIED
payment becomes `REVENUE_VERIFIED`.

## Bounds

- Evidence per problem: capped at 20 records (FIFO).
- Willingness-to-pay evidence: capped at 10.
- Problems per owner: bounded (50; FIFO eviction oldest-first).
- Radar: bounded, paginated, owner-scoped.
