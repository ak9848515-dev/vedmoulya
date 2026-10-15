# VedMoulya — Sprint 025: Orchestration and Provider Reliability

**Date (UTC):** 2026-10-14
**Branch:** `main` · **HEAD:** `a124274b0d1fa91f361e0a5775e144658405913a` (unchanged)
**Mode:** evidence-first verification of the existing AI orchestration path over the
current working tree + hermetic tests + local integration; **no paid generation, no
credentials, no live-provider calls**.
**No commit, push, deploy, credential change, production-data change, or stash change occurred.**

**Scope note:** the sprint brief supplied to this run ends mid-section 4
("Live-provider policy"). Sections 1–4 were executed fully; the deliverable follows
the established convention of the previous audits
(`docs/audits/2026-10-14-quality-sprint-023/FINAL-REPORT.md`,
`docs/audits/2026-10-14-quality-sprint-024/FINAL-REPORT.md`): this report plus the
smallest safe source/doc correction, with every claim traceable to source or a
named passing suite.

**Evidence read:** Sprint 023 and Sprint 024 final reports; the canonical Mission
architecture (`docs/architecture/CANONICAL-MISSION-ARCHITECTURE.md`); the routing
composition (`packages/mission-runtime/src/adapters/OrchestratorRoutingPorts.ts`,
`services/api/src/infrastructure/RuntimePorts.ts`,
`packages/mission-runtime/src/composition/MissionRuntime.ts`); the orchestration
service (`packages/services/src/ai/AIOrchestrationService.ts`); the AI domain rules
(`packages/ai/src/domain/rules/AIRules.ts`); the usage ledger
(`services/api/src/observability/AiUsageRecorder.ts`,
`AiUsageLedgerTypes.ts`); and the provider usage/quota ingestor
(`services/api/src/services/ProviderUsageIngestor.ts`).

---

## Executive verdict: **PARTIAL**

**Provider reliability is VERIFIED** across every behaviour section 3 lists —
unavailable, timeout, rate limit, authentication failure, malformed response and
provider error; bounded retry/fallback; no duplicate consequential action; truthful
status when no provider ran; verification failure never presented as generation
success; usage-event attribution, one-event-per-real-call idempotency and
UNKNOWN cost preserved; health/account-usage UNKNOWN never fabricated; and human
approval still gating external/consequential work.

**G1 is resolved by evidence** (section 1). It is a **composition gap**, not an
intentional or permanent separation: the deterministic Mission ports are the
_documented fallback_ for a self-created orchestrator, while the enterprise ports
are the _documented production_ path via an injected orchestrator — and production
never injects one. The one **defect proven by the evidence and fixable within
existing contracts** was a false claim in the canonical architecture document, which
asserted a VERIFIED enterprise-routing edge on the Mission spine; that is corrected
(section 4). Threading the enterprise intelligence into Mission execution is a
provider-selection **behaviour switch** with real eligibility/cost consequences, so
per the brief it is recorded as an owner decision with its behavioural implications
enumerated — not switched silently.

---

## 0. Baseline and preservation

| Item                                  | Value                                                                                                                             |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Branch / HEAD                         | `main` / `a124274b0d1fa91f361e0a5775e144658405913a`                                                                               |
| `git status --porcelain` count        | **96** before → **97** after (the only addition is this report directory)                                                         |
| Stashes                               | **5** preserved (`pre-security-baseline-healthprobe`, 3× `lint-staged automatic backup`, `WIP on main: release-candidate-v1.0.0`) |
| Pre-existing modified/untracked files | untouched                                                                                                                         |

**Final:** 97 paths after this report — the **only** addition is
`docs/audits/2026-10-14-quality-sprint-025/`. HEAD unchanged; 5 stashes; no
`reset`/`clean`/revert/stage/commit/push/deploy; no credential, env-config,
production-DB, paid-provider, or stash operation. **No tracked file was changed.**

**Note on the edited documentation file.** The only other file this sprint edited,
`docs/architecture/CANONICAL-MISSION-ARCHITECTURE.md`, lives inside the
**pre-existing untracked** directory `docs/architecture/` (`git status --porcelain`
reports it as a single `?? docs/architecture/` entry before and after, so the
porcelain count is unaffected by the edit). Proof:

```
$ git status --porcelain docs/architecture/
?? docs/architecture/
$ git ls-files docs/architecture/
            (empty — the directory is not tracked at this HEAD)
```

`git diff --name-only` lists only the **pre-existing** baseline modifications recorded
at the start of this conversation (no path this sprint touched appears there); no
tracked file was modified, staged, reverted or cleaned by this sprint. The Sprint 024
report directory remains the other pre-existing addition. `HEAD` is unchanged and all
five stashes are intact.

---

## 1. G1 — determination, call graph, behavioural implications (sprint §2)

### 1.1 The three candidate determinations, tested against source

| Candidate                                                                         | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                               | Verdict                                                           |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| (a) The routing path is _intentionally_ separate → correct the document           | `OrchestratorRoutingPorts.ts:1-30` states the neutral ports exist because the standalone runtime / hermetic tests must be able to route, and that "production keeps using the host application's fully-wired orchestrator (injected via `MissionRuntimeOptions.orchestrator`) — nothing here is overridden when an orchestrator is injected". `MissionRuntime.ts:277-287` repeats it. The _intent_ is therefore a fallback, not a permanent separation | **REJECTED as the whole story** (true only for the fallback role) |
| (b) The enterprise routing capability is genuinely missing from Mission execution | Verified below: measured evidence, live execution health, unavailable-model exclusion, enterprise strategy and RAG never reach `ProviderRoutingAdvisor.decide()` on the Mission spine                                                                                                                                                                                                                                                                  | **CONFIRMED (observed consequence)**                              |
| (c) An existing integration is present but incorrectly composed                   | The seam (`MissionRuntimeOptions.orchestrator`, declared and documented at `MissionRuntime.ts:125`; reachable through `MissionServiceOptions.runtimeOptions` — `Omit<MissionRuntimeOptions,'workspaceRoot'>`, `MissionService.ts:242`) exists, and the two port _contracts_ are identical (`ProviderIntelligencePort`, `ExecutionStrategyPort`). The API composition simply never uses it                                                              | **CONFIRMED (root cause)**                                        |

**Determination: case (c), with (b) as its observed consequence.** The integration is
present but not composed, so enterprise routing intelligence is genuinely absent from
Mission execution. It is **not** an intentional, permanent separation.

### 1.2 Verified call graph

```
MissionRouter (mission.createAndRun)
  → MissionService.createRuntime()                       services/api/src/services/MissionService.ts:454
      createMissionRuntime({ workspaceRoot, stores, orchestratorOptions,
                             registerProviders, registerUserProviders,
                             ...this.options.runtimeOptions })
  → buildMissionRuntimeComponents()                      packages/mission-runtime/src/composition/MissionRuntime.ts:277
      orchestrator = options.orchestrator ?? new AIOrchestrationService(...)
      options.registerProviders?.(orchestrator)          // platform adapters
      if (!options.orchestrator) {
        orchestrator.configureIntelligence(
          createOrchestratorRoutingPorts(orchestrator))  MissionRuntime.ts:285   ← deterministic ports
      }
      // per-user orchestrators (PROVIDER-01) ALWAYS get the deterministic ports
      userOrchestrator.configureIntelligence(
        createOrchestratorRoutingPorts(userOrchestrator)) MissionRuntime.ts:312
  → AgentExecutionAdapter → AIOrchestrationAgentPort.execute()
  → AIOrchestrationService.orchestrate()
  → ProviderRoutingAdvisor.decide()                       (the frozen, shared advisor)

Contrast — the Ask/gateway path:
  ApiApplicationService  this.ai.configureIntelligence(aiIntelligence)
      createProviderIntelligencePort(providers, intelligenceStore, evidence, runtimeHealth)
      + createExecutionStrategyPort(strategies)                                   services/api/src/infrastructure/RuntimePorts.ts
      + createRagRetrievalPort(rag)
  ApiApplicationService:  new MissionService({ workspaceRoot, sql,
      requireDurablePersistence, credentials, aiObservability })   (:2904-2916)
      ⇒ NO runtimeOptions, NO orchestrator, NO enterprise ports
```

`grep -n runtimeOptions services/api/src/services/ApiApplicationService.ts` returns
**no matches** — the production composition never exercises the injection seam.

**What the deterministic ports actually provide**
(`OrchestratorRoutingPorts.ts`): candidates are the orchestrator's own registered
adapters queried live; models come from the seeded provider catalog (or the
adapter's own single-model fallback / `configuredModel`); health is the adapters'
real `getAllProviderHealth()`; scoring metadata is deliberately **NEUTRAL**
(`NEUTRAL_BENCHMARK_SCORE = 50`, `NEUTRAL_COST_PER_1K = 0`); strategy is
`balanced`. No measured evidence, no `ExecutionHealthService` verdicts, no
unavailable/deprecated model exclusions, no RAG.

### 1.3 Behavioural implications

**Current state (verified):** Mission provider selection ignores measured
reliability/latency/token evidence (`RoutingEvidenceSource.bestEvidence`), live
execution-health verdicts (`RuntimeHealthSource`), `unavailableModelIds` exclusions,
the enterprise execution strategy and RAG retrieval. It still passes through the
**same** frozen advisor, the same retry/fallback rules, the same mock-safety gate and
the same evidence gates — **no bypass, no second router, no fabricated success**, and
no divergence in _authority_ (only in _input data_).

**Of composing it (why this is an owner decision, not a drive-by change):**

1. Newly honouring live health verdicts can **EXCLUDE a provider missions use today**
   (`RuntimePorts` folds an `UNAVAILABLE` verdict into the `healthy` gate) — a mission
   that works now could become `WAITING_FOR_PROVIDER`. That is a user-visible
   behaviour regression surface, not a strict improvement.
2. `measured` evidence can **reorder** candidates → different provider, cost and
   quality for identical missions.
3. The enterprise candidate list comes from the provider **registry**
   (`ProviderApplicationService`), while Mission adapters come from
   `registerPlatformProviders`; the two sets can diverge, so the advisor's
   `selected` provider may not be an executable candidate.
4. Only the **shared** orchestrator would be fixed by injecting one; the per-user
   orchestrators are wired at `MissionRuntime.ts:312` unconditionally, so a contract
   addition (a user-orchestrator intelligence hook) is required for consistency —
   otherwise one deployment would run two different routing authorities.

**Closure requirement / owner:** Platform / AI-runtime. Either (i) add the
user-orchestrator intelligence hook and inject the enterprise ports for both the
shared and per-user Mission orchestrators behind an explicit switch, or (ii) accept
the deterministic Mission routing as the intended product behaviour and keep the
canonical document as corrected in section 4. Recorded, **not silently switched**.

---

## 2. Provider reliability verification (sprint §3)

All verdicts below are source-backed **and** covered by the hermetic suites in
section 5. Nothing is claimed for behaviour with no test.

| #   | Required behaviour                                      | Verdict      | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | ------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Provider **unavailable**                                | **VERIFIED** | `classifyFailure` maps `api error: 5xx` / `fetch failed` / `network` / `econnrefused` / `enotfound` / `unavailable` → `provider_unavailable` (`AIOrchestrationService.ts:455-461`); `FailureSafety.test.ts` "provider 5xx → retries, then falls back"                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2   | **Timeout**                                             | **VERIFIED** | `timeout` classification (`:422`) is retryable (`retryLimitRule` allow-list `['timeout','rate_limited','provider_unavailable']`, `AIRules.ts:64`); `FailureSafety.test.ts` "provider timeout → classified, retried, then falls back"                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 3   | **Rate limit**                                          | **VERIFIED** | `429`/`rate limit` → `rate_limited`, counted via `metrics.recordRateLimit()`; `FailureSafety.test.ts` "provider 429 → retries then recovers on the same provider"; `provider-failover.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 4   | **Authentication failure**                              | **VERIFIED** | Explicit credential signals only (`401`, `unauthorized`, `invalid api key`, …, `:441-448`) → `authentication_error`, which is **not** in the retry allow-list ⇒ immediate fallback, and the broken key is never echoed; `AISecurity.test.ts:180-204` (401 + redaction, falls through to the good provider)                                                                                                                                                                                                                                                                                                                                                                 |
| 5   | **Malformed response**                                  | **VERIFIED** | `executeStructured` validates before any business engine sees the output; an invalid payload throws `Structured output validation failed` and is bounded-retried, never delivered unvalidated; `FailureSafety.test.ts` "malformed structured output → bounded retry → safe typed failure" (`calls ≤ 4`)                                                                                                                                                                                                                                                                                                                                                                    |
| 6   | **Provider error**                                      | **VERIFIED** | Unclassified failures → `internal_error` (non-retryable) ⇒ fallback; all-fail path raises a typed error naming the real providers; `FailureSafety.test.ts` "all providers failing → clear typed error, never a fabricated answer"                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 7   | **Retry/fallback bounds**                               | **VERIFIED** | Per-provider retry loop bounded by `MAX_RETRIES = 3` **and** `retryLimitRule` (`attempts < 3`) **and** `aiRequest.isRetryable()`; cross-provider fallback bounded by `fallbackRule(..., attempts < 5)` (`AIOrchestrationService.ts:1759,1835-1836,1874`; `AIRules.ts:63-93`)                                                                                                                                                                                                                                                                                                                                                                                               |
| 8   | **No duplicate consequential tool actions**             | **VERIFIED** | Verified objectives are never re-selected (`crash-recovery.test.ts` "duplicate execution prevention — verified objective is never selected again"; `restart-recovery.test.ts` "BLD-025 duplicate execution prevention across restarts" — `executions.toHaveLength(1)`); watchdog/healing passes are idempotent (`final-04-watchdog.test.ts` C/D, `final-05-abandoned-execution.test.ts` "is idempotent…", `bld-021a-requirements.test.ts` #22 "action and plan identity prevent repeat work"); a stream that already emitted content never re-emits it (`AskStreamProviderFallback.test.ts` "never duplicates an answer when content already streamed before the failure") |
| 9   | **Truthful status when no provider ran**                | **VERIFIED** | Mock-safety gate refuses a synthetic fallback once a real provider existed (`hasRealCandidate` ⇒ `honestProviderFailure`, `:1880-1895`); `MockLastResort.test.ts` Cases 3/3b/6-7 assert the mock never executes, the error is `ProviderExecutionFailed` and names the real failure; a `FAILED` span is refused by the ledger (`"refuses a FAILED span (never invents usage for a failed call)"`); abstention returns `provider: 'abstention'`, zero tokens, zero cost                                                                                                                                                                                                      |
| 10  | **Verification failure vs generation success**          | **VERIFIED** | `verifyAgainstPolicy` never maps UNKNOWN/PARTIAL to VERIFIED, and a denied command tool returns **BLOCKED** (never success); generation `passed: true` never substitutes for verification — `verification.test.ts`, `verification-robustness.test.ts`, `mission-runtime` e2e/gate suites (all in section 5 batches), Sprint 023 §3 row 12                                                                                                                                                                                                                                                                                                                                  |
| 11  | **Usage-event attribution**                             | **VERIFIED** | `AiUsageRecorder` writes one event on the canonical path; `aiSource`/`missionId`/`objectiveId` travel on the provider-execution span (`MockLastResort.test.ts` "records ai_source=MISSION…", "records the real missionId/objectiveId…", "`ASK`/`BRAIN`/`DAILY_AI` never receive Mission identity"); `AiUsageLedger.test.ts` "aggregates by provider, model and source", "honours an explicit ai_source attribute", "never exposes one owner usage to another"                                                                                                                                                                                                              |
| 12  | **Duplicate-event idempotency**                         | **VERIFIED** | `buildEventId` = `traceId:spanId`, else `executionId:provider:attempt-N:model` (`AiUsageLedgerTypes.ts:98-110`); streaming terminal usage replays are no-ops (`AiUsageLedger.test.ts` "counts a streaming run EXACTLY once (terminal usage replays are no-ops)", "records ONE event per real provider call when a fallback occurs", "records TWO events when two attempts REALLY happened")                                                                                                                                                                                                                                                                                |
| 13  | **Estimated-cost provenance**                           | **VERIFIED** | `costUnknown` is preserved end-to-end; absent pricing ⇒ `costUsd: 0` **with `costUnknown: true`**, never an invented number (`AiUsageLedgerTypes.ts:54-56`; `AiUsageLedger.test.ts` "keeps UNKNOWN cost unknown instead of inventing a number"); local inference is excluded from cloud totals but kept visible                                                                                                                                                                                                                                                                                                                                                            |
| 14  | **Provider health UNKNOWN when not reported**           | **VERIFIED** | Health records carry provenance (SEED vs MEASURED); an absent provenance is read as SEED, not measured; a SEED record shows **no** check time (`provider-health-provenance.test.ts`); `RuntimePorts` attaches `runtimeHealth` only for a verdict ≠ `UNKNOWN` (`AiControlCenter`/`provider-readiness.test.ts`, `ProviderHealthService.test.ts`)                                                                                                                                                                                                                                                                                                                             |
| 15  | **Account-usage / quota UNKNOWN when not reported**     | **VERIFIED** | `ProviderUsageIngestor` writes a quota percentage **only** when the provider itself reports a real bounded quota; a plain "checked" sample leaves `quotaUsedPercent` untouched so the UI never shows an invented remaining-percent (`ProviderUsageIngestor.ts:11-41,56-57,144-226`); `ProviderUsageIngestStatus.test.ts`, `ProviderUsageDetail.test.ts`, `quota-provenance.test.ts`, `UsageAvailabilityWidget.test.tsx`, `OpenAIOrgUsagePanel.test.tsx`                                                                                                                                                                                                                    |
| 16  | **Human approval for external / consequential actions** | **VERIFIED** | Approval must exist, be granted by the owner, be scoped to the same opportunity and be single-use; wrong scope / foreign granter / missing approval ⇒ no launch (`s11-approval-binding.test.ts`); mission budget ceiling enforced (`s10-budget-ceiling-regression.test.ts`); approval requests are structurally `executed:false` (Sprint 023 §3 row 16)                                                                                                                                                                                                                                                                                                                    |
| 17  | **Never treat model output alone as proof of success**  | **VERIFIED** | Verification is policy + real-artifact based; UNKNOWN is never success; abstention returns a typed non-answer with zero tokens/cost; all-fail returns a typed error rather than text                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

**No listed behaviour failed.** No test was weakened, skipped or suppressed, and no
assertion was relaxed to reach this table.

---

## 3. Live-provider policy (sprint §4)

Honoured strictly: **no paid generation, no provider credentials, no live cloud
calls, no spend.** All verification above is hermetic (deterministic adapters and
fixtures) or local-only. The suites that touch real HTTP do so against **loopback
fakes**, not cloud endpoints. Live cloud AI and billing remain **BLOCKED** on
operator-provided credits (unchanged from Sprint 024 §5) and are not claimed.

---

## 4. Confirmed defect and the smallest safe change

### 4.1 Defect (proven) — the canonical document asserted a false VERIFIED edge

`docs/architecture/CANONICAL-MISSION-ARCHITECTURE.md` is the single authoritative
reference for the Mission spine and classifies every edge as VERIFIED / PARTIAL /
DORMANT / MISSING. It asserted, in four places, that the Mission spine's routing runs
through `services/api/src/infrastructure/RuntimePorts.ts`:

- the diagram node `ADV` (line 49) named only `RuntimePorts.ts`;
- call-graph item 7 (lines 128-132) attributed EI-002/EI-004/RAG to the Mission path;
- the evidence table row "Routing advisor + EI-002 / EI-004 / RAG / health gates" was
  **VERIFIED (`RuntimePorts.ts`)**;
- the edge checklist bullet said
  `AIOrchestrationService → ProviderRoutingAdvisor + EI-002/EI-004/RAG ports: VERIFIED (RuntimePorts.ts)`.

Section 1.2 proves that is false for the Mission spine. A canonical document
misreporting a runtime edge as VERIFIED is a defect in its own declared framework.

### 4.2 Change made (documentation only, zero behavioural risk)

Edited **`docs/architecture/CANONICAL-MISSION-ARCHITECTURE.md`** (an untracked
documentation file; no source, config, schema or test file was touched):

1. The `ADV` node now names the frozen advisor as shared and lists **both** wirings —
   `packages/mission-runtime/src/adapters/OrchestratorRoutingPorts.ts` for the Mission
   spine and the enterprise `RuntimePorts.ts` ports for the Ask/gateway path.
2. Call-graph item 7 describes both port sets, states that a host _may_ inject a
   fully-wired orchestrator, and states that production does not yet inject one.
3. The evidence table splits the row into "Routing advisor (frozen) — VERIFIED" and
   "Enterprise EI-002 / EI-004 / RAG / health gates — **VERIFIED for Ask/gateway;
   PARTIAL for the Mission spine**".
4. The edge checklist bullet now reads "VERIFIED for the Ask/gateway path; PARTIAL
   for the Mission spine".
5. A new **§5.1 "Mission routing intelligence — current wiring (Sprint 025 G1)"**
   records the determination, the verified call graph with file:line references, the
   behavioural implications of the current state **and** of composing it, and the
   owner/closure requirement.

**Why this is the smallest safe change and not a code change:** the evidence proves a
_composition_ gap, but the only code correction reachable through existing contracts
(injecting an orchestrator) is precisely the "silently switch provider-selection
behaviour" the brief forbids — it can newly exclude providers missions use today
(health gating), reorders candidates by measured evidence, can disagree with the
registered adapter set, and cannot cover the per-user orchestrators without a new
contract. It is therefore recorded with its consequences for the owner, while the
provably false documentation claim is corrected. **No second routing authority was
introduced; no provider-selection behaviour changed.**

### 4.3 Regression tests

The corrected artifact is documentation, so there is no executable regression test to
add. The claim it now makes is verified by
`packages/mission-runtime/src/adapters/__tests__/orchestrator-routing-ports.test.ts`
(the deterministic ports are the ones wired for a self-created orchestrator) and
`packages/mission-runtime/src/__tests__/user-provider-credentials.test.ts`
(`createOrchestratorRoutingPorts` is configured at composition) — both green in
section 5 batch 1. **No source defect was fixed this sprint**, so no source regression
test was warranted; the sprint's fix policy ("fix only confirmed, in-scope defects")
was followed.

---

## 5. Validation results (exact commands)

Exit statuses were captured directly from the command that ran (no pipeline filter
between the command and `$?`).

| #   | Command                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Exit  | Result                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ---------------------------------------------------------- |
| 1   | `npx vitest run packages/services/src/ai packages/agent-execution/src packages/mission-controller/src/__tests__/provider-failover.test.ts packages/mission-controller/src/__tests__/security-boundaries.test.ts packages/mission-runtime/src/adapters/__tests__/orchestrator-routing-ports.test.ts packages/mission-runtime/src/__tests__/verification-robustness.test.ts packages/mission-runtime/src/__tests__/product-001-real-provider-loop.test.ts packages/mission-runtime/src/__tests__/user-provider-credentials.test.ts packages/planning/src/__tests__/ai-planner-port.test.ts --reporter=dot`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | **0** | **36 files · 435/435 passed**                              |
| 2   | `npx vitest run services/api/src/__tests__/AiUsageLedger.test.ts services/api/src/__tests__/AiUsageLedgerEndToEnd.test.ts services/api/src/__tests__/AiUsageDurability.test.ts services/api/src/__tests__/AiUsageTelemetry.test.ts services/api/src/__tests__/AiReadiness.test.ts services/api/src/__tests__/AiReadinessEvidence.test.ts services/api/src/__tests__/MultiAiReadinessAudit.test.ts services/api/src/__tests__/ProviderUsageIngestor.test.ts services/api/src/__tests__/ProviderUsageIngestStatus.test.ts services/api/src/__tests__/ProviderUsageDetail.test.ts services/api/src/__tests__/ProviderExperienceServiceOpenAIOrgUsage.test.ts packages/providers/src/catalog/__tests__/quota-provenance.test.ts packages/providers/src/domain/services/__tests__/ProviderHealthService.test.ts apps/web/src/app/providers/__tests__/provider-health-provenance.test.ts apps/web/src/app/providers/__tests__/provider-readiness.test.ts apps/web/src/app/providers/__tests__/UsageAvailabilityWidget.test.tsx apps/web/src/app/providers/__tests__/OpenAIOrgUsagePanel.test.tsx --reporter=dot` | **0** | **17 files · 219/219 passed**                              |
| 3   | `npx vitest run packages/mission-controller/src/__tests__/crash-recovery.test.ts packages/mission-controller/src/__tests__/restart-recovery.test.ts packages/mission-controller/src/__tests__/final-04-watchdog.test.ts packages/mission-controller/src/__tests__/final-05-abandoned-execution.test.ts packages/mission-controller/src/__tests__/bld-021a-requirements.test.ts packages/mission-controller/src/__tests__/s10-budget-ceiling-regression.test.ts packages/mission-runtime/src/__tests__/runtime-restart-recovery.test.ts services/api/src/__tests__/s11-approval-binding.test.ts --reporter=dot`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | **0** | **8 files · 98/98 passed**                                 |
| 4   | `npm run typecheck` (`tsc -b && tsc --noEmit -p services/api`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | **0** | green                                                      |
| 5   | `npm run deps:cycles`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | **0** | `OK no internal dependency cycles (57 workspaces scanned)` |

**Totals: 61 test files · 752 tests passed, 0 failed, 0 skipped.** Suites cover: the
whole `packages/services/src/ai` runtime (orchestration, failure safety, mock
last-resort, security, streaming fallback, structured output, budget, context
optimization), the whole `packages/agent-execution` package (verification + agent
port), mission controller failover/security-boundaries/crash/restart/watchdog/
abandoned-execution/idempotency/budget-ceiling, mission-runtime routing ports,
verification robustness, real-provider loop, per-user credentials, the planner port,
the AI usage ledger (attribution, idempotency, UNKNOWN cost, durability, telemetry),
provider usage/quota ingestion and provenance, provider health status, and the
provider UI provenance widgets.

---

## 6. Remaining risks, limitations, and closure requirements

1. **G1 — Mission routing intelligence (section 1).** Composition gap, recorded.
   Owner: Platform / AI-runtime. Closing it requires an explicit (non-silent)
   behaviour switch **plus** a contract for per-user orchestrators. Highest-value
   open item this sprint.
2. **Behaviour-regression surface if G1 is closed naively.** Live health verdicts can
   exclude providers missions use today; measured evidence can reorder selection. Any
   closure must ship behind an explicit switch with a rollback path and a mission-level
   regression suite.
3. **Live-provider validation not performed** (BLOCKED / operator-owned): no cloud
   credentials, no billing credits. All reliability evidence is hermetic and local —
   it proves the runtime's contract, not a specific vendor's live behaviour.
4. **Estimated (not measured) cost paths persist** where a provider reports no price;
   these remain explicitly `UNKNOWN`, never zero-as-fact (verified), but they cannot
   be reconciled against real invoices without live billing access.
5. **Report scope.** The supplied brief ends mid-section 4, so any sections after
   §4 (which were not received) are not addressed here.

**Confirmed non-issues:** no second router or registry was introduced; no provider SDK
call was added; no retry/fallback bound was changed; no assertion, test or lint rule
was weakened, skipped or suppressed; no secret was logged or committed.
