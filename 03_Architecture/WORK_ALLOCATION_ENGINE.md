# Work Allocation Engine

> How work is divided across stages — and how each stage may use a different provider. One of VedMoulya's biggest differentiators.
> Owner: Chief Enterprise Intelligence Architect · Updated: 2026-08-03 (EI-000)

## Purpose

Define the Work Allocation Engine: the component that divides a task's work across the content lifecycle stages — Research → Writing → Review → SEO → Publishing → Validation → Learning — and assigns each stage to the optimal provider/capability. This is a differentiator because it enables per-stage provider specialization (e.g., cheap research, premium writing, specialized SEO) under one unified quality floor.

## Responsibilities

- Model the stage pipeline and stage contracts
- Assign each stage to a capability + provider + tier + budget slice
- Manage stage handoffs (typed artifacts between stages)
- Enforce the quality floor across stages
- Emit the Work Allocation Specification

## Inputs

- Task Planning Specification (Task Engine)
- Provider Rating matrix (per capability)
- Budget envelope (AI Economy)
- Stage quality requirements (registry per content type)

## Outputs

- **Work Allocation Specification:** stage sequence, per-stage (capability, provider, tier, budget slice, quality target, artifact contract, owner), handoff schema, fallback providers per stage
- Stage-level predictions (cost/tokens/latency) aggregated into the envelope

## Algorithms

### Stage pipeline

```
Research → Writing → Review → SEO → Publishing → Validation → Learning
```

- **Research:** gather and synthesize sources (knowledge/document retrieval + reasoning/summarization)
- **Writing:** generate draft (content_generation, premium tier typically)
- **Review:** editorial pass — brand, grammar, structure (classification/summarization + reasoning)
- **SEO:** optimization pass when applicable (classification/summarization; may be skipped)
- **Publishing:** format/output compliance, delivery handoff (execution, non-AI)
- **Validation:** quality scoring, fact verification, business validation (Quality Engine)
- **Learning:** outcome capture (Learning Engine)

Stage set is **configurable per task type** (content article vs. proposal vs. code task) — the pipeline above is the default for content generation.

### Stage-to-provider assignment

For each stage, choose provider from the allowed set (Provider Rating + budget):

```
selectProvider(stage) = argmax(ProviderScore(p, stage.capability))
  subject to: p ∈ allowed set, cost(stage) ≤ budgetSlice, latency ≤ latencyBudget
```

Different providers across stages is the norm — e.g., economy research provider, premium writer, cheap SEO pass. Providers are never hardcoded; the rating engine drives the choice.

### Handoff contracts

Each stage emits a typed artifact consumed by the next:

- Research → `research_brief` (sources, key points, confidence)
- Writing → `draft` (content, sections, self-score)
- Review → `reviewed_draft` (edits, flags)
- SEO → `optimized_draft` (metadata, keywords)
- Publishing → `published_artifact` (formats, delivery record)
- Validation → `quality_verdict` (scores, approval)
- Learning → `learning_signal` (outcomes)

Handoff schema validation prevents contract drift between stages.

### Stage quality targets

Per-stage minimum QualityScore (registry): Review cannot pass a draft that scores below the writing floor; Validation enforces the task-level quality target. Stage weights in the Quality Score adapt by content type.

### Cross-stage budget slicing

Budget envelope is sliced across stages: `Σ budgetSlice(stage) ≤ envelope`. Slicing is weight-driven (defaults by stage, learnable from actuals) and re-balanced mid-run when a stage overspends (borrow from low-risk stages, never from quality floor).

## Scoring

| Score                 | Source                   | Used for               |
| --------------------- | ------------------------ | ---------------------- |
| Stage provider choice | ProviderScore (Math §1)  | Per-stage provider     |
| Stage quality         | QualityScore (Math §6)   | Stage gates            |
| Allocation efficiency | actual vs. sliced budget | Re-balancing, learning |

## Decision Flow

1. Task arrives → resolve stage set for task type
2. For each stage: pick capability, tier, provider (rating-constrained), budget slice
3. Validate handoff schema chain; emit Work Allocation Specification
4. Execution runs stages (sequential or overlapped per Execution Graph)
5. Stage quality gates pass/fail → proceed/regenerate/fallback provider
6. Record actuals → learning (allocation model calibration)

## Failure Handling

- **Stage provider fails:** switch to fallback provider for that stage (recompute slice if cost differs)
- **Stage quality below floor:** regeneration within budget; if budget exhausted → escalate to Brain (re-plan stage or task)
- **Handoff contract violation:** block stage, alert owner
- **Budget slice overspend:** re-balance from flexible slices or request envelope increase

## Learning

- Per-stage cost/quality/latency models (which provider won at which stage)
- Optimal slicing weights per task type
- Stage failure patterns (which stage needs better providers)
- Provider specialization discovery (e.g., "Anthropic wins Writing, DeepSeek wins Research")

## Future Expansion

- Stage templates per module (proposals, contracts, learning paths)
- A/B stage configurations (which pipeline shape maximizes quality/cost)
- Client-brand-specific stage weights

## References

- [EI000_ENTERPRISE_INTELLIGENCE_SPECIFICATION.md](./EI000_ENTERPRISE_INTELLIGENCE_SPECIFICATION.md)
- [INTELLIGENCE_MATHEMATICS.md](./INTELLIGENCE_MATHEMATICS.md)
- [EXECUTION_GRAPH.md](./EXECUTION_GRAPH.md)
- [QUALITY_ENGINE_SPEC.md](./QUALITY_ENGINE_SPEC.md)
- [LEARNING_ENGINE_SPEC.md](./LEARNING_ENGINE_SPEC.md)
