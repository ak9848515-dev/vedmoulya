# HEALTH-CONTRACT-AUDIT.md — G-05 / CQ-04 · Health-Status Vocabulary Consistency

**Date:** 2026-10-10 · **Type:** READ-ONLY audit (no source modified, nothing staged/committed/pushed)
**Author:** audit pass following G-01 (see `NEXT-FIX-PROMPT.md`)
**Scope source:** `GAP-REGISTER.md` **G-05**, `CODE-QUALITY-SECURITY-AUDIT.md` **CQ-04**

> **Reconciliation notice (added by G-05G, 2026-10-10).** The findings in §5 were recorded as _open_ at audit
> time. Between that pass and G-05G, the bounded fixes for **F-R1 (G-05A)**, **F-R2 (G-05E)**, **F-U1 (G-05D)**,
> and **G-01** were implemented in the working tree and covered by regression tests. §5's original wording is
> **retained verbatim as the historical record** of the defects that existed; the current disposition of each
> finding is stated in **§11 · Post-fix status reconciliation**. Read §5 and §11 together: §5 is what was found,
> §11 is what is now true. No severity was downgraded and no score was raised.

## 0. Scope confirmed + refinement

`GAP-REGISTER.md` **G-05** / `CODE-QUALITY-SECURITY-AUDIT.md` **CQ-04** nominate three competing
provider-status vocabularies:

- `packages/ai/src/types/index.ts:45` — `ProviderStatus = 'healthy' | 'degraded' | 'unstable' | 'down'`
- `packages/services/src/marketplace/MarketplaceDTO.ts:127` — `ProviderStatus = 'active' | 'inactive' | 'error' | 'configuring'`
- `packages/intelligence-fabric/src/types/fabric-types.ts:22` — `ProviderHealthState = 'UNKNOWN' | 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'MISCONFIGURED'`

This audit confirms the finding and **refines it**: the repository actually carries **nine distinct provider-status
vocabularies and seven infrastructure/service-health vocabularies**. The register's "three" is a lower bound.
The question asked is whether the inconsistency causes (a) compile errors, (b) incorrect routing,
(c) misleading UI status, or (d) incorrect operational decisions. Verdicts are given per finding in §5.

## 1. Method

Read-only inspection of every producer/consumer of a health or provider-status value reachable from the
named areas; traced each value across the boundary where one vocabulary is mapped into another. Baseline
compile evidence captured (§7). No file was edited, formatted, staged, committed or pushed.

## 2. Inventory — provider-status vocabularies (9)

| #    | Name                                                 | Location                                                                   | Values                                                                                                                 | Semantic axis                                             | Producer(s)                                                                                                                                                                          | Consumer(s)                                                                                                                                                                                                                                                  |
| ---- | ---------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PV-1 | `ProviderStatus` (canonical ai)                      | `packages/ai/src/types/index.ts:45` (used by `ProviderHealth.status` :151) | `healthy` `degraded` `unstable` `down`                                                                                 | runtime provider **health**                               | orchestrator adapters `getHealth()` (`OpenAICompatibleProvider`, `OpenAIProvider`, `OllamaProvider`, `DeepSeekProvider`, `GoogleGeminiProvider`, `MockProvider`, `VercelAIProvider`) | `AIMapper.toProviderHealthDTO`, `ProviderHealthDTO` (AIDTO:177), `ProviderHealthService` (@vedmoulya/providers), `ProviderExperienceService.deriveAvailability`, `ProviderReadinessModel`, `execution-strategy` seeds, API `AIRouter.get(All)ProviderHealth` |
| PV-2 | `ProviderHealthState`                                | `packages/intelligence-fabric/src/types/fabric-types.ts:22`                | `UNKNOWN` `HEALTHY` `DEGRADED` `UNAVAILABLE` `MISCONFIGURED`                                                           | **observed** runtime health (evidence-only)               | `ProviderHealthLedger.observe()`                                                                                                                                                     | `ProviderHealthLedger.health()`, `StrategyCandidate.healthState`                                                                                                                                                                                             |
| PV-3 | `ProviderHealthStatus.status`                        | `packages/orchestration-fabric/src/types/provider-router.ts:75`            | `healthy` `degraded` `unhealthy` `unknown`                                                                             | runtime health for the fabric router                      | `ProviderHealthBridge.recordObservation()` (`adapters/index.ts:40`)                                                                                                                  | `ProviderRouter.findCandidates/updateHealth`                                                                                                                                                                                                                 |
| PV-4 | `ProviderStatus` (marketplace)                       | `packages/services/src/marketplace/MarketplaceDTO.ts:127`                  | `active` `inactive` `error` `configuring`                                                                              | marketplace **install/lifecycle** status                  | `MarketplaceProviderService.registerProvider` / application service                                                                                                                  | `MarketplaceDTOMapper`, `MarketplaceViewModelFactory`, marketplace metrics                                                                                                                                                                                   |
| PV-5 | `ProviderStatus` + `ProviderConnectionState` (setup) | `services/api/src/services/ProviderSetupOrchestrator.ts:197`               | `DISCONNECTED` `CONNECTING` `CONNECTED` `ERROR`                                                                        | user-facing **connection** state (single source of truth) | `ProviderSetupOrchestrator.getStatus()`                                                                                                                                              | `ProvidersRouter.getSetupStatus`, `api-client.ProviderStatusDTO`, web surfaces                                                                                                                                                                               |
| PV-6 | `ProviderRuntimeState` (readiness)                   | `services/api/src/observability/ProviderReadinessModel.ts`                 | `DISABLED` `NOT_CONFIGURED` `FAILED` `AUTH_REQUIRED` `QUOTA_EXHAUSTED` `RATE_LIMITED` `UNAVAILABLE` `DEGRADED` `READY` | **readiness/executability** state machine                 | `deriveProviderReadiness()`                                                                                                                                                          | `AiControlCenter`, provider board rows                                                                                                                                                                                                                       |
| PV-7 | `ProviderRuntimeStatus` (deployment config)          | `packages/core/src/startup/provider-runtime.ts:29`                         | `CONFIGURED` `AVAILABLE` `NOT_CONFIGURED` `UNSUPPORTED_RUNTIME` `MOCK` `DISABLED` `ERROR`                              | **deployment credential/config** state                    | `readProviderRuntimeState()`                                                                                                                                                         | `config`, `doctor`, `preflight`, `ProvidersRouter`, web `provider-state.ts` / `gemini-onboarding.ts`                                                                                                                                                         |
| PV-8 | `ConnectionKey` / `ProviderStatusDisplay`            | `apps/web/src/app/providers/provider-ux.ts:209`                            | `connected` `issue` `not_connected`                                                                                    | **UI projection** (pure fold over PV-7 + lifecycle)       | `providerStatusDisplay()`                                                                                                                                                            | provider cards, chips                                                                                                                                                                                                                                        |
| PV-9 | `ProviderStatus` (mission)                           | `packages/mission-controller/src/types/mission-types.ts`                   | `{ available, capableProviders[], unhealthyProviders[] }`                                                              | objective-selection **provider availability** aggregate   | `OrchestratorProviderAvailability`, `provider-availability.ts`                                                                                                                       | objective selectors, failure classifier, `MissionFailureClassifierAdapter`                                                                                                                                                                                   |

## 3. Inventory — infrastructure / service-health vocabularies (7)

| #                 | Name                                                       | Location                                                                                    | Values                                                                              | Consumers                                                     |
| ----------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| HW-1              | `HealthStatus`                                             | `packages/core/src/health/index.ts:9`                                                       | `healthy` `degraded` `unhealthy`                                                    | `HealthChecker`, `bootstrap`                                  |
| HW-2              | `PlatformHealth.status` / `PlatformHealthComponent.status` | `services/api/src/routers/HealthRouter.ts`                                                  | `healthy` `degraded` `critical` / `healthy` `degraded` `unhealthy` `not_configured` | `health.check` tRPC, dashboards, `RouterRegistry`             |
| HW-3              | `AppHealthStatus`                                          | `services/api/src/observability/ApplicationHealthService.ts:20`                             | `HEALTHY` `DEGRADED` `BLOCKED` `FAILED` `UNKNOWN`                                   | `ApplicationHealthService`, `services/api/src/index.ts`       |
| HW-4              | module-health (×6 packages)                                | `packages/services/src/{dashboard,career,learning,business,lifeos,marketplace}/*DTO.ts`     | overall `healthy` `degraded` `critical`; services `healthy` `degraded` `down`       | module view models                                            |
| HW-5              | `RagHealthStatus`                                          | `packages/rag/src/infrastructure/health.ts:14`                                              | `healthy` `degraded` `unhealthy`                                                    | `checkRagHealth`, `isRagReady`                                |
| HW-6              | `OSEngineHealthStatus` / `OSSystemHealthStatus`            | `packages/os-intelligence/src/types/os-types.ts:47,237`                                     | `healthy` `degraded` `unhealthy` `unknown` / `healthy` `degraded` `unhealthy`       | `OSDiagnosticsService`, `OSHealthService`, OS dashboard views |
| HW-7              | `HealthStatus` (svc)                                       | `services/decision/.../DecisionTypes.ts:149`, `services/execution/.../ExecutionTypes.ts:39` | `healthy` `degraded` `unhealthy` (+ `checks: pass/fail/degraded`)                   | module health endpoints                                       |
| HW-8 (supporting) | `DependencyStatus`                                         | `services/api/src/services/InfrastructureHealthProbe.ts:15`                                 | `healthy` `degraded` `unhealthy` `not_configured`                                   | `HealthRouter` db/redis components — **matches HW-2 exactly** |

## 4. Cross-boundary mapping points (where vocabularies meet)

| Id  | Boundary              | Code                                                                              | Mapping                                                                                               |
| --- | --------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| M-1 | PV-1 → fabric PV-3    | `packages/orchestration-fabric/src/adapters/ProviderBridge.ts:103`                | `success: provider.status !== 'unhealthy'` (input typed `string`)                                     |
| M-2 | fabric PV-3 → routing | `packages/orchestration-fabric/src/domain/ProviderRouter.ts:190,214`              | `isAvailable = health.status !== 'unhealthy'`                                                         |
| M-3 | PV-1 → readiness PV-6 | `services/api/src/observability/ProviderReadinessModel.ts:268-272`                | `==='down' \|\| ==='unstable'` → UNAVAILABLE; `==='degraded'` → DEGRADED; else falls through to READY |
| M-4 | PV-1 → fleet counts   | `packages/providers/src/domain/services/ProviderHealthService.ts:66-69,99-106`    | `down`→down, `unstable`→unstable, `degraded`→degraded, **everything else → healthy**                  |
| M-5 | PV-1 → advisory rank  | `packages/execution-strategy/src/domain/services/ProviderCandidateService.ts:215` | `availability === 'healthy' ? 1 : 0.5`                                                                |
| M-6 | HW-8 → HW-2 → overall | `services/api/src/routers/HealthRouter.ts:217-219`                                | `unhealthy`→critical escalation; `not_configured` ignored for overall                                 |
| M-7 | HW-4 internal         | `packages/services/src/**/…DTOMapper.ts`                                          | service `down`→overall `critical`, service `degraded`→`degraded`                                      |
| M-8 | PV-7 → UI PV-8        | `apps/web/src/app/providers/{provider-state,provider-ux}.ts`                      | `CONFIGURED`/`MOCK`→connected, `ERROR`→issue, else→not_connected                                      |
| M-9 | PV-1 → PV-7           | `services/api/src/services/ProviderSetupOrchestrator.resolveRuntimeConfigured`    | PV-1 is **not** consulted; runtime config + credential source decide                                  |

## 5. Findings by impact class

Status legend: **[confirmed]** reproduced against source · **[latent]** real defect on a path not currently
composed in production.

### A. Compile errors — **none outstanding**

- Baseline `npx tsc -b` → **exit 0**; `npx tsc --noEmit -p services/api` → **exit 0** (§7). No status-literal
  type error remains. G-01 (`'unhealthy'` assigned to `ProviderStatus`) was the only active compile break and
  is fixed.
- **Residual risk [confirmed by construction]:** PV-1's union is narrow and every assignment to
  `ProviderHealth.status` is checked. Any cross-vocabulary literal (`'unhealthy'`, `'unknown'`, `'active'`)
  re-breaks the consumer-project typecheck exactly as G-01 did. The other unions (PV-2 uppercase, PV-3
  includes `'unhealthy'`, HW-1) are the likely sources of a future copy/paste of that defect.

### B. Incorrect routing decisions

- **F-R1 · `M-1` — ProviderBridge mis-maps a down provider to success. [confirmed at audit time; latent path — NOW FIXED, see §11]**
  `ProviderBridge.syncProviderHealth()` (ProviderBridge.ts:99-105) reads the existing provider system whose
  health vocabulary is PV-1 (`'healthy' | 'degraded' | 'unstable' | 'down'`) but tests
  `provider.status !== 'unhealthy'`. `'unhealthy'` is **never** produced by PV-1, so `'down'` and `'unstable'`
  are recorded as `success: true`. `ProviderHealthBridge.recordObservation` then raises the provider's
  success rate and its derived `status` stays/becomes `'healthy'` (adapters/index.ts:68), and
  `ProviderRouter` (`M-2`, `status !== 'unhealthy'`) therefore treats a **down** provider as available and can
  route work to it. The integration test only ever feeds `status: 'healthy'` (integration.test.ts:80-96), so
  the bug is unexercised. **Live exposure is currently nil** — `ProviderBridge.syncProviderHealth` and
  `ProviderRouter.updateHealth` are referenced only from tests; the fabric router is not composed in
  production. The defect is real and would misroute the moment the bridge is wired.
- **F-R2 · `M-4` — fleet health counts unknown statuses as healthy. [confirmed at audit time — NOW FIXED, see §11]**
  `ProviderHealthService.fleetHealth` buckets `down`/`unstable`/`degraded` explicitly and **defaults every
  other value to `healthyCount`**; `availabilityTier` defaults an unrecognized status to `'ready'`. This means
  the pre-G-01 `'unhealthy'` literal, or any future out-of-union value, would have been **counted as healthy**
  rather than surfacing as an anomaly. For availability accounting the safe default is the opposite polarity.
- **F-R3 · `M-5` — advisory ranking does not exclude `down`. [confirmed; low severity]**
  `rankScore` gives any non-`healthy` availability 0.5, so `down` ranks above nothing in particular and is not
  excluded from the advisory candidate list. Values are static registry seeds (no live health input), so there
  is no live misrouting today; the seam is nonetheless status-blind.
- **F-R4 · routing in the live AI runtime does not consume PV-1. [confirmed — positive counter-evidence]**
  `AIOrchestrationService` uses `healthFeedback` (recorded execution outcomes) for retry/fallback and only
  reads `getHealth()` to build `ProviderHealthDTO` + metrics (AIOrchestrationService.ts:1966-1977). Provider
  _health_ status is therefore a **reporting** value, not a live routing input, in the real runtime.

### C. Misleading UI / operator status

- **F-U1 · `M-3` — readiness silently treats unknown health strings as READY. [confirmed at audit time; latent — NOW FIXED, see §11]**
  `deriveProviderReadiness` accepts `healthStatus?: string` and only recognizes `'down'`/`'unstable'`/
  `'degraded'`; any other value (e.g. PV-3's `'unhealthy'`, `'unknown'`, HW-2's `'critical'`) **falls through
  to `READY`** when there is no runtime execution evidence. Its live caller (`AiControlCenter`, line 164)
  passes PV-1 correctly, so the current wire is honest — but the `string`-typed seam invites a wrong vocabulary
  and would fail _open_ (show READY) rather than closed.
- **F-U2 · name overloading (`ProviderStatus` means four different things). [confirmed — investigated in full by `F-U2-STATUS-OWNERSHIP-AUDIT.md`; original remediation deferred, see §11]**
  PV-1 (health), PV-4 (marketplace install), PV-5 (connection), PV-9 (mission availability) all export the
  identifier `ProviderStatus`. TypeScript keeps them separate, so nothing breaks at compile time, but a
  maintainer or a UI reading `provider.status` cannot tell which axis is meant — the "ambiguous UI state"
  concern in CQ-04, and the condition that let G-01's `'unhealthy'` slip in.
- **F-U3 · two status vocabularies reach the same screen. [confirmed; low severity]**
  The provider screens consume PV-7 (`CONFIGURED`/`MOCK`/…) via `provider-state.ts` **and** PV-5 via the
  `providers.getSetupStatus` DTO. `ProvidersOverview.tsx:383` normalizes `undefined`/`NOT_CONFIGURED`, so the
  fallback is coherent today, but the surface is fed by two independent status concepts with no shared type.

### D. Incorrect operational decisions (monitoring / alerting)

- **F-O1 · `M-6` — HealthRouter escalation is vocabulary-consistent. [confirmed — no defect]**
  `DependencyStatus` (HW-8) and `PlatformHealthComponent.status` (HW-2) are **identical**
  (`healthy|degraded|unhealthy|not_configured`), so the `unhealthy → critical` escalation in
  `HealthRouter.check` fires correctly for real DB/Redis probes; `not_configured` components are reported but
  do not escalate. This is a documented design choice (SPRINT-090B: the HTTP `GET /health/ready` is the
  process-orchestration contract, the tRPC `health.ready` is the application contract) — **observed**, not a
  vocabulary defect. Note only that `PlatformHealth.readiness` derives from `status === 'healthy'`, so a
  deployment whose DB/Redis are `not_configured` still reports `ready` through this tRPC surface; that is the
  application-readiness semantics, deferred to the HTTP contract.
- **F-O2 · `M-9` — setup status correctly avoids PV-1 for "connected". [confirmed — no defect]**
  `resolveRuntimeConfigured` derives from PV-7 + credential source, so a health `'down'` (e.g. a wrong
  endpoint) does not silently promote a provider to CONNECTED, and a user-key provider is not demoted by the
  deployment-only PV-7. This is the honesty property G-01 protected.

### E. Benign / intentionally distinct

- PV-2 (intelligence-fabric) is a genuinely different axis — evidence-only observed state with `UNKNOWN` and
  `MISCONFIGURED` — and **cannot be losslessly mapped** to PV-1: `MISCONFIGURED` has no PV-1 member and
  `UNKNOWN` maps to nothing. Any unification must be an explicit mapping table, not a type alias.
- HW-3 `AppHealthStatus` (`BLOCKED`/`FAILED`/`UNKNOWN`) vs HW-1 (`unhealthy`) is a deliberate verdict
  vocabulary, not a duplicate of provider health.
- HW-5/HW-6 (RAG, OS) use their own `unhealthy` — separate domains, no cross-wiring to PV-1.

## 6. Verdict on the CQ-04 question

| Asked                                  | Verdict                                                                                                                                                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cause compile errors?                  | **No** at present (baseline typecheck green). G-01 was the single active instance of the class; the narrow PV-1 union makes recurrence likely.                                                             |
| Cause incorrect routing?               | **Yes, but latent:** F-R1 (real mis-map on a test-only-wired path) and F-R2 (unknown status counted healthy). Live AI routing (F-R4) is **not** affected because it consumes execution feedback, not PV-1. |
| Cause misleading UI status?            | **Latent:** F-U1 fails open (`READY`) on an unrecognized health string; F-U2/F-U3 create ambiguity but no current wrong render.                                                                            |
| Cause incorrect operational decisions? | **No confirmed** monitoring defect: HealthRouter's escalation vocabulary is consistent (F-O1) and setup/readiness avoid PV-1 misuse (F-O2); F-R2 is the closest operational-accounting risk.               |

**CQ-04's severity (P2) is correct.** Nothing here is a P0/P1; the only live-honesty bug in this family was
G-01, already fixed. The dominant real-world cost is **maintainability + latent fail-open surfaces**, with one
contained, test-only-wired mis-map.

> **Post-fix note (G-05G).** The three latent fail-open seams named above (F-R1, F-R2, F-U1) have since been
> made fail-closed in the working tree — see §11. That closes the _latent_ half of this family; it does **not**
> change the P2 severity (the seams were never live) and does **not** establish deployed-runtime correctness.

## 7. Evidence (read-only commands, with exit status)

Captured at audit time (the tree then carried 19 modified tracked files):

```
git branch --show-current ; git rev-parse HEAD      → main · bdbe6111dbb1e596540ff5b783d74f869d44690c
npx tsc -b                                          → exit 0
npx tsc --noEmit -p services/api                    → exit 0
```

No tests, formatters, or edits were run against source during that audit — it was read-only. Post-fix regression
runs are recorded separately in §11.

## 8. Recommended remediation (as recommended at audit time)

> **Status (G-05G):** items 1–3 (F-R1, F-U1, F-R2) and the G-01 guard have been implemented in the working tree
> with regression tests — see §11. Item 4 (F-U2 rename) was investigated and **deferred** by
> `F-U2-STATUS-OWNERSHIP-AUDIT.md` §6–§7. Items 5–6 remain open recommendations. The list below is retained as
> the original recommendation record, not as current status.

Bounded, in priority order; each is independent and none requires a new status system:

1. **F-R1 (XS):** in `ProviderBridge.syncProviderHealth`, replace the string inequality with an explicit
   mapping from PV-1 → success (`status !== 'down' && status !== 'unstable'`), or better, change
   `ExistingProviderPort.listProviderHealth().status` to the PV-1 type so the compiler enforces it. Add a test
   feeding `'down'` and `'unstable'` (currently only `'healthy'` is exercised).
2. **F-U1 (XS):** narrow `ReadinessInput.healthStatus` from `string` to PV-1 (or an explicit
   `'down'|'unstable'|'degraded'|'healthy'`), so an out-of-vocabulary value fails closed/at compile time
   instead of rendering READY.
3. **F-R2 (XS):** in `ProviderHealthService.fleetHealth`/`availabilityTier`, treat an unrecognized status as
   `unstable`/`risk` (exhaustive switch with a `never` default) rather than defaulting to healthy.
4. **F-U2 (S):** rename the non-health `ProviderStatus` exports to what they mean (e.g.
   `MarketplaceProviderLifecycleStatus`, `ProviderConnectionState`, `MissionProviderAvailability`), and/or
   document the axis on each, so `ProviderStatus` unambiguously denotes PV-1.
5. **PV-2 mapping (S):** add an explicit, tested `ProviderHealthState → ProviderStatus` (and reverse) mapping
   in the intelligence-fabric gateway; keep the two types distinct — `MISCONFIGURED`/`UNKNOWN` are not
   representable in PV-1 and must map to policy (`'down'` + a reason), never be dropped.
6. **Guard (XS):** add a type-level test asserting each adapter's `getHealth().status` is a member of PV-1
   (extends the G-01 regression to every adapter), so a cross-vocabulary literal is caught in the provider
   package rather than in the slower consumer-project typecheck.

## 9. Limitations

- Verification was static/source-derived; no live provider call, browser session, or deployed monitor was
  exercised. Conclusions about "misleading UI" are code-path judgments, not screenshots.
- "Latent" findings are real defects on paths not composed in the current production wiring; their severity
  is bounded by that fact and would rise if the orchestration-fabric bridge/router is wired into production.
- The chat request that commissioned this audit was truncated after the inventory list; sections 4-6
  (deliverable path/format) were not received, so this document is written to the established
  `docs/audits/2026-10-10-full-audit/` convention.

## 10. G-05B follow-up — the bridge→router wiring is absent (recorded as G-17)

G-05A corrected the status→success mapping in `ProviderBridge`. The follow-up question was whether
`ProviderRouter.updateHealth()` simply lacked a production caller. **It does — but the gap is larger: the
fabric's provider-routing feature is not composed in production at all.**

Confirmed production references (excluding `dist/`, `node_modules`, tests):

| Fact                                                                              | Evidence                                                                                                                                                            |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ProviderRouter.updateHealth()` has **0 production callers**                      | only `orchestration-fabric.test.ts:587,1029,1728`; definition `ProviderRouter.ts:92`                                                                                |
| `ProviderBridge` / `ProviderHealthBridge` are **never constructed in production** | every `new ProviderBridge`/`new ProviderHealthBridge` is in tests                                                                                                   |
| The fabric `OrchestratorService` is constructed **once** in production            | `ApiApplicationService.ts:2799`, `enableProviderRouting: true`                                                                                                      |
| …but **no provider is registered** on it                                          | no `orchestrator.registerProvider(...)` on the fabric class in production (all hits are the _AI_ `AIOrchestrationService`, a different class)                       |
| …and **no handler is registered**, `.start()` is **never called**                 | no production `registerHandler(`/`start()`; the only production consumer is `createFabricOrchestratorRouter(services.orchestrator)` (`RouterRegistry.ts:6727-6775`) |

**Consequence:** `ProviderRouter.findCandidates()` iterates an empty capability map → `selectProvider()` returns
`null`. Health observations cannot reach a routing decision that never runs.

**Why no bounded fix was made (decision: report only):** wiring `updateHealth` alone is inert (no registered
providers). Registering providers to make it effective collides with the safety rule _"unhealthy/down
providers cannot be made available by stale or default health data"_: `ProviderRouter.registerProvider()`
initialises every provider as `'healthy'`/score 1.0, and `findCandidates` treats any non-`'unhealthy'` status
(including `'unknown'`) as available. Closing that fail-open changes routing policy, which the G-05B brief
explicitly preserves. Composing the feature (adapter over `AIOrchestrationService.listProviders()` /
`getAllProviderHealth()` / `orchestrate`, a capability source of truth, fail-closed health, a sync cadence and
lifecycle wiring) is a sprint-scale change, not the smallest safe wiring — so it is recorded as **G-17** in
`GAP-REGISTER.md` and deferred. No source was modified.

## 11. Post-fix status reconciliation (G-05G, 2026-10-10)

This section reconciles §5's audit-time findings with the implementation evidence present in the working tree at
the start of G-05G. **§5 is retained unchanged as the historical record**; this section states what is now true.
No source, test, or configuration file was modified to produce it — every claim below is source-read plus, where
noted, a regression test run.

### 11.1 Finding-by-finding disposition

| Finding                                            | Audit-time status (§5)       | Current status                                                                                  | Evidence in the working tree                                                                                                                                                                 | Regression evidence                                                                                                       |
| -------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **G-01** provider health union compatibility       | Confirmed defect (build red) | **Fixed**                                                                                       | `services/orchestrator/src/providers/OpenAICompatibleProvider.ts:128` returns `configured ? 'healthy' : 'down'`; `'unhealthy'` removed                                                       | `OpenAICompatibleProvider.test.ts:148-160` union-membership test; **23/23 pass, exit 0**                                  |
| **F-R1 / G-05A** ProviderBridge health→success map | Confirmed (latent path)      | **Fixed**                                                                                       | `packages/orchestration-fabric/src/adapters/ProviderBridge.ts:38-47` exhaustive `switch` over `ProviderStatus`; port member typed `ProviderStatus` (`:63`) instead of `string`               | `integration.test.ts:342-393` (down/unstable recorded as failures, healthy/degraded as successes); **19/19 pass, exit 0** |
| **F-U1 / G-05D** readiness fail-open               | Confirmed (latent)           | **Fixed (fail-closed)**                                                                         | `services/api/src/observability/ProviderReadinessModel.ts:283-296` — an unrecognized `healthStatus` string now returns `UNAVAILABLE` with `reason`, never `READY`                            | `AiReadinessModel.test.ts:119-158` (`'unhealthy'`, `'unknown'`, `''`, quota path); **17/17 pass, exit 0**                 |
| **F-R2 / G-05E** fleet-health fail-open            | Confirmed                    | **Fixed (fail-closed)**                                                                         | `packages/providers/src/domain/services/ProviderHealthService.ts:70-79` counts an unrecognized status as `unstable` (never `healthy`); `availabilityTier` `:123-128` returns `'risk'` for it | `ProviderHealthService.test.ts:154-202`; **8/8 pass, exit 0**                                                             |
| **F-U2** status ownership/naming                   | Confirmed (naming + seams)   | **Audit complete** (deliverable present); _seam fixes_ F-1/F-3 landed, F-2 landed but see §11.2 | `F-U2-STATUS-OWNERSHIP-AUDIT.md` (536 lines) is present and complete                                                                                                                         | see §11.2                                                                                                                 |
| **G-17** fabric routing uncomposed in production   | Deferred (intentional)       | **Deferred — unchanged**                                                                        | `updateHealth()` still has 0 production callers; `new ProviderBridge`/`new ProviderHealthBridge` remain test-only; no provider/handler registered on the fabric `OrchestratorService`        | none claimed — no production wiring was added                                                                             |

### 11.2 F-U2 seam fixes as observed in the working tree

`F-U2-STATUS-OWNERSHIP-AUDIT.md` recommended three seam fixes (F-1, F-2, F-3) in addition to the naming decision.
Their implementation state at G-05G start:

- **F-1 (configured = lifecycle only):** implemented — `services/api/src/infrastructure/CapabilitySourcePorts.ts:123-124`
  now derives `configured` from `lifecycleStatus === 'active'` alone; health no longer decides it. Covered by
  `GatewayPorts.test.ts` (`createCapabilitySourcePort`, incl. the mixed pairs) — **93/93 pass, exit 0**.
- **F-2 (deriveAvailability fail-closed):** implemented in
  `services/api/src/services/ProviderExperienceService.ts:208-224` (unrecognized status → `UNKNOWN`). **However**,
  at G-05G start this file contained a **pre-existing broken edit** — an orphaned comment fragment plus a stray
  `} as const;` near lines 67-68 — so `ProviderExperienceService.test.ts` currently **fails to transform**
  (`esbuild: Unexpected "}"`). This is a working-tree defect that predates G-05G and is **out of G-05G's scope**
  (documentation-only; no source may be changed). F-2's _runtime_ verification is therefore **blocked**, and its
  test is recorded as **not passing**, not as passing.
- **F-3 (getHealth ← isHealthy):** implemented — `DeepSeekProvider.ts:118-122`, `GoogleGeminiProvider.ts:138-142`,
  `VercelAIProvider.ts:119-123` now return `this.isHealthy() ? 'healthy' : 'down'`. The `OpenAICompatibleProvider`
  and `OpenAIProvider`/`OllamaProvider` adapters already expressed "cannot serve". (`DeepSeekProvider` and
  `GoogleGeminiProvider` tests still assert only the keyed-`'healthy'` case; the keyless case is not separately
  asserted in those two files — recorded as a residual test-coverage gap.)

### 11.3 What this reconciliation does **not** claim

- Unit/consumer suites passing does **not** establish deployed-runtime correctness. No live provider call, deployed
  monitor, or browser session was exercised; the only runtime evidence here is the bounded local test runs in §11.1.
- No severity was downgraded and no audit score was raised: F-R1/F-R2/F-U1 were already bounded in §6 as P2-class
  latent seams, and fixing them does not change the CQ-04 severity (P2).
- **G-17 remains open and intentionally deferred.** It must not be read as fixed.
- F-R3, F-R4, F-U3, F-O1, F-O2 and the PV-2 mapping recommendation (§8 items 5–6) are unchanged and still open.
