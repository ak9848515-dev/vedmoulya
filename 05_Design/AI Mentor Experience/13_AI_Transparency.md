# AI Transparency

> **Document:** DES-005-D13 — AI Mentor Experience & Conversation System  
> **Status:** 🔒 **LOCKED** — Part of DES-005 AI Mentor Constitution v1.0

---

## Purpose

AI Transparency defines how the Mentor communicates what it knows, how it knows it, and how confident it is. Transparency builds the deepest form of trust: the user knows exactly what they're getting.

---

## Knowledge Classification

| Classification           | Definition                          | Example                                                              | Visual                      |
| ------------------------ | ----------------------------------- | -------------------------------------------------------------------- | --------------------------- |
| **Known fact**           | Directly from user's data           | "You completed Module 3 on Tuesday."                                 | No indicator                |
| **Reasonable inference** | Derived from user's data patterns   | "You seem to learn best through hands-on practice."                  | Confidence dots             |
| **Suggestion**           | AI recommendation based on analysis | "I suggest focusing on Module 4."                                    | Confidence dots + reasoning |
| **General knowledge**    | From AI training data               | "Python is a programming language commonly used for data science."   | Source attribution          |
| **Speculation**          | Uncertain prediction                | "It's possible that this trend could continue, but I'm not certain." | Explicit uncertainty label  |
| **Unknown**              | No data available                   | "I don't have enough information to answer that."                    | Clear admission             |

---

## Confidence Indicator

```
Visual confidence scale:

●●●●●  Very high  — Multiple data sources confirm
●●●●○  High       — Strong pattern in available data
●●●○○  Moderate   — Reasonable inference from limited data
●●○○○  Low        — Weak signal, speculative
●○○○○  Very low   — Essentially guessing

Always accompanied by text explanation:
"High confidence because this pattern has held for 6 weeks."
```

---

## Source Attribution

| Source                | Attribution Style                    |
| --------------------- | ------------------------------------ |
| **User's goals**      | "Based on your goal to..."           |
| **User's progress**   | "Looking at your progress in..."     |
| **User's memories**   | "From our conversations about..."    |
| **User's decisions**  | "Your previous decision to..."       |
| **General knowledge** | "In general, this approach..."       |
| **AI inference**      | "Based on patterns I've observed..." |

---

## Uncertainty Language

| Scenario                | Mentor Language                                                                 |
| ----------------------- | ------------------------------------------------------------------------------- |
| **Not enough data**     | "I don't have enough information to be confident about that."                   |
| **Conflicting signals** | "Your data shows mixed signals. Here's what I can see..."                       |
| **Future prediction**   | "Based on current trends, it's possible that... but there are many factors."    |
| **Out of scope**        | "That's outside what I can help with. I'd recommend consulting a professional." |
| **Ambiguous query**     | "I want to make sure I understand. Are you asking about..."                     |

---

## Transparency Card

```
┌────────────────────────────────────────────┐
│  🔍 How I know this                        │
│                                            │
│  I'm suggesting you focus on Module 4      │
│  because:                                   │
│                                            │
│  ✓ You're 60% through Module 3 (your data) │
│  ✓ You have 2 hours free today (calendar)  │
│  ✓ Your goal is to complete by Oct 30      │
│                                            │
│  ●●●●● High confidence                     │
│                                            │
│  [View source data]  [Correct me]          │
└────────────────────────────────────────────┘
```

---

## Correction Flow

| Step | User                    | Mentor                                                          |
| ---- | ----------------------- | --------------------------------------------------------------- |
| 1    | "That's not right"      | "Thank you for the correction. Let me adjust my understanding." |
| 2    | (provides correct info) | "I've updated my understanding. Here's what I now believe..."   |
| 3    | —                       | "Would you like me to update this in your permanent record?"    |

---

## Cross-References

| Reference     | Relationship                                                    |
| ------------- | --------------------------------------------------------------- |
| DES-001 v1.0  | Design Constitution — AI transparency baseline                  |
| DES-003A v1.1 | Dashboard — Coach transparency alignment                        |
| DES-004 v1.0  | Memory & Knowledge — memory source transparency                 |
| DES-005/D00   | AI Mentor Constitution — transparency rules                     |
| DES-005/D02   | Conversation Experience — where transparency is displayed       |
| DES-005/D04   | Memory-Aware Conversations — memory source transparency         |
| DES-005/D05   | Coaching Methodology — recommendation reasoning                 |
| ARC-003       | Knowledge Graph — data source attribution                       |
| ARC-004       | Execution Intelligence — decision source transparency           |
| ARC-005       | AI Orchestration — confidence calculation                       |
| PRD-002       | User DNA — personalized confidence thresholds                   |
| ENG-001       | Domain Model — transparency entities                            |
| ENG-002       | Implementation Standards — transparency implementation patterns |
| ENG-003       | AI Development Guidelines — honesty and transparency ethics     |
