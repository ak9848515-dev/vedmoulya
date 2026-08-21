# SPRINT-030 — Provider Orchestration Report

> Multi-provider orchestration contract, selection strategies, result
> normalization, runtime health, bounded workflows. Status: 🟢 IMPLEMENTED +
> TESTED (advisory layer; live provider calls remain OPERATOR-REQUIRED).

---

## 1. Orchestration contract (`StrategyCandidate`)

Provider-neutral: business logic never names a provider. The registry
(`ProviderApplicationService.listByCapability`) remains the authoritative
catalog; the Fabric's `FabricProviderPort` maps its DTO evidence into a
normalized candidate:

```ts
interface StrategyCandidate {
  providerId: string;
  name: string;
  capabilityMatched: boolean;
  quality?: number; // undefined when unknown — never fabricated
  latencyMs?: number; // undefined when unknown
  estimatedCostUsd?: number; // undefined when unknown
  freeAvailability: 'FREE' | 'PAID';
  localAvailability: 'yes' | 'no';
  healthState: ProviderHealthState; // from the FABRIC's observed ledger
  availability?: number; // registry-declared
  evidence: string[]; // why this candidate exists
}
```

Adding provider N (1 → 10 → 100 → 1000) is a **registry configuration
change**; no Fabric code changes.

## 2. Selection strategies (deterministic, advisory)

`SelectionStrategy.select(strategy, candidates, context)` implements five
explicit strategies:

| Strategy   | Preference order                         | Privacy rule               |
| ---------- | ---------------------------------------- | -------------------------- |
| `CHEAP`    | local/free first → lowest estimated cost | private tasks → local only |
| `FAST`     | lowest latency, bounded by quality floor | private tasks → local only |
| `QUALITY`  | highest quality first                    | private tasks → local only |
| `PRIVATE`  | local/approved first, then privacy-safe  | private tasks → local only |
| `BALANCED` | weighted quality + cost + latency        | private tasks → local only |

Rules:

- **Privacy overrides cost.** A PRIVATE task never routes to a remote provider
  merely because it is cheap; with no local candidate, selection returns
  `undefined` (honest absence).
- Deterministic: same input → same selection (tested).
- **Advisory only** — the Fabric returns a recommendation; actual routing stays
  with the existing runtime, which remains authoritative.

## 3. Result normalization

`ResultNormalizer` maps any provider response shape into a single contract:

```ts
type NormalizedResult =
  | { kind: 'text'; text: string; metadata?; usage?; costUsd?; latencyMs?; providerId?; model?; confidence? }
  | { kind: 'json'; data: unknown; ... }
  | { kind: 'tool'; toolResult: unknown; ... }
  | { kind: 'error'; code: string; message: string; retryable: boolean; ... };
```

Provider-specific formats never leak into application logic. The normalizer
also **redacts secrets** from provider output text (sk-… / api keys) so a
malicious or noisy provider response can never surface credentials into logs
or prompts.

## 4. Runtime provider health (`ProviderHealthLedger`)

Evidence-only, bounded (200 observations/provider), deterministic:

| State           | Derivation                                                    |
| --------------- | ------------------------------------------------------------- |
| `UNKNOWN`       | no observations yet — never fabricated                        |
| `HEALTHY`       | ≥ 3 observations, success rate ≥ 0.9, no recent timeout       |
| `DEGRADED`      | success rate ≥ 0.6 but below HEALTHY bar, or transient errors |
| `UNAVAILABLE`   | quota_exhausted / auth errors observed                        |
| `MISCONFIGURED` | auth / config-class failures                                  |

Health is observed via the gateway `fabric.observeOutcome` procedure (real
call outcomes only). The gateway surfaces it via `fabric.getProviderHealth` /
`fabric.allProviderHealth` — the UI shows "UNKNOWN until real calls are
observed".

## 5. Bounded orchestration (`WorkflowBounds`)

Every workflow shape must pass bounds before it is even planned:

- `MAX_WORKFLOW_DEPTH` (default 8)
- `MAX_WORKFLOW_TASKS` (default 24)
- `MAX_PARALLEL_FANOUT` (default 8)
- `MAX_PROVIDER_CALLS` (default 64)
- `MAX_WORKFLOW_COST_USD` (default 5.00)
- `MAX_WORKFLOW_MS` (default 600_000)

Violations fail closed (`allowed:false` + which bound was exceeded) — no
unbounded fan-out, no infinite loops. `fabric.validateWorkflow` is the gateway
surface; tested against parallel-fan-out and call-count breaches.

## 6. Verification chain (`VerificationChainPolicy`)

Bounded multi-model verification:

```
Provider A → answer
Provider B → critique
Provider C → verify
Evidence + Agreement + Policy + Confidence → verdict
```

Hard bounds: `maxDepth` (3), `maxProviders` (3), `maxSteps` (4),
`maxLatencyMs`, `maxCostUsd`, `stopOn: ['AGREE','DISAGREE']` — deterministic
termination at every step; no unbounded AI-to-AI loops. Verdicts: `VERIFIED`
/ `NEEDS_REVIEW` / `REJECTED`. Disagreement → `NEEDS_REVIEW` (never silent
execution). `fabric.evaluateVerificationChain` is the gateway surface.

## 7. Gateway surface (`fabric.*`)

All procedures: authenticated (standardProcedure), rate-limited, owner-scoped
(IDOR-checked: input `userId` must equal the caller):

| Procedure                          | Purpose                                                       |
| ---------------------------------- | ------------------------------------------------------------- |
| `fabric.getProviderHealth`         | one provider's OBSERVED health                                |
| `fabric.allProviderHealth`         | all observed providers                                        |
| `fabric.observeOutcome`            | record ONE real call outcome (success/failure/timeout/quota…) |
| `fabric.checkCostPolicy`           | fail-closed cap check vs recorded spend                       |
| `fabric.classifyAutonomy`          | autonomy gate over existing A/B/C/D                           |
| `fabric.selectStrategy`            | advisory strategy ranking                                     |
| `fabric.validateWorkflow`          | bounded orchestration shape check                             |
| `fabric.evaluateVerificationChain` | bounded A→critique→verify verdict                             |

## 8. Cost intelligence

`CostPolicyGuard` enforces caps over **measured** spend (`FabricCostPort` →
`CostLedger.compute` over the trace spine):

- `maxTaskCostUsd`, `maxDailyCostUsd`, `maxProviderCostUsd`,
  `maxWorkspaceCostUsd` (configurable; defaults 1 / 10 / 5 / 20)
- unknown spend → treated as 0 (measured truth; never estimated into existence)
- breach → `allowed:false` + the exhausted bucket (`task`/`daily`/`provider`/`workspace`)
- enforcement is advisory at the Fabric layer; the **existing `RunBudgetGuard`
  remains the authoritative execution-time budget** (SPRINT-014, untouched)

## 9. Tests

- `SelectionStrategy.test.ts` — 5 strategies, privacy-override, determinism,
  empty-candidate honesty
- `ProviderHealthLedger.test.ts` — state derivation, bounded observations,
  UNKNOWN honesty, quota → UNAVAILABLE
- `WorkflowBounds.test.ts` — every bound, fail-closed overflow
- `VerificationChainPolicy.test.ts` — verdicts, disagreement → NEEDS_REVIEW,
  depth/cost termination
- `ResultNormalizer.test.ts` — text/json/tool/error kinds, secret redaction
- `CostPolicyGuard.test.ts` — caps, buckets, fail-closed
- `FabricBridgePorts.test.ts` (gateway) — real CostLedger composition,
  provider-DTO mapping, empty/unknown honesty
- `FabricRouter.test.ts` (gateway) — 8 procedures through the real tRPC
  pipeline incl. zod rejection
