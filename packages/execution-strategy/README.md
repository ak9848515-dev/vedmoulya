# @vedmoulya/execution-strategy

**Purpose:** The Enterprise Execution Strategy Engine (EES, EI-004). Given ANY business goal, produces a complete execution strategy — capabilities, context reference, provider candidates, execution mode, token/cost/latency budgets, quality target, risk, fallback plan, retry policy, and validation — **without making any AI calls**.

**Owner:** Chief Enterprise Intelligence Architect (AI Platform Team)

## What it does

The engine creates the strategy; it does NOT execute work. No provider selection, no AI calls, no execution — those belong to later sprints.

For a given goal the EES determines:

- **WHAT** to execute (Capability Planner → capability plan with sequential/parallel/optional/conditional nested steps)
- **WHICH** providers are eligible (Provider Candidate ranking only — never selects)
- **HOW MUCH** context / tokens / budget (Token, Cost, and Latency Budget engines + Quality Target)
- **HOW** work should be divided (Execution Modes: sequential, parallel, hybrid, pipeline)
- **WHAT** risk and fallback exist (Risk Engine + Fallback Engine + Retry Policy)
- **WHETHER** the strategy is ready (Strategy Validator — 6 checks: capability, context, provider, budget, latency, quality)

## Contents

- `src/types/` — domain types (`strategy-types.ts`)
- `src/domain/` — value objects, repository contract, domain services (CapabilityPlanner, ProviderCandidate, BudgetEngine, RiskEngine, FallbackEngine, StrategyValidator, ExecutionStrategyService)
- `src/infrastructure/` — in-memory repository
- `src/application/` — application service + DTOs + mapper
- `src/catalog/` — seed strategy catalog (4 realistic strategies)

## Dependencies

- `@vedmoulya/core` — `PaginatedResult` / `PaginationParams` shared types
- `@vedmoulya/ai` — capability taxonomy, quality tiers, provider families/status
- `@vedmoulya/providers` — provider registry types

## Usage

```typescript
import {
  ExecutionStrategyService,
  InMemoryExecutionStrategyRepository,
  ExecutionStrategyApplicationService,
} from '@vedmoulya/execution-strategy';

const service = new ExecutionStrategyApplicationService(new InMemoryExecutionStrategyRepository());

const result = await service.createStrategy({
  goalId: 'goal_001',
  goal: 'Generate a blog post about enterprise AI',
  business: ['platform'],
  priority: 'high',
  qualityTier: 'premium',
  maxCostUsd: 2,
  maxLatencyMs: 30000,
});
```

## Future Expansion

- Postgres `ExecutionStrategyRepository` + migrations
- Budget enforcement at orchestration time (EI-005 economy builds)
- Provider selection and execution (later sprints)
