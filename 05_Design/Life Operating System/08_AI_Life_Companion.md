# AI Life Companion

> **Document:** DES-010-D08 — Life Operating System Experience  
> **Status:** 🔒 **LOCKED** — Part of DES-010 Life OS Constitution v1.0

---

## Purpose

The AI Life Companion is the user's trusted guide across the entire Life Operating System — connecting modules, surfacing opportunities, providing context, summarizing progress, helping decisions, encouraging reflection, and coordinating execution. It should never dominate the experience. Sometimes the best action is silence.

---

## Companion Philosophy

The Life Companion is NOT an assistant, chatbot, or interface layer. It is a presence — aware, available, and occasionally insightful. It does not replace any module-specific coach (Career Coach, Learning Coach, etc.) but instead provides cross-module context that no single coach can provide.

**Where module coaches go deep, the Life Companion goes wide.**

---

## Companion Presence Across Modules

| Module                    | Companion Role      | When Active                     | When Silent             |
| ------------------------- | ------------------- | ------------------------------- | ----------------------- |
| **Dashboard (DES-003)**   | Context provider    | Daily Brief, transition moments | During Focus mode       |
| **Learning (DES-007)**    | Connection maker    | After learning sessions         | During active learning  |
| **Career (DES-006)**      | Opportunity spotter | New opportunities, progress     | During job applications |
| **Business (DES-008)**    | Strategic advisor   | Milestones, decisions           | During deep execution   |
| **Marketplace (DES-009)** | Trusted advisor     | Proposal help, risk detection   | During client work      |
| **Memory (DES-004)**      | Reflection partner  | Evening reflection              | During capture          |
| **Knowledge (DES-004)**   | Pattern recognizer  | New connections                 | During exploration      |
| **Decision (ARC-002)**    | Analysis partner    | Decision points                 | After decision made     |
| **Execution (ARC-004)**   | Progress tracker    | Task completion, delays         | During focused work     |

---

## Companion Communication Modes

| Mode           | Frequency     | Message Length | Tone        | Example                                                                                                              |
| -------------- | ------------- | -------------- | ----------- | -------------------------------------------------------------------------------------------------------------------- |
| **Brief**      | Daily Brief   | 1 sentence     | Informative | "Your ML project aligns with the course you took last week."                                                         |
| **Suggestion** | 2-3x/day      | 2-3 sentences  | Curious     | "I noticed you've been exploring data engineering roles. Want to discuss the skill gap?"                             |
| **Insight**    | 1x/day        | 3-5 sentences  | Thoughtful  | "Over the past month, your focus has shifted from learning to execution. Your project completion rate improved 30%." |
| **Question**   | When relevant | 1 sentence     | Reflective  | "What did you learn from the client meeting today?"                                                                  |
| **Silence**    | Default       | —              | —           | (Companion present but not speaking)                                                                                 |

---

## Companion Silence Rules

| Situation                 | Behavior                | Duration                |
| ------------------------- | ----------------------- | ----------------------- |
| Everything on track       | Silence = confidence    | Until something changes |
| User in Focus mode        | Avatar dims to 50%      | During Focus session    |
| No recommendation today   | "Nothing new" (honest)  | Until new relevance     |
| 3+ consecutive dismissals | Companion withdraws     | 24h                     |
| Before 7am or after 10pm  | No unsolicited messages | Per time window         |
| User in Recovery state    | Respond only            | Until state changes     |

---

## Cross-Module Context Assembly

The Companion assembles context from all modules to provide integrated guidance:

```
┌────────────────────────────────────────────────────────┐
│  🤖 Life Companion Insight                             │
│                                                         │
│  "Your ML project (Execution) is going well.            │
│  The course you completed last week (Learning)          │
│  introduced techniques you're now applying.             │
│  A new ML role (Career) matches your growing skills.    │
│  And you just gained a Knowledge connection             │
│  between Neural Networks and your current project."     │
│                                                         │
│  [Talk]  [Dismiss]  [Why this?]                         │
└──────────────────────────────────────────────────────────┘
```

---

## Companion State Machine

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  SLEEP   │───▶│  AWARE   │───▶│ THINKING │───▶│ STREAMING│
│  (idle)  │    │ (listen) │    │ (process)│    │(respond) │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
     ▲               │               │               │
     │               ▼               │               │
     │          ┌──────────┐         │               │
     │          │  SILENT  │◀────────┘               │
     │          │(withhold)│                         │
     │          └──────────┘                         │
     │               │                               │
     └───────────────┴───────────────────────────────┘
```

| State         | Visual                    | Behavior                                               | Transition To                         |
| ------------- | ------------------------- | ------------------------------------------------------ | ------------------------------------- |
| **Sleep**     | Avatar hidden             | No presence                                            | User activity → Aware                 |
| **Aware**     | Subtle pulse              | Listening, building context                            | Context trigger → Thinking OR Silence |
| **Thinking**  | Three dots, purple glow   | Processing, assembling context                         | 300ms-1.5s → Streaming                |
| **Streaming** | Text appears word by word | Delivering insight                                     | Complete → Aware                      |
| **Silent**    | Avatar dimmed             | Withholding — has something to say but chooses silence | Relevant change → Aware               |

---

## Quality Review

| Dimension                         | Assessment                                                                                                            |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Why**                           | The Life Companion is the integration layer's voice — it makes connectedness visible and valuable                     |
| **Life Psychology Reasoning**     | Anthropomorphism — humans naturally relate to companion-like interfaces; parasocial relationships increase engagement |
| **Human-Centered Reasoning**      | A companion that knows when to be silent is more trusted than one that always speaks; silence signals confidence      |
| **Accessibility Impact**          | All companion messages are text-based, screen reader accessible; typing indicator conveys thinking state              |
| **Trust Impact**                  | Honesty about uncertainty and silence builds more trust than constant suggestions; boundary respect is critical       |
| **Consistency with DES Missions** | Builds on DES-005 Mentor persona; extends to cross-module context; never replaces module coaches                      |
| **Implementation Complexity**     | High — requires cross-module context assembly, timing engine, personalization, and response validation                |
| **Future Scalability**            | Can add voice interaction, multi-language companion, emotional state detection                                        |

---

## Motion

| Animation          | Duration    | Easing   | Notes                   |
| ------------------ | ----------- | -------- | ----------------------- |
| Companion appear   | 300ms       | ease-out | Avatar fade in          |
| Thinking indicator | 300ms cycle | ease-out | Three dots, purple glow |
| Message streaming  | ~50ms/word  | linear   | Text appears naturally  |
| Silence transition | 200ms       | ease-out | Avatar dims to 50%      |
| Reduced motion     | All 0ms     | —        | prefers-reduced-motion  |

---

## Design Freeze Status

**DES-010-D08: AI Life Companion — LOCKED effective July 27, 2026.**
