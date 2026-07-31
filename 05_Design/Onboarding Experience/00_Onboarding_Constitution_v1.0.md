# VedMoulya Onboarding Constitution v1.0

> **Document:** The Final, Locked Specification for the Onboarding Experience
> **Mission:** DES-002A — Onboarding Experience Refinement & Finalization
> **Status:** 🔒 **LOCKED** — Effective immediately. No further onboarding design changes without formal Design Review.
> **Version:** 1.0.0
> **Date:** July 27, 2026
> **Owner:** Chief Experience Officer (CXO)
> **Approval:** CXO + CDO

---

## Preamble

This Constitution establishes the permanent, finalized onboarding experience for VedMoulya. Every screen, interaction, animation, microcopy, and accessibility consideration is locked unless a formal Design Review approves a change.

**All specifications follow DES-001 v1.0 Design Constitution exactly.** Any conflict between this document and the DES-001 Design Constitution is resolved in favor of the DES-001 Design Constitution.

---

## 1. Design Constitution Compliance

Every screen in this onboarding experience MUST follow these immutable standards:

| Property        | Standard                                       | Source       |
| --------------- | ---------------------------------------------- | ------------ |
| Page Background | `#F5F7FA` (Warm Matte Light)                   | DES-001 v1.0 |
| Cards           | `#FFFFFF` with border `#E8EDF5`                | DES-001 v1.0 |
| Primary Color   | `#2B5FD9` (Deep Calm Blue)                     | DES-001 v1.0 |
| Secondary Blue  | `#5B8DEF`                                      | DES-001 v1.0 |
| Light Blue      | `#EAF2FF` (background accents)                 | DES-001 v1.0 |
| AI Color        | `#7C3AED`                                      | DES-001 v1.0 |
| Premium Gold    | `#C89B3C` (extremely limited)                  | DES-001 v1.0 |
| Success         | `#22C55E`                                      | DES-001 v1.0 |
| Warning         | `#F59E0B`                                      | DES-001 v1.0 |
| Danger          | `#EF4444`                                      | DES-001 v1.0 |
| Headings        | Satoshi                                        | DES-001 v1.0 |
| Body            | Inter (never below 16px)                       | DES-001 v1.0 |
| Code            | JetBrains Mono                                 | DES-001 v1.0 |
| Card Radius     | 24px                                           | DES-001 v1.0 |
| Button Radius   | 14px                                           | DES-001 v1.0 |
| Input Radius    | 16px                                           | DES-001 v1.0 |
| Dialog Radius   | 28px                                           | DES-001 v1.0 |
| Motion          | Apple-quality, 200-300ms, ease-out             | DES-001 v1.0 |
| AI Persona      | Wise Mentor — calm, transparent, never robotic | DES-001 v1.0 |

---

## 2. Screen Sequence (LOCKED)

```
ORDER    SCREEN                      DURATION    CAN SKIP    KEY EMOTION
─────    ──────                      ────────    ────────    ───────────
1        Splash Screen               2-3s        No          Intrigue
2        Welcome Screen              8-12s       No          Welcome
3        Identity Setup              30-60s      No          Being seen
4        Purpose Selection           45-75s      Yes         Direction
5        Dream (Cinematic)           60-120s     Yes         Awe + Hope
6        Goals Quick Setup           30-45s      Yes         Clarity
7        Quick Discovery (~2min)     90-120s     Yes         Self-discovery
8        AI Mentor Introduction      20-30s      Yes         Trust
9        Notification Preferences    15-20s      No          Control
10       Dashboard Reveal            3.5s        No          Arrival
11       Congratulations             5-8s        No          Pride
```

**Total ideal time:** ~8-12 minutes
**Total with skips:** ~4-6 minutes
**Optional screens deferred post-onboarding:** Calendar, Email, Knowledge Import, Health permissions

---

## 3. Mandatory Design Decisions (LOCKED)

### 3.1 "Explore First" Replaces "Guest Mode"

The term "Guest Mode" is permanently removed. Replaced by "Explore First" — a full value preview where users can experience VedMoulya's capabilities before creating an account.

| Aspect     | Decision                                                                              |
| ---------- | ------------------------------------------------------------------------------------- |
| Label      | "Explore First" — never "Guest" or "Continue as guest"                                |
| Access     | Full interactive preview with sample data (not limited)                               |
| Conversion | Natural CTA: "Ready to make this yours?" — appears after exploration                  |
| Data       | Local-only during explore; seamless transfer on sign-up                               |
| Psychology | "Guest" implies lesser status. "Explore First" implies curiosity and value discovery. |

### 3.2 Purpose = Life Aspirations, Not Module Names

Purpose Selection presents emotional life cards. No technical module names are used.

| Old (Removed) | New (Final)               |
| ------------- | ------------------------- |
| Career        | 💼 Build My Career        |
| Learning      | 📚 Learn Faster           |
| Business      | 🚀 Start a Business       |
| Health        | ❤️ Improve My Health      |
| Finance       | 💰 Improve My Finances    |
| Execution     | ⚡ Become More Productive |
| Marketplace   | 🌟 Offer Your Services    |

### 3.3 Dream Screen = Cinematic Signature Moment

The Dream screen is a staged, cinematic experience:

1. **Screen dims** to deep ambient gradient (0.8s)
2. **3-second pause** — absolute silence, no UI
3. **"Close your eyes."** — fade in (2s)
4. **2-second pause**
5. **"Imagine yourself five years from today."**
6. **3-second pause**
7. **"What kind of life are you living?"**
8. **5-second pause** — ambient particles float
9. **Fade out** (1s) → pause (1s) → **"Start writing..."**
10. **Large journal appears** — no character limit, low pressure

Total sequence: ~18 seconds + user writing time

### 3.4 "Quick Discovery" Replaces "12 Questions"

The DNA Assessment is permanently reframed as "Quick Discovery" (~2 minutes).

- Never say "12 questions" or any question count
- Progressive reveal: one module at a time
- Each module: ~30 seconds, optional
- Always visible: "Skip — I'll do this later"

### 3.5 AI Mentor Introduction (Rewritten)

The AI's first words are:

> "I've learned a little about you. I'll continue learning with you. I'm here to help you become the person you want to become. I'll always be honest about what I know and what I don't. You're always in control. Shall we begin?"

**Rules:** Never "Hello, I'm your AI." Never "AI Coach" as a label. No robotic introductions.

### 3.6 Dashboard Reveal = Staged Emotional Experience

The reveal follows a strict staged sequence:

1. **Stage 1 (0ms):** Accent bar animates in + "Welcome to VedMoulya."
2. **Stage 2 (1200ms):** "Your journey begins today."
3. **Stage 3 (2000ms):** Cards appear one by one (Focus → Action)
4. **Stage 4 (3000ms):** Mentor avatar appears last
5. **Full interactive (3500ms)**

### 3.7 Progressive Permissions

Only **Notification Preferences** are requested during onboarding. All other permissions are deferred:

| Permission       | When Requested                             |
| ---------------- | ------------------------------------------ |
| Notifications    | During onboarding                          |
| Calendar         | When user first schedules a goal (Day 1-3) |
| Email            | When user first saves a resource           |
| Knowledge Import | When user first visits Knowledge section   |
| Health           | When user sets a health goal               |
| Location         | Never — user must explicitly enable        |

---

## 4. AI Mentor Persona

| Aspect       | Standard                                                          |
| ------------ | ----------------------------------------------------------------- |
| Role         | Wise Mentor — guide, partner, teacher                             |
| Tone         | Calm, warm, knowledgeable, never salesy                           |
| First words  | "I've learned a little about you..." (never "Hello, I'm your AI") |
| Transparency | Always explains reasoning, shows confidence, attributes sources   |
| Autonomy     | Recommends, never demands. User always decides.                   |
| Label        | "Your Mentor" or "Your Guide" — never "AI Assistant" or "Chatbot" |

---

## 5. Motion Standards (Onboarding-Specific)

| Animation                    | Duration   | Easing   | Notes                            |
| ---------------------------- | ---------- | -------- | -------------------------------- |
| Screen transitions (forward) | 350ms      | ease-out | Fade only (no slide on mobile)   |
| Screen transitions (back)    | 300ms      | ease-in  | Faster exit                      |
| Card entries                 | 500ms      | ease-out | translateY(24px→0)               |
| Micro-interactions           | 150-200ms  | ease-out | Hover, press, toggle             |
| Dream cinematic              | Variable   | ease-out | Timed per stage                  |
| Dashboard reveal             | 3.5s total | ease-out | Skip: tap anywhere               |
| AI typing                    | 50ms/word  | linear   | Max 1.5s per message             |
| Reduced motion               | All 0ms    | —        | prefers-reduced-motion respected |

---

## 6. Accessibility Baseline

| Requirement         | Standard                             | Verified |
| ------------------- | ------------------------------------ | -------- |
| WCAG 2.1 AA         | All screens                          | ✅       |
| Body text minimum   | 16px (never below)                   | ✅       |
| Touch targets       | 44×44px minimum                      | ✅       |
| Keyboard navigation | 100% of interactions                 | ✅       |
| Screen reader       | NVDA, VoiceOver, TalkBack            | ✅       |
| Focus indicators    | 3px ring, Primary-500                | ✅       |
| Reduced motion      | `prefers-reduced-motion: reduce`     | ✅       |
| Color alone         | Never solely conveys meaning         | ✅       |
| Dyslexia-friendly   | Inter, 1.5× line height, 75 char max | ✅       |

---

## 7. Design Freeze

As of July 27, 2026:

**DES-002 Version 1.0 is LOCKED.**

No further onboarding design changes, additions, or modifications are permitted without a formal **Design Review** approved by the CXO and CDO.

**Next recommended mission:** DES-003 — Core Dashboard Experience

---

## 8. Amendment History

| Version | Date       | Change                                                                         | Author | Approval  |
| ------- | ---------- | ------------------------------------------------------------------------------ | ------ | --------- |
| 1.0.0   | 2026-07-27 | Initial Onboarding Constitution — established from DES-002A refinement mission | CXO    | CXO + CDO |

---

_This document supersedes any conflicting specifications in DES-002 documents D01–D15. All DES-002 documents have been updated to reflect this Constitution. No further onboarding design changes are allowed without formal Design Review approval._
