# Career Dashboard

> **Document:** DES-006-D02 — Career Operating System Experience  
> **Status:** 🔒 **LOCKED** — Part of DES-006 Career Constitution v1.0

---

## Purpose

The Career Dashboard is the user's career home — showing readiness, current focus, next steps, and progress at a glance. It answers within three seconds: "Where am I in my career? How ready am I? What should I do next?"

---

## Psychology

| Principle              | Application                                             |
| ---------------------- | ------------------------------------------------------- |
| **Progress principle** | Visible career progress is deeply motivating            |
| **Self-efficacy**      | Readiness score builds confidence to take action        |
| **Clarity**            | Clear next step reduces career anxiety                  |
| **Identity**           | Career is identity. The dashboard should feel personal. |

---

## Layout

```
┌────────────────────────────────────────────────────────┐
│  Career Dashboard                                       │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  CAREER READINESS                         80%   │   │
│  │  ████████████████████████████░░░░░░░░░░░       │   │
│  │  Skills: Strong  │  Experience: Good           │   │
│  │  [View Full Analysis]                          │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Current      │  │ Skill Growth │  │ Applications │  │
│  │ Focus        │  │ +3 this month│  │ 2 active     │  │
│  │ Career       │  │ [View]       │  │ 1 interview  │  │
│  │ Transition   │  └──────────────┘  └──────────────┘  │
│  │ [Continue]   │                                       │
│  └──────────────┘                                       │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Career Roadmap                                  │   │
│  │  [Stage 3 of 7 — Working Professional]           │   │
│  │  ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░      │   │
│  │  Next: Senior Role — Estimated 8 months          │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  AI Career Coach                                 │   │
│  │  "Your resume is ready for review. Want to       │   │
│  │   practice for your interview on Friday?"        │   │
│  │  [Talk to Coach]                                 │   │
│  └─────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

## States

| State                | Behavior                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| **Loading**          | Skeleton cards matching layout                                                                 |
| **Empty (new user)** | "Welcome to your Career Dashboard. Start by building your skill profile." with onboarding flow |
| **Error**            | Per-card recovery, never full failure                                                          |
| **Offline**          | Cached readiness data, no market insights                                                      |

---

## Cross-References

| Reference     | Relationship                                           |
| ------------- | ------------------------------------------------------ |
| DES-001 v1.0  | Design Constitution — colors, typography, spacing      |
| DES-002A v1.0 | Onboarding — career stage setup flows into dashboard   |
| DES-003A v1.1 | Dashboard — Career section on main dashboard           |
| DES-004 v1.0  | Memory & Knowledge — career timeline integration       |
| DES-005 v1.0  | AI Mentor — Career Coach presence                      |
| DES-006/D00   | Career Constitution — hierarchy rules                  |
| DES-006/D03   | Career Journey — roadmap integration                   |
| DES-006/D12   | AI Career Coach — coach presence                       |
| DES-006/D13   | Career Insights — insight cards on dashboard           |
| DES-006/D14   | Career Analytics — readiness score source              |
| ARC-001       | System Architecture — Career module integration        |
| ARC-002       | Information Architecture — Career data flow            |
| ARC-003       | Knowledge Graph — career skill connections             |
| ARC-004       | Execution Intelligence — career goal progress          |
| ARC-005       | AI Orchestration — career insight pipeline             |
| PRD-001       | Product Vision — Career as acquisition module          |
| PRD-002       | User DNA — career stage adaptation                     |
| ENG-001       | Domain Model — Career dashboard entities               |
| ENG-002       | Implementation Standards — Career interaction patterns |
| ENG-003       | AI Development Guidelines — Career AI ethics           |
| ENG-004       | Testing Standards — Career dashboard validation        |
