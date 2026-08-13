# Intelligence Mathematics

> The complete mathematical model of the Enterprise Intelligence Core — flexible, weighted, learnable scoring.
> Owner: Chief Enterprise Intelligence Architect · Version: 1.0 · Updated: 2026-08-03 (EI-000)

## Purpose

Define every scoring equation used by the Enterprise Intelligence engines. Models are **parameterized, never hardcoded**: all weights live in a weight registry, are normalized (Σw = 1 per model), and are learnable by the Learning Engine within guardrails. All scores are normalized to [0,1] unless stated otherwise.

## Responsibilities

- Provide the canonical equations for all 10 required scores
- Define normalization, decay, and aggregation conventions
- Define the weight registry and update rules (human-gated)
- Ensure consistency across engines (same symbols, same conventions)

## Inputs

- Raw telemetry: latency (p50/p95), cost (input/output per token), error rate, tokens, quality rubric scores, outcome success/failure, preferences, benchmark scores
- Weight registry (per model, per capability where applicable)
- History tables (execution history, provider statistics, learning signals)

## Outputs

- Canonical equations for: Provider Score, Capability Score, Goal Score, Task Priority, Context Score, Quality Score, Confidence Score, Business Value Score, Execution Score, Overall Intelligence Score
- Normalization and weight-update rules

## Algorithms

### Conventions

- All weights: `w ∈ [0,1]`, Σw = 1 within a model (unless noted).
- All component scores: normalized to [0,1] before weighting.
- Decay: `decay(x, t) = x · e^(−λ·t)` for time-sensitive signals (recency of historical success).
- Log-normalization for latency/cost: `norm(v) = (log(1+v) − log(1+min)) / (log(1+max) − log(1+min))` clamped to [0,1].
- Min-max for bounded metrics: `norm(v) = (v − min) / (max − min)`.
- Sample-size confidence: `conf(n) = n / (n + n₀)` with `n₀` a smoothing constant (registry value).

### 1. Provider Score

Composite per (provider p, capability c):

```
ProviderScore(p,c) =
  w_Q · Q(p,c)            quality (evals/benchmarks, [0,1])
+ w_L · (1 − L̂(p,c))      latency (normalized, inverted: lower is better)
+ w_C · (1 − Ĉ(p,c))      cost (normalized, inverted)
+ w_R · R(p,c)            reliability (1 − error rate)
+ w_H · H(p,c)            historical success (decayed hit-rate)
+ w_P · P(p,c)            preference (client/enterprise, [0,1])
+ w_B · B(p,c)            benchmark score (nightly, [0,1])
```

With confidence gating: `EffectiveScore = ProviderScore · conf(n)` where `conf(n) = n/(n+n₀)`. Low-sample providers blend toward the benchmark prior: `Final = conf·score + (1−conf)·prior`.

Weights `w_Q…w_B` are capability-specific (e.g., `coding` emphasizes quality+latency; `content_generation` emphasizes creativity+quality) and live in the weight registry.

### 2. Capability Score

How well the platform can perform capability c today:

```
CapabilityScore(c) =
  w_avail · Avail(c)          provider coverage: Σ_p (supports(c,p) · health(p)) / |P|
+ w_best · ProviderScore(best_p, c)
+ w_fb · FallbackScore(c)     strength of fallback set (2nd/3rd best weighted)
+ w_m · Maturity(c)           usage history maturity (samples, outcomes)
```

Used by the Capability Engine for composition and by the Brain to decide whether a capability is production-ready vs. needs a POC.

Where: `Avail(c) = Σ_p (supports(c,p) · health(p)) / |P|` (provider coverage, health from PROVIDER_HEALTH_ENGINE); `ProviderScore(best_p, c)` is the top provider score from §1; `FallbackScore(c) = Σ_{p∈fallback} ProviderScore(p,c) · fallbackWeight(p)` (strength of the 2nd/3rd-ranked providers, defined here); `Maturity(c) = conf(totalSamples) · successRate(c)` (usage maturity, defined here; samples + outcomes from LEARNING_ENGINE).

### 3. Goal Score

Value of pursuing goal g now:

```
GoalScore(g) =
  w_bv · BusinessValue(g)     see Business Value Score
+ w_prio · Priority(g)        strategic priority (registry or owner)
+ w_conf · Confidence(g)      probability of success (goal confidence)
+ w_ur · Urgency(g)           deadline/time pressure [0,1]
+ w_align · Alignment(g)      alignment with mission/North Star
```

Weighted by goal type (revenue vs. learning vs. compliance). Supports the Goal Engine lifecycle (proposed → scored → accepted → active → completed/archived).

### 4. Task Priority

Scheduling priority of task t within its plan:

```
TaskPriority(t) =
  w_cp · CriticalPath(t)      is t on the critical path (1) / slack (0..1)
+ w_dep · DependencyWeight(t) sum of priorities of downstream dependents
+ w_due · DeadlinePressure(t) time until due, inverted
+ w_val · ValueShare(t)       share of parent goal value
+ w_risk · Risk(t)            risk of delay propagation
```

Used by the Parallel Execution Engine to order ready-set workers.

Where: `CriticalPath(t)` = 1 if t is on the critical path else slack-based fraction (TASK_ENGINE); `DependencyWeight(t) = Σ max TaskPriority of direct dependents`; `DeadlinePressure(t) = clamp(1 − timeUntilDue/deadlineWindow, 0, 1)`; `ValueShare(t) = parentGoalValue · share(t)` (GOAL_ENGINE); `Risk(t) = 1 − TaskConfidence(t)` (§7 adapted). All defined here for reference.

### 5. Context Score

Quality of a context candidate k for task t:

```
ContextScore(k,t) =
  w_rel · Relevance(k,t)      semantic + keyword match
+ w_rec · Recency(k)          decayed age
+ w_conf · SourceConfidence(k) source trust (client data > derived > web)
+ w_div · Diversity(k)        novel information vs already-selected set
− w_red · Redundancy(k)       overlap with selected context
− w_noise · Noise(k)          irrelevance/duplication penalty
```

Selection: greedy top-k by ContextScore until the target token envelope is filled (Context Intelligence).

### 6. Quality Score

Rubric-weighted output quality (per `QUALITY_ENGINE_SPEC.md`):

```
QualityScore(o) =
  w_brand · Brand(o)          brand voice/guidelines adherence
+ w_grammar · Grammar(o)      language correctness
+ w_seo · SEO(o)              SEO/optimization rubric (when applicable)
+ w_fact · Factuality(o)      hallucination check inverted risk
+ w_biz · Business(o)         business validation (client/project fit)
+ w_fmt · Format(o)           output-format/schema compliance
+ w_req · Requirements(o)     task requirement coverage
```

Rubric weights depend on content type. Thresholds (registry): `accept ≥ τ_accept`, `regenerate if τ_regen ≤ score < τ_accept`, `reject < τ_regen`.

### 7. Confidence Score

Confidence in an output o (or a provider, or a decision):

```
Confidence(o) =
  w_q · QualityScore(o)
+ w_v · Validation(o)         validation checks passed (schema, business rules)
+ w_hist · History(p)         provider/capability historical success (decayed)
+ w_ctx · ContextConfidence   context bundle confidence
+ w_agree · Agreement(o)      multi-provider agreement (when sampled) or self-consistency
− w_low · LowSamplePenalty    (1 − conf(n))
```

Confidence levels: high (≥0.8), medium (0.6–0.8), low (0.4–0.6), very_low (<0.4) — aligns with existing `Confidence` type.

### 8. Business Value Score

Economic value of a goal/task/client action:

```
BusinessValue(g) =
  w_rev · RevenueImpact(g)    expected revenue (normalized)
+ w_ret · Retention(g)        client retention impact
+ w_strat · Strategic(g)      strategic importance (registry)
+ w_cost · CostImpact(g)      (1 − cost) — cheaper wins
− w_risk · Risk(g)            downside/execution risk
```

Used by the Goal Engine and the Enterprise Brain for prioritization and by Business Analytics for reporting.

### 9. Execution Score

How well an execution graph run performed:

```
ExecutionScore(run) =
  w_com · Completion(run)     fraction of tasks completed successfully
+ w_eff · Efficiency(run)     actual time/tokens vs. budget
+ w_qual · Quality(run)       mean quality score of outputs
+ w_timely · Timeliness(run)  on-time completion
− w_fail · FailureRate(run)   retries/failures normalized
```

Feeds the Learning Engine and the Overall Intelligence Score.

### 10. Overall Intelligence Score

The platform-level KPI — how intelligent the system is right now:

```
IntelligenceScore =
  w_g · Ĝ   mean goal attainment (Goal Engine)
+ w_e · Ê   mean execution score (Execution)
+ w_q · Q̂   mean output quality (Quality Engine)
+ w_l · L̂   learning velocity (improvement rate over time)
+ w_eco · Eco economy efficiency (value per token/cost)
+ w_b · Biz business outcomes (revenue/win rate)
```

Reported on the Enterprise Brain dashboard; tracked over time to demonstrate continuous improvement (learning velocity term).

### Weight update rule (Learning Engine)

```
w_new = clamp(w_old + α · Δoutcome · ∂score/∂w, w_min, w_max)
```

- `α` = learning rate (registry), `Δoutcome` = outcome residual (actual − expected, e.g., quality surprise)
- Updates are **human-gated**; batch review before promotion
- Per-capability weight matrices versioned in the weight registry

## Scoring

See per-engine docs for which scores each engine consumes/emits. All scores serialize into typed documents with lineage (which inputs produced them).

## Decision Flow

1. Registry provides weights (versioned, auditable).
2. Engines compute component scores from telemetry + history.
3. Composite scores gate decisions (accept/route/prioritize).
4. Outcomes produce residuals → Learning Engine → proposed weight updates → human approval.

## Failure Handling

- Missing telemetry → use registry defaults/priors with reduced confidence
- Division by zero / empty sets → score = prior (registry), flag low confidence
- Weight drift out of bounds → clamp + alert

## Learning

- Residuals (actual vs. predicted score) are the primary learning signal
- Weight updates are logged, versioned, reversible

## Future Expansion

- Bayesian scoring extensions (posterior provider quality)
- Multi-objective optimization for weight learning
- Online calibration of thresholds (τ_accept, τ_regen)

## References

- All engine specs (scoring sections)
- [ENTERPRISE_BRAIN_SPEC.md](./ENTERPRISE_BRAIN_SPEC.md)
- [LEARNING_ENGINE_SPEC.md](./LEARNING_ENGINE_SPEC.md)
- `packages/ai/src/types/index.ts` (existing Confidence, Latency, ProviderStatistics types)
