# Provider Benchmark Engine

> The nightly, objective measurement of every provider — capability, token, cost, quality, and enterprise benchmarks — with automatic score updates.
> Owner: Chief Enterprise Intelligence Architect · Updated: 2026-08-03 (EI-000)

## Purpose

Define the Provider Benchmark Engine: the periodic (nightly) evaluation layer that produces objective, reproducible provider scores for every capability. Benchmarks calibrate the Provider Rating Engine's quality component and detect provider/model drift. Health is the real-time layer; benchmarks are the deliberate-measurement layer.

## Responsibilities

- Run nightly benchmark suites per provider × capability
- Measure capability, token, cost, quality, and enterprise dimensions
- Maintain benchmark datasets (curated, versioned, stable)
- Automatically update provider scores from benchmark results
- Flag regressions and improvements

## Inputs

- Provider registry (adapters, model versions)
- Curated benchmark datasets (prompts, expected-quality rubrics, token expectations)
- Quality rubric definitions (Quality Engine)
- Pricing registry (per-token costs)

## Outputs

- **Benchmark Specification:** per provider × capability — scores (quality, token efficiency, cost, latency, enterprise readiness), delta vs. previous run, dataset version, run metadata
- Automatic score updates to the Provider Rating Engine
- Regression alerts

## Algorithms

### Nightly benchmark

- Schedule: nightly (registry-configurable), staggered across providers to avoid rate-limit self-harm
- Each run: N fixed prompts per capability × M providers (N, M registry-configurable; sample-limited by budget)
- Deterministic seeds for reproducibility; results stored per dataset version

### Capability benchmark

Per capability, a curated task set with expected characteristics:

- reasoning: multi-step problems with verifiable answers
- coding: fix/write tasks with test-based verification
- content_generation: brand-prompt adherence, structure, style (rubric-scored)
- summarization: faithfulness to source (RAG-style metrics)
- classification/translation: label/round-trip accuracy
- vision/speech: labeled accuracy sets (when modality available)

### Token benchmark

- Input/output token counts per prompt under identical settings
- Token efficiency score: quality per token (Q/tokens) — rewards concise high-quality output
- Expected-token calibration: compares actual vs. prediction (feeds Economy prediction)

### Cost benchmark

- Per-call cost computed from measured tokens × registry pricing
- Normalized cost score (inverted, log-scaled) across providers for the same output quality band

### Quality benchmark

- Outputs scored with the Quality Engine rubric (brand, grammar, factuality, format, requirements)
- Mean + variance across the suite; delta vs. previous run
- Hallucination rate measured on a fact-anchored subset

### Enterprise benchmark

- Non-functional: reliability under concurrent load (batch probe), rate-limit behavior, latency tail (p95), compliance flags (data governance posture, enterprise program availability)

### Automatic score updates

- Benchmark composite updates the Provider Rating quality component: `Q(p,c) = blend(prevQ, benchQ, α_bench)` (registry smoothing)
- Version-change detection (provider model update) triggers immediate benchmark for that provider
- Regressions beyond threshold → alert + automatic deprioritization (with human review)

## Scoring

| Score                 | Source                   | Used for                    |
| --------------------- | ------------------------ | --------------------------- |
| Benchmark quality     | Quality rubric (Math §6) | Provider Rating Q component |
| Token/cost efficiency | this doc                 | Economy predictions, rating |
| Enterprise readiness  | this doc                 | Rating preference component |

## Decision Flow

1. Nightly trigger → select provider×capability cells due
2. Run suite within benchmark budget → score outputs
3. Compare vs. previous run (delta) → update rating components
4. Alerts on regression/improvement → review queue
5. Store run artifacts (dataset version, results) for reproducibility

## Failure Handling

- **Provider down during run:** skip cell, mark incomplete, retry next window
- **Rate-limit during run:** backoff, resume, cap per-night spend
- **Benchmark budget exceeded:** shrink suite (prioritize critical capabilities)
- **Dataset drift:** version datasets; never compare across versions without flag

## Learning

- Benchmark suite effectiveness (which prompts best predict production quality)
- Delta-based drift detection thresholds calibrated
- Benchmark-to-production quality correlation studies

## Future Expansion

- Continuous (not nightly) micro-benchmarks for high-churn providers
- Private client-brand benchmark sets (benchmark with client's brand guidelines)
- Benchmark results published to dashboards (Langfuse/Grafana)

## References

- [EI000_ENTERPRISE_INTELLIGENCE_SPECIFICATION.md](./EI000_ENTERPRISE_INTELLIGENCE_SPECIFICATION.md)
- [PROVIDER_HEALTH_ENGINE.md](./PROVIDER_HEALTH_ENGINE.md)
- [QUALITY_ENGINE_SPEC.md](./QUALITY_ENGINE_SPEC.md)
- [INTELLIGENCE_MATHEMATICS.md](./INTELLIGENCE_MATHEMATICS.md)
- [AI_PROVIDER_MATRIX.md](./AI_PROVIDER_MATRIX.md)
