# Search & Discovery

**DES-004 — Document 07/16 — Memory & Knowledge Experience**
**Version:** 1.0
**Status:** Final

---

## Purpose

Search & Discovery helps users **find anything instantly** — memories, knowledge, connections, decisions, documents. But search is not the primary path. Discovery — stumbling upon unexpected connections — is the default. Search is the power tool for when discovery isn't enough.

---

## Psychology

| Factor         | Design                                                     |
| -------------- | ---------------------------------------------------------- |
| Emotion        | Confidence + Relief + Surprise                             |
| Cognitive Load | Low — type and go, or browse and discover                  |
| Trust Signal   | Results are complete, organized, and explainable           |
| Key Insight    | Discovery (browsing) drives 3x more engagement than search |

---

## Search Experience

```text
SEARCH OVERLAY

┌──────────────────────────────────────────────────────────┐
│  [Search] [_______________________________] [X]         │
│                                                          │
│  RESULTS (categorized, grouped by type):                 │
│                                                          │
│  MEMORIES (3)                                            │
│  ┌──────────────────────────────────────────────────┐  │
│  │ [Icon] [Title] — [Date] — "2 connections"        │  │
│  │ [Icon] [Title] — [Date] — "2 connections"        │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  KNOWLEDGE TOPICS (2)                                   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ [Topic] — "5 items, 3 connections"               │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  DECISIONS (1)                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ [Decision] — "Influenced by 2 memories"          │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  DOCUMENTS (2)                                          │
│                                                          │
│  [No results for [query]] — "Try different keywords"    │
└──────────────────────────────────────────────────────────┘

SEARCH SPECS:
  Debounce: 300ms
  Results: categorized by type
  Recent searches: stored locally (5 max)
  Keyboard: ↑↓ arrows, Enter to select
  Empty: "No results. Try different keywords or browse your Garden."
```

---

## Discovery Mode

```text
DISCOVERY MODE (default state when opening Knowledge section)

  \"Discover something new today\" — heading

  ┌── SUGGESTED EXPLORATIONS ─────────────────────┐
  │                                                │
  │  \"You haven't visited [Topic] in 2 weeks\"     │
  │  \"[Topic A] and [Topic B] have 3 new items\"   │
  │  \"You have [N] uncategorized memories\"        │
  │                                                │
  └────────────────────────────────────────────────┘

  Discovery is the default. Search is available but secondary.
```

---

## Cross-Reference

| Reference     | Relationship                                                    |
| ------------- | --------------------------------------------------------------- |
| DES-001 v1.0  | Design Constitution — colors, typography, spacing, radius       |
| DES-003A v1.1 | Dashboard — Quick Search in dashboard header                    |
| DES-004/D02   | Memory Timeline — search results include timeline items         |
| DES-004/D03   | Knowledge Garden — discovery mode opens to garden               |
| DES-004/D08   | AI Knowledge Assistant — AI-assisted search                     |
| ARC-003       | Knowledge Graph — search queries the graph                      |
| ARC-004       | Execution Intelligence — search surfaces decision-relevant data |
| ARC-005       | AI Orchestration — AI-powered search results and suggestions    |
| PRD-002       | User DNA — search is personalized to user's goals               |
| ENG-001       | Domain Model — Search entity specifications                     |
