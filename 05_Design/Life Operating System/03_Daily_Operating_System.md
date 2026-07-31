# Daily Operating System

> **Document:** DES-010-D03 — Life Operating System Experience  
> **Status:** 🔒 **LOCKED** — Part of DES-010 Life OS Constitution v1.0

---

## Purpose

The Daily Operating System defines the user's daily rhythm — how the OS structures each day around Focus, Execution, Reflection, and Tomorrow, and how the Daily Brief surfaces the most relevant content from every module.

---

## Daily Rhythm (Extended from DES-003A)

| Time        | Mode       | Energy   | Goal                  | OS Behavior                     | AI State                     |
| ----------- | ---------- | -------- | --------------------- | ------------------------------- | ---------------------------- |
| 5:00-11:59  | Focus      | Highest  | Execute priority task | Daily Brief → Execution block   | Proactive — suggests focus   |
| 12:00-16:59 | Execution  | Moderate | Continue progress     | Execution block + check-ins     | Responsive — checks progress |
| 17:00-20:59 | Reflection | Low      | Process learning      | Reflection → Knowledge → Memory | Silent — waits for user      |
| 21:00-4:59  | Tomorrow   | Lowest   | Light planning        | Tomorrow preview → Sleep        | Silent — responds only       |

---

## Daily Brief (Life OS Integration)

The Daily Brief is the user's first meaningful interaction each day. It surfaces what matters TODAY across all modules — never everything, always what's relevant.

```
┌────────────────────────────────────────────────────────┐
│  Good morning, Alex.                                   │
│  Yesterday you completed Module 3 and got a new client.│
│  Today is another opportunity to move forward.         │
│                                                         │
│  ┌─── TODAY'S FOCUS ───────────────────────────────┐   │
│  │  🎯 Complete ML Model Prototype                  │   │
│  │  "This moves your career goal forward AND        │   │
│  │   unlocks your next learning module."            │   │
│  │  Estimated: 2 hours · Impact: High              │   │
│  │  [Begin]  [Why this?]  [Skip → Tomorrow]        │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─── TODAY'S CONTEXT ─────────────────────────────┐   │
│  │  🌱 Learn: Reinforcement Learning — 15 min       │   │
│  │  💼 Career: New ML role matches (3)              │   │
│  │  🚀 Business: Client milestone due Friday         │   │
│  │  🌟 Marketplace: 2 collaboration updates         │   │
│  │  🧠 Knowledge: 3 new connections in ML space     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [Start Day]  [Customize Brief]  [AI Coach]            │
└──────────────────────────────────────────────────────────┘
```

---

## Daily Brief Rules

| Aspect               | Rule                                                                               |
| -------------------- | ---------------------------------------------------------------------------------- |
| **Position**         | Appears after Morning Welcome                                                      |
| **Content**          | Today's Focus (hero) + Module context cards (max 5)                                |
| **Module selection** | Relevance-weighted: Focus → Knowledge → Learning → Career → Business → Marketplace |
| **Context cards**    | One line each, expandable on tap                                                   |
| **Why**              | Every card has a "Why this?" explanation                                           |
| **Dismiss**          | Cards can be hidden for the day                                                    |
| **Empty state**      | "A fresh day. What would you like to focus on?"                                    |
| **First day ever**   | "Welcome to your first day on VedMoulya."                                          |

---

## Module Context Cards

| Module                    | When Shown                                         | Example Content                                 |
| ------------------------- | -------------------------------------------------- | ----------------------------------------------- |
| **Learning (DES-007)**    | Active learning path OR relevant to Today's Focus  | "Reinforcement Learning — 15 min session ready" |
| **Career (DES-006)**      | New opportunity OR career goal progress update     | "3 new ML Engineer roles match your profile"    |
| **Business (DES-008)**    | Active venture OR client milestone approaching     | "Client deliverable due Friday — 60% complete"  |
| **Marketplace (DES-009)** | Collaboration update OR new high-match opportunity | "2 collaboration updates — 1 requires action"   |
| **Knowledge (DES-004)**   | New connections OR knowledge gaps identified       | "3 new connections discovered in ML space"      |
| **Memory (DES-004)**      | Significant date OR recent milestone               | "1 year since you started your ML journey"      |

---

## Cross-Module Trigger Map

Every Daily Brief card has a trigger that determined its relevance:

| Trigger Source        | Evaluates                          | Determines                     |
| --------------------- | ---------------------------------- | ------------------------------ |
| DES-003 (Dashboard)   | Today's Focus priority             | Hero card content              |
| DES-006 (Career)      | Career goal progress, new matches  | Career card presence           |
| DES-007 (Learning)    | Today's learning recommendation    | Learning card presence         |
| DES-008 (Business)    | Business stage, client milestones  | Business card presence         |
| DES-009 (Marketplace) | Collaboration updates, new matches | Marketplace card presence      |
| DES-004 (Memory)      | Significant dates, fresh knowledge | Memory/Knowledge card presence |

---

## Daily Flow Completion States

| State               | Behavior                                    | Follow-up                                     |
| ------------------- | ------------------------------------------- | --------------------------------------------- |
| **Focus completed** | Checkmark animation, gentle acknowledgment  | "Would you like to start your next priority?" |
| **All tasks done**  | Quiet celebration, nothing urgent remaining | Reflection prompt available                   |
| **Focus skipped**   | No pressure, moves to execution mode        | "Tomorrow's focus is ready when you are"      |
| **Day ended early** | Evening reflection available anytime        | "Would you like to reflect on your day?"      |
| **Missed day**      | Gentle acknowledgment next morning          | "Yesterday was quiet. Today is fresh."        |

---

## Quality Review

| Dimension                         | Assessment                                                                                                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Why**                           | The Daily Brief is the user's command center — it must be relevant, concise, and actionable                                                                     |
| **Life Psychology Reasoning**     | Decision fatigue reduction — presenting 1 focus + up to 5 context cards prevents overwhelm; framing effect — "Today is another opportunity" sets positive frame |
| **Human-Centered Reasoning**      | Users don't want to check 6 modules — they want one summary of what matters today                                                                               |
| **Accessibility Impact**          | Brief is fully keyboard navigable; screen reader announces items in priority order; skip transitions                                                            |
| **Trust Impact**                  | Relevance accuracy is critical — wrong suggestions erode trust quickly; "Why this?" transparency builds trust                                                   |
| **Consistency with DES Missions** | Extends DES-003A Daily Rhythm; integrates all module contexts naturally                                                                                         |
| **Implementation Complexity**     | High — requires cross-module aggregation, relevance scoring, personalization engine                                                                             |
| **Future Scalability**            | Can add weather, calendar events, news relevant to goals; weekend/holiday modes                                                                                 |

---

## Motion

| Animation            | Duration      | Easing   | Notes                     |
| -------------------- | ------------- | -------- | ------------------------- |
| Brief entry          | 400ms stagger | ease-out | Cards appear sequentially |
| Card expand          | 250ms         | ease-out | "Why this?" reveal        |
| Focus completion     | 600ms         | ease-out | Checkmark + transition    |
| Context card dismiss | 200ms         | ease-in  | Slide out                 |
| Reduced motion       | All 0ms       | —        | prefers-reduced-motion    |

---

## Design Freeze Status

**DES-010-D03: Daily Operating System — LOCKED effective July 27, 2026.**
