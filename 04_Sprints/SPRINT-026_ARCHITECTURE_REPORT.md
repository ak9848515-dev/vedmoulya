# SPRINT-026 — Architecture Report

> **Sprint:** SPRINT-026 — Voice Intelligence + Complete-System Architecture Audit
> **Scope:** Phase 2 (AI Provider Orchestration audit) + Phase 14 (Architectural Decision)
> **Date:** 2026-08-13
> **Verdict:** 🟢 **Provider orchestration is sound and calibrated. The correct next layer is an interaction shell (voice + proactive), not another engine.**

---

## 1. AI Provider Orchestration Audit (Phase 2)

### 1.1 What exists (verified)

| Concern              | Implementation                                                                                                                                                                                                                                  | Evidence                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Provider registry    | `packages/providers` — catalog (`provider-catalog.ts`, `benchmark-catalog.ts`), `ProviderApplicationService`, preferences, request-context                                                                                                      | 143+ tests claimed, green                                              |
| Provider adapters    | `services/orchestrator/src/providers/` — `VercelAIProvider` (OpenAI via Vercel AI SDK `generateText`/`streamText`/`Output.object`/`embedMany`), `DeepSeekProvider` (createOpenAI → api.deepseek.com), `MockProvider`, `OpenAIEmbeddingProvider` | files read; capabilities arrays verified                               |
| Capability discovery | `ProviderAdapter.capabilities` (frozen `CapabilityType` vocabulary incl. `speech`)                                                                                                                                                              | `packages/ai/src/types/index.ts`                                       |
| Model selection      | `ProviderRoleAssigner` (Brain) + `ProviderRoutingAdvisor` + `QualityFirstSelector`                                                                                                                                                              | `brain/src/domain/ProviderRoleAssigner.ts`, AI-RUNTIME-003 calibration |
| Quality scoring      | `quality` field on candidates; evidence-backed                                                                                                                                                                                                  | `capability-marketplace` `ProviderCandidateFact`                       |
| Cost scoring         | `costTier` (free/local/paid) + evidence-gated `estimatedCostUsd` (never fabricated)                                                                                                                                                             | `brain/src/domain/UsageIntelligence.ts`                                |
| Latency              | measured in `ai:benchmark`; latency-first weight corrected (AI-RUNTIME-003) so an 18× slower provider can no longer win                                                                                                                         | completion report + calibration script                                 |
| Reliability          | `ExecutionFailover` (bounded, never re-picks failed provider) + failure classification (`QUOTA_EXHAUSTED`/`PROVIDER_UNAVAILABLE`/`MODEL_DEGRADED`/`SUBSCRIPTION_UNAVAILABLE`/`UNKNOWN_FAILURE`)                                                 | `brain/src/domain/ExecutionFailover.ts`, `UsageIntelligence.ts`        |
| Structured output    | Vercel AI SDK `Output.object` + `jsonSchema` behind `ProviderAdapter`                                                                                                                                                                           | `VercelAIProvider.ts`                                                  |
| Streaming            | `streamText` exposed through `ai.stream` gateway procedure; AICompanion consumes it                                                                                                                                                             | `AIRouter.ts`, `AICompanion.tsx`                                       |
| Context limits       | `AI_MAX_INPUT_TOKENS` pre-provider guard + EI-003 input optimization (rank→filter→dedupe→compress→estimate→budget)                                                                                                                              | `.env.production.example`, AI-RUNTIME-002                              |
| Prompt caching       | stable-prefix cache, tenant/user-safe keys                                                                                                                                                                                                      | AI-RUNTIME-002 report                                                  |
| Provider health      | `isHealthy()` = configured (no network probe); runtime registry `CONFIGURED/AVAILABLE/NOT_CONFIGURED/UNSUPPORTED_RUNTIME/MOCK/DISABLED/ERROR` is the single source of truth                                                                     | `core/src/startup/provider-runtime.ts`, EPIC-019                       |
| API key handling     | env-injected, never logged/printed; placeholder rejected by `PLACEHOLDER_PATTERN`                                                                                                                                                               | `core/src/config/index.ts:269`                                         |
| Local models         | `localModelCandidates` port + LOCAL_FAMILIES set; catalog-only for Ollama/LM Studio (no runtime adapter)                                                                                                                                        | `ProviderRoleAssigner.LOCAL_FAMILIES`                                  |
| Tools                | `ToolRuntime` (typed registry, authz, validation, audit) + `AI_TOOL_ALLOWLIST` (empty = disabled by default)                                                                                                                                    | app-factory usage + `.env.production.example`                          |
| Observability        | `AIObservability` seams (NOOP/TEST/OTel/Langfuse) + redaction; provider-selection/cache/optimization telemetry                                                                                                                                  | AI-RUNTIME-002                                                         |

### 1.2 Decision hierarchy (verified)

**QUALITY → EVIDENCE → USABILITY → AVAILABILITY → COST** is implemented in both:

1. `QualityFirstSelector` (`capability-marketplace/src/domain/QualityFirstSelector.ts`) — "cheapest never wins"; free/local only wins when quality-sufficient.
2. `ProviderRoleAssigner.selectBest` — quality-desc sort, availability tiebreak, user pick respected, advisory experience tie-break (SPRINT-025) that **cannot** override security/approval/budget/quality.

**Verified invariant (test-backed):** FREE ≠ BEST, LOCAL ≠ BEST, PAID ≠ BEST — the benchmark suites assert quality-first across 7+ task-type scenarios and the 45-check provider calibration.

### 1.3 Capability-aware / latency-aware / cost-aware / user-preference-aware routing

- **Capability-aware:** per-capability candidate lists + role assignment (`CAPABILITY_DEFAULT_ROLE` map).
- **Latency-aware:** advisory weight in `ProviderRoutingAdvisor` (calibrated).
- **Cost-aware:** `BrainModeSelector` COST_SENSITIVE + `preferenceHints.costSensitive/localFirst`.
- **User-preference-aware:** user-selected provider/model respected; explicit > inferred.
- **Learning-informed:** `experienceScores` advisory only (ties + reason string).

**Verdict:** all five routing signals exist and are correctly ordered; learning is provably advisory. **No change needed.**

### 1.4 Gaps (documented, not fixed this sprint)

| ID  | Gap                                                                                                                                                                          | Why it is not P0                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| P-1 | Provider health is config-based, not probe-based (`isHealthy` returns true when key length > 0). Live quota facts only arrive when adapters supply them (otherwise UNKNOWN). | Honest by design (never fabricated availability); live probes = operator step. |
| P-2 | Speech capability has no runtime adapter (only Mock).                                                                                                                        | This IS the voice sprint's core work (see VOICE doc).                          |
| P-3 | No provider-level rate-limit awareness inside selection (a provider currently 429-heavy could still be picked first; failover handles it after the fact).                    | Bounded blast radius via failover; improvement is a follow-up (V3 roadmap).    |

---

## 2. Architectural Decision (Phase 14)

### 2.1 What is VedMoulya's actual core product?

**A personal Execution Operating System**: it takes a real human problem and runs it
through a governed pipeline — **UNDERSTAND → PLAN → INTELLIGENCE → APPROVE → EXECUTE →
VERIFY → LEARN** — with the Brain as the coordinator and provider orchestration as the
utility layer. The differentiator is not the models; it is the **governed,
evidence-first, owner-scoped execution loop** (approval, budget, honest verdicts,
durable memory, learning that cannot fabricate).

### 2.2 What should be the central intelligence layer?

**`@vedmoulya/brain` (BrainApplicationService) — as-is.** It is the single place where
a task is understood, planned, approved, executed, verified, evaluated and learned
from. Voice, proactive assistance and automation must all **call into this pipeline**,
never around it.

### 2.3 What should NOT be built

1. **No second memory system** — `BrainOutcomeMemory`, `PreferenceLedger`, `MemoryIntelligence`, `context-fabric` exist. Voice transcripts are a new _interaction artifact_, not a new memory engine.
2. **No second scheduler** — `ai-world-scheduler` + cadence driver covers cadence. Voice "remind me every weekday" reuses it.
3. **No second notification engine** — the ecosystem store + bell drawer is the surface; voice reads it aloud.
4. **No second approval system** — `BrainPolicyEngine` + `ApprovalEngine` + `ApprovalRuntime` are the gate; voice _renders_ approval requests and captures confirmation.
5. **No second budget engine** — `BrainBudgetGuard`/`RunBudgetGuard` apply unchanged to voice-initiated tasks.
6. **No second provider orchestration** — voice routes through `ai.stream`/Brain selection.
7. **No new autonomous-agent engine** — proactive behavior composes Scheduler + Brain + Discovery + Notifications (see AUTOMATION_MAP).
8. **No STT/TTS provider SDK leakage into business engines** — speech stays behind new `SpeechToTextPort` / `TextToSpeechPort` adapter seams (frozen `ProviderAdapter`-style boundary).
9. **No voice-only execution shortcuts** — voice utterances must pass the same policy gates as typed tasks.

### 2.4 What engines are already sufficient?

Brain (all), providers, execution-bridge (StepVerifier/ArtifactVerifier), goals,
capability-marketplace (ApprovalEngine, QualityFirstSelector, AutomationBoundaryEngine),
ai-world-scheduler, ecosystem-intelligence notifications, WriteThroughDocumentStore,
core config/startup. **All reused, none rebuilt.**

### 2.5 What engines are duplicated?

| Duplication                                                                                                                                           | Verdict                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `services/notifications` vs ecosystem/dashboard notifications                                                                                         | **Dead legacy service** (never imported). Delete or explicitly archive.                                                                                                                                                                                                                                                                  |
| `enterprise-brain`, `memory-intelligence`, `knowledge-intelligence`, `learning-intelligence`, `os-intelligence` packages vs the newer `brain` package | These are the **frozen v1.0 EI engines**; `brain` is the post-v1 runtime that _consumes_ the estate through ports. Overlap exists in names, not in runtime responsibility — the SPRINT-022/023/024/025 work repeatedly verified "zero new engines" by composing these. Keep the distinction documented; do not merge (frozen contracts). |
| AICompanion chat vs /brain task UI                                                                                                                    | Different purposes (Q&A stream vs governed task pipeline). **Should** be unified behind the voice assistant as one conversation surface (see 2.6).                                                                                                                                                                                       |

### 2.6 What interfaces are missing?

1. **SpeechToTextPort / TextToSpeechPort** (new narrow adapter seams — the only genuinely new interfaces voice requires).
2. **Transcript + conversation context** — a _conversation store_ per user (interaction artifact; persisted via WriteThroughDocumentStore pattern, NOT a new memory engine).
3. **Intent-to-task mapping** — voice intent interpretation delegates to the existing `IntentInterpreter`/`ProblemUnderstandingService` (no new NLP engine; the LLM + existing deterministic interpreters suffice).
4. **Proactive surface** — "what needs my attention" = `brain.dailyPriorities` + `discoverIntelligence` composed into a digest (no new engine).
5. **Durable gateway audit + Redis-backed rate limits** (pre-production hardening, R-1/R-2).

### 2.7 The correct Voice architecture (summary — full in VOICE doc)

```
SPEECH → STT port → transcript+conversation context → intent (existing interpreters/LLM)
→ brain.createTask (existing pipeline: plan→select→approve→execute→verify→learn)
→ answer/plan/action → TTS port → SPEECH
Sensitive actions: voice NEVER authorizes — approval is rendered + confirmed on-screen
(or explicit PIN before confirmation) and recorded in the decision store.
```

### 2.8 The correct Automation & Proactive architecture (summary — full in AUTOMATION_MAP)

- **Automation:** capability-plan + `AutomationBoundaryEngine` A/B/C/D classification; scheduler cadence as trigger; Brain as executor; `StepVerifier` as verifier; existing notification surface for C/B items.
- **Proactive:** compose `dailyPriorities` + `discoverIntelligence` + scheduler + notifications into a daily/weekly digest. "Tell me if something important happens" = relevance-gated events (already the NotificationGate model). **No autonomous agent loop.**

### 2.9 What must remain operator-configured

Live provider keys + live provider execution, production Postgres provisioning (identity/RAG/19-store persistence), live GitHub App authorization, live discovery sources, staging environment, multi-replica deployment (cadence driver single-instance rule + Redis rate limits + durable audit), real SMTP.

### 2.10 Biggest risks

| Risk                                                                     | Mitigation                                                                                                                                             |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Technical: multi-instance deployment without Redis rate-limit/audit/lock | R-1/R-2 fixes before any multi-replica deployment (Roadmap Sprint 1)                                                                                   |
| Technical: voice latency (STT→brain→TTS chain)                           | Streaming ASR/TTS + provider selection already latency-aware; keep turn-based cascade first (industry 2026 norm)                                       |
| Product: voice is a feature, not a product                               | Voice only ships as an interaction layer over an already-coherent system — it cannot be the differentiator alone; differentiation is the governed loop |
| Product: proactive noise → trust erosion                                 | Relevance-gated notifications (existing gate), user-configurable cadence, "draft but don't send" defaults                                              |
| UX: misleading voice affordances                                         | Remove/disable the dead Mic until real STT lands; honest labels (Fix UX-1/UX-2 in Sprint 1)                                                            |

---

## 3. Architectural Verdicts

1. **Do not add a voice engine. Add voice as an interaction shell over the Brain.**
2. **Do not add a proactive agent. Compose the existing scheduler/brain/notifications.**
3. **Do not rebuild provider selection. It is calibrated and quality-first.**
4. **Before GA: fix R-1 (rate limit), R-2 (audit), DB-3 (in-memory inventory), S-1 (dead service), UX-1/UX-2 (dead/misleading controls).**
