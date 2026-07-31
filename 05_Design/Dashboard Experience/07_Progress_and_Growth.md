# Progress & Growth

**DES-003 — Document 07/15 — Dashboard Experience**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Experience Officer (CXO)

---

## Purpose

The Progress & Growth section answers: **"How am I doing?"** and **"What progress have I made?"** It shows growth over time, celebrates consistency, and provides an at-a-glance view of the user's journey — without gamification, pressure, or comparison.

---

## Psychology

| Factor         | Design                                                                |
| -------------- | --------------------------------------------------------------------- |
| Emotion        | Pride + Momentum + Self-efficacy                                      |
| Cognitive Load | Low — one number, one trend direction, one comparison (self vs self)  |
| Trust Signal   | Progress is always user-referenced (past self), never peer-referenced |
| Key Insight    | Showing TREND (↑15%) not ABSOLUTE (72/100) increases motivation by 2x |

---

## Life Score

```text
LIFE SCORE — At-a-glance holistic progress indicator

┌────────────────────────────────────────────┐
│  Satoshi 600 SemiBold — 16px — #111827    │
│  Life Score                                │
│                                            │
│  space-2                                   │
│                                            │
│  ┌────────────────────────────────────┐   │
│  │  Satoshi 700 Bold — 32px — #2B5FD9│   │
│  │  78                                   │   │
│  │  Inter 400 Reg — 14px — #22C55E      │   │
│  │  ↑ 5 points this week                │   │
│  │                                       │   │
│  │  [Mini sparkline chart — 7 days]     │   │
│  │  Line color: #2B5FD9, area fill: 10%│   │
│  │  Width: 100px, height: 32px          │   │
│  └────────────────────────────────────┘   │
│                                            │
│  space-3                                   │
│                                            │
│  Inter 400 Regular — 14px — #64748B      │
│  "You're making steady progress across    │
│   your [purpose] journey."                │
│                                            │
│  [View details] Text link                  │
└────────────────────────────────────────────┘

SCORE COMPOSITION:
  • Goals (30%) — Completion rate, consistency
  • Skills (25%) — New skills acquired, proficiency growth
  • Knowledge (20%) — Knowledge graph expansion
  • Execution (15%) — Projects completed, tasks done
  • Growth (10%) — Learning hours, reflection consistency

CARD SPECS:
  bg: #FFFFFF, radius: 24px, shadow: Standard
  padding: space-6 (24px)
  Score updates: daily
```

---

## Journey Progress

```text
JOURNEY PROGRESS — Active journey visualization

┌────────────────────────────────────────────┐
│  Satoshi 600 SemiBold — 16px — #111827    │
│  Your Journey: [Journey Name]              │
│                                            │
│  space-3                                   │
│                                            │
│  ┌────────────────────────────────────┐   │
│  │  [Journey illustration]           │   │
│  │                                     │   │
│  │  ●───●───●───○───○───○───○     │   │
│  │  │   │   │   │   │   │   │      │   │
│  │  └───┴───┴───┘                   │   │
│  │  3 of 7 stages complete          │   │
│  │                                     │   │
│  │  Satoshi 700 Bold — 24px — #2B5FD9│   │
│  │  42%                                │   │
│  │  Inter 400 Reg — 14px — #64748B    │   │
│  │  "You're ahead of your timeline!"  │   │
│  └────────────────────────────────────┘   │
│                                            │
│  space-3                                   │
│                                            │
│  [Continue journey] Primary button         │
└────────────────────────────────────────────┘

JOURNEY TYPES:
  Career Path, Learning Track, Business Launch,
  Health Transformation, Financial Freedom, Custom Journey

Each journey has 3-7 stages with clear milestones.
```

---

## Weekly Momentum

```text
WEEKLY MOMENTUM — 7-day activity summary

┌────────────────────────────────────────────┐
│  Satoshi 600 SemiBold — 16px — #111827    │
│  This Week                                 │
│                                            │
│  space-3                                   │
│                                            │
│  ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┐│
│  │  M   │  T   │  W   │  T   │  F   │  S   │  S   ││
│  │  ▓▓  │  ▓▓  │  ▓▓▓ │  ▓   │  ▓▓  │  ▓   │  —   ││
│  │  45m │  30m │  1h  │  15m │  40m │  20m │  —   ││
│  └──────┴──────┴──────┴──────┴──────┴──────┴──────┘│
│                                            │
│  Inter 400 Regular — 14px — #64748B       │
│  "3h 30m this week. Consistent. ↑ 15%    │
│   from last week."                         │
│                                            │
│  [View full analytics] Text link           │
└────────────────────────────────────────────┘

DAY INDICATORS:
  Active day: Primary-500 fill, height varies by duration
  Today: Primary-600 fill, subtle pulse
  Inactive: Neutral-200 fill
  Current day: "Now" indicator
```

---

## Monthly Growth

```text
MONTHLY GROWTH — 30-day trend

┌────────────────────────────────────────────┐
│  Satoshi 600 SemiBold — 16px — #111827    │
│  This Month                                 │
│                                            │
│  space-3                                   │
│                                            │
│  [Mini area chart — 30 days]              │
│  x-axis: Days, y-axis: Activity minutes   │
│  Line: #2B5FD9, 2px                       │
│  Area fill: rgba(43,95,217,0.08)          │
│  Height: 80px                              │
│                                            │
│  Inter 400 Regular — 14px — #4B5563       │
│  "This month you've spent 42 hours on     │
│   your [purpose] journey. That's 30% more │
│   than last month."                        │
│                                            │
│  [Monthly review] Text link                │
└────────────────────────────────────────────┘
```

---

## States

| State                    | Behavior                                               |
| ------------------------ | ------------------------------------------------------ |
| **Default**              | All progress elements visible                          |
| **Loading**              | Skeleton charts (shimmer bars)                         |
| **Empty (New User)**     | "Your progress will appear as you begin your journey." |
| **Empty (Just started)** | "Day 1. Every journey starts with a single step."      |
| **Offline**              | Cached data shown with "Last updated: [time]"          |
| **Error**                | "Couldn't load progress data. [Try again]"             |
| **No Journey Active**    | "Start a journey to track your progress here."         |

---

## Cross-Reference

| Reference   | Relationship                                            |
| ----------- | ------------------------------------------------------- |
| DES-003/D04 | Hero Section — completing Today's Focus feeds progress  |
| DES-003/D11 | Personalization — Life Score adapts to user's purpose   |
| DES-001/D07 | Charts component — minimal chart style, approved colors |
| DES-001/D03 | Semantic colors — Success #22C55E for positive trends   |
| PRD-002     | User DNA — progress reflects user's goals and skills    |
