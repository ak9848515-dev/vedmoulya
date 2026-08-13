# EPIC-016 — VedMoulya Brain: Decision Model

> **Status:** Phase-1 implemented & verified (2026-08-11).
> Every meaningful Brain decision is **recorded, explained, and provable**. The UI shows
> concise decision explanations — never hidden chain-of-thought.

---

## 1. The decision record (execution-time twin of EI-008)

`BrainDecisionRecord` is the execution-time twin of the Enterprise Brain's `BrainDecision` —
the same explainability contract, recorded at every meaningful step of a task:

| Field                      | Meaning                                                                                                                                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                       | Stable record id                                                                                                                                                                                     |
| `taskId` / `userId`        | Owner-scoped provenance                                                                                                                                                                              |
| `decision`                 | What was decided (e.g. `task mode`, `capability plan`, `provider roles`, `approval granted: publish`, `budget stop`, `provider failure`, `verification`)                                             |
| `reason`                   | Why — a human sentence                                                                                                                                                                               |
| `alternatives`             | The options that were considered (never hidden)                                                                                                                                                      |
| `selected`                 | What was actually chosen                                                                                                                                                                             |
| `evidence`                 | Evidence backing the choice (empty when there is none — never padded)                                                                                                                                |
| `confidence`               | 0..1 — derived, not fabricated                                                                                                                                                                       |
| `constraints`              | Active constraints at decision time                                                                                                                                                                  |
| `providerId` / `modelId`   | When the decision concerns a provider/model                                                                                                                                                          |
| `costEstimateUsd`          | Only when evidence exists; **UNKNOWN stays absent**                                                                                                                                                  |
| `qualityEstimate`          | Only when evidence exists                                                                                                                                                                            |
| `createdAt` / `provenance` | When + which subsystem produced it (`brain-role-assigner`, `user-approval`, `brain-budget`, `brain-policy`, `capability-marketplace`, `capability-mapper`, `brain-execution`, `brain-verification`…) |

**Answerability contract** — every recommendation answers:

- WHY was this chosen? → `reason`
- WHAT was considered? → `alternatives`
- WHAT evidence supports it? → `evidence`
- HOW confident? → `confidence`
- WHAT does it cost? → `costEstimateUsd` (only when evidenced)
- WHERE did this come from? → `provenance`
- WHAT happens if the user declines? → the decision record for the rejection +
  the follow-up decision (e.g. `selected: 'free/local alternative'`)

---

## 2. What gets a decision record

| Pipeline step        | Decision recorded                                                                                                                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createTask`         | `task mode` — selected mode + alternatives (all 6 modes) + provenance `intent:<domain>`                                                                                                             |
| `plan`               | `capability plan` — capability-plan-driven vs direct single-step, evidence from the EPIC-013 plan                                                                                                   |
| `selectResources`    | `capability availability` (when a required capability is unavailable → **stop and hand off**, never faked) · `budget` (fail-closed block) · `provider roles` (N-provider assignment, quality-first) |
| `requestApproval`    | `approval: <action>` — pausing for explicit user decision                                                                                                                                           |
| `approve` / `reject` | `approval granted/rejected: <action>` — rejection → continue with best alternative                                                                                                                  |
| `execute`            | `capability not executable` (no honest runtime path → hand-off) · `provider failure` (recorded honestly, bounded fallback via the port) · `budget stop` (fail-closed)                               |
| `verify`             | `verification` — accept / report honestly / replan                                                                                                                                                  |

Confidence is **derived from evidence** (0.7 for intent/mode selection, 0.75 for the reused
capability plan, 0.7 for role assignment, 0.8-0.9 for policy/budget verdicts, 1.0 for
user-approval facts). No number is invented post-hoc.

---

## 3. Evidence policy

- **Discovery is not evidence.** A claim is evidence only when it has a source the Brain can
  cite (`evidence[]`, `provenance`).
- The verification stage applies `evidenceVerdict`:
  - `DEEP_RESEARCH` mode → evidence **REQUIRED** — zero evidence ⇒ ABSTAIN /
    REQUEST_MORE_INFORMATION (never fabricate).
  - `QUALITY` mode → evidence **OPTIONAL** (recorded when present, never padded).
- **Never claim "safe" because nothing bad was found** — verification language stays bounded
  ("No blocking indicators found in the checks performed").

---

## 4. Explicit vs inferred preferences

`OutcomeEvaluation.preferenceFacts` carries `source: 'EXPLICIT' | 'INFERRED'` with a reason
and confidence. **Inferred behavior is never silently promoted to a permanent preference**:

- A single declined paid provider is **not** turned into "prefer free always".
- Only an explicit user choice (`PreferenceLedger` EPIC-014 events, or an explicit
  `evaluateOutcome` decision) may inform future routing.
- EPIC-015 (preference learning) is the future consumer of this feed — the Brain only
  **feeds** it, it does not build a second preference system.

---

## 5. Failure policy (honest degradation)

| Failure                       | Behavior                                                                   | Recorded as                 |
| ----------------------------- | -------------------------------------------------------------------------- | --------------------------- |
| Provider failure              | Bounded fallback via the execution port; output recorded as empty + reason | `provider failure` decision |
| Provider timeout / rate limit | Retry/fallback bounded by the port; never silent                           | port-level                  |
| No capable provider           | Honest `PARTIAL` + `missing-capabilities` hand-off — never faked           | `capability availability`   |
| Capability not executable     | Skipped with explicit reason (mapCapability note)                          | `capability not executable` |
| Insufficient evidence         | ABSTAIN / REQUEST_MORE_INFORMATION                                         | verification check          |
| Budget exhausted              | **BLOCKED with explicit reason**, no further provider calls                | `budget` / `budget stop`    |
| Conflicting provider outputs  | Classification + honest UNRESOLVED; never blind voting                     | conflict report             |

A lower-quality result is **never produced silently** — degradation is always recorded in a
decision record and visible in the UI.

---

## 6. UI explainability (what the user sees)

The `/brain` page renders every decision record as an accordion: decision · timestamp ·
provenance · confidence badge · reason · selected (highlighted) · alternatives · evidence ·
provider/model · cost estimate. The synthesis panel additionally shows per-claim confidence
and which providers produced each claim. **No private reasoning traces are ever displayed.**
