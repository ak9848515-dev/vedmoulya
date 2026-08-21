# SPRINT-037 — LIVE EXECUTION (the approved-plan → bridge seam)

## The one runtime path

```
FOUNDER
  │  world.orchestratePlan()          → OrchestrationPlan (executed:false, PLANNED)
  ▼
Brain approval (EXISTING authority)
  │  world.approveOrchestrationPlan() → status=APPROVED + approval record (grantedBy/At/scope)
  │                                    executed STILL false (structural)
  ▼
world.startOrchestrationPlan()
  │  structural gate: plan exists + status==='APPROVED' (else honest error)
  ▼
EXISTING ExecutionRunService.start(ownerId, planId)
  │  planSource = createOrchestrationAwarePlanSource(getWorld, marketplaceBase)
  │    → world.getOrchestrationPlan(ownerId, planId)  (owner-scoped — IDOR refused)
  │    → status==='APPROVED'?  (PLANNED/REJECTED/CANCELLED → undefined → bridge refuses)
  │    → canAdaptOrchestrationPlan? (closed capability vocabulary — unmapped → refuses)
  │    → adaptOrchestrationPlan → FactoryCapabilityPlan (representation only)
  ▼
PlanRunResolver → step dispositions (EXECUTABLE / CONFIGURE / UNAVAILABLE /
                  WAITING_FOR_APPROVAL / MANUAL_REQUIRED)
  ▼
StepExecutionPort (createStepExecutionPort(ai) — the SAME port the loop + factory use)
  → AIOrchestratorSpecialistPort → the real AI runtime → the configured provider
  ▼
StepVerifier (deterministic) → budget accounting (RunBudgetGuard, fail-closed)
  ▼
OUTCOME: run status + step states + spent cost/tokens/latency
```

## Structural gates (fail-closed, never bypassed)

1. **APPROVED-only**: `OrchestrationPlanSource.getPlan` returns `undefined` for any plan that is not `status === 'APPROVED'`. The bridge honestly reports the plan as not runnable — an unauthorized plan never becomes a bridge plan.
2. **`executed:false` is structural**: approval records a grant on the plan but NEVER flips `executed`. The adapter only REPRESENTS the approved plan; the bridge performs execution. No provider output, no plan, no recommendation can grant authority.
3. **Closed capability vocabulary**: `mapOrchestrationCapability` maps only capabilities the runtime can represent (research→RESEARCH, reasoning→REASONING, economic-analysis→REASONING, verification→QUALITY_EVALUATION, summarization→TEXT_GENERATION, coding→CODING, …). A step with an unmapped capability makes the whole plan non-adaptable — the runtime is never asked to execute a capability it cannot represent. (`verification` maps to QUALITY_EVALUATION which has NO runtime path — the resolver honestly reports it UNAVAILABLE; verification is performed deterministically by the run's StepVerifier.)
4. **ActionClassPolicy carried**: C/D steps adapt as `irreversible` → the bridge's own ApprovalRuntime pauses them (belt-and-braces on top of plan-level Brain approval). A/B steps run when the runtime path exists.
5. **Provider state honest**: AVAILABLE → READY; DEGRADED/UNKNOWN → CONFIGURE (never assumed READY without evidence); UNAVAILABLE/ERROR → UNAVAILABLE.

## Honest failure vocabulary

Dispositions: `EXECUTABLE` · `CONFIGURE` (provider needs operator config) · `UNAVAILABLE` (no runtime path) · `WAITING_FOR_APPROVAL` · `MANUAL_REQUIRED`. Run statuses: READY/RUNNING/COMPLETED/PARTIAL/FAILED/CANCELLED/NEEDS_REVIEW. **SUCCESS is only reported when execution actually completed and verified.**

## Proven by tests

- `WorldRouter.test.ts` — unapproved plan → `startOrchestrationPlan` refuses ("not approved"); approved plan → bridge runs EXECUTABLE steps through the step port.
- `OrchestrationPlanSource.test.ts` — APPROVED-only adaptation, closed vocabulary, provider-state mapping, C/D → irreversible, representation-only.
- `WorldModelService.test.ts` — Brain-gated approval, no self-approval without the authority, owner scoping (IDOR), command-center status honesty.
