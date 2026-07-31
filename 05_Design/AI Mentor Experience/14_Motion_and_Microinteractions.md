# Motion & Microinteractions

> **Document:** DES-005-D14 — AI Mentor Experience & Conversation System  
> **Status:** 🔒 **LOCKED** — Part of DES-005 AI Mentor Constitution v1.0

---

## Purpose

Motion in the Mentor experience must feel calm, purposeful, and Apple-quality. Every animation serves a functional purpose — showing state changes, guiding attention, or creating natural conversation rhythm.

---

## Motion Philosophy

| Principle                 | Application                                      |
| ------------------------- | ------------------------------------------------ |
| **Conversational rhythm** | Motion mirrors natural conversation pacing       |
| **State clarity**         | Every state change has a clear visual transition |
| **Minimal**               | No decorative animations                         |
| **Respectful**            | Reduced Motion respected at all times            |

---

## Animations

| Element                     | Animation                   | Duration    | Easing                  |
| --------------------------- | --------------------------- | ----------- | ----------------------- |
| Conversation open (drawer)  | Slide up from bottom        | 300ms       | ease-out                |
| Conversation open (desktop) | Slide in from right         | 300ms       | ease-out                |
| Message appear (user)       | Fade + slide up             | 200ms       | ease-out                |
| Message appear (AI)         | Fade + slide up (staggered) | 200ms       | ease-out                |
| Streaming text              | Word by word (~50ms/word)   | Variable    | linear                  |
| Thinking indicator          | Three dots pulse            | 300ms cycle | ease-out                |
| Avatar state change         | Color/glow transition       | 200ms       | ease-out                |
| Confidence dots fill        | Sequential fill             | 300ms       | ease-out                |
| Transparency card expand    | Card height expands         | 300ms       | ease-out                |
| History list entrance       | Staggered fade              | 200ms       | ease-out (80ms stagger) |
| Pin/unpin                   | Scale bounce                | 300ms       | spring                  |
| Reduced motion              | All 0ms                     | —           | prefers-reduced-motion  |

---

## Microinteractions

| Interaction            | Animation             | Duration |
| ---------------------- | --------------------- | -------- |
| Send button enable     | Color fill transition | 150ms    |
| Voice recording start  | Waveform appears      | 200ms    |
| Voice recording end    | Waveform freezes      | 100ms    |
| Suggested response tap | Scale to 0.97 → 1.0   | 150ms    |
| Scroll to bottom       | Smooth scroll         | 200ms    |
| New message indicator  | Badge appear          | 200ms    |
| Attachment menu open   | Expand with stagger   | 200ms    |

---

## Reduced Motion

| Animation         | Static Alternative             |
| ----------------- | ------------------------------ |
| Streaming text    | Full text appears instantly    |
| Thinking dots     | Static "Thinking..." indicator |
| Slide transitions | Instant cross-fade             |
| Avatar glow       | Static colored ring            |

---

## Cross-References

| Reference     | Relationship                                               |
| ------------- | ---------------------------------------------------------- |
| DES-001 v1.0  | Design Constitution — motion philosophy                    |
| DES-003A v1.1 | Dashboard — Coach animation alignment                      |
| DES-004 v1.0  | Memory & Knowledge — motion language consistency           |
| DES-005/D00   | AI Mentor Constitution — motion standards                  |
| DES-005/D02   | Conversation Experience — animations apply here            |
| DES-005/D03   | Conversation States — state transition animations          |
| ARC-003       | Knowledge Graph — motion-triggered context changes         |
| ARC-004       | Execution Intelligence — motion for decision updates       |
| ARC-005       | AI Orchestration — animation timing alignment              |
| PRD-002       | User DNA — personalized motion preferences                 |
| ENG-001       | Domain Model — animation state entities                    |
| ENG-002       | Implementation Standards — animation performance standards |
| ENG-003       | AI Development Guidelines — reduced motion compliance      |
