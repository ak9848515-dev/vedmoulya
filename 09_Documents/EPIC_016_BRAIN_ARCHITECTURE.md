# EPIC-016 — VedMoulya Brain: Architecture

> **Status:** Phase-1 core architecture implemented & verified (2026-08-11).
> Companion docs: [`EPIC_016_BRAIN_BASELINE_AUDIT.md`](./EPIC_016_BRAIN_BASELINE_AUDIT.md) (reconnaissance),
> [`EPIC_016_BRAIN_DECISION_MODEL.md`](./EPIC_016_BRAIN_DECISION_MODEL.md) (explainability),
> [`EPIC_016_BRAIN_PROVIDER_ORCHESTRATION.md`](./EPIC_016_BRAIN_PROVIDER_ORCHESTRATION.md) (N-provider roles).
> Verdict: **🟢 GREEN — IMPLEMENTATION VERIFIED** (live provider execution remains an operator step).

---

## 1. What the Brain is (and is not)

The VedMoulya Brain is the **central intelligence & orchestration coordinator**. It turns a
natural-language objective into an **understood → planned → resourced → executed → verified →
explained** pipeline by _consuming the frozen estate through narrow ports_.

| The Brain IS                                                                        | The Brain is NOT                                  |
| ----------------------------------------------------------------------------------- | ------------------------------------------------- |
| An orchestration coordinator                                                        | A chatbot                                         |
| A consumer of EPIC-013 plans / EPIC-014 runs / EPIC-012 provider facts / LoopEngine | Another provider router                           |
| An explainable decision recorder                                                    | Another LoopEngine                                |
| A bounded N-provider role assigner                                                  | Another capability planner                        |
| A provider of stable ports for future systems (EPIC-015+)                           | Another execution engine / memory / plugin system |

The Brain **never executes AI itself** and **never duplicates a specialized engine** —
every capability comes from the frozen estate through a port.

---

## 2. Architecture overview

```
┌────────────────────────────────────────────────────────────────────┐
│                        apps/web — /brain                           │
│   Task input · stage rail · provider/role cards · approval gates · │
│   verification checks · synthesized result · decision records      │
└───────────────────────────────┬────────────────────────────────────┘
                                │ brain.* tRPC (13 procedures)
┌───────────────────────────────▼────────────────────────────────────┐
│                services/api — RouterRegistry                       │
│   auth + IDOR (userId == session) + rate tiers + ApiResponse       │
│   ┌────────────────────────────────────────────────────────────┐   │
│   │ BrainRouter (createBrainRouter) + BrainPorts wiring        │   │
│   └────────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬────────────────────────────────────┘
                                │ ports
┌───────────────────────────────▼────────────────────────────────────┐
│            @vedmoulya/brain — BrainApplicationService              │
│  domain: IntentInterpreter · BrainModeSelector · ProviderRole-    │
│  Assigner · ParallelPlanner · ConflictDetector · OutputAssembler · │
│  CriticStrategy · BrainBudgetGuard · BrainPolicyEngine ·          │
│  BrainDecisionRecorder · OutcomeEvaluator                          │
│  infrastructure: InMemoryBrainTaskStore · InMemoryBrainDecision-   │
│  Store (owner-scoped)                                              │
└──────────────┬─────────────────────────────────────────────────────┘
               │ narrow ports (BrainPlanPort, BrainCandidatePort,
               │ BrainExecutionPort, BrainContextPort, BrainPreferencePort)
┌──────────────▼─────────────────────────────────────────────────────┐
│               FROZEN ESTATE (reused, never rebuilt)                │
│  EPIC-013 CapabilityPlanner → FactoryCapabilityPlan                │
│  EPIC-012A/B provider intelligence → ProviderCandidateFact         │
│  EPIC-012C AI World → DiscoveryCandidateFact / LocalModelFact      │
│  EPIC-006 LoopEngine AIOrchestratorSpecialistPort → execution      │
│  EPIC-014 PreferenceLedger → preference events                     │
└────────────────────────────────────────────────────────────────────┘
```

---

## 3. The pipeline (every stage has explicit state)

| Stage                  | Procedure               | Produces                                                                                                                                                    | Statuses                                         |
| ---------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **UNDERSTANDING**      | `brain.createTask`      | `IntentProfile` (objective · domain · constraints · qualityTarget · privacy · urgency · authorizedActions · ambiguities · boundedAssumptions) + `BrainMode` | pending → running → completed                    |
| **PLAN**               | `brain.plan`            | Reuses the EPIC-013 `FactoryCapabilityPlan` (required capabilities · graph from `ParallelPlanner`)                                                          | pending → running → completed / failed           |
| **INTELLIGENCE**       | `brain.selectResources` | `ProviderRoleAssignment[]` (N providers × roles) + budget estimate + availability policy verdict                                                            | pending → running → completed / blocked          |
| **EXECUTION**          | `brain.execute`         | `providerOutputs[]` + `ConflictReport[]` (through the execution port, bounded)                                                                              | pending → running → completed / blocked / failed |
| **VERIFICATION**       | `brain.verify`          | `BrainVerification` (4 checks) + `BrainSynthesis` (provenance-preserving)                                                                                   | pending → running → completed                    |
| **RESULT**             | (same call)             | Final status COMPLETED / PARTIAL + outcome feedback                                                                                                         | completed                                        |
| **CANCELLED / FAILED** | `brain.cancel` / errors | Honest terminal states — never a fake success                                                                                                               | terminal                                         |

`BrainTaskStatus`: NEW · UNDERSTANDING · PLANNED · AWAITING_APPROVAL · RUNNING ·
VERIFYING · COMPLETED · PARTIAL · FAILED · CANCELLED.

Every transition is recorded in a `BrainDecisionRecord` (see the Decision Model doc).

---

## 4. Domain components (what each owns)

| Component               | Owns                                                                                                                                                                                                                                   | Key contract                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `IntentInterpreter`     | Parses the objective into `IntentProfile`; **UNKNOWN stays UNKNOWN**; bounded assumptions with reasons; material ambiguities surfaced, never guessed                                                                                   | `interpret(input) → IntentProfile`                                       |
| `BrainModeSelector`     | Chooses FAST / BALANCED / QUALITY / DEEP_RESEARCH / COST_SENSITIVE / PRIVATE_LOCAL from profile + preference hints                                                                                                                     | `select({profile, capabilityCount, preferenceHints})`                    |
| `ProviderRoleAssigner`  | N-provider role assignment: picks the **quality-first** provider per capability, assigns one of 13 roles; `BrainNoCandidatesError` when nothing eligible (never faked)                                                                 | `assign(capability, candidates, {mode, qualityTarget})`                  |
| `ParallelPlanner`       | Builds the `BrainExecutionGraph` (nodes/edges/waves) from the EPIC-013 plan — parallel waves, dependency edges                                                                                                                         | `build(plan) → BrainExecutionGraph`                                      |
| `ConflictDetector`      | Classifies provider disagreement: AGREEMENT / MINOR_VARIANCE / MATERIAL_CONFLICT / EVIDENCE_CONFLICT / UNRESOLVED                                                                                                                      | `classify(capability, claims) → ConflictReport`                          |
| `OutputAssembler`       | Normalize → dedupe → verify → weight → synthesize with **provenance** (claims carry their providers + evidence); unresolved conflicts reported honestly                                                                                | `synthesize(outputs, conflicts) → BrainSynthesis`                        |
| `CriticStrategy`        | Decides whether a critique pass is needed (task risk / mode)                                                                                                                                                                           | mode-driven                                                              |
| `BrainBudgetGuard`      | Fail-closed budget: estimate before, check before, check during (tokens / cost USD / iterations / latency)                                                                                                                             | `estimate / checkBefore / checkDuring`                                   |
| `BrainPolicyEngine`     | Final authority: sensitive actions (publish · send · deploy · purchase · subscribe · delete · share · install · connect_account) **require explicit approval**; no self-granted permissions; no fake execution; no fabricated evidence | `requiresApproval / checkAction / evidenceVerdict / capabilityAvailable` |
| `BrainDecisionRecorder` | Persists every meaningful decision (decision · reason · alternatives · selected · evidence · confidence · constraints · provider/model · cost · provenance · timestamp)                                                                | `record(input)`                                                          |
| `OutcomeEvaluator`      | Post-task learning: whatWorked / whatFailed / providerPerformance / preferenceFacts (EXPLICIT vs INFERRED — never promoted silently)                                                                                                   | `evaluate(...) → OutcomeEvaluation`                                      |

---

## 5. Ports — the ONLY seams to the frozen estate

| Port                                    | Wired to (services/api `BrainPorts.ts`)                                 | Reuses                              |
| --------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------- |
| `BrainPlanPort.planFor`                 | `CapabilityMarketplaceApplicationService.plan`                          | EPIC-013 deterministic planner      |
| `BrainCandidatePort`                    | `CapabilitySourcePort` (provider / discovery / local-model candidates)  | EPIC-012A/B + EPIC-012C             |
| `BrainExecutionPort.execute`            | `AIOrchestratorSpecialistPort` over the frozen `AIOrchestrationService` | EPIC-006 LoopEngine specialist seam |
| `BrainContextPort.assemble`             | Minimal task-relevant context (never the user profile)                  | context policy                      |
| `BrainPreferencePort.record`            | EPIC-014 `PreferenceLedger`                                             | EPIC-014 provenance ledger          |
| `BrainTaskStore` / `BrainDecisionStore` | Owner-scoped in-memory stores                                           | IDOR-safe by construction           |

No fake adapters: where a real implementation does not exist (live discovery, external-app
automation), the Brain returns an explicit **unavailable / UNKNOWN / hand-off** state.

---

## 6. Gateway contract (`brain.*`)

All procedures are **authenticated + rate-limited**; `input.userId` must equal the session user
(central `assertUserIdMatchesSession` IDOR guard) **and** the service refuses foreign owners.

| Procedure                          | Tier     | Kind     | Input                                |
| ---------------------------------- | -------- | -------- | ------------------------------------ |
| `createTask`                       | standard | mutation | `{ userId, input }`                  |
| `plan`                             | heavy    | mutation | `{ userId, taskId }`                 |
| `selectResources`                  | heavy    | mutation | `{ userId, taskId }`                 |
| `execute`                          | heavy    | mutation | `{ userId, taskId }`                 |
| `verify`                           | standard | query    | `{ userId, taskId }`                 |
| `requestApproval`                  | standard | mutation | `{ userId, taskId, action }`         |
| `approve` / `reject`               | standard | mutation | `{ userId, taskId, action }`         |
| `getStatus` / `getDecisionRecords` | standard | query    | `{ userId, taskId }`                 |
| `listTasks`                        | standard | query    | `{ userId }`                         |
| `cancel`                           | standard | mutation | `{ userId, taskId }`                 |
| `evaluateOutcome`                  | standard | mutation | `{ userId, taskId, outputAccepted }` |

Every mutation returns the **updated `BrainTask`** so the UI advances without refetching.

---

## 7. Web UI (`/brain`)

Premium, honest, progressive disclosure — see the page for the live implementation:

- **Task input** with examples and a full "Run the Brain" chain
  (create → plan → selectResources → execute → verify), plus per-stage **Continue** buttons.
- **Stage rail**: all six pipeline stages with pending / running / completed / failed / blocked chips.
- **Understanding**: intent profile, domain, constraints, authorized actions, ambiguities,
  bounded assumptions.
- **Providers & roles**: N-provider cards (provider · role · capability · model · quality bar ·
  reason · evidence) + parallel execution-graph waves.
- **Approval**: sensitive-action gates with **Approve / Reject**, a **"Request approval"**
  affordance for publish/send/deploy/…, and honest non-sensitive hand-offs
  (e.g. `missing-capabilities` → configure a provider — never faked).
- **Result**: provider outputs, verification checklist, synthesized claims with confidence +
  provenance, unresolved conflicts, and **Accept / Reject result** (learning feed).
- **Decision explanation**: every `BrainDecisionRecord` (why · selected · alternatives ·
  evidence · confidence · provenance).
- **Budget + trace + recent tasks** side column (owner-scoped history, invalidated on change).

---

## 8. Security model

- Credentials never enter the Brain — adapters hold keys behind the frozen runtime.
- Owner-scoped stores + central gateway IDOR guard (refused at service _and_ middleware).
- Rate tiers: heavy for plan/select/execute, standard for reads/approvals.
- `BrainPolicyEngine`: the Brain **may recommend, never grant itself permissions**; sensitive
  actions pause for explicit user approval; budget failures are fail-closed BLOCKED.
- GitHub / open-source / external applications remain **untrusted input** — the Brain never
  clones, installs, or assumes external-app automation (EPIC-015 owns the GitHub flow).
- No hidden chain-of-thought: the UI shows concise decision explanations, never private
  reasoning traces.

## 9. Verification & honest limitations

- **@vedmoulya/brain: 81/81 deterministic tests** (modes, intent, role assignment incl.
  quality-first & no-candidates, parallel waves, conflict classification, synthesis
  provenance, policy gates, approval gate, budget fail-closed, decision records, outcome
  evaluation, owner-scoped stores). Coverage gates + typecheck + lint clean.
- **Gateway: 7/7 BrainRouter tests** through the real tRPC pipeline (full gateway suite retained).
- **Web: 26 brain UI tests** (stage rail, provider cards, approval incl. request/reject,
  verification, synthesis, decision records, next-step mapping) — web suite 146/146.
- **OPERATOR REQUIRED (not claimed here):** live provider execution (no credentials on this
  machine), live ecosystem discovery, external-app automation. Honest hand-offs are the
  shipped default; a provider response alone is never success — verification + evidence are.
