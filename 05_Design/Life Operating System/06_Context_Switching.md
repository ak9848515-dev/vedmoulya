# Context Switching

> **Document:** DES-010-D06 — Life Operating System Experience  
> **Status:** 🔒 **LOCKED** — Part of DES-010 Life OS Constitution v1.0

---

## Purpose

Context Switching defines how users move naturally between life domains — career, learning, business, marketplace, memory, knowledge — without feeling like they are switching apps. Every transition should feel like the next step in their day, not a module change.

---

## Context Switching Philosophy

The average person switches between 5-7 apps per day for life management. Each switch costs ~23 minutes of focus recovery (American Psychological Association). The Life OS eliminates this cost by making context switching feel like natural progression.

**Users should never think "I need to open my Career module."**
**They should think "I need to prepare for my interview" — and the OS naturally flows there.**

---

## Natural Context Transitions

```
CURRENT CONTEXT           TRIGGER                       NATURAL NEXT
────────────────────      ──────────────────────────     ─────────────────────
Learning: "ML Course"     → "I should practice this"    → Career: Practice project
Career: "Job Search"      → "I need new skills"         → Learning: Skill course
Business: "Validation"    → "I need a partner"          → Marketplace: Partner match
Learning: "New concept"   → "Save this knowledge"       → Memory: Knowledge capture
Reflection: "Today"       → "Plan tomorrow"             → Execution: Tomorrow prep
Marketplace: "Proposal"   → "Review with mentor"        → AI Mentor: Coach session
Career: "Milestone"       → "Celebrate progress"        → Memory: Life chapter mark
Any: "Decision needed"    → "What are my options?"      → Decision: Analysis
```

---

## Transition Patterns

| Pattern    | Description                                 | Duration | Visual                |
| ---------- | ------------------------------------------- | -------- | --------------------- |
| **Deepen** | Stay in same domain, go deeper              | 200ms    | Content expand        |
| **Shift**  | Move to related domain                      | 300ms    | Slide to context      |
| **Widen**  | Broaden perspective to see connections      | 400ms    | Connections view      |
| **Return** | Back to previous context                    | 200ms    | Slide back            |
| **Jump**   | Intentional context change (user-initiated) | 150ms    | Instant (user choice) |

---

## Context Bar

A persistent, minimal context indicator that shows the user's current domain and related domains:

```
┌────────────────────────────────────────────────────────┐
│  ← Back to Focus    🎯 Learning: ML Course    🙋 Help  │
│                                                         │
│  Related:                                             │
│  📘 Career: ML Engineer path · 🤝 Marketplace:        │
│  ML projects · 🧠 Knowledge: Neural Networks          │
│                                                         │
│  [Switch to Career]  [Switch to Marketplace]           │
└──────────────────────────────────────────────────────────┘
```

| Aspect                | Rule                                                  |
| --------------------- | ----------------------------------------------------- |
| **Position**          | Top of screen, always accessible                      |
| **Content**           | Current domain + up to 3 related domains              |
| **Related selection** | Based on Knowledge Graph connections, recent activity |
| **User control**      | Can customize which related domains appear            |
| **Hidden when**       | In Focus state (to protect flow)                      |

---

## Cross-Module State Preservation

| Module      | State Preserved                                         | On Return                    |
| ----------- | ------------------------------------------------------- | ---------------------------- |
| Career      | Last viewed role, application progress, search filters  | Resume from last position    |
| Learning    | Last lesson, progress within module, active assessment  | Continue from last point     |
| Business    | Last venture page, client conversation, analytics view  | Resume from last interaction |
| Marketplace | Last opportunity viewed, proposal draft, search filters | Resume from last position    |
| Memory      | Last memory viewed, timeline position                   | Return to last memory        |
| Knowledge   | Last knowledge node, connections explored               | Return to last node          |
| AI Mentor   | Last conversation context, coaching mode                | Continue conversation        |

---

## Quality Review

| Dimension                     | Assessment                                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Why**                       | Context switching is the difference between module-based and life-based design — the frictionless transition is the OS's core value   |
| **Life Psychology Reasoning** | Attention residue — unfinished tasks linger; context preservation reduces residue; flow state — smooth transitions preserve immersion |
| **Human-Centered Reasoning**  | People think in narratives, not modules — "I finished learning, now I should apply it" is natural; "I should switch to Career" is not |
| **Accessibility Impact**      | Context bar is keyboard navigable; screen reader announces context changes; transitions are skippable                                 |
| **Trust Impact**              | Context awareness must be accurate — wrong context suggestions feel intrusive; user override always available                         |
| **Implementation Complexity** | High — requires context detection engine, state preservation across modules, and smooth animation orchestration                       |
| **Future Scalability**        | Can add predictive context switching (OS anticipates next context), learning from user patterns                                       |

---

## Motion

| Animation         | Duration | Easing   | Notes                   |
| ----------------- | -------- | -------- | ----------------------- |
| Deepen transition | 200ms    | ease-out | Content expand          |
| Shift transition  | 300ms    | ease-out | Slide to new context    |
| Widen transition  | 400ms    | ease-out | Connections view reveal |
| Return transition | 200ms    | ease-out | Slide back to previous  |
| Context bar slide | 250ms    | ease-out | Bar appears/disappears  |
| Reduced motion    | All 0ms  | —        | prefers-reduced-motion  |

---

## Design Freeze Status

**DES-010-D06: Context Switching — LOCKED effective July 27, 2026.**
