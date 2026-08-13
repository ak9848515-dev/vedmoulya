# Enterprise Learning Intelligence Platform

> VedMoulya learns from every execution — and improves itself over time without ever bypassing human approval.
> Owner: AI Platform Team · Updated: 2026-08-06 (EI-007)

## Purpose

Document the Enterprise Learning Intelligence Platform (`packages/learning-intelligence`, EI-007): the engine that turns every execution outcome — goals, tasks, capabilities, providers, contexts, execution strategies, execution sessions, quality scores, user feedback, and business outcomes — into learning. Learning improves the platform continuously across provider selection, context selection, execution strategies, quality, recommendations, and business intelligence.

## Scope

- Learning signals (events) across 10 categories
- Aggregation models, insights, recommendations, reports, analytics, timeline
- Human-approval safety workflow (version history, rollback, audit trail, confidence thresholds)
- Postgres persistence (`learning_registry` JSONB) + in-memory test double
- `learningIntelligence.*` API namespace + `/learning-intelligence` web dashboard
- Learning seed catalog + `seed:ei` integration

Explicitly **not** implemented here: execution, AI calls, provider routing, and business modules — those remain in their owning components. Learning observes and recommends; it never executes.

## Architecture

```
Execution outcomes (goals · tasks · capabilities · providers · contexts ·
strategies · sessions · quality · feedback · business)
        │  recorded as
        ▼
LearningEvent  (category · entity · outcome · confidence · cost · latency ·
                accuracy · retries · quality · feedback · business outcome)
        │  aggregated by
        ▼
LearningModel  (per-entity success rate, averages, confidence, trend)
        │  derived by
        ├──► LearningRecommendation  (best provider / context / strategy /
        │                            capability / budget / prompt / pattern)
        ├──► LearningInsight        (info / warning / critical)
        └──► LearningReport         (per-category reports)

Human approval gate (LearningSafetyService + LearningDecision):
  recommendation ─ pending ─► approve ─► approved ─► rollback ─► rolled_back
                              └► reject ─► rejected
  every transition bumps the version and appends an audit entry.
```

## Learning categories (10)

Provider · Context · Capability · Prompt · Budget · Quality · Execution · Business · User Preference · Failure

## Key components

| Component                                | Responsibility                                                                                                       |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `LearningEvent`                          | The atom of learning — one observed outcome about one entity                                                         |
| `LearningAggregationService`             | Events → per-entity models (success rate, cost, latency, quality, confidence, trend) + category stats + 14-day trend |
| `LearningRecommendationService`          | The seven best-* recommendations, scored and enriched from the live engine registries through narrow ports           |
| `LearningInsightService`                 | Advisory insights with severity (info/warning/critical)                                                              |
| `LearningReportService`                  | Per-category reports with top + at-risk entities                                                                     |
| `LearningSafetyService`                  | Human approval, version history, rollback, audit trail, confidence thresholds                                        |
| `LearningRepository`                     | Event + decision persistence contract (InMemory / Postgres)                                                          |
| `LearningIntelligenceApplicationService` | API facade over all domain services                                                                                  |
| `LearningEngines`                        | Port contracts structurally satisfied by the six existing EI engines                                                 |

## Integration (no architectural drift)

The platform **reuses** the six existing engines through narrow port contracts
(`contracts/learning-engines.ts`): goals, capabilities, providers, context,
strategies, and orchestrator summaries enrich recommendations and dashboards.
No engine was modified; no logic is duplicated. Persistence follows the same
JSONB-document pattern as the other EI stores, and the gateway wires the
Postgres repository as the production default exactly like EI-001…EI-006.

## Safety principle

> **Learning must NEVER bypass human approval for architectural or critical behavioral changes.**

Recommendations are derived from observed data, born `pending`, gated on
sample count and confidence, and only become actionable through an explicit,
versioned, audited human approval that can always be rolled back.

## Dependencies

- `packages/learning-intelligence` (new, EI-007)
- Engine packages: `@vedmoulya/goals`, `@vedmoulya/capabilities`, `@vedmoulya/providers`, `@vedmoulya/context`, `@vedmoulya/execution-strategy`, `@vedmoulya/execution-orchestrator`
- `services/api` gateway (`learningIntelligence.*` namespace)
- `apps/web` (`/learning-intelligence` dashboard)
- [ENTERPRISE_INTELLIGENCE.md](./ENTERPRISE_INTELLIGENCE.md), [LEARNING_ENGINE.md](./LEARNING_ENGINE.md) (business learning module), [QUALITY_ENGINE.md](./QUALITY_ENGINE.md)

## Future Work

- Real-time ingestion from execution sessions (orchestrator event stream)
- Spaced-repetition and user-preference personalization (EI-009/010 groundwork)
- Automated report scheduling and export
- Provider rating / health / benchmark consumption of learning data

## References

- [04_Sprints/ENTERPRISE_INTELLIGENCE/EI-007_Learning_Intelligence.md](../04_Sprints/ENTERPRISE_INTELLIGENCE/EI-007_Learning_Intelligence.md)
- [09_Documents/EI-007_Completion_Report.md](../09_Documents/EI-007_Completion_Report.md)
- [SYSTEM_OVERVIEW.md](./SYSTEM_OVERVIEW.md)
