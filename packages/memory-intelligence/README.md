# @vedmoulya/memory-intelligence

**Enterprise Memory Intelligence Platform** (EPIC-004 / EI-010).

The Enterprise Memory Layer of VedMoulya — it records, retrieves, ranks,
compresses, consolidates and evolves experience across the entire operating
system. This is **not** chat history, **not** a vector database, and **not**
conversation memory. It is the governed memory layer of the platform:

> VedMoulya must remember users, projects, goals, tasks, business decisions,
> executions, provider performance, learning, context, knowledge usage and
> business outcomes — without confusing Memory and Knowledge.

Every memory item is typed, owned, sourced, importance-scored, confidence-rated,
ranked, compressed, consolidated, retained, related, cited, and audited.

## Why this layer exists

Until EI-010, VedMoulya knew _what_ it knew (EI-009 Knowledge) but could not
say _what it had experienced_: which provider stayed reliable, which strategy
held its budget, which failure pattern keeps recurring, what the user prefers.
The Memory Intelligence Platform closes that gap. It is the single registry of
**evolving experience** across the operating system, separate from but tightly
integrated with Knowledge:

> **Knowledge** (EI-009) represents authoritative facts.
> **Memory** (EI-010) represents evolving experience.
>
> The two systems remain architecturally separate but tightly integrated:
> memories carry citations back to knowledge items, and knowledge usage is
> recorded as memory events. No duplicated logic.

## Architecture

Follows the EI-001…EI-009 layering: `types → contracts → domain →
infrastructure → application → catalog`.

```
src/
  types/        MemoryItem, 14 memory types, 10 relationship types, …
  contracts/    MemoryEngines — narrow ports to EI-001…EI-009
  domain/
    rules/      validation + lifecycle-transition rules
    repository/ MemoryRepository contract
    graph/      MemoryGraph — abstract interface (future graph-storage seam)
    services/   capture, importance, ranking, retrieval, compression,
                consolidation, expiration, lifecycle, analytics, citation,
                relationship detection
    value-objects/ branded ids
  infrastructure/
    InMemoryMemoryRepository (+ graph)   hermetic test double
    PostgresMemoryRepository (+ graph)   memory_registry JSONB table
  application/  DTOs + Mapper + MemoryApplicationService (the API facade)
  catalog/      seed memory (23 items across all 14 memory types)
```

## The Memory Pipeline

```
Event
  ↓
Memory Capture
  ↓
Classification
  ↓
Importance Scoring
  ↓
Consolidation
  ↓
Relationship Detection
  ↓
Ranking
  ↓
Compression
  ↓
Retrieval
  ↓
Enterprise Brain
  ↓
Execution
  ↓
Learning
  ↓
Memory Update
```

This package performs the Capture → Compression stages; the downstream stages
(Enterprise Brain → Execution → Learning → Memory Update) consume the registry
through the other engines' existing flows — **no duplicated logic**.

## Memory types (14)

`working` · `session` · `project` · `business` · `capability` · `provider` ·
`execution` · `decision` · `learning` · `context` · `user_preference` ·
`failure` · `success` · `long_term`.

## Memory lifecycle

`captured → validated → consolidated → ranked → compressed → active`, then
`archived` or `expired` (retention TTLs), with restore (`archived → active`).
Every transition is rule-gated and audited.

## Retrieval (eleven match modes)

`goal` · `project` · `user` · `capability` · `provider` · `context` · `time` ·
`importance` · `similarity` · `business_module` · `keyword` — deterministic,
no LLM, no vector DB.

## Integration matrix (EI-001…EI-009)

The Memory Layer _consumes_ every engine through narrow ports (`MemoryEngines`)
and owns none:

| Engine                    | Port                | Used for                    |
| ------------------------- | ------------------- | --------------------------- |
| EI-001 Capabilities       | `getMarketplace`    | link memory to capabilities |
| EI-002 Providers          | `getMarketplace`    | link memory to providers    |
| EI-003 Context            | `getContextSummary` | link memory to contexts     |
| EI-004 Execution Strategy | `getSummary`        | link memory to strategies   |
| EI-005 Orchestrator       | `getSummary`        | link memory to executions   |
| EI-006 Goals              | `getSummary`        | link memory to goals        |
| EI-007 Learning           | `getDashboard`      | consumer registration       |
| EI-008 Brain              | `getDashboard`      | consumer registration       |
| EI-009 Knowledge          | `getDashboard`      | consumer registration       |

## Usage

```ts
import {
  MemoryApplicationService,
  InMemoryMemoryRepository,
  InMemoryMemoryGraph,
} from '@vedmoulya/memory-intelligence';

const repository = new InMemoryMemoryRepository();
const app = new MemoryApplicationService(repository, new InMemoryMemoryGraph(repository), engines);

await app.capture({
  title: 'OpenAI stayed reliable on reasoning runs',
  content: 'Three consecutive pipeline runs completed with high quality.',
  source: 'execution history (EI-005)',
  sourceType: 'execution',
  owner: 'platform',
  type: 'provider',
  relatedProvider: 'openai',
  relatedGoal: 'goal_blog_seed',
});
const results = await app.retrieve({ goal: 'goal_blog_seed' });
```

## Tests

```bash
npm test            # vitest run
npm run test:coverage   # ≥80% statements/branches/functions/lines
npm run typecheck   # tsc --noEmit
```
