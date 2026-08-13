# Context Intelligence

> Give every AI call the minimum necessary context — retrieve, select, prune, then send.
> Owner: AI Platform Team · Updated: 2026-08-04 (EI-003)

## Purpose

Define how VedMoulya assembles context for AI calls: the constitutional principle that every AI call must use the minimum necessary context, backed by retrieval from Memory and Knowledge and structured prompt building.

## Scope

- Context sources (memory, knowledge, brand profiles, user state)
- Retrieval and selection strategies
- Prompt building with retrieved context
- Token/context size governance
- **EI-003 — Enterprise Context Intelligence Engine**: the intelligence layer that determines WHAT information, HOW MUCH, WHICH, and IN WHAT ORDER to send to an AI call — before any execution.

## Current Status

**🟢 EI-003 COMPLETE** — the Enterprise Context Intelligence Engine (`packages/context`) is implemented:

- **Context Registry** — stores every context item across 11 sources and 14 categories with priority, importance, confidence, freshness, token estimate, tags, business modules, and capability attribution.
- **Context Ranking** — 5-dimensional scoring (priority, relevance, freshness, business, confidence) composited into a final context score.
- **Context Filtering** — duplicate removal, source/category/priority/capability/business/tag filters, confidence/importance/token/time/user filters.
- **Context Compression Pipeline** — chunk selection → ranking → merge → strategy → minimal context assembly. Six strategies (extractive, abstractive, summary, top_k, threshold, hybrid). Architecture supports future LLMLingua integration at the strategy execution point.
- **Context Assembly** — builds the Enterprise Context Package (goal, capability, memory, knowledge, business, client, documents, prompt, metadata) with an assembled prompt string.
- **Context Metrics** — original tokens, compressed tokens, reduction %, compression time, quality estimate, confidence.
- **Discovery** — search, filter, preview, and explain context with score breakdowns.
- **API Gateway** — full `context.*` tRPC namespace (17 procedures) wired into `RouterRegistry`.
- **Web Explorer** — `/context` Enterprise Context Explorer (registry browser, intelligence pipeline, compression lab) with dark mode and responsive design.

The Content Agency (EPIC-003) already builds brand-aware, retrieval-augmented prompts; the EI-003 engine is the generalized, reusable intelligence layer that any module can consume.

## Architecture

```
Context Request
  ├─ Context Registry (sources: memory, knowledge, business rules, client data…)
  ├─ Ranking (priority · relevance · freshness · business · confidence → final score)
  ├─ Filtering (dedupe · source/category/capability/business/time/user)
  ├─ Compression pipeline (chunk selection → ranking → merge → strategy)
  ├─ Assembly (Enterprise Context Package: goal, capability, slots, prompt)
  └─ Orchestrator call (with token budget + confidence metadata)
```

## Components

| Component           | Location                                                            | Purpose                                            |
| ------------------- | ------------------------------------------------------------------- | -------------------------------------------------- |
| Domain types        | `packages/context/src/types/context-types.ts`                       | ContextItem, scores, filters, compression, package |
| Ranking service     | `packages/context/src/domain/services/ContextRankingService.ts`     | 5-dimension scoring + ranking                      |
| Filtering service   | `packages/context/src/domain/services/ContextFilteringService.ts`   | Dedupe + structured filters                        |
| Compression service | `packages/context/src/domain/services/ContextCompressionService.ts` | 6-strategy token compression pipeline              |
| Assembly service    | `packages/context/src/domain/services/ContextAssemblyService.ts`    | Enterprise Context Package builder                 |
| Repository          | `packages/context/src/domain/repository/ContextRepository.ts`       | Persistence contract                               |
| In-memory repo      | `packages/context/src/infrastructure/InMemoryContextRepository.ts`  | Seeded Map-backed implementation                   |
| Application service | `packages/context/src/application/ContextApplicationService.ts`     | Orchestrates registry + pipeline + discovery       |
| Gateway router      | `services/api/src/routers/ContextRouter.ts`                         | tRPC `context.*` procedures                        |
| Web explorer        | `apps/web/src/app/context/page.tsx`                                 | Context Explorer UI                                |

## Responsibilities

- AI Platform Team: context sources and selection quality
- Module teams: declare required context; never dump everything
- EI-003 engine: rank, filter, compress, and assemble the minimum useful context

## Deliverables

- ✅ `packages/context` — full Enterprise Context Intelligence Engine (EI-003)
- ✅ `context.*` tRPC API namespace (registry, ranking, filtering, compression, assembly, discovery)
- ✅ `/context` Enterprise Context Explorer (desktop/tablet/mobile, dark mode)
- ✅ 85 package tests + gateway tests (246 total in `services/api`)
- Brand-aware prompt builders (realized in Content Agency)
- Token constraint enforcement (realized)

## Dependencies

- `packages/context` depends on `@vedmoulya/core` (pagination) and `@vedmoulya/ai` (capability taxonomy)
- `services/api` wires the seeded `InMemoryContextRepository`; Postgres persistence is a future swap-in
- [MEMORY_ARCHITECTURE.md](./MEMORY_ARCHITECTURE.md), [KNOWLEDGE_ARCHITECTURE.md](./KNOWLEDGE_ARCHITECTURE.md)
- [AI_PROVIDER_MATRIX.md](./AI_PROVIDER_MATRIX.md) (EI-002 provider intelligence feeds context metadata)

## Future Work

- Postgres ContextRepository for cross-restart persistence
- LLMLingua or equivalent external compression integration (extension point designed)
- Context cost telemetry per call
- Automatic context selection heuristics from historical success rates

## References

- [TOKEN_OPTIMIZATION.md](./TOKEN_OPTIMIZATION.md)
- [09_Documents/EI-003_Completion_Report.md](../09_Documents/EI-003_Completion_Report.md)
