# VedMoulya Design Constitution v1.0

> **Document:** The Single Source of Truth for All Design Decisions
> **Mission:** DES-001A — Design System Consistency & Finalization
> **Status:** 🔒 **LOCKED** — Effective immediately. No further design changes without formal version increment.
> **Version:** 1.0.0
> **Date:** July 27, 2026
> **Owner:** Chief Design Officer (CDO)
> **Approval:** CDO + CEO

---

## Preamble

This Constitution establishes the permanent, immutable design language of VedMoulya. Every pixel, every interaction, every animation, every line of UI code must comply. There are no exceptions without a formal Design Constitution Amendment (DCA) approved by the CDO.

**Future missions** (DES-002 onward) must follow this document exactly. Any conflict between a design specification and this Constitution is resolved in favor of this Constitution.

---

## 1. Background & Surfaces

| Property             | Value                               | Rule                                             |
| -------------------- | ----------------------------------- | ------------------------------------------------ |
| **Page Background**  | `#F5F7FA` (Warm Matte Light)        | Never use pure white for page backgrounds        |
| **Card Background**  | `#FFFFFF` (Pure White)              | Cards only — never page background               |
| **Card Border**      | `#E8EDF5`                           | 1px solid                                        |
| **Card Shadow**      | `0 8px 30px rgba(15, 23, 42, 0.06)` | Very soft. Premium. Never floating. Never heavy. |
| **Surface Elevated** | `#FFFFFF` + standard shadow         | For dialogs, modals, dropdowns                   |
| **Overlay**          | `rgba(15, 23, 42, 0.5)`             | For modals and drawers                           |

---

## 2. Color Palette (FINAL)

### Brand Colors

| Color                        | Hex       | Usage                                                                                                                 |
| ---------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------- |
| **Deep Calm Blue (Primary)** | `#2B5FD9` | Primary actions, key interactive elements, brand anchors                                                              |
| **Secondary Blue**           | `#5B8DEF` | Secondary actions, links, supporting UI                                                                               |
| **Light Blue**               | `#EAF2FF` | Background accents, subtle highlights                                                                                 |
| **AI Purple**                | `#7C3AED` | All AI-generated content, AI Coach, AI interactions                                                                   |
| **Premium Gold**             | `#C89B3C` | **Limited use only** — Premium, Achievements, Awards, Milestones. Never for navigation. Never as primary brand color. |

### Semantic Colors

| Color       | Hex       | Usage                                               |
| ----------- | --------- | --------------------------------------------------- |
| **Success** | `#22C55E` | Completion states, positive feedback, goal achieved |
| **Warning** | `#F59E0B` | Approaching limits, medium-priority alerts          |
| **Danger**  | `#EF4444` | Destructive actions, critical errors, data loss     |
| **Neutral** | `#64748B` | Secondary text, metadata, passive indicators        |

### Neutral Scale (Warm)

| Token       | Hex       | Usage                            |
| ----------- | --------- | -------------------------------- |
| Neutral-900 | `#111827` | Heading text                     |
| Neutral-800 | `#1F2937` | Body text                        |
| Neutral-700 | `#374151` | Secondary text                   |
| Neutral-600 | `#4B5563` | Placeholder text                 |
| Neutral-500 | `#64748B` | Neutral text (Constitution v1.0) |
| Neutral-400 | `#94A3B8` | —                                |
| Neutral-300 | `#CBD5E1` | Borders, dividers                |
| Neutral-200 | `#E2E8F0` | Disabled backgrounds             |
| Neutral-100 | `#F1F5F9` | Subtle card backgrounds          |
| Neutral-50  | `#F5F7FA` | **Page background**              |

### Color Rules

1. Primary for primary actions only — one primary button per view
2. Semantic colors for meaning only — never decorative
3. AI purple for all AI boundaries
4. Premium Gold is **extremely limited** — Premium features, Achievements, Awards, Milestones only
5. Light Blue (#EAF2FF) for background accents
6. Never use pure white (#FFFFFF) for page backgrounds
7. One emotional accent per screen (Coral or Light Blue)
8. Accent (Coral #FF6B5B) for human warmth moments, celebrations

---

## 3. Typography (FROZEN)

### Font Families

| Role               | Font               | Source                                                 |
| ------------------ | ------------------ | ------------------------------------------------------ |
| **Headings**       | **Satoshi**        | Fontshare (Indian Type Foundry) — Geometric sans-serif |
| **Body**           | **Inter**          | rsms — Humanist sans-serif                             |
| **Code/Developer** | **JetBrains Mono** | JetBrains — Developer-focused monospace                |

**Do not recommend alternatives. These fonts are frozen.**

### Type Scale (Desktop)

| Token   | Size     | Weight       | Line-Height | Letter-Spacing |
| ------- | -------- | ------------ | ----------- | -------------- |
| Display | 56px     | 700 Bold     | 68px        | -0.02em        |
| Hero    | 48px     | 700 Bold     | 58px        | -0.02em        |
| H1      | 40px     | 600 SemiBold | 50px        | -0.015em       |
| H2      | 32px     | 600 SemiBold | 42px        | -0.01em        |
| H3      | 28px     | 600 SemiBold | 38px        | 0em            |
| H4      | 24px     | 500 Medium   | 34px        | 0em            |
| Section | 20px     | 600 SemiBold | 28px        | 0em            |
| Body    | **16px** | 400 Regular  | 26px        | 0em            |
| Caption | 14px     | 500 Medium   | 20px        | 0.02em         |
| Tiny    | 12px     | 400 Regular  | 16px        | 0em            |

### Critical Typography Rules

- **Body never below 16px** at any breakpoint — enforced absolutely
- Headings use Satoshi; Body uses Inter; Code uses JetBrains Mono
- One H1 per page
- Optimal line length: 60–75 characters
- Minimum line height for body: 1.5× (26px)

---

## 4. Corner Radius (FROZEN)

| Component   | Radius      |
| ----------- | ----------- |
| **Cards**   | **24px**    |
| **Buttons** | **14px**    |
| **Inputs**  | **16px**    |
| **Dialogs** | **28px**    |
| **Charts**  | **24px**    |
| Badges      | Full (pill) |
| Tooltips    | 8px         |

---

## 5. Spacing

- **Base unit: 4px** (space-0 through space-12)
- Standard padding (space-6): 24px
- Standard gap (space-4): 16px
- Generous whitespace by default — never reduce breathing room for density
- Whitespace is part of the brand
- Responsive spacing: desktop → tablet → mobile reduces by one token per tier

---

## 6. Shadows

| Level                | Value                                                                      | Usage                    |
| -------------------- | -------------------------------------------------------------------------- | ------------------------ |
| **Standard (Cards)** | `0 8px 30px rgba(15, 23, 42, 0.06)`                                        | Cards, elevated surfaces |
| Level 1              | `0 1px 2px rgba(15, 23, 42, 0.05)`                                         | Subtle depth             |
| Level 2              | `0 1px 3px rgba(15, 23, 42, 0.07)` + `0 1px 2px rgba(15, 23, 42, 0.03)`    | Dropdowns                |
| Level 3              | `0 4px 6px rgba(15, 23, 42, 0.06)` + `0 2px 4px rgba(15, 23, 42, 0.04)`    | Dialogs                  |
| Level 4              | `0 10px 15px rgba(15, 23, 42, 0.07)` + `0 4px 6px rgba(15, 23, 42, 0.04)`  | Modals                   |
| Level 5              | `0 20px 25px rgba(15, 23, 42, 0.09)` + `0 8px 10px rgba(15, 23, 42, 0.05)` | Toasts                   |

**Shadow must always use `rgba(15, 23, 42, ...)` — never `rgba(17, 24, 39, ...)` or other values.**

---

## 7. Icons

| Property | Standard                                                        |
| -------- | --------------------------------------------------------------- |
| Style    | **Outline only** — never filled (except active/selected states) |
| Stroke   | **1.5px** — consistent across all icons                         |
| Corners  | **Rounded** — 2px radius, never sharp geometric                 |
| Fill     | Transparent interior                                            |
| Sizes    | 16, 18, 20, 22, 24, 28, 32, 48px — use predefined sizes only    |

**Rules:**

- Outline only. Rounded. 1.5px stroke.
- Never mix icon styles.
- No filled variants except for active/selected states.
- Icons support text — never use icons alone for critical navigation.

---

## 8. Motion

| Property           | Standard                                                 |
| ------------------ | -------------------------------------------------------- |
| Quality            | **Apple-quality** — calm, purposeful, never flashy       |
| Duration           | **200–300ms** standard range                             |
| Easing             | **Ease-out preferred** — `cubic-bezier(0.16, 1, 0.3, 1)` |
| Micro-interactions | 100–200ms                                                |
| Max duration       | 600ms for any UI transition                              |
| Reduced Motion     | `prefers-reduced-motion: reduce` → all animations 0ms    |

**Rules:**

- Every animation serves a functional purpose (spatial, hierarchical, or causal)
- Use `transform` and `opacity` only (GPU-accelerated)
- No decorative animations
- No parallax, no 3D transforms, no confetti
- Respect Reduced Motion at all times

---

## 9. Button Philosophy

| Type          | Style                    | Usage                                    |
| ------------- | ------------------------ | ---------------------------------------- |
| **Primary**   | Blue filled (#2B5FD9)    | One per view — most important action     |
| **Secondary** | White (#FFFFFF) + border | Alternative actions                      |
| **Ghost**     | Transparent              | Minimal footprint                        |
| **Text**      | Text only                | Minimal — avoid excessive filled buttons |
| **Danger**    | Red (#EF4444) filled     | Destructive actions — used rarely        |

**Radius: 14px** for all button variants.

---

## 10. Charts

| Property   | Standard                                                    |
| ---------- | ----------------------------------------------------------- |
| Style      | **Minimal** — no 3D effects, no unnecessary decoration      |
| Colors     | Blue, Green, Amber, Purple, Gray only — no rainbow palettes |
| Radius     | 24px                                                        |
| Grid lines | Neutral-200, 1px                                            |

---

## 11. AI Personality (FROZEN)

| Aspect       | Standard                                                                     |
| ------------ | ---------------------------------------------------------------------------- |
| Persona      | **The Wise Mentor** — calm, professional, knowledgeable                      |
| Tone         | Respectful, transparent, never robotic, never childish, never sales-oriented |
| Transparency | Every AI output explains WHY, shows confidence, attributes sources           |
| Consent      | Opt-in, granular, revocable                                                  |

---

## 12. Accessibility Baseline

| Standard           | Target                            |
| ------------------ | --------------------------------- |
| WCAG 2.1 Level AA  | **Minimum** — all content         |
| WCAG 2.1 Level AAA | Stretch goal — core journeys      |
| Color contrast     | 4.5:1 body, 3:1 large text        |
| Touch targets      | 44×44px minimum (mobile)          |
| Focus indicators   | 3px ring, 2px offset, Primary-500 |
| Reduced motion     | Always respected                  |

- Never rely on color alone to convey meaning
- Body text never below 16px
- All interactive elements keyboard accessible
- Screen reader compatible (semantic HTML, ARIA where needed)

---

## 13. Design Freeze

As of July 27, 2026:

**DES-001 Version 1.0 is LOCKED.**

No further design changes, additions, or modifications to the Design System are permitted without:

1. A formal **Design Constitution Amendment (DCA)** proposal
2. **CDO approval** (for minor amendments)
3. **CDO + CEO approval** (for major amendments affecting brand identity)

**Future missions** (DES-002 onward) must strictly follow this Constitution. Any design specification that contradicts this document shall be deemed invalid and must be corrected before implementation.

---

## Amendment History

| Version | Date       | Change                                                                                             | Author | Approval  |
| ------- | ---------- | -------------------------------------------------------------------------------------------------- | ------ | --------- |
| 1.0.0   | 2026-07-27 | Initial Design Constitution — established from DES-001 audit against Mandatory Design Constitution | CDO    | CDO + CEO |

---

_This document supersedes any conflicting recommendations in DES-001 documents D01–D15. All DES-001 documents have been updated to reflect this Constitution._
