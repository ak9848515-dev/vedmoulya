# Life States

> **Document:** DES-010-D04 — Life Operating System Experience  
> **Status:** 🔒 **LOCKED** — Part of DES-010 Life OS Constitution v1.0

---

## Purpose

Life States define how the OS recognizes and adapts to the user's current state — focus, exploration, learning, execution, reflection, recovery, transition, or celebration — and smoothly transitions between them.

---

## Life State Model

```
                        ┌─────────────────────┐
                        │   WAKE / START      │
                        └──────────┬──────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
              ┌──────────┐  ┌──────────┐  ┌──────────┐
              │  FOCUS   │  │EXPLORE   │  │ LEARNING │
              │ High E   │  │Med E     │  │Med-High E│
              └─────┬────┘  └─────┬────┘  └─────┬────┘
                    │             │             │
                    └─────────────┼─────────────┘
                                  ▼
                          ┌──────────────┐
                          │  EXECUTION   │
                          │  High E      │
                          └──────┬───────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              ┌──────────┐ ┌──────────┐ ┌──────────┐
              │REFLECTION│ │ TRANSITION│ │CELEBRATE │
              │Low E     │ │Variable E │ │High E    │
              └─────┬────┘ └──────────┘ └─────┬────┘
                    │                         │
                    └────────────┬────────────┘
                                 ▼
                          ┌──────────────┐
                          │  RECOVERY    │
                          │  Very Low E  │
                          └──────────────┘
```

---

## State Definitions

### 1. Focus State

| Aspect               | Detail                                             |
| -------------------- | -------------------------------------------------- |
| **Energy**           | High                                               |
| **Focus**            | Single task                                        |
| **Trigger**          | User starts Today's Focus OR enters deep work mode |
| **Duration**         | 25-90 min (Pomodoro-style or flow-based)           |
| **AI Behavior**      | Minimal — only interrupt if critical               |
| **Visual**           | Clean, minimal UI; distractions hidden             |
| **Content Priority** | Execution > Learning > Everything else             |
| **Notifications**    | Blocked (except critical)                          |

### 2. Exploration State

| Aspect               | Detail                                            |
| -------------------- | ------------------------------------------------- |
| **Energy**           | Medium                                            |
| **Focus**            | Broad                                             |
| **Trigger**          | User browsing, weekend, or after completing focus |
| **Duration**         | Variable                                          |
| **AI Behavior**      | Suggest — inspire curiosity                       |
| **Visual**           | Rich discovery UI; multiple entry points          |
| **Content Priority** | Discovery > Career > Learning > Marketplace       |
| **Notifications**    | Enabled — discoveries welcome                     |

### 3. Learning State

| Aspect               | Detail                                                        |
| -------------------- | ------------------------------------------------------------- |
| **Energy**           | Medium-High                                                   |
| **Focus**            | Growth                                                        |
| **Trigger**          | User starts learning session OR AI suggests relevant learning |
| **Duration**         | 5-30 min (micro-learning)                                     |
| **AI Behavior**      | Teach — Socratic method, questions before answers             |
| **Visual**           | Learning-focused layout; Knowledge Map visible                |
| **Content Priority** | Learning > Practice > Apply > Review                          |
| **Notifications**    | Blocked during session                                        |

### 4. Execution State

| Aspect               | Detail                                               |
| -------------------- | ---------------------------------------------------- |
| **Energy**           | High                                                 |
| **Focus**            | Multiple tasks                                       |
| **Trigger**          | After Focus block; ongoing work mode                 |
| **Duration**         | 2-6 hours (afternoon)                                |
| **AI Behavior**      | Track — check progress, offer efficiency suggestions |
| **Visual**           | Task list, calendar, progress indicators             |
| **Content Priority** | Career > Business > Marketplace > Learning           |
| **Notifications**    | Enabled — but grouped, batched                       |

### 5. Reflection State

| Aspect               | Detail                                                        |
| -------------------- | ------------------------------------------------------------- |
| **Energy**           | Low                                                           |
| **Focus**            | Past                                                          |
| **Trigger**          | Evening, after completing significant work, or user-initiated |
| **Duration**         | 5-15 min                                                      |
| **AI Behavior**      | Listen — ask gentle questions, capture insights               |
| **Visual**           | Calm, warm; journal-like interface                            |
| **Content Priority** | Memory > Knowledge > Review > Preview                         |
| **Notifications**    | Blocked                                                       |

### 6. Recovery State

| Aspect               | Detail                                                      |
| -------------------- | ----------------------------------------------------------- |
| **Energy**           | Very Low                                                    |
| **Focus**            | Rest                                                        |
| **Trigger**          | After intense period, detected low activity, user-initiated |
| **Duration**         | Hours to days                                               |
| **AI Behavior**      | Silent — only respond when asked                            |
| **Visual**           | Minimal; no recommendations                                 |
| **Content Priority** | None — only essentials (critical notifications)             |
| **Notifications**    | All blocked (except urgent)                                 |

### 7. Transition State

| Aspect               | Detail                                                        |
| -------------------- | ------------------------------------------------------------- |
| **Energy**           | Variable                                                      |
| **Focus**            | Change                                                        |
| **Trigger**          | Life event (new job, move, etc.) OR significant career change |
| **Duration**         | Days to weeks                                                 |
| **AI Behavior**      | Guide — support the transition; reduce other content          |
| **Visual**           | Transition-focused; career/learning priority                  |
| **Content Priority** | Career > Learning > Planning > Everything else                |
| **Notifications**    | Transition-relevant only                                      |

### 8. Celebration State

| Aspect               | Detail                                                 |
| -------------------- | ------------------------------------------------------ |
| **Energy**           | High                                                   |
| **Focus**            | Achievement                                            |
| **Trigger**          | Milestone completion, goal achieved, positive feedback |
| **Duration**         | Brief (5-30 seconds)                                   |
| **AI Behavior**      | Acknowledge — quiet celebration, one message           |
| **Visual**           | Subtle accent animation, milestone card                |
| **Content Priority** | Milestone > Growth > Share                             |
| **Notifications**    | None — celebration is in-app only                      |

---

## State Transition Rules

| From        | To          | Trigger                       | Transition Duration    |
| ----------- | ----------- | ----------------------------- | ---------------------- |
| Any         | Focus       | User starts focus task        | 300ms                  |
| Focus       | Execution   | Focus completed               | 400ms                  |
| Execution   | Reflection  | Time (evening) OR user signal | 500ms                  |
| Reflection  | Recovery    | User signals rest             | 300ms                  |
| Recovery    | Focus       | User starts new day           | 1.5s (morning welcome) |
| Any         | Exploration | User browsing OR weekend      | 300ms                  |
| Any         | Learning    | User starts learning session  | 300ms                  |
| Any         | Transition  | Life event detected           | 500ms                  |
| Any         | Celebration | Milestone achieved            | 200ms (instant)        |
| Celebration | Previous    | Celebration dismissed         | 200ms                  |

---

## Accessibility

| Requirement      | Standard                          | Application               |
| ---------------- | --------------------------------- | ------------------------- |
| WCAG 2.1 AA      | All state transitions             | All 8 states accessible   |
| State indication | Text + icon                       | Never rely on color alone |
| Override access  | User can always access any module | State never blocks access |

---

## Quality Review

| Dimension                         | Assessment                                                                                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Why**                           | Life states are the foundation of adaptive OS behavior — they determine what, when, and how content is presented                                        |
| **Life Psychology Reasoning**     | State-dependent memory — people recall information better when in the same state; energy management — matching tasks to energy levels improves outcomes |
| **Human-Centered Reasoning**      | Users don't want to tell the OS their state — it should infer naturally; override must always be available                                              |
| **Accessibility Impact**          | State changes announced by screen reader; text-based state indicators; users can manually override state                                                |
| **Trust Impact**                  | Accurate state detection builds trust; wrong state inference feels intrusive; manual override is essential                                              |
| **Consistency with DES Missions** | Builds on DES-003 Daily Rhythm; extends to life-level states beyond daily rhythm                                                                        |
| **Implementation Complexity**     | Medium-High — requires state inference engine, behavior pattern detection, and smooth transitions                                                       |
| **Future Scalability**            | Can add new states (Grief, Growth, Building) as needed; ML improves state detection over time                                                           |

---

## Design Freeze Status

**DES-010-D04: Life States — LOCKED effective July 27, 2026.**
