# Changelog

All notable changes to `@vedmoulya/memory-intelligence` are documented in
this file. The package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-08-06

### Added

- **EI-010 Enterprise Memory Intelligence Platform** — first release.
  - Memory registry: `MemoryItem` captures WHAT VedMoulya remembers (type +
    title + content), WHERE it came from (source + 15 source types), WHO owns
    it (owner), WHAT it relates to (related goal/task/capability/provider/
    project/user/context/decision/execution), HOW much it matters (importance
    score + level + factors), HOW certain it is (confidence), HOW often it
    recurs (frequency), HOW fresh it is (recency), HOW used it is (usage count +
    consumers), WHERE it is in its life (lifecycle + compression state +
    retention policy + expiresAt), WHAT backs it (citations), WHAT links to it
    (relationships), and WHO did WHAT WHEN (audit trail).
  - 14 memory classes (working, session, project, business, capability,
    provider, execution, decision, learning, context, user preference, failure,
    success, long-term) and 10 relationship types (recalls, follows, precedes,
    supports, contradicts, supersedes, depends_on, similar_to, refines,
    produced_by) with 15 source types carrying intrinsic reliability weights.
  - Domain services: `MemoryCaptureService`, `MemoryImportanceService` (type
    salience + factors), `MemoryRankingService` (composite weights),
    `MemoryRetrievalService` (11 match modes — deterministic, no LLM, no vector
    DB), `MemoryCompressionService` (raw → compressed → summarized → collapsed),
    `MemoryConsolidationService` (duplicate merge), `MemoryExpirationService`
    (retention TTLs), `MemoryLifecycleService` (captured → validated →
    consolidated → ranked → compressed → active → archived → expired),
    `MemoryAnalyticsService`, `MemoryCitationService` (verification), and
    `MemoryRelationshipService` (auto-detection + graph integrity).
  - `MemoryGraph` abstract interface (future graph-storage seam) with in-memory
    and Postgres implementations (BFS traversal + shortest path).
  - Repositories: `InMemoryMemoryRepository` (hermetic test double) and
    `PostgresMemoryRepository` (`memory_registry` JSONB table — items +
    relationships keyed by collection, indexed, migration-ready) +
    `createProductionMemoryIntelligenceRepository()`-ready wiring pattern.
  - `MemoryEngines` port contracts — narrow structural contracts satisfied by
    the nine existing engine application services (goals, capabilities,
    providers, context, strategies, orchestrator, learning, brain, knowledge) —
    guaranteeing reuse with no duplicated logic and no engine modification.
  - Seed catalog: 23 memory items across all 14 memory types + 17 relationships
    referencing the EI-001…EI-009 seed entities (goal_blog_seed, openai,
    anthropic, research capability, …), with citations, consumers, and usage.
