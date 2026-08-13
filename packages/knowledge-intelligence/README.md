# @vedmoulya/knowledge-intelligence

**Enterprise Knowledge Intelligence Platform** (EPIC-004 / EI-009).

The Enterprise Knowledge Layer of VedMoulya — the authoritative knowledge
source used by every Enterprise Intelligence Engine and every future business
module. This is **not** a document management system, **not** a vector
database, and **not** another RAG library. It is a governed knowledge platform:

> VedMoulya must know **what** it knows, **where** it came from, **who** uses
> it, **whether** it is trusted, **whether** it is current, **what** depends on
> it, and **how** it should be used.

Every knowledge item is versioned, validated, searchable, explainable,
traceable, and reusable.

## Why this layer exists

Until EI-009, VedMoulya executed, learned, and decided — but it could not say
_why_ it trusts a source, _who_ consumes a fact, or _what_ would break if a
document became stale. The Knowledge Intelligence Platform closes that gap: it
is the single registry every engine consults for authoritative knowledge, with
full provenance and governance.

## Architecture

Follows the EI-001…EI-008 layering: `types → contracts → domain →
infrastructure → application → catalog`.

```
src/
  types/        KnowledgeItem, 14 categories, 10 relationship types, …
  contracts/    KnowledgeEngines — narrow ports to EI-001…EI-008
  domain/
    rules/      validation + lifecycle + validation-transition rules
    repository/ KnowledgeRepository contract
    graph/      KnowledgeGraph — abstract interface (future graph-storage seam)
    services/   trust, ranking, search, relationships, validation, lifecycle,
                version/diff, analytics, citation, explainer, enrichment
    value-objects/ branded ids
  infrastructure/
    InMemoryKnowledgeRepository (+ graph)   hermetic test double
    PostgresKnowledgeRepository (+ graph)   knowledge_registry JSONB table
  application/  DTOs + Mapper + KnowledgeApplicationService (the API facade)
  catalog/      seed knowledge (30 items across all 14 categories)
```

## The Knowledge Pipeline

```
Source → Ingestion → Classification → Validation → Relationship Detection
  → Knowledge Registry → Versioning → Trust Scoring → Search
  → Context Intelligence → Enterprise Brain → Execution
  → Learning Feedback → Knowledge Update
```

This package performs the registry, validation, relationship-detection,
versioning, trust-scoring, and search stages. The downstream stages consume the
registry through the other engines' existing flows — **no duplicated logic**.

## Search (eight modes)

`semantic` (deterministic lexical-semantic ranker — no LLM, no vector DB) ·
`keyword` · `category` · `relationship` · `dependency` · `consumer` · `trust` ·
`version`.

## Integration matrix (EI-001…EI-008)

The Knowledge Layer _consumes_ every engine through narrow ports
(`KnowledgeEngines`) and owns none:

| Engine                    | Port                | Used for                                  |
| ------------------------- | ------------------- | ----------------------------------------- |
| EI-001 Capabilities       | `getMarketplace`    | cross-link items documenting capabilities |
| EI-002 Providers          | `getMarketplace`    | cross-link items documenting providers    |
| EI-003 Context            | `getContextSummary` | consumer registration                     |
| EI-004 Execution Strategy | `getSummary`        | consumer registration                     |
| EI-005 Orchestrator       | `getSummary`        | consumer registration                     |
| EI-006 Goals              | `getSummary`        | cross-link items documenting goals        |
| EI-007 Learning           | `getDashboard`      | consumer registration                     |
| EI-008 Brain              | `getDashboard`      | consumer registration                     |

## Usage

```ts
import {
  KnowledgeApplicationService,
  InMemoryKnowledgeRepository,
  InMemoryKnowledgeGraph,
} from '@vedmoulya/knowledge-intelligence';

const repository = new InMemoryKnowledgeRepository();
const app = new KnowledgeApplicationService(
  repository,
  new InMemoryKnowledgeGraph(repository),
  engines,
);

await app.create({
  title: 'OpenAI provider profile',
  description: '…',
  source: 'EI-002',
  sourceType: 'repository',
  owner: 'platform-team',
  category: 'ai',
  tags: ['openai'],
});
const results = await app.search({ query: 'provider profiles' });
```

## Tests

```bash
npm test            # vitest run
npm run test:coverage   # ≥80% statements/branches/functions/lines
npm run typecheck   # tsc --noEmit
```
