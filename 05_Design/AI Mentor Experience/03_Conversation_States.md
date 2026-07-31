# Conversation States

> **Document:** DES-005-D03 — AI Mentor Experience & Conversation System  
> **Status:** 🔒 **LOCKED** — Part of DES-005 AI Mentor Constitution v1.0  
> **Design Constitution:** DES-001 v1.0 · DES-002A v1.0 · DES-003A v1.1 · DES-004 v1.0

---

## Purpose

Every state of the Mentor conversation is explicitly defined — from idle to active, from streaming to error, from offline to recovery. Consistent state design ensures users always know what is happening and what to do next.

---

## State Machine

```
                    ┌─────────────┐
                    │    IDLE     │
                    └──────┬──────┘
                           │ User taps Mentor
                           ▼
                   ┌───────────────┐
              ┌────│  CONNECTING   │────┐
              │    └───────┬───────┘    │
              │            │            │
              ▼            ▼            ▼
       ┌──────────┐  ┌──────────┐  ┌──────────┐
       │  ACTIVE  │  │  ERROR   │  │  OFFLINE │
       └────┬─────┘  └────┬─────┘  └────┬─────┘
            │              │            │
            ▼              │            │
     ┌──────────┐          │            │
     │ THINKING │◄─────────┘            │
     └────┬─────┘                       │
          ▼                             │
    ┌──────────┐                        │
    │ STREAMING│                        │
    └────┬─────┘                        │
         │                              │
         ▼                              │
    ┌──────────┐                        │
    │  ACTIVE  │────────────────────────┘
    └────┬─────┘
         │ User closes / idle timeout
         ▼
    ┌──────────┐
    │  IDLE   │
    └──────────┘
```

---

## State Details

### IDLE

| Property        | Specification                                                                 |
| --------------- | ----------------------------------------------------------------------------- |
| **Visual**      | Avatar visible (48px), subtle ambient glow (#7C3AED, 20% opacity), no message |
| **Position**    | Right rail (desktop) / bottom-right corner (mobile)                           |
| **Interaction** | Tap avatar to open conversation                                               |
| **AI Behavior** | Silent. Waiting. Never initiates unprompted.                                  |
| **Text**        | None visible. Avatar only.                                                    |
| **Transition**  | Tap → CONNECTING (300ms)                                                      |

### AVAILABLE (Mentor has a suggestion)

| Property        | Specification                                                     |
| --------------- | ----------------------------------------------------------------- |
| **Visual**      | Avatar with pulse glow + one-line message below avatar            |
| **Text**        | "I noticed something I'd like to share" or context-specific hint  |
| **Interaction** | Tap to open and see suggestion                                    |
| **AI Behavior** | Has one suggestion ready, not multiple. Never urgent.             |
| **Duration**    | Message persists until: viewed, dismissed, or conversation opened |
| **Dismiss**     | Swipe down on message dismisses until next relevant moment        |

### CONNECTING

| Property       | Specification                                                            |
| -------------- | ------------------------------------------------------------------------ |
| **Visual**     | Avatar pulse animation (fast), circular progress indicator around avatar |
| **Duration**   | <2s target                                                               |
| **Text**       | "Connecting..." below avatar                                             |
| **Fallback**   | >3s → show "Taking longer than usual" message (no >5s without error)     |
| **Transition** | Success → ACTIVE. Fail → ERROR or OFFLINE.                               |

### ACTIVE

| Property        | Specification                                                        |
| --------------- | -------------------------------------------------------------------- |
| **Visual**      | Full chat interface (drawer or full-screen)                          |
| **Avatar**      | Static, 40px, colored ring (#7C3AED)                                 |
| **Header**      | "Your Mentor" with context badge (mode indicator)                    |
| **Input**       | Active input field, voice icon, attachment icon                      |
| **History**     | Last 10 exchanges visible, scrollable                                |
| **AI Behavior** | Responsive — answers, suggests, coaches                              |
| **Transition**  | User sends message → THINKING. User closes → IDLE (with draft save). |

### THINKING

| Property        | Specification                                             |
| --------------- | --------------------------------------------------------- |
| **Visual**      | Three purple dots animation, avatar glow intensifies      |
| **Duration**    | <3s target. >5s → "Still thinking..." message             |
| **Input**       | Disabled during thinking (user waits)                     |
| **Cancel**      | Tap "Stop" to cancel generation                           |
| **AI Behavior** | Processing query, retrieving context, generating response |
| **Transition**  | Complete → STREAMING. Cancel → ACTIVE. Error → ERROR.     |

### STREAMING

| Property         | Specification                                               |
| ---------------- | ----------------------------------------------------------- |
| **Visual**       | Text appears word by word, blinking purple cursor           |
| **Speed**        | ~50ms per word (natural reading pace)                       |
| **Max duration** | 4s for long messages                                        |
| **Skip**         | Tap on streaming text → full text appears instantly         |
| **Cancel**       | Tap "Stop" to interrupt generation mid-stream               |
| **AI Behavior**  | Response being delivered. Rich cards appear after text.     |
| **Transition**   | Complete → ACTIVE. Cancel → ACTIVE (partial response kept). |

### OFFLINE

| Property         | Specification                                                     |
| ---------------- | ----------------------------------------------------------------- |
| **Visual**       | Avatar with disconnected icon overlay, gray ring                  |
| **Text**         | "Your Mentor is offline. Available when connected."               |
| **Input**        | Disabled                                                          |
| **History**      | Last cached conversation visible                                  |
| **Queue**        | If user types while offline, message queued for send on reconnect |
| **Reconnection** | Auto-reconnect. Transition → CONNECTING → ACTIVE.                 |

### ERROR

| Property        | Specification                                                  |
| --------------- | -------------------------------------------------------------- |
| **Visual**      | Red indicator ring around avatar                               |
| **Text**        | "Something went wrong. Your conversation is safe."             |
| **Input**       | Enabled (message will retry)                                   |
| **Action**      | [Retry] button + auto-retry (3 attempts, 3s, 10s, 30s backoff) |
| **History**     | Full conversation preserved                                    |
| **Data safety** | "Your data is safe. No messages were lost."                    |

### PRIVACY MODE

| Property        | Specification                                                                        |
| --------------- | ------------------------------------------------------------------------------------ |
| **Visual**      | Shield icon overlay on avatar, muted purple                                          |
| **Text**        | "Privacy Mode — conversations are not recorded"                                      |
| **Input**       | Active, but no memory save                                                           |
| **AI Behavior** | Responds without accessing long-term memory. Uses only current conversation context. |
| **Transition**  | Toggle on/off via shield button in header                                            |
| **Memory**      | No conversations stored while privacy mode is active                                 |

---

## Loading & Empty States

| State                         | Visual                   | Text                                                                                                                  |
| ----------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| **First ever conversation**   | No history, welcome card | "I'm your Mentor. I've learned a little about you from our setup conversation. What would you like to explore today?" |
| **New session (has history)** | Last exchange visible    | "Welcome back. We were discussing [topic]. Would you like to continue?"                                               |
| **Conversation cleared**      | Empty state              | "I've cleared our conversation. Everything we talked about is still in your memory. What would you like to discuss?"  |
| **Loading history**           | Skeleton message bubbles | Ghost text lines                                                                                                      |

---

## Error Recovery

| Error           | User Message                                             | Action                                     | Auto-Recovery            |
| --------------- | -------------------------------------------------------- | ------------------------------------------ | ------------------------ |
| Network failure | "Mentor unavailable. Please check your connection."      | [Retry] + queue message                    | 3 retries (3s, 10s, 30s) |
| API timeout     | "Taking longer than expected. Please try again."         | [Retry] + [Send as text message for later] | 1 retry after 5s         |
| Content policy  | "I can't respond to that. Let's discuss something else." | [Change topic]                             | None                     |
| Rate limit      | "I need a moment. Please wait 30 seconds."               | [Wait] — auto-retry with countdown         | After 30s                |
| Server error    | "Something went wrong. Your message is safe."            | [Retry]                                    | 3 retries (1s, 3s, 10s)  |

---

## Accessibility

| Requirement            | Implementation                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| **Screen reader**      | All state changes announced. "Mentor is thinking" — "Mentor is responding" — "Mentor is ready" |
| **Focus management**   | Input auto-focused on ACTIVE. Error message focused on ERROR.                                  |
| **Time pressure**      | Never — no countdowns, no urgency indicators                                                   |
| **Color independence** | All state indicators also use text + icon, not color alone                                     |
| **Reduced motion**     | No streaming animation, no thinking dots (static indicator instead)                            |

---

## Cross-References

| Reference     | Relationship                                              |
| ------------- | --------------------------------------------------------- |
| DES-001 v1.0  | Design Constitution — colors, typography, spacing, radius |
| DES-003A v1.1 | Dashboard — AI Coach state alignment                      |
| DES-005/D00   | AI Mentor Constitution — state rules                      |
| DES-005/D02   | Conversation Experience — state applies here              |
| DES-005/D13   | AI Transparency — error transparency                      |
| DES-005/D14   | Motion — state transition animations                      |
| ARC-003       | Knowledge Graph — state-dependent context retrieval       |
| ARC-004       | Execution Intelligence — state-aware decision context     |
| ARC-005       | AI Orchestration — state machine alignment                |
| PRD-002       | User DNA — state personalization                          |
| ENG-001       | Domain Model — state entity specifications                |
| ENG-002       | Implementation Standards — state machine patterns         |
| ENG-003       | AI Development Guidelines — AI state safety               |
