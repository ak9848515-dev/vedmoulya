# Planning Framework

**ARC-004 — Document 04/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Execution Architect
**Created:** 2026-07-24
**Cross-references:** ARC-004/D01, ARC-004/D02, ARC-004/D03, ARC-004/D05, PRD-001, ARC-001

---

## Purpose

The Planning Framework defines the **different levels of planning** that Execution Intelligence supports — from long-term strategic direction to today's specific actions. Each planning level has its own purpose, horizon, granularity, and cadence.

---

## Scope

This document covers the conceptual taxonomy of planning levels, how they relate to each other, and when each level is used. It does NOT define planning algorithms, optimization models, or scheduling logic.

---

## Dependencies

- **ARC-004/D01** — Execution Intelligence (foundational concepts)
- **ARC-004/D02** — Execution Lifecycle (where planning fits in the lifecycle)
- **ARC-004/D03** — Goal Decomposition (how goals are broken down for planning)
- **ARC-004/D05** — Adaptive Planning (how plans change)
- **ARC-003** — Knowledge Graph (capability and history data for planning)

---

## Planning Levels

```
Level                    Horizon           Granularity         Cadence
────────────────────────────────────────────────────────────────────────
Strategic Planning       2-5 years         Goals               Annual
    │
    ▼
Tactical Planning        3-12 months       Projects            Quarterly
    │
    ▼
Operational Planning     1-4 weeks         Tasks               Weekly
    │
    ▼
Daily Planning           1 day             Actions             Daily
    │
    ▼
Adaptive Planning        Real-time         Adjustments         Continuous
```

---

## Level 1: Strategic Planning

**Purpose:** Define the long-term direction. Strategic planning answers: _Where am I going? What matters most? What will my life look like in 5 years?_

**Horizon:** 2-5 years
**Granularity:** Goals and visions
**Cadence:** Annual (with quarterly reviews)
**Owner:** User (with AI support)

**Key activities:**

- Define or revisit the vision
- Set or adjust long-term goals
- Assess alignment with personal values and purpose
- Evaluate major life domains (career, business, skills, health, relationships)
- Make fundamental trade-off decisions

**Outputs:**

- Updated vision statement
- Set of long-term goals with priorities
- Domain-level focus areas
- Major milestone targets

**Success criteria:**

- Goals are aligned with vision and values
- Trade-offs are conscious and intentional
- Direction is clear, even if details are not

---

## Level 2: Tactical Planning

**Purpose:** Translate strategic direction into **concrete projects and quarterly objectives**. Tactical planning answers: _What will I achieve this quarter? What projects move me toward my goals?_

**Horizon:** 3-12 months
**Granularity:** Projects and quarterly goals
**Cadence:** Quarterly
**Owner:** User + AI collaboration

**Key activities:**

- Decompose annual goals into quarterly objectives
- Define projects that achieve quarterly objectives
- Allocate resources (time, money, energy) to projects
- Sequence projects based on dependencies and priorities
- Identify risks and mitigation strategies

**Outputs:**

- Quarterly objectives (3-5 per quarter)
- Project definitions with scope and deliverables
- Resource allocation plan
- Risk register

**Success criteria:**

- Quarterly objectives directly serve annual goals
- Projects are realistically scoped
- Resource allocation matches available capacity

---

## Level 3: Operational Planning

**Purpose:** Convert tactical plans into **weekly execution blueprints**. Operational planning answers: _What will I do this week? What tasks move my projects forward?_

**Horizon:** 1-4 weeks
**Granularity:** Tasks and weekly goals
**Cadence:** Weekly
**Owner:** AI-driven (user confirms)

**Key activities:**

- Decompose monthly goals into weekly objectives
- Break projects into individual tasks
- Assign tasks to specific days
- Estimate time requirements for each task
- Balance workload across the week

**Outputs:**

- Weekly goals with success criteria
- Task list with time estimates
- Day-level task assignments
- Priority ordering

**Success criteria:**

- Each task is completable in 30-90 minutes
- Weekly workload matches available capacity
- High-priority tasks are scheduled first

---

## Level 4: Daily Planning

**Purpose:** Create the **day's executable plan**. Daily planning answers: _What am I doing today? What matters most? What can I actually complete?_

**Horizon:** 1 day
**Granularity:** Actions and time blocks
**Cadence:** Daily (morning or previous evening)
**Owner:** User (AI provides recommendations)

**Key activities:**

- Review weekly plan and adjust for context
- Select today's most important tasks (1-3 MITs)
- Time-block tasks based on energy and schedule
- Include buffers and breaks
- Review and confirm

**Outputs:**

- Daily task list (prioritized)
- Time-blocked schedule
- Top 1-3 most important tasks (MITs)
- Context notes (location, resources, prep needed)

**Success criteria:**

- Tasks fit comfortably in available time
- MITs are clearly identified and prioritized
- The plan is achievable, not aspirational

---

## Level 5: Adaptive Planning

**Purpose:** Adjust plans in **real-time** as circumstances change. Adaptive planning answers: _Something changed — what do I do now?_

**Horizon:** Real-time
**Granularity:** Adjustments
**Cadence:** Continuous
**Owner:** AI-driven (with user confirmation)

**Details:** See Document 05 (Adaptive Planning) for the complete treatment of this level.

**Key activities:**

- Detect change events (interruption, new priority, unexpected opportunity)
- Assess impact on current plan
- Generate alternative adjustments
- Recommend best adjustment
- User confirms or modifies

**Outputs:**

- Adjusted plan for the remainder of the day/week
- Updated priorities
- Rescheduled tasks

---

## Additional Planning Modes

### Opportunity Planning

**Purpose:** Capitalize on unexpected opportunities without derailing existing plans.

**Trigger:** A new opportunity appears that is aligned with goals.

**Approach:**

- Assess opportunity value vs. disruption cost
- Determine if existing tasks can be rescheduled
- If accepted, integrate into current plan
- If declined, capture for future consideration

### Recovery Planning

**Purpose:** Get back on track after a disruption, missed deadline, or unexpected event.

**Trigger:** A plan has been significantly disrupted.

**Approach:**

- Assess what was lost (time, progress, momentum)
- Determine what is still achievable
- Create a recovery plan with adjusted scope or timeline
- Focus on rebuilding momentum

### Priority Planning

**Purpose:** Make explicit trade-off decisions when capacity is limited.

**Trigger:** More work exists than capacity allows.

**Approach:**

- List all competing priorities
- Assess each against goals and values
- Identify what will be delayed or dropped
- Make conscious, documented trade-off decisions

---

## Planning Principles

| Principle                   | Description                                                 |
| --------------------------- | ----------------------------------------------------------- |
| **Top-down**                | Higher-level plans constrain lower-level plans              |
| **Bottom-up feedback**      | Reality from lower levels informs higher-level adjustments  |
| **Appropriate granularity** | Each level has the right level of detail — no more, no less |
| **Capacity-aware**          | Every level respects the person's available capacity        |
| **Buffer-aware**            | Every level includes buffer for uncertainty                 |
| **Review cadence**          | Each level has a natural review rhythm                      |
| **Flexible**                | Any level can be adjusted independently                     |
| **Traceable**               | Every lower-level plan can be traced to a higher-level goal |

---

## Planning Relationships

```
Strategic Plan (Annual)
    │
    ├── Tactical Plan Q1 (Jan-Mar)
    │       │
    │       ├── Week 1-4: Project Alpha
    │       │       │
    │       │       ├── Mon: Task A1, Task A2
    │       │       ├── Tue: Task A3, Task A4
    │       │       └── ...
    │       │
    │       ├── Week 5-8: Project Beta
    │       └── Week 9-12: Project Gamma
    │
    ├── Tactical Plan Q2 (Apr-Jun)
    └── ...
```

Every task in a daily plan traces up to a weekly goal, which traces up to a quarterly objective, which traces up to a long-term goal, which traces up to a vision.

---

## Future Expansion

- **Automated strategic planning** — AI suggests strategic directions based on patterns
- **Multi-person planning** — Team and family planning coordination
- **Scenario planning** — What-if analysis for different planning decisions
- **Historical pattern planning** — Plans optimized based on historical execution data
- **Goal-based auto-planning** — AI generates complete plans from goals
