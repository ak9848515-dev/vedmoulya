# Capture Experience

> **Document:** DES-004-D09 — Memory & Knowledge Experience  
> **Status:** 🔒 **LOCKED** — Part of DES-004 Memory Constitution v1.0  
> **Design Constitution:** DES-001 v1.0 · DES-002A v1.0 · DES-003A v1.1

---

## Purpose

The Capture Experience is how users add memories, knowledge, insights, and documents to VedMoulya. It must feel effortless, natural, and delightful — never like data entry.

**Why it exists:** Memories that are not captured are lost. The Capture Experience lowers the barrier to recording life's meaningful moments, insights, decisions, and learnings.

**How it connects:** Every capture feeds the Memory Timeline, Knowledge Garden, and Life Chapters. Captures become the raw material for connections, reflections, and growth visualization.

**What it changed:** Without Capture, VedMoulya is passive. With Capture, the system becomes alive — continuously learning from the user's input, not just from observed behavior.

**How it influenced later decisions:** Each capture enriches the User DNA, informs the Decision Engine, strengthens the Knowledge Graph, and enables more personalized recommendations.

---

## Psychology

| Principle            | Application                                                                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Effort reduction** | The less friction to capture, the more users will capture. Every tap, click, or second of typing is a barrier.                                |
| **Completion bias**  | Users are more likely to capture if they see immediate value — a structured memory card, a suggested connection, a timestamp in the timeline. |
| **Present bias**     | Users undervalue future reflection. Capture must feel valuable NOW, not just "someday."                                                       |
| **Endowment effect** | Once captured, users value their memories more. Capturing creates ownership.                                                                  |
| **Zeigarnik effect** | Unfinished captures nag. The experience should encourage completion without pressure.                                                         |

---

## Capture Entry Points

| Entry Point                 | Trigger                                            | Experience                                      |
| --------------------------- | -------------------------------------------------- | ----------------------------------------------- |
| **Quick Capture Button**    | Floating action button (bottom right, all screens) | Expands: text, voice, image, document, bookmark |
| **Dashboard Quick Actions** | Dashboard D09 spec                                 | Knowledge Capture, Voice Notes one-tap          |
| **Context Menu**            | Long-press/hover on any card                       | "Save as memory", "Add to knowledge"            |
| **Share Sheet**             | OS share integration                               | External apps → VedMoulya capture               |
| **AI Suggestion**           | Coach or Knowledge Assistant                       | "Would you like to save this insight?"          |
| **Empty State**             | No memories yet                                    | "Start capturing your first memory" prompt      |
| **Keyboard Shortcut**       | Desktop: Cmd+K / Ctrl+K                            | Quick capture overlay                           |

---

## Capture Types

### 1. Text Memory

| Property           | Specification                                             |
| ------------------ | --------------------------------------------------------- |
| **Trigger**        | Quick capture → "Write a note"                            |
| **Input**          | Multi-line text field, auto-expanding                     |
| **Max Length**     | 10,000 characters                                         |
| **Font**           | Inter, 16px, Regular (400)                                |
| **Spacing**        | 16px padding inside field                                 |
| **Radius**         | 16px (DES-001 input radius)                               |
| **Background**     | #FFFFFF card                                              |
| **Border**         | #E8EDF5, focus: #2B5FD9                                   |
| **AI Enhancement** | Optional: "Summarize", "Extract insights", "Suggest tags" |
| **Auto-save**      | Yes, after 3 seconds of inactivity                        |

### 2. Voice Memory

| Property              | Specification                                            |
| --------------------- | -------------------------------------------------------- |
| **Trigger**           | Quick capture → microphone icon                          |
| **UI**                | Waveform animation, recording indicator                  |
| **Max Duration**      | 5 minutes                                                |
| **Font**              | Inter, Caption 14px for transcription                    |
| **Processing**        | Real-time transcription                                  |
| **Output**            | Text memory + audio attachment                           |
| **AI Enhancement**    | Auto-transcribe, extract key points, suggest connections |
| **State: Recording**  | Pulsing red dot, waveform, elapsed time                  |
| **State: Processing** | Skeleton waveform, "Transcribing..."                     |
| **State: Complete**   | Transcription card with play button                      |

### 3. Image Memory

| Property          | Specification                                            |
| ----------------- | -------------------------------------------------------- |
| **Trigger**       | Quick capture → image icon                               |
| **Source**        | Camera, photo library, file picker                       |
| **Preview**       | Thumbnail grid (multiple), 120x120px each                |
| **AI Processing** | OCR text extraction, scene recognition, people detection |
| **Output**        | Image card + AI description + extracted text             |
| **Max Images**    | 10 per capture                                           |
| **Storage**       | Compressed (WebP, 80% quality)                           |

### 4. Document Capture

| Property          | Specification                                     |
| ----------------- | ------------------------------------------------- |
| **Trigger**       | Quick capture → document icon                     |
| **Formats**       | PDF, DOCX, TXT, Markdown, HTML                    |
| **Preview**       | First page thumbnail + metadata                   |
| **AI Processing** | Full text extraction, summary, key topics         |
| **Output**        | Document card + AI summary + full text searchable |
| **Max Size**      | 25 MB                                             |

### 5. Bookmark / Link

| Property          | Specification                                      |
| ----------------- | -------------------------------------------------- |
| **Trigger**       | Quick capture → link icon                          |
| **Input**         | URL text field                                     |
| **Processing**    | Fetch page title, description, OG image            |
| **AI Processing** | Summary, key topics, relevance to user's knowledge |
| **Output**        | Bookmark card + AI summary                         |

### 6. AI-Generated Memory

| Property    | Specification                                    |
| ----------- | ------------------------------------------------ |
| **Trigger** | AI Coach suggests saving a conversation insight  |
| **UI**      | "Would you like to save this?" card with preview |
| **Action**  | One-tap accept, edit preview, or dismiss         |
| **Output**  | Memory card with AI attribution label            |

---

## Capture Interface

### Quick Capture Overlay (Mobile/Overlay)

```
┌──────────────────────────────┐
│         New Memory           │
│                              │
│  [Text] [Voice] [Image] [Doc]│
│                              │
│  ┌────────────────────────┐  │
│  │                        │  │
│  │  What's on your mind?  │  │
│  │                        │  │
│  │                        │  │
│  └────────────────────────┘  │
│                              │
│  Tags: ______ + Add tag      │
│                              │
│  [Privacy: Private ▼]        │
│                              │
│  [  Save Memory  ] [Cancel]  │
└──────────────────────────────┘
```

### Full-Screen Capture (Desktop)

```
┌──────────────────────────────────────────────────────┐
│  ← Back                          Save  [Cancel]      │
│                                                        │
│  ● Text    ○ Voice    ○ Image    ○ Document    ○ Link  │
│                                                        │
│  ┌────────────────────────────────────────────────┐    │
│  │                                                │    │
│  │  What's on your mind?                          │    │
│  │                                                │    │
│  │                                                │    │
│  │                                                │    │
│  └────────────────────────────────────────────────┘    │
│                                                        │
│  ┌────────────────────────────────────────────────┐    │
│  │  Tags:  [insight] [career] [learning]  + Add   │    │
│  └────────────────────────────────────────────────┘    │
│                                                        │
│  Privacy: ● Private  ○ Connected  ○ Public             │
│                                                        │
│  [✨ AI Suggestions]  [🔗 Suggested Connections]       │
└──────────────────────────────────────────────────────────┘
```

---

## AI Enhancement

After capturing, the AI offers optional enhancements:

| Enhancement          | Description                                  | Trigger                     |
| -------------------- | -------------------------------------------- | --------------------------- |
| **Summarize**        | Condense long text to 3-5 key points         | Auto-suggest for >500 chars |
| **Extract Insights** | Identify lessons, decisions, patterns        | Always available            |
| **Suggest Tags**     | Auto-tag based on content                    | Auto after save             |
| **Find Connections** | Link to existing memories, knowledge         | Auto after save             |
| **Suggest Chapter**  | Recommend which Life Chapter this belongs to | Auto after save             |
| **Set Reminder**     | "Review this in 30 days"                     | Optional prompt             |

---

## States

### Empty State (First Capture)

```
┌──────────────────────────────────────┐
│                                      │
│           📝                          │
│                                      │
│    Your first memory awaits           │
│                                      │
│    Capture a thought, an insight,     │
│    a photo, or a voice note.          │
│                                      │
│    [  Capture Now  ]                  │
│                                      │
└──────────────────────────────────────┘
```

### Loading State

- Skeleton of the capture card
- Pulsing placeholder text lines
- Ghost icon for media type selector

### Error State

| Error              | Message                             | Action                         |
| ------------------ | ----------------------------------- | ------------------------------ |
| Network failure    | "Couldn't save. Check connection."  | Retry button + auto-save draft |
| File too large     | "File exceeds 25MB limit."          | Compress option                |
| Invalid format     | "Format not supported."             | Supported formats list         |
| Voice too long     | "Voice notes limited to 5 minutes." | Trim option                    |
| Processing failure | "AI enhancement failed."            | Save without enhancement       |

### Offline State

- Capture works offline
- Queued for sync when connection returns
- "Saved locally" indicator
- Sync progress when reconnected

---

## Accessibility

| Requirement             | Implementation                                              |
| ----------------------- | ----------------------------------------------------------- |
| **Voice alternative**   | All voice captures must have text transcription             |
| **Keyboard**            | Full keyboard navigation: Tab through inputs, Enter to save |
| **Screen reader**       | `Save memory` button, `Recording in progress` announcements |
| **Focus management**    | Auto-focus text input when overlay opens                    |
| **Error announcements** | Live region updates for errors                              |
| **Contrast**            | All inputs meet WCAG AA (4.5:1)                             |
| **Touch targets**       | All buttons minimum 44x44px                                 |
| **Reduced motion**      | No decorative animations on capture elements                |
| **Color independence**  | Icons + labels for all capture types                        |

---

## Responsive Behavior

| Device                | Layout                                                    |
| --------------------- | --------------------------------------------------------- |
| **Desktop (1280px+)** | Full-screen capture, side panel for AI suggestions        |
| **Laptop (1024px)**   | Overlay modal, centered, 640px wide                       |
| **Tablet (768px)**    | Bottom sheet overlay, full-width                          |
| **Mobile (<480px)**   | Full-screen bottom sheet, simplified options              |
| **Foldable**          | Spans inner display, reverts to single column when folded |

---

## Performance

| Metric                               | Target                 |
| ------------------------------------ | ---------------------- |
| Capture open animation               | 200ms                  |
| Text save to timeline                | <500ms                 |
| Voice transcription                  | <3s for 1 minute       |
| Image processing (OCR + description) | <5s                    |
| AI enhancement suggestions           | <2s after save         |
| Offline queue sync                   | <5s after reconnection |

---

## Motion

| Element              | Animation               | Duration   | Easing   |
| -------------------- | ----------------------- | ---------- | -------- |
| Overlay appear       | Slide up + fade in      | 300ms      | ease-out |
| Input focus          | Border color transition | 200ms      | ease-out |
| Save confirmation    | Check mark scale in     | 400ms      | ease-out |
| AI suggestion appear | Slide in from bottom    | 300ms      | ease-out |
| Tag addition         | Tag chip scale in       | 200ms      | ease-out |
| Voice recording      | Waveform animation      | Continuous | —        |

---

## Cross-References

| Document       | Relationship                                              |
| -------------- | --------------------------------------------------------- |
| DES-001 v1.0   | Design Constitution — colors, typography, spacing, radius |
| DES-003A v1.1  | Dashboard — Quick Actions entry point                     |
| ARC-003        | Knowledge Graph — captured items become graph nodes       |
| ARC-004        | Execution Intelligence — captures inform decisions        |
| ARC-005        | AI Orchestration — AI enhancement pipeline                |
| PRD-002        | User DNA — captured content enriches user model           |
| ENG-001        | Domain Model — Memory entity specifications               |
| D02 Timeline   | Captures appear chronologically in Memory Timeline        |
| D03 Garden     | Captured knowledge populates Knowledge Garden             |
| D06 Details    | Saved memories have detail views                          |
| D10 Reflection | Captured memories fuel reflection                         |
| D11 Growth     | Long-term capture patterns show growth                    |
