# SPRINT-036 — PROVIDER ORCHESTRATION · ARCHITECTURE

## The composition seam

`MultiProviderOrchestrator` (`packages/world-model/src/domain/MultiProviderOrchestrator.ts`)
produces a bounded, owner-scoped, EXPLAINABLE multi-provider **orchestration plan**
by composing ONLY the existing authorities:

```
GOAL + STEPS (capability/role/privacy)
  → WorkflowFactory.decompose          (bounded decomposition proposal)
  → fabric.validateWorkflow            (EXISTING WorkflowBounds — depth ≤ 8, tasks ≤ 24,
                                        fan-out ≤ 8, calls ≤ 64, cost ≤ $5, time ≤ 600 s)
  → fabric.selectStrategy              (advisory per-step provider binding + WHY + expected cost;
                                        CHEAP/FAST/QUALITY/PRIVATE/BALANCED; privacy overrides cost)
  → ActionClassPolicy (action.classify)(per-step A/B/C/D — provider output can NEVER change it)
  → decideRetryPolicy                 (deterministic bounded RETRY/FALLBACK/STOP/NEEDS_REVIEW)
  → OrchestrationPlan                 (representation: executed:false, authorizationRequired:true)
```

## What the plan exposes (per §14)

For every step: the bound provider/model, **WHY** (fabric selection evidence),
the required capability, the expected cost (evidence-only), the action class,
the privacy class applied, the honest provider state, the bounded retry/fallback
policy for every failure mode, the verification requirement, and the first
privacy-safe fallback candidate (when one exists).

## Structural guarantees

- `executed: false` and `authorizationRequired: true` are **types** — the plan
  can never call a provider, spend, approve or grant authority.
- The runtime path remains the **existing execution bridge**
  (`ExecutionRunService` → `StepExecutionPort` → verification → outcome → audit).
- Provider credentials never leave the server side; the plan stores provider
  **ids**, never keys.

## Store

`orchestrationPlans` — owner-scoped, stable-keyed (`owner:orchestration:goal:strategy`,
idempotent upsert, FIFO-bounded 50/owner), in-memory + Postgres
(`world_orchestration_plans` via the shared `WriteThroughDocumentStore`).

## Gateway

- `world.orchestratePlan` (mutation) — produce + persist a bounded plan.
- `world.listOrchestrationPlans` (query) — owner-scoped list.
  Both authenticated + rate-limited + IDOR-guarded by the central middleware.
