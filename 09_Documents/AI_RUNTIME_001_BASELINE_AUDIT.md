# AI-RUNTIME-001 — Baseline Audit (Phase 0 Freeze)

**Sprint:** EPIC-005 / AI-RUNTIME-001 — Production AI Readiness & Roadmap Reconciliation
**Date:** 2026-08-07
**Mode:** AUDIT — the repository and executed validation are the source of truth. No completion report was trusted blindly; every classification below was verified against source files, package exports, dependency graph, API routers, runtime wiring and tests.

---

## 1. Scope & Method

Audited the complete AI execution surface of VedMoulya OS v1.0:

- AI runtime contract (`packages/services/src/ai/`)
- Provider adapters (`services/orchestrator/src/providers/`)
- Gateway wiring (`services/api/src/services/ApiApplicationService.ts`, `RouterRegistry.ts`)
- Real AI consumers (Content Agency, ClientOps, Career/Business/Learning/Marketplace assemblies)
- RAG / retrieval path (Knowledge EI-009, Memory EI-010, Context EI-003, APP-001 Context Fabric)
- Token economics, prompt caching, observability, security, UI, tests, docs

Legend: 🟢 IMPLEMENTED + WIRED + VERIFIED · 🟡 IMPLEMENTED BUT NOT FULLY WIRED · 🟠 ARCHITECTURE ONLY · 🔴 MISSING · ⚠️ BLOCKED / DEPENDENCY

---

## 2. Capability Classification Matrix

| Capability                                           | Class                  | Evidence (verified in source)                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AI runtime contract** (`AIOrchestrationService`)   | 🟢                     | `packages/services/src/ai/AIOrchestrationService.ts` — orchestrate → request cache (5-min TTL, FNV-1a) → domain validation → candidate selection → per-provider retry (max 3, exponential backoff) → cross-provider fallback → failure classification → token/cost/latency metrics. 49 AI tests pass.                                                          |
| **Provider adapter abstraction** (`ProviderAdapter`) | 🟢                     | Interface in `AIOrchestrationService.ts` (`execute`, `getHealth`, `isHealthy`, optional `stream?`); implemented by `MockProvider` + `OpenAIProvider`. Business engines never import provider SDKs.                                                                                                                                                             |
| **Gateway provider registration**                    | 🟢 (fixed this sprint) | **P0 blocker found & fixed:** `ApiApplicationService` constructed `new AIOrchestrationService()` with **zero providers registered** — every real AI call threw `NotFoundError('Provider', …)`. Now `registerPlatformProviders(this.ai)` (Mock in non-production; OpenAI on `OPENAI_API_KEY`). Verified by 2 new production-wiring tests + full registry suite. |
| **Vercel AI SDK (`@ai-sdk/*` / `ai`)**               | 🔴                     | No `ai` / `@ai-sdk/*` dependency exists in any workspace (verified across all package.json). Provider adapters use raw `fetch`. Architecture rule ("AI SDK performs standardized interaction, VedMoulya owns the decision") is satisfied at the adapter seam, but streaming, structured output and tool calling have no SDK-backed implementation.             |
| **OpenAI provider adapter**                          | 🟡                     | Real `fetch` to `api.openai.com/v1` (chat/completions + models). **Timeout handling added this sprint** (AbortController, 60s default, 10s health). Still: no streaming, no structured output, no tool calls, hardcoded confidence/quality, single hardcoded cost formula.                                                                                     |
| **Retry / fallback / failure classification**        | 🟢                     | `executeWithRetryAndFallback` + `classifyFailure` (429→rate_limited, timeout→timeout, 5xx/network→provider_unavailable) — retryable failures retried, cross-provider fallback, recorded via metrics. Tests green.                                                                                                                                              |
| **RAG — knowledge retrieval (EI-009)**               | 🟡                     | Deterministic lexical-semantic ranker by **frozen design** ("NOT a vector database", documented OSR/EI-009 decision). No pgvector, no embedding execution. Retrieval is real, tested, permission-scoped.                                                                                                                                                       |
| **RAG — memory retrieval (EI-010)**                  | 🟡                     | Same design: deterministic lexical token-overlap retrieval. Real, tested.                                                                                                                                                                                                                                                                                      |
| **RAG — context reaches the model**                  | 🟢                     | Verified: `ContentAgencyAIService` retrieves knowledge (`retrieveKnowledge`) + memory (`retrieveMemory`) and **interpolates both into the research and draft prompts** (`buildResearchPrompt`, `buildUserPrompt`). Empty retrieval handled (sections skipped). Retrieval failure is caught → returns ''.                                                       |
| **Context Intelligence (EI-003) runtime activation** | 🟡                     | EI-003 ranking/filtering/compression/assembly are real services with tests, but **not invoked inside the AI execution path** — Content Agency passes context directly. APP-001 context-fabric assembly/compression exists separately. Wiring EI-003 compression into the runtime is remaining work.                                                            |
| **Token optimization (budget enforcement)**          | 🟢 (added this sprint) | **New:** `TokenEstimationService` in `@vedmoulya/ai` (4 chars/token + overhead + priming), `maxInputTokens` on `OrchestrateRequestDTO`, deterministic pre-provider budget guard in `AIOrchestrationService`, `ai.tokens.estimated` metric. 4 new tests (budget breach = cheap pre-billed failure).                                                             |
| **Prompt caching**                                   | 🔴                     | No provider prompt caching (no Anthropic `cache_control` etc.). An in-memory **response** cache exists (5-min TTL) with hit/miss metrics. Provider prompt-cache adapters are remaining work.                                                                                                                                                                   |
| **Provider intelligence → real routing**             | 🟡                     | EI-002 registry (health/benchmarks/capability matrix) and EI-004 strategy (budget/risk/candidates) are rich domain catalogs but **not consumed by the runtime**: `selectCandidates` filters registered adapters by capability in registration order. Deterministic — no random selection — but not intelligence-driven. Remaining work.                        |
| **Streaming**                                        | 🟠                     | `ProviderAdapter.stream?` exists in the contract; no adapter implements it; the orchestrator never invokes it; no streaming API or UI path. Architecture only.                                                                                                                                                                                                 |
| **Structured output / tool calls**                   | 🟠                     | `outputFormat` constraint exists and is passed as provider options only in the mock; `RequestConstraints.outputFormat` is validated but no provider enforces JSON schema. Architecture only.                                                                                                                                                                   |
| **Observability (metrics)**                          | 🟡                     | `AIMetrics` → `@vedmoulya/core` metrics (`ai.requests.*`, `ai.tokens.*`, `ai.cost.*`, `ai.cache.*`, `ai.fallback.*`, `ai.ratelimit.*`, `ai.provider.health`, `ai.validation.*`) exposed via the gateway `metrics` router. No OpenTelemetry / Langfuse / promptfoo exporters.                                                                                   |
| **AICompanion UI**                                   | 🟡 (fixed this sprint) | Was a **canned/demo component** (hardcoded setTimeout responses, no API call). Now wired to the real `ai.orchestrate` runtime with error + thinking states. Streaming/partial-response states still not implemented (no streaming in runtime).                                                                                                                 |
| **Security / tenancy (RAG)**                         | 🟢                     | Retrieval goes through the gateway auth + IDOR + rate-limit middleware; knowledge/memory repos are user-scoped via repositories; `ai.orchestrate` enforces `userId` = session user. Provider keys via env only. No secrets in code or logs.                                                                                                                    |
| **AI SDK / provider isolation rule**                 | 🟢                     | Business engines (Content Agency, assemblers) call `AIOrchestrationService` only; provider SDKs/keys live behind adapters. Architecture rule respected.                                                                                                                                                                                                        |

---

## 3. Verified Architecture (as built)

```
Human Intent → Goal/Task → Capability → Context (knowledge+memory retrieval)
→ Provider Intelligence (EI-002 registry: designed, not runtime-wired)
→ Execution Strategy (EI-004: designed, not runtime-wired)
→ AI Runtime (AIOrchestrationService: cache → validate → select → retry → fallback → metrics)
→ Provider Adapter Layer (OpenAIProvider / MockProvider — raw fetch)
→ Model
```

- VedMoulya **owns** capability selection, budget enforcement, retry/fallback and validation.
- The AI SDK would sit **below** the adapter seam (provider adapter → SDK → model). Today the adapter calls the provider API directly with `fetch` — a legitimate seam, but SDK-backed features (streaming, structured output, tool calls) are absent.

---

## 4. AI Execution Paths Verified in Executable Code

| Path                                                            | Runtime calls                                                                                   | Status                                |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------- |
| Content Agency generation (research → draft → 3 quality passes) | `ai.orchestrate` × 2–5 per asset                                                                | 🟢 now executes (was P0-broken)       |
| Content Agency regenerate with feedback                         | `ai.orchestrate` × 1–3                                                                          | 🟢                                    |
| ClientOps AI proposal drafting                                  | `ai.orchestrate`                                                                                | 🟢                                    |
| Career / Business / Learning / Marketplace insight assemblies   | `ai.orchestrate` (per-assembly, `safeCall`-guarded)                                             | 🟢                                    |
| `ai.*` tRPC namespace (direct AI execution API)                 | `orchestrate`, `listProviders`, `listCapabilities`, `getProviderHealth`, `getAllProviderHealth` | 🟢 **added this sprint**              |
| AICompanion UI                                                  | `ai.orchestrate` mutation                                                                       | 🟢 **added this sprint** (was canned) |

---

## 5. Documentation vs Reality — Drift Found

| Claim in docs                                             | Reality                                                        | Disposition                                       |
| --------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------- |
| "AI orchestration is wired" (implied by EPIC-003 records) | Gateway had **zero providers registered** — P0 runtime failure | **Fixed this sprint** (G1)                        |
| AI SDK integration (implied by sprint records)            | No AI SDK dependency exists                                    | Documented as condition (recommended next sprint) |
| Provider routing intelligence (EI-002/EI-004)             | Deterministic registration-order routing only                  | Documented as remaining work                      |
| AICompanion "Phoenix AI"                                  | Was canned responses                                           | **Fixed this sprint** (G5)                        |

No optimistic classifications were used: anything 🟢 above was verified in code + tests during this sprint.

---

## 6. Files Verified

- `packages/services/src/ai/AIOrchestrationService.ts`, `AIDTO.ts`, `AIMetrics.ts`, `AIMapper.ts`
- `services/orchestrator/src/index.ts`, `providers/OpenAIProvider.ts`, `providers/MockProvider.ts`
- `services/api/src/services/ApiApplicationService.ts`, `RouterRegistry.ts`, `routers/ContentAgencyRouter.ts`
- `packages/services/src/content-agency/ContentAgencyAIService.ts`, `ClientOpsAIService.ts`
- `packages/services/src/business|career|learning|marketplace/*Assembler.ts`
- `packages/ai/src/**`, `packages/context/**`, `packages/knowledge-intelligence/**`, `packages/memory-intelligence/**`, `packages/context-fabric/**`
- `apps/web/src/components/AICompanion.tsx`, `apps/web/src/lib/api-client.ts`, `apps/web/src/lib/trpc.ts`
