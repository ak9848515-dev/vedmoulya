# Enterprise Memory Intelligence Platform

> The Enterprise Memory Layer of VedMoulya — it records, retrieves, ranks,
> compresses, consolidates and evolves experience across the entire operating
> system.
> Owner: AI Platform Team · Updated: 2026-08-06 (EI-010)

## Purpose

Document the Enterprise Memory Intelligence Platform (`packages/memory-intelligence`,
EI-010). Until EI-010, VedMoulya executed, learned, decided, and knew _what_ it
knew — but it could not say _what it had experienced_: which provider stayed
reliable, which strategy held its budget, which failure pattern keeps
recurring, what the user prefers, how a decision played out. This platform
closes that gap: it is the single registry of **evolving experience** across
the operating system.

This is **not** chat history, **not** a vector database, and **not**
conversation memory. It is the governed memory layer — no LLM calls, no
embeddings, no business modules.

> **Knowledge** (EI-009) represents authoritative facts.
> **Memory** (EI-010) represents evolving experience.
>
> The two systems remain architecturally separate but tightly integrated:
> memories carry citations back to knowledge items, and knowledge usage is
> recorded as memory events.

## Scope

- 14 memory classes and 10 relationship types
- `MemoryItem` — the full memory record (type, owner, provenance, related
  goal/task/capability/provider/project/user, importance, confidence,
  frequency, recency, usage count, lifecycle, compression state, retention
  policy, citations, relationships, consumers, audit trail)
- Memory lifecycle: captured → validated → consolidated → ranked → compressed →
  active → archived → expired
- Importance scoring (type salience + factors) and composite ranking
- 11-mode retrieval (goal · project · user · capability · provider · context ·
  time · importance · similarity · business_module · keyword)
- Compression (raw → compressed → summarized → collapsed) and consolidation
  (duplicate merge) and expiration (retention TTLs)
- `MemoryGraph` abstract interface (future graph-storage seam) — in-memory +
  Postgres implementations
- Postgres persistence (`memory_registry` JSONB) + in-memory test double
- `memoryIntelligence.*` API namespace + `/memory` web Enterprise Memory Center
  (9 tabs)
- Seed catalog + `seed:ei` integration

## Architecture

Follows the EI-001…EI-009 layering: `types → contracts → domain → infrastructure →
application → catalog`.

```
Event (any module / engine / user action)
        │  captured, classified (MemoryCaptureService)
        ▼
MemoryRegistry (MemoryItem)
        │  citations verified · relationship detection against the registry
        │  (MemoryRelationshipService) — runs at capture, before the pipeline
        │  importance-scored → consolidated → ranked → compressed → active
        ▼
MemoryGraph (abstract interface — future graph-storage seam)
        │  BFS traversal + shortest path over the relationship edges
        ▼
MemoryRetrieval (11 modes) → MemoryAnalytics → MemoryCitation verification
        │  consumed by every engine through narrow port contracts (MemoryEngines)
        ├──► Enterprise Brain  (EI-008) — decisions retrieve relevant experience
        ├──► Execution         (EI-005) — executions read prior outcomes
        └──► Learning          (EI-007) — outcomes reinforce the memory registry
```

## Key components

| Component                    | Responsibility                                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `MemoryItem`                 | One stored experience — the full memory record (see Scope)                                                                                                   |
| `MemoryType` ×14             | working · session · project · business · capability · provider · execution · decision · learning · context · user_preference · failure · success · long_term |
| `MemoryRelationship` ×10     | recalls · follows · precedes · supports · contradicts · supersedes · depends_on · similar_to · refines · produced_by                                         |
| `MemoryCaptureService`       | Event → MemoryItem (classification by type/source)                                                                                                           |
| `MemoryImportanceService`    | Importance score from type salience + usage/frequency/recency factors                                                                                        |
| `MemoryRankingService`       | Composite relevance ranking (weighted factors, explainable)                                                                                                  |
| `MemoryRetrievalService`     | 11 match modes — deterministic, no LLM, no vector DB                                                                                                         |
| `MemoryCompressionService`   | raw → compressed → summarized → collapsed                                                                                                                    |
| `MemoryConsolidationService` | Duplicate detection + merge (consolidation stage)                                                                                                            |
| `MemoryExpirationService`    | Retention TTLs → archived/expired (+ purge)                                                                                                                  |
| `MemoryLifecycleService`     | Lifecycle state machine, rule-gated + audited                                                                                                                |
| `MemoryAnalyticsService`     | Type/source/lifecycle/compression aggregates, importance distribution, usage, trends                                                                         |
| `MemoryCitationService`      | Citation verification against the source registry                                                                                                            |
| `MemoryRelationshipService`  | Relationship auto-detection + graph integrity                                                                                                                |
| `MemoryRepository`           | Item + relationship + consumer persistence contract (InMemory / Postgres)                                                                                    |
| `MemoryGraph`                | Abstract graph interface (BFS traversal, shortest path)                                                                                                      |
| `MemoryApplicationService`   | API facade over all domain services (the Memory Pipeline)                                                                                                    |
| `MemoryEngines`              | Narrow port contracts to the EI-001…EI-009 engines (the Memory layer consumes, owns nothing)                                                                 |

## Memory lifecycle

```
captured → validated → consolidated → ranked → compressed → active
                                                                │
                                          ┌─────────────────────┤
                                          ▼                     ▼
                                       archived ──────────►  expired (terminal)
                                           ▲                     │
                                           └──── (restore)       │ purge only

Any non-expired item may be archived at any time.
archived → active restores the item; archived → expired retires it.
expired is terminal: it can only be purged.
```

Every transition is rule-checked (`MemoryRules`) and appended to the item's
audit trail. `expired` is terminal (purge only): non-expired items may be
archived, archived items may be restored to active or expired, and any item
may expire when its retention TTL passes. `MemoryRules` also validates every
item and relationship at the boundary (enum membership, score bounds, entity
presence, valid ISO dates, no self-relationships).

## Importance & ranking model

Importance = composite of **type salience** (e.g. long-term > ephemeral) ·
**frequency** (how often the experience recurs) · **recency** (age decay) ·
**usage** (retrievals, consumers). Ranking composes importance, confidence,
recency, and relevance into one explainable score — the same explainability
discipline as the Enterprise Brain's decisions and Knowledge's trust scoring.

## Memory pipeline

```
Event → Capture → Classification → Importance Scoring → Consolidation
  → Relationship Detection → Ranking → Compression → Retrieval
  → Enterprise Brain → Execution → Learning → Memory Update
```

This package performs the Capture → Compression stages; the downstream stages
(Enterprise Brain / Execution / Learning) consume the registry through the
other engines' existing flows — **no duplicated logic**.

## API surface

`memoryIntelligence.*` — 23 procedures behind auth + IDOR + rate-limit
middleware:

- Capture + registry: `capture` · `update` · `delete` · `getItem` · `listItems` ·
  `transitionLifecycle`
- Retrieval + explain: `retrieve` · `summarize` · `validate`
- Pipeline operations: `consolidate` · `compress` · `expire` · `reinforce`
- Relate + graph: `relate` · `detectRelationships` · `listRelationships` ·
  `graph` · `shortestPath`
- Consumers: `listConsumers` · `recordConsumerUsage`
- Analytics: `getAnalytics` · `getTimeline` · `getDashboard`

## Web

`/memory` — **Enterprise Memory Center** with nine tabs: Dashboard, Explorer,
Retrieval, Timeline, Relationships, Importance, Analytics, Compression,
Retention. Dark mode, responsive grids, lazy-loaded views (50 kB budget), and
mobile-ready safe-area layouts.

## Database

`memory_registry` — single JSONB-document table (items + relationships keyed by
collection) with `ensureTable()` (CREATE TABLE IF NOT EXISTS) and indexes on
type, lifecycle status, and expiration — migration ready. Production default
wired via `createProductionMemoryIntelligenceRepository()`. The `MemoryGraph`
Postgres implementation uses adjacency queries over the same table, keeping the
future graph-storage seam abstract.

## References

- [04_Sprints/ENTERPRISE_INTELLIGENCE/EI-010_Enterprise_Memory_Intelligence.md](../04_Sprints/ENTERPRISE_INTELLIGENCE/EI-010_Enterprise_Memory_Intelligence.md)
- [09_Documents/EI-010_Completion_Report.md](../09_Documents/EI-010_Completion_Report.md)
- [KNOWLEDGE_INTELLIGENCE.md](./KNOWLEDGE_INTELLIGENCE.md) — the companion Knowledge layer
