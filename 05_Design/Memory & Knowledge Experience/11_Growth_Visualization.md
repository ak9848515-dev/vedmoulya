# Growth Visualization

> **Document:** DES-004-D11 — Memory & Knowledge Experience  
> **Status:** 🔒 **LOCKED** — Part of DES-004 Memory Constitution v1.0  
> **Design Constitution:** DES-001 v1.0 · DES-002A v1.0 · DES-003A v1.1

---

## Purpose

Growth Visualization shows users how they are evolving over time across knowledge, skills, decisions, and personal development. It answers: "Am I actually growing?"

**Why it exists:** Growth is often invisible day-to-day. Visualization makes progress tangible, reinforcing intrinsic motivation and providing evidence of forward movement.

**How it connects:** Growth draws from knowledge graph expansion, skill acquisition, decision quality, reflection insights, goal completion, and learning history.

**What it changed:** Without visualization, users feel like they're not making progress. Growth visualization transforms abstract progress into concrete, motivating evidence.

**How it influenced later decisions:** Visible growth reinforces goal commitment, identifies areas needing attention, and celebrates the user's journey authentically.

---

## Psychology

| Principle               | Application                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| **Progress principle**  | Seeing progress is the single most powerful motivator for continued effort.               |
| **Self-efficacy**       | Visual evidence of growth builds confidence in future capability.                         |
| **Endowment effect**    | Users value what they've built. Visible growth increases platform attachment.             |
| **Loss aversion**       | Visualizing growth makes users reluctant to lose momentum.                                |
| **Competence (SDT)**    | Growth visualization fulfills the innate need for competence (Self-Determination Theory). |
| **Temporal comparison** | Comparing current self to past self (not others) is psychologically healthy.              |

---

## Visualization Types

### 1. Knowledge Growth

| Property          | Specification                                                  |
| ----------------- | -------------------------------------------------------------- |
| **Metric**        | Topics explored, connections created, depth score              |
| **Visualization** | Expanding ring or concentric circles (each ring = time period) |
| **Time Range**    | Weekly, Monthly, All Time                                      |
| **Color**         | #2B5FD9 primary, #5B8DEF secondary                             |
| **AI Annotation** | "Your knowledge network grew 23% this month"                   |
| **Interaction**   | Tap a ring to see topics added in that period                  |

### 2. Skill Development

| Property          | Specification                                                    |
| ----------------- | ---------------------------------------------------------------- |
| **Metric**        | Skills identified, proficiency level, active development         |
| **Visualization** | Horizontal bar chart, one bar per skill area                     |
| **Time Range**    | Monthly, Quarterly                                               |
| **Color**         | #22C55E for active, #E8EDF5 for potential                        |
| **AI Annotation** | "You've been developing leadership skills consistently"          |
| **Interaction**   | Expand a skill bar to see evidence (memories, courses, projects) |

### 3. Decision Quality

| Property          | Specification                                                        |
| ----------------- | -------------------------------------------------------------------- |
| **Metric**        | Decisions made, outcomes, learning from outcomes                     |
| **Visualization** | Small multiples of decision outcomes (positive → neutral → learning) |
| **Time Range**    | Monthly, Quarterly                                                   |
| **Color**         | #2B5FD9 (positive), #64748B (neutral), #C89B3C (learning)            |
| **AI Annotation** | "Your decisions are becoming more aligned with your long-term goals" |
| **Interaction**   | Each decision dot expands to show the memory                         |

### 4. Consistency Pattern

| Property          | Specification                                                |
| ----------------- | ------------------------------------------------------------ |
| **Metric**        | Daily/weekly consistency across habits, learning, reflection |
| **Visualization** | Gentle heatmap or connected dot graph (not a streak meter)   |
| **Time Range**    | Monthly, 3 months                                            |
| **Color**         | #EAF2FF (low) → #2B5FD9 (high)                               |
| **AI Annotation** | "You're most consistent on Tuesday mornings"                 |
| **Interaction**   | Hover/tap to see what was done that day                      |

### 5. Growth Radar

| Property          | Specification                                                      |
| ----------------- | ------------------------------------------------------------------ |
| **Dimensions**    | Knowledge, Skills, Decisions, Reflection, Execution, Relationships |
| **Visualization** | Spider/radar chart, 6 dimensions                                   |
| **Time Range**    | Current vs 3 months ago overlay                                    |
| **Color**         | Current: #2B5FD9, Past: #EAF2FF                                    |
| **AI Annotation** | "Your biggest growth area this quarter: Decision Quality (+18%)"   |
| **Interaction**   | Toggle between time periods                                        |

---

## Growth Card (Compact Dashboard Widget)

```
┌────────────────────────────────────┐
│  📈 Your Growth                    │
│                                    │
│  Knowledge Network  ████████░░ 80% │
│  Skills Developing  ██████░░░░ 60% │
│  Decision Quality   ███████░░░ 70% │
│  Consistency        █████░░░░░ 50% │
│                                    │
│  ✨ "Knowledge network grew 23%    │
│     this month. Keep exploring!"   │
│                                    │
│  [  View Full Growth  ]            │
└────────────────────────────────────┘
```

---

## Full Growth View

```
┌────────────────────────────────────────────────────────┐
│  ← Back                        [Monthly ▼]  [Share]   │
│                                                        │
│  ┌────────────────────────────────────────────────┐    │
│  │  Growth Overview                                │    │
│  │                                                 │    │
│  │  Knowledge  ██████████░░░░ 82%  ▲5% from last   │    │
│  │  Skills     ████████░░░░░░ 63%  ▲3%              │    │
│  │  Decisions  █████████░░░░░ 71%  ▲8%              │    │
│  │  Reflection ██████░░░░░░░░ 55%  ▲12%              │    │
│  │  Execution  █████████░░░░░ 74%  ▲2%              │    │
│  └────────────────────────────────────────────────┘    │
│                                                        │
│  ┌──────────────┐  ┌──────────────┐                    │
│  │ Knowledge     │  │ Skills       │                    │
│  │ [Ring chart]  │  │ [Bar chart]  │                    │
│  └──────────────┘  └──────────────┘                    │
│                                                        │
│  ┌──────────────┐  ┌──────────────┐                    │
│  │ Decisions     │  │ Consistency  │                    │
│  │ [Dot matrix]  │  │ [Heatmap]    │                    │
│  └──────────────┘  └──────────────┘                    │
│                                                        │
│  ┌────────────────────────────────────────────────┐    │
│  │  Growth Radar                                   │    │
│  │  [Spider chart - Current vs 3 months ago]       │    │
│  └────────────────────────────────────────────────┘    │
│                                                        │
│  ✨ Key Insight: "Your reflection practice is          │
│     accelerating growth across all dimensions."        │
└──────────────────────────────────────────────────────────┘
```

---

## States

### Empty State (New User, No Data Yet)

- "Your growth story will begin as you use VedMoulya."
- Illustrated guide to what growth dimensions mean
- "Start capturing memories to see your growth"

### Loading State

- Skeleton charts (ring placeholders, bar outlines)
- Animated gradient sweep across chart areas

### Error State

| Error            | Message                                | Action            |
| ---------------- | -------------------------------------- | ----------------- |
| Data unavailable | "Growth data temporarily unavailable." | Refresh button    |
| Period empty     | "No growth data for this period."      | Adjust time range |

### Offline State

- Last cached growth data displayed
- "Data may be outdated" indicator
- Auto-refresh on reconnection

---

## Accessibility

| Requirement             | Implementation                                            |
| ----------------------- | --------------------------------------------------------- |
| **Chart alternatives**  | All visualizations have text-based data tables underneath |
| **Color independence**  | Charts use patterns + labels, not color alone             |
| **Keyboard navigation** | Full chart interaction via keyboard (arrow keys, Enter)   |
| **Screen reader**       | "Knowledge growth: 82%, up 5% from last month" announced  |
| **Touch targets**       | Chart interaction points minimum 44x44px                  |
| **Reduced motion**      | Static chart render, no decorative animations             |
| **Data export**         | Users can export growth data as CSV                       |

---

## Responsive Behavior

| Device                | Layout                                           |
| --------------------- | ------------------------------------------------ |
| **Desktop (1280px+)** | 4-column chart grid, full growth radar           |
| **Laptop (1024px)**   | 2-column chart grid, radar below                 |
| **Tablet (768px)**    | Single column, charts stack vertically           |
| **Mobile (<480px)**   | Single chart at a time, swipe between dimensions |
| **Foldable**          | Spans full width when unfolded                   |

---

## Performance

| Metric                   | Target |
| ------------------------ | ------ |
| Growth page load         | <1.5s  |
| Chart render             | <500ms |
| Time range change        | <300ms |
| AI annotation generation | <2s    |
| Data export              | <3s    |

---

## Motion

| Element                         | Animation                                    | Duration | Easing      |
| ------------------------------- | -------------------------------------------- | -------- | ----------- |
| Chart entrance                  | Gentle scale + fade in (staggered per chart) | 500ms    | ease-out    |
| Time range switch               | Chart data morph                             | 400ms    | ease-in-out |
| Radar overlay (past vs current) | Overlay fade                                 | 400ms    | ease-out    |
| AI annotation appear            | Slide up from below chart                    | 300ms    | ease-out    |
| Tap expand                      | Card expand                                  | 300ms    | ease-out    |

---

## Cross-References

| Document       | Relationship                                              |
| -------------- | --------------------------------------------------------- |
| DES-001 v1.0   | Design Constitution — colors, typography, spacing, radius |
| DES-003A v1.1  | Dashboard — Life Score, Progress & Growth section         |
| ARC-003        | Knowledge Graph — growth data source                      |
| ARC-004        | Execution Intelligence — decision quality metrics         |
| ARC-005        | AI Orchestration — growth insight generation              |
| PRD-002        | User DNA — growth vs baseline comparison                  |
| ENG-001        | Domain Model — Growth metric specifications               |
| D02 Timeline   | Growth data sourced from timeline                         |
| D03 Garden     | Knowledge growth connects to garden expansion             |
| D07 Progress   | Progress & Growth dashboard card                          |
| D10 Reflection | Reflection frequency improves growth across dimensions    |
