# AI-RUNTIME-002 — Baseline Audit

**Sprint:** EPIC-005 / AI-RUNTIME-002 — SDK Runtime, Intelligent Provider Routing & Context Optimization
**Date:** 2026-08-07
**Mode:** REVERIFY → IMPLEMENT → VALIDATE

---

## 1. Purpose

AI-RUNTIME-001 certified the runtime **🟡 READY WITH CONDITIONS**. The conditions were:

1. No Vercel AI SDK integration (raw-fetch adapters only).
2. EI-002 provider intelligence not consulted for runtime routing.
3. EI-004 execution strategy not consulted for runtime routing.
4. EI-003 context compression not activated in the runtime path.
5. No prompt caching.
6. Incomplete production telemetry integration.

AI-RUNTIME-002 must convert the runtime from _reliable, provider-independent execution_ into
_intelligent, observable, optimized, provider-aware execution_ — without rebuilding any frozen
EI/OS engine.

This document is the **Phase 0 reverification baseline**: every claim below was re-checked against
source before implementation began. Previous completion reports were not trusted blindly.

---

## 2. Verified baseline state (pre-implementation)

### 2.1 AI orchestration service (`packages/services/src/ai/AIOrchestrationService.ts`)

| Area                   | Verified state                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Constructor            | `AIOrchestrationService(options)` with retry backoff, cache bounds, requestCache (FIFO, 5-min TTL)                                                 |
| Provider registration  | `registerProvider(adapter)` — `ProviderAdapter` runtime contract (name, family, capabilities, health, execute, optional stream/generateStructured) |
| Retry/fallback         | `executeWithRetryAndFallback` — per-provider retry (max 3) with exponential backoff, deterministic fallback chain                                  |
| Failure classification | `classifyFailure` → rate_limited / timeout / provider_unavailable / internal_error                                                                 |
| Request cache          | Deterministic FNV-1a key over request inputs; `ai.cache.hit` / `ai.cache.miss` metrics                                                             |
| Token budget           | AI-RUNTIME-001 `TokenEstimationService` + `maxInputTokens` pre-provider guard                                                                      |
| Structured output      | `generateStructured` optional adapter method + `StructuredOutputValidator` (AI-RUNTIME-002, added this sprint)                                     |
| Streaming              | `stream()` server-side collection into typed events (AI-RUNTIME-002, added this sprint)                                                            |

### 2.2 Provider adapters (`services/orchestrator/src/providers/`)

| Adapter                   | Status          | Notes                                                                                    |
| ------------------------- | --------------- | ---------------------------------------------------------------------------------------- |
| `OpenAIProvider`          | raw-fetch       | Timeout via AbortController (60s default / 10s health); retryable-timeout classification |
| `MockProvider`            | mock            | Non-production default; production requires explicit `AI_ENABLE_MOCK=true`               |
| `VercelAIProvider`        | **NOT PRESENT** | AI SDK-backed adapter — primary gap                                                      |
| `OpenAIEmbeddingProvider` | **NOT PRESENT** | SDK-backed embeddings for RAG — primary gap                                              |

**Vercel AI SDK:** `ai` / `@ai-sdk/openai` were **not installed** in any workspace. Raw fetch was
the only production execution mechanism.

### 2.3 EI-002 Provider Intelligence (`packages/providers`)

- `ProviderApplicationService` with provider registry, models, capability matrix, health, benchmarks.
- **Not consumed** by the AI runtime: provider selection ignored EI-002 intelligence entirely.
- `ProviderDTO` shape: `ProviderDTO`, `ProviderModelDTO`, `ProviderCapabilityMatrixDTO`, etc.

### 2.4 EI-004 Execution Strategy (`packages/execution-strategy`)

- `ExecutionStrategyApplicationService` — strategy registry (balanced, quality-first, cost-first,
  latency-first) with budget/risk concepts and preferred-provider hints.
- **Not consumed** by the AI runtime.

### 2.5 EI-003 Context Intelligence (`packages/context`)

| Service                     | Exported API                                                                                          | Used in runtime?              |
| --------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------- |
| `ContextRankingService`     | `scoreItems`, `rankItems`                                                                             | ❌ not wired                  |
| `ContextFilteringService`   | `process(items, criteria)`                                                                            | ❌ not wired                  |
| `ContextCompressionService` | `compress({items, targetTokens, strategy, preserveCritical})`                                         | ❌ not wired                  |
| Context types               | `ContextItem`, `ContextSource`, `ContextCategory`, `ContextPriority`, filter/compression result types | consumed by the new optimizer |

### 2.6 RAG

- **No `packages/rag` workspace.** No chunking service, no embedding provider, no vector
  repository, no pgvector migration, no `rag.*` API.
- EI-009 (Knowledge) / EI-010 (Memory) retrieval feeds prompts in the Content Agency pipeline via
  `knowledgeContext` interpolation — real but not a formal RAG path with semantic vectors.

### 2.7 Observability

- `AIMetrics` singleton over `@vedmoulya/core` metrics registry (counters/gauges/histograms).
- No OTel/Langfuse exporters wired in the runtime (frozen OS decision — exporter integration is
  post-v1 backlog; metrics registry remains the canonical telemetry sink this sprint extends).

### 2.8 Gateway (`services/api`)

- `ai.*` tRPC namespace exists (orchestrate, listProviders, listCapabilities, getProviderHealth,
  getAllProviderHealth) behind auth + IDOR + rate limits + zod.
- `ApiApplicationService` wires `registerPlatformProviders(this.ai)` (P0 fix from AI-RUNTIME-001).
- **No `rag.*` namespace**, no `ai.stream`, no `ai.explainSelection`.
- `ProductionRepositories.ts` — Postgres factories for all seven EI stores; no RAG factory.

### 2.9 Web

- `api-client.ts` has `aiRuntime` hooks (orchestrate, listProviders, listCapabilities, health).
- `AICompanion.tsx` wired to the real runtime with thinking + error states (AI-RUNTIME-001) but no
  PREPARING_CONTEXT / SELECTING_MODEL / STREAMING / VALIDATING states and no provider indicator.

---

## 3. Dependency & convention checks (pre-implementation)

| Check                                | Result                                                                                                                                                                |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package manager                      | npm workspaces (`apps/*`, `packages/*`, `services/*`)                                                                                                                 |
| DB layer                             | `postgres` (postgres.js) + JSONB registry pattern; `packages/providers/src/infrastructure/PostgresProviderRepository.ts` is the canonical pattern                     |
| Root tsconfig references             | Each package is a composite project referenced from `tsconfig.json`                                                                                                   |
| Package convention                   | `package.json` + `tsconfig.json` + `vitest.config.ts` + `src/{types,contracts?,domain,infrastructure,application,catalog}` + `src/index.ts` barrel                    |
| npm registry access                  | ✅ reachable — `npm ping` OK                                                                                                                                          |
| `ai` / `@ai-sdk/openai` availability | Installed at `ai@7.0.56`, `@ai-sdk/openai@4.0.34` (verified exports: `generateText`, `streamText`, `generateObject`, `jsonSchema`, `embedMany`, `tool`)               |
| Circular dependency risk             | `packages/context`, `packages/providers`, `packages/execution-strategy` do **not** import `@vedmoulya/services` → safe for direct consumption from the runtime module |
| zod                                  | Available (used by gateway routers)                                                                                                                                   |

---

## 4. Audit classification (Phase 0 — every capability classified from source)

| Capability                                              | Classification (pre-implementation)                                                      |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| AI orchestration runtime (retry/fallback/cache/metrics) | 🟢 production-ready (AI-RUNTIME-001)                                                     |
| Raw-fetch `OpenAIProvider`                              | 🟡 partially implemented (production path, no SDK)                                       |
| `MockProvider`                                          | 🟡 mocked (explicit non-production default)                                              |
| Vercel AI SDK (`ai` / `@ai-sdk/openai`)                 | 🔴 missing (not installed)                                                               |
| SDK-backed `VercelAIProvider`                           | 🔴 missing                                                                               |
| Embedding provider (RAG)                                | 🔴 missing                                                                               |
| Production RAG (`packages/rag`, pgvector)               | 🔴 missing                                                                               |
| EI-002 provider intelligence → runtime routing          | 🟠 incorrectly wired (engine exists, runtime ignores it)                                 |
| EI-004 execution strategy → runtime routing             | 🟠 incorrectly wired (engine exists, runtime ignores it)                                 |
| EI-003 ranking/filtering/compression in runtime         | 🟠 incorrectly wired (services exist, not consumed by runtime)                           |
| Prompt caching                                          | 🔴 missing                                                                               |
| Structured output validation in runtime                 | 🟡 partially implemented (AI-RUNTIME-002 added this sprint)                              |
| Streaming in runtime/UI                                 | 🟡 partially implemented (added this sprint)                                             |
| `ai.*` API                                              | 🟢 production-ready (orchestrate/list/health; stream/explainSelection added this sprint) |
| AICompanion runtime-state UX                            | 🟡 partially implemented (thinking + error only)                                         |
| Observability (metrics registry)                        | 🟢 production-ready (OTel/Langfuse exporters: 📄 documentation-only, frozen-OS backlog)  |

Legend: 🟢 production-ready · 🟡 partially implemented · 🟠 incorrectly wired · 🔴 missing · 📄 documentation-only. No duplicated models/services were found; no circular dependencies (verified in §3).

## 5. Gap matrix (verified → fixed in this sprint)

| #   | Gap                                                  | Severity                            | Classification                                                                                                                                                 |
| --- | ---------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | No Vercel AI SDK installed / used                    | **P0** (amendment hard requirement) | Implemented: `VercelAIProvider` (generateText/streamText/Output.object), `OpenAIEmbeddingProvider` (embedMany), registered as primary runtime path             |
| G2  | No RAG package (chunking, embeddings, pgvector repo) | **P0** (amendment hard requirement) | Implemented: `packages/rag` with chunking, embedding port + mock, InMemory + Postgres pgvector repos, application service, `rag.*` API                         |
| G3  | No AI input optimization in the runtime              | **P0** (amendment hard requirement) | Implemented: `ContextOptimizer` (EI-003 rank → filter → dedupe → compress → token estimate → budget) + `TokenOptimizationResult` + AI-SELECT explanations      |
| G4  | EI-002/EI-004 not consulted for routing              | P1                                  | Implemented: `ProviderRoutingAdvisor` + narrow ports + typed `ProviderSelectionExplanation`; `ai.explainSelection`                                             |
| G5  | No prompt caching                                    | P2                                  | Implemented: `PromptCacheManager` (stable/dynamic split, tenant-safe keys, TTL, hit/miss metrics, key-parity fix)                                              |
| G6  | No streaming in runtime/UI                           | P2                                  | Implemented: `stream()` events + AICompanion STREAMING state                                                                                                   |
| G7  | No structured output in runtime                      | P2                                  | Implemented: `generateStructured` + validator + bounded retry (tested)                                                                                         |
| G8  | No Evidence-First foundation (states + abstention)   | P1 (Phase 8 / DoD)                  | Implemented: `EvidenceEvaluator` (SUFFICIENT/PARTIAL/INSUFFICIENT/CONFLICTING), `groundingRequired` abstention, RAG-cache bypass, retrieval-failure abstention |

---

## 6. Pre-implementation validation snapshot

| Gate          | Result                                                          |
| ------------- | --------------------------------------------------------------- |
| Full suite    | 6 321 tests / 489 files — 0 failures (AI-RUNTIME-001 certified) |
| Coverage gate | 29/29 workspaces ≥80%                                           |
| Lint          | 0 errors / 0 warnings                                           |
| Typecheck     | 0 errors                                                        |
| `next build`  | PASS                                                            |

These gates are re-run at the end of AI-RUNTIME-002 (see completion report §Tests/§Coverage/§Build).

---

_Baseline established 2026-08-07. The repository — not prior reports — is the source of truth._
