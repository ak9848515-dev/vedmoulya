# Adaptive Planning

**ARC-004 — Document 05/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Execution Architect
**Created:** 2026-07-24
**Cross-references:** ARC-004/D01, ARC-004/D02, ARC-004/D04, ARC-004/D06, PRD-001, ARC-001

---

## Purpose

Adaptive Planning defines how Execution Intelligence **adjusts plans in response to changing circumstances**. Plans are not contracts — they are hypotheses about how to achieve goals. When reality differs from the hypothesis, the plan adapts.

---

## Scope

This document covers the conceptual triggers, types, and principles of adaptation. It does NOT define specific algorithms, optimization models, or rescheduling logic.

---

## Dependencies

- **ARC-004/D01** — Execution Intelligence (foundation)
- **ARC-004/D02** — Execution Lifecycle (where adaptation fits)
- **ARC-004/D04** — Planning Framework (what adapts)
- **ARC-004/D06** — Execution Context (context that triggers adaptation)
- **ARC-003** — Knowledge Graph (historical patterns for adaptation decisions)

---

## Why Plans Must Adapt

| Assumption                              | Reality                                 |
| --------------------------------------- | --------------------------------------- |
| Plans are made with perfect information | Information is always incomplete        |
| Circumstances remain stable             | Circumstances change constantly         |
| People execute consistently             | Energy, focus, and motivation fluctuate |
| Priorities are stable                   | Priorities shift with new information   |
| Time estimates are accurate             | Time estimates are always wrong         |

If plans never adapted, they would fail every time. Adaptation is not failure — it is the recognition that reality is dynamic.

---

## Plan Adaptation Triggers

### 1. Goal Reprioritization

**Trigger:** The user decides a different goal is more important right now.

**Effect:** Resources shift from lower-priority to higher-priority goals. Some projects may be paused or descoped.

**Response:**

- Assess impact on affected projects and milestones
- Reschedule or descope lower-priority work
- Update goal priorities in the Knowledge Graph
- Inform dependent goals and commitments

### 2. Unexpected Events

**Trigger:** An unforeseen event disrupts the plan (emergency, illness, family event, accident).

**Effect:** Some or all of the current plan becomes impossible.

**Response:**

- Pause all non-critical work
- Assess when normal execution can resume
- Create a recovery plan
- Communicate delays to any external commitments

### 3. New Opportunities

**Trigger:** An unexpected opportunity appears that is more valuable than current planned work.

**Effect:** Resources may need to shift to capitalize on the opportunity.

**Response:**

- Assess opportunity value vs. disruption cost
- Determine which current work can be deferred
- If accepted, integrate into existing plans
- If declined, capture for future reference

### 4. Life Events

**Trigger:** Major life changes — new job, relocation, relationship change, health change.

**Effect:** The execution landscape fundamentally changes.

**Response:**

- Full reassessment of all goals and plans
- Update User DNA with new context
- Adjust all planning levels
- Set new baseline for execution

### 5. Schedule Conflicts

**Trigger:** Two or more commitments compete for the same time.

**Effect:** Not everything can be done at the planned time.

**Response:**

- Assess relative priority of conflicting items
- Reschedule lower-priority item
- If both are fixed, reallocate from buffer or descope something else

### 6. Energy Fluctuations

**Trigger:** The user's energy or focus level is different from expected (lower energy, higher energy, different pattern).

**Effect:** Task execution speed and quality vary.

**Response:**

- Adjust task difficulty to match energy level
- Reschedule cognitively demanding tasks to peak energy
- Convert to low-energy tasks if energy is low
- Capture energy pattern data for future scheduling

### 7. Motivation Shifts

**Trigger:** The user's motivation for a goal or task changes.

**Effect:** Tasks may feel harder or take longer without intrinsic motivation.

**Response:**

- Reconnect task to higher purpose or goal
- Reduce task size to make it less daunting
- Schedule during peak motivation windows
- Consider if the goal still matters

### 8. Learning Progress

**Trigger:** The user learns faster or slower than expected in a learning goal.

**Effect:** Timeline estimates become inaccurate.

**Response:**

- Adjust learning pace based on actual progress
- Extend or contract timelines
- Adjust resource allocation to learning vs. doing

### 9. Business Changes

**Trigger:** Changes in the business environment — market shifts, client changes, revenue changes.

**Effect:** Business goals and priorities may need adjustment.

**Response:**

- Reassess business goals against new reality
- Adjust financial plans, client work, and business development
- Update Knowledge Graph with business context

### 10. Career Changes

**Trigger:** Job change, promotion, role change, or career direction shift.

**Effect:** Career goals and skill development priorities may shift.

**Response:**

- Update career goals and trajectory
- Reassess skill gaps for new role
- Adjust learning and project plans
- Update portfolio and resume data

---

## Adaptation Levels

| Level                    | Scope                    | Response Time |
| ------------------------ | ------------------------ | ------------- |
| **Micro-adaptation**     | One task or time block   | Immediate     |
| **Daily adaptation**     | The day's remaining plan | Minutes       |
| **Weekly adaptation**    | The week's plan          | Hours         |
| **Monthly adaptation**   | The month's goals        | Days          |
| **Quarterly adaptation** | The quarter's objectives | Days to weeks |
| **Strategic adaptation** | Annual goals and vision  | Weeks         |

---

## Adaptation Process

```
                     ┌──────────────────────┐
                     │  Change Detected     │
                     └──────────┬───────────┘
                                ▼
                     ┌──────────────────────┐
                     │  Impact Assessment   │
                     │  What changed?       │
                     │  What is affected?   │
                     │  How urgent?         │
                     └──────────┬───────────┘
                                ▼
                     ┌──────────────────────┐
                     │  Option Generation   │
                     │  What can we do?     │
                     │  What are the        │
                     │  trade-offs?         │
                     └──────────┬───────────┘
                                ▼
                     ┌──────────────────────┐
                     │  Recommendation      │
                     │  Best option?        │
                     │  Why?                │
                     └──────────┬───────────┘
                                ▼
                     ┌──────────────────────┐
                     │  User Decision       │
                     │  Accept? Modify?     │
                     │  Reject?             │
                     └──────────┬───────────┘
                                ▼
                     ┌──────────────────────┐
                     │  Plan Updated        │
                     │  Changes applied     │
                     │  Impact propagated   │
                     └──────────┬───────────┘
                                ▼
                     ┌──────────────────────┐
                     │  Feedback Captured   │
                     │  Why did it change?  │
                     │  What was learned?   │
                     └──────────────────────┘
```

---

## Adaptation Principles

| Principle                       | Description                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------- |
| **Stability before adaptation** | Don't adapt to every small change — let the plan breathe                      |
| **Proportional response**       | Small changes get micro-adaptations; large changes get strategic reassessment |
| **User decides**                | The system recommends, the user decides                                       |
| **Traceable changes**           | Every adaptation records what changed and why                                 |
| **Momentum preservation**       | Preserve as much momentum as possible during adaptation                       |
| **Learning from adaptation**    | Every adaptation is a learning opportunity                                    |
| **No shame**                    | Adaptation is not failure — it is intelligent response to reality             |

---

## Future Expansion

- **Predictive adaptation** — Anticipate likely changes before they happen
- **Automated micro-adaptation** — Routine adjustments made automatically
- **Pattern-based adaptation** — Learn adaptation patterns from user behavior
- **Collaborative adaptation** — Team plans adapt together when one person's plan changes
- **Resilience scoring** — Measure how well the user's plans withstand disruption
