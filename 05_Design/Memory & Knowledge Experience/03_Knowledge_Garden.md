# Knowledge Garden

**DES-004 — Document 03/16 — Memory & Knowledge Experience**
**Version:** 1.0
**Status:** Final

---

## Purpose

The Knowledge Garden is where the user sees their **knowledge grow organically**. It's not a folder structure — it's a living landscape of topics, ideas, and connections. The user navigates through topics, discovers connections, and watches their understanding expand over time.

---

## Psychology

| Factor         | Design                                                                |
| -------------- | --------------------------------------------------------------------- |
| Emotion        | Curiosity + Wonder + Intellectual pride                               |
| Cognitive Load | Medium — browsing is exploration, structured for calm                 |
| Trust Signal   | Everything is the user's own knowledge — AI only surfaces connections |
| Key Insight    | Visualizing knowledge growth increases learning motivation by 40%     |

---

## Layout

```text
KNOWLEDGE GARDEN

┌──────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────┐   │
│  │  Satoshi 700 Bold — 40px — #111827             │   │
│  │  Your Knowledge Garden                           │   │
│  │                                                  │   │
│  │  Search: [___________________________]           │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ TOPIC CLUSTERS (organic layout) ───────────────┐  │
│  │                                                  │  │
│  │     ┌──────────┐                                 │  │
│  │     │ Machine  │──┐    ┌──────────┐              │  │
│  │     │ Learning │  ├────│ Python   │              │  │
│  │     └──────────┘  │    └──────────┘              │  │
│  │                   │    ┌──────────────┐          │  │
│  │                   └────│ Data Science │          │  │
│  │                        └──────────────┘          │  │
│  │     ┌─────────┐                                  │  │
│  │     │ Design  │──── Leadership                   │  │
│  │     └─────────┘                                  │  │
│  │                                                  │  │
│  │  (Visual: connected topic bubbles, NOT a graph)  │  │
│  │  Size varies by proficiency, connections shown   │  │
│  │  as gentle lines, max 3 depth levels visible     │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─ RECENT INSIGHTS ───────────────────────────────┐  │
│  │                                                  │  │
│  │  \"New connection: Machine Learning ↔ Python\"     │  │
│  │  \"Your Data Science topic has grown 3 new items\" │  │
│  │                                                  │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Topic Card

```text
TOPIC CARD

┌────────────────────────────────────────────┐
│  Satoshi 600 SemiBold — 20px — #111827    │
│  [Topic Name]                               │
│                                            │
│  space-2                                   │
│                                            │
│  Inter 400 Regular — 14px — #4B5563       │
│  \"[X] items · [Y] connections\"            │
│                                            │
│  [Proficiency indicator]                   │
│  o o o o o — 4 of 5 levels explored        │
│                                            │
│  Inter 400 Regular — 14px — #64748B       │
│  \"Connected to: [Topic A], [Topic B]...\"  │
│                                            │
│  bg: #FFFFFF, radius: 24px, shadow: Std    │
│  Size: proportional to item count          │
└────────────────────────────────────────────┘
```

---

## States

| State                | Behavior                                                                  |
| -------------------- | ------------------------------------------------------------------------- |
| Default              | Topic clusters visible, organized by relevance/recency                    |
| Loading              | Skeleton bubbles matching topic layout                                    |
| Empty (New user)     | "Your Knowledge Garden is ready to grow. Start capturing what you learn." |
| Empty (After import) | "Your imported knowledge is being organized. Insights will appear soon."  |
| Filtered             | Topics filtered by category or search query                               |
| Offline              | Cached topics visible, no new connections shown                           |

---

## Cross-Reference

| Reference     | Relationship                                                        |
| ------------- | ------------------------------------------------------------------- |
| DES-001 v1.0  | Design Constitution — colors, typography, spacing, radius           |
| DES-003A v1.1 | Dashboard — Knowledge Preview integration                           |
| DES-004/D04   | Connections View — tap connection to explore                        |
| DES-004/D07   | Search — search across topics                                       |
| DES-004/D08   | AI Knowledge Assistant — AI suggests connections                    |
| ARC-003       | Knowledge Graph — topic clusters are graph groupings                |
| ARC-004       | Execution Intelligence — growing knowledge enables better decisions |
| ARC-005       | AI Orchestration — topic discovery and connection suggestions       |
| PRD-002       | User DNA — topics reflect user's learning style and goals           |
| ENG-001       | Domain Model — Knowledge entity specifications                      |
