# Goal Engine

> The engine that defines, scores, prioritizes, and shepherds goals through their lifecycle.
> Owner: Chief Enterprise Intelligence Architect · Updated: 2026-08-03 (EI-000)

## Purpose

Define what a Goal is in VedMoulya, how goals are created, scored, prioritized, decomposed, tracked, and learned from. The Goal Engine produces the Goal Specification Document that drives every downstream engine.

## Responsibilities

- Define the Goal model and lifecycle
- Score and prioritize goals (Goal Score, Business Value Score, Confidence)
- Manage goal hierarchy and dependencies
- Track completion, history, and learning signals
- Emit the Goal Specification Document

## Inputs

- Business/user intents (module requests, client briefs, user tasks)
- Business context (memory, knowledge, client profile, current revenue state)
- Owner/strategic priorities (registry)
- Historical goal outcomes (learning)

## Outputs

- **Goal Specification Document** (the canonical output): goal id, type, objective, success criteria, owner, priority, score, confidence, dependencies, hierarchy, budget envelope request, status, lineage
- Goal lifecycle events (proposed, accepted, active, blocked, completed, archived)

## Algorithms

### What is a Goal

A Goal is a desired, measurable outcome with a success criterion. A Goal is **not** a task — it declares _what_ and _why_; the Task Planner decides _how_.

### Goal lifecycle

```
Proposed → Scored → Accepted → Active → Blocked ⇄ Active → Completed → Archived
                          ↘ Rejected → Archived
```

- **Proposed:** captured from a module/user/business intent
- **Scored:** Goal Score + Business Value + Confidence computed
- **Accepted/Rejected:** Enterprise Brain decides (thresholds from registry)
- **Active:** decomposed by Task Planner, monitored by Execution
- **Blocked:** dependency/approval/budget wait — may resume
- **Completed:** success criteria met; outcomes recorded
- **Archived:** history retained for learning

### Goal hierarchy

A Goal may be a **parent** (epic-level) with **sub-goals**, or **atomic**. Hierarchy rules:

- Sub-goal success must be defined independently (no ambiguous "part of X")
- Parent Goal Score = weighted aggregate of sub-goal scores + own strategic weight
- Dependencies are edges between goals (sub-goal B requires sub-goal A)

### Goal priority

Priority is computed, not manually frozen:

```
Priority(g) = w_strat·Strategic(g) + w_urg·Urgency(g) + w_val·Value(g) + w_eff·Ease(g)
```

Where Ease = (1 − cost) · (1 − risk). Registry weights, learnable.

### Goal scoring

`GoalScore(g)` per `INTELLIGENCE_MATHEMATICS.md` §3 — weighted: BusinessValue, Priority, Confidence, Urgency, Alignment.

### Goal dependencies

- **Dependency types:** `requires` (hard prerequisite), `enhances` (soft), `blocks` (mutual exclusion)
- Dependency graph is a DAG (cycle detection mandatory; cycles → merge or reject)
- Blocked status derives from unmet hard dependencies

### Goal completion

- Success criteria as typed, verifiable predicates (metric ≥ target, deliverable approved, decision recorded)
- Completion writes outcome → Execution history → Learning Engine
- Partial completion allowed with `completionRatio` recorded (feeds Execution Score)

### Goal history

Immutable append-only history: created, scored, accepted, activated, blocked, resumed, completed, archived — with timestamps, actor, and score deltas. Basis for goal learning and the "goal attainment" term of the Overall Intelligence Score.

### Goal learning

- Outcome residuals: `actualSuccess − predictedConfidence` (calibration of confidence)
- Value residuals: `realizedBusinessValue − predictedBusinessValue` (better value models)
- Weight updates proposed to the Learning Engine (human-gated)

### Goal confidence

`Confidence(g)` = probability of success given history similarity, dependency health, budget adequacy, provider reliability (see Mathematics §7). Used by the Brain to decide commitment level.

## Scoring

| Score         | Source         | Used for                    |
| ------------- | -------------- | --------------------------- |
| GoalScore     | Mathematics §3 | Acceptance & prioritization |
| BusinessValue | Mathematics §8 | Value ranking               |
| Confidence    | Mathematics §7 | Commitment & risk           |
| Priority      | this doc       | Scheduling across goals     |

## Decision Flow

1. Intent captured → normalize into Goal draft
2. Score (value/confidence/priority) → Brain acceptance decision
3. If accepted: register in hierarchy, emit Goal Specification, hand to Task Planner
4. Monitor status via Execution; handle blocked/resume
5. On completion: verify success criteria → record outcome → archive → learning signal

## Failure Handling

- **Unscorable goal** (missing value data): score with priors, flag low confidence, require owner input
- **Dependency cycle:** reject with explanation, suggest merge
- **Goal blocked too long:** escalate to Brain (re-prioritize, re-plan, or abort)
- **Budget unavailable:** hold in blocked state; resume on budget release

## Learning

- Calibration of confidence (predicted vs. actual)
- Value-model refinement from realized outcomes
- Priority weight tuning from completion timing
- All updates human-gated via Learning Engine

## Future Expansion

- Goal templates per module (content agency, career, learning)
- Hierarchical goal roll-up dashboards
- Multi-tenant goal isolation (per client)

## References

- [EI000_ENTERPRISE_INTELLIGENCE_SPECIFICATION.md](./EI000_ENTERPRISE_INTELLIGENCE_SPECIFICATION.md)
- [INTELLIGENCE_MATHEMATICS.md](./INTELLIGENCE_MATHEMATICS.md)
- [TASK_ENGINE.md](./TASK_ENGINE.md)
- [ENTERPRISE_BRAIN_SPEC.md](./ENTERPRISE_BRAIN_SPEC.md)
