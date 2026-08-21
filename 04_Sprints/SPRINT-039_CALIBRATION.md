# SPRINT-039 — EVIDENCE CALIBRATION

**Bounded, evidence-trailed adjustments over the existing SPRINT-038 factors** · 2026-08-15

## The discipline (Part E)

`calibrateFactors` adjusts an EXISTING SPRINT-038 factor (pain, economicValue,
revenueImpact, …) from a founder observation — with hard guarantees:

1. **Bounded movement** — a single evidence event moves a factor by at most
   `CALIBRATION_DELTA_MAX = 0.05`, scaled by evidence strength (STRONG × 1.0 ·
   MODERATE × 0.6 · WEAK × 0.3). One observation can never cause a huge jump or
   rewrite policy.
2. **UNKNOWN never becomes zero** — an `UNKNOWN` factor stays `UNKNOWN`
   (delta 0, quality UNKNOWN, reason "no fabricated value"). A weak observation
   cannot fabricate a value.
3. **Conflicts remain visible** — `CONFLICTING` observations surface in
   `conflicts` (forEvidence vs againstEvidence, state CONFLICTING) — never
   silently resolved.
4. **Negative evidence lowers confidence** — direction −1 moves the factor down,
   bounded the same way.
5. **Every adjustment keeps its evidence trail** — `adjustments` record the
   observationId, factorKey, delta, reason, evidenceState, quality; each result
   factor carries `before`/`after`/`delta`/`reason`/`evidenceRefs`/`quality`.
6. **Clamped** — after ∈ [0, 1] always.

## Relation to the frozen discipline

Mirrors SPRINT-035's `FEEDBACK_DELTA_MAX` 0.05 calibration benchmark — the same
safety boundary is now applied to founder-evidence calibration, with the same
honesty rules: unverified evidence never scores, fabricated evidence is
rejected, conflicting evidence visible, unknown stays unknown, adjustments
explainable.

## Why this matters

The founder's real observations can now move opportunity scoring ONLY inside a
bounded, auditable envelope — the system adapts to evidence without ever being
rewritten by a single anecdote.

## Benchmark proof

`evidence:benchmark` 20/20 deterministic scenarios (bounded-delta ·
bounded-accumulation · conflict-visible · negative-evidence · wtp-not-revenue ·
no-fabricated-verification · verified-payment-only · provenance-required ·
unknown-stays-unknown · injection-sanitized · …) — wired into `npm run
benchmarks` + the vitest gate.
