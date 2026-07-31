# Execution Context

**ARC-004 — Document 06/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Execution Architect
**Created:** 2026-07-24
**Cross-references:** ARC-004/D01, ARC-004/D04, ARC-004/D05, ARC-003, PRD-001

---

## Purpose

Execution Context defines the **situational factors** that influence when, how, and how effectively the user can execute. No plan exists in a vacuum — every execution happens within a specific context that shapes what is possible.

---

## Scope

This document covers the conceptual context dimensions that Execution Intelligence considers. It does NOT define how context is measured, captured, or modeled.

---

## Dependencies

- **ARC-004/D01** — Execution Intelligence (foundation)
- **ARC-004/D04** — Planning Framework (how context influences planning)
- **ARC-004/D05** — Adaptive Planning (context changes trigger adaptation)
- **ARC-003** — Knowledge Graph (stores historical context patterns)

---

## Context Dimensions

```
                    ┌─────────────────────────────────────┐
                    │          EXECUTION CONTEXT           │
                    ├─────────────────────────────────────┤
                    │  Time     Energy    Focus    Health  │
                    │  Location  Resources  Money         │
                    │  Knowledge Commitments  Environment │
                    └─────────────────────────────────────┘
```

---

## Dimension 1: Time

**Definition:** The available time windows for execution.

**Components:**

| Component           | Description                                          |
| ------------------- | ---------------------------------------------------- |
| **Available hours** | Total hours available for work/execution per day     |
| **Blocked time**    | Fixed commitments (meetings, appointments, routines) |
| **Best hours**      | Preferred work windows (morning, afternoon, evening) |
| **Deadlines**       | Time-sensitive commitments with fixed dates          |
| **Buffer time**     | Unallocated time for unexpected events               |

**How it affects execution:**

- Determines how many tasks can be scheduled
- Dictates when high-focus vs. low-focus tasks should be placed
- Creates natural boundaries for work periods
- Influences whether tasks should be broken down further

---

## Dimension 2: Energy

**Definition:** The user's mental and physical energy level.

**Energy States:**

| State        | Description                                | Best For                                              | Avoid                           |
| ------------ | ------------------------------------------ | ----------------------------------------------------- | ------------------------------- |
| **Peak**     | High cognitive function, creativity, focus | Complex problem-solving, creative work, deep learning | Routine, low-value tasks        |
| **Moderate** | Functional but not exceptional             | Standard work, communication, planning                | High-creativity work            |
| **Low**      | Reduced cognitive capacity                 | Routine tasks, review, organization                   | Decisions, learning, creativity |
| **Recovery** | Minimal energy, need rest                  | Rest, reflection, light organization                  | Any demanding work              |

**How it affects execution:**

- Peak energy tasks must be scheduled during the user's peak hours
- Low energy periods should be used for maintenance tasks
- Energy patterns can be learned and predicted over time
- The user's energy should not be treated as constant

---

## Dimension 3: Focus

**Definition:** The user's ability to concentrate on a single task.

**Focus States:**

| State              | Description                                         | Duration       |
| ------------------ | --------------------------------------------------- | -------------- |
| **Deep focus**     | Complete immersion, no distractions                 | 60-120 minutes |
| **Moderate focus** | Can concentrate with some awareness of surroundings | 30-60 minutes  |
| **Light focus**    | Easily distracted, multi-tasking possible           | 10-30 minutes  |
| **No focus**       | Cannot concentrate on anything productive           | N/A            |

**How it affects execution:**

- Deep focus tasks must be protected from interruptions
- Light focus periods are good for habit-based or routine work
- Focus duration varies by person, time of day, and task type
- Context switching between focus states has a cost

---

## Dimension 4: Health

**Definition:** The user's physical and mental health state.

**Components:**

| Component           | Impact                                                                   |
| ------------------- | ------------------------------------------------------------------------ |
| **Physical health** | Affects energy, endurance, ability to execute physically demanding tasks |
| **Mental health**   | Affects motivation, focus, decision quality                              |
| **Sleep quality**   | Directly impacts all other context dimensions                            |
| **Stress level**    | High stress reduces cognitive capacity and decision quality              |
| **Illness**         | May make execution impossible or counterproductive                       |

**How it affects execution:**

- Health always takes priority over execution — this is a core policy
- Plans must automatically adjust when health is impacted
- Health patterns inform capacity predictions
- The system should never encourage unhealthy execution

---

## Dimension 5: Location

**Definition:** Where the user is physically located.

**Location Types:**

| Type            | Characteristics                                 | Best For                      |
| --------------- | ----------------------------------------------- | ----------------------------- |
| **Home office** | Controlled environment, all resources available | Deep work, focused execution  |
| **Coworking**   | Professional environment, networking possible   | Standard work, meetings       |
| **Cafe**        | Public, moderate noise, limited resources       | Light work, reading, planning |
| **Commuting**   | Limited space, time-constrained                 | Review, reflection, learning  |
| **Traveling**   | Unfamiliar, limited resources                   | Light work, planning, rest    |

**How it affects execution:**

- Different tasks require different locations
- Location transitions have a time cost
- Resources available at each location vary
- The ideal location for a task can be suggested

---

## Dimension 6: Available Resources

**Definition:** The tools, materials, and support available for execution.

**Components:**

| Resource           | Description                                           |
| ------------------ | ----------------------------------------------------- |
| **Digital tools**  | Software, apps, platforms needed for tasks            |
| **Physical tools** | Equipment, materials, workspace                       |
| **Information**    | Documents, references, notes needed                   |
| **Support**        | People who can help (mentors, colleagues, assistants) |
| **Network**        | Access to relevant contacts and connections           |

**How it affects execution:**

- Tasks requiring unavailable resources must be rescheduled
- Resource preparation can be a separate task
- Missing resources can be identified and acquired

---

## Dimension 7: Money

**Definition:** Financial resources available for execution.

**Components:**

| Component                 | Impact                                            |
| ------------------------- | ------------------------------------------------- |
| **Budget**                | Money available for tools, courses, services      |
| **Investment capacity**   | Money available for business or career investment |
| **Financial constraints** | Limitations on what can be spent                  |
| **Income stability**      | Predictability of ongoing income                  |

**How it affects execution:**

- Some tasks require financial investment
- Financial constraints may require modifying plans
- Financial patterns inform realistic goal setting

---

## Dimension 8: Knowledge

**Definition:** What the user knows and can apply.

**Components:**

| Component                 | Source                                              |
| ------------------------- | --------------------------------------------------- |
| **Declarative knowledge** | Facts, concepts, theories (from Knowledge Graph)    |
| **Procedural knowledge**  | How-to, skills, techniques (from Knowledge Graph)   |
| **Tacit knowledge**       | Intuition, judgment (hard to capture)               |
| **Knowledge gaps**        | What the user needs to learn (from Knowledge Graph) |

**How it affects execution:**

- Tasks requiring unknown knowledge must include learning time
- Knowledge gaps can be identified and filled proactively
- Knowledge confidence affects task difficulty estimates

---

## Dimension 9: Current Commitments

**Definition:** All active obligations the user has.

**Components:**

| Component                 | Description                                     |
| ------------------------- | ----------------------------------------------- |
| **Goals**                 | Active goals being pursued                      |
| **Projects**              | Active projects with deliverables               |
| **Tasks**                 | Committed tasks with deadlines                  |
| **External commitments**  | Promises made to others                         |
| **Recurring obligations** | Regular commitments (bills, meetings, routines) |

**How it affects execution:**

- New tasks must fit within existing commitment capacity
- Overcommitment must be detected and flagged
- Trade-offs between commitments must be explicit

---

## Dimension 10: Environment

**Definition:** The broader environment surrounding execution.

**Components:**

| Component                    | Impact                                       |
| ---------------------------- | -------------------------------------------- |
| **Physical environment**     | Noise, comfort, lighting, space              |
| **Social environment**       | Support from family, friends, community      |
| **Professional environment** | Work culture, manager support, team dynamics |
| **Economic environment**     | Market conditions, industry trends           |
| **Seasonal factors**         | Time of year, holidays, weather              |

**How it affects execution:**

- Unsupportive environments reduce execution effectiveness
- Environmental changes may require plan adaptation
- Seasonal patterns can predict execution challenges

---

## Context Influence on Execution

```
Context Change → Which Plans Affected → Adaptation Needed
──────────────────────────────────────────────────────────
Low energy today    → Today's tasks         → Reschedule hard tasks
New commitment      → Weekly plan           → Reprioritize
Health issue        → Monthly goals         → Reduce scope
Moving location     → Weekly tasks          → Reschedule location-dependent tasks
Knowledge acquired  → Project timeline      → Update estimates
Budget change       → Learning goals        → Adjust course selection
```

---

## Context Principles

| Principle                | Description                                         |
| ------------------------ | --------------------------------------------------- |
| **Context is dynamic**   | Context changes continuously and unpredictably      |
| **Context is personal**  | Each user has unique context patterns               |
| **Context is learned**   | The system learns context patterns over time        |
| **Context is respected** | Plans must respect current context, not override it |
| **Context is captured**  | Context is recorded for pattern learning            |
| **Context is shared**    | Context flows through all VedMoulya systems         |

---

## Future Expansion

- **Context prediction** — Predict likely future context based on patterns
- **Context-based recommendations** — Recommend tasks based on good context fit
- **Automatic context capture** — Detect context changes automatically
- **Collaborative context** — Team members share relevant context
- **Context visualization** — Visual overview of current execution context
