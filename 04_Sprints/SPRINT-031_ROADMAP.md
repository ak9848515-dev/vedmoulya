# SPRINT-031 — ROADMAP: Active Intelligence & Autonomy Control Plane

> VedMoulya — Active Intelligence & Autonomy Control Plane
> Status: 🟢 IMPLEMENTED + TESTED (composition sprint — zero new engines)
> Verified from source 2026-08-14.

---

## 1. Mission

Connect the already-existing capabilities into a **controlled continuous-intelligence
lifecycle** — OBSERVE → UNDERSTAND → DISCOVER → ASSESS → PRIORITIZE → PROPOSE →
REQUEST AUTHORIZATION WHEN REQUIRED → EXECUTE THROUGH EXISTING AUTHORITY → VERIFY →
RECORD OUTCOME → LEARN — without inventing a single new engine.

The governing principle: **COMPOSE, CONTROL, VERIFY, LEARN.** Not: INVENT ANOTHER ENGINE.

## 2. Verified dependency / composition map (from source)

| Capability                     | Verified implementation                                                                                                                                                                  | Reuse for SPRINT-031                              |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Brain (intent, tasks, approve) | `packages/brain` `BrainApplicationService` (`approve`/`reject`/`listTasks`, `approvalRequired`)                                                                                          | Approval Center data + lifecycle APPROVED gate    |
| Sensitive actions              | Brain `SENSITIVE_ACTIONS` via `ActionClassPolicy` (`packages/proactive`)                                                                                                                 | classification authority (never duplicated)       |
| Proactive intelligence         | `packages/proactive` `ProactiveIntelligenceService` (refresh/list/dismiss/accept/briefing/assessBusiness)                                                                                | discovery/assessment/prioritization/proposal      |
| Opportunity assessor           | `BusinessOpportunityAssessor` (research/score only)                                                                                                                                      | opportunity scoring                               |
| Daily briefing                 | `DailyBriefingAssembler` (no-spam `hasContent`)                                                                                                                                          | TODAY briefing                                    |
| Intelligence Fabric            | `packages/intelligence-fabric` — `AutonomyPolicy` (0–5), `CostPolicyGuard`, `ProviderHealthLedger`, `SelectionStrategy`, `WorkflowBounds`, `VerificationChainPolicy`, `ResultNormalizer` | autonomy gate + cost gate + health/status surface |
| Cost measurement               | `CostLedger` (trace spine) + `FabricCostPort`                                                                                                                                            | cost status, budget checks                        |
| Provider registry              | `ProviderApplicationService` + `FabricProviderPort`                                                                                                                                      | provider status/restrictions                      |
| Scheduler/cadence              | `services/api/src/observability/scheduler-cadence.ts` (`SchedulerCadenceDriver`, proactive refresh port)                                                                                 | continuous-observation hook (bounded)             |
| Voice                          | `packages/voice` `VoiceAssistantService` — VOICE ≠ AUTHORIZATION enforced                                                                                                                | voice boundary intact, untouched                  |
| Outcome memory / learning      | Brain `BrainOutcomeMemory` + `correctLearning` (SPRINT-025)                                                                                                                              | outcome loop (record → learning signal)           |
| Audit                          | `services/api` `AuditLogStore` (durable, owner-scoped)                                                                                                                                   | emergency-stop + settings audit                   |
| Persistence                    | `@vedmoulya/core` `WriteThroughDocumentStore` family                                                                                                                                     | settings/emergency/opportunity stores             |
| Identity                       | gateway identity service                                                                                                                                                                 | owner scoping                                     |
| Execution                      | Execution bridge + `RunBudgetGuard` (SPRINT-014)                                                                                                                                         | execution authority (never bypassed)              |

## 3. What SPRINT-031 adds (composition only)

1. **`packages/control-plane`** — narrow composition layer:
   - `AutonomySettings` — owner-scoped persisted user autonomy control (level,
     allowed/prohibited categories, spending limits, provider restrictions,
     private-only, approval-required actions, notification prefs, quiet hours,
     emergency stop). Fail-closed defaults; validated; auditable.
   - `EmergencyStop` — narrowly scoped, audited (WHO/WHEN/WHY/STATE BEFORE/AFTER),
     never deletes data, fail-closed.
   - `OpportunityLifecycle` — typed lifecycle state machine
     (DISCOVERED → ASSESSED → SHORTLISTED → PRESENTED → APPROVED → PLANNED →
     EXECUTED → VERIFIED → REJECTED / COMPLETED) with guarded transitions.
   - `ControlGate` — ONE fail-closed gate composing the existing AutonomyPolicy
     (A/B/C/D) + CostPolicyGuard + EmergencyStop + settings restrictions → a
     typed decision (ALLOWED / WAITING_FOR_APPROVAL / BLOCKED_BY_POLICY /
     BLOCKED_BY_BUDGET / EMERGENCY_STOP / NEEDS_REVIEW).
   - `ActiveIntelligenceControlPlane` — the composition seam: `observe()`,
     bounded `cycle()` (never executes), `gateAction()`, `todayBriefing()`,
     opportunity lifecycle operations.
2. **Owner-scoped persistence** for settings / emergency stop / opportunities
   (in-memory + Postgres write-through, wired into the persistence bundle).
3. **Gateway `control.*` namespace** (settings / emergencyStop / opportunities /
   cycle / briefing / gate) — auth + rate tier + central IDOR + zod.
4. **Minimal UI** — Autonomy Control surface (settings + emergency stop + TODAY
   briefing) in the AICompanion, using the existing design system.
5. **Structural tests** proving no new authorization bypass.

## 4. Explicitly NOT built (zero-new-engine policy)

- No `AutonomousAgentEngine` / `MasterAIEngine` / `SuperIntelligenceEngine` /
  `BusinessEngine` / `OpportunityEngine` / `AutomationEngine` / `DecisionEngine` /
  `ProviderSelectionEngine` / `MemoryEngine` / `VoiceEngine`.
- No background autonomous loops — the cycle is bounded and user/operator
  triggered; the cadence hook only refreshes recommendations (no execution).
- No new approval authority — the Brain `approve` remains authoritative.
- No new budget engine — `CostPolicyGuard` + `RunBudgetGuard` remain authoritative.

## 5. Acceptance gates

1. Existing architecture inspected (this doc + BASELINE_AUDIT) ✅
2. No duplicate engine created ✅
3. Active intelligence lifecycle composed ✅
4. Autonomy policy enforced (existing AutonomyPolicy) ✅
5. Approval remains authoritative ✅
6. Opportunity lifecycle works ✅
7. Provider Fabric reused ✅
8. Cost controls enforced ✅
9. Outcome signals recorded (via existing outcome memory) ✅
10. Voice boundary intact ✅
11. Emergency stop exists (or equivalent proven) ✅
12. Owner isolation tested ✅
13. Audit trail exists ✅
    14–17. Tests / typecheck / lint / build pass ✅
14. Documentation synchronized ✅
15. No secrets committed ✅
16. No fake production capabilities reported ✅

## 6. Honest status vocabulary

IMPLEMENTED · TESTED · MOCKED · OPERATOR-REQUIRED · PARTIAL · FUTURE.
"COMPLETE" is never claimed for something only documented.
