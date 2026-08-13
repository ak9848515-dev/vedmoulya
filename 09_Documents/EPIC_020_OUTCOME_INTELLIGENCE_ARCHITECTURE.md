# EPIC-020 — Outcome & Revenue Intelligence

**Architecture · 2026-08-12**

> The Outcome & Revenue layer is an **additive extension of the existing EPIC-020 (Continuous Intelligence & Adaptive Orchestration)** — nothing was rebuilt. It makes VedMoulya **outcome-first**: every task is framed as a user problem → desired outcome → priority → constraints → best AI/tool/provider combination → plan → execution → verification → outcome → value → next action. The two highest-level priorities (solve real problems · create/save/earn money) are reflected in the ranking hierarchy — **quality and evidence always outrank cost**.

---

## 1. Position in the estate

```
USER OUTCOME
   ↓
OUTCOME INTELLIGENCE  ← NEW (outcome-types + OutcomePriorityEngine + DailyOutcomeEngine)
   ↓
BRAIN  ← existing EPIC-016/020 (coordinator — never executes AI itself)
   ↓
AI WORLD / ECOSYSTEM INTELLIGENCE  ← existing EPIC-012C/015
   ↓
CAPABILITY MARKETPLACE  ← existing EPIC-013
   ↓
PROVIDER INTELLIGENCE  ← existing EPIC-012A/B
   ↓
RESOURCE SELECTION  ← existing ProviderRoleAssigner (N providers, quality-first)
   ↓
EXECUTION  ← existing EPIC-014 execution bridge / LoopEngine
   ↓
VERIFICATION  ← existing verify + StepVerifier
   ↓
OUTCOME EVALUATION  ← extended (3-value satisfaction)
   ↓
MEMORY  ← existing BrainOutcomeMemory + memory-intelligence
```

The Brain remains the central intelligence coordinator. Outcome Intelligence **adds value-ranking and outcome framing only** — it never orchestrates providers, never plans capabilities, never executes, never discovers, never remembers on its own.

## 2. New components (all in `@vedmoulya/brain`)

| Component                | File                                                                               | Purpose                                                                                                                                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Outcome types            | `src/types/outcome-types.ts`                                                       | Generic `Outcome`, `OutcomeType` (14), `OutcomePriority`, `OutcomeConstraint`, `OutcomeStatus`, `OutcomeValue`, `OutcomeEvidence`, `OutcomeEffort`, `OutcomeSatisfaction`, `DailyAction`/`DailyPriorityPlan` |
| OutcomePriorityEngine    | `src/domain/OutcomePriorityEngine.ts`                                              | Transparent hierarchy ranker — quality/evidence above cost; UNKNOWN contributes zero                                                                                                                         |
| DailyOutcomeEngine       | `src/domain/DailyOutcomeEngine.ts`                                                 | "Today's Top N" composed from tasks + opportunities + events                                                                                                                                                 |
| Service surface          | `BrainApplicationService.dailyPriorities()` · `evaluateOutcome(..., satisfaction)` | Outcome-first reads + 3-value feedback loop                                                                                                                                                                  |
| Opportunity money fields | `Opportunity` + `OpportunityIntelligence`                                          | `requiredCapabilities` · `requiredProviders` · `estimatedEffort` · `cost` · `risk` · `approvalRequirement` · `recommendedNextAction` (evidence-only)                                                         |
| Satisfaction             | `OutcomeEvaluation.satisfaction` + `BrainOutcomeMemory.satisfaction`               | YES / PARTIALLY / NO — explicit, never silent                                                                                                                                                                |

## 3. Gateway + UI

- **`brain.dailyPriorities`** (standardProcedure) — owner-scoped Today Top N, IDOR-guarded like every brain.* procedure.
- **`brain.evaluateOutcome`** extended with optional `satisfaction` (`YES|PARTIALLY|NO|UNKNOWN`).
- **`/brain`** — "Today's most valuable actions" panel integrated into the existing operating dashboard (no new giant dashboard) + 3-value satisfaction buttons (Yes — solved it / Partially / No).

## 4. Honesty rules (unchanged from the frozen estate)

- UNKNOWN stays UNKNOWN — money/time/ROI/savings are **never fabricated**.
- `expectedValue` appears only when evidence supports it.
- A paid capability may be recommended when justified — with an explicit approval requirement and free-alternative awareness.
- No hidden chain-of-thought: only concise decision explanations and provenance.
