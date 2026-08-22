# SPRINT-025 — BASELINE AUDIT

**Continuous Learning, Outcome Memory & Adaptive Improvement**
Date: 2026-08-13 · Status: audit-complete (no code written from this document)

---

## 0. SPRINT-024 VERIFICATION (from verified reality, not docs)

| Check                            | Result                                                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Commit                           | `47fe907 feat(sprint-024): live outcome verification and real-runtime execution` present in `git log` |
| Working tree                     | clean (0 uncommitted changes)                                                                         |
| `runtime-verification-benchmark` | **36/36 PASS** (re-run, current tree)                                                                 |
| `outcome-journey-benchmark`      | **30/30 PASS** (re-run, current tree)                                                                 |
| `ai-world-scheduler-benchmark`   | 13/13 (documented; re-run in Phase 10)                                                                |
| brain + execution-bridge tests   | **176/176** (re-run, current tree)                                                                    |
| goals tests                      | **77/77** (re-run, current tree)                                                                      |

SPRINT-024 deliverable inventory (present):

- `packages/execution-bridge/src/domain/StepVerifier.ts` (with `verifyArtifacts` / `attachArtifacts`)
- `packages/execution-bridge/src/domain/ArtifactVerifier.ts` + `contracts/artifact-ports.ts` + `types/artifact-types.ts`
- `packages/execution-bridge/src/infrastructure/NodeArtifactReader.ts`
- `packages/brain/src/domain/OutcomeVerdict.ts` (`deriveOutcomeVerdict` — 6-state honest verdict)
- `packages/brain/src/__tests__/OutcomeVerdict.test.ts` (13 tests)
- `packages/execution-bridge/src/application/ExecutionRunService.ts` (opt-in artifact verification in `executeStep`)
- `apps/web/src/app/goals/problem-panel.tsx` (outcome-contract strip)
- `scripts/runtime-verification-benchmark.ts` (12 real-runtime journeys)
- `04_Sprints/SPRINT-024_{BASELINE_AUDIT,EVIDENCE,COMPLETION_REPORT}.md`

**Conclusion: SPRINT-024 is independently verified GREEN.** Its honest-verdict vocabulary (`SUCCESS / FAILED / UNKNOWN / AWAITING_APPROVAL / CANCELLED / BUDGET_EXHAUSTED`) is the confirmed entry point for this sprint.

---

## 1. EXISTING LEARNING PATH (mapped from source)

```
USER GOAL
  → createTask (IntentInterpreter → IntentProfile)            EPIC-016
  → plan (EPIC-013 FactoryCapabilityPlan)                     EPIC-016
  → selectResources (ProviderRoleAssigner; usage evidence)    EPIC-016/020
  → approval gates (BrainPolicyEngine; SENSITIVE_ACTIONS)     EPIC-016
  → execute (BrainExecutionPort → LoopEngine specialist)      EPIC-006/016
  → verify (BrainVerification; SPRINT-024 artifact checks)    EPIC-016/024
  → evaluateOutcome (OutcomeEvaluator → outcome + facts)      EPIC-016/020
      ↓
  recordLearning()                                            BrainApplicationService
      ├─ experience.recordPerformance()  → AdaptiveScoreLedger (EPIC-020 §4)
      ├─ memory.recordOutcome()          → BrainOutcomeMemory (EPIC-020 §10)
      │                                    ├─ InMemoryOutcomeMemory
      │                                    └─ PostgresOutcomeMemory (SPRINT-022)
      │                                      → memory-intelligence capture (EI-010)
      └─ opportunity.detectFromOutcome() → OpportunityStore (EPIC-020 §12)
```

### 1.1 Existing components (all confirmed in source)

- **`BrainApplicationService`** (`packages/brain/src/application/BrainApplicationService.ts`)
  - `evaluateOutcome(userId, taskId, outputAccepted, satisfaction)` → runs `OutcomeEvaluator`, saves, then `recordLearning`.
  - `recordLearning(task, accepted, satisfaction)` → three existing sinks: experience ledger, outcome memory, opportunities.
- **`OutcomeEvaluator`** (`packages/brain/src/domain/OutcomeEvaluator.ts`)
  - Produces `preferenceFacts` with `source: EXPLICIT | INFERRED` and confidence (EXPLICIT 0.95, INFERRED 0.3/0.4) — feeds the EPIC-014 preference ledger. **Already separates fact from inference in its output.**
- **`AdaptiveScoreLedger`** (`packages/brain/src/domain/AdaptiveScoreLedger.ts` + `ledger-math.ts`)
  - Recency-weighted quality per (provider × capability); **exponential decay (30-day half-life)**; `EXPLICIT > INFERRED` source; advisory only.
  - `PostgresAdaptiveScoreLedger` persists with the same pure math (SPRINT-022).
- **`BrainOutcomeMemory`** (`BrainMemoryPort.recordOutcome`; `InMemoryOutcomeMemory` / `PostgresOutcomeMemory`)
  - Owner-scoped, keyed (userId, taskId), idempotent upsert, FIFO bound 100.
  - **Captures: taskType, providers (succeeded), selectedReason, outcome (SUCCESS/PARTIAL/FAILED), costUsd, tokens, latencyMs, userAccepted, satisfaction.**
- **`BrainDashboardService`** (`services/api/src/services/BrainDashboardService.ts`) — learning feed (last 8 outcome memories) + adaptive scores → `/brain` UI.
- **`BrainLearningPanel` / `BrainLearningFeed`** (`apps/web/src/app/brain/brain-dashboard.tsx`) — renders outcome · taskType · accepted.
- **memory-intelligence (EI-010)** — full `MemoryItem` model with `confidence`, `retention`, `lifecycle`, `decay` semantics; wired into the gateway (`createBrainMemoryPort` in `BrainPorts.ts` — captures outcome as a `learning` memory). Not owner-scoped as a runtime correction store; used as the durable capture side-channel.
- **`ProviderRoleAssigner`** (`packages/brain/src/domain/ProviderRoleAssigner.ts`) — quality-first selection; **does NOT consume `scoresFor`/`bestFor`** from the experience ledger (advisory signal is currently _recorded but never re-read at selection time_).
- **Digital Twin analog** — `PersonalGraphService` (context-fabric, APP-001) is a **read-only** graph surface at the gateway (no save/update procedures exposed at runtime) — it cannot accept learning updates without new infrastructure, so it is NOT a runtime learning sink in this sprint.

### 1.2 Verification path (SPRINT-024, reused as-is)

- `StepVerifier.verifyArtifacts` + `ArtifactVerifier` + `NodeArtifactReader` (root-confined, size-bounded, read-only).
- `deriveOutcomeVerdict` — single honest verdict function, already unit-tested.
- Outcome model distinguishes: SUCCESS / FAILED / UNKNOWN / AWAITING_APPROVAL / CANCELLED / BUDGET_EXHAUSTED. **UNKNOWN never upgraded.**

---

## 2. THE GAP (smallest architectural gap preventing verified outcomes from becoming useful future intelligence)

**Two narrow gaps, both closed by extending existing components — zero new engines:**

### GAP A — Verified outcomes are not captured as _structured learning evidence with confidence_

`BrainOutcomeMemory` records _what happened_ (outcome string, provider succeeded flags, acceptance) but **not**:

- the honest verification state (`verificationPassed` / `verificationFailed`) that SPRINT-024 derives,
- the final `deriveOutcomeVerdict` (SUCCESS vs UNKNOWN — UNKNOWN outcomes are currently written as `PARTIAL` with no explicit "cannot learn from this" marker),
- separation of **FACT** (verified observation) vs **INFERENCE** (pattern) vs **UNKNOWN** (insufficient evidence) in the stored signal,
- per-signal confidence + evidence + provenance + timestamp,
- **user corrections** (there is NO runtime path for "don't use this approach again" / "that result was wrong" / "that is not my preference").

Consequence: the learning feed and the memory-intelligence capture cannot distinguish "proven" from "guessed", and the user cannot correct the system. The EPIC-014 preference ledger already accepts `EXPLICIT > INFERRED` — the missing piece is a **correction path** that routes user corrections into that same ledger with explicit authority.

### GAP B — Recorded signals are never re-read at the next decision

`AdaptiveScoreLedger.scoresFor/bestFor` exist and `providerScores` is exposed, but `ProviderRoleAssigner` (the next decision) only sees registry candidate facts. Verified historical success/failure signals (provider × capability) are **recorded but never consulted** — so "improve next decision" is structurally impossible today.

### Why the gap exists

- Outcome memory was built (EPIC-020 §10) as a _record-keeping_ store; the learning-feedback model (FACT/INFERENCE/UNKNOWN + confidence + corrections) and the decision-feedback loop were documented in the mission but never wired end-to-end.
- The frozen component boundaries are intentionally narrow; the wiring between "record learning" and "consume learning" was left as an operator gap.

### What is NOT needed (explicitly out of scope)

- No new memory engine (extend `BrainOutcomeMemory` + reuse `InMemoryOutcomeMemory`/`PostgresOutcomeMemory` + memory-intelligence capture).
- No new recommendation engine (reuse `AdaptiveScoreLedger`).
- No new decision engine (extend `ProviderRoleAssigner` selection inputs).
- No new budget/scheduler/notification/approval/execution engine.
- No ML; a **deterministic evidence-weighted model** (reuse `ledger-math` decay) is the chosen mechanism.
- No digital-twin rewrite; the personal graph stays read-only (learning flows into outcome memory + memory-intelligence capture, which ARE the twin's memory feed).

---

## 3. EXACT FILES LIKELY TO CHANGE

| File                                                                          | Change                                                                                                                                             |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/brain/src/types/continuous-types.ts`                                | Extend `BrainOutcomeMemory` with `verification` evidence, `verdict`, `signals[]`, `corrections[]`; add `LearningSignal`/`LearningCorrection` types |
| `packages/brain/src/domain/LearningSignals.ts` (new)                          | Pure `deriveLearningSignals(task, verdict)` — deterministic FACT/INFERENCE/UNKNOWN extraction                                                      |
| `packages/brain/src/application/BrainApplicationService.ts`                   | `recordLearning` uses `deriveOutcomeVerdict` + signal derivation; new `correctLearning(userId, input)` public method                               |
| `packages/brain/src/domain/ProviderRoleAssigner.ts`                           | Optional advisory `experienceScores` input (quality-first preserved, signals only break ties / inform reason)                                      |
| `packages/brain/src/application/BrainApplicationService.ts` (selectResources) | Pass `scoresFor(capability)` into role assignment as advisory signal                                                                               |
| `packages/brain/src/domain/OutcomeEvaluator.ts`                               | (unchanged — its EXPLICIT/INFERRED preference facts are already the correction-compatible feed)                                                    |
| `services/api/src/routers/BrainRouter.ts`                                     | New `brain.correctLearning` procedure (auth + rate-limit)                                                                                          |
| `services/api/src/services/BrainDashboardService.ts`                          | Extend learning feed rows with verdict/source/confidence + corrections                                                                             |
| `services/api/src/services/RouterRegistry.ts`                                 | Zod schema for `correctLearning` input                                                                                                             |
| `apps/web/src/lib/api-client.ts`                                              | `useBrainCorrectLearning` hook + dashboard DTO fields                                                                                              |
| `apps/web/src/app/brain/brain-dashboard.tsx`                                  | `BrainLearningPanel`: source labels (You told me / I observed / I inferred), confidence, corrections, correct affordance                           |
| `scripts/learning-benchmark.ts` (new)                                         | 15 real-architecture learning journeys                                                                                                             |
| `eslint.config.js`                                                            | Script exemption (benchmark convention)                                                                                                            |
| `package.json`, `.github/workflows/ci.yml`, `.github/workflows/release.yml`   | `learning:benchmark` chain                                                                                                                         |
| Tests                                                                         | `packages/brain/src/__tests__/LearningSignals.test.ts`, `ContinuousIntelligence.test.ts` additions, `BrainApplicationService.test.ts` additions    |
| Docs                                                                          | SPRINT-025 BASELINE_AUDIT / EVIDENCE / COMPLETION_REPORT + CHANGELOG / task_progress / PROJECT_STATUS / MASTER_ROADMAP / README                    |

---

## 4. ARCHITECTURAL CONSTRAINTS (binding)

1. **No new engines.** Extend `BrainOutcomeMemory`, `AdaptiveScoreLedger`, `ProviderRoleAssigner`, `BrainApplicationService` — the frozen component set.
2. **Honesty invariants** (SPRINT-024, carried forward):
   - UNKNOWN stays UNKNOWN; a COMPLETED task whose verification FAILED is FAILED (verification wins).
   - AI/provider output is NEVER trusted as user fact.
   - Corrections must be EXPLICIT user input — never inferred.
3. **EXPLICIT > INFERRED**: user corrections outrank weak system inference (existing ledger semantics — reuse, don't rebuild).
4. **Learning cannot override**: security, approval, budget, quality requirements, user constraints, system policies. Signals are advisory.
5. **Owner isolation**: every read/write keyed by `userId`; IDOR refused at the service boundary AND the gateway.
6. **Memory pollution prevention**: one observation is a FACT/weak INFERENCE — never a permanent belief. Repeated verified evidence strengthens a signal; decay weakens stale ones.
7. **No sensitive data**: store decisions/evidence references/provenance only — never chain-of-thought, never credentials, never raw artifacts.
8. **No arbitrary code/path execution**; verification stays on the SPRINT-024 constrained reader.
9. **No self-modifying production code**; no autonomous policy mutation.
10. **Deterministic benchmark** (hermetic, fixed clock, scripted ports) — follows the established `require-await` exemption convention.

---

## 5. SECURITY IMPLICATIONS

- **Untrusted AI output ≠ trusted user fact**: signals derived from provider outputs are INFERENCE unless independently verified (SPRINT-024 artifact verification). The deriver marks FACT only when verification passed.
- **User corrections are the ONLY new write surface** — they are authenticated (session user), owner-scoped, rate-limited, length-bounded, and written as `EXPLICIT` with `source='explicit_user_correction'`; a correction cannot reference another user's data (IDOR at service + gateway).
- **No new secrets surface**: corrections store text facts only; no tokens, no artifacts, no credentials.
- **Cross-user learning impossible**: all stores keyed by owner; benchmark journey 11 asserts it.
- **Decay bounds influence**: stale signals lose weight via the existing 30-day half-life (no new mechanism).

---

## 6. ACCEPTANCE CRITERIA (from the sprint gate, mapped)

- [x] SPRINT-024 status independently verified (Section 0)
- [ ] Verified outcomes produce structured learning evidence (Gap A)
- [ ] FACT / INFERENCE / UNKNOWN separated in stored signals (Gap A)
- [ ] Existing memory architecture reused (BrainOutcomeMemory + memory-intelligence capture)
- [ ] Memory pollution prevented (one observation ≠ permanent belief; confidence thresholds; FIFO)
- [ ] Digital Twin uses only evidence-backed signals (outcome-memory feed is the twin's memory channel; personal graph stays read-only)
- [ ] Decision intelligence can use verified historical signals (Gap B — assigner advisory input)
- [ ] User corrections override weak inference (EXPLICIT > INFERRED via existing ledger)
- [ ] Learning has confidence/evidence semantics (per-signal confidence + ledger weights)
- [ ] Stale learning does not remain permanently authoritative (ledger decay reused)
- [ ] Cross-user learning impossible (owner-scoped + journey 11)
- [ ] AI output cannot directly become trusted user fact (verification-gated FACTs + journey 12)
- [ ] Security/approval/budget override learning (policy gates untouched + journeys 14–15)
- [ ] UNKNOWN remains UNKNOWN (verdict-derived signals + journey 3)
- [ ] Existing SPRINT-023/024 tests remain GREEN (no weakened assertions)
- [ ] New learning benchmark passes (15 journeys)
- [ ] Typecheck = 0 · Lint = 0 · No secrets · Git diff reviewed · No duplicate engines · Committed
