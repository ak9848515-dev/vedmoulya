# Decision Intelligence Engine

**BLD-008 — Version 1.0 — COMPLETE**

The Decision Intelligence Engine is the reasoning layer of the VedMoulya platform. It owns the complete decision lifecycle — from request through analysis, evaluation, decision, implementation, and review. Every decision is **explainable**, **traceable**, **versioned**, and **observable**.

> **Decision Engine owns reasoning.** AI Orchestrator provides AI capabilities only.
> **Knowledge Graph owns semantic truth.** Memory Engine owns experiential history.
> **Execution Engine executes decisions.**

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DECISION INTELLIGENCE ENGINE                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  DOMAIN LAYER (packages/domain/decision)                     │   │
│  │                                                               │   │
│  │  Decision (Aggregate Root) · DecisionOption                  │   │
│  │  DecisionScore · DecisionRisk · DecisionOpportunity          │   │
│  │  DecisionStatus · DecisionPriority · DecisionConfidence      │   │
│  │  DecisionVersion · DecisionConstraint · DecisionReasoning    │   │
│  │  DecisionOutcome · DecisionId                                │   │
│  │  DecisionFactory · DecisionDomainService · DecisionRules     │   │
│  │  DecisionRepository (interface) · DecisionEvent (14 types)   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  APPLICATION LAYER (packages/services/decision)              │   │
│  │                                                               │   │
│  │  DecisionApplicationService · DecisionMapper                │   │
│  │  CreateDecisionDTO · UpdateDecisionDTO · DecisionDTO        │   │
│  │  ScoreOptionDTO · AssessRiskDTO · DecideDTO                 │   │
│  │  RankingDTO · RecommendationDTO · TradeoffDTO               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  INFRASTRUCTURE LAYER (services/decision)                    │   │
│  │                                                               │   │
│  │  PostgresDecisionRepository · DecisionCache                  │   │
│  │  DecisionEventPublisher · DecisionModule (DI)                │   │
│  │  DecisionMetrics · DecisionAuditor · DecisionTracer          │   │
│  │  KnowledgeGraphClient · MemoryEngineClient                   │   │
│  │  AIOrchestratorClient · DecisionExplainabilityService       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  PRESENTATION LAYER (services/decision)                      │   │
│  │                                                               │   │
│  │  REST (Hono) · tRPC · OpenAPI · Zod Validation              │   │
│  │  DecisionController · DecisionRoutes · DecisionRouter       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### Decision Lifecycle

```
requested → analyzing → evaluating → decided → implementing → completed → reviewed → archived
     │           │            │          │             │              │
     └───────────┴────────────┴──────────┴─────────────┴──────────────┘
                                    ↕
                              cancelled (at any point)
```

### Decision Components

| Component               | Description                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| **Decision**            | Aggregate root — contains all decision data, manages lifecycle, enforces rules                       |
| **DecisionOption**      | A choice being evaluated — can have scores, risks, opportunities                                     |
| **DecisionScore**       | Multi-criteria weighted scoring (0–10 overall, multiple criteria with weights)                       |
| **DecisionRisk**        | Risk assessment (5 levels: critical, high, medium, low, negligible)                                  |
| **DecisionOpportunity** | Opportunity assessment (5 levels: transformational, high, moderate, low, minimal)                    |
| **DecisionReasoning**   | Cognitive framework (6 methods: analytical, comparative, rule_based, heuristic, ai_assisted, manual) |
| **DecisionConstraint**  | Business rules (6 types: must, must_not, should, should_not, limit, requirement)                     |
| **DecisionStatus**      | Lifecycle state machine (9 states with validated transitions)                                        |
| **DecisionPriority**    | Urgency/importance (5 levels: critical through optional, score 0–10)                                 |
| **DecisionConfidence**  | Certainty (5 levels: very_high through unknown, score 0.0–1.0)                                       |
| **DecisionVersion**     | Semver tracking (major.minor.patch)                                                                  |
| **DecisionOutcome**     | Result after implementation (success, partial, neutral, failure, unknown)                            |

### Domain Events

14 event types track every state change:

- `decision.created` · `decision.status_changed` · `decision.made` · `decision.completed`
- `decision.archived` · `decision.cancelled` · `decision.reevaluated`
- `decision.option_added` · `decision.option_scored` · `decision.knowledge_linked`
- `decision.memory_linked` · `decision.confidence_updated` · `decision.evidence_added` · `decision.reviewed`

---

## Decision Scoring Framework

Options are scored across multiple weighted criteria:

```
Total Score = Σ(criterion_score × weight) / total_weight

Weights are normalized to produce a 0–10 overall score.
```

### Scoring Dimensions (per Decision API Contract)

| Dimension  | Weight | Description                               |
| ---------- | ------ | ----------------------------------------- |
| Priority   | 3x     | How important relative to other needs     |
| Impact     | 3x     | How much improvement for the user         |
| Effort     | 2x     | Time/energy/resources required (inverted) |
| Confidence | 2x     | Certainty this is the right option        |
| Urgency    | 2x     | Time-sensitivity of this decision         |
| Readiness  | 1x     | Is the user prepared to act?              |

**Max score:** (10×3) + (10×3) + (10×2) + (10×2) + (10×2) + (10×1) = **130**

### Confidence Calculation

```
Confidence = (DataQuality × 0.40) + (HistoricalPerformance × 0.35) + (SimilarUserPatterns × 0.25)
```

| Range    | Level     | Action                                          |
| -------- | --------- | ----------------------------------------------- |
| 0.9–1.0  | Very High | Auto-approve low-stakes decisions               |
| 0.7–0.9  | High      | Present with explanation                        |
| 0.4–0.7  | Medium    | Present with alternatives, request confirmation |
| 0.01–0.4 | Low       | Human review required                           |
| 0.0      | Unknown   | Collect more data first                         |

---

## Decision Explainability

Every decision contains:

| Component            | Description                           |
| -------------------- | ------------------------------------- |
| Decision ID          | Unique identifier                     |
| Decision Version     | Semver version                        |
| Inputs Used          | Context, knowledge, memory references |
| Knowledge References | Linked Knowledge Graph nodes          |
| Memory References    | Linked Memory Engine entries          |
| Assumptions          | Recorded assumptions                  |
| Constraints          | Applied constraints                   |
| Options Considered   | All options with scores               |
| Scoring Matrix       | Per-criterion scores and weights      |
| Reasoning Summary    | Why this decision was made            |
| Risk Summary         | Risk assessment per option            |
| Opportunity Summary  | Opportunity assessment per option     |
| Confidence Score     | Confidence with level                 |
| Recommended Action   | The selected option                   |
| Alternative Actions  | Other options considered              |
| Timestamp            | When the decision was made            |

### Explanation Formats

| Format   | Length           | Use Case                |
| -------- | ---------------- | ----------------------- |
| Short    | 1 sentence       | Notifications, widgets  |
| Standard | 2-3 sentences    | Recommendation cards    |
| Detailed | Full paragraph   | Expanded view, coaching |
| Raw      | Machine-readable | API consumers           |

---

## Integration Contracts

### Knowledge Graph (BLD-006) — Consume Only

```
KnowledgeGraphClient.getDecisionContext(userId, category)
  → { goals, skills, projects, relevantKnowledge }

KnowledgeGraphClient.queryKnowledge(query, scope)
  → { results[], metadata }
```

### Memory Engine (BLD-007) — Consume Only

```
MemoryEngineClient.getMemoryContext(decisionId, userId)
  → { pastDecisions, relevantExperiences, observations }

MemoryEngineClient.getPastDecisions(userId)
  → PastDecisionData[]
```

### AI Orchestrator (BLD-005) — AI Assistance Only

```
AIOrchestratorClient.requestReasoning({ capability, userInput, context })
  → { content, confidence, provider, traceId }

AIOrchestratorClient.generateOptions(decisionContext)
  → string[]

AIOrchestratorClient.generateExplanation(decisionData)
  → string
```

> **Critical:** AI may assist with reasoning, but the **Decision Engine owns the final decision model**. Never allow providers to bypass policies, constraints, confidence scoring, explainability, or risk assessment.

---

## Getting Started

### Prerequisites

- Node.js ≥ 20
- PostgreSQL (for persistence)
- Knowledge Graph Service (for KG integration)
- Memory Engine Service (for memory integration)
- AI Orchestrator (for AI assistance)

### Build

```bash
# Build domain package
cd packages/domain && tsc --build

# Build services package
cd packages/services && tsc --build
```

### Test

```bash
# Run all domain tests (380+ tests)
cd packages/domain && npx vitest run

# Run decision-specific tests only
cd packages/domain && npx vitest run -- --decision

# Run service tests
cd packages/services && npx vitest run
```

### Configuration

Environment variables:

| Variable                      | Default                                        | Description                |
| ----------------------------- | ---------------------------------------------- | -------------------------- |
| `DECISION_DATABASE_URL`       | `postgres://localhost:5432/vedmoulya_decision` | Database connection        |
| `DECISION_DB_POOL_MAX`        | `10`                                           | Connection pool size       |
| `DECISION_CACHE_TTL_MS`       | `300000`                                       | Cache TTL (5 min)          |
| `DECISION_DEFAULT_PRIORITY`   | `5`                                            | Default priority score     |
| `DECISION_EXPLANATION_FORMAT` | `standard`                                     | Default explanation format |
| `KNOWLEDGE_SERVICE_URL`       | `http://localhost:4003`                        | Knowledge Graph URL        |
| `MEMORY_SERVICE_URL`          | `http://localhost:4004`                        | Memory Engine URL          |
| `ORCHESTRATOR_SERVICE_URL`    | `http://localhost:4001`                        | AI Orchestrator URL        |

---

## API Endpoints

| Method | Path                                                      | Description        |
| ------ | --------------------------------------------------------- | ------------------ |
| POST   | `/api/v1/decision/decisions`                              | Create decision    |
| GET    | `/api/v1/decision/decisions`                              | List decisions     |
| GET    | `/api/v1/decision/decisions/:id`                          | Get decision       |
| PATCH  | `/api/v1/decision/decisions/:id`                          | Update decision    |
| DELETE | `/api/v1/decision/decisions/:id`                          | Archive decision   |
| POST   | `/api/v1/decision/decisions/:id/analyze`                  | Start analysis     |
| POST   | `/api/v1/decision/decisions/:id/evaluate`                 | Start evaluation   |
| POST   | `/api/v1/decision/decisions/:id/options`                  | Add option         |
| POST   | `/api/v1/decision/decisions/:id/options/:oid/score`       | Score option       |
| POST   | `/api/v1/decision/decisions/:id/options/:oid/risk`        | Assess risk        |
| POST   | `/api/v1/decision/decisions/:id/options/:oid/opportunity` | Assess opportunity |
| GET    | `/api/v1/decision/decisions/:id/rankings`                 | Rank options       |
| GET    | `/api/v1/decision/decisions/:id/recommend`                | Get recommendation |
| POST   | `/api/v1/decision/decisions/:id/decide`                   | Make decision      |
| POST   | `/api/v1/decision/decisions/:id/complete`                 | Complete decision  |
| POST   | `/api/v1/decision/decisions/:id/archive`                  | Archive decision   |
| POST   | `/api/v1/decision/decisions/:id/cancel`                   | Cancel decision    |
| GET    | `/api/v1/decision/decisions/search`                       | Search decisions   |
| GET    | `/api/v1/decision/decisions/stats`                        | Get statistics     |
| GET    | `/api/v1/decision/health`                                 | Health check       |

---

## Project Structure

```
services/decision/
├── src/
│   ├── config/              # Environment-based configuration
│   ├── constants/            # Shared constants, thresholds, enums
│   ├── errors/               # Structured error types
│   ├── infrastructure/       # Persistence, cache, events, DI
│   ├── integration/          # KG, Memory, AI Orchestrator clients
│   ├── observability/        # Metrics, audit, tracing
│   ├── presentation/         # REST, tRPC, OpenAPI, validation
│   ├── schema/               # Drizzle ORM database schema
│   ├── services/             # Explainability service
│   ├── types/                # Service-layer type definitions
│   ├── utils/                # Utility functions
│   └── index.ts              # Barrel exports
├── __tests__/                # Service-level tests
└── README.md

packages/domain/src/decision/
├── entities/                 # Decision (aggregate root)
├── events/                   # 14 domain event types
├── factory/                  # DecisionFactory
├── repository/               # DecisionRepository interface
├── rules/                    # Business rules
├── services/                 # DecisionDomainService
├── value-objects/            # 11 value objects
└── __tests__/                # 10 test files

packages/services/src/decision/
├── DecisionApplicationService.ts
├── DecisionDTO.ts
├── DecisionMapper.ts
└── __tests__/
```

---

## Observability

| Component       | Purpose                                           |
| --------------- | ------------------------------------------------- |
| DecisionMetrics | Metrics collection (counters, histograms, gauges) |
| DecisionAuditor | Audit logging for all decision operations         |
| DecisionTracer  | Distributed tracing with correlation IDs          |

### Metrics Collected

- Decision creation rate
- Decision status transitions
- Option scoring distribution
- Confidence scores
- Risk assessment counts
- API latency
- Integration client health

---

## Extension Guide

To extend the Decision Engine:

1. **New value objects** — Add to `packages/domain/src/decision/value-objects/` and export from `index.ts`
2. **New decision operations** — Add methods to `DecisionEntity`, expose via `DecisionDomainService`, wire through `DecisionApplicationService`
3. **New REST endpoints** — Add to `DecisionController`, register in `DecisionRoutes`
4. **New integration clients** — Add to `services/decision/src/integration/` following existing patterns
5. **New explanation formats** — Add to `DecisionExplainabilityService`

---

## License

© VedMoulya — Proprietary. All rights reserved.
