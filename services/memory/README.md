# Memory Engine Service

The Memory Engine is the intelligence layer for VedMoulya, responsible for capturing, recalling, consolidating, and managing memory lifecycle. It is **not storage** — it is a cognitive system that models how memories are formed, strengthened, decay, and relate to each other.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                    │
│  ┌──────────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ REST (Hono)  │  │ tRPC     │  │ OpenAPI Metadata  │  │
│  └──────┬───────┘  └────┬─────┘  └───────────────────┘  │
│         │               │                                │
│  ┌──────▼───────────────▼────────────────────────────┐   │
│  │              Application Layer                     │   │
│  │  MemoryApplicationService                          │   │
│  │  MemorySearchService   MemoryTimelineService       │   │
│  │  MemoryReflectionService  MemoryRetentionService   │   │
│  │  MemoryMapper   MemoryDTOs   MemoryContracts       │   │
│  └──────────────────────┬────────────────────────────┘   │
├─────────────────────────┼───────────────────────────────┤
│              Domain Layer (Frozen)                       │
│  ┌──────────────────────▼────────────────────────────┐   │
│  │  Memory (Entity)  MemoryFactory                    │   │
│  │  MemoryDomainService  MemoryRules                  │   │
│  │  Value Objects: Category, Importance, Confidence,  │   │
│  │    Strength, Freshness, State, Source, Version,    │   │
│  │    RetentionPolicy                                 │   │
│  │  MemoryRepository (Interface)                      │   │
│  │  Domain Events (18 types)                          │   │
│  └──────────────────────┬────────────────────────────┘   │
├─────────────────────────┼───────────────────────────────┤
│              Infrastructure Layer                        │
│  ┌──────────────────────▼────────────────────────────┐   │
│  │  PostgresMemoryRepository (Drizzle ORM)            │   │
│  │  MemoryCache (In-memory TTL cache)                 │   │
│  │  MemoryEventPublisher (Event bus integration)      │   │
│  │  MemoryMetrics (OpenTelemetry)                     │   │
│  │  MemoryTracing (Distributed tracing)               │   │
│  │  MemoryAuditor (Audit logging)                     │   │
│  │  DatabaseConnection (pg + PostGIS)                 │   │
│  │  MemoryModule (DI / Inversify)                     │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Memory Lifecycle

```
Created → Active ←→ Recalled
           │            │
           ▼            ▼
        Decaying ──→ Recalled (strengthened)
           │
           ▼
        Archived ←→ Restored
           │
           ▼
        Forgotten
```

### States

| State          | Description                                     |
| -------------- | ----------------------------------------------- |
| `active`       | Memory is current and available                 |
| `recalled`     | Memory was successfully recalled (strengthened) |
| `decaying`     | Memory strength is decreasing from lack of use  |
| `strengthened` | Memory was deliberately reinforced              |
| `merged`       | Memory was merged with another memory           |
| `archived`     | Memory moved to long-term storage               |
| `forgotten`    | Memory permanently removed                      |

## Spaced Repetition

Memories use an SM-2 inspired spaced repetition algorithm:

- **Strength**: 0.0–1.0 scale indicating how well a memory is retained
- **Interval**: Hours until next recall is due
- **Ease Factor**: 1.3–3.0 multiplier that adjusts interval length
- **Successful recall**: Increases strength and ease factor
- **Failed recall**: Decreases strength and ease factor
- **Decay**: Strength decreases naturally over time when not recalled

## Knowledge Graph Integration

The Memory Engine integrates with the Knowledge Graph (BLD-006) through contracts only:

- **Memory → Knowledge**: Memories reference Knowledge Nodes but never duplicate them
- **Knowledge Graph**: Remains the single source of semantic truth
- **BLD-006 Contracts**: Used for all Knowledge Graph operations
- **No duplication**: Memory stores experience, observation, history, and context only

## AI Orchestrator Integration

The Memory Engine integrates with the AI Orchestrator (BLD-005) through contracts only:

- **Context Retrieval**: Memories provide context for AI conversations
- **Timeline Summarization**: Memory timelines provide conversation history
- **Reflection Preparation**: Memory patterns provide insights
- **Minimum Context Principle**: Only relevant memories are provided
- **No direct provider calls**: All AI operations go through BLD-005 contracts

## API Endpoints

### REST (Hono)

| Method | Path                                     | Description                  |
| ------ | ---------------------------------------- | ---------------------------- |
| POST   | `/api/v1/memory/memories`                | Capture a new memory         |
| GET    | `/api/v1/memory/memories/:id`            | Recall a memory by ID        |
| PATCH  | `/api/v1/memory/memories/:id`            | Update a memory              |
| DELETE | `/api/v1/memory/memories/:id`            | Forget a memory              |
| POST   | `/api/v1/memory/memories/:id/strengthen` | Strengthen a memory          |
| POST   | `/api/v1/memory/memories/:id/weaken`     | Weaken a memory              |
| POST   | `/api/v1/memory/memories/:id/archive`    | Archive a memory             |
| POST   | `/api/v1/memory/memories/:id/restore`    | Restore a memory             |
| GET    | `/api/v1/memory/memories/:id/timeline`   | Get memory timeline          |
| POST   | `/api/v1/memory/memories/merge`          | Merge two memories           |
| GET    | `/api/v1/memory/search`                  | Search memories with filters |
| GET    | `/api/v1/memory/stats`                   | Get memory statistics        |
| GET    | `/api/v1/memory/health`                  | Health check                 |

### tRPC

All REST endpoints are also available as tRPC procedures with full type safety.

## Database Schema

### `memories` table

| Column            | Type                   | Description                                               |
| ----------------- | ---------------------- | --------------------------------------------------------- |
| id                | `text PRIMARY KEY`     | Unique memory identifier                                  |
| category          | `text NOT NULL`        | Memory category (experience, observation, etc.)           |
| label             | `text NOT NULL`        | Memory title                                              |
| content           | `text NOT NULL`        | Memory content/body                                       |
| importance_level  | `text NOT NULL`        | Importance level (low, medium, high, critical, maximum)   |
| importance_score  | `real NOT NULL`        | Importance score (0–10)                                   |
| confidence_level  | `text NOT NULL`        | Confidence level (very_low, low, medium, high, very_high) |
| confidence_score  | `real NOT NULL`        | Confidence score (0–1)                                    |
| strength_score    | `real NOT NULL`        | Memory strength (0–1)                                     |
| freshness_score   | `real NOT NULL`        | Freshness indicator                                       |
| state             | `text NOT NULL`        | Current lifecycle state                                   |
| source_type       | `text NOT NULL`        | Source of the memory                                      |
| version_major     | `int NOT NULL`         | Version tracking                                          |
| retention_class   | `text NOT NULL`        | Retention policy class                                    |
| knowledge_node_id | `text`                 | Reference to Knowledge Graph node                         |
| tags              | `jsonb`                | Array of tags                                             |
| metadata          | `jsonb`                | Flexible metadata                                         |
| created_at        | `timestamptz NOT NULL` | Creation timestamp                                        |
| updated_at        | `timestamptz NOT NULL` | Last update timestamp                                     |
| last_recalled_at  | `timestamptz`          | Last recall timestamp                                     |

**Indexes**: 24 database indexes for optimized query performance.

## Retention Policies

| Class        | TTL      | Min Importance | Description            |
| ------------ | -------- | -------------- | ---------------------- |
| `permanent`  | ∞        | 0              | Never forgotten        |
| `long_term`  | 365 days | 2              | Archived after 1 year  |
| `short_term` | 30 days  | 3              | Archived after 30 days |
| `transient`  | 7 days   | 4              | Forgotten after 7 days |

## Configuration

| Variable               | Default          | Description                        |
| ---------------------- | ---------------- | ---------------------------------- |
| `MEMORY_DATABASE_URL`  | `postgres://...` | PostgreSQL connection string       |
| `MEMORY_CACHE_TTL`     | `5000`           | Cache time-to-live in ms           |
| `MEMORY_MAX_RETENTION` | `1000`           | Max memories before retention runs |

## Running

```bash
# Development
cd services/memory
npm run dev

# Build
npm run build

# Tests
npm run test

# Coverage
npm run test:coverage
```
