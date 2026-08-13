# EI-000 — Enterprise Intelligence Specification

> The master architecture specification for the Enterprise Intelligence Core — how VedMoulya thinks, plans, learns, allocates work, selects providers, minimizes cost, maximizes quality, and continuously improves.
> Owner: Chief Enterprise Intelligence Architect · Version: 1.0 · Updated: 2026-08-03 (EI-000)

## Purpose

Define the complete architecture of the Enterprise Intelligence Core — the central brain of VedMoulya. Every business module executes through it. This document is the foundation for every future Enterprise Intelligence sprint (EI-001+). It is a specification: architecture, algorithms, mathematical models, interfaces, workflows, and documentation only. **No implementation.**

## Responsibilities

- Define the 13 engines, their contracts, and their interactions
- Define the data flow: Goal → Task → Capability → Context → Economy → Provider → Execution → Quality → Learning
- Define scoring mathematics (delegated to `INTELLIGENCE_MATHEMATICS.md`)
- Define the Enterprise Brain as the master decision engine
- Set the guardrails: budgeted, explainable, quality-scored, continuously improving AI
- Ground every design in the existing VedMoulya stack (capabilities, quality tiers, provider families, engines) — nothing invented as implemented

## Inputs

- Business goals and user intents (from all modules: Content Agency, Career, Learning, Business, Client Ops)
- Capability taxonomy (`packages/ai`: reasoning, coding, vision, embeddings, summarization, classification, translation, speech, image_understanding, general_conversation, content_generation)
- Quality tiers (premium, standard, economy, free) and provider families (openai, anthropic, google, deepseek, openrouter, ollama, mock)
- Existing engine services: Memory, Knowledge, Decision, Execution, Learning
- Technology research (OSR-001): LiteLLM (wrap), Hatchet (wrap), LangGraph (wrap), Langfuse (adopt), Promptfoo (adopt), Infisical (adopt), rate-limiter-flexible (wrap), faster-whisper (adopt), Unstructured (wrap)

## Outputs

- This master specification
- Thirteen engine specifications (this file + per-engine files)
- Mathematical models (`INTELLIGENCE_MATHEMATICS.md`)
- Execution graph model (`EXECUTION_GRAPH.md`)
- The blueprint for EI-001+ sprints

## Architecture

The Enterprise Intelligence Core is a **pipeline of engines** orchestrated by the **Enterprise Brain**. All AI execution flows through this pipeline; no business module calls a provider directly.

```
                     ┌─────────────────────────────────────────────┐
                     │           ENTERPRISE BRAIN                 │
                     │  receive → understand → plan → choose      │
                     │  capabilities → choose providers →         │
                     │  allocate → monitor → validate → learn     │
                     └───────┬──────────────────────────┬─────────┘
                             │                          │
        ┌────────────────────▼────────────────┐   ┌─────▼──────────────────────┐
        │  GOAL ENGINE        (G)             │   │  PROVIDER HEALTH ENGINE (H) │
        │  TASK PLANNER       (T)             │   │  PROVIDER RATING ENGINE (R) │
        │  CAPABILITY ENGINE  (C)             │   │  PROVIDER BENCHMARK (B)      │
        └────────────────────┬────────────────┘   └─────┬──────────────────────┘
                             │                          │
        ┌────────────────────▼────────────────┐   ┌─────▼──────────────────────┐
        │  CONTEXT INTELLIGENCE (X)           │   │  AI ECONOMY ENGINE (E)      │
        │  retrieval/filter/compress/rank     │   │  token/cost/latency/quality │
        └────────────────────┬────────────────┘   └─────┬──────────────────────┘
                             │                          │
        ┌────────────────────▼────────────────┐         │
        │  WORK ALLOCATION (W)               │         │
        │  research→write→review→SEO→publish │         │
        │  →validate→learn (per-provider)    │         │
        └────────────────────┬────────────────┘         │
                             │                          │
        ┌────────────────────▼────────────────┐         │
        │  PARALLEL EXECUTION (P)             │         │
        │  dependency graph · workers · sync  │         │
        └────────────────────┬────────────────┘         │
                             │                          │
        ┌────────────────────▼────────────────┐         │
        │  QUALITY ENGINE (Q)                 │         │
        │  score/validate/approve/retry       │         │
        └────────────────────┬────────────────┘         │
                             │                          │
        ┌────────────────────▼────────────────┐         │
        │  LEARNING ENGINE (L)                │─────────┘
        │  outcomes → weights/prompts/routing │
        └────────────────────┬────────────────┘
                             │
        ┌────────────────────▼────────────────┐
        │  MEMORY · KNOWLEDGE · DECISION ·    │
        │  EXECUTION (existing engines)       │
        └─────────────────────────────────────┘
```

### Engine contracts (interface level)

Every engine exposes: `inputs`, `outputs`, `scoring`, `decision flow`, `failure handling`, `learning hooks`. Engines communicate via typed **documents** (Goal Specification, Task Plan, Context Bundle, Budget Envelope, Provider Rating, Work Allocation, Execution Graph, Quality Verdict, Learning Signal) — not ad-hoc calls.

### Data lineage

Every decision is traceable: goal → tasks → capabilities → providers → costs → quality scores → outcomes. This lineage feeds the Learning Engine and explainability (Decision Engine reuse).

## Algorithms

- Goal scoring, task decomposition, critical path (see `GOAL_ENGINE.md`, `TASK_ENGINE.md`)
- Capability scoring and composition (`CAPABILITY_ENGINE.md`)
- Context assembly: retrieve → filter → compress → rank (`CONTEXT_INTELLIGENCE` section below)
- Budget enforcement: token/cost/latency/quality/provider/execution (`EXECUTION_STRATEGY_ENGINE_SPEC.md`)
- Provider rating: quality, latency, cost, reliability, reasoning, coding, creativity, vision, long-context, history, preference, confidence (`PROVIDER_RATING` section below)
- Work allocation: stage-to-provider assignment (`WORK_ALLOCATION_ENGINE.md`)
- Parallel scheduling: dependency graph, workers, sync, retry, timeout, recovery (`EXECUTION_GRAPH.md`)
- Quality: rubric scoring, brand validation, hallucination detection, approval (`QUALITY_ENGINE_SPEC.md`)
- Health: availability, latency, failures, rate limits, cost/version changes, auto-routing (`PROVIDER_HEALTH_ENGINE.md`)
- Benchmark: nightly runs, capability/token/cost/quality/enterprise (`PROVIDER_BENCHMARK_ENGINE.md`)
- Learning: history, success/failure, provider/capability/prompt/context/budget/business learning (`LEARNING_ENGINE_SPEC.md`)
- Master decisions: `ENTERPRISE_BRAIN_SPEC.md`

## Scoring

All scores are weighted, normalized to [0,1], and **never hardcoded** — weights are registry-managed and learnable. See `INTELLIGENCE_MATHEMATICS.md` for the full model:

- Provider Score, Capability Score, Goal Score, Task Priority, Context Score, Quality Score, Confidence Score, Business Value Score, Execution Score, Overall Intelligence Score

## Decision Flow

1. **Enterprise Brain** receives a Goal → understands business context (memory/knowledge/decision) → invokes Goal Engine.
2. **Goal Engine** scores, prioritizes, and produces a Goal Specification.
3. **Task Planner** decomposes into a dependency-ordered Task Plan with critical path.
4. **Capability Engine** resolves each task to capabilities (with composition where needed).
5. **Context Intelligence** assembles the minimum necessary context (memory/knowledge/documents/business/client) with confidence.
6. **Enterprise Execution Strategy Engine** (EI-004) creates the execution strategy and binds a budget envelope (tokens, cost, latency, quality, provider, execution).
7. **Provider Rating + Health** produce the candidate ranking; Enterprise Brain selects.
8. **Work Allocation** divides the work across stages and providers.
9. **Parallel Execution** runs the execution graph with sync/retry/timeout.
10. **Quality Engine** scores, validates, approves or requests regeneration.
11. **Learning Engine** records outcomes and emits improvement signals.
12. Outcomes persist to Memory/Knowledge; dashboards reflect the overall Intelligence Score.

## Failure Handling

- Per-engine failure states and recovery are specified in each engine document
- Cross-engine: **budget exceeded** aborts the branch; **provider unavailable** triggers fallback (max 5 attempts per `fallbackRule`); **quality below threshold** triggers regeneration (bounded); **context window exceeded** triggers compression/pruning; **timeout** triggers retry with backoff
- All failures are recorded as learning signals (never silent)

## Learning

- Every engine emits learning signals (outcomes, scores, failures)
- Learning Engine aggregates: provider/capability/prompt/context/budget/business learning
- Weight adjustments are **human-gated** (no autonomous self-modification)
- See `LEARNING_ENGINE_SPEC.md` and `INTELLIGENCE_MATHEMATICS.md` (weight update rules)

## Future Expansion

- EI-001 Capability Registry service (implemented)
- EI-003 Context Intelligence service (implemented)
- EI-004 Enterprise Execution Strategy Engine (implemented)
- EI-005 Budget Enforcement & Spend Dashboards (Planned)
- EI-006 Task Planner + Goal Analyzer (Planned)
- EI-007 Scheduler over Hatchet (Planned)
- EI-008/010 Learning & Self-Improvement (Designed)
- EI-009 Enterprise Brain synthesis (Designed/Research)
- External tech wrap points per `TECHNOLOGY_REGISTRY.md` (LiteLLM, LangGraph, Hatchet, Langfuse, Promptfoo)

## References

- [INTELLIGENCE_MATHEMATICS.md](./INTELLIGENCE_MATHEMATICS.md)
- [GOAL_ENGINE.md](./GOAL_ENGINE.md)
- [TASK_ENGINE.md](./TASK_ENGINE.md)
- [CAPABILITY_ENGINE.md](./CAPABILITY_ENGINE.md)
- [EXECUTION_STRATEGY_ENGINE_SPEC.md](./EXECUTION_STRATEGY_ENGINE_SPEC.md)
- [WORK_ALLOCATION_ENGINE.md](./WORK_ALLOCATION_ENGINE.md)
- [PROVIDER_HEALTH_ENGINE.md](./PROVIDER_HEALTH_ENGINE.md)
- [PROVIDER_BENCHMARK_ENGINE.md](./PROVIDER_BENCHMARK_ENGINE.md)
- [QUALITY_ENGINE_SPEC.md](./QUALITY_ENGINE_SPEC.md)
- [LEARNING_ENGINE_SPEC.md](./LEARNING_ENGINE_SPEC.md)
- [ENTERPRISE_BRAIN_SPEC.md](./ENTERPRISE_BRAIN_SPEC.md)
- [EXECUTION_GRAPH.md](./EXECUTION_GRAPH.md)
- [ENTERPRISE_INTELLIGENCE.md](./ENTERPRISE_INTELLIGENCE.md)
- [ENTERPRISE_INTELLIGENCE_BLUEPRINT.md](./ENTERPRISE_INTELLIGENCE_BLUEPRINT.md)

---

## Engine Reference (Summary of All 13)

| #   | Engine                               | File                                | Core Output                                 |
| --- | ------------------------------------ | ----------------------------------- | ------------------------------------------- |
| 1   | Goal Engine                          | `GOAL_ENGINE.md`                    | Goal Specification Document                 |
| 2   | Task Planner                         | `TASK_ENGINE.md`                    | Task Planning Specification                 |
| 3   | Capability Engine                    | `CAPABILITY_ENGINE.md`              | Capability Specification                    |
| 4   | Context Intelligence                 | (this spec §)                       | Context Intelligence Specification          |
| 5   | Enterprise Execution Strategy Engine | `EXECUTION_STRATEGY_ENGINE_SPEC.md` | Enterprise Execution Strategy Specification |
| 6   | Provider Rating                      | (this spec §)                       | Provider Rating Specification               |
| 7   | Work Allocation                      | `WORK_ALLOCATION_ENGINE.md`         | Work Allocation Specification               |
| 8   | Parallel Execution                   | `EXECUTION_GRAPH.md`                | Execution Specification                     |
| 9   | Quality Engine                       | `QUALITY_ENGINE_SPEC.md`            | Quality Specification                       |
| 10  | Learning Engine                      | `LEARNING_ENGINE_SPEC.md`           | Learning Specification                      |
| 11  | Provider Health                      | `PROVIDER_HEALTH_ENGINE.md`         | Health Specification                        |
| 12  | Provider Benchmark                   | `PROVIDER_BENCHMARK_ENGINE.md`      | Benchmark Specification                     |
| 13  | Enterprise Brain                     | `ENTERPRISE_BRAIN_SPEC.md`          | Master Decision Engine                      |

---

## Context Intelligence Engine (Specification)

**Purpose:** Assemble the minimum necessary context for every AI call, with confidence.
**Responsibilities:** Own context assembly — retrieval from all sources, filtering, ranking, selection, compression, and minimal prompt generation — enforcing the constitution's minimum-context principle and reporting expected token reduction for every call.
**Inputs:** Memory retrieval, Knowledge retrieval, Document retrieval (Unstructured-wrapped ingestion), Business retrieval (module state), Client retrieval (client profile/brand); the task's context requirements.
**Outputs:** Context Bundle (typed sections, token count, per-source confidence), pruning decisions, compression plan, **minimal prompt** (generated from the selected bundle), **expected token reduction** (predicted tokens saved vs. unfiltered context), predicted tokens saved.
**Algorithms:**

1. Retrieve candidates from each source (top-k by embedding + keyword).
2. Filter: dedupe, relevance threshold, recency, permission scope (client/business isolation).
3. Rank: Context Score per candidate (see Mathematics: Context Score).
4. Select: minimum set satisfying the task's context requirements (target token envelope).
5. Generate minimal prompt from the selected bundle using the task template (system + task + selected context only).
6. Compress: if still over envelope — prune lowest-ranked, then optional lossy compression (LLMLingua worker, Research) with confidence penalty.
7. Emit Context Bundle with `contextConfidence` and `expectedTokenReduction` (baseline unfiltered tokens − bundle tokens).
   **Scoring:** Context Score = weighted (relevance, recency, source confidence, diversity − redundancy − noise).
   **Decision Flow:** Task requirement → retrieval plan → candidates → filter → rank → select → minimal prompt → compress if needed → bundle.
   **Failure Handling:** No candidates → fall back to task-only prompt with low confidence flag; retrieval timeout → degrade source; permission violation → drop source and audit.
   **Learning:** Track which context sections improved quality scores (attribution); feed weight updates for source relevance; calibrate token-reduction predictions.
   **Future Expansion:** EI-003/004 service builds; semantic cache (GPTCache wrap); per-client context profiles.
   **References:** `CONTEXT_INTELLIGENCE.md`, `INTELLIGENCE_MATHEMATICS.md` (Context Score).

## Provider Rating Engine (Specification)

**Purpose:** Dynamically rank providers for each capability. Providers are NEVER hardcoded; every provider receives a live composite score.
**Responsibilities:** Own provider scoring — per-capability quality dimensions (reasoning, coding, creativity, vision, long-context), operational signals (latency, cost, reliability), history, preferences, and confidence — producing routing rankings and fallback order.
**Inputs:** Provider Health signals, Benchmark scores (nightly), historical success, quality evals, client/enterprise preference, per-capability telemetry (latency, cost, quality), provider confidence (sample size).
**Outputs:** Provider Rating matrix (provider × capability → score with confidence), ranking for routing, fallback order.
**Algorithms:**

1. Gather signals: quality dimensions (per-capability **reasoning, coding, creativity, vision, long-context** — components of Q(p,c)), latency (p50/p95), cost (per-token), reliability (error rate), historical success (past outcomes), preference (client/enterprise), confidence (sample size).
2. Normalize each dimension to [0,1] (min-max or log-scale for latency/cost).
3. Composite Provider Score per (provider, capability) — weighted model (see Mathematics: Provider Score).
4. Emit ranking + fallback order + confidence.
   **Scoring:** Provider Score = f(quality, latency, cost, reliability, historical success, preference, benchmark) with per-capability weights.
   **Decision Flow:** Telemetry + benchmark + preference → normalize → score → rank → route.
   **Failure Handling:** Low-confidence ratings (few samples) → blend toward benchmark prior; stale data → penalize; provider down → health engine overrides.
   **Learning:** Rating weights adjust from outcome feedback (was the chosen provider right?).
   **Future Expansion:** EI-001 registry metadata; cost-aware and latency-aware routing policies.
   **References:** `PROVIDER_HEALTH_ENGINE.md`, `PROVIDER_BENCHMARK_ENGINE.md`, `AI_PROVIDER_MATRIX.md`, `INTELLIGENCE_MATHEMATICS.md`.

---

## Constitution Alignment

This specification enforces the VedMoulya Constitution: token budgets, cost budgets, quality targets, minimum context, no direct provider calls from business modules, all AI through the EI layer, documentation per sprint, ADRs for decisions, revenue before perfection.
