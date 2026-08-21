# SPRINT-030 — Test Report

> Exact numbers from actual command runs. No fabricated counts.

---

## 1. Full suite (root, `npx vitest run`)

```
Test Files  682 passed (682)
Tests       8613 passed | 1 skipped (8614)
```

## 2. Per-workspace results (each `npx vitest run` in its own directory)

| Workspace                          | Tests      | Files     |
| ---------------------------------- | ---------- | --------- |
| services/api (gateway)             | 922 passed | 1 skipped | 46  |
| apps/web                           | 190 passed | 19        |
| packages/intelligence-fabric (NEW) | 53 passed  | 8         |
| packages/proactive                 | 60 passed  | 7         |
| packages/voice                     | 107 passed | 6         |

## 3. New tests added by SPRINT-030

**packages/intelligence-fabric (53 tests, 8 files)**

- `ProviderHealthLedger.test.ts` — UNKNOWN honesty, HEALTHY/DEGRADED/UNAVAILABLE
  derivation, bounded observations, quota → UNAVAILABLE
- `CostPolicyGuard.test.ts` — per-cap enforcement, exhausted-bucket
  identification, fail-closed, no fabricated zero-spend
- `AutonomyPolicy.test.ts` — class→level mapping, class B auth-record gate,
  single-step transitions, class D never, unknown-level fallback
- `SelectionStrategy.test.ts` — 5 strategies, privacy-override, determinism,
  empty-candidate honesty
- `VerificationChainPolicy.test.ts` — verdicts, disagreement → NEEDS_REVIEW,
  depth/cost/providers termination
- `WorkflowBounds.test.ts` — every bound, fail-closed overflow
- `ResultNormalizer.test.ts` — text/json/tool/error kinds, secret redaction
- `IntelligenceFabricService.test.ts` — composition seam

**services/api (gateway)**

- `FabricRouter.test.ts` — 8 `fabric.*` procedures through the real tRPC
  pipeline (auth/rate-limit/IDOR), incl. zod rejection
- `FabricBridgePorts.test.ts` — real CostLedger composition (owner-scoped
  snapshot, provider-filtered view, absent-when-zero), provider-DTO → candidate
  mapping, free/local/unknown honesty, empty-on-failure

**apps/web**

- `FabricPanel.test.tsx` — observed health render, honest UNKNOWN empty state,
  error + retry, autonomy-gating notice

**packages/proactive**

- added `refreshDiscovery:false` path test (cadence composition seam)

## 4. Adversarial / security tests covered

| Scenario                                                     | Where                                 |
| ------------------------------------------------------------ | ------------------------------------- |
| Malicious provider output with embedded secret → redacted    | ResultNormalizer                      |
| Provider failure → honest UNAVAILABLE / empty candidates     | HealthLedger, BridgePorts             |
| Fabricated cost → absent (undefined), never 0                | CostPolicyGuard, BridgePorts          |
| Model attempting to bypass approval (class C at low level)   | AutonomyPolicy, FabricRouter          |
| Class B without user authorization → blocked even at level 5 | AutonomyPolicy, FabricRouter          |
| Fake provider health → UNKNOWN until observed                | HealthLedger, FabricRouter            |
| Cross-owner access → IDOR rejected                           | FabricRouter (standardProcedure)      |
| Infinite workflow → bounds fail closed                       | WorkflowBounds                        |
| Unbounded parallel fan-out (10 vs max 8)                     | WorkflowBounds, FabricRouter          |
| Verification disagreement → NEEDS_REVIEW                     | VerificationChainPolicy, FabricRouter |
| Invalid zod input → rejected                                 | FabricRouter                          |
| Unknown level/state → honest fallback, no crash              | AutonomyPolicy, ResultNormalizer      |

## 5. Other gates

| Gate             | Command                                               | Result                                |
| ---------------- | ----------------------------------------------------- | ------------------------------------- |
| Typecheck        | `tsc --noEmit` (root, services/api, apps/web, fabric) | 0 errors                              |
| Lint             | `eslint . --max-warnings=0` (4096 MB heap)            | 0 / 0                                 |
| Coverage gate    | `node scripts/coverage-gate.mjs`                      | **43 / 43** ≥ 80% (api branch 81.33%) |
| Build            | `next build` (apps/web)                               | PASS                                  |
| Benchmarks chain | `npm run benchmarks`                                  | EXIT 0 — all harnesses PASS           |
