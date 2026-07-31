# Accessibility

**DES-001 — Document 10/15 — Design System**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Design Officer (CDO)
**Created:** 2026-07-27
**Cross-references:** CMP-002, ARC-001, DES-001/D03, DES-001/D04, DES-001/D09, DES-001/D13, TECH-002/D04, WCAG 2.1

---

## Purpose

This document defines the **accessibility standards** for VedMoulya — ensuring the platform is usable by everyone, regardless of ability. Accessibility is not a checklist; it's a design principle.

---

## Accessibility Philosophy

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    ACCESSIBILITY PHILOSOPHY                               │
│                                                                           │
│  Accessibility is not about compliance.                                  │
│  Accessibility is about humanity.                                        │
│                                                                           │
│  Every barrier we remove is someone we include.                          │
│                                                                           │
│  We design for:                                                          │
│  • A user who cannot see the screen                                      │
│  • A user who cannot hear the audio                                      │
│  • A user who cannot use a mouse                                         │
│  • A user who cannot read quickly                                        │
│  • A user who gets overwhelmed by motion                                 │
│  • A user who is learning the language                                   │
│                                                                           │
│  When we design for the edges, we improve the experience for everyone.   │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Standards Compliance

| Standard                 | Target                        | Status                |
| ------------------------ | ----------------------------- | --------------------- |
| **WCAG 2.1 Level AA**    | Minimum for all content       | 🎯 Required           |
| **WCAG 2.1 Level AAA**   | Target for core user journeys | 🎯 Stretch goal       |
| **Section 508**          | US federal accessibility      | 🎯 Required (Phase 2) |
| **EN 301 549**           | EU accessibility standard     | 🎯 Required (Phase 2) |
| **EU Accessibility Act** | European market               | 🎯 Required (Phase 3) |

---

## Core Requirements

### 1. Perceivable

```text
TEXT ALTERNATIVES
  • All images must have meaningful alt text
  • Decorative images must use alt=""
  • Icons must have aria-label or visible label
  • Complex graphics need long descriptions

TIME-BASED MEDIA
  • No auto-playing video or audio
  • All video content must have captions
  • Audio descriptions for visual information

ADAPTABLE
  • Content must make sense when linearized (no CSS)
  • Information, structure, and relationships preserved in code
  • Reading order is logical in source code

DISTINGUISHABLE
  • Color is never the sole means of conveying information
  • Minimum 4.5:1 contrast for body text (3:1 for large text)
  • No color combinations that confuse color blindness (DES-001/D03)
  • Resize text to 200% without loss of content
  • No images of text (except logos)
```

### 2. Operable

```text
KEYBOARD ACCESSIBLE
  • All functionality available via keyboard
  • Visible focus indicator (3px ring, 2px offset, Primary-500)
  • Logical tab order matching visual order
  • No keyboard traps
  • Skip navigation link at top of page
  • Shortcut keys: never conflict with browser/AT shortcuts

ENOUGH TIME
  • No time limits on user actions (except security-sensitive)
  • Sessions extend on user activity
  • Timeout warning with extend option

SEIZURES
  • No flashing content (more than 3 flashes per second)
  • No rapid animations
  • Reduced motion preference respected

NAVIGABLE
  • Consistent navigation across all pages
  • Multiple ways to find content (search, nav, breadcrumbs)
  • Descriptive page titles
  • Clear focus order
  • Headings describe content sections
```

### 3. Understandable

```text
READABLE
  • Default language set on page (lang="en")
  • Clear, simple language in all content
  • Unusual words defined or avoided
  • Abbreviations expanded on first use

PREDICTABLE
  • Consistent UI across pages
  • Same components behave the same way everywhere
  • Navigation is consistent in position and order
  • No unexpected context changes on focus/input

INPUT ASSISTANCE
  • Labels associated with all form controls
  • Clear error identification and suggestion
  • Error messages in text (not just color)
  • Context-sensitive help available
  • Autocomplete where appropriate
```

### 4. Robust

```text
COMPATIBLE
  • Valid HTML (W3C standards)
  • Semantic HTML elements used correctly
  • ARIA roles only when native semantics are insufficient
  • Supports screen readers (JAWS, NVDA, VoiceOver, TalkBack)
  • Supports voice control (Dragon, Voice Control)
  • Works with browser zoom and text resizing
```

---

## Design Tokens for Accessibility

### Focus Indicators

```text
FOCUS STYLE
  outline: 3px solid Primary-500
  outline-offset: 2px
  border-radius: match element radius
  Visible on ALL interactive elements
  Never use outline: none without replacement

FOCUS WITHIN (complex components)
  outline on parent container
  For cards, list items, composite widgets
```

### Touch Targets

```text
MINIMUM TOUCH TARGET
  Size:   44×44px (recommended minimum)
         32×32px (absolute minimum, non-critical)
  Spacing: 8px minimum between touch targets
  Exception: Inline links within text blocks

DEVICE CONSIDERATIONS:
  Mobile:   44px minimum for all interactive elements
  Desktop:  32px minimum (mouse precision is higher)
  Tablet:   44px minimum (finger precision)
```

### Color & Contrast

```text
CONTRAST REQUIREMENTS (WCAG 2.1 AA):
  Body text:                                   4.5:1 minimum
  Large text (≥18px bold or ≥24px):           3:1 minimum
  UI components (borders, icons, focus):      3:1 minimum
  Graphs and infographics:                    3:1 minimum
  Hover/focus states:                         No reduction below requirements

COLOR BLINDNESS:
  Never rely on color alone for:
    • Status indicators (use icon + text)
    • Chart categories (use pattern + label)
    • Required fields (use asterisk + text)
    • Links (use underline + text)
    • Error/success states (use icon + text)
```

---

## Dyslexia-Friendly Design

| Consideration       | Implementation                                                 |
| ------------------- | -------------------------------------------------------------- |
| **Font**            | Use sans-serif (Inter — designed for readability)              |
| **Spacing**         | Generous letter spacing (0.02em for captions), never condensed |
| **Line height**     | Minimum 1.5× for body text                                     |
| **Paragraph width** | Maximum 75 characters per line                                 |
| **Color**           | Use off-white backgrounds (Neutral-50, not pure white)         |
| **Alignment**       | Left-aligned text (never justified)                            |
| **Contrast**        | Sufficient but not extreme (avoid pure black on pure white)    |
| **Structure**       | Clear headings, bullet lists, short paragraphs                 |

---

## Reduced Motion

```text
RESPECTING USER PREFERENCES
════════════════════════════

Rule:     Respect prefers-reduced-motion: reduce
Effect:   All animations → 0ms duration
          Still animate opacity for appear/disappear (critical for understanding)
          No parallax, no auto-scroll, no hover animations

Exceptions (always allowed):
  • Progress indicators
  • User-initiated feedback (click feedback)
  • Loading states
  • Skeleton screens
  • Focus indicators
```

---

## Screen Reader Guidelines

```text
SEMANTIC HTML
  • Use <nav> for navigation
  • Use <main> for primary content
  • Use <article>, <section>, <aside> semantically
  • Use <h1>-<h6> for headings (never skip levels)
  • Use <button> for actions, <a> for navigation
  • Use <label> for form controls
  • Use <table> for tabular data only

ARIA (Use judiciously)
  • Prefer native HTML semantics over ARIA
  • Use aria-label for buttons without visible text
  • Use aria-describedby for help text
  • Use aria-live for dynamic content (polite for updates, assertive for alerts)
  • Use aria-expanded for expandable elements
  • Use aria-selected for tab interfaces
  • Never use role="presentation" or aria-hidden="true" on focusable elements

TESTING
  • Navigate entire app with keyboard only
  • Test with NVDA (Windows, free)
  • Test with VoiceOver (Mac, built-in)
  • Test with TalkBack (Android, built-in)
  • Test with Voice Control (Mac/iOS)
  • Test with magnification (200% zoom)
```

---

## Accessibility Checklist

### For Designers

```markdown
- [ ] Color contrast verified (4.5:1 body, 3:1 large text)
- [ ] No information conveyed by color alone
- [ ] Focus states designed for all interactive elements
- [ ] Touch targets minimum 44×44px (mobile)
- [ ] Text resizable to 200% without loss
- [ ] Motion respects prefers-reduced-motion
- [ ] Content reads logically without CSS
- [ ] Clear visual hierarchy with headings
```

### For Developers

```markdown
- [ ] Semantic HTML used throughout
- [ ] All images have alt text
- [ ] All forms have labels
- [ ] Keyboard navigation works end-to-end
- [ ] Focus indicators visible on all interactive elements
- [ ] ARIA attributes correct and minimal
- [ ] Page title is descriptive
- [ ] Skip link present and functional
- [ ] No auto-playing media
- [ ] Error messages are descriptive and helpful
```

---

## Cross-Reference Summary

| Reference        | Relationship                                                                    |
| ---------------- | ------------------------------------------------------------------------------- |
| **CMP-002**      | Compliance requirements include accessibility (disability rights, equal access) |
| **ARC-001**      | Principle #1 (Human First) — accessibility is a human-first requirement         |
| **DES-001/D03**  | Color System — contrast ratios, color blindness accommodations                  |
| **DES-001/D04**  | Typography System — readability, zoom, line length                              |
| **DES-001/D09**  | Motion System — reduced motion preferences                                      |
| **DES-001/D13**  | State design — accessible empty, loading, error, success states                 |
| **TECH-002/D04** | Coding Standards — semantic HTML, ARIA, keyboard support                        |
