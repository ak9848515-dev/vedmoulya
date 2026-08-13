# Memory Architecture

> What the platform remembers about the user, and how memory is stored, retrieved, and governed.
> Owner: Memory Engine Team · Updated: 2026-08-03 (DOC-001)

## Purpose

Document the Memory Engine: the persistent store of user state, preferences, history, and context that feeds the AI layer and personalizes every experience.

## Scope

- Memory types (preferences, history, session, long-term)
- Storage and retrieval
- Privacy and governance (consent, deletion, audit)
- Integration with AI context assembly

## Current Status

Implemented as `services/memory` (memory engine service) with in-memory and Postgres-backed repositories, wired through the API gateway and AI orchestration for context. Reference: `services/memory/ARCHITECTURE.md`.

## Architecture

```
User actions/events → Memory Service → storage (Postgres/Redis)
Retrieval: context requests → Memory queries → top-k relevant memories → AI context
Governance: consent flags, retention, audit trail
```

## Responsibilities

- Memory Engine Team: durability, retrieval quality, privacy
- AI Platform Team: consuming memory as context (minimum necessary)

## Deliverables

- Memory service and repositories
- Retrieval API consumed by orchestrator/context assembly
- Architecture reference (`services/memory/ARCHITECTURE.md`)

## Dependencies

- `services/memory`
- `services/api` gateway wiring
- [CONTEXT_INTELLIGENCE.md](./CONTEXT_INTELLIGENCE.md)

## Future Work

- Memory consolidation (EI-009 tie-in)
- Structured episodic memory

## References

- [services/memory/ARCHITECTURE.md](../services/memory/ARCHITECTURE.md)
- [KNOWLEDGE_ARCHITECTURE.md](./KNOWLEDGE_ARCHITECTURE.md)
