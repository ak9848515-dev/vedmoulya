# SPRINT-024 — LIVE OUTCOME VERIFICATION & REAL-RUNTIME EXECUTION — BASELINE AUDIT

**Date:** 2026-08-12 · **Phase:** 0 (audit before coding)
**Scope:** Move outcome verification from primarily hermetic/scripted proof toward
**real runtime artifact verification**, preserving the existing architecture and its
fail-closed / honest behavior. No new engine, budget, scheduler, notification,
approval, or execution system may be created.

---

## 1. Current verification flow

The composed problem→outcome pipeline (proven in SPRINT-023) is:

```
Problem (raw) → ProblemDefinition (SPRINT-023) → Goal → validated task DAG
→ FactoryCapabilityPlan (EPIC-013) → BrainApplicationService (EPIC-016/020)
→ provider allocation → approval → bounded execution → verification → outcome
```

Two verification surfaces exist today, and **both are text-content based (hermetic)**:

### 1.1 Brain verification — `BrainApplicationService.verify` (EPIC-016 §6)

- Checks: `execution completed` (`providerOutputs.length > 0`), `no abstention
without reason`, `evidence policy`, `no unresolved material conflict`.
- Success = a provider returned **text output** + no conflicts.
- **It never inspects a real on-disk artifact.** The provider's `content` string is
  trusted as the deliverable.

### 1.2 Execution-bridge verification — `StepVerifier` (EPIC-014 §2)

- `pre()` — capability / runtime-capability / availability / configuration /
  evidence / budget / approval / dependencies.
- `post()` — `execution-completed` (`result.ok`), `output-exists` (non-empty),
  `output-contract` (≥ 20 chars), `validation` (no runtime rejection).
- Again operates on `StepExecutionResult.content` — a reported string, not a
  physical artifact.

### 1.3 Implication

The current model satisfies "execution + expected output + validation = success"
but NOT "independent inspection of the real artifact". A provider (or adapter) that
**claims** `"file created"` in `content` would pass verification even when the file:

- does not exist on disk,
- is empty,
- is malformed (invalid JSON/CSV),
- contains a wrong calculated value.

This is exactly the gap SPRINT-024 closes: **the verifier must inspect the actual
evidence, independent of the execution claim.**

---

## 2. Existing ports

| Port                                                                                                                                     | Location                                                     | Purpose                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------- |
| `StepExecutionPort`                                                                                                                      | `packages/execution-bridge/src/contracts/execution-ports.ts` | ONLY provider/tool seam; `execute()` + `availability()`. |
| `ExecutionRunStore`                                                                                                                      | same                                                         | owner-scoped run persistence.                            |
| `PreferenceLedgerPort`                                                                                                                   | same                                                         | provenance-preserving preference facts.                  |
| `ClockPort`                                                                                                                              | same                                                         | frozen `SystemClock` compatible.                         |
| `BrainPlanPort / BrainCandidatePort / BrainExecutionPort / BrainContextPort / BrainPreferencePort / BrainTaskStore / BrainDecisionStore` | `packages/brain/src/contracts/brain-ports.ts`                | Brain → frozen estate.                                   |
| `BrainUsagePort / BrainExperiencePort / BrainMemoryPort / BrainDiscoveryBridgePort`                                                      | same (EPIC-020)                                              | continuous intelligence.                                 |
| `SpecialistExecutionPort`                                                                                                                | `@vedmoulya/loop-engine`                                     | frozen runtime specialist execution.                     |

There is **NO artifact/result port** today — no narrow seam to read a produced file
within an approved boundary. This is the smallest missing capability.

---

## 3. Existing runtime boundaries (must be preserved)

- **Budget:** `BrainBudgetGuard` (EPIC-016 §22) + frozen `LoopBudget`
  (`@vedmoulya/loop-engine`) are the ONLY budget engines. `RunBudgetGuard`
  (EPIC-014) is a thin wrapper. No second budget system.
- **Execution:** provider calls flow ONLY through `StepExecutionPort` /
  `BrainExecutionPort` (frozen AI runtime). No arbitrary command execution.
- **Approval:** `BrainPolicyEngine` + `SENSITIVE_ACTIONS` (publish/send/deploy/
  purchase/subscribe/delete/share/install/connect_account) + `ApprovalRuntime`
  (EPIC-014) + `ApprovalEngine` (EPIC-013). Irreversible actions always gate.
- **Failover:** `ExecutionFailover.FallbackSelector` (EPIC-020) — bounded, never
  re-picks the failed provider.
- **Scheduler:** exactly one (AI World `SchedulerCadenceDriver`). None new.
- **Verification:** `StepVerifier` + Brain `verify` are the verification path.
- **Owner isolation:** IDOR guards everywhere (`assertUserIdMatchesSession`,
  owner-scoped stores, `PRIMARY KEY (owner, key)`).

---

## 4. Missing verification capability (the smallest gap)

A **narrow, deterministic, read-only artifact-verification capability** that the
existing `StepVerifier` / execution-bridge verification path can invoke to inspect a
**real artifact** within an **approved execution boundary root**, supporting:

- **A. FILE EXISTENCE** — expected file exists; unexpected missing file; empty file.
- **B. VALID STRUCTURE** — JSON parses; required fields exist; malformed JSON fails;
  basic CSV structure validation.
- **C. INDEPENDENT CALCULATION** — deterministic recompute vs expected; mismatch fails.
- **D. DRY-RUN AUTOMATION** — verify a safe dry-run's expected side-effect _evidence_
  (read-only); the verifier never performs an irreversible action and never executes
  arbitrary commands.
- **E. ARTIFACT METADATA** — captured verification evidence (type, existence,
  validity, status, deterministic checks, reference).

The verifier must be **confined to an approved boundary root** (no path traversal),
**bounded** (file size cap), and able to return **UNKNOWN** when evidence is
unavailable — never fabricating success.

---

## 5. Exact files requiring modification

### New files

| File                                                                     | Purpose                                                |
| ------------------------------------------------------------------------ | ------------------------------------------------------ |
| `packages/execution-bridge/src/types/artifact-types.ts`                  | Artifact check types, expectations, verdict.           |
| `packages/execution-bridge/src/contracts/artifact-ports.ts`              | Narrow read-only `ArtifactReaderPort` (root-confined). |
| `packages/execution-bridge/src/domain/ArtifactVerifier.ts`               | Deterministic read-only artifact verifier (Phase 1).   |
| `packages/execution-bridge/src/infrastructure/NodeArtifactReader.ts`     | Real fs implementation (bounded, no traversal).        |
| `packages/brain/src/domain/OutcomeVerdict.ts`                            | Honest outcome verdict derivation (Phase 2).           |
| `packages/brain/src/__tests__/OutcomeVerdict.test.ts`                    | Verdict state-machine tests.                           |
| `packages/execution-bridge/src/__tests__/ArtifactVerifier.test.ts`       | Package tests.                                         |
| `scripts/runtime-verification-benchmark.ts`                              | 12 real-runtime verification journeys (Phase 4).       |
| `09_Documents/SPRINT-024_{BASELINE_AUDIT,EVIDENCE,COMPLETION_REPORT}.md` | Docs.                                                  |

### Modified files

| File                                                                                                         | Change                                                                                         |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `packages/execution-bridge/src/index.ts`                                                                     | Export new types/domain/infra.                                                                 |
| `packages/execution-bridge/src/domain/StepVerifier.ts`                                                       | Compose `ArtifactVerifier` into the verification path (`verifyArtifacts` / `attachArtifacts`). |
| `packages/brain/src/types/outcome-types.ts`                                                                  | Add `OutcomeVerdict` union.                                                                    |
| `packages/brain/src/domain/OutcomeVerdict.ts`                                                                | Refine FAILED vs UNKNOWN distinction (`verificationFailed`).                                   |
| `packages/brain/src/index.ts`                                                                                | Export `OutcomeVerdict` + `deriveOutcomeVerdict` + labels.                                     |
| `eslint.config.js`                                                                                           | `require-await` exemption + object-injection exemption for the new files.                      |
| `package.json`                                                                                               | Add `runtime:verification:benchmark`; wire into `benchmarks`.                                  |
| `.github/workflows/ci.yml` + `release.yml`                                                                   | Add the runtime-verification benchmark to the quality gates.                                   |
| `apps/web/src/app/goals/problem-panel.tsx`                                                                   | Phase 5 outcome-contract strip (plain-language verdicts).                                      |
| `CHANGELOG.md`, `task_progress.md`, `05_Docs/PROJECT_STATUS.md`, `04_Sprints/MASTER_ROADMAP.md`, `README.md` | Documentation sync (Phase 8).                                                                  |

---

## 6. Architectural constraints

1. **No new engine.** `ArtifactVerifier` is a deterministic verification helper
   (like `StepVerifier`), not a scheduler/budget/execution/approval/notification/
   intelligence engine.
2. **No second budget system.** The artifact verifier reads bounded files; budget
   accounting stays in `BrainBudgetGuard` / `LoopBudget`.
3. **No second execution system.** The verifier ONLY reads files; it never executes
   commands, never invokes providers, never mutates state.
4. **No bypass of `StepVerifier` / Brain verify.** The new capability is composed
   INTO the existing verification path.
5. **No arbitrary command / path execution.** Paths are confined to an approved
   boundary root; `..` traversal and absolute paths are denied.
6. **Owner isolation preserved.** Verification operates on the owner's approved
   boundary only; no cross-owner artifact access.
7. **UNKNOWN stays UNKNOWN.** Missing/incomplete/contradictory evidence never
   becomes SUCCESS.

---

## 7. Security implications

- The verification mechanism must not become an arbitrary execution primitive.
- Any file/artifact path is constrained to the approved boundary root.
- No path traversal (`..` / absolute / symlink escape denied).
- No arbitrary command execution.
- No secrets in logs — aggregate-only logging.
- Credential leakage prevented: the reader never accesses credential stores.
- Bounded reads (size cap) → verification cannot consume unbounded resources.
- Rate limits / auth / approval boundaries at the gateway are untouched.

---

## 8. Acceptance criteria

- [ ] Real artifacts can be independently verified.
- [ ] File existence verification works.
- [ ] Structured artifact validation works (JSON / CSV).
- [ ] Independent calculation verification works.
- [ ] Safe dry-run verification works.
- [ ] Missing evidence never becomes SUCCESS.
- [ ] Contradictory evidence never becomes SUCCESS.
- [ ] UNKNOWN is preserved honestly.
- [ ] Approval boundaries remain intact.
- [ ] Budget remains the frozen LoopBudget.
- [ ] Execution remains bounded.
- [ ] Existing failover remains intact.
- [ ] No duplicate engines introduced.
- [ ] Owner isolation verified.
- [ ] No arbitrary command/path execution possible.
- [ ] Existing SPRINT-023 tests remain GREEN.
- [ ] New runtime journeys pass.
- [ ] Typecheck = 0 errors.
- [ ] Lint = 0 errors.
- [ ] Documentation synchronized.
