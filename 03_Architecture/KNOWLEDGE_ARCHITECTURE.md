# Knowledge Architecture

> The structured knowledge graph that powers understanding, retrieval, and decisions.
> Owner: Knowledge Engine Team · Updated: 2026-08-03 (DOC-001)

## Purpose

Document the Knowledge Engine: the knowledge graph service (`services/knowledge`) that stores and queries structured knowledge (entities, relationships, documents, embeddings) used across modules and by AI context assembly.

## Scope

- Knowledge graph model (entities, relations, properties)
- Vector search (pgvector) and hybrid retrieval
- Ingestion and enrichment
- Consumers (career, learning, decision, content agency)

## Current Status

Implemented as `services/knowledge` with PostgreSQL/pgvector persistence. Used by learning, career, decision, and content agency workflows (e.g., brand profiles and reference documents in AC-001).

## Architecture

```
Ingestion → entities/relations/embeddings → Postgres (pgvector)
Query: hybrid (keyword + vector) retrieval → top-k → consumers/AI context
```

## Responsibilities

- Knowledge Engine Team: schema, ingestion, retrieval quality
- Module teams: declare knowledge needs; consume via APIs

## Deliverables

- Knowledge service and repositories
- Retrieval APIs
- Embedding integration

## Dependencies

- PostgreSQL 16+ (pgvector)
- `services/knowledge`

## Future Work

- Automatic knowledge extraction from documents
- Cross-module knowledge federation

## References

- [MEMORY_ARCHITECTURE.md](./MEMORY_ARCHITECTURE.md)
- [CONTEXT_INTELLIGENCE.md](./CONTEXT_INTELLIGENCE.md)
- [SYSTEM_OVERVIEW.md](./SYSTEM_OVERVIEW.md)
