# Changelog

All notable changes to `@vedmoulya/enterprise-brain` are documented here.

## [1.0.0] — 2026-08-06

### Added

- **EI-008 Enterprise Brain — Central Decision Intelligence** — first release.
  - 14 `BrainDecision` types: goal priority, task priority, execution order,
    capability selection, provider selection, context strategy, execution
    strategy, budget strategy, quality thresholds, risk assessment, retry
    policy, fallback policy, learning feedback, business objectives.
  - `BrainDecisionPlan` per goal with an 11-step pipeline trace (Receive Goal →
    Analyze → Consult every engine → Generate → Explain → Pass to Orchestrator)
    and an overall confidence score.
  - Full explainability on every decision: why, evidence, confidence
    (score/level/factors), trade-offs, alternatives, and risks
    (`BrainExplainerService`).
  - `BrainPlanService` consults all seven EI engines through narrow ports
    (goals, learning, capabilities, providers, context, strategies,
    orchestrator) with graceful degradation when an engine is unavailable.
  - Human-approval workflow: approve/reject decisions and plans, hand an
    approved plan to the Execution Orchestrator (`handOffPlan`); every
    transition bumps the version and appends an audited history entry
    (DecisionHistory). Re-deciding a goal supersedes the previous plan.
  - `BrainRepository` contract with `InMemoryBrainRepository` (hermetic test
    double) and `PostgresBrainRepository` (`brain_registry` JSONB table keyed
    by `(collection, id)` — decisions + plans, migration ready).
  - `BrainMetricsService` (totals, per-type/per-status counts, average
    confidence, high-confidence count, zero-filled daily trend) and the
    Enterprise Brain Dashboard aggregate.
  - Seed catalog: one fully explained plan (`plan_goal_blog_seed_seed`) with
    all 14 decisions referencing the seed goals/providers/capabilities/
    strategies/contexts the other EI catalogs seed.
