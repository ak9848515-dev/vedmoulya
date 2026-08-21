# SPRINT-038 — SCORING

**Three distinct advisory scores — factor-exposed, explainable, never truth**

## Why three scores, not one

A single "opportunity score" hides what matters. VedMoulya needs three separate
advisory questions:

1. **PROBLEM SCORE** — Is the problem painful/economically significant?
2. **BUSINESS OPPORTUNITY SCORE** — Is solving it commercially attractive for VedMoulya?
3. **EXPERIMENT SCORE** — Can it be validated cheaply and quickly?

They measure DIFFERENT things: a mission-critical problem (high problem score)
can be a terrible business (low opportunity score); a great business idea can
be expensive to validate (low experiment score).

## Deterministic composite

```
score = Σ(value × weight) / Σ(weight)   over KNOWN factors only, clamped 0..1
```

- Every factor is a `ProblemFactor { key, value?, status, evidence[] }`.
- `status: UNKNOWN` factors contribute NOTHING — never zero, never a drag.
- Weights are documented constants (exported, returned with every score).
- Rationale strings explain the composite ("2 of 5 factors are evidence-backed;
  the rest are UNKNOWN and contribute nothing").

## Explainability

Every score result exposes:

- `score` (advisory composite 0..1)
- `factors` (each with value/status/evidence)
- `weights` (documented, never secret)
- `rationale` (human-readable)
- `advisory: true` (structural — never presented as objective truth)

## Level classification

`classifyProblemLevel(problemScore, opportunityScore)` returns level 0–4 with
human-readable reasons. Deterministic and evidence-driven (see ECONOMICS.md).

## Score adjustments / feedback

The SPRINT-034 rule — one verified outcome may adjust a factor by at most
Δ0.05 — is preserved by the EXISTING OpportunityEconomics calibration path
(SPRINT-035 calibration benchmark, 13/13). SPRINT-038 adds no new scoring
engine: the three scores are deterministic compositions over the existing
evidence model.

## Tests

- Unknown factors never change the score (equality test).
- Three distinct scores with documented weights.
- Level classification 0–4 with reasons.
- Score factor explainability (factors/weights/rationale exposed).
- The benchmark's 20 scenarios include score/level/UNKNOWN verification.
