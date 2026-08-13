# EI-010 — Enterprise Memory Intelligence Platform

> The Enterprise Memory Layer of VedMoulya — it records, retrieves, ranks,
> compresses, consolidates and evolves experience across the entire operating
> system.
> Owner: AI Platform Team · Updated: 2026-08-06 (EI-010)

> **Note (EI-010):** EI-010 delivers the **Enterprise Memory Intelligence
> Platform** (this sprint). The earlier `EI-010_Self_Improvement` document
> described a future outcome-feedback loop and remains a forward-looking
> research note; the Enterprise Memory layer now ships under EI-010, directly
> beside the other engines.

## Purpose

Define and deliver the tenth Enterprise Intelligence engine: the Enterprise
Memory Intelligence Platform. VedMoulya must remember users, projects, goals,
tasks, business decisions, executions, provider performance, learning,
context, knowledge usage, and business outcomes — **without confusing Memory
and Knowledge**. This is **not** chat history, **not** a vector database, and
**not** conversation memory — it is the governed memory layer every engine
records and retrieves experience through.

> Knowledge (EI-009) represents authoritative facts.
> Memory (EI-010) represents evolving experience.
>
> The two systems remain architecturally separate but tightly integrated:
> memories carry citations back to knowledge items, and knowledge usage is
> recorded as memory events.

## What the Memory Platform provides

- **Memory Registry** — every memory item is typed, owned, sourced, ranked,
  compressed, retained, related, cited, and audited.
- **14 memory classes** — working, session, project, business, capability,
  provider, execution, decision, learning, context, user preference, failure,
  success, long-term.
- **10 relationship types** — recalls, follows, precedes, supports,
  contradicts, supersedes, depends_on, similar_to, refines, produced_by.
- **11 retrieval modes** — goal, project, user, capability, provider, context,
  time, importance, similarity, business_module, keyword (deterministic — no
  LLM, no vector DB).
- **Memory Pipeline** — Event → Capture → Classification → Importance Scoring →
  Consolidation → Relationship Detection → Ranking → Compression → Retrieval →
  Enterprise Brain → Execution → Learning → Memory Update.
- **Lifecycle** — captured → validated → consolidated → ranked → compressed →
  active → archived → expired, with rule-gated transitions and a full audit
  trail.
- **Compression + consolidation + expiration** — raw → compressed → summarized →
  collapsed; duplicate merge; retention TTLs (ephemeral → permanent).
- **Memory Graph** — an abstract interface (future graph-storage seam) with BFS
  traversal and shortest-path over relationships.
- **Consumers + citations** — every engine registers as a consumer; memories
  cite the knowledge items and source records that back them.

## What the Memory Platform never does

- Calls LLMs directly
- Implements chat or conversation memory
- Implements a vector database or embeddings
- Duplicates other engines
- Implements business modules

## Memory pipeline

```
Event
  ↓
Memory Capture
  ↓
Classification
  ↓
Importance Scoring
  ↓
Consolidation
  ↓
Relationship Detection
  ↓
Ranking
  ↓
Compression
  ↓
Retrieval
  ↓
Enterprise Brain
  ↓
Execution
  ↓
Learning
  ↓
Memory Update
```

This package performs the Capture through Compression stages. The downstream
stages consume the registry through the other engines' existing flows — **no
duplicated logic**.

## Memory model

Every `MemoryItem` stores: id · type · title · content · summary · source ·
source type · owner · related goal/task/capability/provider/project/user/
context/decision/execution · tags · importance (score/level/factors) ·
confidence (score/level/factors) · usage (retrievals/consumers/frequency/
recency) · lifecycle status · compression state · retention policy · expiresAt ·
consumers · relationships · citations · audit · created · updated.

## Deliverables

- `packages/memory-intelligence` (`@vedmoulya/memory-intelligence`)
- `memoryIntelligence.*` tRPC namespace (23 procedures)
- `/memory` web **Enterprise Memory Center** (9 tabs)
- `memory_registry` Postgres table (JSONB items + relationships) as production
  default + `MemoryGraph` Postgres implementation
- Seed catalog + `seed:ei` integration (9th store)
- Completion report + documentation sync

## Dependencies

- Engine packages EI-001…EI-009 (consumed via narrow `MemoryEngines` port contracts)
- `services/api` gateway + auth/IDOR/rate-limit middleware
- `@vedmoulya/ui`, `@vedmoulya/core`
- Postgres (JSONB document pattern, same as the other EI stores)

## References

- [03_Architecture/MEMORY_INTELLIGENCE.md](../../03_Architecture/MEMORY_INTELLIGENCE.md)
- [09_Documents/EI-010_Completion_Report.md](../../09_Documents/EI-010_Completion_Report.md)
