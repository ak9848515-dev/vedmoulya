# Enterprise Knowledge Intelligence Platform

> The Enterprise Knowledge Layer of VedMoulya — the authoritative, versioned,
> validated, searchable, explainable, and traceable knowledge source for every
> Enterprise Intelligence Engine and every future business module.
> Owner: AI Platform Team · Updated: 2026-08-06 (EI-009)

## Purpose

Document the Enterprise Knowledge Intelligence Platform (`packages/knowledge-intelligence`,
EI-009). Until EI-009, VedMoulya executed, learned, and decided — but it could
not say _why_ it trusts a source, _who_ consumes a fact, or _what_ would break if
a document became stale. This platform closes that gap: it is the single registry
every engine consults for authoritative knowledge, with full provenance and
governance.

This is **not** a document management system, **not** a vector database, and
**not** another RAG library. It is the governed knowledge layer — no LLM calls,
no business modules.

## Scope

- 14 knowledge categories and 10 relationship types
- `KnowledgeItem` — the full governance record (provenance, ownership, trust,
  confidence, version, consumers, dependencies, relationships, citations, usage)
- Knowledge lifecycle: draft → review → active → deprecated → archived
- Trust scoring (provenance / validation / citations / usage / recency / dependency risk)
- 8-mode search (semantic · keyword · category · relationship · dependency ·
  consumer · trust · version)
- `KnowledgeGraph` abstract interface (future graph-storage seam) — in-memory +
  Postgres implementations
- Versioning + Knowledge Diff
- Postgres persistence (`knowledge_registry` JSONB) + in-memory test double
- `knowledge.*` API namespace + `/knowledge` web Enterprise Knowledge Center (10 tabs)
- Seed catalog + `seed:ei` integration

## Architecture

Follows the EI-001…EI-008 layering: `types → contracts → domain → infrastructure →
application → catalog`.

```
Source (any module / engine / import)
        │  ingested, classified, validated
        ▼
KnowledgeRegistry (KnowledgeItem)
        │  relationship detection + graph integrity
        ▼
KnowledgeGraph (abstract interface — future graph-storage seam)
        │  trust-scored, versioned, ranked
        ▼
KnowledgeSearch (8 modes) → KnowledgeAnalytics → KnowledgeExplainer
        │  consumed by every engine through narrow port contracts (KnowledgeEngines)
        ├──► Context Intelligence  (EI-003)
        ├──► Enterprise Brain      (EI-008)  — decisions cite authoritative knowledge
        ├──► Execution             (EI-005)  — execution reads governed knowledge
        └──► Learning Feedback     (EI-007)  — outcomes update the knowledge registry
```

## Key components

| Component                      | Responsibility                                                                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `KnowledgeItem`                | One governed knowledge record — provenance, trust, confidence, version, consumers, dependencies, citations, usage                  |
| `KnowledgeCategory` ×14        | Business · Technical · User · Project · AI · SAP · Client · Domain · Policy · Document · API · Architecture · Learning · Execution |
| `KnowledgeRelationship` ×10    | parent · child · depends_on · related_to · implements · consumes · produces · supersedes · uses · owned_by                         |
| `KnowledgeTrustScoreService`   | Trust score from provenance, validation, citations, usage, recency, dependency risk                                                |
| `KnowledgeValidationService`   | Validation reports + validation-status transitions                                                                                 |
| `KnowledgeLifecycleService`    | Lifecycle state machine: draft → review → active → deprecated → archived                                                           |
| `KnowledgeVersionService`      | Versioning + Knowledge Diff (human-readable change view)                                                                           |
| `KnowledgeRelationshipService` | Relationship detection + graph integrity (no cycles, valid types)                                                                  |
| `KnowledgeSearchService`       | 8-mode search (semantic ranker, keyword, category, relationship, dependency, consumer, trust, version)                             |
| `KnowledgeRankingService`      | Composite relevance ranking across result sets                                                                                     |
| `KnowledgeCitationService`     | Citation extraction + verification                                                                                                 |
| `KnowledgeAnalyticsService`    | Usage, trust distribution, category/lifecycle aggregates, trends                                                                   |
| `KnowledgeExplainerService`    | Why this item is trusted / ranked / returned                                                                                       |
| `KnowledgeEnrichmentService`   | Cross-link items to the EI-001…EI-008 seed entities                                                                                |
| `KnowledgeRepository`          | Item + version + relationship + consumer persistence contract (InMemory / Postgres)                                                |
| `KnowledgeGraph`               | Abstract graph interface (BFS traversal, shortest path)                                                                            |
| `KnowledgeApplicationService`  | API facade over all domain services                                                                                                |
| `KnowledgeEngines`             | Narrow port contracts to the EI-001…EI-008 engines (the Knowledge layer consumes, owns nothing)                                    |

## Knowledge lifecycle

```
draft ──► review ──► active ──► deprecated ──► archived
  ▲         │          │  ▲          │
  └─────────┴──────────┴──┴──────────┘   (validation + transition rules gate every move)
```

Every transition is rule-checked (`KnowledgeRules`) and versioned. An item's
validation status (`unvalidated` → `validated` / `rejected`) is tracked
independently of its lifecycle status.

## Trust model

Trust = composite of **provenance** (source-type intrinsic reliability) ·
**validation** status · **citation** verification · **usage** (consumers, reads) ·
**recency** (age decay) · **dependency risk** (what depends on the item and how
critical it is). Every item also carries a composite **confidence** with the
factors that raised or lowered it — the same explainability discipline as the
Enterprise Brain's decisions.

## API surface

`knowledge.*` — 24 procedures behind auth + IDOR + rate-limit middleware:

- Registry: `create` · `update` · `delete` · `getItem` · `listItems` ·
  `transitionLifecycle`
- Search + explain + validate: `search` · `explain` · `validate`
- Version + diff: `createVersion` · `listVersions` · `getVersion` · `diff`
- Relate + graph: `relate` · `detectRelationships` · `listRelationships` ·
  `graph` · `shortestPath`
- Consumers + dependencies: `listConsumers` · `recordConsumerUsage` ·
  `listDependencies`
- Analytics: `getAnalytics` · `getTimeline` · `getDashboard`

## Web

`/knowledge` — **Enterprise Knowledge Center** with ten tabs: Dashboard,
Explorer, Search, Relationships, Dependencies, Timeline, Versions, Trust,
Analytics, Consumers. Dark mode, responsive grids, lazy-loaded views (50 kB
budget), and mobile-ready safe-area layouts.

## Database

`knowledge_registry` — single JSONB-document table (items, relationships,
versions, consumers) with `ensureTable()` (CREATE TABLE IF NOT EXISTS) and
indexes on category, lifecycle status, trust score, and relationship targets —
migration ready. Production default wired via `createProductionKnowledgeIntelligenceRepository()`.
The `KnowledgeGraph` Postgres implementation uses adjacency queries over the
same table, keeping the future graph-storage seam abstract.

## References

- [04_Sprints/ENTERPRISE_INTELLIGENCE/EI-009_Enterprise_Knowledge_Intelligence.md](../04_Sprints/ENTERPRISE_INTELLIGENCE/EI-009_Enterprise_Knowledge_Intelligence.md)
- [09_Documents/EI-009_Completion_Report.md](../09_Documents/EI-009_Completion_Report.md)
