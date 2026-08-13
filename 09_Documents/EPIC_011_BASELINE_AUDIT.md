# EPIC-011 — Production Validation & Autonomous Quality: Baseline Audit

> **Status:** BASELINE — FROZEN
> **Date:** 2026-08-09
> **Upstream:** EPIC-006 (GREEN) · EPIC-007 (GREEN) · EPIC-008 (GREEN) · EPIC-009 (GREEN) · EPIC-010 (GREEN)
> **Method:** every status below was verified from source + executable evidence during this sprint — previous completion reports were NOT trusted blindly.

## 1. Purpose

EPIC-011 turns EPIC-010's _implementation-verified_ experience intelligence into
_production-evidenced_ functionality — with the two explicit EPIC-010 conditions:
(1) AI-powered critique requires a live provider, and (2) visual validation is
implementation-verified but not pixel/browser-verified. Nothing is rebuilt: the
frozen layers are reused, measured, and verified. Where live verification is
impossible on this machine (no Postgres/Docker; provider account without billing
credits), the honest status is reported with exact operator steps — never fabricated.

## 2. Status Matrix (verified from source)

| Layer                                           | Source location                                              | IMPLEMENTED | TESTED       | BROWSER VERIFIED            | LIVE VERIFIED                  | OPERATOR REQUIRED                           | DEFERRED                                       |
| ----------------------------------------------- | ------------------------------------------------------------ | ----------- | ------------ | --------------------------- | ------------------------------ | ------------------------------------------- | ---------------------------------------------- |
| AI Runtime (Vercel AI SDK v7)                   | `services/orchestrator/src/providers/VercelAIProvider.ts`    | ✅          | ✅ 13 tests  | —                           | ⚠️ auth reached, quota-blocked | ✅ credits + `npm run ai:production:verify` | —                                              |
| Provider routing                                | `packages/services/src/ai/` (ProviderRoutingAdvisor)         | ✅          | ✅           | —                           | ⚠️                             | ✅                                          | —                                              |
| RAG + pgvector                                  | `packages/services/src/ai/` + `services/api` gateway         | ✅          | ✅ hermetic  | —                           | ❌ no DB                       | ✅ `npm run rag:pg:verify`                  | —                                              |
| EvidenceEvaluator                               | `packages/services/src/ai/`                                  | ✅          | ✅           | —                           | ⚠️                             | ✅                                          | —                                              |
| TokenOptimization                               | `ContextOptimizer` / `PromptCacheManager`                    | ✅          | ✅           | —                           | ⚠️                             | ✅                                          | —                                              |
| LoopEngine                                      | `packages/loop-engine`                                       | ✅          | ✅ 106+      | ✅ via factory build        | —                              | —                                           | —                                              |
| Application Factory                             | `packages/app-factory`                                       | ✅          | ✅ 108+      | ✅ e2e                      | —                              | —                                           | —                                              |
| Requirements Intelligence                       | `packages/requirements`                                      | ✅          | ✅ 130       | ✅ `/applications`          | —                              | —                                           | —                                              |
| Experience Intelligence (critic/quality/design) | `packages/experience`                                        | ✅          | ✅ 50        | ✅ QUALITY tab e2e          | ⚠️ AI-critique seam            | ✅ credits                                  | —                                              |
| Application Workspace                           | `apps/web/src/app/applications/`                             | ✅          | ✅           | ✅ 3 journeys + visual spec | —                              | —                                           | —                                              |
| Visual validation (pixel)                       | `apps/web/e2e/visual-validation.spec.ts`                     | ✅ NEW      | ✅           | ✅ 3 viewports + baselines  | —                              | —                                           | —                                              |
| AI critique (live)                              | `packages/experience` seam + `scripts/ai-critique-verify.ts` | ✅ NEW      | ✅           | —                           | ⚠️ quota-blocked               | ✅ credits                                  | —                                              |
| Observability                                   | `packages/services/src/ai/runtime/AIObservability.ts`        | ✅          | ✅ 29        | —                           | ✅ in-run metrics              | —                                           | OTel/Langfuse exporters deferred (seams exist) |
| Production benchmark                            | `scripts/production-benchmark.ts`                            | ✅ NEW      | ✅ 8 apps    | —                           | —                              | —                                           | —                                              |
| Quality gates                                   | `packages/experience` + `packages/loop-engine` LoopBudget    | ✅          | ✅ 16 checks | —                           | —                              | —                                           | —                                              |

## 3. Machine Constraints (measured 2026-08-09)

- **OpenAI key:** real (`sk-proj-…`, 164 chars) — provider authentication + model
  negotiation REACHED the live API; the account has **zero billing credits**
  (`insufficient_quota`), so every live call is honest-reported as
  LIVE VALIDATION BLOCKED (operator step), never as a pass.
- **Postgres / pgvector:** unavailable — no Docker engine (WSL has no distros),
  no local PostgreSQL listener on :5432, `DATABASE_URL` unset. The Postgres RAG
  path is implemented + contract-tested via the in-memory double; live ingestion
  is an operator step (`npm run rag:pg:verify`).
- **Dev server:** `next dev` on :3000 with the deterministic MockProvider
  (NODE_ENV !== production) and the in-memory application registry — the
  documented dev convention. Production wiring is unchanged (Postgres +
  production providers).

## 4. Production Defect Found & Fixed During This Audit

The live `ai:production:verify` run exposed a REAL production defect that the
hermetic suites could not: the Vercel AI SDK v7 (`ai@7`, OpenAI v4 provider)
**rejects `system`-role messages**; the adapter now extracts system prompts into
the top-level `instructions` option at all three call sites in
`VercelAIProvider.ts` (text, structured, streaming). Regression tests added.
Before the fix: `System messages not allowed`; after the fix: the call reached
OpenAI's API correctly (quota-blocked at the account, not at the adapter).

## 5. Reuse Audit (no duplication)

- New verify/benchmark scripts import ONLY frozen engines: `@vedmoulya/services`,
  `@vedmoulya/orchestrator`, `@vedmoulya/loop-engine`, `@vedmoulya/experience`,
  `@vedmoulya/requirements`. No provider SDKs, no second RAG/optimizer/router.
- The visual spec reuses the EPIC-008 journey helpers (`helpers/factory-journey.ts`,
  extracted, not duplicated) and the REAL persisted preview (`srcDoc` from
  `factory.preview` — no stubbing).
- No telemetry system was introduced; `AIMetrics` (live in-run counters) and
  `AIObservability` (NOOP default, OTel/Langfuse exporter seams) are reused as-is.

## 6. What This Sprint Added (all under EPIC-011)

1. `scripts/ai-production-verify.ts` + `npm run ai:production:verify` — Phase 1.
2. `scripts/ai-critique-verify.ts` + `npm run ai:critique:verify` — Phase 3.
3. `scripts/production-benchmark.ts` + `npm run production:benchmark` — Phases 4/10/14.
4. `scripts/quality-gates-verify.ts` + `npm run quality:gates:verify` — Phases 7/8.
5. `apps/web/e2e/visual-validation.spec.ts` + committed screenshot baselines — Phases 5/6.
6. `apps/web/e2e/helpers/factory-journey.ts` — shared journey helpers (DRY refactor).
7. VercelAIProvider `instructions` fix + regression tests (production defect).
8. EPIC-011 documentation set + synchronization (Phases 2/9/15).

## 7. Honest Status of the Two EPIC-010 Conditions

| Condition                                    | Status                                                               | Evidence                                                                                                       |
| -------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| AI-powered critique requires a live provider | **IMPLEMENTED, LIVE VALIDATION BLOCKED (quota)**                     | seam + deterministic merge tested; live path reached the real API and was honest-reported blocked              |
| Visual validation pixel/browser-verified     | **BROWSER VERIFIED (real Chrome, 3 viewports, committed baselines)** | `visual-validation.spec.ts` passes with regression comparison against `abap-{desktop,tablet,mobile}` baselines |

See `EPIC_011_COMPLETION_REPORT.md` for the full verdict and operator steps.
