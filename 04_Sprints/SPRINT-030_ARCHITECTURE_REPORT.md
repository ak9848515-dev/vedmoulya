# SPRINT-030 — Architecture Report: The Intelligence Fabric

> VedMoulya — Autonomous Intelligence, Multi-Provider Orchestration & Continuous Operations
> Status: 🟢 IMPLEMENTED + TESTED (composition layer; real provider calls remain OPERATOR-REQUIRED)

---

## 1. Executive summary

SPRINT-030 built the **Intelligence Fabric** — a narrow orchestration/composition
layer that lets the existing VedMoulya estate and external AI providers work
together safely. It is **not** a new AI engine, a new Brain, a new Memory, a new
Execution, a new Scheduler, a new Notification, a new Budget or a new
Authorization engine. Every authority remains where it was frozen:

- approval → existing Brain `approve` authority
- execution → existing Execution bridge / budget guard
- authorization classification → existing `SENSITIVE_ACTIONS` + `ActionClassPolicy`
- cost measurement → existing `CostLedger` (trace spine)
- provider catalog → existing provider registry (`ProviderApplicationService`)
- recommendations → existing proactive layer (SPRINT-029)
- scheduling → existing cadence driver

The Fabric adds the _missing seams_: a provider-neutral orchestration contract,
deterministic selection strategies, an evidence-only runtime health ledger, a
fail-closed cost policy guard, bounded workflow validation, result
normalization, a bounded verification chain policy, and formalized autonomy
levels. All of it advisory/observational — **nothing in the Fabric executes,
spends, or authorizes anything.**

## 2. Design principles

| Principle                  | How it is honored                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| Composition over invention | Every port is implemented over an existing engine (see §4)                                         |
| Provider-neutral           | Business logic never names a provider; registration is config-driven                               |
| No fake status             | Health is UNKNOWN until real calls are observed; cost is absent until recorded                     |
| Fail closed                | Cost caps block; unknown privacy → local-only; class C/D never execute                             |
| Bounded everything         | Verification depth, parallel fan-out, task counts, provider calls all capped                       |
| Explainable                | Every selection/decision carries reasons; UI shows evidence                                        |
| No new authority           | Autonomy levels gate _advisory_ positions only; existing approval remains sole execution authority |

## 3. Architecture

```
User
 ↓
Voice / Text / UI (existing AICompanion + VoicePanel + ProactivePanel + FabricPanel)
 ↓
Intent + Context
 ↓
Brain (existing — intent interpretation, Q&A runtime, task creation)
 ↓
INTELLIGENCE FABRIC (SPRINT-030 — advisory orchestration layer)
 ├─ ProviderHealthLedger   — observed runtime health (UNKNOWN → HEALTHY/DEGRADED/UNAVAILABLE)
 ├─ SelectionStrategy      — CHEAP/FAST/QUALITY/PRIVATE/BALANCED (deterministic, advisory)
 ├─ CostPolicyGuard        — fail-closed caps over CostLedger spend (measure-only)
 ├─ WorkflowBounds         — depth / fan-out / task / call caps (no unbounded fan-out)
 ├─ VerificationChainPolicy— bounded A→critique→verify, max depth/providers/cost
 ├─ ResultNormalizer       — provider-agnostic result contract (text/JSON/tool/error)
 └─ AutonomyPolicy         — levels 0–5 mapped onto existing A/B/C/D classification
 ↓
Provider Selection (existing runtime — unchanged; registry remains authoritative)
 ↓
Execution (existing execution authority — unchanged)
 ↓
Outcome → Memory / Learning (existing — unchanged)
```

## 4. Reuse map (what the Fabric composes, never duplicates)

| Fabric piece                | Composes                                                               | Engine duplicated? |
| --------------------------- | ---------------------------------------------------------------------- | ------------------ |
| `FabricProviderPort`        | `ProviderApplicationService.listByCapability` + `ProviderHealthLedger` | No                 |
| `FabricCostPort`            | `CostLedger.compute` over the `ExecutionTrace` spine                   | No                 |
| `AutonomyPolicy`            | `ActionClassPolicy` (proactive) + `SENSITIVE_ACTIONS` (Brain)          | No                 |
| `IntelligenceFabricService` | the above ports                                                        | No                 |
| Gateway `fabric.*`          | `standardProcedure` (auth/rate-limit) + owner-scoped stores            | No                 |
| Cadence integration         | existing `startSchedulerCadenceDriver`                                 | No                 |
| UI                          | existing design system + AICompanion drawer pattern                    | No                 |

## 5. New-engine statement

**Zero new engines.** No new Brain, Memory, Execution, Authorization, Budget,
Scheduler, Notification, Voice, Learning or Agent engine was created. The only
new code is the narrow Fabric package (types + domain policies + composition
service), two gateway bridge ports, one router, one cadence hook, one panel.

## 6. What was intentionally NOT built

- Actual multi-provider task decomposition execution (needs a real provider
  pool + operator credentials; SPRINT-031)
- Autonomous background agents (forbidden by the autonomy model)
- A second provider registry or health source (registry stays authoritative)
- A second cost database (CostLedger is authoritative)
- A second approval engine (Brain approve remains the only path)

## 7. Verification

| Gate                | Result                                   |
| ------------------- | ---------------------------------------- |
| Full suite          | **8 613 passed / 1 skipped · 682 files** |
| Gateway             | 922 passed / 1 skipped · 46 files        |
| Web                 | 190 passed · 19 files                    |
| intelligence-fabric | 53 passed · 8 files                      |
| proactive           | 60 passed · 7 files                      |
| voice               | 107 passed · 6 files                     |
| Typecheck           | 0 (root + api + web + fabric)            |
| Lint                | 0 / 0                                    |
| Coverage gate       | **43 / 43** ≥ 80% (api branch 81.33%)    |
| `next build`        | PASS                                     |
| Benchmarks chain    | EXIT 0 — all harnesses PASS              |
