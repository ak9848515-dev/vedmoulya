# Life Chapters

**DES-004 — Document 05/16 — Memory & Knowledge Experience**
**Version:** 1.0
**Status:** Final

---

## Purpose

Life Chapters organize memories into **meaningful life phases** — not by date, but by the chapters the user defines: "My Career Change Year," "Learning Data Science," "Building My First Product." Chapters are the user's own narrative structure for their life story.

---

## Psychology

| Factor         | Design                                                                      |
| -------------- | --------------------------------------------------------------------------- |
| Emotion        | Narrative identity + Coherence + Meaning-making                             |
| Cognitive Load | Low — 3-7 chapters visible at a time                                        |
| Trust Signal   | User creates their own chapters — the platform suggests, never imposes      |
| Key Insight    | People who narrate their life in chapters have 50% higher well-being scores |

---

## Chapter Card

```text
LIFE CHAPTER CARD

┌────────────────────────────────────────────────────┐
│  [Cover image — abstract, chapter color]           │
│                                                    │
│  Satoshi 700 Bold — 28px — #111827                │
│  [Chapter Title — user-defined]                    │
│                                                    │
│  Inter 400 Regular — 16px — #64748B               │
│  "[Date range] · [X] memories"                     │
│                                                    │
│  Inter 400 Regular — 14px — #4B5563               │
│  [2-sentence user description]                     │
│                                                    │
│  ━━━━━━━━━━━━━━━━━━━━░░░░░░░░░░                   │
│  65% · 45 of 70 memories captured                  │
│                                                    │
│  bg: #FFFFFF, radius: 24px, shadow: Standard       │
│  padding: space-6 (24px)                           │
└────────────────────────────────────────────────────┘
```

---

## States

| State   | Behavior                                                                          |
| ------- | --------------------------------------------------------------------------------- |
| Default | Chapters in chronological order, latest first                                     |
| Empty   | "Life Chapters help you see the story of your growth. Create your first chapter." |
| Editing | Inline title/description editing                                                  |
| Offline | Cached chapters visible                                                           |

---

## Cross-Reference

| Reference     | Relationship                                              |
| ------------- | --------------------------------------------------------- |
| DES-001 v1.0  | Design Constitution — colors, typography, spacing, radius |
| DES-003A v1.1 | Dashboard — Life Journey Card in dashboard                |
| DES-004/D02   | Memory Timeline — chapters group timeline items           |
| DES-004/D06   | Memory Details — each memory belongs to a chapter         |
| ARC-003       | Knowledge Graph — chapters are graph groupings            |
| ARC-004       | Execution Intelligence — chapters frame decision context  |
| ARC-005       | AI Orchestration — AI suggests chapter organization       |
| PRD-002       | User DNA — chapters reflect user's purpose and goals      |
| ENG-001       | Domain Model — Chapter entity specifications              |
