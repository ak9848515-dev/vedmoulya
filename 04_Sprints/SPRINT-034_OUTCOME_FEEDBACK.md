# SPRINT-034 — OUTCOME FEEDBACK

**Revenue → outcome feedback · verified evidence only · bounded adjustments**

---

## 1. What was built

`packages/world-model/src/domain/OutcomeEvidence.ts` — the discipline that lets
**verified outcomes** influence future opportunity scoring WITHOUT a learning
engine and WITHOUT turning estimates into facts.

## 2. The feedback path

```
OPPORTUNITY → RECOMMENDATION → APPROVED EXPERIMENT/WORKFLOW → EXECUTION
→ EXPECTED OUTCOME → ACTUAL OUTCOME → VERIFICATION
→ REVENUE/COST RESULT → (this module) → LEARNING SIGNAL → FUTURE SCORE
```

The module is a **composition discipline** over the existing memory/outcome
estate (Brain outcome memory + OpportunityEconomics). It is not a new engine.

## 3. Evidence model

An outcome record distinguishes:

- **EXPECTED** — `ESTIMATED` only; evidence required.
- **ACTUAL** — requires `verificationStatus: VERIFIED` **and** an evidence
  trail, else the record is REFUSED (`ACTUAL_UNVERIFIED` / `NO_EVIDENCE`).
- **UNKNOWN** — when actual evidence does not exist, actual stays UNKNOWN.
  The system never infers actual revenue/cost/margin/time.

Raw AI responses, unverified predictions, recommendations, hypothetical revenue
and fabricated estimates can NEVER be recorded as actuals (structural: the
`record` guard + tested).

## 4. Bounded scoring feedback

`applyFeedback` maps a verified outcome to ONE opportunity factor through a
closed map (REVENUE/MARGIN → `expectedMargin`; COST → `operatingCost`;
EFFORT → `founderInvolvement`; TIME → `timeToFirstRevenue`; QUALITY →
`customerPain`/`risk`). Rules:

- Only VERIFIED + evidence-carrying outcomes may move a factor — otherwise the
  feedback is REFUSED (`applied:false`).
- **One outcome NEVER rewrites global policy.** Each adjustment is clamped to
  `FEEDBACK_DELTA_MAX = 0.05` toward the observed direction.
- Every adjustment carries its evidence trail (first 4 evidence entries).
- Unmapped kinds are **recorded, not applied** (explicit `applied:false`).

## 5. Service integration

`WorldModelService`:

- `recordOutcomeEvidence` / `listOutcomeEvidence` (owner-scoped, bounded store).
- `evaluateOpportunity` now applies verified feedback as **advisory
  adjustments** exposed on the evaluation (`feedback` field) — the composite
  score stays explainable; every adjustment cites its evidence.
- `applyOutcomeFeedback` is idempotent per evidence id (recorded once).

## 6. Honest status

- IMPLEMENTED + TESTED (VERIFIED-only guard, evidence refusal, clamp bounds,
  no-policy-rewrite, explainability, idempotency).
- Live revenue/outcome data: **OPERATOR-REQUIRED** (the model is fed only by
  genuinely verified outcomes recorded through the gateway).
- "The system learned X from one outcome": NOT CLAIMED.
