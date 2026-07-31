# Memory-Aware Conversations

> **Document:** DES-005-D04 — AI Mentor Experience & Conversation System  
> **Status:** 🔒 **LOCKED** — Part of DES-005 AI Mentor Constitution v1.0  
> **Design Constitution:** DES-001 v1.0 · DES-002A v1.0 · DES-003A v1.1 · DES-004 v1.0

---

## Purpose

The Mentor uses the user's memories, knowledge, goals, and journey context to provide personalized, relevant guidance. Memory awareness should feel natural — like a mentor who knows you — never like a database query.

**Why it exists:** Contextless AI gives generic answers. Memory-aware AI gives personal, relevant, trusted guidance.

**How it connects:** Uses DES-004 Memory & Knowledge infrastructure (Timeline, Garden, Chapters) as context for conversations.

**What it changed:** Generic advice becomes personal guidance. Every recommendation is grounded in the user's actual life data.

**How it influenced later decisions:** Memory awareness transforms the Mentor from a chatbot into a true personal mentor.

---

## Psychology

| Principle                 | Application                                                                   |
| ------------------------- | ----------------------------------------------------------------------------- |
| **Continuity**            | Memory creates the feeling of a relationship, not isolated transactions       |
| **Personalization**       | Being remembered makes users feel seen and understood                         |
| **Trust**                 | Memory that is accurate and tactful builds deep trust                         |
| **Intimacy boundary**     | Too much memory feels like surveillance. Natural, selective reference is key. |
| **Reciprocal disclosure** | When Mentor remembers appropriately, users share more voluntarily             |

---

## What the Mentor Remembers

| Category                 | What's Remembered                                 | How Referenced                       |
| ------------------------ | ------------------------------------------------- | ------------------------------------ |
| **User DNA**             | Purpose, learning style, communication preference | Subtle adaptation of tone and depth  |
| **Goals**                | Active goals, completed goals, goal history       | "Your current goal is..."            |
| **Career**               | Current role, skills, aspirations                 | "In your career as a [role]..."      |
| **Learning**             | Courses, topics of interest, progress             | "You were learning about [topic]..." |
| **Projects**             | Active projects, milestones                       | "Your [project] is at [stage]..."    |
| **Decisions**            | Key decisions made, outcomes                      | "Last time you decided to..."        |
| **Progress**             | Momentum, consistency, growth                     | "You've been consistent with..."     |
| **Life Chapters**        | Current chapter, recent chapters                  | "In this chapter of your life..."    |
| **Conversation history** | Topics discussed, preferences expressed           | "Earlier you mentioned..."           |

---

## Memory Reference Rules

| Rule                    | Implementation                                                                   |
| ----------------------- | -------------------------------------------------------------------------------- |
| **Natural language**    | "Last month you mentioned..." not "According to memory record #4821..."          |
| **Context provided**    | Always explain WHY a memory is relevant: "Since you're working toward [goal]..." |
| **Relevance check**     | Only reference memories directly relevant to the current conversation            |
| **Freshness priority**  | Recent memories (this week) referenced more frequently                           |
| **Cap at 2 per turn**   | Max 2 memory references per Mentor message                                       |
| **Low confidence flag** | "If I remember correctly..." for uncertain memories                              |
| **Correction flow**     | User corrects → "Thank you, I've updated my understanding"                       |
| **Forget flow**         | "Forget this" → memory removed from conversation context                         |
| **Never obscure**       | Never reference a detail the user may not remember themselves                    |
| **Opt-out**             | Users can disable memory in conversations (privacy mode)                         |

---

## Memory Reference Examples

### Good Examples

| Scenario               | Mentor Message                                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Goal reference**     | "I remember you set a goal to complete your ML certification this quarter. You're 60% through. How's it going?"                  |
| **Career reference**   | "In our last conversation about your career, you mentioned wanting to move into a leadership role. Is that still your priority?" |
| **Progress reference** | "You've completed 4 learning sessions this week — that's more than last week. Your consistency is building momentum."            |
| **Decision reference** | "Last month you decided to focus on Python over R. Based on your progress, that seems to have been a good choice."               |
| **Chapter reference**  | "This chapter of your life — the career transition — has been one of your most productive periods."                              |

### Bad Examples

| Scenario              | Mentor Message                                                          | Why Bad                     |
| --------------------- | ----------------------------------------------------------------------- | --------------------------- |
| **Obscure reference** | "On March 14 at 2:32 PM you mentioned your cousin's dog's name is Max." | Creepy, irrelevant          |
| **Over-reference**    | "I remember, based on 847 memories..."                                  | Robotic, data-dump          |
| **Confrontational**   | "You said you'd complete this by Tuesday. It's Wednesday."              | Judgmental, pressuring      |
| **Emotional claim**   | "I know how you feel because I've seen similar patterns."               | Pretending to have feelings |

---

## Memory Freshness

| Freshness       | Time         | Reference Style         | Frequency         |
| --------------- | ------------ | ----------------------- | ----------------- |
| **Immediate**   | Same session | "You just mentioned..." | Unlimited         |
| **Recent**      | This week    | "Earlier this week..."  | High              |
| **Short-term**  | This month   | "This month you..."     | Medium            |
| **Medium-term** | 1-6 months   | "A few months ago..."   | Low               |
| **Long-term**   | 6+ months    | "Earlier this year..."  | Rare              |
| **Milestone**   | Any time     | "One year ago you..."   | Special occasions |

---

## Correction Workflow

When the user corrects the Mentor's memory:

```
User: "Actually, I decided to focus on R, not Python."

Mentor: "Thank you for the correction. I've updated my understanding.
Let me revise: you decided to focus on R. How is that going?"
```

| Step                 | Mentor Behavior                             |
| -------------------- | ------------------------------------------- |
| 1. Acknowledge       | "Thank you for the correction."             |
| 2. Confirm update    | "I've updated my understanding."            |
| 3. Restate corrected | "Let me revise: you decided to focus on R." |
| 4. Continue          | Return to conversation naturally            |

---

## Forget Workflow

| User Action                           | Mentor Response                                                                          | Effect                                                |
| ------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| "Forget that"                         | "I've removed that from our conversation. Is there anything else you'd like to discuss?" | Memory deleted from conversation context              |
| "Forget everything about [topic]"     | "I've removed all references to [topic] from our conversations."                         | Topic memories deleted                                |
| Settings → Clear conversation history | —                                                                                        | All conversation history deleted                      |
| Settings → Forget all memories        | —                                                                                        | All Mentor memory context reset (user data preserved) |

---

## Privacy Mode

| Aspect          | Specification                                                 |
| --------------- | ------------------------------------------------------------- |
| **Visual**      | Shield icon on avatar, muted purple background                |
| **Behavior**    | Mentor responds without accessing long-term memory            |
| **Context**     | Only current conversation context used                        |
| **Storage**     | No conversation stored, no memory updates                     |
| **Toggle**      | One tap in conversation header                                |
| **Exit**        | "Privacy mode is off. I'll remember our conversations again." |
| **Persistence** | Privacy mode persists until toggled off                       |

---

## Accessibility

| Requirement                   | Implementation                                                         |
| ----------------------------- | ---------------------------------------------------------------------- |
| **Memory usage indicator**    | "I'm using your goals, progress, and recent conversations for context" |
| **Privacy mode announcement** | "Privacy mode on. Conversations are not recorded."                     |
| **Correction accessibility**  | Keyboard shortcut for correction: Ctrl+Enter to mark incorrect         |
| **Forget accessibility**      | "Forget" option available via context menu on any memory reference     |

---

## Cross-References

| Reference     | Relationship                                              |
| ------------- | --------------------------------------------------------- |
| DES-001 v1.0  | Design Constitution — colors, typography, spacing, radius |
| DES-003A v1.1 | Dashboard — Memory Moments, Knowledge Preview             |
| DES-004 v1.0  | Memory & Knowledge — source of user's memories            |
| DES-004/D02   | Memory Timeline — chronological context                   |
| DES-004/D06   | Memory Details — individual memory content                |
| DES-004/D11   | Growth Visualization — growth context                     |
| DES-005/D00   | AI Mentor Constitution — memory awareness rules           |
| DES-005/D02   | Conversation Experience — where memory is referenced      |
| DES-005/D13   | AI Transparency — explanation of memory usage             |
| ARC-003       | Knowledge Graph — memory storage and retrieval            |
| ARC-004       | Execution Intelligence — memory-informed decision support |
| ARC-005       | AI Orchestration — memory integration in LLM context      |
| PRD-002       | User DNA — personalization through memory                 |
| ENG-001       | Domain Model — memory entities                            |
| ENG-002       | Implementation Standards — memory recall patterns         |
| ENG-003       | AI Development Guidelines — ethical memory use            |
