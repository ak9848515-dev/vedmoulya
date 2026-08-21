# SPRINT-030 — Cost Intelligence Report

> Cost-aware orchestration: measured-only cost tracking, fail-closed policy
> caps, free/local/paid provider strategy. Status: 🟢 IMPLEMENTED + TESTED
> (advisory caps; execution-time enforcement remains the frozen `RunBudgetGuard`).

---

## 1. Principle: measure, never invent

The Fabric's cost model is **measurement-only**. It reads spend from the
existing `CostLedger`, which aggregates the `ExecutionTrace` spine
(`loop.step` events carry authoritative per-provider `cost_usd` /
`tokens_total`). The Fabric never estimates, extrapolates or fabricates cost:

- recorded spend > 0 → reported
- recorded spend == 0 → `undefined` (absent — honest, and distinct from a real zero-cost local run being _known_)

## 2. Cost abstraction (`FabricCostPort`)

```ts
snapshot({ ownerId?, providerId? }) → {
  dailyUsd?: number;      // owner total within the ledger's retained window
  providerUsd?: number;   // that provider's share
  taskUsd?: number;       // absent until a real task dimension exists
  workspaceUsd?: number;  // absent until a real workspace dimension exists
}
```

Implemented over the real `CostLedger` + `TraceStore` (gateway
`FabricBridgePorts.createFabricCostPort`). Unknown price providers contribute
nothing — "unknown pricing remains UNKNOWN".

## 3. Policy caps (`CostPolicyGuard`)

Configurable, fail-closed:

| Cap                   | Default | Behavior on breach                  |
| --------------------- | ------- | ----------------------------------- |
| `maxTaskCostUsd`      | 1.00    | `allowed:false`, bucket `task`      |
| `maxDailyCostUsd`     | 10.00   | `allowed:false`, bucket `daily`     |
| `maxProviderCostUsd`  | 5.00    | `allowed:false`, bucket `provider`  |
| `maxWorkspaceCostUsd` | 20.00   | `allowed:false`, bucket `workspace` |

`checkCostPolicy(additionalUsd)` returns the exhausted bucket — so callers can
see _why_ they were blocked. Gateway surface: `fabric.checkCostPolicy`.

**Enforcement boundary (honest):** the Fabric's caps are an advisory gate for
plans/recommendations. The authoritative execution-time budget remains the
frozen `RunBudgetGuard` (SPRINT-014) inside the Execution bridge — untouched.
No duplicate budget engine was created.

## 4. Free / local / paid strategy

Selection considers cost tier + local availability, but never at the expense
of privacy or capability:

```
1. Local model (family ollama)      — lowest cost, highest privacy
2. Free/quota provider (costTier free)
3. Low-cost provider (bestCostUsd)
4. Premium provider (quality-first strategies)
5. Fallback (only when policy allows)
```

Rules:

- PRIVATE task + no local candidate → **no selection** (honest absence) —
  privacy overrides cost.
- `costTier`/`family`/`bestCostUsd` come from the registry DTO evidence
  (bridge-port tested) — never guessed.

## 5. Cost telemetry

- Observed spend is per-owner and per-provider via the ledger window.
- The Fabric adds no new metrics sink — it reads the existing spine (no heavy
  new infrastructure; §18 of the sprint brief honored).

## 6. Tests

- `CostPolicyGuard.test.ts` — each cap, exhausted bucket identification,
  fail-closed on zero-config, no false "0 spend" fabrication
- `FabricBridgePorts.test.ts` — real ledger composition: owner-scoped snapshot
  (3.0 across two providers), provider-filtered view (0.5), absent-when-zero
- `FabricRouter.test.ts` — `checkCostPolicy` through the tRPC pipeline:
  allowed under caps, blocked with bucket when a task cap is exceeded
