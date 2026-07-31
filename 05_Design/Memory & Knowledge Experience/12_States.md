# States

> **Document:** DES-004-D12 — Memory & Knowledge Experience  
> **Status:** 🔒 **LOCKED** — Part of DES-004 Memory Constitution v1.0  
> **Design Constitution:** DES-001 v1.0 · DES-002A v1.0 · DES-003A v1.1

---

## Purpose

This document defines every state across the Memory & Knowledge Experience — loading, empty, error, offline, AI unavailable, and success states. Consistent state design ensures users always know what is happening and what to do next.

**Why it exists:** Users feel anxious when systems are unclear. Explicit state design removes uncertainty, builds trust, and provides calm guidance through every situation.

**How it connects:** Every document in DES-004 (D02-D11, D13-D14) references these state specifications.

**What it changed:** Without defined states, developers improvise. Standardized states ensure consistent, high-quality user experience across every screen.

**How it influenced later decisions:** State patterns established here become the template for all future VedMoulya experiences.

---

## State Types

| State              | Emotion        | Goal                          |
| ------------------ | -------------- | ----------------------------- |
| **Loading**        | Anticipation   | Entertain without frustration |
| **Empty**          | Curiosity      | Invite first action           |
| **Error**          | Frustration    | Recover with minimal friction |
| **Offline**        | Uncertainty    | Communicate capability limits |
| **AI Unavailable** | Disappointment | Maintain trust in AI          |
| **Success**        | Satisfaction   | Reinforce positive behavior   |

---

## Loading States

### Skeleton Loading

| Property       | Specification                                    |
| -------------- | ------------------------------------------------ |
| **Style**      | Ghost skeleton with gentle pulse animation       |
| **Color**      | #E8EDF5 base, lighter pulse overlay              |
| **Duration**   | 1.5s pulse cycle                                 |
| **Radius**     | 16px (inputs), 24px (cards)                      |
| **Text lines** | 3-line skeleton for content, 1-line for headings |
| **Transition** | Skeleton → content with 300ms cross-fade         |

### Component-Specific Skeletons

| Component              | Skeleton Spec                                            |
| ---------------------- | -------------------------------------------------------- |
| **Memory Card**        | Rounded rect (24px), 3 text lines, thumbnail placeholder |
| **Timeline**           | 5 stacked card skeletons, staggered 100ms apart          |
| **Knowledge Garden**   | 6 card skeletons in grid, staggered 80ms apart           |
| **Search Results**     | 5 list item skeletons with icon placeholders             |
| **Growth Chart**       | Chart-shaped skeleton (ring/bar outlines)                |
| **Reflection Journal** | Text area skeleton + prompt skeleton                     |
| **Capture**            | Input field skeleton + type selector ghost icons         |

---

## Empty States

### General Rules

| Rule             | Specification                                           |
| ---------------- | ------------------------------------------------------- |
| **Illustration** | Calm, minimal illustration (DES-001 illustration style) |
| **Heading**      | H4 (24px), Satoshi, Medium (500)                        |
| **Description**  | Body (16px), Inter, Regular (400), #64748B              |
| **Action**       | Primary or ghost button, clear next step                |
| **Spacing**      | 48px above illustration, 24px between elements          |

### Screen-Specific Empty States

| Screen               | Illustration       | Heading                                   | Description                                                  | Action                 |
| -------------------- | ------------------ | ----------------------------------------- | ------------------------------------------------------------ | ---------------------- |
| **Timeline**         | Open journal       | "Your story begins here"                  | "Every memory you capture will appear here."                 | [Capture First Memory] |
| **Knowledge Garden** | Seedling           | "Your garden is waiting"                  | "Start exploring topics and saving insights."                | [Explore Topics]       |
| **Life Chapters**    | Blank book         | "The chapters of your life"               | "VedMoulya will suggest chapters as you capture memories."   | [Learn More]           |
| **Connections**      | Dots without lines | "Connections emerge over time"            | "As you capture more, meaningful connections will appear."   | [Start Capturing]      |
| **Search**           | Magnifying glass   | "No results found"                        | "Try different keywords or browse your knowledge garden."    | [Browse Garden]        |
| **Reflection**       | Calm moon          | "Reflections begin after your first week" | "Your first reflection prompt will appear soon."             | [Set Preferences]      |
| **Growth**           | Seed to sprout     | "Your growth story is just beginning"     | "As you use VedMoulya, your growth will be visualized here." | [Explore Introduction] |
| **Capture**          | Notebook           | "What's on your mind?"                    | "Start capturing your thoughts, insights, and memories."     | [Write a Note]         |

---

## Error States

### Error Recovery Rules

| Rule            | Specification                                        |
| --------------- | ---------------------------------------------------- |
| **Tone**        | Calm, apologetic but not overly so. Never technical. |
| **Message**     | "Something went wrong" + what happened.              |
| **Action**      | Retry button with exponential backoff guidance.      |
| **Auto-retry**  | 3 automatic retries with 1s, 3s, 5s delays.          |
| **Fallback**    | Offline mode with local storage.                     |
| **Data safety** | "Your data is safe" reassurance.                     |

### Screen-Specific Error States

| Screen               | Error Message                 | Detail                                           | Action                         |
| -------------------- | ----------------------------- | ------------------------------------------------ | ------------------------------ |
| **Timeline**         | "Couldn't load your timeline" | "This may be a temporary issue."                 | [Retry] + [Go to Dashboard]    |
| **Knowledge Garden** | "Unable to load your garden"  | "Your knowledge is safe."                        | [Retry]                        |
| **Memory Detail**    | "Memory not found"            | "This memory may have been deleted."             | [Back to Timeline]             |
| **Search**           | "Search unavailable"          | "Please try again later."                        | [Retry]                        |
| **Capture Save**     | "Couldn't save memory"        | "Don't worry — your draft is saved locally."     | [Retry] + [Save Draft Locally] |
| **Growth**           | "Growth data unavailable"     | "We're having trouble loading your growth data." | [Retry]                        |
| **Connections**      | "Connection map unavailable"  | "Your connections are safe. Please try again."   | [Retry]                        |
| **Network**          | "No internet connection"      | "Some features are limited offline."             | [Continue in Offline Mode]     |

---

## Offline States

### Offline Capability Matrix

| Feature               | Offline | Partial Offline | Full Online Needed |
| --------------------- | ------- | --------------- | ------------------ |
| View cached timeline  | ✅      | —               | —                  |
| View cached garden    | ✅      | —               | —                  |
| View cached growth    | ✅      | —               | —                  |
| Capture text memory   | ✅      | —               | —                  |
| Capture voice (local) | ✅      | —               | —                  |
| AI enhancements       | —       | ❌              | ✅                 |
| New connections       | —       | ❌              | ✅                 |
| Search (full)         | —       | ❌              | ✅                 |
| Sync captures         | —       | ✅ (queued)     | ✅                 |
| View latest memories  | —       | ✅ (cached)     | ✅                 |

### Offline UI

```
┌──────────────────────────────────────┐
│  📡 No Internet Connection           │
│                                      │
│  You can still view your memories    │
│  and capture new ones. They'll sync  │
│  when you're back online.            │
│                                      │
│  [  Continue Offline  ]              │
└──────────────────────────────────────┘
```

| Element             | Specification                                   |
| ------------------- | ----------------------------------------------- |
| **Banner**          | Top of screen, #F5F7FA background, #64748B text |
| **Icon**            | Outline signal-off icon, 20x20px                |
| **Auto-dismiss**    | Banner disappears 3s after reconnection         |
| **Queue indicator** | "3 items pending sync" badge                    |
| **Sync progress**   | Progress bar when reconnecting                  |

---

## AI Unavailable State

### Scenarios

| Scenario       | Message                               | Fallback                     |
| -------------- | ------------------------------------- | ---------------------------- |
| API outage     | "AI features temporarily unavailable" | Manual input, cached AI data |
| Rate limited   | "AI is taking a brief rest"           | Retry in 60s                 |
| Content policy | "AI couldn't process this content"    | Save without AI enhancement  |
| Privacy mode   | "AI is paused (Privacy Mode)"         | Full manual control          |

### AI Unavailable UI

```
┌──────────────────────────────────────┐
│  🤖 AI Assistant is resting          │
│                                      │
│  Don't worry — your data is safe.    │
│  AI features will return shortly.    │
│                                      │
│  You can continue capturing          │
│  without AI enhancement.             │
│                                      │
│  [  Continue Without AI  ]           │
└──────────────────────────────────────┘
```

---

## Success States

### Success Feedback Rules

| Rule          | Specification                                                  |
| ------------- | -------------------------------------------------------------- |
| **Duration**  | Toast: 3s auto-dismiss. Card: persistent until dismissed.      |
| **Animation** | Subtle check mark scale-in. No confetti or flashy effects.     |
| **Position**  | Toast: top center. Card: inline replacement of previous state. |
| **Message**   | Specific to action: "Memory saved", "Reflection recorded"      |
| **Action**    | Optional undo within 5s                                        |

### Screen-Specific Success

| Action           | Message                     | Duration       | Extra     |
| ---------------- | --------------------------- | -------------- | --------- |
| Memory saved     | "Saved to your timeline"    | 3s toast       | [Undo]    |
| Reflection saved | "Reflection recorded"       | 3s toast       | —         |
| Capture enhanced | "AI suggestions ready"      | 5s card        | [View]    |
| Search complete  | "12 results found"          | Persistent     | —         |
| Connection found | "New connection discovered" | 5s inline card | [Explore] |
| Growth updated   | "Growth snapshot updated"   | 3s toast       | [View]    |
| Sync complete    | "2 items synced"            | 3s toast       | —         |

---

## Accessibility for States

| Requirement            | Implementation                                                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Screen reader**      | Loading: "Loading timeline" announcement. Error: "Error: couldn't load" announcement. Success: "Memory saved" announcement. |
| **Focus management**   | Error: focus moves to error message. Success: focus stays on action.                                                        |
| **Auto-dismiss**       | Toasts auto-dismiss in 3s but persist for screen reader focus                                                               |
| **Reduced motion**     | No skeleton pulse animation — static skeleton instead                                                                       |
| **Color independence** | Error icons + text, not color alone                                                                                         |
| **Time pressure**      | No time-limited actions (undo has 5s but no countdown shown)                                                                |

---

## Cross-References

| Document       | Relationship                                              |
| -------------- | --------------------------------------------------------- |
| DES-001 v1.0   | Design Constitution — colors, typography, spacing, radius |
| DES-003A v1.1  | Dashboard — Dashboard States (D12) patterns reused        |
| All D02-D11    | Each document's states reference this specification       |
| D13 Animations | Loading animation specs, success animation specs          |
| D14 Responsive | State behavior across device form factors                 |
| ARC-003        | Knowledge Graph — offline data availability               |
| ARC-005        | AI Orchestration — AI unavailable fallback                |
