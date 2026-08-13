# Changelog

All notable changes to `@vedmoulya/knowledge-intelligence` are documented in
this file. The package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-08-06

### Added

- **EI-009 Enterprise Knowledge Intelligence Platform** — first release.
  - Knowledge registry: `KnowledgeItem` captures WHAT VedMoulya knows, WHERE it
    came from (source + source type), WHO owns/uses it (owner + consumer
    registry), WHETHER it is trusted (trust score + confidence), WHETHER it is
    current (lifecycle + validation), WHAT depends on it (dependencies +
    relationships), and HOW it should be used (citations + usage statistics).
  - 14 knowledge categories, 10 relationship types (parent/child/depends_on/
    related_to/implements/consumes/produces/supersedes/uses/owned_by), 12
    source types with intrinsic reliability.
  - Domain services: trust scoring (provenance/validation/citations/usage/
    recency/dependency-risk), composite ranking, eight-mode search (semantic,
    keyword, category, relationship, dependency, consumer, trust, version),
    relationship detection + graph integrity, validation reports, lifecycle
    state machine (draft → review → active → deprecated → archived), versioning
    - Knowledge Diff, analytics, citation extraction/verification, explainer,
      and engine enrichment.
  - `KnowledgeGraph` abstract interface (future graph-storage seam) with
    in-memory and Postgres implementations (BFS traversal + shortest path).
  - Repositories: `InMemoryKnowledgeRepository` (hermetic test double) and
    `PostgresKnowledgeRepository` (`knowledge_registry` JSONB table, indexed,
    migration-ready) + `createProductionKnowledgeIntelligenceRepository()`-ready
    wiring pattern.
  - Seed catalog: 24 items across all 14 categories referencing the EI-001…
    EI-008 seed entities, with relationships, citations, versions, consumers,
    and usage.
