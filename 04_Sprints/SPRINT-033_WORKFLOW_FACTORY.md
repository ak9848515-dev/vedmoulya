# SPRINT-033 — WORKFLOW FACTORY

**VedMoulya — the controlled Opportunity → approval → workflow → execution blueprint (Part E)**

---

## 1. The controlled mechanism

SPRINT-033 implements the controlled path:

```
Opportunity → founder approval → workflow specification →
provider/capability selection → execution (EXISTING bridge ONLY) →
verification → outcome → learning
```

as `WorkflowExecutionBlueprint` (`packages/world-model/src/domain/
WorkflowExecutionBlueprint.ts`). A blueprint is a **REPRESENTATION** of that
path for ONE opportunity/workflow. It never executes — `executed:false` and
`authorizationRequired:true` are structural fields with tests asserting them.

## 2. What a blueprint contains

- `steps` — the workflow specification (each step: id, label, optional
  capability + roleName, verification requirement, dependencies). Steps name
  capabilities/roles, NEVER provider ids.
- **Per-step action class** — every step is classified A/B/C/D through the
  EXISTING authority (`ActionClassPolicy` over the frozen `SENSITIVE_ACTIONS`).
  The blueprint records the class; it never decides.
- **Approval gates** — class-C (sensitive/irreversible) steps carry an
  `approvalGateRequired` flag + reason. ONLY the existing approval authority
  can clear a gate. Class-D steps are recorded and NEVER automated.
- `bounds` — the plan is validated against the EXISTING `WorkflowBounds`
  (SPRINT-030): depth ≤ 8 · tasks ≤ 24 · fan-out ≤ 8 · calls ≤ 64 · cost ≤ $5 ·
  time ≤ 600 s. Exceeded bounds block the blueprint with an honest reason.
- `estimatedCostUsd` — advisory, ONLY with evidence (a figure without evidence
  is refused — nothing fabricated).
- `approvalGates` — the summary of every gate on the blueprint.

## 3. Example

```
Opportunity: "Content business — produce and publish content"
  s1 draft the report          → class A (safe verb)       — no gate
  s2 publish to the website    → class C (sensitive)       — APPROVAL GATE
bounds: allowed · approvalGates: 1 · executed: false · authorizationRequired: true
```

## 4. Non-negotiables (tested)

- **No voice-only authorization** — the blueprint only marks gates; approval
  comes from the existing authority (voice is never approval).
- **No hidden execution** — `executed:false` is structural; nothing runs,
  spends or approves from a blueprint.
- **No autonomous spending** — cost is advisory-with-evidence; CostLedger +
  CostPolicyGuard + RunBudgetGuard remain authoritative.
- **Sensitive steps never silently transition into execution** — class-C
  always has a gate; class-D is never automated.
- **No unbounded agent loops** — the plan is validated against the existing
  `WorkflowBounds` (bounded decomposition, deterministic termination).

## 5. Where it lives

- `packages/world-model/src/domain/WorkflowExecutionBlueprint.ts` — the
  factory (composes the existing `WorldActionPort` + `WorkflowFactory` bounds).
- `packages/world-model/src/application/WorldModelService.ts` —
  `buildExecutionBlueprint`.
- Gateway `world.buildBlueprint` — auth + rate tier + IDOR + zod.
