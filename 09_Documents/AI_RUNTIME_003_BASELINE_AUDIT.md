# AI-RUNTIME-003 — Baseline Audit

**Sprint:** EPIC-005 / AI-RUNTIME-003 — Production AI Calibration, Live RAG Validation & Runtime Intelligence Hardening
**Date:** 2026-08-08
**Mode:** REVERIFY → CALIBRATE → VALIDATE → CERTIFY
**Source of truth:** [`AI_RUNTIME_002_Implementation_Report.md`](./AI_RUNTIME_002_Implementation_Report.md) + repository state. No prior claim is trusted blindly.

---

## 1. Purpose

AI-RUNTIME-002 received 🟢 **CONDITION-FREE PRODUCTION APPROVAL**. AI-RUNTIME-003 does
**not** reopen, redesign, or regress that architecture. Its objective is to move the
platform from _implementation verified_ to _real-world calibrated and operationally proven_:

1. Live RAG / Postgres validation (migration, pgvector, ingest → embed → persist → retrieve).
2. RAG quality calibration (precision vs. recall vs. rejection, thresholds, topK).
3. AI input-optimization calibration (tokens ↔ evidence ↔ cost ↔ latency).
4. Provider routing calibration (deterministic, explainable, per-task-type).
5. Evidence-First accuracy hardening (abstention, conflict surfacing, unsupported claims).
6. Secure tool runtime validation (full chain re-verified).
7. Observability validation (spans, redaction, no duplication).
8. Real-world 20-scenario test matrix.
9. Performance measurement.
10. Documentation synchronization.

This document is the **Phase 0 reverification baseline**: every item below was re-checked
against source and executable behavior on 2026-08-08 before calibration began.

---

## 2. Verified repository state (frozen AI-RUNTIME-002 architecture)

| Area                  | Verified component                                                                     | State                                                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| AI execution          | `AIOrchestrationService` (`packages/services/src/ai/AIOrchestrationService.ts`)        | Present; SDK-backed; orchestrates full stage sequence                                                                     |
| Provider adapter      | `ProviderAdapter` boundary + `VercelAIProvider` (`services/orchestrator`)              | Primary path = Vercel AI SDK; raw fetch gated behind `AI_RUNTIME_LEGACY_RAW_FETCH`                                        |
| RAG                   | `@vedmoulya/rag` workspace (application/domain/infrastructure/catalog)                 | Present; production path = `PostgresRagRepository`                                                                        |
| pgvector migration    | `packages/rag/src/infrastructure/migrations.ts` (`RAG_MIGRATION_001`)                  | Idempotent `CREATE ... IF NOT EXISTS`, vector column, PK (collection, chunk_id), indexes, rollback, `ensureRagReady` gate |
| RAG health/readiness  | `packages/rag/src/infrastructure/health.ts`                                            | `checkRagHealth` / `isRagReady` fail fast in production; never silent in-memory fallback in prod                          |
| EI-003 optimization   | `ContextOptimizer` (rank → filter → dedupe → compress → token estimate → budget)       | Active in the real runtime; per-item `ContextSelectionExplanation`                                                        |
| EI-002/EI-004 routing | `ProviderRoutingAdvisor`                                                               | Deterministic scoring; typed `ProviderSelectionExplanation`; `explainSelection`                                           |
| Prompt cache          | `PromptCacheManager`                                                                   | Identity-scoped keys; hit/miss telemetry                                                                                  |
| Evidence-First        | `EvidenceEvaluator`                                                                    | 4 states; `shouldAbstain` contract; conflicts detected deterministically                                                  |
| Structured output     | `StructuredOutputValidator`                                                            | Schema + semantic + business validation; bounded retry; safe failure                                                      |
| Tool boundary         | `ToolRuntime` (`ToolRegistry`, `ToolRateLimiter`, typed errors, safe tools)            | Full security chain; no shell/fs/network/db surface                                                                       |
| Observability         | `AIObservability` + NOOP/TEST/OTel/Langfuse exporters                                  | Redaction + configurable payload capture; exporter failure never breaks AI                                                |
| Production config     | `services/api/src/infrastructure/ProductionAIConfig.ts` (`validateProductionAIConfig`) | Fail-fast on missing mandatory AI/RAG/tool config in production                                                           |
| Gateway wiring        | `ApiApplicationService` (`registerPlatformProviders`)                                  | Real providers in production; `AI_ENABLE_MOCK` never silent in prod                                                       |
| UI                    | `AICompanion` + runtime-stage indicators                                               | Wired to real `ai.orchestrate`/`ai.stream`                                                                                |

### Verified test surface (as of baseline)

| Suite                       | File(s)                                                                                                           | Tests     |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------- |
| Tool runtime security chain | `runtime/__tests__/ToolRuntime.test.ts`                                                                           | 24        |
| Observability + redaction   | `runtime/__tests__/AIObservability.test.ts`                                                                       | 29        |
| Provider routing advisor    | `runtime/__tests__/ProviderRoutingAdvisor.test.ts`                                                                | 10        |
| Evidence evaluator          | `runtime/__tests__/EvidenceEvaluator.test.ts`                                                                     | 9         |
| Context optimizer           | `runtime/__tests__/ContextOptimizer.test.ts`                                                                      | 6         |
| RAG migrations/readiness    | `packages/rag/src/infrastructure/__tests__/` (health 11, migrations 10, Postgres repo 15, in-memory 7)            | 43        |
| AI runtime integration      | `packages/services/src/ai/__tests__/` (incl. FailureSafety, AISecurity, EndToEndPipeline, AIOrchestrationRuntime) | extensive |

Full suite at baseline: **6 601 tests / 511 files / 0 failures** (verified 2026-08-08).

---

## 3. Executable proof scripts — baseline measurements (run 2026-08-08)

### `npm run rag:eval` — deterministic RAG quality (C-09 baseline)

```
Retrieval precision          : 0.611  (mean over 6 labeled queries)
Retrieval recall             : 1.000  (mean over 6 labeled queries)
Irrelevant-context rejection : 0.878  (1.0 = no irrelevant docs leaked)
Authorization filtering      : 1.000  (1.0 = no cross-scope retrieval)
Evidence-sufficiency accuracy: 1.000  (6/6 expected decisions)
Grounded requests served     : 4/6
✅ RAG EVALUATION PASSED (baseline thresholds met).
```

Per-query baseline: `exact-match` P=1.00 R=1.00 · `semantic-match` P=1.00 R=1.00 ·
`irrelevant-only` served · `unknown-topic` abstain · `conflicting-retention` abstain (CONFLICTING) ·
`stale-doc-preference` P=0.40 R=1.00 (leaks conflict-a/b + stale-1).

**Calibration target (Phase 2):** precision 0.611 → higher, while preserving recall 1.000,
rejection ≥ 0.878, authz 1.000, sufficiency 1.000.

### `npm run ai:benchmark` — token/cost optimization (C-10 baseline)

```
retention-policy    original=146 compressed=80 saved=45.2%  noise removed 4/4
client-onboarding   original=117 compressed=62 saved=47.0%  noise removed 4/4
provider-selection  original=117 compressed=79 saved=32.5%  noise removed 3/3
Mean context saved  : 41.6%
Required evidence kept : 6/6 cases
✅ TOKEN BENCHMARK PASSED — optimization reduces tokens without dropping required evidence.
```

### `npm run ai:smoke` — deterministic runtime smoke

```
✅ AI SMOKE TEST PASSED — 26 checks, 0 failures (hermetic, no secrets).
```

Covers: ingest → chunk → embed → persist → retrieve → rank → optimize → evidence →
grounded serve / abstention / retrieval-failure abstention / cache isolation / streaming
stages / observability spans.

### `npm run ai:smoke:live` — live provider smoke (operator-run)

Requires `OPENAI_API_KEY`; exits non-zero with explicit message when absent. **Not run on this
machine (no credentials).**

---

## 4. Phase 1 — Live RAG/Postgres environment audit

**Findings:**

| Item                                    | Finding                                                                                                                                                                                                                                                   |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docker Engine                           | Installed (client 29.6.2) but **daemon cannot start**: "Docker Desktop is unable to start"                                                                                                                                                                |
| Root cause                              | **WSL has no installed distributions** (`wsl -l -v` → "Windows Subsystem for Linux has no installed distributions"). Docker Desktop requires a WSL2 distro for its Linux engine; installing one requires admin rights + Microsoft Store / `wsl --install` |
| Native Postgres                         | Not installed (`C:\Program Files\PostgreSQL` absent; no `psql`)                                                                                                                                                                                           |
| `docker-compose.yml` `postgres` service | `pgvector/pgvector:pg16`, port 5432, healthcheck — correct and ready for operators                                                                                                                                                                        |
| Migration                               | `RAG_MIGRATION_001` verified statically (extension, table, PK, indexes, rollback, readiness gate) — 10 migration tests + 15 Postgres repository tests pass                                                                                                |
| Production RAG config                   | `validateProductionAIConfig` fail-fast verified; `.env.production.example` documents `DATABASE_URL`, `RAG_*` vars                                                                                                                                         |

**Honest status:** the live Postgres + pgvector validation **could not be executed on this
machine** because the container runtime is unavailable (machine-level constraint, not a
repository defect). Per the sprint rule — _never claim LIVE validation if it was not actually
executed_ — the completion report will mark this `IMPLEMENTATION VERIFIED` /
`LIVE EXTERNAL ENVIRONMENT NOT VERIFIED (infrastructure unavailable)`, and provide an
operator-run live verification script (`npm run rag:pg:verify`) plus the exact command set.

---

## 5. Calibration plan (Phases 2–5)

| Phase | Deliverable                    | Method                                                                                                   | Evidence                                 |
| ----- | ------------------------------ | -------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 2     | RAG calibration                | Extended labeled dataset (ambiguous, multi-doc, prompt-injection, tenant-isolated) + minScore/topK sweep | `AI_RUNTIME_003_RAG_CALIBRATION.md`      |
| 3     | Input-optimization calibration | Per-case tokens/evidence/cost/latency; verify quality preservation                                       | benchmark output + doc                   |
| 4     | Provider routing calibration   | Multi-candidate matrix per task type; verify explainable, deterministic, no universal winner             | `AI_RUNTIME_003_PROVIDER_CALIBRATION.md` |
| 5     | Accuracy/evidence evaluation   | Unsupported-claim + abstention + conflict tests; measurable resistance                                   | `AI_RUNTIME_003_ACCURACY_EVALUATION.md`  |

---

## 6. Phase 0 conclusion

The frozen AI-RUNTIME-002 architecture is intact and executable. All deterministic baselines
reproduce on 2026-08-08. The single environment limitation is the unavailable local container
runtime for live Postgres validation — documented, not hidden, and addressed with an
operator-runnable live path in Phase 1.
