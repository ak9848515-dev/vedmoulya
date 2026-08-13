# EPIC-016 — VedMoulya Brain: Provider Orchestration

> **Status:** Phase-1 implemented & verified (2026-08-11).
> The Brain decides **who does what** — ONE provider or N providers with roles — based on
> task requirements, quality-first, with a budget that fails closed. It never calls multiple
> providers just because they exist.

---

## 1. Selection hierarchy (preserved from the estate)

The Brain inherits the frozen quality hierarchy — **cost never overrides a required quality
threshold, and free never automatically means better**:

```
QUALITY → ACCURACY → TASK FIT → EVIDENCE → RELIABILITY → AVAILABILITY → LATENCY
→ FREE/LOCAL → COST
```

Given two candidates with **sufficient** quality, the preference order is:

```
FREE → FREE QUOTA → LOCAL → OPEN SOURCE → LOW COST → PAID
```

This is a **preference, not an absolute rule** — the `ProviderRoleAssigner` (which reuses
EPIC-012A/B candidate facts and EPIC-013 quality-first selection semantics) never lets the
cheapest tool win when it produces inferior output.

---

## 2. Provider roles (13 closed roles)

| Role                | Use                                  |
| ------------------- | ------------------------------------ |
| `PRIMARY_REASONER`  | The main reasoning pass              |
| `RESEARCHER`        | Gathers information / evidence       |
| `CODER`             | Code generation / implementation     |
| `ANALYST`           | Analysis / data reasoning            |
| `FACT_CHECKER`      | Independent verification of claims   |
| `CRITIC`            | Adversarial review of output quality |
| `SECURITY_REVIEWER` | Security-focused review              |
| `VISION_ANALYZER`   | Image / visual understanding         |
| `WRITER`            | Copy / content production            |
| `PLANNER`           | Decomposition / sequencing           |
| `SYNTHESIZER`       | Merging N-provider outputs           |
| `VERIFIER`          | Final verification pass              |
| `SPECIALIST`        | Domain-specific capability           |

**Roles are assigned per capability** (`ProviderRoleAssignment`): capability · role ·
providerId · providerName · modelId · quality · reason · evidence. Every assignment is
explainable in the UI.

---

## 3. N determination — when multiple providers help

Additional providers are only added when they **materially improve**:

- **accuracy** (conflicting-risk domains),
- **coverage** (research spanning sources),
- **verification** (fact-check / critic passes),
- **specialization** (distinct capability needs),
- **confidence** (synthesis over ≥2 independent outputs).

The `BrainModeSelector` picks the operating mode (FAST / BALANCED / QUALITY /
DEEP_RESEARCH / COST_SENSITIVE / PRIVATE_LOCAL) from the intent profile + preference hints;
the `ParallelPlanner` then schedules independent provider passes into **parallel waves**
(`BrainExecutionGraph.waves`), so N providers do not mean N× latency where they can run
concurrently.

---

## 4. Candidate sources (reused, never duplicated)

| Source                        | Reused from                                                     | Feeds                  |
| ----------------------------- | --------------------------------------------------------------- | ---------------------- |
| Configured providers + models | EPIC-012A/B provider intelligence + preferences                 | `providerCandidates`   |
| AI World discoveries          | EPIC-012C (security-scanned, relevance-scored)                  | `discoveryCandidates`  |
| Local models                  | EPIC-012C local classification (available = real runtime claim) | `localModelCandidates` |

If no candidate is eligible for a capability, the Brain records an honest **hand-off**
(`missing-capabilities`): it never invents a tool, never fakes availability, and recommends
the existing deep-links (configure provider / evaluate local model / review external tool).

**External applications (Gmail, LinkedIn, Canva, …) are never assumed executable** — without
API evidence + authentication + adapter evidence, they classify as MANUAL /
CONFIGURATION_REQUIRED / UNKNOWN.

---

## 5. Budget orchestration (fail-closed)

`BrainBudgetGuard` wraps `LoopBudget` semantics with a three-phase policy:

1. **Estimate before** — `estimatedCostUsd` / `estimatedTokens` recorded on the task when
   evidence exists; absent otherwise (**UNKNOWN stays absent**).
2. **Check before execution** — a budget violation blocks the run (`BUDGET_BLOCKED`) with an
   explicit decision record before any provider call.
3. **Check during execution** — after each provider output, `checkDuring` stops the run
   (`PARTIAL` + blocked stage) the moment tokens/cost/iterations approach the cap.

Budget exhaustion is **never silent**: the UI shows the blocked stage, the decision record
(`budget stop` / `budget`), and the alternatives that were considered (reduce scope · free
alternatives · ask user).

---

## 6. Approval orchestration

Sensitive actions (`publish · send · deploy · purchase · subscribe · delete · share ·
install · connect_account`) are gated by `BrainPolicyEngine`:

- The Brain **may recommend**; the **policy engine decides**; the **user approves**.
- `requestApproval(action)` pauses the task (`AWAITING_APPROVAL`).
- `approve` resumes from the correct point with a full audit trail.
- `reject` records the rejection and the Brain continues with the **best available
  alternative** — declining a paid option is never task failure (the fallback search order:
  FREE → FREE QUOTA → LOCAL → OPEN SOURCE → GITHUB → CURRENT CONFIGURED).
- A task can never grant itself permission (`checkAction` fails closed without explicit
  user authorization **and** approval).

---

## 7. Honest execution contract

- Execution flows through the frozen `AIOrchestratorSpecialistPort` — the same seam the
  LoopEngine and factory reuse. No second routing engine.
- Marketplace capability → runtime capability mapping reuses the EPIC-014 `mapCapability`
  mapper; an unmappable capability is **recorded and skipped, never faked**.
- Provider outputs are recorded with provider · role · capability · quality · evidence.
  **A provider response alone is never success** — verification (execution completed,
  no unreasoned abstention, evidence policy, no unresolved material conflict) and synthesis
  with provenance complete the contract.
- **OPERATOR REQUIRED (not claimed here):** live provider execution, live ecosystem
  discovery, external-app automation. The shipped default is the deterministic,
  evidence-first path with honest hand-offs.
