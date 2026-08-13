# Changelog

All notable changes to `@vedmoulya/learning-intelligence` are documented here.

## [1.0.0] — 2026-08-06

### Added

- **EI-007 Enterprise Learning Intelligence Platform** — first release.
  - `LearningEvent` capture across 10 categories (provider, context, capability,
    prompt, budget, quality, execution, business, user preference, failure).
  - `LearningModel` aggregation (success rate, cost, latency, accuracy, retries,
    quality, feedback, business outcome, confidence, trend) from raw events.
  - `LearningRecommendation` generation: best provider, best context, best
    strategy, best capability, best budget, best prompt, best execution pattern.
  - `LearningInsight` and `LearningReport` derivation.
  - Learning safety: human approval, version history, rollback, audit trail,
    confidence thresholds (`LearningSafetyService` + `LearningDecision`).
  - `LearningRepository` contract with `InMemoryLearningRepository` (hermetic
    test double) and `PostgresLearningRepository` (`learning_registry` JSONB
    document table, migration ready).
  - Engine port contracts reusing the six EI engines' public summaries.
  - Seed learning history catalog referencing the seed goals/providers/
    capabilities/context catalogs.
