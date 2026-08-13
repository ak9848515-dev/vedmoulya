# @vedmoulya/learning-intelligence

**Enterprise Learning Intelligence Platform** (EPIC-004 / EI-007).

VedMoulya learns from every execution. This package observes outcomes across all
Enterprise Intelligence engines — goals, tasks, capabilities, providers,
contexts, execution strategies, execution sessions, quality scores, user
feedback, and business outcomes — and turns them into models, insights,
recommendations, and reports that improve the platform over time.

**Learning never bypasses human approval** for architectural or critical
behavioral changes: every recommendation is generated with a confidence score
and a sample count, and only becomes actionable after an explicit human
approval (versioned, rollbackable, fully audited).

## Why it exists

The Enterprise Intelligence core (EI-001…EI-006) produces and executes work.
Until EI-007, none of that execution fed back. The Learning Intelligence
Platform closes the loop: each run becomes a `LearningEvent` (category, entity,
outcome, confidence, cost, latency, accuracy, retries, quality, feedback,
business outcome), events are aggregated into `LearningModel`s, and the models
drive `LearningRecommendation`s (best provider / context / strategy /
capability / budget / prompt / execution pattern), `LearningInsight`s, and
`LearningReport`s.

## Architecture

```
src/
  types/         Learning domain types (categories, events, models, recommendations,
                 insights, reports, decisions, audit, dashboard)
  contracts/     Engine port contracts — structurally satisfied by the existing
                 six EI engine application services (no logic duplicated)
  domain/
    rules/       LearningRules — event/recommendation validation
    value-objects/ LearningEventId, RecommendationId
    repository/  LearningRepository contract
    services/    Aggregation, Recommendation, Insight, Report, Safety services
  infrastructure InMemoryLearningRepository, PostgresLearningRepository
  application/   LearningIntelligenceApplicationService + DTOs + mapper
  catalog/       Seed learning history referencing the seed goals/providers/… catalogs
```

The package depends on the engine packages (`@vedmoulya/goals`,
`@vedmoulya/capabilities`, `@vedmoulya/providers`, `@vedmoulya/context`,
`@vedmoulya/execution-strategy`, `@vedmoulya/execution-orchestrator`) **by
type and by reuse** — the recommendation service reads the engines' public
summaries through narrow ports (`contracts/learning-engines.ts`). No engine
logic is duplicated.

## Learning safety

- **Human approval:** recommendations are born `pending`; only an explicit
  `approve` makes them actionable.
- **Version history + rollback:** every state change bumps the decision
  version; an approved recommendation can be rolled back.
- **Audit trail:** every action (created / approved / rejected / rolled_back)
  appends a timestamped, actor-scoped audit entry.
- **Confidence thresholds:** recommendations are only generated above a
  minimum sample count; approval requires a higher confidence bar.

## Usage

```ts
import {
  LearningIntelligenceApplicationService,
  InMemoryLearningRepository,
} from '@vedmoulya/learning-intelligence';

const svc = new LearningIntelligenceApplicationService(
  new InMemoryLearningRepository(),
  { goals, capabilities, providers, context, strategies, orchestrator }, // the six engines
);

await svc.recordEvent({
  category: 'provider',
  entityType: 'provider',
  entityId: 'openai',
  outcome: 'success',
  confidence: 0.9,
  costUsd: 0.01,
  latencyMs: 420,
  accuracy: 0.94,
  retries: 0,
  quality: 0.92,
});
const dashboard = await svc.getDashboard();
const recs = await svc.getRecommendations(); // pending, awaiting human approval
await svc.approveRecommendation(recs.data![0].recommendationId, 'human-owner');
```

## Scope

- Learn from goals, tasks, capabilities, providers, contexts, execution
  strategies, execution sessions, quality scores, user feedback, business outcomes
- 10 learning categories: provider, context, capability, prompt, budget,
  quality, execution, business, user preference, failure
- Aggregation models, insights, recommendations, reports, analytics, timeline
- Human-approval safety workflow with version history, rollback, and audit trail
- Postgres-backed repository (`learning_registry` JSONB table, migration ready)

Explicitly **not** implemented here: execution, AI calls, provider routing, and
business modules. Those remain in their owning components.

## Tests

```bash
npm test -w packages/learning-intelligence
```
