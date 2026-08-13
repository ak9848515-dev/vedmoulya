# Token Optimization

> Minimize tokens per call: minimum necessary context, caching, and constraints.
> Owner: AI Platform Team · Updated: 2026-08-03 (DOC-001)

## Purpose

Define how the platform minimizes token consumption per AI call — the constitutional principle _every AI call must use the minimum necessary context_ — through retrieval selection, prompt discipline, request caching, and hard token constraints.

## Scope

- Minimum-context assembly (see Context Intelligence)
- Request caching (cache key = capability + prompt + constraints)
- Token constraint enforcement
- Token telemetry

## Current Status

Implemented at the core: `AIOrchestrationService.buildCacheKey` caches requests; `constraints.maxOutputTokens` bounds output; content agency prompts use structured, brand-scoped context rather than full-history dumps. A dedicated optimization pass over all workflows is ongoing (EI-005/EI-004).

## Architecture

```
Context → prune (top-k, relevance) → prompt template
  → cache check (key: capability+input+constraints)
  → miss → provider call with maxOutputTokens bound
  → store cache → record token usage
```

## Responsibilities

- AI Platform Team: cache correctness, token telemetry
- Module teams: context discipline in prompts

## Deliverables

- Request cache (realized)
- Token constraints (realized)
- Token usage metrics (realized for content agency)

## Dependencies

- `services/orchestrator`
- [CONTEXT_INTELLIGENCE.md](./CONTEXT_INTELLIGENCE.md)
- [EXECUTION_STRATEGY_ENGINE.md](./EXECUTION_STRATEGY_ENGINE.md)

## Future Work

- Prompt compression layer
- Cross-module token budget dashboards

## References

- [CONTEXT_INTELLIGENCE.md](./CONTEXT_INTELLIGENCE.md)
- [06_AI/AI_GUIDELINES.md](../06_AI/AI_GUIDELINES.md)
