# Memory Timeline

**DES-004 — Document 02/16 — Memory & Knowledge Experience**
**Version:** 1.0
**Status:** Final

---

## Purpose

The Memory Timeline is the user's **life unfolding chronologically**. It's not a list of events — it's a path the user walks along. Each memory is a moment that shaped their journey: a learning completed, a decision made, a connection discovered, a reflection captured.

---

## Psychology

| Factor         | Design                                               |
| -------------- | ---------------------------------------------------- |
| Emotion        | Nostalgia + Coherence + Pride                        |
| Cognitive Load | Low — scrollable, infinite, but calm                 |
| Trust Signal   | Everything is the user's own data, organized by time |
| Key Insight    | Seeing past progress increases motivation by 35%     |

---

## Layout

```text
MEMORY TIMELINE

┌──────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────┐   │
│  │  Satoshi 700 Bold — 40px — #111827             │   │
│  │  Your Timeline                                   │   │
│  │                                                  │   │
│  │  Inter 400 Regular — 16px — #64748B            │   │
│  │  \"[X] moments · [Y] connections · [Z] reflections\"│   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ YEAR: 2026 ────────────────────────────────────┐  │
│  │                                                  │  │
│  │  ┌─ [Month] ───────────────────────────────┐   │  │
│  │  │                                           │  │  │
│  │  │  [Memory Card] — Date, Title, Preview    │  │  │
│  │  │  [Memory Card] — Date, Title, Preview    │  │  │
│  │  │  [Memory Card] — Date, Title, Preview    │  │  │
│  │  │                                           │  │  │
│  │  └───────────────────────────────────────────┘  │  │
│  │                                                  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  [Load more — infinite scroll]                          │
└─────────────────────────────────────────────────────────┘
```

---

## Memory Card

```text
MEMORY CARD

┌────────────────────────────────────────────────────┐
│  [Icon]  Inter 500 Medium — 14px — #64748B       │
│  [Date] · [Category]                               │
│                                                    │
│  Satoshi 600 SemiBold — 18px — #111827            │
│  [Memory Title]                                    │
│                                                    │
│  Inter 400 Regular — 14px — #4B5563               │
│  [2-line preview of the memory content]            │
│                                                    │
│  [Tags: Topic A, Topic B, Topic C]                 │
│                                                    │
│  [Connection indicator: "Connected to 3 items"]    │
│                                                    │
│  bg: #FFFFFF, radius: 24px, shadow: Standard       │
│  padding: space-6 (24px)                           │
└────────────────────────────────────────────────────┘
```

---

## States

| State              | Behavior                                                                     |
| ------------------ | ---------------------------------------------------------------------------- |
| Default            | Chronological timeline, grouped by month/year                                |
| Loading            | Skeleton cards matching card layout                                          |
| Empty (New user)   | "Your timeline will start here. Every moment you capture builds your story." |
| Empty (No results) | "No memories match your search. Try different keywords."                     |
| Filtered           | Shows only selected category with filter badge                               |
| Offline            | Cached timeline visible, new captures queued                                 |

---

## Cross-Reference

| Reference     | Relationship                                                |
| ------------- | ----------------------------------------------------------- |
| DES-001 v1.0  | Design Constitution — colors, typography, spacing, radius   |
| DES-003A v1.1 | Dashboard — Timeline integration with progress              |
| DES-004/D05   | Life Chapters — timeline grouped by chapters                |
| DES-004/D06   | Memory Details — tap card to view full detail               |
| DES-004/D09   | Capture — new memories appear in timeline                   |
| ARC-003       | Knowledge Graph — memories are nodes in the graph           |
| ARC-004       | Execution Intelligence — timeline informs decision patterns |
| ARC-005       | AI Orchestration — AI-powered timeline summaries            |
| PRD-002       | User DNA — timeline reflects user's journey and growth      |
| ENG-001       | Domain Model — Memory entity specifications                 |
