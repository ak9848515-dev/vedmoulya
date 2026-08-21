# SPRINT-033 — AUTONOMY & SECURITY

**VedMoulya — autonomy boundaries preserved · multi-business threat model · structural proofs**

---

## 1. Autonomy model (Part H) — preserved, not extended

The existing autonomy levels (0–5) and authorization model are UNCHANGED:
control-plane `AutonomySettings` + Fabric `AutonomyPolicy` + emergency stop +
CostPolicyGuard + RunBudgetGuard + the Brain approval authority.

SPRINT-033 adds nothing that can raise autonomy. The new surfaces are:

- `founderBriefing` — advisory composition (`advisory:true`, no-spam).
- `revenueDecisions` — advisory hints (`advisory:true`).
- `buildBlueprint` — a REPRESENTATION with recorded approval gates
  (`executed:false`, `authorizationRequired:true` — structural).

**Sensitive actions never silently transition into execution.** A class-C step
in a blueprint has an approval gate ONLY the existing authority clears.
**Every important action has policy, scope, owner, audit, budget and failure
handling** — provided by the existing authorities, never duplicated.

## 2. Threat model (Part I)

| Threat                          | Existing control (reused)                               | SPRINT-033 proof                                              |
| ------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------- |
| Cross-business data leakage     | owner-scoped stores, `PRIMARY KEY (owner, key)`         | revenue-stream isolation tests (u1 vs u2)                     |
| Cross-owner access              | gateway `assertUserIdMatchesSession` + store-level IDOR | WorldRouter IDOR test (owner B sees none of A)                |
| Provider credential leakage     | credentials server-side only; never in world stores     | stores persist typed docs only — no secrets                   |
| Malicious provider output       | Fabric `ResultNormalizer` redaction; output = DATA      | revenue figures require evidence; no fabricated numbers       |
| Prompt injection                | prompt-injection treated as DATA (never AUTHORITY)      | no path from provider output to authority                     |
| Tool injection                  | frozen runtime tool gating                              | blueprints never execute — representation only                |
| Unauthorized workflow execution | existing execution bridge + RunBudgetGuard              | `executed:false` structural                                   |
| Unauthorized spending           | CostLedger + CostPolicyGuard + RunBudgetGuard           | revenue model never spends; evidence-only figures             |
| Autonomous escalation           | `canDelegate` (single-step, never UP)                   | AIWorkforce tests                                             |
| Memory poisoning                | no promotion path from artifacts                        | structural test — no preference/promote/recordLearning method |
| Approval bypass                 | one approval authority (Brain)                          | blueprint records gates only; no approve method               |
| Tenant confusion                | owner-keyed stores + central IDOR                       | every new store owner-scoped + tested                         |

## 3. Structural proofs (tested)

- **The world model has NO approve / authorize / spend / execute surface**
  (structural test over the service prototype — `approve|authorize`,
  `execute|runWorkflow|deploy`, `spend|pay|purchase` all absent).
- **A worker can never escalate** (`canDelegate` — A→D refused, B→C refused).
- **An opportunity can never execute itself** (`authorizationRequired:true`,
  `executed:false` on every evaluation/blueprint).
- **A business unit cannot spend without permission** — units are
  configuration; cost stays with CostLedger.
- **No memory promotion** — no `preference|promote|recordLearning|outcomeMemory`
  method exists on the composition seam.
- **A figure without evidence is refused** (`NO_EVIDENCE` / `UNKNOWN_FIGURE`).
- **A blueprint cannot exceed the SPRINT-030 bounds** (24-step cap, cost cap,
  etc. — validated through the existing `WorkflowBounds`).

## 4. Scale posture (Part J)

100+ providers / 100+ businesses / thousands of workflows / many users are
supported by the EXISTING abstractions: capability abstraction (no provider ids
in workflows), provider registry (single catalog), bounded workflows
(WorkflowBounds), rate limits (RateLimiter), cost limits (CostPolicyGuard +
RunBudgetGuard), tenant isolation (owner-keyed stores), observability (trace
spine + AuditLogStore) and policy enforcement (ActionClassPolicy +
AutonomyPolicy). **No premature optimization** — no new scale infrastructure
was built.
