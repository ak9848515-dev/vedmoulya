# Enterprise Intelligence Blueprint

> The future architecture of the EI layer: from Goal to delivered, quality-scored outcome.
> Owner: AI Platform Team · Updated: 2026-08-03 (OSR-001 / EPIC-004)

## Purpose

Describe the target architecture of the Enterprise Intelligence (EI) layer — the governed pipeline from a user goal to a quality-scored, delivered outcome — and map each stage to what exists today, what will be built (Planned/Designed), and which external technologies wrap it.

## Scope

- The full EI pipeline (Goal → … → Memory/Knowledge)
- Stage-by-stage status (Implemented / Planned / Designed / Research)
- External technology wrap points (per `TECHNOLOGY_REGISTRY.md`)
- Integration with the existing orchestrator and engine services

## Current Status

**Blueprint Designed** (2026-08-03). Core plumbing (Orchestrator, engines, budget constraints, quality scoring, caching) is Implemented; the planning/economy/learning stages are Planned or Designed. Nothing beyond today's implementation is marked implemented.

## Architecture

```
                     ┌─────────────────────────────────────────────┐
                     │                USER GOAL                    │
                     └──────────────────┬──────────────────────────┘
                                        ▼
                     ┌─────────────────────────────────────────────┐
                     │  GOAL ANALYZER          (Planned, EI-006a)   │
                     │  intent, constraints, success criteria       │
                     └──────────────────┬──────────────────────────┘
                                        ▼
                     ┌─────────────────────────────────────────────┐
                     │  TASK PLANNER           (Planned, EI-006)    │
                     │  goal → ordered steps, deps, capabilities    │
                     │  wraps: LangGraph (MIT) as graph executor    │
                     └──────────────────┬──────────────────────────┘
                                        ▼
                     ┌─────────────────────────────────────────────┐
                     │  CAPABILITY REGISTRY   (Planned, EI-001)     │
                     │  what can we do, by whom, at what cost       │
                     └──────────────────┬──────────────────────────┘
                                        ▼
                     ┌─────────────────────────────────────────────┐
                     │  CONTEXT INTELLIGENCE (Designed, EI-004)     │
                     │  minimum necessary context (memory+knowledge)│
                     │  wraps: prompt caching, semantic cache       │
                     └──────────────────┬──────────────────────────┘
                                        ▼
                     ┌─────────────────────────────────────────────┐
                     │  AI ECONOMY ENGINE    (Planned, EI-005)      │
                     │  token budget · cost budget · quality target │
                     │  wraps: LiteLLM (gateway), Langfuse (spend)  │
                     └──────────────────┬──────────────────────────┘
                                        ▼
                     ┌─────────────────────────────────────────────┐
                     │  PROVIDER RANKING    (Planned, EI-005)       │
                     │  rank by telemetry: quality, cost, latency   │
                     │  input: AI_PROVIDER_MATRIX + live stats      │
                     └──────────────────┬──────────────────────────┘
                                        ▼
                     ┌─────────────────────────────────────────────┐
                     │  SCHEDULER             (Planned, EI-007)     │
                     │  when each step runs; wraps: Hatchet, BullMQ │
                     └──────────────────┬──────────────────────────┘
                                        ▼
                     ┌─────────────────────────────────────────────┐
                     │  PARALLEL EXECUTION  (Planned, EI-007)       │
                     │  fan-out steps via Orchestrator (adapters)   │
                     └──────────────────┬──────────────────────────┘
                                        ▼
                     ┌─────────────────────────────────────────────┐
                     │  QUALITY ENGINE      (Designed → Planned)    │
                     │  score output: rubric, threshold, regen      │
                     │  wraps: Promptfoo (CI), Langfuse (evals)     │
                     └──────────────────┬──────────────────────────┘
                                        ▼
                     ┌─────────────────────────────────────────────┐
                     │  LEARNING ENGINE     (Designed, EI-008/010)  │
                     │  outcomes → improve prompts/plans/rubrics    │
                     └──────────────────┬──────────────────────────┘
                                        ▼
              ┌─────────────────────────┴─────────────────────────┐
              ▼                                                   ▼
   ┌──────────────────────┐                          ┌──────────────────────┐
   │  MEMORY  (Implemented)│                          │ KNOWLEDGE (Implemented)│
   │  user state, history  │                          │ graph, docs, vectors   │
   │  enhance: entities,   │                          │ enhance: ingestion     │
   │  temporal (EI-009)    │                          │ (Unstructured, Planned)│
   └──────────────────────┘                          └──────────────────────┘
```

## Stage Details

| #   | Stage                                | Status                        | Owner                 | External Tech (Wrap/Adopt)                       | Notes                                                               |
| --- | ------------------------------------ | ----------------------------- | --------------------- | ------------------------------------------------ | ------------------------------------------------------------------- |
| 1   | Goal Analyzer                        | Planned                       | AI Platform Team      | —                                                | Parse intent, constraints, success criteria from user/business goal |
| 2   | Task Planner                         | Planned (EI-006)              | AI Platform Team      | LangGraph (Wrap)                                 | Goal → dependency-ordered steps with capability+quality per step    |
| 3   | Capability Registry                  | Planned (EI-001)              | AI Platform Team      | —                                                | Queryable catalog of capabilities + provider metadata               |
| 4   | Context Intelligence                 | Implemented (EI-003)          | AI Platform Team      | Provider prompt caching (Adopt); GPTCache (Wrap) | Retrieve/prune memory+knowledge into minimum context                |
| 5   | Enterprise Execution Strategy Engine | Implemented (EI-004)          | AI Platform Team      | LiteLLM (Wrap); Langfuse (Adopt)                 | Strategy, budgets, risk, fallback; enforcement + telemetry next     |
| 6   | Provider Ranking                     | Planned (EI-005)              | AI Platform Team      | —                                                | Telemetry-first ranking (matrix is the prior)                       |
| 7   | Scheduler                            | Planned (EI-007)              | Execution Engine Team | Hatchet (Wrap); BullMQ (Adopted)                 | When each step runs; durable for long pipelines                     |
| 8   | Parallel Execution                   | Planned (EI-007)              | Execution Engine Team | Provider adapters (Adopted)                      | Fan-out via Orchestrator; rate-limit aware                          |
| 9   | Quality Engine                       | Designed → Planned            | Quality Engineering   | Promptfoo (Adopt); Langfuse (Adopt)              | Rubric scoring, threshold, regenerate decision                      |
| 10  | Learning Engine                      | Designed (EI-008/010)         | AI Platform Team      | Langfuse (evals)                                 | Outcome feedback → prompt/plan/rubric improvements (human-gated)    |
| 11  | Memory                               | Implemented (enhance Planned) | Memory Engine Team    | pgvector (Adopted)                               | Add entity extraction, temporal tagging, hybrid search (EI-009)     |
| 12  | Knowledge                            | Implemented (enhance Planned) | Knowledge Engine Team | pgvector (Adopted); Unstructured (Wrap)          | Add document ingestion pipeline                                     |

## What Is Already Implemented (today)

- **Orchestrator core** (`services/orchestrator` + `AIOrchestrationService`): capability routing, quality tiers (premium/standard/economy/free), token/cost constraints, fallback/retry (max 5), exact-key request cache, metrics.
- **Engines**: Memory, Knowledge, Decision, Execution, Learning — all live services.
- **Quality scoring**: Content Agency weighted rubrics + versioned regeneration (AC-001).
- **Content pipeline**: multi-pass generation with brand-aware prompts (AC-001/AC-002).
- **Observability**: OTel + Grafana; AI usage metrics in agency analytics.
- **Provider adapters**: OpenAI, Anthropic, Google, DeepSeek, OpenRouter, Ollama, Mock (Mock deterministic/hermetic).

## What Will Be Built (Planned/Designed)

- EI-001 Capability Registry service (Planned)
- EI-004 Context Intelligence service (Designed)
- EI-004 Enterprise Execution Strategy Engine (implemented); EI-005 budget enforcement + spend dashboards (Planned)
- EI-006 Task Planner + EI-006a Goal Analyzer (Planned)
- EI-007 Scheduler generalization over Hatchet (Planned)
- Quality Engine as first-class service (Designed → Planned)
- EI-008/010 Learning & Self-Improvement loops, human-gated (Designed)
- EI-009 Enterprise Brain synthesis (Designed/Research)
- Orchestrator emission to Langfuse; CI eval gate with Promptfoo (Planned)

## Guardrails

- All stages route AI through the EI layer — no direct provider calls from business modules.
- Economy engine enforces budgets before any provider call.
- Learning/self-improvement changes are human-approved (no autonomous self-modification).
- External technologies are wrapped; replacement strategy tracked in the registry.

## Responsibilities

- AI Platform Team: stages 1–6, 9–10 design/build
- Execution Engine Team: stages 7–8
- Memory/Knowledge teams: stage 11–12 enhancements
- Quality Engineering: stage 9 gates

## Deliverables

- This blueprint
- EI design series (`04_Sprints/ENTERPRISE_INTELLIGENCE/`)
- OSR-001 registry + matrices (this folder)

## Dependencies

- [ENTERPRISE_INTELLIGENCE.md](./ENTERPRISE_INTELLIGENCE.md)
- [TECHNOLOGY_REGISTRY.md](./TECHNOLOGY_REGISTRY.md)
- [CAPABILITY_REGISTRY.md](./CAPABILITY_REGISTRY.md)

## Future Work

- Build order: EI-001 registry → EI-005 economy → EI-006 planner → EI-007 scheduler → EI-004 context → quality/learning
- POCs: semantic cache, LLMLingua worker, graph store (AGE vs Kùzu)

## References

- [04_Sprints/ENTERPRISE_INTELLIGENCE/EI-001…010](../04_Sprints/ENTERPRISE_INTELLIGENCE/)
- [ENTERPRISE_INTELLIGENCE.md](./ENTERPRISE_INTELLIGENCE.md)
- [BUILD_VS_ADOPT_MATRIX.md](./BUILD_VS_ADOPT_MATRIX.md)
