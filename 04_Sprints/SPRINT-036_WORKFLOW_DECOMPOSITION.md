# SPRINT-036 — MULTI-PROVIDER WORKFLOW DECOMPOSITION

## Composition over the existing pieces

The deterministic §14 workflow is planned end-to-end:

```
"Research a business opportunity and prepare a concise recommendation"
  → research          (capability: research)
  → reasoning         (capability: reasoning)        — independent reasoning provider
  → economic analysis (capability: economic-analysis)
  → verification      (capability: verification)     — cross-provider verification
  → finalization      (capability: summarization)    — normalized final result
```

Each step may bind a **different** provider (Provider A → research, Provider B →
reasoning, Provider C → analysis, Provider D → verification…) through the
existing fabric strategy — the business workflow names **capabilities/roles**,
never provider ids.

## Bounds (frozen — never widened)

depth ≤ 8 · tasks ≤ 24 · fan-out ≤ 8 · calls ≤ 64 · cost ≤ $5 · time ≤ 600 s.
The plan validates through the **existing fabric `WorkflowBounds`** (the
gateway's configured limits are authoritative). An over-cost plan is produced
with `bounds.allowed: false` — never executed. No infinite loops, no unbounded
recursion, no uncontrolled provider fan-out: the retry policy is bounded by
`maxRetries` (0–3) and the simulation guard is capped at 64 iterations by
construction.

## Dependencies

Steps may declare dependencies at plan time; the plan records them so the
execution bridge's dependency checks (which remain authoritative at runtime)
apply unchanged.

## The plan is a REPRESENTATION

`executed:false` is structural. Approval (for C/D steps) goes through the
EXISTING Brain authority; execution goes through the EXISTING bridge.
