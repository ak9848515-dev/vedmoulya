# Conversation Experience

> **Document:** DES-005-D02 — AI Mentor Experience & Conversation System  
> **Status:** 🔒 **LOCKED** — Part of DES-005 AI Mentor Constitution v1.0  
> **Design Constitution:** DES-001 v1.0 · DES-002A v1.0 · DES-003A v1.1 · DES-004 v1.0

---

## Purpose

The Conversation Experience is where users interact with their AI Mentor — the primary interface for coaching, guidance, decision support, and reflection. This document defines the complete conversation flow from entry to exit.

**Why it exists:** The conversation is the most intimate interaction users have with VedMoulya. Every detail — from how conversations start to how they end — shapes trust and perceived intelligence.

---

## Psychology

| Principle           | Application                                                                  |
| ------------------- | ---------------------------------------------------------------------------- |
| **Reciprocity**     | Mentor gives value first (free suggestions, insights) before asking anything |
| **Autonomy**        | User always chooses conversation topic, depth, and duration                  |
| **Consistency**     | Mentor maintains consistent personality across all conversations             |
| **Liking**          | Warm, respectful tone builds rapport without being manipulative              |
| **Social presence** | Avatar and typing indicator create natural conversation rhythm               |
| **Cognitive ease**  | Streaming text at reading speed reduces cognitive load                       |

---

## Conversation Entry Points

| Entry Point           | Trigger                       | Animation                   | Context Preserved         |
| --------------------- | ----------------------------- | --------------------------- | ------------------------- |
| **Dashboard Coach**   | Tap "Talk to me"              | Slide in (drawer)           | Current dashboard context |
| **Mentor Tab**        | Navigate to Mentor section    | Full screen conversation    | Last conversation         |
| **Memory item**       | "Ask Mentor" on memory detail | Slide in (drawer)           | That specific memory      |
| **Decision card**     | "Discuss with Mentor"         | Slide in (drawer)           | Decision context          |
| **Reflection prompt** | "Reflect with Mentor"         | Slide in (drawer)           | Reflection topic          |
| **Quick action**      | "Ask AI" from quick actions   | Slide in (drawer)           | General context           |
| **Voice shortcut**    | "Hey VedMoulya" (if enabled)  | Voice → text → conversation | Voice query context       |

---

## Conversation Layout

```
DESKTOP — FULL CONVERSATION VIEW

┌────────────────────────────────────────────────────────────┐
│  ← Back                          [Mode: Mentor ▼] [•••]  │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │  ┌────────────────────────────────────────────┐   │   │
│  │  │ [AI Avatar 40px]  Your Mentor        [⋯]  │   │   │
│  │  │ Today · 2:30 PM                             │   │   │
│  │  └────────────────────────────────────────────┘   │   │
│  │                                                    │   │
│  │  ┌────────────────────────────────────────────┐   │   │
│  │  │ [User msg] 12:00 PM                        │   │   │
│  │  │ "What should I focus on this week?"         │   │   │
│  │  │                                    ─────── │   │   │
│  │  │                                    Read     │   │   │
│  │  └────────────────────────────────────────────┘   │   │
│  │                                                    │   │
│  │  ┌────────────────────────────────────────────┐   │   │
│  │  │ ┃ [AI — purple left border 3px]           │   │   │
│  │  │ ┃ Your Mentor · 12:00 PM                   │   │   │
│  │  │ ┃                                          │   │   │
│  │  │ ┃ Looking at your current goals and your   │   │   │
│  │  │ ┃ progress this week, I'd suggest focusing │   │   │
│  │  │ ┃ on completing Module 3 of your ML course.│   │   │
│  │  │ ┃ You're 60% through and have momentum.    │   │   │
│  │  │ ┃                                          │   │   │
│  │  │ ┃ ●●●●● High confidence                    │   │   │
│  │  │ ┃ Based on: your course progress +         │   │   │
│  │  │ ┃ available time this week                 │   │   │
│  │  │ ┃                                          │   │   │
│  │  │ ┃ [Set as Focus]  [Tell me more]           │   │   │
│  │  │                              ──────────── │   │   │
│  │  │                              Read 12:03 PM │   │   │
│  │  └────────────────────────────────────────────┘   │   │
│  │                                                    │   │
│  │  ┌────────────────────────────────────────────┐   │   │
│  │  │ [User msg] 12:03 PM                        │   │   │
│  │  │ "Tell me more about the next module"       │   │   │
│  │  └────────────────────────────────────────────┘   │   │
│  │                                                    │   │
│  │  ┌────────────────────────────────────────────┐   │   │
│  │  │ ┃ [AI — streaming text...]                 │   │   │
│  │  └────────────────────────────────────────────┘   │   │
│  │                                                    │   │
│  │  ┌────────────────────────────────────────────┐   │   │
│  │  │ [Say something...]                  [🎤] 📎 │   │   │
│  │  ├────────────────────────────────────────────┤   │   │
│  │  │ Suggested: "What time commitment?"          │   │   │
│  │  │            "Alternative modules?"           │   │   │
│  │  │            "How does this help my career?"  │   │   │
│  │  └────────────────────────────────────────────┘   │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │  Knowledge Context Sidebar                         │   │
│  │  Current: ML Course — Module 3                     │   │
│  │  Related: Data Science, Python                     │   │
│  │  Recent Decision: Focus on ML track                │   │
│  └────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

---

## Message Types

| Type               | Visual                                                                      | Usage                        |
| ------------------ | --------------------------------------------------------------------------- | ---------------------------- |
| **Text**           | Standard bubble, user left-aligned (gray), AI right-aligned (purple border) | Most messages                |
| **Rich card**      | Inline card with action buttons                                             | Suggestions, recommendations |
| **Focus card**     | Compact card: title + time + [Begin]                                        | Today's Focus suggestion     |
| **Progress card**  | Mini chart or progress bar                                                  | Progress updates             |
| **Decision card**  | Options table with pros/cons                                                | Decision support             |
| **Memory card**    | Compact memory preview                                                      | Memory reference             |
| **Knowledge card** | Topic card with connections                                                 | Knowledge reference          |
| **Goal card**      | Goal summary + progress                                                     | Goal conversations           |
| **Timeline**       | Chronological context                                                       | Life chapter reference       |

---

## Streaming Experience

| Property           | Specification                                                  |
| ------------------ | -------------------------------------------------------------- |
| **Speed**          | ~50ms per word (natural reading pace)                          |
| **Max duration**   | 1.5s for short messages, 4s for long messages                  |
| **Skip**           | Tap anywhere on streaming text to show full response instantly |
| **Cursor**         | Blinking purple cursor during streaming                        |
| **Edit detection** | If model regenerates, text smoothly replaces previous          |
| **Reduced motion** | Full text appears instantly (no streaming animation)           |

---

## Suggested Responses

| Property      | Specification                                                 |
| ------------- | ------------------------------------------------------------- |
| **Position**  | Below input field (request) or below AI message (response)    |
| **Count**     | 3 suggestions max per turn                                    |
| **Source**    | AI-generated based on conversation context                    |
| **Relevance** | Based on: user's goals + conversation history + current topic |
| **Action**    | Tap sends as user message                                     |
| **Refresh**   | "More suggestions" link                                       |
| **Frequency** | Only after AI messages, not after user messages               |
| **Privacy**   | Suggestions are locally generated when possible               |

---

## Input Field

| Property        | Specification                                                  |
| --------------- | -------------------------------------------------------------- |
| **Placeholder** | "Ask your Mentor anything..." (changes based on context)       |
| **Height**      | 1 line default, expands to max 4 lines                         |
| **Radius**      | 16px (DES-001 input radius)                                    |
| **Background**  | #FFFFFF                                                        |
| **Border**      | #E8EDF5, focus: #2B5FD9                                        |
| **Submit**      | Enter key or Send button                                       |
| **Voice**       | 🎤 icon (right side), begins voice input                       |
| **Attach**      | 📎 icon (right side), opens: image, document, memory reference |
| **Max length**  | 2,000 characters                                               |
| **Auto-save**   | Draft saved locally if user navigates away                     |

---

## Conversation Continuity

| Aspect                  | Specification                                                                                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Session persistence** | Conversation continues across sessions                                                                                                                      |
| **Context window**      | ~10 most recent exchanges visible by default                                                                                                                |
| **Scroll back**         | Full conversation history accessible via scroll                                                                                                             |
| **Topic change**        | If topic shifts significantly, Mentor acknowledges: "Let's talk about [new topic]. By the way, I'll remember our conversation about [previous topic]."      |
| **Time gap**            | If >24h since last message, Mentor acknowledges with brief context: "Welcome back. We were discussing your ML course."                                      |
| **Long gap (>7 days)**  | Mentor provides brief summary: "Since we last talked, you've completed Module 2 and started Module 3. Would you like to continue or discuss something new?" |

---

## Conversation Endings

| Scenario                  | Mentor Behavior                                           |
| ------------------------- | --------------------------------------------------------- |
| **Topic resolved**        | "Is there anything else I can help you with?"             |
| **Goal set**              | "I'll check in on your progress. You've got this."        |
| **Decision made**         | "I'll remember this decision. Let me know how it goes."   |
| **User says goodbye**     | "Take care. I'll be here when you need me."               |
| **Extended conversation** | "We've covered a lot today. Would you like a summary?"    |
| **Conversation summary**  | Optional AI-generated summary of key points and decisions |

---

## Accessibility

| Requirement             | Implementation                                                           |
| ----------------------- | ------------------------------------------------------------------------ |
| **Screen reader**       | Live region announces AI responses. "New message from Mentor" announced. |
| **Keyboard navigation** | Tab through messages, Enter to send, Arrow keys to navigate history      |
| **Focus management**    | Auto-focus input on conversation open                                    |
| **Voice input**         | Speech-to-text for replies                                               |
| **Message search**      | Full conversation search                                                 |
| **Font size**           | Respects system font size settings                                       |
| **Contrast**            | All text WCAG AA (4.5:1)                                                 |

---

## Cross-References

| Reference     | Relationship                                              |
| ------------- | --------------------------------------------------------- |
| DES-001 v1.0  | Design Constitution — colors, typography, spacing, radius |
| DES-003A v1.1 | Dashboard — AI Coach entry point                          |
| DES-004 v1.0  | Memory & Knowledge — context sidebar references           |
| DES-005/D00   | AI Mentor Constitution — persona, ethics                  |
| DES-005/D03   | Conversation States — all states for this interface       |
| DES-005/D12   | Conversation History — storage and retrieval              |
| DES-005/D13   | AI Transparency — explanation framework                   |
| DES-005/D14   | Motion — conversation animations                          |
| DES-005/D15   | Responsive — device adaptations                           |
| ARC-003       | Knowledge Graph — context for conversation suggestions    |
| ARC-004       | Execution Intelligence — execution coaching context       |
| ARC-005       | AI Orchestration — conversation pipeline                  |
| PRD-002       | User DNA — personalized conversation style                |
| ENG-001       | Domain Model — conversation entities                      |
| ENG-002       | Implementation Standards — AI interaction patterns        |
| ENG-003       | AI Development Guidelines — ethical AI boundaries         |
