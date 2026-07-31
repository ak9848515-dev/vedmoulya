# AI Knowledge Assistant

**DES-004 — Document 08/16 — Memory & Knowledge Experience**
**Version:** 1.0
**Status:** Final

---

## Purpose

The AI Knowledge Assistant helps users **understand their own knowledge** — surfacing insights, connections, summaries, and patterns. This is distinct from the AI Coach (DES-003/D05) which focuses on goals and execution. The Knowledge Assistant is about understanding WHAT you know and HOW it connects.

---

## Psychology

| Factor         | Design                                                                             |
| -------------- | ---------------------------------------------------------------------------------- |
| Emotion        | Insight + Clarity + Intellectual excitement                                        |
| Cognitive Load | Low — AI does the heavy analysis, user enjoys the insights                         |
| Trust Signal   | Every insight shows sources, confidence, and reasoning                             |
| Key Insight    | AI-surfaced connections are 4x more likely to be explored than manually found ones |

---

## Assistant Roles

| Role                  | Function                                                    | Trigger                    |
| --------------------- | ----------------------------------------------------------- | -------------------------- |
| **Summarizer**        | Generates concise summaries of topics, periods, or chapters | User views a topic/chapter |
| **Connector**         | Suggests new connections between unlinked items             | Background processing      |
| **Insight Generator** | Surfaces patterns and trends                                | Weekly/monthly digests     |
| **Explainer**         | Explains WHY a connection exists (4-part format)            | User asks "Why?"           |
| **Discoverer**        | Recommends knowledge to explore                             | User opens Garden          |

---

## Assistant Card

```text
AI KNOWLEDGE INSIGHT CARD

┌──────────────────────────────────────────────────────────┐
│  [AI icon]  Inter 500 Medium — 14px — #7C3AED          │
│  Knowledge Insight                                       │
│                                                          │
│  Satoshi 600 SemiBold — 18px — #111827                 │
│  [Insight Title]                                         │
│                                                          │
│  Inter 400 Regular — 14px — #4B5563                    │
│  [2-3 sentence insight description]                      │
│                                                          │
│  ●●●●● High confidence — Based on 12 items               │
│                                                          │
│  [Explore] [Tell me more] [Dismiss]                     │
│                                                          │
│  bg: #FFFFFF, radius: 24px, shadow: Standard             │
│  border-left: 3px solid #7C3AED                         │
└──────────────────────────────────────────────────────────┘
```

---

## 4-Part Explainability Structure

```text
EVERY AI EXPLANATION FOLLOWS THIS FORMAT:

  WHY THIS EXISTS:
  [Reason this connection/insight exists — data source, trigger event]

  HOW IT CONNECTS:
  [Relationship between the items — shared topic, temporal proximity,
   similar content, user behavior]

  WHAT IT CHANGED:
  [How this connection updated the user's understanding —
   new perspective, filled gap, confirmed hypothesis]

  HOW IT INFLUENCED LATER DECISIONS:
  [Real or potential impact on the user's goals, decisions, or journey]
```

---

## States

| State         | Behavior                                                                 |
| ------------- | ------------------------------------------------------------------------ |
| Default       | AI silent — waits for user context or has an insight ready               |
| Insight Ready | Subtle glow on AI icon, one-line preview                                 |
| Active        | Full insight card displayed                                              |
| Explaining    | 4-part explanation expanded                                              |
| Dismissed     | Insight removed, feedback: "Not helpful" / "Too obvious" / "Interesting" |

---

## Cross-Reference

| Reference   | Relationship                                   |
| ----------- | ---------------------------------------------- |
| DES-003/D05 | AI Coach — distinct role (goals vs knowledge)  |
| DES-004/D06 | Memory Details — AI summary within detail view |
| DES-004/D04 | Connections View — AI suggests connections     |
| ARC-005     | AI Orchestration — generates all insights      |
| ARC-003     | Knowledge Graph — knowledge base for insights  |
