# Connections View

**DES-004 — Document 04/16 — Memory & Knowledge Experience**
**Version:** 1.0
**Status:** Final

---

## Purpose

The Connections View reveals how a memory or knowledge item **relates to everything else** in the user's life — other memories, topics, goals, decisions, and people. This is where the user sees the hidden architecture of their growth.

**Why it exists:** Human understanding comes from connections, not isolated facts. The Connections View makes the relationship between memories, knowledge, decisions, and goals visible and explorable.

**How it connects:** Every memory card, topic card, decision, goal, and document is a potential connection point. The view radiates outward from a central item to reveal its web of relationships.

**What it changed:** Previously, each memory existed in isolation. Connections View transforms isolated data points into an interconnected life narrative.

**How it influenced later decisions:** Understanding connections helps users make more informed choices, recognize patterns in their decision-making, and see how past experiences shape current direction.

---

## Psychology

| Factor         | Design                                                                     |
| -------------- | -------------------------------------------------------------------------- |
| Emotion        | Insight + Surprise + Understanding                                         |
| Cognitive Load | Medium — one central item, expanding outward on demand                     |
| Trust Signal   | Connections are based on the user's own data, not external sources         |
| Key Insight    | Seeing unexpected connections creates "aha" moments that deepen engagement |

---

## Layout

```text
CONNECTIONS VIEW (seen when viewing a specific memory/knowledge item)

┌──────────────────────────────────────────────────────────┐
│  [Back to Timeline/Garden]                               │
│                                                          │
│  ┌─ CENTRAL ITEM ──────────────────────────────────┐   │
│  │  [Memory/Knowledge detail — D06]                │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─ CONNECTIONS ───────────────────────────────────┐   │
│  │  Inter 500 Medium — 14px — #64748B             │   │
│  │  "Connected to [N] items"                       │   │
│  │                                                  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐       │   │
│  │  │ Related  │ │ Related  │ │ Related  │       │   │
│  │  │ Memory 1 │ │ Topic A │ │ Decision │       │   │
│  │  └──────────┘ └──────────┘ └──────────┘       │   │
│  │                                                  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐       │   │
│  │  │ Related  │ │ +3 more  │ │          │       │   │
│  │  │ Goal     │ │ items    │ │          │       │   │
│  │  └──────────┘ └──────────┘ └──────────┘       │   │
│  │                                                  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  [Why this connection?] — AI explanation for each        │
└──────────────────────────────────────────────────────────┘
```

---

## Connection Types

| Type               | Meaning                     | Visual       | Why it exists                       | Influenced later decisions                        |
| ------------------ | --------------------------- | ------------ | ----------------------------------- | ------------------------------------------------- |
| **Related Memory** | Temporal or thematic link   | Blue chip    | Shared context or timeframe         | Pattern recognition for similar future situations |
| **Topic**          | Same knowledge area         | Green chip   | Common knowledge domain             | Deepens expertise in connected topics             |
| **Decision**       | This influenced a decision  | Amber chip   | Causal or contributing relationship | Better understanding of decision factors          |
| **Goal**           | Connected to a user goal    | Primary chip | Aligned with user's purpose         | Reinforces goal commitment                        |
| **Person**         | Involved the same person    | Purple chip  | Shared relationship                 | Strengthens relationship awareness                |
| **Document**       | Referenced in same document | Gray chip    | Cross-reference context             | Enables comprehensive document understanding      |

---

## Explainability Format

Every connection card follows the structured explainability format:

```text
CONNECTION EXPLANATION

┌────────────────────────────────────────────────────────┐
│  🔗 Connected to: [Item Name]                         │
│                                                        │
│  Why this exists:  [Reason for the connection]          │
│  How it connects:  [Nature of the relationship]         │
│  What it changed:  [Impact on user's understanding]     │
│  Influenced later: [Effect on subsequent decisions]     │
│                                                        │
│  Confidence: High — based on direct content overlap     │
│                                                        │
│  [  Dismiss  ]  [  Explore Connection  ]                │
└────────────────────────────────────────────────────────┘
```

---

## States

| State                  | Behavior                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| Default                | Radiating connection cards from central item                                              |
| Loading                | Skeleton connection cards with ghost text                                                 |
| Empty (No connections) | "This memory hasn't connected to others yet. Connections appear as your knowledge grows." |
| Filtered               | Connections filtered by type (memories, topics, decisions, etc.)                          |
| Expanded               | Full AI explanation visible for a selected connection                                     |
| Offline                | Last cached connections shown, no new discoveries                                         |
| Error                  | "Unable to load connections. Your data is safe." with retry                               |

---

## Accessibility

| Requirement             | Implementation                                                              |
| ----------------------- | --------------------------------------------------------------------------- |
| **Screen reader**       | "Connected to [Item]: [Reason]. Explore connection" announced for each card |
| **Keyboard navigation** | Tab through connection cards, Enter to expand explanation                   |
| **Focus management**    | Focus moves to connection list on load, to explanation on expand            |
| **Color independence**  | Connection type indicated by label and icon, not color alone                |
| **Touch targets**       | Each connection card minimum 44x44px                                        |
| **Reduced motion**      | Static connection display, no line-draw animations                          |
| **Zoom support**        | Cards reflow at 200% zoom                                                   |

---

## Motion

| Element                 | Animation                                          | Duration | Easing                  |
| ----------------------- | -------------------------------------------------- | -------- | ----------------------- |
| Connections appear      | Staggered fade + slide from center outward         | 400ms    | ease-out (80ms stagger) |
| Explanation expand      | Card expands, content fades in                     | 300ms    | ease-out                |
| Filter change           | Connections cross-fade                             | 300ms    | ease-out                |
| Central item transition | Subtle scale emphasis (1.02) when connections load | 200ms    | ease-out                |

---

## Responsive

| Device                | Layout                                                |
| --------------------- | ----------------------------------------------------- |
| **Desktop (1280px+)** | Full radiating layout, 3+ columns of connection cards |
| **Tablet (768px)**    | 2-column connection grid below central item           |
| **Mobile (<480px)**   | Single column scrolling connection list               |
| **Foldable**          | Connections flow around hinge gap                     |

---

## Cross-Reference

| Reference     | Relationship                                              |
| ------------- | --------------------------------------------------------- |
| DES-001 v1.0  | Design Constitution — colors, typography, spacing, radius |
| DES-003A v1.1 | Dashboard — Knowledge Preview feeds into connections      |
| ARC-003       | Knowledge Graph — connections are graph edges             |
| ARC-004       | Execution Intelligence — decisions connect to memories    |
| ARC-005       | AI Orchestration — AI discovers and explains connections  |
| PRD-002       | User DNA — connections reflect user's goals and purpose   |
| ENG-001       | Domain Model — Connection entity specifications           |
| DES-004/D06   | Memory Details — connections shown within detail view     |
| DES-004/D08   | AI Knowledge Assistant — AI suggests new connections      |
