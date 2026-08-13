# Enterprise Execution Strategy Engine

> The central decision engine of VedMoulya. Given a Goal, it produces a complete execution strategy — capabilities, context reference, provider candidates, execution mode, budgets, quality, risk, fallback, retry, and validation — **without making any AI calls**. This is VedMoulya IP.
> Owner: Chief Enterprise Intelligence Architect · Updated: 2026-08-04 (EI-004)
>
> **Renamed (EI-004):** formerly the _AI Economy Engine_ (EI-005 concept). The budget engines (token, cost, latency, quality) are now part of the Enterprise Execution Strategy Engine, which EI-004 implements. Budget _enforcement_ and spend dashboards remain future work (EI-005).

## Purpose

Define the Enterprise Execution Strategy Engine (EES): the component that, for any business goal, determines WHAT to execute, WHICH capabilities are required, WHICH providers are eligible, HOW work should be divided, HOW MUCH context/tokens/budget to use, WHETHER execution is sequential or parallel, WHAT quality must be achieved, WHAT risk exists, and WHAT fallback/retry strategy applies. The engine creates the strategy — it does NOT execute work.

It implements the constitutional principles — every AI call has a token budget, a cost budget, a quality target, and minimum necessary context — and adds latency, provider, and execution budgets. Cost discipline is a competitive advantage.

## Responsibilities

- Produce a complete, validated execution strategy for any business goal (no AI calls)
- Plan capabilities and their order/flow (sequential, parallel, optional, conditional, nested)
- Rank eligible providers (never select)
- Predict expected token/cost/latency before execution, with confidence
- Define risk, fallback, and retry policy for the strategy
- Validate the strategy across six dimensions before execution planning

## Inputs

- Goal + business context (Goal Engine / modules)
- Quality tier (premium/standard/economy/free)
- Budget ceilings (max cost, max latency, max tokens) — optional
- Provider allow-list (optional)
- Capability taxonomy (`@vedmoulya/ai`) and provider registry estimates (`@vedmoulya/providers`)

## Outputs

- **ExecutionStrategy:** capability plan, context reference, provider candidates, execution mode + mode plan, priority, risk assessment, confidence, token/cost/latency budgets, quality target, fallback plan, retry policy, validation result
- Expected cost/token/latency predictions with confidence
- Strategy explanation (human-readable summaries)

## Algorithms

### Capability Planner

- Goal → capability plan via registered templates (blog/content, summarize, translate, analyze, classify, learn, generic fallback)
- Steps carry support (required/optional/conditional), flow type, weight, eligible provider families, nested children
- `requiredCapabilities` collected recursively from non-skippable steps

### Provider Candidates

- Ranking only — the EES NEVER chooses a provider
- Composite rank score from quality, capability match, health, historical success, confidence, availability, cost
- Each candidate: capability match, quality estimate, latency estimate, cost estimate, context window, availability, confidence, historical success, health score

### Token / Cost / Latency Budgets

- Token: input/output/context/reserved/maximum/expected + confidence; per-tier output multiplier; `maximumTokens` cap
- Cost: expected vs. maximum cost, budget category (minimum/standard/premium/maximum), confidence; `maximumCostUsd` cap
- Latency: expected vs. maximum time, confidence; `maximumLatencyMs` cap

### Quality Target

- Target score, minimum score, retry threshold, approval required, human review, tier
- Quality is a floor, not a trade-off against cost beyond tier choice

### Execution Modes

- Sequential, parallel, hybrid, pipeline — derived from the capability plan's flow types, with a mode plan (ordered steps, concurrency groups, expected duration)

### Risk Engine

- Provider risk (health + availability), execution risk (context fit), budget risk (expected vs. max), latency risk (expected vs. max)
- Combined overall risk 0–1 → level (very_low/low/medium/high/critical) + risk factors

### Fallback Engine

- Primary / secondary / emergency / local execution plan tiers, active tier = primary
- Retry policy: maximum retries, delay, escalation (none/double-delay/switch-provider/switch-capability), stop conditions (budget exceeded, quality below threshold, context window exceeded, policy violation)

### Strategy Validator

Six checks, each producing a pass/fail + detail, summed into a 0–1 score:

1. Capability exists (feasible plan with required capabilities)
2. Context available (steps planned)
3. Provider available (≥1 eligible candidate)
4. Budget possible (positive token and cost caps)
5. Latency acceptable (positive latency cap)
6. Quality achievable (positive minimum score)

## Decision Flow

1. Goal → Capability Planner produces the plan
2. Provider Candidate ranking (no selection)
3. Budgets estimated (tokens, cost, latency) + quality target
4. Risk assessed across all four dimensions
5. Execution mode + mode plan determined
6. Fallback plan + retry policy built
7. Strategy assembled and validated across six checks
8. Strategy persisted/returned — execution comes later

## Failure Handling

- **No eligible provider:** strategy still produced with high provider risk; validation flags the provider check; fallback to local execution described
- **Budget ceiling reached:** maximum caps respected; expected-vs-max ratio drives budget risk
- **Validation failure:** strategy carries failed checks with details for replanning

## Learning

- Prediction residuals (predicted vs. actual tokens/cost/latency) calibrate future estimates (Learning Engine, later)
- Provider price/latency drift detection (Provider Health/Benchmark engines, later)

## Future Expansion (EI-005 and later)

- Budget enforcement at orchestration time (hard gates) and usage telemetry
- Spend dashboards (monthly/annual, per module/client)
- Provider selection and execution (later sprints)
- Postgres `ExecutionStrategyRepository`

## References

- [EI000_ENTERPRISE_INTELLIGENCE_SPECIFICATION.md](./EI000_ENTERPRISE_INTELLIGENCE_SPECIFICATION.md)
- [INTELLIGENCE_MATHEMATICS.md](./INTELLIGENCE_MATHEMATICS.md)
- [PROVIDER_HEALTH_ENGINE.md](./PROVIDER_HEALTH_ENGINE.md)
- [TOKEN_OPTIMIZATION.md](./TOKEN_OPTIMIZATION.md)
- [04_Sprints/ENTERPRISE_INTELLIGENCE/EI-005_AI_Economy_Engine.md](../04_Sprints/ENTERPRISE_INTELLIGENCE/EI-005_AI_Economy_Engine.md)
- `packages/execution-strategy` (EI-004 implementation)
