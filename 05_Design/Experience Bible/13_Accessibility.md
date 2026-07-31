# Accessibility

> **Document:** DES-010A-D13 — Experience Bible  
> **Status:** 🔒 **LOCKED** — Part of Experience Bible v1.0

---

## Purpose

Accessibility defines the immutable accessibility standards for VedMoulya — ensuring the platform is usable by everyone, regardless of ability. This is not a checklist; it is a design principle.

---

## Accessibility Philosophy

Accessibility is not about compliance. Accessibility is about humanity. Every barrier we remove is someone we include.

We design for:

- A user who cannot see the screen
- A user who cannot hear the audio
- A user who cannot use a mouse
- A user who cannot read quickly
- A user who gets overwhelmed by motion
- A user who is learning the language

When we design for the edges, we improve the experience for everyone.

---

## Standards Compliance

| Standard           | Target                       | Priority      |
| ------------------ | ---------------------------- | ------------- |
| WCAG 2.1 Level AA  | **Minimum** — all content    | P0 — Required |
| WCAG 2.1 Level AAA | Stretch goal — core journeys | P1 — Target   |
| Section 508        | US federal accessibility     | P1 — Phase 2  |
| EN 301 549         | EU accessibility standard    | P1 — Phase 2  |

---

## Core Requirements

### 1. Perceivable

| Requirement    | Standard                                                            |
| -------------- | ------------------------------------------------------------------- |
| Alt text       | All images have meaningful alt text; decorative images use `alt=""` |
| Captions       | All video content captioned; audio descriptions for visual info     |
| Adaptable      | Content makes sense linearized (no CSS); reading order logical      |
| Color contrast | 4.5:1 body text, 3:1 large text                                     |
| Color alone    | Never the sole means of conveying information                       |
| Text resize    | 200% without loss of content                                        |

### 2. Operable

| Requirement       | Standard                                                 |
| ----------------- | -------------------------------------------------------- |
| Keyboard          | All functionality via keyboard; visible focus indicators |
| Focus indicator   | 3px ring, 2px offset, Primary-500                        |
| Touch targets     | 44×44px minimum                                          |
| No keyboard traps | Never                                                    |
| Skip navigation   | Present and functional                                   |
| No flashing       | More than 3 flashes/sec                                  |

### 3. Understandable

| Requirement          | Standard                                       |
| -------------------- | ---------------------------------------------- |
| Language             | `lang="en"` set on page                        |
| Clear language       | Simple, clear language; abbreviations expanded |
| Consistent UI        | Same components behave same way everywhere     |
| Error identification | Clear error messages in text, not just color   |

### 4. Robust

| Requirement   | Standard                                |
| ------------- | --------------------------------------- |
| Valid HTML    | W3C standards compliant                 |
| Semantic HTML | Correct elements used correctly         |
| ARIA          | Only when native semantics insufficient |
| Screen reader | JAWS, NVDA, VoiceOver, TalkBack         |

---

## Design Tokens for Accessibility

| Token                | Value                 | Usage                      |
| -------------------- | --------------------- | -------------------------- |
| Focus ring width     | 3px                   | All interactive elements   |
| Focus ring color     | Primary-500 (#2B5FD9) | Visible on all backgrounds |
| Focus ring offset    | 2px                   | Match element radius       |
| Touch target minimum | 44×44px               | All interactive elements   |
| Body text minimum    | 16px                  | Enforced absolutely        |
| Line height minimum  | 1.5×                  | Body text                  |

---

## Dyslexia-Friendly Design

| Consideration   | Implementation                           |
| --------------- | ---------------------------------------- |
| **Font**        | Sans-serif (Inter)                       |
| **Spacing**     | Generous letter spacing, never condensed |
| **Line height** | Minimum 1.5× for body text               |
| **Line length** | Maximum 75 characters                    |
| **Background**  | Off-white (Neutral-50, not pure white)   |
| **Alignment**   | Left-aligned (never justified)           |

---

## Reduced Motion

| Rule           | Implementation                           |
| -------------- | ---------------------------------------- |
| **Detection**  | `prefers-reduced-motion: reduce`         |
| **Effect**     | All animation durations → 0ms            |
| **Exceptions** | Opacity transitions for appear/disappear |
| **Exceptions** | Progress indicators                      |
| **Exceptions** | User-initiated feedback                  |

---

## Screen Reader Guidelines

| Guideline          | Implementation                                             |
| ------------------ | ---------------------------------------------------------- |
| **Semantic HTML**  | `<nav>`, `<main>`, `<article>`, `<section>` as appropriate |
| **Headings**       | `<h1>`-`<h6>`, never skip levels                           |
| **Labels**         | All form controls have labels                              |
| **Live regions**   | `aria-live="polite"` for dynamic content                   |
| **AI content**     | Labeled with `role="status"` or `aria-label="AI message"`  |
| **Status updates** | `aria-live="polite"` for progress, `assertive` for alerts  |

---

## Quality Review

| Dimension           | Assessment                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------- |
| **Why**             | Accessibility is the foundation of inclusive design — without it, users are excluded        |
| **Psychology**      | Universal design benefits everyone; curb-cut effect — accessibility features help all users |
| **Accessibility**   | This IS the accessibility document — self-consistent                                        |
| **Engineering**     | Semantic HTML, ARIA, keyboard support are engineering requirements                          |
| **Performance**     | Accessibility features have minimal performance impact                                      |
| **Scalability**     | WCAG compliance scales to new features through standards                                    |
| **DES Consistency** | Elevates DES-001/D10 with stricter governance                                               |

---

## Design Freeze Status

**DES-010A-D13: Accessibility — LOCKED effective July 27, 2026.**
