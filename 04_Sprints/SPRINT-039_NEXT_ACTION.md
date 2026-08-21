# SPRINT-039 — NEXT BEST ACTION & OPPORTUNITY COMPARISON

**Explainable advisory — the system CAN say STOP** · 2026-08-15

## Next best action (Part H)

`nextBestAction` composes the existing problem assessment + evidence quality +
revenue state + prospect ledger into ONE explainable advisory:

| Action                 | When                                                                                              | Capital |
| ---------------------- | ------------------------------------------------------------------------------------------------- | ------- |
| STOP                   | assessment stop · REJECTED/DISMISSED · experiment completed with NO_EVIDENCE · stopReason present | —       |
| REQUEST_PAYMENT        | ≥1 verified payment AND ≥1 WTP signal                                                             | NO_COST |
| TEST_WTP               | ≥3 conversations confirm the problem                                                              | NO_COST |
| TALK_TO_CUSTOMERS      | quality UNKNOWN or <2 observations                                                                | NO_COST |
| VERIFY_PROBLEM         | quality NEEDS_REVIEW (conflict)                                                                   | NO_COST |
| RUN_NO_COST_EXPERIMENT | validated, not conflicting                                                                        | NO_COST |

Every result carries `why` (evidence-grounded reasons), `evidenceRefs`,
`expectedLearning`, `nextDecision`, `risk`, `capitalMode`, `advisory: true`.
The founder remains the decision-maker — this is a recommendation, never an
authorization.

**STOP is first-class:** a rejected/dismissed opportunity, an experiment that
completed without revenue evidence, or an evidence-driven stop recommendation
all yield STOP — "do not build this" is something the system CAN say, with the
reason exposed.

## Opportunity comparison (Part I)

`opportunityComparisonState` classifies each opportunity deterministically:

- `STRONG_EVIDENCE` — verified payment(s) + quality HIGH
- `PROMISING` — verified payment, or WTP + ≥3 conversations + quality known
- `NEEDS_CUSTOMER_VALIDATION` — ≥3 conversations
- `INSUFFICIENT_EVIDENCE` — some evidence, not enough
- `STOP` — rejected/dismissed/experiment-without-revenue/stopReason
- `UNKNOWN` — no observations at all

A high problem score alone is NEVER `STRONG_EVIDENCE` (benchmark scenario 20) —
business evidence is required. `buildOpportunityComparison` produces a bounded
(≤50), owner-scoped, ranked advisory list with `reasons`, verified payments,
WTP signals, problem severity, experiment cost, founder involvement, risk and
next best action per entry. Sorting is deterministic: evidence-backed and
actionable first, STOP/UNKNOWN demoted — never score-only.

## Voice presentation

The read-only `CommandCenterQuestionRouter` answers founder questions
("what evidence do we have", "show me the evidence", "which opportunity has the
strongest payment evidence") over these read models. **VOICE ≠ AUTHORIZATION**
is preserved — presentation only, no side effects, Brain remains the only
approval authority.
