# Decision Context

**Mission:** Define the complete context model that informs every decision made by the VedMoulya Decision Intelligence Engine.

**Version:** 1.0
**Status:** Draft
**Owner:** Chief Decision Intelligence Architect
**Dependencies:** Decision Intelligence.md, Decision Lifecycle.md, ARC-001 (Context Engine), PRD-002 (User DNA)
**Created:** 2026-07-24
**Updated:** 2026-07-24

## Description

Context is the situational awareness that transforms a generic decision into a personalized one. The same user may receive different decisions in different contexts. This document defines the five context types and how they combine to form the complete Decision Context Bundle.

---

## Context Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                    COMPLETE DECISION CONTEXT                         │
│                                                                     │
│  ┌──────────────┐                                                    │
│  │   STATIC     │  ┌─────────────────┐                              │
│  │   CONTEXT    │  │    DYNAMIC      │                              │
│  │              │  │    CONTEXT      │                              │
│  │  • Identity  │  │                 │                              │
│  │  • Education │  │  • Current mood │  ┌──────────────────────┐   │
│  │  • Location  │  │  • Energy level │  │    SESSION CONTEXT    │   │
│  │  • Language  │  │  • Recent events │  │                       │   │
│  │  • Career    │  │  • Today's tasks │  │  • Current screen     │   │
│  │    baseline  │  │  • Notifications │  │  • Interaction type   │   │
│  │              │  │  • Time of day   │  │  • Session duration   │   │
│  └──────────────┘  └─────────────────┘  │  • Device & platform  │   │
│                                          │  • Recent queries     │   │
│  ┌──────────────────────┐               └──────────────────────┘   │
│  │   ENVIRONMENTAL      │    ┌──────────────────┐                   │
│  │   CONTEXT            │    │   USER CONTEXT   │                   │
│  │                      │    │                   │                   │
│  │  • Time zone         │    │  • Available time │                   │
│  │  • Day of week       │    │  • Financial state│                   │
│  │  • Season            │    │  • Health state   │                   │
│  │  • Internet quality  │    │  • Social support │                   │
│  │  • Device capability │    │  • Life stage     │                   │
│  │  • Platform type     │    │  • Stress level   │                   │
│  └──────────────────────┘    └──────────────────┘                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Context Type 1: Static Context

**Definition:** Context attributes that change rarely or never. These form the baseline that all other context types build upon.

**Source:** User DNA (Identity, baseline declarations)

**Attributes:**

| Attribute           | Source   | Update Frequency | Example                      |
| ------------------- | -------- | ---------------- | ---------------------------- |
| Age group           | Declared | Annually         | 25-34                        |
| Location / Timezone | Declared | As needed        | UTC+5:30 (India)             |
| Primary language    | Declared | Rarely           | English, Hindi               |
| Education level     | Declared | Rarely           | Bachelor's degree            |
| Career baseline     | Declared | Annually         | 5 years in technology        |
| Industry            | Declared | Annually         | Software                     |
| Long-term goals     | Declared | Quarterly        | "Found a startup in 5 years" |
| Personality traits  | Assessed | Semi-annual      | OCEAN scores                 |

**Role in decisions:** Provides the stable foundation. Career decisions reference career baseline. Learning decisions reference education level. Communication decisions reference language.

---

## Context Type 2: Dynamic Context

**Definition:** Context attributes that change frequently — daily or session-to-session.

**Source:** User DNA (Context dimension), Behavioral Inference, Real-time signals

**Attributes:**

| Attribute            | Source   | Update Frequency | Example                                |
| -------------------- | -------- | ---------------- | -------------------------------------- |
| Current mood         | Inferred | Per session      | Focused, tired, motivated              |
| Energy level         | Inferred | Per session      | High, Medium, Low                      |
| Recent events        | Computed | Per event        | "Completed course, submitted proposal" |
| Today's tasks        | Computed | Daily            | "3 client calls, 1 deliverable"        |
| Recent notifications | System   | Per notification | "New opportunity match found"          |
| Time of day          | System   | Real-time        | 14:30                                  |
| Day of week          | System   | Daily            | Tuesday                                |
| Engagement streak    | Computed | Continuous       | 7-day streak                           |

**Role in decisions:** High-impact on timing and format. Low energy → recommend lighter tasks. Evening → recommend winding-down activities. Strong streak → leverage momentum.

---

## Context Type 3: Session Context

**Definition:** Context specific to the current user session — what they were doing, where they are in the app, what they just did.

**Source:** Session state, navigation history, recent interactions

**Attributes:**

| Attribute          | Source   | Update Frequency | Example                       |
| ------------------ | -------- | ---------------- | ----------------------------- |
| Current screen     | Session  | Per navigation   | Learning Dashboard            |
| Current module     | Session  | Per navigation   | 02_Learn                      |
| Interaction type   | Session  | Per action       | Browsing, Searching, Reading  |
| Session duration   | Session  | Continuous       | 12 minutes                    |
| Session goal       | Inferred | Per session      | "Looking for courses"         |
| Recent queries     | Session  | Per search       | "machine learning courses"    |
| Recent completions | Session  | Per completion   | "Completed Python assessment" |
| Device type        | Session  | Per session      | Mobile, Desktop               |
| Platform           | Session  | Per session      | iOS, Web, Android             |

**Role in decisions:** Determines immediate relevance. User on Learning page → prioritize learning recommendations. User searching for ML → prioritize ML content. User on mobile → format for mobile consumption.

---

## Context Type 4: Environmental Context

**Definition:** External factors that affect what decisions are practical or relevant.

**Source:** System signals, device APIs, external data

**Attributes:**

| Attribute         | Source   | Update Frequency | Example                         |
| ----------------- | -------- | ---------------- | ------------------------------- |
| Time zone         | Device   | Per session      | UTC+5:30                        |
| Day of week       | System   | Daily            | Tuesday                         |
| Date/Season       | System   | Daily            | July (Monsoon in India)         |
| Internet quality  | Device   | Continuous       | High, Medium, Low, Intermittent |
| Device capability | Device   | Per session      | High-end phone, Low-end tablet  |
| Platform type     | Device   | Per session      | Mobile, Desktop, Tablet         |
| App version       | System   | Per session      | 2.3.1                           |
| Holiday/event     | External | Daily            | Diwali, New Year                |
| Connectivity mode | Device   | Continuous       | WiFi, Cellular, Offline         |

**Role in decisions:** High-impact on feasibility. Offline → no video content. Low-end device → no heavy graphics. Intermittent internet → downloadable content only. National holiday → adjust scheduling expectations.

---

## Context Type 5: User Context

**Definition:** The user's self-reported or inferred state regarding their capacity and readiness.

**Source:** User DNA (Context dimension), explicit declarations, behavioral inference

**Attributes:**

| Attribute           | Source              | Update Frequency | Example                         |
| ------------------- | ------------------- | ---------------- | ------------------------------- |
| Available time      | Declared            | Weekly           | 10 hours/week                   |
| Financial state     | Declared (optional) | Monthly          | Stable, Stretched               |
| Health state        | Inferred            | Continuous       | Good, Tired, Sick               |
| Social support      | Declared (optional) | Annually         | Strong network                  |
| Life stage          | Declared            | Annually         | Early Career, Parent            |
| Stress level        | Inferred            | Continuous       | Low, Moderate, High             |
| Motivation level    | Inferred            | Continuous       | High, Medium, Low               |
| Confidence level    | Inferred            | Continuous       | High in career, Low in learning |
| Primary constraints | Declared            | Quarterly        | Time, Money, Access, Energy     |

**Role in decisions:** Strongest influence on readiness. 5 hrs/week available → recommend shorter sessions. Stretched financially → free resources only. High stress → recommend restorative activities. Low confidence → recommend beginner-friendly content.

---

## Decision Context Bundle

The complete context bundle passed to the Decision Engine:

```json
{
  "static": {
    "ageGroup": "25-34",
    "timezone": "UTC+5:30",
    "language": "en-IN",
    "careerBaseline": "tech_5_years"
  },
  "dynamic": {
    "mood": "focused",
    "energy": "high",
    "recentEvents": ["course_completed", "assessment_passed"],
    "timeOfDay": "14:30",
    "dayOfWeek": "tuesday",
    "engagementStreak": 7
  },
  "session": {
    "currentScreen": "learning_dashboard",
    "currentModule": "02_Learn",
    "interactionType": "browsing",
    "sessionDuration": 12,
    "recentQuery": "machine learning courses",
    "device": "mobile",
    "platform": "android"
  },
  "environment": {
    "internetQuality": "high",
    "deviceCapability": "high_end",
    "connectivity": "wifi",
    "nationalHoliday": false
  },
  "user": {
    "availableHoursPerWeek": 10,
    "financialState": "stable",
    "stressLevel": "moderate",
    "primaryConstraint": "time",
    "motivationLevel": "high"
  }
}
```

## Context Freshness Rules

| Context Type    | Max Age Before Refresh | Stale Action                  |
| --------------- | ---------------------- | ----------------------------- |
| Static          | 30 days                | Flag for user verification    |
| Dynamic         | 1 hour                 | Re-infer from recent behavior |
| Session         | Real-time              | Always current                |
| Environmental   | 5 minutes              | Re-check device state         |
| User (declared) | 7 days                 | Prompt for update             |
| User (inferred) | 1 day                  | Re-infer from recent behavior |

## Cross-References

- **Decision Lifecycle.md** — Context is collected in Phase 1
- **Decision Scoring.md** — Context dimensions influence scoring weights
- **Decision Confidence.md** — Context freshness affects confidence
- **Decision Intelligence.md** — Context philosophy
- **ARC-001 (Context Engine)** — The system component that assembles context
- **ARC-001 (Event Flow)** — Events that trigger context updates
- **PRD-002 (User DNA)** — Context is the Context dimension of User DNA

### Future Expansion

- **Social Context** — What the user's network is doing (social proof)
- **Market Context** — Real-time market conditions (demand, pricing)
- **Cultural Context** — Cultural norms and expectations
- **Temporal Context** — Life phase, career phase, learning phase
- **Predictive Context** — What the user is likely to need next (pre-emptive context)
- **PRD-001 (Human Journey)** — Journey stage determines which context is relevant
- **RSH-001 (Human Problems)** — Active problems inform context priority
- **CMP-001** — Business priorities influence environmental context interpretation
