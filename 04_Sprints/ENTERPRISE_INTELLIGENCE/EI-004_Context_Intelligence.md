# EI-004 — Context Intelligence

> Assemble the minimum necessary context for every AI call.
> Owner: AI Platform Team · Updated: 2026-08-03 (DOC-001)

## Purpose

Define the Context Intelligence service: retrieve from Memory/Knowledge, select, prune, and assemble the minimal context for each call — implementing the constitution's minimum-context principle.

## Scope

- Context sources (memory, knowledge, brand, user state)
- Retrieval, selection, pruning (top-k, relevance, dedupe)
- Context assembly API for AI services
- Token/context cost telemetry

## Current Status

🔵 **Designed.** Content Agency already builds brand-aware, retrieval-augmented prompts (AC-001/AC-002); a generalized service is the build deliverable.

## Architecture

```
Context Request → gather sources → rank/prune → build context bundle
  → AI service prompt → Orchestrator (token budget)
Telemetry: tokens per source → EI-005 economy reporting
```

## Responsibilities

- AI Platform Team: retrieval quality, pruning correctness
- Module teams: declare context needs

## Deliverables

- Context assembly service
- Source adapters (memory, knowledge)
- Token telemetry

## Dependencies

- `services/memory`, `services/knowledge`
- [03_Architecture/CONTEXT_INTELLIGENCE.md](../../03_Architecture/CONTEXT_INTELLIGENCE.md)

## Future Work

- Personalization across modules; prompt compression

## References

- [03_Architecture/CONTEXT_INTELLIGENCE.md](../../03_Architecture/CONTEXT_INTELLIGENCE.md)
- [03_Architecture/TOKEN_OPTIMIZATION.md](../../03_Architecture/TOKEN_OPTIMIZATION.md)
