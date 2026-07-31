# Execution API Contract

**ARC-004 — Document 10/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Execution Architect
**Created:** 2026-07-24
**Cross-references:** ARC-004/D01, ARC-004/D02, ARC-004/D04, ARC-004/D07, ARC-001, ARC-002, ARC-003

---

## Purpose

The Execution API Contract defines the **conceptual interface** between Execution Intelligence and all other systems within VedMoulya. This is NOT a REST API, NOT a GraphQL schema, and NOT a code interface. It is a **conceptual contract** describing what information flows in and out of the Execution Engine.

---

## Scope

This document covers the conceptual contract for execution-related interactions. It does NOT define specific endpoints, data formats, or transport protocols.

---

## Dependencies

- **ARC-004/D01** — Execution Intelligence (foundation)
- **ARC-004/D02** — Execution Lifecycle (what the API controls)
- **ARC-004/D04** — Planning Framework (plans the API manages)
- **ARC-004/D07** — Execution Feedback (feedback the API captures)
- **ARC-001** — System Architecture (integration context)
- **ARC-002** — Decision Intelligence
- **ARC-003** — Knowledge Graph

---

## Conceptual Contract

```
┌─────────────────────────────────────────────────────────────┐
│                     EXECUTION ENGINE                         │
│                                                             │
│    ┌─────────────────────────────────────────────────┐      │
│    │             EXECUTION API CONTRACT               │      │
│    │                                                  │      │
│    │  Inputs:  Goal, Plan, Schedule, Action, Feedback │      │
│    │  Outputs: Plans, Progress, Insights, Metrics     │      │
│    │  Metadata: Confidence, Priority, Context         │      │
│    └─────────────────────────────────────────────────┘      │
│                                                             │
│    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│    │ Daily Journey│  │ Knowledge    │  │ Decision     │    │
│    │ (User-facing)│  │ Graph        │  │ Intelligence │    │
│    └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Execution Requests

### 1. Create Goal

**Purpose:** A new goal enters the execution system.

**Conceptual inputs:**

- Goal description and outcome
- Target date
- Priority level
- Parent vision or long-term goal
- Success criteria
- Dependencies (optional)

**Conceptual outputs:**

- Goal created confirmation
- Goal decomposition (suggested projects and milestones)
- Initial plan placeholder

### 2. Create Plan

**Purpose:** Generate an execution plan from a goal.

**Conceptual inputs:**

- Goal reference
- Planning level (strategic, tactical, operational, daily)
- Constraints (time, energy, resources)
- Preferences (work style, schedule)
- Existing commitments

**Conceptual outputs:**

- Structured plan with milestones and tasks
- Time estimates for each component
- Dependency chain
- Priority ordering
- Confidence level

### 3. Schedule Tasks

**Purpose:** Place plan tasks on a calendar.

**Conceptual inputs:**

- Tasks to schedule
- Available time windows
- Energy patterns
- Location and resource context
- Existing schedule

**Conceptual outputs:**

- Scheduled tasks with time blocks
- Daily and weekly schedule views
- Capacity utilization report
- Schedule conflicts (if any)

### 4. Report Execution

**Purpose:** Report the outcome of executing a task.

**Conceptual inputs:**

- Task reference
- Completion status (completed, partial, failed, skipped)
- Actual time spent
- Quality assessment
- Energy level during execution
- Notes and reflections
- Obstacles encountered

**Conceptual outputs:**

- Execution recorded confirmation
- Updated plan status
- Adjusted time estimates for similar future tasks
- Feedback captured for learning

### 5. Request Adaptation

**Purpose:** Request a plan adaptation due to changed circumstances.

**Conceptual inputs:**

- Current plan reference
- What changed (trigger)
- Impact assessment (user or system provided)
- Preferred adaptation approach (optional)

**Conceptual outputs:**

- Adaptation options with trade-offs
- Recommended adaptation
- Impact assessment of each option
- New plan after adaptation

---

## Execution Plans

Every execution plan includes:

| Component            | Description                           |
| -------------------- | ------------------------------------- |
| **Goal**             | The goal this plan serves             |
| **Projects**         | Major work streams within the plan    |
| **Milestones**       | Key progress markers with dates       |
| **Tasks**            | Individual actions with estimates     |
| **Dependencies**     | What depends on what                  |
| **Timeline**         | Start and end dates with milestones   |
| **Priority**         | Relative importance of each component |
| **Confidence**       | How confident we are in this plan     |
| **Success criteria** | How we will know the plan succeeded   |
| **Buffer**           | Contingency time included             |

---

## Execution Progress

Every progress report includes:

| Component            | Description                                            |
| -------------------- | ------------------------------------------------------ |
| **Overall progress** | Percentage complete toward goal                        |
| **Milestone status** | Which milestones are achieved, in progress, or at risk |
| **Task completion**  | Completed vs. planned tasks for the period             |
| **Time variance**    | Actual vs. estimated time                              |
| **Completion rate**  | Percentage of planned tasks completed                  |
| **Streak data**      | Current execution streaks (days, weeks)                |
| **Momentum score**   | Overall execution momentum indicator                   |
| **Risk indicators**  | Tasks or milestones at risk of delay                   |

---

## Execution Feedback

Every feedback record includes:

| Component              | Description                         |
| ---------------------- | ----------------------------------- |
| **What was done**      | The task or action executed         |
| **What happened**      | The actual outcome                  |
| **What worked**        | Factors that contributed to success |
| **What didn't work**   | Factors that hindered execution     |
| **What was learned**   | Insights gained from the experience |
| **Time variance**      | Planned vs. actual time             |
| **Quality assessment** | User's rating of the outcome        |
| **Energy context**     | Energy level during execution       |
| **Obstacles**          | What blocked or hindered execution  |

---

## Execution Outcomes

Every outcome record includes:

| Component               | Description                                    |
| ----------------------- | ---------------------------------------------- |
| **Goal achievement**    | Was the goal achieved?                         |
| **Outcome quality**     | How well was it achieved?                      |
| **Timeline accuracy**   | How close was the actual timeline to the plan? |
| **Resource usage**      | Actual vs. planned resource consumption        |
| **Lessons learned**     | Key takeaways for future execution             |
| **Knowledge generated** | New knowledge to add to Knowledge Graph        |
| **Skill demonstrated**  | Skills validated or developed                  |
| **Next actions**        | What should happen next                        |

---

## Execution Metrics

| Metric                   | Description                                    |
| ------------------------ | ---------------------------------------------- |
| **Completion rate**      | Percentage of planned tasks completed          |
| **On-time rate**         | Percentage of tasks completed on schedule      |
| **Estimation accuracy**  | How close actual time is to estimated time     |
| **Momentum**             | Current execution velocity and direction       |
| **Consistency**          | How consistently the user executes over time   |
| **Goal progress**        | Rate of progress toward active goals           |
| **Adaptation frequency** | How often plans need to change                 |
| **Recovery time**        | How quickly the user recovers from disruptions |
| **Streak length**        | Current and longest execution streaks          |
| **Quality score**        | User-rated quality of completed work           |

---

## Execution Confidence

Every execution output includes confidence information:

| Level           | Meaning                               | Application                                       |
| --------------- | ------------------------------------- | ------------------------------------------------- |
| **High**        | Strong historical data supports this  | Follow the plan as designed                       |
| **Medium**      | Moderate data, some uncertainty       | Follow with awareness of potential changes        |
| **Low**         | Limited data, significant uncertainty | Review before executing, be prepared to adapt     |
| **Speculative** | No relevant historical data           | Treat as a hypothesis, validate through execution |

---

## Consumer Responsibilities

| Responsibility        | Description                                                |
| --------------------- | ---------------------------------------------------------- |
| **Provide context**   | Every request must include current execution context       |
| **Respect capacity**  | Consumers must not request more than the user's capacity   |
| **Handle adaptation** | Consumers must gracefully handle plan adaptations          |
| **Report feedback**   | Consumers must report execution outcomes                   |
| **Respect policies**  | Consumers must honor Execution Policies                    |
| **Explain decisions** | Consumers must provide explanation for execution decisions |

---

## Quality of Service

| Metric                    | Target                                                 |
| ------------------------- | ------------------------------------------------------ |
| **Plan generation**       | < 2 seconds for daily plan, < 10 seconds for full plan |
| **Schedule optimization** | < 1 second for schedule adjustments                    |
| **Adaptation response**   | < 1 second for micro-adaptations                       |
| **Feedback processing**   | < 500ms for task completion feedback                   |
| **Availability**          | 99.9% uptime                                           |

---

## Future Expansion

- **Real-time streaming** — Continuous execution status streaming for live dashboards
- **Proactive notifications** — Execution engine proactively alerts when plans need attention
- **Collaborative execution** — Shared plans with team progress visibility
- **Execution analytics API** — Deep execution pattern analysis and reporting
- **Integration webhooks** — External systems notified of execution events
