# F-U2-STATUS-OWNERSHIP-AUDIT.md — ProviderStatus Semantic Ownership

**Date:** 2026-10-10 · **Type:** READ-ONLY audit (no source modified, nothing staged/committed/pushed)
**Commissioned by:** F-U2 in `HEALTH-CONTRACT-AUDIT.md` §5 (item "F-U2 · name overloading"), scope ref `GAP-REGISTER.md` **G-05**

> **Deliverable status:** this audit is **complete** (the F-U2 deliverable exists). **Reconciliation (G-05G,
> 2026-10-10):** of its three recommended seam fixes, **F-1 and F-3 are implemented** in the working tree
> (`CapabilitySourcePorts.ts:123-124`; `DeepSeek`/`GoogleGemini`/`VercelAI` `getHealth()`), and **F-2 is
> implemented but its file currently fails to transform** because of an unrelated, **pre-existing** broken edit in
> `ProviderExperienceService.ts` (an orphaned comment fragment + stray `} as const;` near lines 67-68) — out of
> scope for a documentation-only task. The §7 naming deferral stands. See `HEALTH-CONTRACT-AUDIT.md` §11.2.
> **Prior art read first (as required):** `HEALTH-CONTRACT-AUDIT.md` (PV-1…PV-9, HW-1…HW-8, M-1…M-9, F-R1…F-R4, F-U1…F-U3, F-O1/F-O2, G-05B/G-17) and `GAP-REGISTER.md` (G-01, G-05, G-17).

## 0. Answer up front

**Does the overloaded `ProviderStatus` terminology create actual defects, or is it merely naming ambiguity?**

**Both, and they must be separated:**

1. **The _type names_ are only a naming/maintainability problem (Class C).** Four different concepts export the
   identifier `ProviderStatus`, but they are structurally disjoint (one union, three different interfaces) and
   each consumer imports only its own module's type. A targeted search found **no cross-domain assignment, no
   unsafe cast, and no import that mixes two of the concepts** — the compiler would reject it anyway.
2. **The _semantic confusion around_ those names has produced one confirmed behavior defect (Class A) and two
   correctness risks (Class B)** — all at seams where a status/health value is interpreted through a `string`,
   a bare `boolean`, or a hand-written equality test instead of through its own type:
   - **F-1 [A]** — `ProviderCandidateFact.configured` (a _connection/enablement_ flag per its own contract) is
     computed from the **health** axis with an `||`, so the same provider gets contradictory verdicts from two
     ports fed by the same registry row (one screen says `READY`/usable, another says `UNAVAILABLE`) using
     entirely in-contract data.
   - **F-2 [B]** — `deriveAvailability` **fails open** to `AVAILABLE` on an unrecognized health status while the
     readiness model fed by the _same row_ **fails closed** to `UNAVAILABLE` (G-05E fixed the third interpreter,
     this one was missed).
   - **F-3 [B]** — four of the orchestrator adapters publish a **constant `'healthy'`** from `getHealth()` that
     contradicts their own `isHealthy()`; today only registration gating masks it.

**Recommended strategy (§7):** keep all four `ProviderStatus` declarations and the canonical `@vedmoulya/ai`
union **unchanged**; fix the three interpretation seams (F-1…F-3) with explicit, exhaustive mappings; document
the axis on each declaration; **defer** any rename of the non-health `ProviderStatus` exports (migration risk

> demonstrated benefit). Do **not** execute G-05's original "define one canonical provider-state type" — the
> four concepts are four different axes and must not share one type.

_(G-05G note: this "do not merge" conclusion is now reflected in `GAP-REGISTER.md` G-05, whose original
"define one canonical provider-state type" wording is marked **superseded** by this audit.)_

---

## 1. Protect existing work

Baseline captured with read-only commands (every command the audit ran is listed in §9; none mutate state):

```
git branch --show-current            → main
git rev-parse HEAD                   → bdbe6111dbb1e596540ff5b783d74f869d44690c
git diff --cached --stat | tail -5   → (empty — 0 staged changes)
git status --short | wc -l           → 56 lines (26 modified tracked + 30 untracked paths)
git diff --stat | tail -3            → 26 files changed, 1445 insertions(+), 67 deletions(-)
```

The 26 modified tracked files are exactly the set recorded at the end of G-05E (G-01 / G-05A / G-05D / G-05E /
G-17 work: `ProviderHealthService.ts` + tests, `ProviderBridge.ts`, `integration.test.ts`,
`OpenAICompatibleProvider.ts` + test, `ProviderReadinessModel.ts` + `AiReadinessModel.test.ts`, the
agent-execution/mission-runtime Rev-004a files, Revenue/Opportunity files, `api-client.ts`,
`OpportunityValueIntelligencePanel*`, `vitest.config.ts`, `ControlRouter.ts`, `MissionService.ts`,
`OpportunityMissionPorts.ts`, `ApiApplicationService.ts`, `services/orchestrator/src/index.ts`). Untracked
artifacts (`_rev001-live/`, `_rev002a-live/`, `_rev004a-live/`, `docs/audits/2026-10-10-full-audit/`,
`.rev004a-gate.*`, `.tmp-*`, `scripts/revenue-*.ts`, `packages/mission-runtime/{compiled,.out}`, new tests) are
intact. **No `reset`, `clean`, `stash`, `restore`, stage, commit or push was used; no production source was
modified.** Final state comparison: §10.

---

## 2. Contract inventory

### 2.1 The four concepts that all call themselves `ProviderStatus`

| #       | Concept                             | Declaration                                                                                                                                                                                                                                                            | Shape                                                                                                      | Persistence                                                                                                                                                                             | API exposure                                                                                                                                      | UI use                                                                                                                                                     |
| ------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S-1** | **Provider health** (canonical)     | `packages/ai/src/types/index.ts:45` — `ProviderStatus = 'healthy' \| 'degraded' \| 'unstable' \| 'down'`; consumed as `ProviderHealth.status` (`:153`)                                                                                                                 | string union                                                                                               | JSONB column `providers.health` — written `PostgresProviderRepository.ts:323`, read back with an **unvalidated cast** `:122` (`this.parseJson(row.health) as ProviderEntity['health']`) | `ai.getProviderHealth` / `ai.getAllProviderHealth` (`AIRouter.ts:179`), registry/fleet endpoints (`providers.*`), `ops.providerHealth`            | provider card health dot (`ProviderDetailView.tsx:440-443`), control-center board `healthStatus`, brain dashboard `healthStatus`                           |
| **S-2** | **Marketplace installation status** | `packages/services/src/marketplace/MarketplaceDTO.ts:127` — `'active' \| 'inactive' \| 'error' \| 'configuring'`                                                                                                                                                       | string union                                                                                               | **none** (in-memory `Map` in `MarketplaceProviderService`; no postgres/sql reference anywhere in `packages/services/src/marketplace/`)                                                  | `marketplace.getMarketplace` → `MarketplaceSnapshotDTO.providers[].status` (`MarketplaceApplicationService.ts:64-67`), `marketplace.getViewModel` | **not demonstrated — see D-1**                                                                                                                             |
| **S-3** | **Provider connection/auth state**  | `services/api/src/services/ProviderSetupOrchestrator.ts:194` `ProviderConnectionState = 'DISCONNECTED'\|'CONNECTING'\|'CONNECTED'\|'ERROR'` + `:197` `interface ProviderStatus { providerId, connectionState, credentialSource, selectedModel, …, runtimeConfigured }` | interface (computed per request from credential service + runtime report + preferences; **not persisted**) | none                                                                                                                                                                                    | `providers.getSetupStatus` (`ProvidersRouter.ts:498-514`, typed result at `:507`)                                                                 | web mirror `apps/web/src/lib/api-client.ts:843-856` (`ProviderStatusDTO`); rendered through `providerStatusDisplay` (`provider-ux.ts:209`, options `:235`) |
| **S-4** | **Mission/runtime availability**    | `packages/mission-controller/src/types/mission-types.ts:311-315` — `interface ProviderStatus { available, capableProviders[], unhealthyProviders[] }` (+ a smaller inline shape `ObjectiveSelectionResult.providerStatus` at `:342`)                                   | interface (derived per evaluation)                                                                         | none (derived on each `getProviderStatus` call)                                                                                                                                         | not exposed as its own endpoint; the smaller derived shape travels in `ObjectiveSelectionResult` (`mission-types.ts:342`) with selector output    | not rendered directly (mission `WAITING_FOR_PROVIDER` state is the visible effect)                                                                         |

**All four are genuinely different axes** (measured/config health · install lifecycle · credential connection ·
capability availability). They are not interchangeable and must not be unified.

### 2.2 Health-adjacent vocabularies that _meet_ S-1 (the look-alikes)

| Vocabulary                       | Location                                                                                       | Values                                                          | Relationship to S-1                                                                                                                                                             |
| -------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fabric router health (PV-3)      | `packages/orchestration-fabric/src/types/provider-router.ts:75-93` (`status` `:80`)            | `healthy \| degraded \| unhealthy \| unknown`                   | **different union**; `'unhealthy'`/`'unknown'` ∉ S-1, `'unstable'`/`'down'` ∉ PV-3. Bridged only through `ProviderBridge` (typed port `:63`, exhaustive switch `:38-49`, G-05A) |
| Intelligence-fabric state (PV-2) | `packages/intelligence-fabric/src/types/fabric-types.ts:22`                                    | `UNKNOWN\|HEALTHY\|DEGRADED\|UNAVAILABLE\|MISCONFIGURED`        | different axis (evidence-only); not losslessly mappable to S-1                                                                                                                  |
| Readiness state machine (PV-6)   | `services/api/src/observability/ProviderReadinessModel.ts`                                     | `DISABLED…READY` (`healthStatus?: string` seam at `:168`)       | **consumer** of S-1 via a `string` seam; fail-closed since F-U1 fix (`:267-296`)                                                                                                |
| Deployment config status (PV-7)  | `packages/core/src/startup/provider-runtime.ts:29`                                             | `CONFIGURED\|AVAILABLE\|NOT_CONFIGURED\|…`                      | connection/config axis; consumed by setup (`ProvidersRouter.ts:502-508`) and web `provider-state.ts` — **correctly never fed from S-1**                                         |
| Infra health (HW-1/HW-2/HW-8)    | `packages/core/src/health/index.ts:9`, `HealthRouter.ts:20`, `InfrastructureHealthProbe.ts:15` | `healthy \| degraded \| unhealthy (\| not_configured)`          | process/DB/Redis subject, not providers; no cross-wiring found (F-O1)                                                                                                           |
| Marketplace _service_ health     | `MarketplaceDTOMapper.ts:33-44`                                                                | `'healthy'\|'degraded'\|'down'` → `healthy\|degraded\|critical` | same member names as S-1, different subject (module services)                                                                                                                   |

### 2.3 A fourth overloading: the field name `availability`

Three unrelated types share the field name `availability`:

- `Provider.availability: number` (0–1) — `packages/providers/src/domain/entities/Provider.ts:114`, persisted
  (`PostgresProviderRepository.ts:121,:322`), exposed on `ProviderDTO` (`ProviderDTO.ts:145`).
- `ProviderExperienceRow.availability: 'AVAILABLE'|'LIMITED'|'UNAVAILABLE'|'UNKNOWN'|'LOCAL'` — derived enum
  (`ProviderExperienceService.ts:158-173`), shipped to web (`api-client` `ProviderExperienceRowDTO`, brain
  dashboard `BrainDashboardService.ts:170`).
- `ProviderCandidate.availability: ProviderStatus` — **the S-1 health union under the name "availability"**
  (`packages/execution-strategy/src/types/strategy-types.ts:110`, import `:12`; profile seed
  `ProviderCandidateService.ts:26`; consumed `RiskEngineService.ts:60` (`!== 'healthy'`),
  `ProviderCandidateService.ts:215,231`).

Classified in F-6.

---

## 3. Producer–consumer map

### 3.1 S-1 health — two producers with two different semantics, two consumer gates

**Producers (orchestrator axis — _configuration/readiness_ expressed in health vocabulary):**

| Adapter                    | `getHealth().status`                                                             | Ref                                |
| -------------------------- | -------------------------------------------------------------------------------- | ---------------------------------- |
| `OpenAICompatibleProvider` | `configured ? 'healthy' : 'down'`                                                | `:128`                             |
| `OpenAIProvider`           | `healthy ? 'healthy' : 'down'`                                                   | `:79`                              |
| `OllamaProvider`           | `healthy ? 'healthy' : 'down'`                                                   | `:277`                             |
| `DeepSeekProvider`         | **constant `'healthy'`** (while `isHealthy()` = `apiKey.length > 0`, `:107-110`) | `:112-121`                         |
| `GoogleGeminiProvider`     | **constant `'healthy'`** (`isHealthy()` is `:132-135`)                           | `:137-146` (status literal `:140`) |
| `VercelAIProvider`         | **constant `'healthy'`**                                                         | `:117-121`                         |
| `MockProvider`             | constant `'healthy'` (synthetic by design)                                       | `:36`                              |

> **G-05G re-read (2026-10-10):** the three adapter rows marked "constant `'healthy'`" (`DeepSeekProvider`,
> `GoogleGeminiProvider`, `VercelAIProvider`) were the F-3 finding, and have **since been fixed** to
> `this.isHealthy() ? 'healthy' : 'down'` (`DeepSeekProvider.ts:118-122`, `GoogleGeminiProvider.ts:138-142`,
> `VercelAIProvider.ts:119-123`). The table above is retained as the audit-time snapshot.

Aggregated by `AIOrchestrationService.getAllProviderHealth()` (`packages/services/src/ai/AIOrchestrationService.ts:1971-1988`;
verbatim `provider.getHealth().status`, `status:'down'` only when `getHealth()` **throws**) → `AIMapper.toProviderHealthDTO`
(`AIMapper.ts:34-44`) → `ai.get(All)ProviderHealth`, `ops.providerHealth`.

**Producers (registry axis — _measured_ reliability):** `Provider.recordHealthSample`
(`packages/providers/src/domain/entities/Provider.ts:295`, application `ProviderApplicationService.ts:341-356`)
— production callers `ProviderUsageIngestor.ts:488`, `ApiApplicationService.ts:1340`,
`ProvidersRouter.ts:320` (endpoint), plus the seed catalog. Persisted in `providers.health` JSONB
(`PostgresProviderRepository.ts:122,:323`).

**Consumers, by axis:**

| Consumer                               | Source axis                                                        | Gate                                                                    | Ref                                                                               |
| -------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Mission provider availability          | orchestrator                                                       | `entry.status === 'healthy'` (strict)                                   | `packages/mission-runtime/src/adapters/OrchestratorProviderAvailability.ts:52-56` |
| Mission routing candidates             | orchestrator                                                       | `healthEntry?.status === 'healthy'`                                     | `OrchestratorRoutingPorts.ts:138`                                                 |
| Routing advisor eligibility            | registry                                                           | `health.status === 'healthy' && lifecycleStatus === 'active'`           | `services/api/src/infrastructure/RuntimePorts.ts:103-105`                         |
| Capability/recommendation "configured" | registry                                                           | `health.status === 'healthy' \|\| lifecycleStatus === 'active'`         | `CapabilitySourcePorts.ts:114-115` ← see **F-1**                                  |
| Fleet counts / availability tier       | registry                                                           | exhaustive switch, fail-closed (G-05E)                                  | `packages/providers/src/domain/services/ProviderHealthService.ts`                 |
| Readiness board                        | registry (via `string` seam)                                       | fail-closed ladder (F-U1 fix)                                           | `ProviderReadinessModel.ts:267-296`, fed by `AiControlCenter.ts:166`              |
| Providers screen availability chip     | registry (via `string` seam)                                       | fail-**open** ladder                                                    | `ProviderExperienceService.ts:158-173` ← see **F-2**                              |
| Brain usage facts                      | registry row                                                       | `!== 'unknown'` (a **PV-3** literal) then publishes the chip as `KNOWN` | `services/api/src/infrastructure/BrainPorts.ts:124-133` ← see **F-2**             |
| Fabric router                          | observation-derived PV-3 (score thresholds `adapters/index.ts:66`) | `status !== 'unhealthy'` → **fail-open for `'unknown'`**                | `ProviderRouter.ts:190,:214` (dormant — G-17)                                     |

### 3.2 S-2 marketplace installation — confined

Producers: `MarketplaceProviderService.registerProvider/updateProviderStatus` (`:31`, active filter `:24`).
Consumers (server-side only): `MarketplaceViewModelFactory.ts:80`,
`MarketplaceAssembler.ts:183,:196,:208,:385` (counts/metrics). No import of this type outside
`packages/services/src/marketplace/`; no web reference to any of its fields (§9 search). It never reaches a
health consumer, and no health value reaches it.

### 3.3 S-3 connection — correctly separated from health

`ProviderSetupOrchestrator` derives `connectionState` from credential source + PV-7 runtime truth + preferences;
its own header states health is not consulted (prior audit F-O2 confirmed). Web `provider-state.ts` /
`provider-ux.ts` fold PV-7 + enablement into the connection chip and never read S-1. `ProviderReadinessModel`
checks `enabled → credential → execution evidence → quota` **before** health and documents "health can only
DOWNGRADE, never upgrade" (`:267-270`).

### 3.4 S-4 mission availability — explicit, typed mapping

`OrchestratorProviderAvailability.getProviderStatus()` maps orchestrator health into the mission interface with
an explicit equality test (`:54`) and derives `healthy: true` only for members of `healthyIds` (`:59-64`).
The port type comes from `mission-ports.ts:70/:232`; no mission code imports S-1, S-2 or S-3.

### 3.5 Negative result: no cross-domain assignment exists

- `import type { ProviderStatus … }` across the repo resolves to **exactly one** of the four declarations per
  file: S-1 (`ProviderBridge.ts:18`, `ProviderCandidateService.ts:9`, `strategy-types.ts:12`, aliased as
  `ProviderHealthStatus` in `provider-types.ts:13`, `ProviderDTO.ts:11`, `ProviderHealthService.ts:9`),
  S-2 (`MarketplaceProviderService.ts:6`), S-3 (`ProvidersRouter.ts:19`),
  S-4 (`mission-runtime` adapters, `mission-controller` selectors/classifier). **No file imports two of them.**
- `as ProviderStatus` / `as unknown as ProviderStatus` casts: **zero** (the only `as unknown as` status casts in
  the repo are unrelated `entityStatus` columns in identity/knowledge repositories).
- Values that would be rejected if they crossed domains (`'unhealthy'`, `'unknown'`, `'active'`, `'CONNECTED'`)
  appear only in their own domain's tests, in the fail-closed test fixtures added by G-05E/F-U1, or in the
  fabric's PV-3 — never assigned to S-1.

---

## 4. Confirmed impacts

Classification key: **A** confirmed behavior defect · **B** compatibility/correctness risk supported by source
evidence · **C** naming/maintainability only · **D** missing evidence.

### F-1 [A] — A health value decides a connection/enablement flag, and the two verdict surfaces contradict each other

**Evidence**

- Contract: `ProviderCandidateFact.configured` = _"Whether the provider is **configured and enabled** for this
  user"_ — `packages/capability-marketplace/src/contracts/CapabilitySourcePort.ts:25-26`.
- Implementation: `configured: provider.health.status === 'healthy' || provider.lifecycleStatus === 'active'`
  — `services/api/src/infrastructure/CapabilitySourcePorts.ts:114-115` (a **health** member can satisfy a
  **connection/enablement** predicate, via `||`).
- Sibling gate over the same DTO uses `&&`: `registryHealthy = provider.health.status === 'healthy' &&
provider.lifecycleStatus === 'active'` — `RuntimePorts.ts:103-105`.
- Contradicting surface over the same DTO: `deriveAvailability` maps `deprecated|archived → UNAVAILABLE` and
  `down|unstable → UNAVAILABLE` **first** — `ProviderExperienceService.ts:167-168`.
- Only the two agreement cases are tested: _"…expect(facts[0]?.configured).toBe(true); // healthy + active"_ and
  _"marks providers as unconfigured when health/lifecycle are not healthy/active"_ with input
  `health:'down' + lifecycle:'retired'` (both fail) — `services/api/src/__tests__/GatewayPorts.test.ts`
  (tests `maps registry providers…` and `marks providers as unconfigured…`). **Both mixed cases are untested.**

**Root cause** — one boolean conflates three axes (health · lifecycle enablement · user preference) because the
field is named `configured`; the health axis was the most convenient input available at that port.

**Affected consumers** (all read `configured` as "usable right now"):
`TaskIntelligenceEngine.ts:55-57` ("Configured providers (usable right now)"), `:333`
(`requires: configured ? [] : ['api_key']`); `IntegrationClassifier.ts:43-51` (`READY` vs `CONFIGURE`);
`ExecutionFailover.ts:49` (failover pool filter); `CapabilityMarketplaceApplicationService.ts:137-140`;
`LiveIntelligenceBridgeService.ts:164-177` (`availability: 'AVAILABLE'`); `RecommendationAssembler.ts:162`;
`BrainPorts.ts:70-73` (delegates to this port for the Brain).

**Impact (in-contract inputs, no persistence precondition)**

- `health='healthy'`, `lifecycle='deprecated'|'maintenance'|'archived'` → `configured=true` → classified
  **READY**, "usable right now", `requires: []` — **while the providers screen for the same provider renders
  `UNAVAILABLE`** (`ProviderExperienceService.ts:167`). Confirmed contradictory behavior.
- `health='down'`, `lifecycle='active'` → `configured=true` → stays in the recommendation/failover pools as
  usable, while `RuntimePorts` excludes the same provider from routing eligibility (`:103-105`) and the
  providers screen renders `UNAVAILABLE`.
- User-enablement (`preferences.disabledProviderIds`) is never consulted here at all, so "enabled for this
  user" is asserted without the input that defines it.

**Smallest safe correction (decision point — pick one)**

1. _Smallest (one operator, fail-closed for every consumer):_ change `||` → `&&` so both ports agree; update the
   `configured` doc-comment to `healthy and active (usable now)`. Trade-off: a healthy-but-not-active provider
   then reads as "configure it (api_key required)", which is a config-axis lie in the other direction.
2. _Principled (recommended):_ remove `health.status` from the expression (config ≠ health), keep
   `lifecycleStatus === 'active'` as today's best available enablement proxy, and add an explicit `healthy`
   boolean to `ProviderCandidateFact` so usability consumers (`TaskIntelligenceEngine`, `ExecutionFailover`)
   gate on health explicitly. Contract comment updated to state the residual gap (user preference is not
   visible at this port).

Either way: no wire, DB or DTO change (the field stays a boolean).

**Regression criteria**

- Unit tests for the four pairs `(healthy,active) (healthy,deprecated) (down,active) (down,retired)` asserting
  the chosen verdict, plus a **cross-port parity test** that `CapabilitySourcePorts` and `RuntimePorts` agree on
  all four.
- A test that a `deprecated` provider never yields `configured: true` (or, under option 2, never yields
  `READY`/`usable` without an additional health gate).

---

### F-2 [B] — The same row fails open on one screen and fail-closed on another

**Evidence**

- `deriveAvailability` (`ProviderExperienceService.ts:158-173`) recognizes only `'down' | 'unstable'`
  (`:168`) and `'degraded'` (`:169`); **any other string falls through to `'AVAILABLE'`** (`:172`) unless
  `healthScore <= 0 && lastCheckedAt === ''` (`:171` → `'UNKNOWN'`).
- The row's `health.status` is deliberately widened: `health: { status: string; … }`
  — `ProviderExperienceService.ts:67`, fed from `ProviderDTO.health.status` (typed S-1, `ProviderDTO.ts:147`).
- The **same row** is fed to `deriveProviderReadiness({ …, healthStatus: p.health.status })`
  — `AiControlCenter.ts:157-166` — which now fail-closes: _"a future vocabulary member, a cross-vocabulary
  literal such as 'unhealthy', or a typo — must never fall through to READY"_ (`ProviderReadinessModel.ts:284-296`).
- The third interpreter was already fixed by G-05E (`ProviderHealthService` `fleetHealth`/`availabilityTier`).
- Chain to surfaces: `BrainPorts.ts:124-133` gates on `row.health.status && row.health.status !== 'unknown'`
  (a **PV-3** literal, not an S-1 member) and then publishes the fail-open chip as
  `availability: { value: 1, status: 'KNOWN' }`; `BrainDashboardService.ts:166-174` ships
  `availability` + `healthStatus` to `/brain`; `ProvidersRouter.ts:391,:600` ship the chip to the providers
  screen.
- Trigger precondition: an out-of-contract string inside `ProviderDTO.health.status`. The only located path is
  the unvalidated JSONB hydration `PostgresProviderRepository.ts:122`
  (`parseJson(row.health) as ProviderEntity['health']`) — the same precondition G-05E accepted as reachable and
  built its repro test on.
- Coverage gap: `ProviderExperienceService.test.ts` has **no** unrecognized-status case (only
  `healthScore 0 → 'UNKNOWN'`, `:328`), while `AiReadinessModel.test.ts:117-120` explicitly asserts
  `'unhealthy'` does **not** reach READY.

**Root cause** — three independent hand-written interpreters of one union; two are exhaustive/fail-closed, the
third is a fall-through ladder behind a `string` seam.

**Affected consumer** — AI providers screen availability chip, `/brain` provider-health rows, and brain usage
facts (as `KNOWN` availability).

**Impact** — for a stale/cross-vocabulary persisted status with a decent `healthScore`, the providers screen
and brain dashboard show **`AVAILABLE`** while the control-center board for the same provider shows
**`UNAVAILABLE` — "Unrecognized health status '…' — readiness cannot be confirmed."** Two authoritative
surfaces disagree; the wrong direction is the unsafe one (fail-open).

**Smallest safe correction** — mirror the G-05E pattern in `deriveAvailability`: an explicit exhaustive
`switch (health)` over S-1 with a documented fail-closed default (`'unhealthy'`/typo → `'UNKNOWN'`), and
replace `BrainPorts.ts:124`'s `!== 'unknown'` inequality with a positive membership check on the S-1 members
(the current test at `GatewayPorts.test.ts:212` keeps its meaning under the new gate).

**Regression criteria**

- `deriveAvailability` tests with `'unhealthy'`, `'active'` (S-2 literal), `'critical'` (HW literal), `''` →
  never `AVAILABLE`/`LIMITED`.
- Parity test: one row with an unrecognized status through `deriveProviderReadiness` and `deriveAvailability`
  must not disagree on the available/unavailable axis.
- `BrainPorts`: unrecognized status → no `KNOWN` availability fact.

---

### F-3 [B] — Adapter health publishes a constant that contradicts the adapter's own health predicate

**Evidence** — `DeepSeekProvider.getHealth()` returns `status: 'healthy'` unconditionally (`:112-121`) while
its own `isHealthy()` is `this.apiKey.length > 0` (`:107-110`); identical pattern in `GoogleGeminiProvider`
(`:137-146`, status `:140`), `VercelAIProvider` (`:117-121`) and (by design) `MockProvider:36`.
`OpenAICompatibleProvider`/`OpenAIProvider`/`OllamaProvider` do express "cannot serve"
(`configured|healthy ? 'healthy' : 'down'` — `:128`, `:79`, `:277`). `getAllProviderHealth()` publishes whatever `getHealth()` returns
(`AIOrchestrationService.ts:1971-1988`); only a **throw** produces `status:'down'`
(test `getAllProviderHealth reports a provider as down when its health check fails` —
`AIOrchestrationServiceBranches.test.ts:140-154`).

**Root cause** — the health field is being used as a configuration readout ("Model configuration is treated as
readiness"), and some adapters implemented that with a constant instead of the configured-check they already
have in `isHealthy()`.

**Affected consumers** — mission availability (`OrchestratorProviderAvailability.ts:54`), mission routing
candidates (`OrchestratorRoutingPorts.ts:138`), `ai.getAllProviderHealth` / `ops.providerHealth` operator views.

**Impact (latent today)** — an adapter registered with an empty/revoked key would still be counted in
`healthyIds`, listed in `capableProviders` with `healthy: true`, and the mission would _not_ wait
(`WAITING_FOR_PROVIDER` is bypassed) for a provider that cannot execute. Masked today because
`registerPlatformProviders` registers these adapters only when their key exists (EPIC-019 provider-runtime
matrix), and because a broken adapter that throws does map to `down`.

**Smallest safe correction** — make `getHealth().status` derive from the adapter's own `isHealthy()`
(`isHealthy() ? 'healthy' : 'down'`) in the three adapters; no interface change, no consumer change.

**Regression criteria** — per-adapter test: an adapter constructed without a key reports `'down'` (and with a
key `'healthy'`), i.e. `getHealth().status` ∈ S-1 **and** agrees with `isHealthy()`; keep the existing G-01
union-membership test.

---

### F-4 [C] — One union, two producer axes, two unreconciled availability gates

**Evidence** — see §3.1: the orchestrator axis reports _configuration_ truth (or a constant), the registry axis
reports _measured_ reliability; mission gates on the former, the routing advisor on the latter, with no
reconciliation point. `'degraded'`/`'unstable'` are produced **only** on the registry axis (via
`recordHealthSample`), so the mission's strict `=== 'healthy'` gate can never observe them.

**Affected consumers** — mission availability vs routing advisor may disagree about the same provider id within
the same window (available to the mission, "not healthy" to the advisor — or the reverse).

**Impact** — no wrong outcome is demonstrable today (live AI routing uses execution feedback, prior audit
F-R4); the risk is an availability decision made against the wrong health source. Naming/ownership issue with
a latent correctness edge → **C**.

**Smallest safe correction** — documentation, not types: a doc-comment on each producer (`ProviderHealth`
orchestrator adapters: "config-readiness axis") and each gate ("consumes registry/measured axis"), plus one
named helper (`isMeasurableHealthy(status)`) where a gate crosses axes. Do **not** merge the two sources.

**Regression criteria** — a characterization test per adapter documenting which axis its `getHealth()` reports,
so a future adapter cannot silently switch axes.

---

### F-5 [C] — Four different contracts export the identifier `ProviderStatus`

**Evidence** — §2.1 (S-1…S-4) plus web mirrors (`api-client.ts:843`, `provider-ux.ts:209/:235`) and the prior
audit's PV-6/PV-7/PV-8. §3.5 shows **no crossover is possible or present**: each concept is structurally
disjoint and import-isolated.

**Root cause / impact** — pure naming. The concrete historical cost is already recorded: G-01's `'unhealthy'`
slipped into S-1 precisely because "status" read as a free-for-all (`HEALTH-CONTRACT-AUDIT` F-U2). No current
wrong render, no compile error, no runtime crossover. One related spelling duplication: the health vocabulary
is re-stated **inline** in `ProviderHealthDTO.status` (`'healthy' | 'degraded' | 'unstable' | 'down'`,
`packages/services/src/ai/AIDTO.ts:175-177`) instead of referencing `ProviderStatus`, so a future union change
would leave the wire DTO silently diverging.

**Smallest safe correction** — one axis doc-comment on each of the four declarations (`/** Provider runtime
health … */`, `/** Marketplace installation status … */`, `/** Provider connection state (computed) … */`,
`/** Mission capability availability … */`) — 4 lines, zero behavior change. A rename
(`MarketplaceProviderStatus`, `ProviderConnectionView`, `MissionProviderAvailability`) is correct but is a
mechanical cross-package refactor with no behavioral payoff (§6).

**Regression criteria** — an ESLint restriction (e.g. `import/no-restricted-paths` or a `no-restricted-imports`
entry) that forbids importing the marketplace/mission `ProviderStatus` outside their own module, so a future
crossover fails lint instead of relying on structure.

---

### F-6 [C] — `availability` names three different types (including the health union)

**Evidence** — §2.3. `execution-strategy` stores S-1 in a field called `availability`
(`strategy-types.ts:110`) and then reasons about it as health (`RiskEngineService.ts:60`
`anyUnhealthy = candidates.some(c => c.availability !== 'healthy')`), while `providers` uses `availability` as
a 0–1 number and `ProviderExperienceService` uses a 5-value enum.

**Impact** — no type crossing is possible (different packages, different types), but every reader must check
the declaration to know which of three meanings a `.availability` access has. Advisory ranking only (static
seeds — prior audit F-R3), so no live routing impact.

**Smallest safe correction** — rename the `execution-strategy` field to `healthStatus` (its actual type), or
document it inline; keep the numeric and enum ones as they are.

**Regression criteria** — type-level/lint guard is unnecessary; a single unit test asserting
`RiskEngineService` treats `'degraded'`/`'down'` distinctly is enough to pin the semantics.

---

### D-1 [D] — Marketplace installation status (S-2): UI use not demonstrable

`marketplace.getMarketplace` returns `MarketplaceSnapshotDTO` including `providers[].status` (S-2 values), and
`MarketplaceViewModelFactory.ts:80` consumes it server-side, but a search of `apps/web/src` found **no
reference** to any S-2 field (`installedAt|isDefault|apiEndpoint|MarketplaceProvider|activeProviders` → 0
matches); the marketplace page renders asset install status instead
(`apps/web/src/app/marketplace/page.tsx:195-215`, `asset.status === 'Installed'` — a different vocabulary).
**Missing evidence:** whether any UI ever displays S-2, or whether it is server-only metrics. No action can be
recommended until that is observed; nothing indicates a defect.

---

## 5. Verified-correct boundaries (explicitly _not_ findings)

- **Connection vs health separation (S-3 / PV-7)**: `ProviderSetupOrchestrator` never consults S-1 (prior audit
  F-O2); `ProviderReadinessModel` orders `enabled → credential → execution evidence → quota → health` and
  states health may only downgrade (`:180-196`, `:267-270`). The UI connection chip folds PV-7 + enablement
  only (`providerStatusDisplay`, `provider-ux.ts:256-269`).
- **Fabric bridge (PV-3)**: the G-05A fix is type-safe end to end — typed port member
  (`ProviderBridge.ts:63`), exhaustive switch over S-1 (`:38-49`), regression tests feeding `'down'` and
  `'unstable'` (`integration.test.ts`, tests _"records a registry-down provider as a failure…"_ /
  _"records a registry-unstable provider as a failure…"_, helper typed to canonical members at `:114-137`).
  The remaining fail-open (`ProviderRouter.findCandidates` treats `'unknown'` as available, `:190,:214`) is
  **dormant in production and already tracked as G-17** — not re-reported here.
- **Fleet accounting**: G-05E made `fleetHealth`/`availabilityTier` fail closed for unrecognized statuses
  (tests `…unrecognizedStatus('unhealthy')` → `unstableCount` / `risk`).
- **Readiness**: F-U1 is fixed (fail-closed, `AiReadinessModel.test.ts:117-120`).
- **Marketplace installation status**: fully confined (§3.2) — its name collision has produced no crossover.
- **HealthRouter vocabulary** (F-O1) and **infrastructure health** (HW-1/HW-2/HW-8) remain internally
  consistent and disconnected from S-1.

---

## 6. Migration & compatibility risk of the alternatives

| Change                                                                            | DB risk                                                                                                                                      | API/wire risk                                                                                                                         | Code churn                                                                                                                                                           | Verdict                                                                                                 |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Add `'unknown'` to the canonical union (S-1)                                      | **High** — `providers.health` JSONB rows and every exhaustive `switch` (`ProviderBridge`, `ProviderHealthService`, readiness) change meaning | `ProviderHealthDTO.status` value set changes (`AIDTO.ts:177`)                                                                         | high                                                                                                                                                                 | **Rejected** by brief and by this audit                                                                 |
| Merge the four `ProviderStatus` into one canonical type (G-05's original wording) | n/a                                                                                                                                          | n/a                                                                                                                                   | would force `connectionState`, `available` and `active` into one union — i.e. **delete the axis information**                                                        | **Rejected** — they are four axes, not four spellings of one                                            |
| Rename non-health `ProviderStatus` exports (S-2/S-3/S-4)                          | none (type-level only)                                                                                                                       | none — field names and string values (`connectionState`, `status`) are unchanged                                                      | imports across `packages/mission-controller`, `packages/mission-runtime` (+ stale generated `packages/mission-runtime/compiled/*.d.ts`), `services/api`, tests, docs | **Deferred** — mechanical, zero behavior change, conflicts with the current "no source changes" posture |
| F-1 fix (boolean expression)                                                      | none                                                                                                                                         | none (boolean stays boolean)                                                                                                          | 1 line + tests; benchmark **fixtures** hard-code `configured` values but do not derive them                                                                          | **Safe — recommended**                                                                                  |
| F-2 fix (exhaustive ladder + membership gate)                                     | none                                                                                                                                         | none (same 5-value enum)                                                                                                              | ~10 lines + tests                                                                                                                                                    | **Safe — recommended**                                                                                  |
| F-3 fix (`getHealth()` ← `isHealthy()`)                                           | none                                                                                                                                         | `status` value for keyless adapters changes `healthy → down` — **more honest**; ops surfaces and mission availability become stricter | 3 adapters + tests                                                                                                                                                   | **Safe — recommended** (behavioral only for the unregistered-key edge)                                  |

DB/API compatibility constraint that matters: **only S-1 persists** (JSONB) and **only S-3/S-1 cross the wire as
strings the UI switches on**. None of the recommended fixes changes a persisted or wire value except F-3's
`healthy → down` for keyless adapters, which is the intended correction.

---

## 7. Recommendation — minimal strategy

**Chosen: "Introduce narrowly scoped domain-specific handling and explicit mappings where real semantic
confusion is confirmed" — scoped to the interpretation seams only.** Concretely:

> **Implementation status (G-05G, 2026-10-10).** Item 2: **F-1 implemented**
> (`CapabilitySourcePorts.ts:123-124`, covered by `GatewayPorts.test.ts`); **F-3 implemented**
> (`DeepSeek`/`GoogleGemini`/`VercelAI` `getHealth()` ← `isHealthy()`); **F-2 implemented** in
> `ProviderExperienceService.ts:208-224` but its test currently **fails to transform** because of a
> **pre-existing** broken edit in that file (orphaned comment fragment + stray `} as const;` near lines 67-68) —
> runtime verification **blocked**, not passing. Items 1, 3 and 4 remain as recommended (further verification of
> F-2 and the doc-comment work are open). No score or severity is changed by this note.

1. **Keep all four `ProviderStatus` declarations and the canonical `@vedmoulya/ai` union exactly as they are.**
   The type-level ownership is sound (§3.5); renaming or merging them would be churn without behavior change,
   and merging would be actively wrong.
2. **Fix the three confirmed seams** (in this order): F-1 (Class A — one boolean, decide option 1 vs 2),
   F-2 (Class B — fail-closed switch + membership gate), F-3 (Class B — `getHealth()` ← `isHealthy()`).
   Each is XS/S, changes no wire or DB contract, and has a regression criterion in §4.
3. **Document the axis** on the four declarations (F-5, 4 doc-comments) and on the two producer families
   (F-4, orchestrator = config-readiness axis, registry = measured axis).
4. **Defer**: export renames (S-2/S-3/S-4), the `execution-strategy` field rename (F-6), and any
   cross-axis health unification. Revisit only as part of G-17 (composing the fabric router), which already
   requires explicit, fail-closed mappings in both directions.

**Explicitly rejected options**

- _Keep contracts unchanged / naming causes no material problem_ — rejected: F-1 is a confirmed contradictory
  behavior and F-2/F-3 are live-risk seams; naming is not the whole story.
- _Rename every occurrence globally / define one canonical provider-state type (G-05 as originally worded)_ —
  rejected: four different axes, no crossover exists, migration risk (JSONB, wire strings, exhaustive
  switches, stale `compiled/` artifacts) with no demonstrated behavioral benefit.
- _Change the canonical union for consistency_ — rejected by brief and by §6.

---

## 8. Focused test plan

| #   | Test                                                                                                                         | Covers      | Location suggestion                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------- |
| 1   | Four-pair matrix for `configured`: `(healthy,active) (healthy,deprecated) (down,active) (down,retired)` → chosen verdicts    | F-1         | `services/api/src/__tests__/GatewayPorts.test.ts` (extend the two existing tests)  |
| 2   | Cross-port parity: `CapabilitySourcePorts` vs `RuntimePorts` verdicts identical on the four pairs                            | F-1         | same file                                                                          |
| 3   | `deriveAvailability` with `'unhealthy'`, `'active'`, `'critical'`, `''` → never `AVAILABLE`/`LIMITED`                        | F-2         | `services/api/src/__tests__/ProviderExperienceService.test.ts`                     |
| 4   | Row parity: unrecognized status ⇒ `deriveProviderReadiness` and `deriveAvailability` never disagree on available/unavailable | F-2         | `AiReadinessModel.test.ts` or the experience test                                  |
| 5   | `BrainPorts`: unrecognized health status ⇒ no `KNOWN` availability fact; `'unknown'` behavior unchanged                      | F-2         | `GatewayPorts.test.ts` (existing fixture at `:212`)                                |
| 6   | Per-adapter: `getHealth().status` agrees with `isHealthy()` for keyless + keyed construction (all 7 adapters)                | F-3         | `services/orchestrator/src/providers/__tests__/` (extend the G-01 membership test) |
| 7   | Mission availability: an unregistered-key adapter never appears in `capableProviders`                                        | F-3         | `packages/mission-runtime` adapter tests                                           |
| 8   | Characterization: each adapter's `getHealth()` axis (config vs measured) documented by test                                  | F-4         | adapter tests                                                                      |
| 9   | Lint/import guard: non-health `ProviderStatus` exports importable only from their module                                     | F-5         | eslint config                                                                      |
| 10  | Keep existing green: `ProviderHealthService` (G-05E), `AiReadinessModel` (F-U1), fabric F-R1 tests (G-05A)                   | regressions | unchanged                                                                          |

Baseline for these suites in the current (unmodified) tree, run during this audit:
`GatewayPorts.test.ts` (91) + `ProviderExperienceService.test.ts` (19) + `AiReadinessModel.test.ts` (17) →
**127 passed, exit 0**.

---

## 9. Evidence — commands and outcomes (all read-only)

| Command / action                                                                                                                                                                                                                                              | Outcome                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git branch --show-current` · `git rev-parse HEAD` · `git diff --cached --stat` · `git status --short` · `git diff --stat`                                                                                                                                    | `main` · `bdbe6111dbb1e596540ff5b783d74f869d44690c` · empty (0 staged) · 56 lines (26 M + 30 `??`) · `26 files changed, 1445 insertions(+), 67 deletions(-)` — exit 0                                                                                                                                                                                                                                                                                                        |
| `code_search` (ripgrep) — ~20 pattern queries (declaration sites, `import type { … ProviderStatus`, `as ProviderStatus`, `'unhealthy'`, `.availability`, `configured`, `getAllProviderHealth`, `recordHealthSample`, producers, casts, marketplace/UI fields) | all executed; **no cross-domain assignment or cast found** (§3.5)                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2 × `code_search` with the `cwd` parameter                                                                                                                                                                                                                    | **failed** with a tooling error (`ENOENT … rg.exe` — vendored ripgrep not found); retried immediately with equivalent `-g` filters — no coverage gap                                                                                                                                                                                                                                                                                                                         |
| `read_files` windows on ~40 source/test files                                                                                                                                                                                                                 | inventory + producer/consumer traces above                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `npm run typecheck` (prints `tsc -b && tsc --noEmit -p services/api`)                                                                                                                                                                                         | **EXIT = 0**, no diagnostics (`EXIT=$?` captured directly from the command, not from a filtered pipe). **No generated file was written**: the newest `.tsbuildinfo` is `packages/providers` 11:25:29, the newest `dist` artifact is `packages/mission-runtime` 09:25:09, and `packages/mission-runtime/compiled` newest = 10-09 — all predate the run (~11:45), so `tsc -b` found the build up to date and emitted nothing. Git state re-verified identical afterwards (§10) |
| `cd services/api && npx vitest run src/__tests__/GatewayPorts.test.ts src/__tests__/ProviderExperienceService.test.ts src/__tests__/AiReadinessModel.test.ts`                                                                                                 | **3 files / 127 tests passed**, `PIPESTATUS[0] = 0`                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `rm -f .fu2-typecheck.log`                                                                                                                                                                                                                                    | temporary log of the typecheck removed so the audit's only created file is this report                                                                                                                                                                                                                                                                                                                                                                                       |

**Not run:** full test suites and lint (no production source changed; the relevant suites were run instead),
any Postgres/live/browser check (see §11).

---

## 10. Initial vs final Git state

|                                                      | Initial (§1)                                                                                                                                                                                                        | Final (after this report)                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| branch / HEAD                                        | `main` / `bdbe6111dbb1e596540ff5b783d74f869d44690c`                                                                                                                                                                 | **identical**                                                                                                                                                                                                                                                                                   |
| staged                                               | 0                                                                                                                                                                                                                   | **0**                                                                                                                                                                                                                                                                                           |
| modified tracked files                               | 26 (`1445` insertions / `67` deletions)                                                                                                                                                                             | **26, same set, same stat**                                                                                                                                                                                                                                                                     |
| untracked                                            | 30 paths (`_rev001-live/`, `_rev002a-live/`, `_rev004a-live/`, `docs/audits/2026-10-10-full-audit/`, `.rev004a-gate.*`, `.tmp-*`, `scripts/revenue-*.ts`, `packages/mission-runtime/{compiled,.out}`, new tests, …) | same 30 paths + **this report** (`docs/audits/2026-10-10-full-audit/F-U2-STATUS-OWNERSHIP-AUDIT.md`) — the sole addition. Git reports the audit directory collapsed (`?? docs/audits/2026-10-10-full-audit/`), so the raw line count stays **56** (26 modified + 30 untracked) in both captures |
| resets/cleans/stashes/restores/stages/commits/pushes | none                                                                                                                                                                                                                | none                                                                                                                                                                                                                                                                                            |

_(Final capture is taken with this file present; the delta is exactly this report.)_

---

## 11. Limitations

- Static/source-derived only: no live provider call, deployed monitor, or browser session was exercised.
  "Contradicts on screen" claims (F-1, F-2) are code-path proofs over the same input row, not screenshots.
- F-2's trigger (an out-of-contract persisted status) was not reproduced against a real database in this audit;
  its reachability rests on G-05E's documented hydration path (`PostgresProviderRepository.ts:122`).
- F-3's exposure is latent: registration gating was read from EPIC-019 documentation and
  `registerPlatformProviders` references, not exercised by a run.
- D-1 remains open: S-2's UI exposure was searched, not observed.
- This report deliberately implements **no fix**; F-1 needs an owner decision between its two correction options
  before any edit.

---

## 12. G-05G reconciliation addendum (2026-10-10)

- **Deliverable complete.** This document is the F-U2 deliverable and is present in
  `docs/audits/2026-10-10-full-audit/`; F-U2 is **not pending**.
- **Seam-fix status (see §7 header and `HEALTH-CONTRACT-AUDIT.md` §11.2):** F-1 implemented; F-3 implemented;
  F-2 implemented but **runtime-unverified** because `services/api/src/services/ProviderExperienceService.ts`
  currently has a **pre-existing** syntax defect (orphaned comment fragment + stray `} as const;` near lines 67-68)
  that blocks its test transform. This is a source-tree issue outside a documentation-only task's scope.
- **Nothing in §2–§6 was retracted:** the four-`ProviderStatus` analysis, the S-1…S-4 axes, and the
  "no cross-domain assignment or cast" negative result remain the audit's standing conclusions.
- **§7's deferrals stand:** export renames (S-2/S-3/S-4), the `execution-strategy` field rename (F-6), and
  cross-axis health unification remain deferred, to be revisited with **G-17**, which is itself **deferred and
  uncomposed in production** (not fixed).
