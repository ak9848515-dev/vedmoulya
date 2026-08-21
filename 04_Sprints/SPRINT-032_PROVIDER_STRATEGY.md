# SPRINT-032 — PROVIDER STRATEGY: Provider-Neutral Economics

> Reuse the Intelligence Fabric. For every provider decision consider:
> quality · cost · latency · availability · privacy · capability ·
> historical evidence. Provider count is NOT a KPI — task success per unit
> cost IS.

---

## 1. Strategies (advisory constraints — never assumptions)

| Strategy    | Meaning                                                                              |
| ----------- | ------------------------------------------------------------------------------------ |
| FREE        | free tier / free quota — NEVER assumed unlimited                                     |
| LOCAL       | local model — NEVER assumed zero cost (hardware/electricity measured where possible) |
| OPEN_SOURCE | open-weights model — NEVER assumed free to operate                                   |
| LOW_COST    | budget-constrained hosted                                                            |
| PREMIUM     | quality-first hosted                                                                 |
| PRIVATE     | local/private-only processing (privacy overrides cost)                               |

Roles declare acceptable strategies; the EXISTING fabric selection strategy
(CHEAP / FAST / QUALITY / PRIVATE / BALANCED) ranks candidates
deterministically and ADVISORY — actual routing stays with the frozen
runtime. A PRIVATE task never routes remote on price alone; PRIVATE with no
local candidate → honest no-selection.

## 2. Provider economics in the world model

- **Selection** — `WorldFabricPort.selectStrategy` (the fabric's advisory
  ranking; quality-first preserved; free never beats quality).
- **Cost** — `WorldFabricPort.costSnapshot` over the EXISTING CostLedger
  trace spine (measured, never fabricated; zero spend → undefined, never 0).
- **Health** — the fabric's observed `ProviderHealthLedger` (UNKNOWN until
  real calls are observed).
- **Boundary** — free/local/open-source assumptions never replace measured
  facts; actual cost is measured where possible.

## 3. What the architecture supports vs what the product configures

- The architecture (roles + fabric strategies + registry) supports 100+
  providers.
- The product only configures providers that provide VALUE — measured by
  task success per unit cost, provider health and the user's budget/privacy
  constraints.
- No providers were added merely to increase the provider count in
  SPRINT-032; the runtime registry remains the only catalog.
