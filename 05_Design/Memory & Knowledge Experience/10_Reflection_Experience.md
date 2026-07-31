# Reflection Experience

> **Document:** DES-004-D10 — Memory & Knowledge Experience  
> **Status:** 🔒 **LOCKED** — Part of DES-004 Memory Constitution v1.0  
> **Design Constitution:** DES-001 v1.0 · DES-002A v1.0 · DES-003A v1.1

---

## Purpose

The Reflection Experience is how users revisit, review, and derive meaning from their past memories, decisions, and growth. Reflection transforms raw memories into wisdom.

**Why it exists:** Memory without reflection is just storage. Reflection is how humans learn from experience, recognize patterns, and gain perspective on their journey.

**How it connects:** Reflection draws from the Memory Timeline, Life Chapters, Knowledge Garden, and Growth Visualization. Reflections become new memories themselves, creating a virtuous cycle.

**What it changed:** Without deliberate reflection, users move forward without learning from the past. Reflection creates closure, pattern recognition, and emotional resolution.

**How it influenced later decisions:** Reflective insights strengthen the User DNA, recalibrate goals, and inform the Decision Engine with deeper understanding of what worked and what didn't.

---

## Psychology

| Principle              | Application                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| **Narrative identity** | Humans understand their lives as stories. Reflection helps construct a coherent life narrative. |
| **Meaning-making**     | Reflection transforms random events into meaningful experiences.                                |
| **Gratitude effect**   | Reflecting on positive past experiences increases well-being.                                   |
| **Closure**            | Reflection provides cognitive closure for unresolved experiences.                               |
| **Growth mindset**     | Recognizing past growth reinforces belief in future growth.                                     |
| **Self-distancing**    | Third-person reflection ("What would future you say?") reduces emotional bias.                  |

---

## Reflection Types

### 1. Daily Reflection (End-of-Day)

| Property      | Specification                                                                |
| ------------- | ---------------------------------------------------------------------------- |
| **Trigger**   | Evening notification (user's configured time)                                |
| **Duration**  | 2-3 minutes                                                                  |
| **Questions** | "What went well today?", "What did you learn?", "What are you grateful for?" |
| **Format**    | Journal-like free-form + guided prompts                                      |
| **AI Role**   | Summarize the day's highlights from timeline, suggest reflection prompts     |
| **Output**    | Daily reflection card in timeline                                            |
| **Frequency** | Optional — user configures days per week                                     |

### 2. Weekly Review

| Property      | Specification                                                             |
| ------------- | ------------------------------------------------------------------------- |
| **Trigger**   | Sunday evening or user-configured time                                    |
| **Duration**  | 5-10 minutes                                                              |
| **Content**   | Week in review: accomplishments, challenges, learnings, next week preview |
| **AI Role**   | Generate week summary from captured memories, highlight patterns          |
| **Format**    | Structured: Wins → Learnings → Adjustments → Next Week Focus              |
| **Output**    | Weekly reflection card + momentum data                                    |
| **Frequency** | Once per week (adjustable)                                                |

### 3. Monthly Reflection

| Property     | Specification                                                                    |
| ------------ | -------------------------------------------------------------------------------- |
| **Trigger**  | End of month                                                                     |
| **Duration** | 10-15 minutes                                                                    |
| **Content**  | Monthly growth, goal progress, knowledge expansion, connection discoveries       |
| **AI Role**  | Monthly digest: new connections discovered, skills developing, patterns emerging |
| **Format**   | Rich card with growth visualization, key memories, insight highlights            |
| **Output**   | Monthly reflection + growth snapshot                                             |

### 4. Memory Anniversary

| Property      | Specification                                                     |
| ------------- | ----------------------------------------------------------------- |
| **Trigger**   | 1 month, 6 months, 1 year since significant memory                |
| **Duration**  | 1-2 minutes                                                       |
| **Content**   | "One year ago today..." with original memory + current reflection |
| **AI Role**   | Compare then vs now, highlight growth, suggest journal prompt     |
| **Format**    | Side-by-side: original memory + today's reflection                |
| **Frequency** | Algorithm-determined (not every day, not every memory)            |

### 5. Chapter Reflection

| Property      | Specification                                                        |
| ------------- | -------------------------------------------------------------------- |
| **Trigger**   | Life Chapter transition or completion                                |
| **Duration**  | 15-20 minutes                                                        |
| **Content**   | Full chapter review: key memories, decisions, growth, lessons        |
| **AI Role**   | Comprehensive chapter summary, thematic analysis, connection map     |
| **Format**    | Rich multi-card experience with timeline, growth chart, key insights |
| **Frequency** | As chapters close                                                    |

### 6. Spontaneous Reflection

| Property     | Specification                                               |
| ------------ | ----------------------------------------------------------- |
| **Trigger**  | User opens the Reflection view anytime                      |
| **Duration** | User-determined                                             |
| **Content**  | Any memory, any connection, any insight                     |
| **AI Role**  | "What would you like to reflect on today?" with suggestions |
| **Format**   | Open journal + guided options                               |

---

## Reflection Interface

### Daily Reflection

```
┌──────────────────────────────────────┐
│  ✨ Evening Reflection               │
│                                      │
│  "What went well today?"             │
│                                      │
│  ┌────────────────────────────────┐  │
│  │                                │  │
│  │  Write your reflection...      │  │
│  │                                │  │
│  └────────────────────────────────┘  │
│                                      │
│  AI suggests based on today:         │
│  ┌────────────────────────────────┐  │
│  │ 📅 Completed 3 tasks           │  │
│  │ 💡 Had a career insight        │  │
│  │ 📚 Finished learning module    │  │
│  └────────────────────────────────┘  │
│                                      │
│  [  Save Reflection  ]  [Skip]       │
└──────────────────────────────────────┘
```

### Memory Anniversary

```
┌──────────────────────────────────────────────┐
│  🌱 One Year Ago                             │
│                                              │
│  ┌──────────────────┐  ┌──────────────────┐  │
│  │  THEN             │  │  NOW              │  │
│  │                   │  │                   │  │
│  │ Started my career │  │ Leading a team    │  │
│  │ transition        │  │ in new role       │  │
│  │                   │  │                   │  │
│  │ "Nervous but      │  │ "Proud of how     │  │
│  │  excited"         │  │  far I've come"   │  │
│  └──────────────────┘  └──────────────────┘  │
│                                              │
│  ✨ Growth: Career confidence +40%            │
│     Skills acquired: 5                        │
│                                              │
│  [  Journal about this  ]  [Dismiss]          │
└──────────────────────────────────────────────┘
```

---

## AI Role in Reflection

| Capability              | Description                                                |
| ----------------------- | ---------------------------------------------------------- |
| **Highlight surfacing** | AI selects meaningful memories from the period             |
| **Pattern recognition** | "You've been exploring career topics more this month."     |
| **Growth comparison**   | "Your decision-making confidence has grown since January." |
| **Prompt generation**   | Contextual questions based on recent activity              |
| **Gentle suggestion**   | "Would you like to reflect on this?" — never demanding     |
| **No fabrication**      | AI never invents memories. Only surfaces real captures.    |
| **Privacy boundary**    | AI never shares reflections across user accounts           |
| **Opt-out**             | Users can decline any reflection prompt                    |

---

## States

### Empty State (No Reflections Yet)

- "Your reflections will appear here after your first week with VedMoulya."
- Weekly reflection preview card (skeleton)
- "Set your reflection preferences" link

### Loading State

- Skeleton cards for reflection type
- Pulsing text lines for journal prompts
- Ghosted "memory anniversary" card

### Error State

| Error              | Message                                           | Action                   |
| ------------------ | ------------------------------------------------- | ------------------------ |
| AI unavailable     | "Reflection suggestions temporarily unavailable." | Save without AI          |
| Save failed        | "Couldn't save reflection."                       | Auto-retry + local draft |
| Memory unavailable | "Memory not found."                               | Skip anniversary         |

### Offline State

- Write reflection offline
- Sync when reconnected
- AI suggestions deferred

---

## Accessibility

| Requirement             | Implementation                                 |
| ----------------------- | ---------------------------------------------- |
| **Voice input**         | Dictate reflections instead of typing          |
| **Keyboard navigation** | Full journal navigation via keyboard           |
| **Screen reader**       | Reflection prompts announced as headings       |
| **Focus management**    | Auto-focus journal input when reflection opens |
| **Reduced motion**      | No decorative animations in reflection view    |
| **Contrast**            | Reflective text meets WCAG AA                  |
| **Time flexibility**    | No countdown or pressure mechanics             |
| **Skip option**         | Every reflection is skippable without penalty  |

---

## Responsive Behavior

| Device                | Layout                                               |
| --------------------- | ---------------------------------------------------- |
| **Desktop (1280px+)** | Full journal with side-by-side memory reference      |
| **Laptop (1024px)**   | Full-width journal, collapsible memory sidebar       |
| **Tablet (768px)**    | Stacked layout, memory reference below journal       |
| **Mobile (<480px)**   | Single column, memory reference accessible via swipe |
| **Foldable**          | Journal on one side, references on the other         |

---

## Performance

| Metric                    | Target                 |
| ------------------------- | ---------------------- |
| Reflection open animation | 300ms                  |
| AI suggestion generation  | <2s                    |
| Memory anniversary load   | <1s                    |
| Save reflection           | <500ms                 |
| Offline draft sync        | <3s after reconnection |

---

## Motion

| Element              | Animation                      | Duration | Easing   |
| -------------------- | ------------------------------ | -------- | -------- |
| Reflection appear    | Gentle fade + slide up         | 400ms    | ease-out |
| Memory anniversary   | Flip card reveal (then vs now) | 600ms    | ease-out |
| Journal save         | Subtle check mark pulse        | 300ms    | ease-out |
| AI suggestion appear | Gentle fade in                 | 400ms    | ease-out |
| Skip                 | Subtle scale + fade out        | 200ms    | ease-out |

---

## Cross-References

| Document      | Relationship                                                     |
| ------------- | ---------------------------------------------------------------- |
| DES-001 v1.0  | Design Constitution — colors, typography, spacing, radius        |
| DES-003A v1.1 | Dashboard — Daily Rhythm includes Evening Reflection mode        |
| ARC-003       | Knowledge Graph — reflections as connected nodes                 |
| ARC-004       | Execution Intelligence — reflections inform decision improvement |
| ARC-005       | AI Orchestration — reflection prompt generation                  |
| PRD-002       | User DNA — reflections enrich user understanding                 |
| ENG-001       | Domain Model — Reflection entity specifications                  |
| D02 Timeline  | Reflections appear in Memory Timeline                            |
| D05 Chapters  | Chapter reflection is a dedicated experience                     |
| D06 Details   | Each reflection has a detail view                                |
| D09 Capture   | Reflections can be captured and saved                            |
| D11 Growth    | Long-term reflection reveals growth patterns                     |
