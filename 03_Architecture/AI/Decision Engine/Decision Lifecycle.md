# Decision Lifecycle

**Mission:** Define the complete end-to-end lifecycle of every decision made by the VedMoulya Decision Intelligence Engine.

**Version:** 1.0
**Status:** Draft
**Owner:** Chief Decision Intelligence Architect
**Dependencies:** Decision Intelligence.md, Decision Context.md, Decision Scoring.md, Decision Confidence.md, Decision Explainability.md
**Created:** 2026-07-24
**Updated:** 2026-07-24

## Description

Every decision follows a standardized lifecycle from trigger through learning. This document defines the 8-phase lifecycle, the inputs and outputs of each phase, and how the phases connect.

---

## Decision Lifecycle Diagram

```
┌──────────┐
│ TRIGGER  │  (User request, schedule, event, system action)
└────┬─────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. INPUT COLLECTION                                             │
│                                                                  │
│  ┌────────┐ ┌─────────┐ ┌──────────┐ ┌────────┐ ┌──────────┐  │
│  │  DNA   │ │ Journey │ │ Problems │ │Context │ │  Memory  │  │
│  └────────┘ └─────────┘ └──────────┘ └────────┘ └──────────┘  │
│                                                                  │
│  Output: Complete Decision Context Bundle                        │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. ANALYSIS                                                    │
│                                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                 │
│  │ Goal       │ │ Knowledge  │ │ Constraint  │                 │
│  │ Alignment  │ │ Gap        │ │ Assessment  │                 │
│  └────────────┘ └────────────┘ └────────────┘                 │
│                                                                  │
│  • What does the user need right now?                           │
│  • What knowledge is available to address this need?            │
│  • What constraints limit the options?                          │
│                                                                  │
│  Output: Analysis Results with Identified Gaps                  │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. REASONING                                                   │
│                                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                 │
│  │ Options    │ │ Option     │ │ Option     │                 │
│  │ Generation │ │ Evaluation │ │ Selection   │                 │
│  └────────────┘ └────────────┘ └────────────┘                 │
│                                                                  │
│  • Generate possible options from knowledge + content catalogs  │
│  • Evaluate each option using Decision Scoring framework        │
│  • Select highest-scoring option                                │
│                                                                  │
│  Output: Ranked Options with Scores                             │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. PLANNING                                                    │
│                                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                 │
│  │ Step       │ │ Dependency │ │ Timeline   │                 │
│  │ Generation │ │ Mapping    │ │ Estimation │                 │
│  └────────────┘ └────────────┘ └────────────┘                 │
│                                                                  │
│  • Decompose the decision into actionable steps                 │
│  • Identify prerequisites and dependencies                      │
│  • Estimate time, effort, and resources required                │
│                                                                  │
│  Output: Actionable Plan with Steps and Timeline                │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. RECOMMENDATION                                              │
│                                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                 │
│  │ Decision   │ │Explanation │ │ User       │                 │
│  │ Selection  │ │ Generation │ │ Confirmation│                 │
│  └────────────┘ └────────────┘ └────────────┘                 │
│                                                                  │
│  • Select final decision (highest-scoring, policy-compliant)    │
│  • Generate human-readable explanation                          │
│  • Present to user for confirmation (if required)               │
│                                                                  │
│  Output: Recommendation with Explanation                        │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. EXECUTION                                                   │
│                                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                 │
│  │ Task       │ │ Status     │ │ Completion │                 │
│  │ Dispatch   │ │ Tracking   │ │ Recording  │                 │
│  └────────────┘ └────────────┘ └────────────┘                 │
│                                                                  │
│  • Execute the decision (user action, system action, AI output) │
│  • Track status through execution                               │
│  • Record completion or failure                                 │
│                                                                  │
│  Output: Execution Result                                       │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  7. FEEDBACK                                                    │
│                                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                 │
│  │ Explicit   │ │ Implicit   │ │ Outcome    │                 │
│  │ Feedback   │ │ Signals    │ │ Tracking   │                 │
│  └────────────┘ └────────────┘ └────────────┘                 │
│                                                                  │
│  • Collect explicit user feedback (thumbs up/down, rating)      │
│  • Collect implicit signals (clicked, ignored, completed)       │
│  • Track actual outcomes (was the decision correct?)            │
│                                                                  │
│  Output: Feedback Signals                                       │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  8. LEARNING & IMPROVEMENT                                      │
│                                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                 │
│  │ DNA        │ │ Scoring    │ │ Policy     │                 │
│  │ Update     │ │ Adjustment │ │ Refinement │                 │
│  └────────────┘ └────────────┘ └────────────┘                 │
│                                                                  │
│  • Update User DNA with new signals                             │
│  • Adjust scoring models based on outcomes                      │
│  • Refine decision policies based on patterns                   │
│                                                                  │
│  Output: Updated Decision Intelligence Models                   │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
                          ┌──────────┐
                          │  READY   │  (For next decision)
                          └──────────┘
```

---

## Phase Details

### Phase 1: Input Collection

**Purpose:** Gather all data needed to make an informed decision.

**Inputs:**

| Source         | Data                                                                                                | Retrieved From               |
| -------------- | --------------------------------------------------------------------------------------------------- | ---------------------------- |
| User DNA       | 8 dimensions (identity, skills, knowledge, goals, learning profile, personality, context, progress) | DNA Store                    |
| Human Journey  | Current stage, stage history, stage duration                                                        | Progress Engine              |
| Human Problems | Active problems, problem severity, problem frequency                                                | Problem Repository (RSH-001) |
| Context        | Time, device, location, energy, constraints                                                         | Context Engine               |
| Memory         | Past decisions, past feedback, session history                                                      | Memory Engine                |
| HPI            | Current score, trend, growth rate                                                                   | Progress Engine              |

**Output:** Complete Decision Context Bundle (see Decision Context.md)

**Duration target:** < 50ms

---

### Phase 2: Analysis

**Purpose:** Understand the user's current situation and identify needs.

**Activities:**

1. **Goal Alignment** — Map the trigger to active user goals. What goal does this decision serve?
2. **Knowledge Gap Analysis** — What knowledge does the user need that they don't have? What does the system know that's relevant?
3. **Constraint Assessment** — What constraints apply? (Time, budget, prerequisites, energy)
4. **Problem Mapping** — Which validated problems (RSH-001) are active for this user right now?

**Output:** Analysis Results

- Aligned goals with priority scores
- Identified knowledge gaps with severity
- Active constraints with impact levels
- Mapped problems with urgency scores

**Duration target:** < 100ms

---

### Phase 3: Reasoning

**Purpose:** Generate and evaluate possible options.

**Activities:**

1. **Option Generation** — Query knowledge graph, content catalog, opportunity database, and marketplace for candidates
2. **Option Evaluation** — Score each candidate using the Decision Scoring framework (see Decision Scoring.md)
3. **Option Selection** — Apply policy constraints, select highest-scoring option

**Decision types evaluated:** (see Decision Types.md)

**Output:** Ranked Options

- Minimum 3 options (if available)
- Each option scored on 6 dimensions
- Top option flagged as recommended

**Duration target:** < 200ms (simple) to < 2s (complex)

---

### Phase 4: Planning

**Purpose:** Create actionable steps for the selected decision.

**Activities:**

1. **Step Generation** — Break decision into sequential steps
2. **Dependency Mapping** — Identify prerequisites for each step
3. **Timeline Estimation** — Estimate duration per step based on user's available time and pace

**Output:** Actionable Plan

- Ordered steps with descriptions
- Prerequisites per step
- Estimated time per step
- Total estimated duration

**Duration target:** < 500ms

---

### Phase 5: Recommendation

**Purpose:** Present the decision to the user with explanation.

**Activities:**

1. **Decision Selection** — Confirm the top option (re-check policies)
2. **Explanation Generation** — Generate human-readable explanation (see Decision Explainability.md)
3. **User Confirmation** — Present to user; require confirmation for high-stakes decisions

**Output:** Recommendation with Explanation

- Decision statement
- Why this decision
- Based on which DNA attributes
- Which problems addressed
- Which journey stage supported
- Confidence level
- Alternative options considered

**Duration target:** < 50ms

---

### Phase 6: Execution

**Purpose:** Execute the decision or dispatch for execution.

**Activities:**

1. **Task Dispatch** — If the decision involves user action: present as recommendation. If system action: dispatch to execution engine. If AI action: dispatch to AI Orchestrator.
2. **Status Tracking** — Monitor execution progress
3. **Completion Recording** — Record success/failure

**Output:** Execution result with status

**Duration target:** Varies by action type

---

### Phase 7: Feedback

**Purpose:** Collect signals on decision quality.

**Activities:**

1. **Explicit Feedback** — Capture user ratings, thumbs up/down, comments
2. **Implicit Signals** — Track clicks, time spent, completion rates, dismissal
3. **Outcome Tracking** — Measure actual results (skill improved, income earned, goal achieved)

**Output:** Feedback signals tied to decision ID

**Duration target:** < 50ms (collection), real-time (monitoring)

---

### Phase 8: Learning & Improvement

**Purpose:** Close the loop — improve future decisions.

**Activities:**

1. **DNA Update** — Update User DNA dimensions with new signals
2. **Scoring Adjustment** — Adjust scoring model weights based on outcomes (see Decision Learning.md)
3. **Policy Refinement** — Update decision policies based on pattern detection

**Output:** Updated Decision Intelligence models

**Duration target:** < 200ms (asynchronous)

---

## Lifecycle Variations by Decision Type

See Decision Types.md for the specific lifecycle paths of each decision type.

| Decision Type       | Key Phases    | Duration | Complexity |
| ------------------- | ------------- | -------- | ---------- |
| Learning Path       | 1→2→3→4→5→7→8 | 2-10s    | High       |
| Career Move         | 1→2→3→5→7→8   | 1-5s     | Medium     |
| Daily Planning      | 1→3→5→7→8     | < 1s     | Low        |
| Opportunity Match   | 1→2→3→5→7→8   | < 2s     | Medium     |
| Goal Prioritization | 1→2→3→5→7→8   | < 1s     | Medium     |

## Cross-References

n- **CMP-001** — Business strategy alignment for decision lifecycle priorities

n- **CMP-001** — Business strategy alignment for decision lifecycle priorities

- **Decision Intelligence.md** — The philosophy this lifecycle implements
  n- **CMP-001** — Business strategy alignment for decision lifecycle priorities
- **Decision Context.md** — The context bundle produced in Phase 1
  n- **CMP-001** — Business strategy alignment for decision lifecycle priorities
- **Decision Scoring.md** — The scoring framework used in Phase 3
  n- **CMP-001** — Business strategy alignment for decision lifecycle priorities
- **Decision Confidence.md** — Confidence calculated throughout the lifecycle
  n- **CMP-001** — Business strategy alignment for decision lifecycle priorities
- **Decision Types.md** — How lifecycle varies by decision type
  n- **CMP-001** — Business strategy alignment for decision lifecycle priorities
- **Decision Learning.md** — How Phase 8 feeds back into the system
  n- **CMP-001** — Business strategy alignment for decision lifecycle priorities
- **ARC-001 (System/Decision Flow.md)** — How this lifecycle integrates with the broader system
  n- **CMP-001** — Business strategy alignment for decision lifecycle priorities

n- **CMP-001** — Business strategy alignment for decision lifecycle priorities

### Future Expansion

n- **CMP-001** — Business strategy alignment for decision lifecycle priorities

- Parallel lifecycle execution for simultaneous decisions
- Predictive lifecycle (pre-computing decisions before user asks)
- Compensating lifecycle (rolling back decisions when outcomes are negative)
- Batch lifecycle (evaluating multiple decisions together)
