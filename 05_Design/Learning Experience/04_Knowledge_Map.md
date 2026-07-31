# Knowledge Map

> **Document:** DES-007-D04 — Learning Operating System Experience  
> **Status:** 🔒 **LOCKED** — Part of DES-007 Learning Constitution v1.0

---

## Purpose

The Knowledge Map is a visual representation of the user's knowledge landscape — showing domains, connections, mastery levels, gaps, and growth over time. It feels alive, not static. It answers: "What do I know? What should I learn next? How does everything connect?"

---

## Psychology & Learning Science

| Principle                  | Application                                                                |
| -------------------------- | -------------------------------------------------------------------------- |
| **Spatial learning**       | Visual placement aids memory — related concepts positioned near each other |
| **Cognitive load**         | Map reveals only 1-2 levels of depth at a time; full depth on demand       |
| **Desirable difficulty**   | Gap indicators create productive curiosity to learn                        |
| **Self-explanation**       | Connected nodes prompt users to articulate relationships                   |
| **Knowledge organization** | Seeing knowledge structure improves retention and recall                   |
| **Growth visualization**   | Watching the map expand over time reinforces self-efficacy                 |

---

## Map Visualization

```
┌────────────────────────────────────────────────────────┐
│  Knowledge Map                           [Filter ▼]    │
│                                                         │
│           ┌──────────┐                                  │
│           │  Python  │──┐                               │
│           │  ████ 90%│  ├──┐                            │
│           └──────────┘  │  │                            │
│                         │  ▼                            │
│  ┌──────────┐           │  ┌──────────┐                 │
│  │  NumPy   │───────────┼──│    ML    │                 │
│  │  ████ 75%│           │  │  ██░ 55%│                 │
│  └──────────┘           │  └──────────┘                 │
│                         │                               │
│  ┌──────────────┐       │  ┌──────────┐                 │
│  │  Statistics  │───────┘  │  Tensor  │                 │
│  │  ██░░░░ 30%  │          │  ░░░░ 15%│                 │
│  └──────────────┘          └──────────┘                 │
│                                                         │
│  Size = knowledge depth · Color = mastery %             │
│  Lines = connections · Dashed = suggested connection    │
│  [Explore]  [Learn Gap]  [View History]                 │
└──────────────────────────────────────────────────────────┘
```

---

## Map Elements

| Element                  | Meaning                                        | Interaction                                                                                                    |
| ------------------------ | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Node**                 | Knowledge domain or concept                    | Tap: detail view. Drag: reorganize.                                                                            |
| **Node size**            | Depth of knowledge (bigger = deeper)           | Scales with items/content count                                                                                |
| **Node color**           | Mastery level                                  | Green (90%+) → Blue (70%) → Purple (50%) → Gray (<50%)                                                         |
| **Connection line**      | Relationship between concepts                  | Tap: see connection strength + type                                                                            |
| **Dashed line**          | Suggested connection                           | [Accept] or [Dismiss]                                                                                          |
| **Gap indicator**        | Missing prerequisite concept                   | "Learn this first" + link to learning path                                                                     |
| **Growth ring**          | Knowledge expansion over time                  | Animation: ring expands outward                                                                                |
| **Confidence indicator** | Certainty in knowledge (separate from mastery) | Node border: solid (high confidence) → dashed (low confidence). Opacity overlay. Tap to see confidence source. |

---

## States

| State                | Behavior                                                                         |
| -------------------- | -------------------------------------------------------------------------------- |
| **Loading**          | Skeleton node circles with pulsing outlines                                      |
| **Default**          | Full knowledge map, organized by mastery and connections                         |
| **Empty (new user)** | "Your knowledge map is waiting to grow. Start learning to see your connections." |
| **Filtered**         | Nodes filtered by domain, mastery level, or time period                          |
| **Growth view**      | Time-lapse animation of map expansion (reduced motion: static overlay)           |
| **Offline**          | Cached map visible, no new connections                                           |

---

## Accessibility

| Requirement             | Implementation                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| **Screen reader**       | "Knowledge Map: Python, Expert, 90%. Connected to NumPy, Statistics." — tree representation |
| **Keyboard navigation** | Arrow keys to navigate nodes, Enter to select, Tab to move between sections                 |
| **Color independence**  | Node labels + pattern fills + size variation, never color alone                             |
| **Zoom support**        | Zoom to 200% — nodes reflow as list                                                         |
| **Reduced motion**      | Growth time-lapse disabled; static "then vs now" overlay instead                            |
| **Text alternative**    | "List view" toggle — shows knowledge as indented tree                                       |

---

## Motion

| Element              | Animation                       | Duration | Easing                  |
| -------------------- | ------------------------------- | -------- | ----------------------- |
| Node entrance        | Scale + fade in (staggered)     | 400ms    | ease-out (80ms stagger) |
| Connection line draw | Path draw from source to target | 500ms    | ease-in-out             |
| Node hover           | Subtle scale 1.05 + glow        | 200ms    | ease-out                |
| Growth over time     | Ring expansion outward          | 800ms    | ease-out                |

---

## Cross-References

| Reference     | Relationship                                                   |
| ------------- | -------------------------------------------------------------- |
| DES-001 v1.0  | Design Constitution — colors, typography, spacing, chart rules |
| DES-002A v1.0 | Onboarding — knowledge discovery introduced during setup       |
| DES-003A v1.1 | Dashboard — Knowledge Preview on main dashboard                |
| DES-004 v1.0  | Memory & Knowledge — Knowledge Garden integration              |
| DES-005 v1.0  | AI Mentor — knowledge discovery conversations                  |
| DES-006 v1.0  | Career — skill-knowledge connection                            |
| DES-007/D00   | Learning Constitution — map hierarchy                          |
| DES-007/D02   | Learning Dashboard — compact map preview                       |
| DES-007/D05   | Skill Development — skill-mastery connection                   |
| DES-007/D06   | Learning Path Design — paths mapped on knowledge map           |
| DES-007/D07   | Practice Experience — practice reinforces map                  |
| ARC-001       | System Architecture — map visualization module                 |
| ARC-002       | Information Architecture — map data flow                       |
| ARC-003       | Knowledge Graph — node and edge data                           |
| ARC-004       | Execution Intelligence — learning practice tracking            |
| ARC-005       | AI Orchestration — map generation and updates                  |
| PRD-001       | Product Vision — Knowledge Map as signature feature            |
| PRD-002       | User DNA — topic priority personalization                      |
| ENG-001       | Domain Model — Map entities                                    |
| ENG-002       | Implementation Standards — map interaction patterns            |
| ENG-003       | AI Development Guidelines — map AI ethics                      |
| ENG-004       | Testing Standards — map validation                             |
