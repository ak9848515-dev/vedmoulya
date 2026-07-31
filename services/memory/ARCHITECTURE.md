# Memory Engine Architecture

## Overview

The Memory Engine implements a cognitive memory system for VedMoulya. It models how human-like memories are captured, strengthened through recall, decay over time, and eventually archived or forgotten.

## Domain Model

```mermaid
classDiagram
    class Memory {
        +MemoryId id
        +MemoryCategory category
        +string title
        +string content
        +MemoryImportance importance
        +MemoryConfidence confidence
        +MemoryStrength strength
        +MemoryFreshness freshness
        +MemoryState state
        +MemorySource source
        +MemoryVersion version
        +MemoryRetentionPolicy retentionPolicy
        +string knowledgeNodeId
        +string[] tags
        +Record~string, unknown~ metadata
        +Date createdAt
        +Date updatedAt
        +Date lastRecalledAt
        +create(props) Memory
        +update(title, content) void
        +recall() void
        +failedRecall() void
        +applyDecay(hours) void
        +merge(other) void
        +archive(reason) void
        +restore() void
        +forget(reason) void
        +strengthenConfidence(amount) void
        +weakenConfidence(amount) void
        +increaseImportance(delta) void
        +decreaseImportance(delta) void
        +linkToKnowledgeNode(id) void
        +unlinkFromKnowledgeNode() void
        +addTag(tag) void
        +removeTag(tag) void
        +updateMetadata(data) void
        +changeCategory(category) void
        +changeRetentionPolicy(policy) void
        +pullEvents() MemoryEvent[]
    }

    class MemoryFactory {
        +createMemory(command) CreateMemoryResult
        +reconstructMemory(data) Memory
    }

    class MemoryDomainService {
        +applyDecay() DecayResult[]
        +applyRetentionPolicies() RetentionResult
        +suggestConsolidation(category) ConsolidationSuggestion[]
        +getTimelineSummary() TimelineSummary
        +calculateImportance(params) MemoryImportance
        +calculateConfidence(params) MemoryConfidence
    }

    class MemoryRules {
        +memoryContentRule
        +importanceConstraintRule
        +retentionPolicyRule
        +validate(rules, memory) ValidationResult
    }

    class MemoryRepository {
        <<interface>>
        +findById(id) Memory
        +save(memory) void
        +update(memory) void
        +delete(id) void
        +exists(id) boolean
        +count() number
        +countByCategory() Record
        +countByState() Record
        +countLinked() number
        +search(params, pagination) PaginatedResult
        +findByCategory(category, pagination) PaginatedResult
        +findByState(state, pagination) PaginatedResult
        +getTimeline(order, pagination) TimelineEntry[]
        +findByKnowledgeNodeId(id) Memory[]
        +findRelatedMemories(category, pagination) PaginatedResult
        +findDecayingMemories(pagination) PaginatedResult
        +findMemoriesNeedingReinforcement(pagination) PaginatedResult
    }

    Memory --> MemoryFactory : creates
    Memory --> MemoryDomainService : uses
    Memory --> MemoryRules : validates
    MemoryDomainService --> MemoryRepository : uses
```

## Memory Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Active : create
    Active --> Recalled : recall()
    Active --> Decaying : decay / failedRecall()
    Active --> Merged : merge()
    Active --> Archived : archive()
    Recalled --> Active : complete
    Decaying --> Recalled : recall()
    Decaying --> Archived : archive / retention
    Archived --> Active : restore()
    Archived --> Forgotten : forget() / retention
    Merged --> Active : complete
    Forgotten --> [*]
```

## Spaced Repetition Algorithm

```mermaid
flowchart LR
    A[Memory Created] --> B{Successful Recall?}
    B -->|Yes| C[Increase Strength]
    B -->|No| D[Decrease Strength]
    C --> E[Increase Ease Factor]
    D --> F[Decrease Ease Factor]
    E --> G[Lengthen Interval]
    F --> H[Shorten Interval]
    G --> I{Interval Due?}
    H --> I
    I -->|Yes| B
    I -->|No| J[Apply Decay]
    J --> I
```

## Application Layer Architecture

```mermaid
flowchart TD
    subgraph API["Presentation Layer"]
        REST["REST (Hono)"]
        TRPC["tRPC"]
        WS["WebSocket"]
    end

    subgraph APP["Application Layer"]
        MAS["MemoryApplicationService"]
        MSS["MemorySearchService"]
        MTS["MemoryTimelineService"]
        MRS["MemoryReflectionService"]
        MRTS["MemoryRetentionService"]
    end

    subgraph DOM["Domain Layer (Frozen)"]
        MEM["Memory Entity"]
        FACTORY["MemoryFactory"]
        DOMSVC["MemoryDomainService"]
        RULES["MemoryRules (4 rules)"]
        EVENTS["18 Domain Events"]
        REPO["MemoryRepository Interface"]
    end

    subgraph INFRA["Infrastructure Layer"]
        PGREPO["PostgresMemoryRepository"]
        CACHE["MemoryCache"]
        PUB["MemoryEventPublisher"]
        METRICS["MemoryMetrics"]
        TRACER["MemoryTracer"]
        AUDITOR["MemoryAuditor"]
        DB["Drizzle ORM + pg"]
    end

    subgraph EXT["External Integrations"]
        KG["Knowledge Graph (BLD-006)"]
        AI["AI Orchestrator (BLD-005)"]
    end

    REST --> MAS
    REST --> MSS
    REST --> MTS
    REST --> MRS
    TRPC --> MAS
    TRPC --> MSS

    MAS --> DOM
    MSS --> DOM
    MTS --> DOM
    MRS --> DOM
    MRTS --> DOM

    MAS --> REPO
    MSS --> REPO
    MTS --> REPO
    MRS --> REPO
    MRTS --> DOMSVC

    REPO --> PGREPO
    PGREPO --> DB
    PUB --> AI
    METRICS --> AI
    TRACER --> AI

    MEM --> KG
    MEM --> EVENTS
    EVENTS --> PUB
```

## Sequence Diagrams

### Capture Memory

```mermaid
sequenceDiagram
    participant Client
    participant Controller as MemoryController
    participant Service as MemoryApplicationService
    participant Factory as MemoryFactory
    participant Rules as MemoryRules
    participant Repo as MemoryRepository
    participant KG as Knowledge Graph
    participant Bus as EventBus

    Client->>Controller: POST /memories
    Controller->>Controller: validate(captureMemorySchema)
    Controller->>Service: captureMemory(dto)
    Service->>Factory: createMemory(command)
    Factory->>Factory: build Memory entity
    Factory-->>Service: Memory

    Service->>Rules: validate([rules], memory)
    Rules-->>Service: { valid: true }

    Service->>Repo: save(memory)
    Repo-->>Service: void

    Service->>Service: MemoryMapper.toDTO(memory)
    Service-->>Controller: { success, data: MemoryDTO }

    Controller-->>Client: 201 { success, data }

    Note over Service,Bus: Asynchronously
    Service->>Bus: memory.created event
    Bus->>KG: reference check (if linked)
```

### Recall and Spaced Repetition

```mermaid
sequenceDiagram
    participant Client
    participant Controller as MemoryController
    participant Service as MemoryApplicationService
    participant Repo as MemoryRepository
    participant Bus as EventBus

    Client->>Controller: GET /memories/:id?strengthen=true
    Controller->>Service: recallMemory(id, true)

    Service->>Repo: findById(id)
    Repo-->>Service: Memory

    Service->>Service: memory.recall()
    Note over Service: Increases strength<br/>Updates ease factor<br/>Refreshes freshness

    Service->>Repo: update(memory)
    Repo-->>Service: void

    Service->>Service: MemoryMapper.toDTO(memory)
    Service-->>Controller: { success, data }

    Controller-->>Client: 200 { success, data }

    par Asynchronous events
        Service->>Bus: memory.recalled event
        Service->>Bus: memory.strength_updated event
    end
```

### Memory Decay and Retention

```mermaid
sequenceDiagram
    participant Scheduler
    participant RetentionService as MemoryRetentionService
    participant DomainService as MemoryDomainService
    participant Repo as MemoryRepository
    participant Bus as EventBus

    Scheduler->>RetentionService: applyDecay()

    RetentionService->>DomainService: applyDecay()
    DomainService->>Repo: findByState('active')
    Repo-->>DomainService: Memory[]

    loop Each active memory
        DomainService->>DomainService: calculate elapsed hours
        DomainService->>DomainService: memory.applyDecay(hours)

        alt State transitioned
            DomainService->>Repo: update(memory)
            DomainService->>Bus: memory.decayed event
        end
    end

    DomainService-->>RetentionService: DecayResult[]
    RetentionService->>RetentionService: MemoryMapper.toDecayResults()
    RetentionService-->>Scheduler: { success, data: DecayResultDTO[] }

    Scheduler->>RetentionService: applyRetentionPolicies()

    RetentionService->>DomainService: applyRetentionPolicies()
    DomainService->>Repo: findByState('active', 'decaying')
    Repo-->>DomainService: Memory[]

    loop Each memory
        DomainService->>DomainService: policy.shouldRetain()
        alt Should not retain, importance >= 3
            DomainService->>DomainService: memory.archive()
            DomainService->>Repo: update(memory)
            DomainService->>Bus: memory.archived event
        else Should not retain, importance < 3
            DomainService->>DomainService: memory.forget()
            DomainService->>Repo: update(memory)
            DomainService->>Bus: memory.forgotten event
        end
    end

    DomainService-->>RetentionService: { archived, forgotten }
    RetentionService-->>Scheduler: { success, data: RetentionResultDTO }
```

### Search with Filters

```mermaid
sequenceDiagram
    participant Client
    participant Controller as MemoryController
    participant Service as MemoryApplicationService
    participant Repo as MemoryRepository

    Client->>Controller: GET /search?q=typescript&category=experience&state=active&page=1

    Controller->>Controller: validate(searchQuery)
    Controller->>Service: searchMemories({ query: 'typescript', categories: ['experience'], states: ['active'], page: 1, limit: 20 })

    Service->>Service: build MemorySearchParams
    Service->>Repo: search({ query: 'typescript', categories: ['experience'], states: ['active'] }, { page: 1, limit: 20 })

    Repo->>Repo: ILIKE query, category filter, state filter
    Repo-->>Service: { data: Memory[], total: filteredCount }

    Service->>Service: MemoryMapper.toListDTO(data, total, page, limit)
    Service-->>Controller: { success, data: MemoryListDTO }

    Controller-->>Client: 200 { success, data }
```

## Retention Policy Decision Flow

```mermaid
flowchart TD
    A[Memory Created] --> B{Which Retention Class?}
    B -->|permanent| C[Never forgotten]
    B -->|long_term| D[365 day TTL]
    B -->|short_term| E[30 day TTL]
    B -->|transient| F[7 day TTL]

    C --> G[Always retained]
    D --> H{Days since creation > 365?}
    E --> I{Days since creation > 30?}
    F --> J{Days since creation > 7?}

    H -->|No| G
    H -->|Yes| K{Importance >= 2?}
    I -->|No| G
    I -->|Yes| L{Importance >= 3?}
    J -->|No| G
    J -->|Yes| M{Importance >= 4?}

    K -->|Yes| N[Archive]
    K -->|No| O[Forget]
    L -->|Yes| N
    L -->|No| O
    M -->|Yes| N
    M -->|No| O
```

## Observability

```mermaid
flowchart LR
    subgraph Metrics
        M1["memories.captured"]
        M2["memories.recalled"]
        M3["memories.strengthened"]
        M4["memories.decayed"]
        M5["memories.archived"]
        M6["memories.forgotten"]
        M7["searches.executed"]
        M8["cache.hits / misses"]
    end

    subgraph Tracing
        T1["memory.capture"]
        T2["memory.recall"]
        T3["memory.search"]
        T4["memory.decay"]
        T5["memory.retention"]
    end

    subgraph Audit
        A1["memory.captured"]
        A2["memory.recalled"]
        A3["memory.archived"]
        A4["memory.forgotten"]
        A5["search.executed"]
        A6["retention.executed"]
    end
```

## Extension Guide

### Adding a New Memory Category

1. Add the category to `packages/domain/src/memory/value-objects/MemoryCategory.ts`
2. Add to the Zod schema in `services/memory/src/presentation/validation/MemorySchemas.ts`
3. Add mapper support if needed

### Adding a New Memory Operation

1. Add entity method in `packages/domain/src/memory/entities/Memory.ts`
2. Add domain event in `packages/domain/src/memory/events/MemoryEvent.ts`
3. Add application service method in `packages/services/src/memory/MemoryApplicationService.ts`
4. Add REST endpoint in `services/memory/src/presentation/controllers/MemoryController.ts`
5. Add tRPC procedure in `services/memory/src/presentation/trpc/MemoryRouter.ts`
6. Add metrics in `services/memory/src/observability/MemoryMetrics.ts`
7. Add audit in `services/memory/src/observability/MemoryAudit.ts`

### Adding a New Retention Policy

1. Add class to `packages/domain/src/memory/value-objects/MemoryRetentionPolicy.ts`
2. Add to the Zod schema's `retentionClass` enum
3. Update database migration if needed
