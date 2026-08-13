# Enterprise Intelligence

> The governing layer for all AI execution on the platform — capability registry, adapters, context, economy, planning, and learning.
> Owner: AI Platform Team · Updated: 2026-08-03 (DOC-001)

## Purpose

Describe the Enterprise Intelligence (EI) layer: the single, governed path through which every AI call flows. EI enforces the constitution's AI principles (token budget, cost budget, quality target, minimum context, no direct provider calls) and provides the abstractions that let VedMoulya evolve providers, models, and capabilities without touching business modules.

## Scope

- The EI vision (EI-001…EI-010 program)
- What is realized today vs. planned
- Interaction with the platform engines (Memory, Knowledge, Decision, Execution, Quality, Learning)

## Current Status

**Vision ratified; core realized.** The AI Orchestrator (`services/orchestrator` + `AIOrchestrationService`) already provides provider-agnostic execution, capability routing, quality tiers, token constraints, caching, metrics, and fallback/retry. The remaining EI components (capability registry automation, context intelligence, economy engine, task planner, enterprise brain, self-improvement) are designed but not yet built as distinct services. Design documents live in `04_Sprints/ENTERPRISE_INTELLIGENCE/`.

## Architecture

```
Business modules
   └─ AI Services (typed DTOs)        [no provider knowledge]
        └─ EI Layer
             ├─ Capability Registry      (EI-001) — what we can do
             ├─ Adapter Framework        (EI-002) — how we connect
             ├─ Context Intelligence     (EI-003) — minimum necessary context
             ├─ Enterprise Execution Strategy Engine        (EI-004) — strategy + budgets + risk + fallback
             ├─ Task Planner             (EI-006) — decompose goals into steps
             ├─ Execution Scheduler      (EI-007) — schedule & run steps
             ├─ Learning Engine          (EI-008) — improve from outcomes
             └─ Enterprise Brain         (EI-009) — unified synthesis
        └─ Provider Adapters (OpenAI, Anthropic, Mock)
```

## Responsibilities

- Enforce the constitution's AI principles for every call
- Provide capabilities as the stable contract to modules
- Own provider strategy, selection, and cost governance

## Deliverables

- EI design series (`04_Sprints/ENTERPRISE_INTELLIGENCE/EI-001…010`)
- Orchestrator implementation (realized core)
- Provider adapters and routing rules

## Dependencies

- `packages/ai`, `services/orchestrator`
- Engine services: memory, knowledge, decision, execution, learning
- Constitution AI principles (`VEDMOULYA_CONSTITUTION.md`)

## Future Work

- Build EI-001, EI-004, EI-005, EI-006, EI-007 as first-class components
- EI-009 Enterprise Brain and EI-010 Self-Improvement research

## References

- [CAPABILITY_ARCHITECTURE.md](./CAPABILITY_ARCHITECTURE.md)
- [AI_PROVIDER_STRATEGY.md](./AI_PROVIDER_STRATEGY.md)
- [04_Sprints/ENTERPRISE_INTELLIGENCE/](../04_Sprints/ENTERPRISE_INTELLIGENCE/)
