# Life Flow

> **Document:** DES-010-D02 — Life Operating System Experience  
> **Status:** 🔒 **LOCKED** — Part of DES-010 Life OS Constitution v1.0

---

## Purpose

Life Flow defines the complete user journey from waking up to ending the day — how every VedMoulya module weaves together into one continuous, natural life experience. Every transition should feel like life progression, not module switching.

---

## Complete Daily Flow

```
MORNING (5:00 - 11:59)
  │
  ├── WAKE (passive — OS detects activity)
  │
  ├── [OS transition: Sleep → Morning]
  │   ├── Greeting appears: "Good morning, [Name]."
  │   ├── Atmosphere shifts to morning mode
  │   └── AI Companion state: Available (proactive)
  │
  ├── MORNING WELCOME (DES-003A)
  │   ├── Stage 1: Greeting (700ms)
  │   ├── Stage 2: Acknowledgment — yesterday's progress (500ms)
  │   ├── Stage 3: Frame — today's opportunity (400ms)
  │   └── Stage 4: Today's Focus appears
  │
  ├── DAILY BRIEF (Life OS — NEW)
  │   ├── Today's Focus (DES-003) — hero card
  │   ├── 🌱 Learning Moment — if relevant to today's focus (DES-007)
  │   ├── 💼 Career Opportunity — if relevant (DES-006)
  │   ├── 🚀 Business Opportunity — if relevant (DES-008)
  │   ├── 🌟 Marketplace Activity — if relevant (DES-009)
  │   ├── 🧠 Knowledge Update — new connections (DES-004)
  │   └── 🤖 AI Insight — one line from Life Companion
  │
  ├── [EXECUTION BLOCK]
  │   ├── Deep work on Today's Focus (DES-003)
  │   ├── AI tracks progress silently
  │   ├── Distraction? AI offers gentle re-focus
  │   └── Completion: "Focus complete" — optional next action
  │
  ├── [LEARNING MOMENT]
  │   ├── AI suggests learning relevant to today's work (DES-007)
  │   ├── 5-15 minute micro-learning session
  │   ├── Knowledge captured automatically (DES-004)
  │   └── Connection to existing knowledge shown
  │
  ├── [CAREER/BUSINESS CHECK-IN]
  │   ├── Career: progress toward goals, new opportunities (DES-006)
  │   ├── Business: venture status, client updates (DES-008)
  │   └── Marketplace: new matches, collaboration updates (DES-009)
  │
  └── [OS transition: Morning → Afternoon]

AFTERNOON (12:00 - 16:59)
  │
  ├── [OS transition: Morning → Afternoon]
  │   ├── Atmosphere shifts subtly
  │   ├── AI Companion state: Responsive
  │   └── Energy check (optional): "How's your energy?"
  │
  ├── [EXECUTION BLOCK]
  │   ├── Meeting/collaboration support
  │   ├── Decision support (if decisions needed)
  │   ├── Progress tracking
  │   └── Task completion + celebration (quiet)
  │
  ├── [KNOWLEDGE UPDATE]
  │   ├── New knowledge connections discovered
  │   ├── Memory capture (if significant event)
  │   └── Knowledge Garden preview update
  │
  └── [OS transition: Afternoon → Evening]

EVENING (17:00 - 20:59)
  │
  ├── [OS transition: Afternoon → Evening]
  │   ├── Atmosphere shifts to evening mode
  │   ├── AI Companion state: Silent (waits for user)
  │   └── Reflection prompt appears (gentle)
  │
  ├── [REFLECTION]
  │   ├── What did I accomplish today?
  │   ├── What did I learn?
  │   ├── What challenged me?
  │   ├── How do I feel about today?
  │   └── AI captures insights (with permission)
  │
  ├── [KNOWLEDGE & MEMORY]
  │   ├── Memory capture from today
  │   ├── Knowledge connections made
  │   └── One thing to remember
  │
  ├── [DECISION REVIEW]
  │   ├── Decisions made today
  │   ├── Outcomes so far
  │   └── Tomorrow's decisions preview
  │
  └── [OS transition: Evening → Night]

NIGHT (21:00 - 4:59)
  │
  ├── [OS transition: Evening → Night]
  │   ├── Atmosphere shifts to night
  │   ├── AI Companion state: Silent (responds only)
  │   └── Content minimized
  │
  ├── [TOMORROW PLANNING]
  │   ├── Light preview of tomorrow
  │   ├── One priority suggestion
  │   └── All good? OS steps back
  │
  └── [SLEEP — OS goes idle]
```

---

## Key Flow Principles

| Principle                         | Implementation                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| **Never ask "what module?"**      | Module names are invisible — content is organized by life context, not system structure |
| **Transitions are contextual**    | Morning → Afternoon feels like progress, not a tab switch                               |
| **Content appears when relevant** | Learning appears when user has time, not because it's scheduled                         |
| **Silence is the default**        | AI speaks when it has value, not because it can                                         |
| **Completion is quiet**           | Celebrations are subtle, never interrupt flow                                           |
| **Every transition is skippable** | Users control pace; never forced through flows                                          |

---

## Transition Triggers

| Transition          | Trigger                                    | Duration    | Content Shift                        |
| ------------------- | ------------------------------------------ | ----------- | ------------------------------------ |
| Sleep → Morning     | User activity detected (first interaction) | 1.5s staged | Greeting, Daily Brief appears        |
| Morning → Afternoon | Time (12:00) OR lunch check-in             | 500ms       | Energy check, execution focus        |
| Afternoon → Evening | Time (17:00) OR reflection trigger         | 500ms       | Reflection prompt, knowledge capture |
| Evening → Night     | Time (21:00) OR user signals end           | 500ms       | Minimal content, tomorrow preview    |
| Weekend             | Day detection                              | —           | Relaxed pace, more exploration       |
| Vacation            | Calendar detection                         | —           | Minimal content, recovery mode       |
| High workload       | Calendar + execution signals               | —           | Focus mode, minimal suggestions      |

---

## Accessibility

| Requirement         | Standard                   | Application                          |
| ------------------- | -------------------------- | ------------------------------------ |
| WCAG 2.1 AA         | All flow screens           | All transitions, briefs, reflections |
| Body text minimum   | 16px (never below)         | All content                          |
| Touch targets       | 44×44px minimum            | All intractable elements             |
| Keyboard navigation | 100% of interactions       | Flow navigation, skip transitions    |
| Screen reader       | All flow content announced | Briefs, reflections, transitions     |
| Reduced motion      | All animations disabled    | All transitions 0ms                  |

---

## Motion

| Animation                 | Duration      | Easing   | Notes                             |
| ------------------------- | ------------- | -------- | --------------------------------- |
| OS transition (morning)   | 1500ms staged | ease-out | Greeting → Acknowledgment → Frame |
| OS transition (afternoon) | 500ms         | ease-out | Atmosphere shift                  |
| OS transition (evening)   | 500ms         | ease-out | Atmosphere + reflection shift     |
| OS transition (night)     | 500ms         | ease-out | Content fade                      |
| Daily Brief appear        | 300ms stagger | ease-out | Items appear one by one           |
| Focus completion          | 600ms         | ease-out | Checkmark + gentle celebration    |
| Reflection prompt         | 300ms         | ease-out | Gentle slide in                   |
| Reduced motion            | All 0ms       | —        | prefers-reduced-motion            |

---

## Personalization

| Dimension         | Life Flow Impact                                |
| ----------------- | ----------------------------------------------- |
| User DNA          | Flow pace, communication style, content density |
| Purpose           | Which modules appear in Daily Brief             |
| Career Stage      | Career content priority in flow                 |
| Learning Progress | Learning insertion timing and depth             |
| Business Maturity | Business content visibility                     |
| Time of Day       | Flow mode (Focus/Execution/Reflection/Tomorrow) |
| Energy Level      | Content density and AI proactivity              |
| Recent Activity   | Context-aware content surfacing                 |

---

## Quality Review

| Dimension                         | Assessment                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Why**                           | Life Flow is the core user experience — it defines how users experience VedMoulya as one life                      |
| **Life Psychology Reasoning**     | Flow state research shows that task switching costs 23 min to recover focus; natural transitions preserve momentum |
| **Human-Centered Reasoning**      | People think in life context (morning, work, evening), not app context — the OS should reflect this                |
| **Accessibility Impact**          | Staged transitions give screen reader users time to process; skip options for all animations                       |
| **Trust Impact**                  | Predictable daily rhythm builds trust; OS never surprises or interrupts flow                                       |
| **Consistency with DES Missions** | Builds on DES-003 Daily Rhythm; extends to full day with all modules                                               |
| **Implementation Complexity**     | High — requires orchestration across all modules, state management, timing engine                                  |
| **Future Scalability**            | Can add life event flows (moving, new job, having a child); weekly/monthly/quarterly rhythm                        |

---

## Design Freeze Status

**DES-010-D02: Life Flow — LOCKED effective July 27, 2026.**
