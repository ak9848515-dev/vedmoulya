# SPRINT-029 — Automation Architecture

> **Sprint:** SPRINT-029 — Proactive Intelligence & Automation Fabric
> **Date:** 2026-08-13/14
> **Status:** IMPLEMENTED + TESTED (composition, zero new engines)

---

## 1. Mission

Detect repetitive workflows and represent them so the existing execution infrastructure
can act on them **after** the existing approval authority approves. This layer **detects
and proposes** — it never executes.

## 2. Workflow representation

Every discovered workflow (`AutomationWorkflow`) carries the full pipeline:

```
TRIGGER → INPUT → CAPABILITIES → TRANSFORMATION → APPROVAL → ACTION
        → VERIFICATION → OUTPUT → MEMORY
```

| Field            | Meaning                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| `trigger`        | what starts the workflow (scheduled cadence or explicit user request)                              |
| `input`          | what it consumes                                                                                   |
| `capabilities`   | capabilities required (from the existing capability catalog)                                       |
| `transformation` | the transformation the repeated tasks performed                                                    |
| `actionClass`    | **B** (user-authorized recurring) or **C** (approval required) — A is not automation, D is refused |
| `action`         | what would run                                                                                     |
| `verification`   | the existing verification authority confirms the output artifact                                   |
| `output`         | what it produces                                                                                   |
| `memory`         | interaction artifacts only — never auto-promoted to facts/preferences                              |
| `evidence`       | the actual task records behind the proposal                                                        |
| `occurrences`    | how many times the family appears in task history                                                  |

## 3. Detection (`domain/AutomationDiscovery.ts`)

- Groups the owner's task history by an **objective family** signature (distinctive
  words of the objective).
- A workflow is proposed **only when the same family appears ≥ `minOccurrences` (2)**
  times — evidence-based, never invented from a single task.
- Every family that does NOT meet the floor is recorded in `skipped` (why nothing was
  proposed — the layer is transparent, never silent about non-proposals).
- The **action class** is decided by `ActionClassPolicy` (composing the frozen
  `SENSITIVE_ACTIONS` vocabulary + the marketplace's irreversible-action vocabulary);
  class D is never proposed.
- The marketplace's **`AutomationBoundaryEngine`** assessment is attached as advisory
  metadata (`FULLY / PARTIALLY AUTOMATED / HUMAN APPROVAL / MANUAL`) — no fake full
  automation.

## 4. Approval gate

- Class **B**: runs only when the user explicitly authorized that workflow — recurring
  intent never bypasses the requirement.
- Class **C**: the existing approval authority decides **each run**.
- Class **D**: never proposed, never run.
- **Silence is NOT approval.** A discovery proposal has status `PROPOSED`; acting on it
  requires the existing approval mechanism, and execution flows through the existing
  execution bridge.

## 5. Reuse map (what was NOT rebuilt)

| Authority           | Used via                                                                               |
| ------------------- | -------------------------------------------------------------------------------------- |
| Task history        | Brain `listTasks` (owner-scoped)                                                       |
| Automation boundary | `AutomationBoundaryEngine` (capability-marketplace)                                    |
| Sensitive actions   | Brain `SENSITIVE_ACTIONS` (same vocabulary as `VoiceIntentGate` / `BrainPolicyEngine`) |
| Approval            | the existing approval authority (nothing in this package approves)                     |
| Execution           | the existing execution bridge (nothing in this package executes)                       |
| Verification        | the existing verification authority                                                    |
| Memory              | interaction artifacts only (the recommendation store)                                  |

## 6. Workflow examples covered by tests

- Repeated "Prepare the monthly sales report" tasks → AUTOMATION recommendation with
  occurrence evidence (2× floor).
- A single occurrence → skipped with reason (below floor).
- A sensitive family (e.g. "publish …") → class C (approval required), never class B.
- A never-automate family (e.g. "delete-account") → class D, never proposed.

## 7. Honest limitations

- The trigger today is the recommendation refresh (user-triggered); the cadence-driven
  trigger (`ProactiveSchedulerPort.onCadence`) is **prepared, not productized**
  (SPRINT-030+).
- `capabilities` resolution is conservative: populated only when the family maps to
  known catalog ids; otherwise the workflow proposes with an honest empty list and the
  user approves before any capability/execution work.
- Detection is lexical (objective family) — a smarter semantic detector is FUTURE and
  would still write into the same `AutomationWorkflow` model.

## 8. Verification

- `AutomationDiscovery.test.ts` 7/7, `ActionClassPolicy.test.ts` 7/7, plus service-level
  automation flows in `ProactiveIntelligenceService.test.ts` (22).
- Full suite green; typecheck/lint/coverage/build all green (see completion report).
