# Learning Engine

> The continuous-improvement engine — every execution becomes a lesson that makes the platform smarter.
> Owner: Chief Enterprise Intelligence Architect · Updated: 2026-08-03 (EI-000)

## Purpose

Define the Learning Engine: the component that captures execution history, tracks success and failure, and produces improvement signals across providers, capabilities, prompts, context, budgets, and business outcomes. All learning is **human-gated** — the engine proposes; humans approve.

## Responsibilities

- Record execution history (immutable)
- Track success/failure across dimensions
- Produce learning signals: provider, capability, prompt, context, budget, business
- Propose weight/prompt/routing improvements (human-gated)
- Feed the Overall Intelligence Score's learning-velocity term

## Inputs

- Execution history (goals, tasks, providers, costs, tokens, scores, outcomes)
- Quality verdicts, approval decisions, client outcomes
- Budget adherence data
- Benchmark/health deltas
- Business outcomes (revenue, win rate, retention)

## Outputs

- **Learning Specification:** aggregated history, success/failure analytics, improvement proposals (weight updates, prompt updates, routing changes, budget recalibration), confidence in each proposal, review queue
- Learning signals consumed by every engine

## Algorithms

### Execution history

Append-only event log: task run, provider, model, capability, tier, tokens, cost, latency, quality scores, decision, outcome, lineage (goal→task). Retained with retention policy; aggregation views for analytics.

### Success tracking

- Success = task completed within budget and passed quality gate; outcome success = delivered value realized (approval, payment, client satisfaction)
- Success rate per: provider × capability, stage, task type, content type
- Decayed rates (recent outcomes weighted higher)

### Failure tracking

- Failure classification (existing FailureReason types) + where in the pipeline (stage, engine)
- Failure cost (tokens/cost/time wasted) — prioritizes fixes by waste
- Recurring-failure detection (same pattern ×N → proposal)

### Provider learning

- Per-provider success/quality/cost calibration (feeds Provider Rating)
- Provider specialization discovery (which provider wins per capability/stage)
- Fallback-order learning (which fallback actually rescued calls)

### Capability learning

- Capability score calibration from outcomes
- Capability maturity (usage × success)
- Composition learning (which compositions are efficient)

### Prompt learning

- Prompt version outcomes (which prompt variant scores higher)
- Regeneration-cause analysis (which rubric dimension fails → prompt fix)
- Prompt library updates proposed (versioned, A/B where feasible)

### Context learning

- Which context sections contributed to quality (attribution)
- Context source relevance recalibration (weights in Context Score)
- Compression loss measurement (did compression hurt quality?)

### Budget learning

- Prediction residuals (tokens/cost/latency) → recalibrate prediction models
- Slice optimization (per-stage budget weights)
- Cost-per-quality optimization (cheapest provider achieving floor)

### Business learning

- Goal value realization (predicted vs. actual Business Value)
- Client outcome learning (approvals, revenue, retention)
- Win-rate analytics (content quality vs. client acceptance)

### Continuous improvement

- Proposals batched into **review queues** (weekly cadence)
- Human approval → versioned promotion (weights, prompts, routing policies)
- Rollback on regression (versioned, reversible)
- Improvement velocity tracked as learning-velocity component of the Overall Intelligence Score

## Scoring

| Score                 | Source                      | Used for                   |
| --------------------- | --------------------------- | -------------------------- |
| Learning velocity     | improvement rate (this doc) | Overall Intelligence Score |
| Proposal confidence   | sample size + effect size   | Review prioritization      |
| Success/failure rates | this doc                    | Routing/weight inputs      |

## Decision Flow

1. Events stream in (execution, quality, outcomes)
2. Aggregator updates history + rates
3. Detectors identify improvements (weight updates, prompt fixes, routing changes, budget recalibration)
4. Proposals enter review queue with evidence and confidence
5. Human approval → promote (versioned) → measure → rollback if regression

## Failure Handling

- **Signal noise:** require minimum sample sizes before proposals (anti-overfitting)
- **Concept drift:** detect regime changes (provider pricing, model versions) → reset/decay stale learning
- **Runaway weight updates:** hard bounds (w_min, w_max) + human gate + alert
- **Data loss/corruption:** append-only log with backups; rebuild aggregates

## Learning

- Meta-learning: learn which learning signals best predict improvement (learning about learning)

## Future Expansion

- EI-008/010: autonomous-but-gated self-improvement loops
- Multi-arm bandit for prompt/provider exploration (bounded exploration budget)
- Causal outcome analysis (which interventions caused client wins)

## References

- [EI000_ENTERPRISE_INTELLIGENCE_SPECIFICATION.md](./EI000_ENTERPRISE_INTELLIGENCE_SPECIFICATION.md)
- [INTELLIGENCE_MATHEMATICS.md](./INTELLIGENCE_MATHEMATICS.md)
- [QUALITY_ENGINE_SPEC.md](./QUALITY_ENGINE_SPEC.md)
- [04_Sprints/ENTERPRISE_INTELLIGENCE/EI-008_Learning_Engine.md](../04_Sprints/ENTERPRISE_INTELLIGENCE/EI-008_Learning_Engine.md)
- [04_Sprints/ENTERPRISE_INTELLIGENCE/EI-010_Self_Improvement.md](../04_Sprints/ENTERPRISE_INTELLIGENCE/EI-010_Self_Improvement.md)
