# Color System

> **Document:** DES-010A-D09 — Experience Bible  
> **Status:** 🔒 **LOCKED** — Part of Experience Bible v1.0

---

## Purpose

Color System defines the immutable color language of VedMoulya — every color, its psychological rationale, exact hex values, usage rules, and accessibility requirements.

---

## Brand Colors

| Color                        | Hex       | Usage                                               | Psychology                            |
| ---------------------------- | --------- | --------------------------------------------------- | ------------------------------------- |
| **Deep Calm Blue (Primary)** | `#2B5FD9` | Primary actions, key interactive, brand anchors     | Trust, intelligence, stability        |
| **Secondary Blue**           | `#5B8DEF` | Secondary actions, links, supporting UI             | Clarity, reliability                  |
| **Light Blue**               | `#EAF2FF` | Background accents, subtle highlights               | Calm, spacious                        |
| **AI Purple**                | `#7C3AED` | ALL AI-generated content, AI Coach, AI interactions | Intelligence, creativity, distinction |
| **Premium Gold**             | `#C89B3C` | EXTREMELY limited — milestones, achievements        | Value, excellence                     |

---

## Semantic Colors

| Color       | Hex       | Usage                                           |
| ----------- | --------- | ----------------------------------------------- |
| **Success** | `#22C55E` | Completion, positive feedback, goal achieved    |
| **Warning** | `#F59E0B` | Approaching limits, medium-priority alerts      |
| **Danger**  | `#EF4444` | Destructive actions, critical errors, data loss |
| **Neutral** | `#64748B` | Secondary text, metadata, passive indicators    |

---

## Neutral Scale (Warm)

| Token       | Hex       | Usage                   |
| ----------- | --------- | ----------------------- |
| Neutral-900 | `#111827` | Heading text            |
| Neutral-800 | `#1F2937` | Body text               |
| Neutral-700 | `#374151` | Secondary text          |
| Neutral-600 | `#4B5563` | Placeholder text        |
| Neutral-500 | `#64748B` | Neutral text            |
| Neutral-400 | `#94A3B8` | —                       |
| Neutral-300 | `#CBD5E1` | Borders, dividers       |
| Neutral-200 | `#E2E8F0` | Disabled backgrounds    |
| Neutral-100 | `#F1F5F9` | Subtle card backgrounds |
| Neutral-50  | `#F5F7FA` | **Page background**     |

---

## Color Rules

| Rule                          | Explanation                                      |
| ----------------------------- | ------------------------------------------------ |
| **Primary for primary only**  | One primary button per view                      |
| **Semantic for meaning only** | Never use semantic colors decoratively           |
| **AI purple for AI**          | ALL AI-generated content uses purple boundary    |
| **Gold is extremely limited** | Premium, Achievements, Awards, Milestones ONLY   |
| **Never pure white pages**    | #FFFFFF is for cards, never backgrounds          |
| **One accent per screen**     | Coral or Light Blue, never both                  |
| **No rainbow palettes**       | Charts use Blue, Green, Amber, Purple, Gray only |
| **Color never alone**         | Never rely on color alone to convey information  |

---

## Dark Mode

| Token           | Light     | Dark      |
| --------------- | --------- | --------- |
| Primary         | `#2B5FD9` | `#6B8FEF` |
| Page Background | `#F5F7FA` | `#0F172A` |
| Card Background | `#FFFFFF` | `#1E293B` |
| Card Border     | `#E8EDF5` | `#334155` |
| Heading Text    | `#111827` | `#F8FAFC` |
| Body Text       | `#1F2937` | `#F1F5F9` |

---

## Quality Review

| Dimension           | Assessment                                                                          |
| ------------------- | ----------------------------------------------------------------------------------- |
| **Why**             | Color is the most emotionally impactful design element — wrong colors destroy trust |
| **Psychology**      | Color psychology — blue = trust, purple = intelligence, gold = value                |
| **Accessibility**   | WCAG 2.1 AA contrast minimums; color never sole meaning carrier                     |
| **Engineering**     | Design tokens ensure consistent color application across platforms                  |
| **Performance**     | Color changes are GPU-accelerated; no performance concern                           |
| **Scalability**     | Token-based system extends to new themes, new components                            |
| **DES Consistency** | Elevates DES-001/D03 Color System with stricter governance                          |

---

## Design Freeze Status

**DES-010A-D09: Color System — LOCKED effective July 27, 2026.**
