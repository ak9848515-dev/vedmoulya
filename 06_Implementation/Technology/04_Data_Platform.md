# Data Platform

**BLP-002 — Document 04/15 — Technology Stack & Platform Decisions**
**Version:** 1.0
**Status:** LOCKED
**Owner:** Chief Technology Officer
**Created:** 2026-07-27
**Design Freeze:** 2026-07-27

---

## Purpose

This document defines the **data technology stack** for VedMoulya — databases, caching, search, storage, and data infrastructure.

---

## Decision Summary

| Decision           | Choice                                                          | Status     |
| ------------------ | --------------------------------------------------------------- | ---------- |
| Primary Database   | **PostgreSQL 16+**                                              | ✅ DECIDED |
| Graph Capabilities | **PostgreSQL + recursive CTEs + pgvector**                      | ✅ DECIDED |
| Vector Search      | **pgvector** (PostgreSQL extension)                             | ✅ DECIDED |
| Caching            | **Redis 7+**                                                    | ✅ DECIDED |
| Message Queue      | **BullMQ** (Redis-backed)                                       | ✅ DECIDED |
| Full-Text Search   | **PostgreSQL full-text search** (MVP) → **Meilisearch** (v1.1+) | ✅ DECIDED |
| Object Storage     | **AWS S3** (or compatible: R2, MinIO)                           | ✅ DECIDED |
| Data Serialization | **Zod + JSON**                                                  | ✅ DECIDED |
| Migration Tool     | **Drizzle Kit**                                                 | ✅ DECIDED |
| Backup             | **pg_dump + WAL archiving**                                     | ✅ DECIDED |

---

## Primary Database: PostgreSQL 16+

### Decision

| Aspect      | Detail                                                       |
| ----------- | ------------------------------------------------------------ |
| **Choice**  | PostgreSQL 16+ (via managed service: Railway or Supabase)    |
| **Purpose** | Primary data store for all transactional and analytical data |

### Alternatives Considered

| Alternative               | Pros                                               | Cons                                                                 | Verdict                       |
| ------------------------- | -------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------- |
| **PostgreSQL**            | Mature, extensible, ACID, rich extension ecosystem | Higher operational complexity than serverless DBs                    | ✅ SELECTED                   |
| **Supabase** (managed PG) | PostgreSQL + Auth + Storage + Realtime             | Vendor lock-in risk if fully dependent on Supabase-specific features | ✅ SELECTED as managed option |
| **PlanetScale** (MySQL)   | Serverless, branching                              | No graph/vector support, different SQL dialect                       | ❌                            |
| **SQLite** (Turso)        | Edge-ready, zero-ops                               | No concurrent writes, limited extensions                             | ❌                            |
| **MongoDB**               | Flexible schema                                    | No joins, no graph, poor TypeScript DX                               | ❌                            |

### Why PostgreSQL Won

| Reason              | Detail                                                              |
| ------------------- | ------------------------------------------------------------------- |
| Extension ecosystem | pgvector (vectors), full-text search (FTS), pg_graphql, PostGIS     |
| ACID compliance     | Reliable transaction guarantees for financial and career data       |
| Maturity            | 30+ years of production use, largest open-source DB community       |
| TypeScript support  | Drizzle ORM provides end-to-end type safety                         |
| Managed services    | Supabase, Railway, Neon provide serverless PostgreSQL               |
| Migration path      | Can scale vertically to very large datasets before needing sharding |

---

## Graph Capabilities

### Decision

| Aspect                 | Detail                                                           |
| ---------------------- | ---------------------------------------------------------------- |
| **Choice**             | PostgreSQL with recursive CTEs + pgvector for MVP graph needs    |
| **Dedicated Graph DB** | Post-MVP, only if recursive CTE performance becomes insufficient |

### Alternatives Considered

| Alternative                     | Pros                                                 | Cons                                                                | Verdict           |
| ------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------- | ----------------- |
| **PostgreSQL (recursive CTEs)** | No additional infrastructure, ACID, familiar tooling | Limited to tree-like traversals, slower for deep graphs             | ✅ SELECTED (MVP) |
| **Neo4j**                       | True graph DB, Cypher queries, fast traversals       | Separate infrastructure, different query language, operational cost | 📝 Future         |

### Migration to Dedicated Graph DB

| Trigger                                      | Action                            |
| -------------------------------------------- | --------------------------------- |
| Knowledge Graph query time exceeds 500ms p95 | Evaluate Neo4j or Apache AGE      |
| Graph depth exceeds 5 levels with >1M nodes  | Profile recursive CTE performance |
| Graph queries exceed 20% of total query time | Consider dedicated graph DB       |

---

## Vector Search: pgvector

### Decision

| Aspect      | Detail                                                              |
| ----------- | ------------------------------------------------------------------- |
| **Choice**  | pgvector (PostgreSQL extension) for embeddings storage and search   |
| **Purpose** | Semantic search, AI similarity matching, knowledge graph embeddings |

### Why pgvector

| Reason                 | Detail                                              |
| ---------------------- | --------------------------------------------------- |
| Embedded in PostgreSQL | No additional infrastructure. Same ACID guarantees. |
| Sufficient for MVP     | Handles millions of vectors with IVFFlat indexing   |
| Growing adoption       | De facto standard for PostgreSQL vector search      |
| Migration path         | Can migrate to Pinecone/Qdrant if scale requires    |

---

## Caching: Redis 7+

### Decision

| Aspect      | Detail                                                   |
| ----------- | -------------------------------------------------------- |
| **Choice**  | Redis 7+ (via managed service: Upstash or Railway)       |
| **Purpose** | Caching, session store, rate limiting, real-time pub/sub |

### Use Cases

| Use Case              | Pattern                               | TTL                   |
| --------------------- | ------------------------------------- | --------------------- |
| Session cache         | Session data after authentication     | 24 hours              |
| API response cache    | Frequent, slow-changing API responses | 5 minutes             |
| Rate limiting         | Sliding window counter                | 1 minute              |
| Knowledge Graph cache | Frequent graph queries                | 10 minutes            |
| BullMQ queue          | Background job management             | N/A (job persistence) |
| Pub/Sub               | Real-time event distribution          | N/A (ephemeral)       |

---

## Message Queue: BullMQ

### Decision

| Aspect      | Detail                                                             |
| ----------- | ------------------------------------------------------------------ |
| **Choice**  | BullMQ (Redis-backed job queue for Node.js)                        |
| **Purpose** | Background job processing, scheduled tasks, event-driven workflows |

### Job Types

| Job Type     | Priority | Retry   | Example                      |
| ------------ | -------- | ------- | ---------------------------- |
| Immediate    | High     | 3 times | AI recommendation generation |
| Scheduled    | Medium   | 3 times | Weekly opportunity review    |
| Batch        | Low      | 1 time  | Analytics aggregation        |
| Notification | High     | 5 times | Email sending                |

---

## Full-Text Search

### MVP: PostgreSQL Full-Text Search

| Aspect           | Detail                                                                |
| ---------------- | --------------------------------------------------------------------- |
| **Approach**     | PostgreSQL tsvector/tsquery for full-text search during MVP           |
| **Capabilities** | Stemming, ranking, phrase search, prefix matching                     |
| **Limitations**  | Limited relevance tuning, no typo tolerance, slower on large datasets |

### Post-MVP: Meilisearch (v1.1+)

| Aspect       | Detail                                                                |
| ------------ | --------------------------------------------------------------------- |
| **Trigger**  | Search query time exceeds 500ms OR user satisfaction with search <70% |
| **Approach** | Meilisearch — fast, typo-tolerant, instant search                     |

---

## Object Storage: S3-Compatible

### Decision

| Aspect      | Detail                                               |
| ----------- | ---------------------------------------------------- |
| **Choice**  | AWS S3 (or compatible: Cloudflare R2, MinIO)         |
| **Purpose** | File uploads, backups, exports, AI-generated content |

### Usage

| Data Type            | Storage Class        | TTL        |
| -------------------- | -------------------- | ---------- |
| User uploads         | Standard             | Indefinite |
| AI-generated reports | Standard             | 90 days    |
| Database backups     | Glacier/Deep Archive | 1 year     |
| Export files         | Standard             | 7 days     |

---

## Architecture References

| Reference | Relationship                                                                    |
| --------- | ------------------------------------------------------------------------------- |
| ARC-003   | Knowledge Graph architecture maps to PostgreSQL recursive CTEs + Drizzle schema |
| ENG-003   | Information Architecture maps to PostgreSQL schema + migration plan             |

---

## Cross-References

| Reference     | Relationship                                                                              |
| ------------- | ----------------------------------------------------------------------------------------- |
| BLP-002 / D03 | Drizzle ORM is the data access layer for all backend services                             |
| BLP-002 / D08 | Data encryption, backup, and retention policies align with security requirements          |
| BLP-002 / D12 | Decision Record — TDR-004 (Data Platform Decision)                                        |
| CMP-002       | Data residency, encryption at rest, and access controls are implemented at the data layer |

---

## Quality Review

| Dimension              | Assessment                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Why**                | Data platform decisions determine data integrity, query performance, operational complexity, and migration cost. |
| **Business Impact**    | PostgreSQL single-DB approach reduces MVP infrastructure cost by 70% vs. multi-DB approach.                      |
| **Engineering Impact** | Single database type (PostgreSQL) simplifies ORM layer, migration tooling, and development patterns.             |
| **Operational Impact** | Managed PostgreSQL (Supabase/Railway) eliminates DB administration. Redis via Upstash is zero-ops.               |
| **Security Impact**    | PostgreSQL RBAC, encryption at rest, and audit logging meet compliance requirements.                             |
| **Performance Impact** | pgvector handles millions of vectors. Redis caching reduces PostgreSQL read load.                                |
| **Cost Impact**        | One managed DB = one cost. Redis Upstash free tier covers MVP. S3 is pay-per-use.                                |
| **Future Scalability** | PostgreSQL scales vertically. Read replicas handle read scaling. Sharding (Citus) handles write scaling.         |

---

## Design Freeze Status

| Status    | Date       | Notes                                                    |
| --------- | ---------- | -------------------------------------------------------- |
| ✅ LOCKED | 2026-07-27 | Data Platform v1.0 frozen. Changes require CTO approval. |
