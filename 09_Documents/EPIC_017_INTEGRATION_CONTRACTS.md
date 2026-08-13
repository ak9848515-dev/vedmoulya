# EPIC-017 — VedMoulya Live Intelligence Bridge: Integration Contracts

**Status:** IMPLEMENTED (2026-08-11)

This document defines the exact contracts between the Bridge and the existing
ecosystem. Every port is a thin facade over an EXISTING application service —
the Bridge never reaches inside another engine.

---

## 1. Contract principles

1. **One source seam** — `BrainCandidatePort` and `BrainPreferencePort` are the
   SAME interfaces the Brain and Ecosystem Intelligence already use. The bridge
   re-exports them; there is exactly ONE candidate/preference seam in the
   platform.
2. **Evidence-first** — no port call fabricates values; `UNKNOWN` is a valid
   result and propagates honestly.
3. **Owner-scoped** — every method takes `userId`; foreign records are
   unreachable by construction (IDOR-safe).
4. **No secrets** — credentials never cross a port boundary and never appear in
   any returned object, log, or prompt.
5. **Fail-closed** — a failed or missing dependency yields an explicit
   error/UNKNOWN, never a degraded silent result.

## 2. Bridge ports (`src/contracts/bridge-ports.ts`)

### 2.1 `BridgeClockPort`

```ts
interface BridgeClockPort {
  now(): string; // ISO-8601
  timestampMs(): number;
}
```

Adapter: frozen `SystemClock` (`@vedmoulya/loop-engine`).

### 2.2 `BridgeBrainPort` (EPIC-016)

Thin facade over `BrainApplicationService`:

```ts
createTask(userId, objective)                      → { success, data?: BrainTask, error?, code? }
plan(userId, taskId)                               → { success, data?: BrainTask, error?, code? }
selectResources(userId, taskId)                    → { success, data?: BrainTask, error?, code? }
requestApproval(userId, taskId, action)            → { success, data?: BrainTask, error?, code? }
approve(userId, taskId, action) / reject(...)      → { success, data?: BrainTask, error?, code? }
execute(userId, taskId) / verify(userId, taskId)   → { success, data?: BrainTask, error?, code? }
evaluateOutcome(userId, taskId, accepted)          → { success, data?: BrainTask, error?, code? }
getStatus(userId, taskId) / listTasks(userId)      → { success, data?, error?, code? }
```

Used for UNDERSTAND (createTask + plan) and the intent (domain, qualityTarget,
privacyRequirement, authorizedActions).

### 2.3 `BridgeIntelligencePort` (EPIC-015)

Thin facade over `EcosystemIntelligenceApplicationService`:

```ts
findBetterOption(userId, capability, ctx)   → Promise<TaskIntelligenceResult>
findFreeAlternative(userId, capability)     → { free, name?, providerId?, quality?, note? }
findLocalAlternative(userId, capability)    → LocalModelInfo[] | { available: false, note }
findGitHubCapability(userId, capability)    → { found, items[], note? }
findBetterProvider(userId, capability)      → { better, current?, recommended?, note? }
evaluateSecurity(userId, resourceId)        → { state, evidence[] }
evaluateLicense(userId, facts)              → LicenseIntelligence
respondToRecommendation(userId, recId, action) → { state, recommendationId?, error? }
notify(userId, opts)                        → IntelligenceNotification | { dropped, reason }
```

`TaskIntelligenceEngine` applies the quality-first hierarchy with a
material-improvement margin of 8 quality points — cost never overrides a required
quality threshold.

### 2.4 `BridgeMarketplacePort` (EPIC-013)

```ts
plan(userId, request: CapabilityPlanRequest)      → Promise<FactoryCapabilityPlan>
getPlan(userId, planId)                           → Promise<FactoryCapabilityPlan | undefined>
```

The `FactoryCapabilityPlan` is the exact contract handed to EPIC-014 execution.

### 2.5 `BridgeExecutionPort` (EPIC-014)

```ts
start(ownerId, planId)                        → { success, data?: ExecutionRun, error? }
approve(ownerId, executionId, stepId, note?)  → { success, data?: ExecutionRun, error? }
reject(ownerId, executionId, stepId, note?)   → { success, data?: ExecutionRun, error? }
completeHandoff(ownerId, executionId, stepId, note?) → { success, data?, error? }
get(ownerId, executionId) / list(ownerId)     → { success, data?, error? }
```

Execution stays bounded (frozen `RunBudgetGuard`), verified (`StepVerifier`),
and honest (manual/configure/external steps are never auto-executed).

### 2.6 `BridgeAiWorldPort` (EPIC-012C + EPIC-015 surface)

```ts
emit(userId, event: BridgeNotificationEvent) → { emitted, reason? }
unreadCount(userId)                          → number
```

The gateway adapter maps bridge event kinds onto the EXISTING notification
vocabulary (`BETTER_PROVIDER_DISCOVERED`, `FREE_QUOTA_INCREASED`,
`PROVIDER_UNAVAILABLE`, `USEFUL_GITHUB_PROJECT`, `PROVIDER_RETIRED`,
`SECURITY_WARNING`, `LOCAL_MODEL_SUITABLE`, `PAID_TOOL_MATERIALLY_BETTER`) and
feeds the existing relevance gate — **no new notification system**.

### 2.7 Reused seams (re-exported, never duplicated)

```ts
type BrainCandidatePort;   // providerCandidates / discoveryCandidates / localModelCandidates
type BrainPreferencePort;  // record({ executionId, stepId, source, fact, provider,
                           //          capability, reason, confidence })
```

### 2.8 `BridgeLoopStore`

```ts
save(loop) / get(userId, loopId) / list(userId);
```

Owner-scoped `InMemoryBridgeLoopStore` (bounded, FIFO eviction per owner).

## 3. Structured view models

### `BridgeCandidate` (Phase 1 shape)

`candidate · capability · provider · model · integrationType · quality ·
qualityEvidence[] · taskFit · securityStatus · availability · costClass ·
freeTierStatus · localAvailability · confidence · recommendation ·
approvalRequired · source`

- `confidence`: `VERIFIED | MEASURED | PROVIDER_DECLARED | INFERRED | UNKNOWN`
- `recommendation`: `CONSIDER | RECOMMEND | IGNORE` (quality-floor derived)
- `approvalRequired`: derived for PAID / GITHUB_PROJECT / EXTERNAL_APPLICATION /
  OPEN_SOURCE / additional_permission / download / local_install.

### `BridgeComparison`

`capability · current{name, quality} · alternative(BridgeCandidate) · why[] ·
betterOptionAvailable · requiresApproval · materialImprovement`

### `BridgeRecommendation`

`id · kind · title · capability · current · recommended{name, quality, costUsd,
why[]} · acquisition · security · requires[] · cost{amountUsd, cadence} ·
freeAlternative · localAlternative · approvalRequired · state · createdAt`

Kinds: `BETTER_CAPABILITY_FOUND · USEFUL_OPEN_SOURCE_FOUND ·
FREE_LOCAL_MODEL_AVAILABLE · HIGHER_QUALITY_OPTION`.

### `BridgeOutcomeEvaluation`

`taskCompleted · quality · accuracy · validation · failures[] ·
providerPerformance[] · latencyMs · costUsd · reliability · userApproval ·
chosenCapabilityPerformedBetter · evaluatedAt`

### `BridgePerformanceFact`

`id · loopId · capability · providerId · modelId? · taskQuality · privacyBenefit ·
costBenefit · derived · recordedAt · evidence[]` — **task-specific, never a
global ranking**.

## 4. Approval contract

The Bridge recommends; policy decides; the user approves; execution performs.

- `BridgeApprovalPolicy.forCandidate(acquisition)` returns the required action
  set — the bridge NEVER calls execution without the approval gate clearing.
- Sensitive/irreversible actions reuse the existing policy vocabulary
  (purchase · subscription · deployment · publishing · sending · sharing ·
  deletion · write_access · private_repo_access · external_app_action ·
  configuration_consent).
- Declining a recommendation is recorded as evidence (`continue_with_current`)
  and is **never** inferred as a permanent financial preference.

## 5. AI World emission contract

- Only materially relevant events are emitted (`BridgeNotificationMapper` +
  existing gate threshold).
- Low-relevance events are dropped with an explicit reason — no notification
  spam.
- Emission is owner-scoped and lands in the EXISTING bell/AI World surface.

## 6. Test contracts

- Bridge package: 45/45 deterministic tests (domain + service through real ports).
- Gateway: `LiveIntelligenceBridgeRouter.test.ts` 7/7 through the real tRPC
  pipeline (auth, rate limits, handlers, IDOR refusal).
- Web: 159/159 total (bridge page + panels render through the real api-client).
- Benchmark: `npm run bridge:benchmark` **10/10 PASS** (full loop + failure cases).
- E2E: `apps/web/e2e/live-intelligence-bridge.spec.ts` real Chrome journey PASS.
