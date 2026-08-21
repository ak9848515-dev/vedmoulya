# SPRINT-038 — ECONOMICS

**Evidence-carrying economics — UNKNOWN never becomes zero**

## Evidence-carrying figures

All economics are `RevenueFigure { value, status, evidence[] }`:

- `status: VERIFIED` — a real record exists (e.g. invoice, bank reference).
- `status: ESTIMATED` — evidence supports an estimate (e.g. operator-set cap,
  interview-derived figure).
- `status: UNKNOWN` — no evidence. UNKNOWN contributes NOTHING and is NEVER
  converted to zero.

## Three distinct advisory scores (Part C)

Deterministic weighted composites over KNOWN factors only. Weights are
documented and returned with every score. Scores are ADVISORY rankings, never
objective truth.

| Score                                                                    | Factors (weights)                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PROBLEM SCORE** — how painful/economically significant is the problem? | pain 1.3 · frequency 1.1 · humanEffort 1.0 · recurringCost 1.2 · revenueImpact 1.4 · errorImpact 1.3 · urgency 1.0                                                                                                                             |
| **BUSINESS OPPORTUNITY SCORE** — commercially attractive for VedMoulya?  | economicValue 1.4 · willingnessToPay 1.4 · buyerClarity 1.2 · aiFeasibility 1.3 · automationPotential 1.1 · competition 1.0 · differentiation 0.9 · salesDifficulty 0.8 · implementationComplexity 0.8 · deliveryCost 0.7 · expectedMargin 1.2 |
| **EXPERIMENT SCORE** — how cheaply/quickly can it be validated?          | experimentCost 1.2 · experimentDuration 1.0 · customerAccess 1.1 · dataAccess 1.1 · measurableOutcome 1.3 · reversibility 0.8 · risk 1.0 · expectedInformationGain 1.3                                                                         |

`score = Σ(value × weight) / Σ(weight)` over KNOWN factors only, clamped 0..1.
UNKNOWN factors contribute nothing — they never drag the score down and never
fabricate a number.

## Problem levels (Part D)

Explainable, evidence-driven classification:

- **LEVEL 0 — INTERESTING**: little/no demonstrated economic value.
- **LEVEL 1 — ANNOYING**: convenience or small time saving (pain/frequency evidence).
- **LEVEL 2 — COSTLY**: meaningful recurring labour/cost (recurringCost/humanEffort ≥ 0.5).
- **LEVEL 3 — REVENUE IMPACTING**: lost sales/leads/customers/revenue (revenueImpact ≥ 0.5).
- **LEVEL 4 — MISSION CRITICAL**: significant financial/operational/compliance/customer risk
  (errorImpact/urgency ≥ 0.66).

Every level returns human-readable REASONS. A high level measures PAIN/
SIGNIFICANCE — it does NOT automatically mean a good business (the opportunity
score measures commercial attractiveness separately).

## Revenue validation (Part J)

The revenue ladder with explicit states:

```
NO_EVIDENCE → INTEREST → PROBLEM_CONFIRMED → EXPERIMENT_SUCCESS
            → PAYING_INTEREST (WTP evidence) → REVENUE_VERIFIED (verified payment)
            → REPEAT_REVENUE (2 verified payments) → REPEATABLE_BUSINESS (3+)
```

Rules enforced structurally:

- "Sounds useful" → INTEREST (never revenue).
- "I would pay ₹X" → PAYING_INTEREST + WTP evidence (never revenue).
- Proposal/invoice → NOT revenue.
- **Only a VERIFIED payment evidence record reaches REVENUE_VERIFIED.**

## AI cost control (Part L)

Every experiment exposes estimatedAiCost, humanEffort, duration, maxBudget —
all evidence-carrying. Unknown cost stays UNKNOWN. ROI is never claimed without
evidence.

## STOP (Part M) — kill bad ideas

`recommendStop` produces deterministic STOP reasons when evidence shows:
insufficient pain, insufficient economics, poor AI feasibility, excessive
competition, no identifiable buyer, excessive implementation complexity, poor
expected margin, an experiment that completed without revenue evidence, or a
previously rejected opportunity. The Brain CAN say "do not build this."
