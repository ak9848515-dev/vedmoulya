# Execution Explainability

**ARC-004 — Document 09/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Execution Architect
**Created:** 2026-07-24
**Cross-references:** ARC-004/D01, ARC-004/D04, ARC-004/D05, ARC-003/D09, PRD-001, CMP-001

---

## Purpose

Execution Explainability defines how every execution decision — every plan, every priority, every schedule — can be **explained, understood, and trusted** by the user. An unexplainable execution system is an untrustworthy one.

---

## Scope

This document covers the conceptual explanation framework for Execution Intelligence. It does NOT define specific explanation generation algorithms or user interface patterns.

---

## Dependencies

- **ARC-004/D01** — Execution Intelligence (what is being explained)
- **ARC-004/D04** — Planning Framework (plans being explained)
- **ARC-004/D05** — Adaptive Planning (adaptation explanations)
- **ARC-003/D09** — Knowledge Explainability (knowledge used in explanations)

---

## The Explainability Imperative

Every execution decision should answer:

| Question                      | Purpose                                      |
| ----------------------------- | -------------------------------------------- |
| Why this goal?                | Establishes alignment with vision and values |
| Why now?                      | Establishes timing and priority              |
| Why this priority?            | Establishes trade-off reasoning              |
| Why this schedule?            | Establishes time and energy optimization     |
| Why these milestones?         | Establishes progress markers                 |
| What are the alternatives?    | Establishes that options were considered     |
| How confident are we?         | Establishes trust level                      |
| What is the expected outcome? | Establishes success criteria                 |

---

## What Must Be Explainable

### 1. Goal Selection

**Question:** Why is this goal active?

**Explanation components:**

- Which vision does this goal serve?
- What is the goal's priority ranking?
- What other goals were deprioritized for this?
- What is the expected impact of achieving this goal?
- What is the cost of not pursuing this goal?

**Example:** _"You selected the goal 'Build a freelance business' because it directly serves your vision of 'Financial independence through location-independent work'. This is currently your #1 priority based on your quarterly focus. The alternative goal 'Learn advanced Python' has been deprioritized to Q3."_

### 2. Task Prioritization

**Question:** Why is this task the most important thing to do right now?

**Explanation components:**

- Which goal does this task serve?
- How does this task advance the goal?
- Does this task have dependencies?
- Is there a deadline or time sensitivity?
- What is the cost of delaying this task?

**Example:** _"Completing your portfolio website is the top priority today because it is a dependency for your freelance applications this week. Without the portfolio, you cannot apply to the three opportunities that close on Friday."_

### 3. Schedule Allocation

**Question:** Why is this task scheduled at this time?

**Explanation components:**

- Energy level match (task difficulty vs. current energy)
- Available time window
- Location and resource availability
- Dependencies with other scheduled tasks
- Context (what comes before and after)

**Example:** _"Your deep work on the business plan is scheduled for 9-11 AM because this is your peak cognitive energy window. The literature review is scheduled for 3-4 PM, which matches your moderate energy pattern for reading tasks."_

### 4. Milestone Placement

**Question:** Why is this milestone set at this date?

**Explanation components:**

- Logical progression of work
- Historical pace from similar past work
- Dependency chain requirements
- External deadlines and constraints
- Buffer time included

**Example:** _"The MVP launch milestone is set for May 15 because it allows 6 weeks of development (based on your past project pace of 2 features/week), 1 week of testing, and includes a 1-week buffer for unexpected issues."_

### 5. Plan Adaptation

**Question:** Why did the plan change?

**Explanation components:**

- What changed in the context?
- How was the current plan affected?
- What adaptation options were considered?
- Why was this adaptation chosen?
- What is the new expected outcome?

**Example:** _"Your plan was adjusted because you reported low energy today (3/10). The high-focus task 'Write proposal' has been rescheduled to tomorrow morning. Today now focuses on low-energy tasks: email review, expense tracking, and planning."_

### 6. Goal Reprioritization

**Question:** Why did this goal's priority change?

**Explanation components:**

- What triggered the reprioritization?
- What was the goal's previous priority?
- Which goal(s) moved up/down?
- What is the impact on existing plans?

**Example:** _"Your goal 'Prepare for job interview' has been elevated to #1 priority because you received an interview invitation for next Tuesday. The goal 'Complete online course' has been moved to next week to free up preparation time."_

### 7. Capacity Limits

**Question:** Why can't I do more?

**Explanation components:**

- Current capacity assessment
- Existing commitments
- Energy and focus limitations
- Historical overcommitment patterns
- Policy compliance (no burnout)

**Example:** _"Your plan is at full capacity with 6 hours of scheduled work today. Adding more tasks would increase your risk of overcommitment based on your historical pattern — when you schedule more than 7 hours, your completion rate drops to 40%."_

---

## Explanation Depth Levels

| Level         | Description           | Components                                                 |
| ------------- | --------------------- | ---------------------------------------------------------- |
| **Simple**    | One-line explanation  | Goal, timing, priority                                     |
| **Standard**  | Key factors explained | Goal, priority, schedule rationale, alternatives           |
| **Detailed**  | Full reasoning        | All factors, context, trade-offs, confidence, alternatives |
| **Technical** | System-level          | Specific algorithms, models, data points used              |

---

## Alternative Explanations

Every execution decision must present alternatives:

| Decision           | Primary                    | Alternative 1                 | Alternative 2                |
| ------------------ | -------------------------- | ----------------------------- | ---------------------------- |
| **Goal priority**  | Learn React (top priority) | Build portfolio (alternative) | Apply for jobs (alternative) |
| **Task schedule**  | Deep work at 9 AM          | Deep work at 2 PM             | Split across two days        |
| **Milestone date** | May 15 (recommended)       | May 8 (aggressive)            | May 22 (conservative)        |

Each alternative includes:

- What it changes
- Why it was not selected
- What would need to change for it to become the primary

---

## Confidence Communication

| Level       | Indicator | Language                       | Action                  |
| ----------- | --------- | ------------------------------ | ----------------------- |
| **High**    | 4-5/5     | "We are confident that..."     | Follow the plan         |
| **Medium**  | 3/5       | "We believe that..."           | Be prepared to adapt    |
| **Low**     | 1-2/5     | "This is an estimate..."       | Review before executing |
| **Unknown** | N/A       | "We don't have enough data..." | User judgment required  |

---

## Success Criteria

Every plan and milestone includes success criteria:

| Criterion                           | Example                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------ |
| **What does success look like?**    | Portfolio website is live with 3 case studies                            |
| **How is it measured?**             | URL is accessible, case studies are published, design passes self-review |
| **What is the timeline?**           | May 15, 2026                                                             |
| **What indicates partial success?** | 2 of 3 case studies published by deadline                                |
| **What indicates failure?**         | Nothing published, major design issues                                   |

---

## Explanation Principles

| Principle        | Description                                          |
| ---------------- | ---------------------------------------------------- |
| **Default on**   | Explanations are provided by default, not on request |
| **Progressive**  | Start simple, allow deeper exploration               |
| **Respectful**   | Explanations never judge or pressure                 |
| **Honest**       | Always include confidence and limitations            |
| **Actionable**   | Explanations should help the user decide             |
| **Personalized** | Explanation style adapts to user preferences         |

---

## Future Expansion

- **Visual explanations** — Gantt charts, timelines, priority matrices showing plan reasoning
- **Comparative explanations** — Side-by-side comparison of alternative plans
- **What-if explanations** — "If you do X instead of Y, here is what changes"
- **Learning explanations** — "You consistently underestimate similar tasks — here is the adjustment"
- **Collaborative explanations** — Explain how team planning decisions were made
