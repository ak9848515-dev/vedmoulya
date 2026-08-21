# SPRINT-034 — EXECUTION ACTIVATION

**Blueprint → approval request → existing approval authority → existing execution bridge**

---

## 1. The controlled mechanism

```
WorkflowExecutionBlueprint (SPRINT-033)
  → BlueprintApprovalFactory (world-model)
  → BlueprintApprovalRequest (exposed to the founder)
  → founder decision (world.decideBlueprintApproval)
  → EXISTING Brain approval authority (approve / reject)
  → EXISTING execution bridge (composed, never bypassed)
  → verification → outcome → learning
```

No new execution engine. No alternate execution path. A blueprint can NEVER
execute directly.

## 2. BlueprintApprovalFactory

`packages/world-model/src/domain/BlueprintApprovalFactory.ts`:

- Re-classifies every gated step **through the existing ActionClassPolicy**
  (`WorldActionPort.classify`) — a stored class is never trusted.
- Only steps whose class requires a gate (C/D, or an explicit approval gate)
  may produce a request; class A (low-risk per existing policy) never does.
- A request exposes: ACTION / REASON / BUSINESS / WORKFLOW / STEP / PROVIDER /
  ESTIMATED COST / DATA SCOPE / RISK / EXPECTED OUTCOME / REVERSIBILITY /
  AUTHORITY REQUIRED.
- `executed:false` is STRUCTURAL — nothing in the world model (or anywhere
  outside the frozen execution bridge after a real approval) can flip it.

## 3. Approval lifecycle (gateway)

- `world.buildBlueprintApprovalRequest` — preview the request (no side effect).
- `world.requestBlueprintApproval` — registers the request AND routes it to the
  Brain approval authority: the port creates the Brain task for the sensitive
  action (`brain.createTask`) and registers it (`brain.requestApproval`). The
  Brain task id is retained on the request — later decisions route through the
  SAME authority task (never forged).
- `world.decideBlueprintApproval(APPROVED|REJECTED)` — calls
  `brain.approve` / `brain.reject` ONLY. The world model can neither approve
  nor reject; a refusal from the Brain is returned verbatim.

## 4. Approval rules (unchanged, enforced)

- The founder must explicitly approve. **No voice shortcut** (VOICE ≠
  AUTHORIZATION is preserved and regression-tested), no model-generated
  approval, no transcript-based approval, no implicit approval.
- A class-D step is never autonomously executed. Class C requires explicit
  approval. The Brain remains the sole authority.

## 5. Execution bridge

After a real approval, execution composes the **existing** execution bridge
(`execution.*` procedures, ExecutionRunService, RunBudgetGuard, ArtifactVerifier)
— authenticated, authorized, owner-scoped, rate-limited, budget-controlled,
audited and bounded. The Command Center UI performs no execution calls.

## 6. Failure states

WAITING_FOR_APPROVAL · APPROVED · RUNNING · COMPLETED · FAILED · BLOCKED ·
NEEDS_REVIEW · CANCELLED. SUCCESS is never reported unless execution actually
completed (the existing bridge's verification contract governs).

## 7. Honest status

- Approval-request lifecycle: IMPLEMENTED + TESTED (no-self-authorize,
  authority-routing, rejection passthrough).
- Approved-blueprint → live execution: **OPERATOR-REQUIRED** (requires a
  configured execution environment + providers). The composition seam exists
  and is tested at the port boundary; live multi-provider execution remains an
  operator step (unchanged from SPRINT-030/033).
- NEW ENGINES CREATED: 0.
