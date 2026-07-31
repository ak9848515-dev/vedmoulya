# Data Flow

**Mission:** Define how information moves through the VedMoulya Intelligence Platform — from user input through DNA, memory, knowledge, decision, execution, and analytics.

**Version:** 1.0
**Status:** Draft
**Owner:** Chief Enterprise Architect
**Dependencies:** Core Components.md, Decision Flow.md, Knowledge Flow.md, Event Flow.md
**Created:** 2026-07-24
**Updated:** 2026-07-24

## Description

Data flows through VedMoulya in well-defined paths. Each flow has a source, a transformation path, and a destination. This document maps every major data flow in the platform, describing how information moves, transforms, and persists.

---

## Primary Data Flow

```
┌──────┐     ┌──────┐     ┌─────────┐     ┌──────────┐     ┌───────────┐
│ USER │────▶│ DNA  │────▶│ MEMORY  │────▶│KNOWLEDGE │────▶│ DECISION  │
│      │     │      │     │         │     │  GRAPH   │     │           │
└──────┘     └──────┘     └─────────┘     └──────────┘     └─────┬─────┘
                                                                  │
         ┌────────────────────────────────────────────────────────┘
         │
         ▼
   ┌──────────┐     ┌───────────┐     ┌───────────┐
   │EXECUTION │────▶│ ANALYTICS │────▶│ LEARNING  │────▶ DNA (update)
   │          │     │           │     │           │
   └──────────┘     └───────────┘     └───────────┘
```

---

## Data Flow by Type

### 1. User Input Flow

**Path:** User → API Gateway → Security Layer → Application Layer → DNA Update

**Data:** Voice, text, clicks, gestures, form submissions, file uploads

**Transformations:**

1. Raw input → Structured command (API Gateway)
2. Structured command → Authenticated request (Security Layer)
3. Authenticated request → Business event (Application Layer)
4. Business event → DNA attribute update (DNA Engine)

**Persistence:**

- Event stored in Event Log (short-term)
- DNA attributes updated (long-term)
- Raw input archived in user history (retention policy)

**Latency target:** < 100ms for input acknowledgment

---

### 2. DNA Query Flow

**Path:** Decision Engine → DNA Service → Data Store → Decision Engine

**Data:** User identity, skills, knowledge, goals, learning profile, personality, context, progress

**Transformations:**

1. Query → Dimension/attribute selector (DNA Service)
2. Selected attributes → Aggregated DNA profile
3. Aggregated profile → Context bundle for downstream use

**Caching:**

- Hot DNA (high-confidence, recently updated) cached in memory
- Warm DNA (recent but lower confidence) in distributed cache
- Cold DNA (rarely accessed) in primary data store

**Latency target:** < 5ms for cached, < 30ms for uncached

---

### 3. Memory Flow

**Path:** User Interaction → Memory Engine → Vector Store + Summary Store → Recall API

**Data:** Conversation history, past decisions, user preferences, interaction context

**Transformations:**

1. Raw interaction → Structured memory entry
2. Memory entry → Embedding for vector search
3. Memory entry → Summary for concise recall
4. Multiple related entries → Consolidated memory

**Persistence:**

- Vector embeddings in vector database
- Full history in document store
- Summaries in key-value store

**Latency target:** < 50ms for recall, < 200ms for storage

---

### 4. Knowledge Flow

**Path:** Knowledge Sources → Knowledge Engine → Knowledge Graph → Query API → Downstream Components

**Data:** Domain knowledge, skill taxonomies, concept relationships, learning content metadata

**Transformations:**

1. Raw source → Parsed entities and relationships
2. Parsed entities → Validated and deduplicated
3. Validated entities → Graph nodes and edges
4. Graph → Query results for specific contexts

**Persistence:**

- Graph database (Neo4j or similar)
- Full-text search index (Elasticsearch or similar)
- Entity cache for hot knowledge

**Latency target:** < 100ms for graph queries, < 50ms for cached entities

_See Knowledge Flow.md for detailed knowledge lifecycle._

---

### 5. Decision Flow

**Path:** Decision Engine → Reasoning Engine → Planning Engine → Execution Engine

**Data:** User context, knowledge, options, plans, execution status

**Transformations:**

1. Context → Option generation
2. Options → Scored and ranked
3. Selected option → Actionable plan
4. Plan → Executed tasks

**Persistence:**

- Decision records in audit log (immutable)
- Active plans in execution store
- Completed plans in history

**Latency target:** < 500ms (planning), execution duration varies

_See Decision Flow.md for detailed decision lifecycle._

---

### 6. Recommendation Flow

**Path:** User DNA + Context → Recommendation Engine → Candidate Scoring → Ranking → Presentation

**Data:** Recommendation candidates, user preferences, historical engagement

**Transformations:**

1. Candidates → Relevance scoring against DNA
2. Scored candidates → Timeliness filter
3. Filtered candidates → Readiness check
4. Ready candidates → Diversity re-ranking
5. Ranked candidates → Presentation with explanations

**Caching:**

- Pre-computed recommendations for active users
- Candidate pools refreshed on schedule
- User preference aggregates cached

**Latency target:** < 200ms

---

### 7. Execution Flow

**Path:** Plan → Task Queue → Worker → Status Update → Completion Event

**Data:** Task definitions, execution status, results, artifacts

**Transformations:**

1. Plan step → Task definition
2. Task → Queued by priority
3. Queued task → Executed by worker
4. Execution → Status update
5. Completed → Result stored, event emitted

**Persistence:**

- Task queue (Redis, RabbitMQ, or similar)
- Execution state in operational database
- Completed task results in archive

**Latency target:** Real-time for user-facing tasks, batch for background tasks

---

### 8. Analytics Flow

**Path:** Events → Event Bus → Stream Processor → Data Warehouse → Dashboards

**Data:** All platform events, user actions, system metrics, business metrics

**Transformations:**

1. Raw event → Normalized event format
2. Normalized event → Enriched with context
3. Enriched → Aggregated into metrics
4. Metrics → Stored in data warehouse
5. Data → Visualized in dashboards

**Persistence:**

- Event stream (Kafka or similar) — 30-day retention
- Processed metrics — 2-year retention
- Aggregated reports — Indefinite

**Latency target:** Real-time dashboards < 5s, reports daily

---

## Data Flow Matrix

| Data Type       | Source       | Destinations                 | Persistence    | Sensitivity |
| --------------- | ------------ | ---------------------------- | -------------- | ----------- |
| User Identity   | User         | DNA, Security, Profile       | Primary DB     | High        |
| User Actions    | User         | DNA, Memory, Analytics       | Event Log      | Medium      |
| Conversation    | User+AI      | Memory, Analytics, Learning  | Vector Store   | High        |
| Knowledge       | Ext. Sources | Knowledge Graph              | Graph DB       | Low         |
| Decisions       | Platform     | Audit Log, Memory, Analytics | Audit Store    | Medium      |
| Recommendations | Platform     | User, Analytics, Learning    | Analytics DB   | Low         |
| Transactions    | User+MP      | Earnings, Analytics, Audit   | Transaction DB | High        |
| Metrics         | All          | Analytics, Dashboards        | Warehouse      | Low-Medium  |

---

## Cross-References

- **Decision Flow.md** — The decision data flow within the broader flow
- **Knowledge Flow.md** — The knowledge sub-flow
- **Event Flow.md** — Events that trigger and result from data flows
- **Core Components.md** — The components data flows through
- **VedMoulya Intelligence.md** — The intelligence architecture data serves
- **PRD-002** — DNA data model (User DNA = data in flow)
- **PRD-001** — Journey data (HPI, stages = data in flow)
- **RSH-001** — Human Problems data informs which knowledge to prioritize in the Knowledge Flow
- **CMP-001** — Business strategy determines which data metrics to collect in Analytics Flow

### Future Expansion

- Data streaming with event sourcing
- Real-time data replication across regions
- Data lake for ML training pipelines
- Data mesh for domain-oriented data ownership
- Data marketplace for user-authorized data sharing
- Federated data flows for privacy-preserving analytics
