# Data & Storage

**TECH-001 — Document 04/10 — Technology Decision Record**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Technology Officer (CTO)
**Created:** 2026-07-27
**Cross-references:** CMP-002, PRD-002, ARC-003, ENG-003, ENG-004, IMP-001/D02, IMP-001/D06

---

## Purpose

This TDR evaluates storage paradigms for VedMoulya and establishes where each storage type fits in the architecture. Decisions are storage PARADIGM decisions, not vendor-specific product decisions — ensuring the architecture remains provider-agnostic.

---

## Storage Philosophy

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                      VEDMOULYA STORAGE PHILOSOPHY                             │
│                                                                               │
│  1. RIGHT TOOL FOR THE JOB — Each storage paradigm serves a specific          │
│     access pattern. No single database solves all problems.                   │
│                                                                               │
│  2. POLYGLOT PERSISTENCE — Different data types require different storage     │
│     paradigms. VedMoulya uses multiple storage types by design.               │
│                                                                               │
│  3. DATA SOVEREIGNTY — Data classification (ENG-003/D05) governs where       │
│     data is stored and processed. Personal data never leaves approved zones.  │
│                                                                               │
│  4. ABSTRACTION LAYER — Services access data through repositories and         │
│     data access layers. Storage technology is an implementation detail.       │
│                                                                               │
│  5. MIGRATABLE — Every storage choice has a documented migration path.        │
│     No vendor-specific features that prevent migration.                       │
│                                                                               │
│  6. EVOLVE, DON'T REPLACE — Storage layers are additive. Add new storage     │
│     types as needed; don't replace existing ones without clear justification. │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Storage Decision Map

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                      STORAGE PARADIGM FIT MAP                                 │
│                                                                               │
│  DATA TYPE                 │ PRIMARY STORAGE      │ SECONDARY STORAGE       │
│ ───────────────────────────┼─────────────────────┼───────────────────────── │
│  User Identity & Profiles  │ Relational           │ Document (preferences)   │
│  User DNA                  │ Relational           │ Document (flexible attr) │
│  Knowledge Graph           │ Graph                │ Relational (indexing)    │
│  Documents & Content       │ Document             │ Object Storage (files)   │
│  Session Memory            │ Document             │ Cache (hot sessions)     │
│  Decision Records          │ Relational           │ Document (audit trail)   │
│  Execution State           │ Relational           │ Document (state history) │
│  Financial Records         │ Relational           │ Object (receipts/docs)   │
│  Event Log                 │ Append-only log      │ Relational (queries)     │
│  Analytics                 │ Columnar / OLAP      │ Relational (aggregates)  │
│  Vector Embeddings         │ Vector               │ Relational (metadata)    │
│  Files & Media             │ Object Storage       │ CDN (hot content)        │
│  Configuration             │ Cache / KV           │ Document (config files)  │
│  Audit Trail               │ Append-only / Rel.   │ Object (archived logs)   │
│  Notifications             │ Document / Queue     │ Relational (history)     │
│  Marketplace Listings      │ Relational           │ Document (search index)  │
│  Community Content         │ Document             │ Object Storage (media)   │
│  Cache / Hot Data          │ In-memory Cache      │ Local storage (offline)  │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Where Each Storage Type Fits

### 1. Relational Database (Primary: MVP)

**Best for:** Structured data with relationships, ACID compliance, strong consistency, complex queries.

| VedMoulya Use                    | Why Relational                                                    |
| -------------------------------- | ----------------------------------------------------------------- |
| User Identity & Profiles         | Structured, ACID-critical. Unique constraints on emails.          |
| User DNA (structured dimensions) | Dimensions have defined schema. Relationships between dimensions. |
| Decision Records                 | Transactional integrity. Complex queries on decision history.     |
| Execution State                  | State machine transitions. Consistency is critical.               |
| Financial Records                | ACID compliance non-negotiable. Audit requirements.               |
| Career/Learning progress         | Structured progress data. Cross-module queries.                   |
| Marketplace transactions         | ACID for payments. Booking/availability consistency.              |

**Evaluation Criteria:**

| Criterion                  | Assessment                                                                        |
| -------------------------- | --------------------------------------------------------------------------------- |
| **Architecture Alignment** | +2 — ACID for critical data. Structured queries for domain operations.            |
| **Productivity**           | +2 — Mature ORMs and query builders. AI tools generate SQL effectively.           |
| **Maintainability**        | +2 — Well-understood paradigm. Migration tools mature (flyway, prisma migrate).   |
| **AI Compatibility**       | +2 — SQL is one of the best-supported languages for AI generation.                |
| **Scalability**            | +1 — Vertical scaling for MVP. Read replicas for growth. Sharding for enterprise. |
| **Weighted Score**         | **+1.80**                                                                         |

### 2. Document Database

**Best for:** Semi-structured data, flexible schemas, hierarchical documents, rapid iteration.

| VedMoulya Use                 | Why Document                               |
| ----------------------------- | ------------------------------------------ |
| User Preferences              | Flexible attributes that vary by user.     |
| Content & Knowledge Documents | Variable structure. Nested content.        |
| Session Memory                | Varied session data. TTL-based expiration. |
| Community Content             | Variable post schemas. Embedded comments.  |
| Notification Templates        | Flexible template structures.              |

**Evaluation Criteria:**

| Criterion                  | Assessment                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Architecture Alignment** | +1 — Flexible schemas support domain evolution. Eventual consistency acceptable for non-critical reads. |
| **Productivity**           | +2 — Schema-less = faster iteration. Good for evolving data models.                                     |
| **Maintainability**        | +1 — Schema management requires discipline to avoid chaos.                                              |
| **AI Compatibility**       | +1 — AI works well with JSON/BSON documents.                                                            |
| **Scalability**            | +2 — Excellent horizontal scaling for document workloads.                                               |
| **Weighted Score**         | **+1.40**                                                                                               |

### 3. Graph Database

**Best for:** Highly connected data, relationship traversal, graph queries, recommendation paths.

| VedMoulya Use         | Why Graph                                                      |
| --------------------- | -------------------------------------------------------------- |
| Knowledge Graph       | Core use case — entities and relationships are the data model. |
| Skill Relationships   | Skill → Skill prerequisites. Skill → Career path connections.  |
| Learning Paths        | Knowledge → Resource → Skill → Career goal traversals.         |
| Career Trajectories   | Role → Skill → Experience → Role path discovery.               |
| Recommendation Graphs | User → Interest → Knowledge → Connection → Recommendation.     |

**Evaluation Criteria:**

| Criterion                  | Assessment                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| **Architecture Alignment** | +2 — Perfect alignment with ARC-003 Knowledge Graph entity/relationship model.                  |
| **Productivity**           | +1 — Purpose-built for graph operations. Query language (Cypher/SPARQL/Gremlin) learning curve. |
| **Maintainability**        | +1 — Graph schemas are flexible. Query optimization requires expertise.                         |
| **AI Compatibility**       | +1 — Graph query generation is supported but less common than SQL.                              |
| **Scalability**            | +1 — Graph databases scale horizontally but with complexity.                                    |
| **Weighted Score**         | **+1.20**                                                                                       |

### 4. Vector Database

**Best for:** Semantic search, similarity matching, AI embeddings, recommendation similarity.

| VedMoulya Use             | Why Vector                                                 |
| ------------------------- | ---------------------------------------------------------- |
| Semantic Knowledge Search | Embed knowledge documents for similarity-based retrieval.  |
| Skill Similarity Matching | Match skills by semantic similarity, not just keyword.     |
| Content Recommendations   | Embed content → recommend by semantic similarity.          |
| Career Path Similarity    | Similar career trajectories based on embedding similarity. |
| AI Context Retrieval      | RAG (Retrieval-Augmented Generation) context assembly.     |

**Evaluation Criteria:**

| Criterion                  | Assessment                                                                  |
| -------------------------- | --------------------------------------------------------------------------- |
| **Architecture Alignment** | +2 — Essential for AI-native platform. Enables semantic understanding.      |
| **Productivity**           | +1 — Growing ecosystem. Integration complexity with other stores.           |
| **Maintainability**        | +1 — Embedding management (versioning, refresh strategies) adds complexity. |
| **AI Compatibility**       | +2 — Vector databases are designed for AI workloads.                        |
| **Scalability**            | +1 — Scales well but index build/refresh requires planning.                 |
| **Weighted Score**         | **+1.40**                                                                   |

### 5. Object Storage

**Best for:** Unstructured files, media, backups, archives, large binary data.

| VedMoulya Use       | Why Object Storage                            |
| ------------------- | --------------------------------------------- |
| User Uploaded Files | Resume PDFs, portfolio files, certificates.   |
| Content Media       | Images, videos, audio recordings.             |
| Knowledge Artifacts | Attachments, supporting documents.            |
| Audit Archives      | Archived audit logs for compliance retention. |
| Backup Data         | Database backups, exported user data.         |

**Evaluation Criteria:**

| Criterion                  | Assessment                                                        |
| -------------------------- | ----------------------------------------------------------------- |
| **Architecture Alignment** | +1 — Essential for file storage. S3-compatible APIs are standard. |
| **Productivity**           | +2 — Simple API (put/get/delete). No schema management.           |
| **Maintainability**        | +2 — Simple, well-understood pattern.                             |
| **AI Compatibility**       | +1 — Simple API. AI generates upload/download code easily.        |
| **Scalability**            | +2 — Virtually unlimited. Built-in CDN integration.               |
| **Weighted Score**         | **+1.60**                                                         |

### 6. Cache / In-Memory Store

**Best for:** Hot data, session state, rate limiting, real-time counters, temporary data.

| VedMoulya Use             | Why Cache                                                 |
| ------------------------- | --------------------------------------------------------- |
| Active User Sessions      | Fast session lookup for every authenticated request.      |
| Knowledge Graph Hot Nodes | Cached frequently-accessed entities and relationships.    |
| Decision Cache            | Cached decisions for repeated patterns (reduce AI calls). |
| Rate Limiting Counters    | Atomic increment operations per user/IP.                  |
| Real-time Context         | Ephemeral context for active user session.                |
| Job Queues                | Lightweight task queues for async processing.             |

**Evaluation Criteria:**

| Criterion                  | Assessment                                                       |
| -------------------------- | ---------------------------------------------------------------- |
| **Architecture Alignment** | +1 — Essential for performance. Must not become source of truth. |
| **Productivity**           | +2 — Simple key-value operations. Mature client libraries.       |
| **Maintainability**        | +2 — Simple deployment. Well-understood failure modes.           |
| **AI Compatibility**       | +1 — AI generates cache access code easily.                      |
| **Scalability**            | +2 — Excellent horizontal scaling. Redis Cluster, KeyDB.         |
| **Weighted Score**         | **+1.60**                                                        |

---

## Storage Architecture (MVP)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MVP STORAGE ARCHITECTURE                                    │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  PRIMARY DATABASE: Relational                                          │    │
│  │  • All structured data                                                │    │
│  │  • Identity, DNA, Decisions, Execution, Career, Learning              │    │
│  │  • ACID for critical operations                                       │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                          │                                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  KNOWLEDGE STORE: Relational (MVP) → Graph (Growth)                   │    │
│  │  • MVP: Relational with adjacency table for basic graph operations    │    │
│  │  • Growth: Extract to dedicated graph database                       │    │
│  │  • Reason: MVP entity count doesn't justify graph DB overhead        │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                          │                                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  CACHE: In-memory store for hot data                                  │    │
│  │  • Sessions, rate limiting, hot KG nodes, decision cache             │    │
│  │  • TTL-based expiration                                               │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                          │                                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  OBJECT STORAGE: Files & media                                        │    │
│  │  • User uploads, content media, archives                             │    │
│  │  • S3-compatible API                                                  │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                          │                                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  DOCUMENT STORE: Flexible/semi-structured data                        │    │
│  │  • User preferences, session memory, community content               │    │
│  │  • Complementary to relational for schema-flexible data              │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                          │                                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  VECTOR STORE: Semantic search (MVP minimal) → Full (Growth)          │    │
│  │  • MVP: Use relational store with pgvector extension                  │    │
│  │  • Growth: Dedicated vector database for scale                        │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Storage Evolution

```text
PHASE 1-4 (MVP):            PHASE 5-6 (Growth):         PHASE 7+ (Enterprise):
──────────────────────      ──────────────────────      ──────────────────────
Relational (primary)        Relational (primary)         Relational (primary)
+ Cache (sessions)          + Cache (KG hot nodes)      + Cache (distributed)
+ Object (files)            + Object (scale)             + Object (CDN-backed)
+ Document (preferences)    + Document (scale)           + Document (scale)
+ Relational KG (adjacency)  + Graph (extracted)          + Graph (scale)
+ Vector (pgvector)          + Vector (dedicated)         + Vector (distributed)
                             + Event Stream (Kafka)      + Columnar (analytics)
```

---

## Pros & Cons

| Pros                                                     | Cons                                                       |
| -------------------------------------------------------- | ---------------------------------------------------------- |
| Right storage for each data type                         | Polyglot persistence adds operational complexity           |
| MVP uses relational + pgvector for simplicity            | Team must understand multiple storage paradigms            |
| Graph and Vector extracted only when needed              | Migration from relational-KG to Graph DB is planned work   |
| No vendor lock-in — storage choices are paradigm choices | pgvector is PostgreSQL-specific (but Postgres is standard) |
| Cache is treated as cache, not source of truth           | Caching invalidation requires discipline                   |
| Object storage is S3-compatible standard                 | File management (versions, retention) adds complexity      |

### Trade-offs Accepted

| Trade-off                                                   | Why Acceptable                                                                                                                    |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Relational-based KG in MVP (not graph DB)                   | MVP entity count (6 core types) doesn't justify graph DB overhead. Adjacency table works for thousands of entities.               |
| pgvector instead of dedicated vector DB in MVP              | MVP embedding volume is low. pgvector provides vector capability without additional infrastructure. Postgres expertise is common. |
| Document store for flexible data instead of schema-per-type | MVP iteration speed benefits from schema flexibility. Schema enforcement added when data patterns stabilize.                      |
| Single-writer primary database in MVP                       | MVP traffic doesn't require multi-master. Read replicas added when needed.                                                        |

### Migration Strategy

| Migration                            | Trigger                                          | Path                                                                      | Cost                 |
| ------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------- | -------------------- |
| Relational KG → Graph DB             | Entity count > 10,000 or query latency > 200ms   | Export entities/relationships → Import to graph DB → Update service layer | Medium (2-3 sprints) |
| pgvector → Dedicated Vector DB       | Embedding count > 1M or query latency > 100ms    | Export embeddings → Import to vector DB → Update retrieval service        | Medium (1-2 sprints) |
| Relational primary → Distributed SQL | Write throughput exceeds single node capacity    | Evaluate CockroachDB/Yugabyte/TiDB — Postgres-compatible options exist    | High (quarter)       |
| File storage to CDN-backed           | File serving latency > 200ms or global user base | Add CDN in front of object storage (no application change)                | Low (days)           |

---

## Cross-References

| Reference   | Relationship                                                                                          |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| CMP-002     | Data classification (ENG-003/D05) governs where data can be stored and for how long                   |
| PRD-002     | User DNA requires relational structure for dimensions, document flexibility for preferences           |
| ARC-003     | Knowledge Graph entity/relationship model maps to graph database paradigm                             |
| ENG-003     | Information types (D02) each map to a storage paradigm that suits their lifecycle and access patterns |
| ENG-004/D08 | Deployment View shows storage types in the data layer — paradigm decisions, not vendor decisions      |
| IMP-001/D02 | Phase 1-4 uses relational-primary; Graph and Vector extraction in Growth/Enterprise phases            |
| IMP-001/D06 | Module Implementation Order — data layer is implemented per module, each with appropriate storage     |
