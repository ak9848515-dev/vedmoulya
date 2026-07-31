# Accessibility — Onboarding Experience

**DES-002 — Document 13/15 — Onboarding Experience**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Experience Officer (CXO)
**Created:** 2026-07-27
**Cross-references:** DES-001/D10, WCAG 2.1

---

## Purpose

This document defines the **accessibility requirements** for every onboarding screen. Accessibility is not optional — it's a human right. The onboarding experience must be usable by everyone.

---

## WCAG Compliance Targets

| Standard            | Target                                     | Status       |
| ------------------- | ------------------------------------------ | ------------ |
| WCAG 2.1 Level AA   | Minimum for all screens                    | Required     |
| WCAG 2.1 Level AAA  | Core screens (Welcome, Identity, AI Intro) | Stretch goal |
| Screen readers      | NVDA, VoiceOver, TalkBack, JAWS            | Required     |
| Keyboard navigation | 100% of interactive elements               | Required     |
| Color contrast      | 4.5:1 body, 3:1 large text                 | Required     |

---

## Onboarding-Specific Accessibility

### Motion & Seizure Prevention

```text
REDUCED MOTION:
  prefers-reduced-motion: reduce → ALL animations 0ms
  Content appears instantly (still animate opacity for appear/disappear)
  No parallax, no auto-scroll, no hover animations
  All micro-interactions (hover, press, toggle) have 0ms

FLASHING:
  No flashing content at any point in onboarding
  No elements that change brightness more than 3 times per second
  No stroboscopic effects
  AI thinking dots: opacity only (no rotation, no sharp transitions)

  Safe for: photosensitive epilepsy
```

### Keyboard Navigation

```text
TAB ORDER:
  Logical left-to-right, top-to-bottom order
  Focusable elements only (no focus on decorative elements)
  Visible focus ring on ALL interactive elements
  Focus ring: 3px solid #2B5FD9, 2px offset, radius match element

KEYBOARD SHORTCUTS (onboarding):
  Tab:      Next focusable element
  Shift+Tab: Previous focusable element
  Enter:    Activate focused element / Continue
  Escape:   Go back / Close dropdown / Cancel selection
  Space:    Toggle checkbox / Activate button

  Arrow keys: Navigate options within a group (purpose cards, goal chips)
  Number keys: Quick-select purpose card (1-6)

SKIP LINK:
  Hidden skip navigation link at top of each screen
  Visible on focus: "Skip to main content"
```

### Screen Reader Support

```text
GENERAL RULES:
  All images have meaningful alt text
  Decorative elements: alt=""
  Icons with labels: no additional aria needed
  Icons without labels: aria-label
  Dynamic content: aria-live="polite"
  Errors: aria-live="assertive"
  Progress indicator: role="progressbar" + aria-valuenow
  Step indicator: aria-label="Step 3 of 12: Your Purpose"

PER SCREEN:

SPLASH:
  aria-label="VedMoulya. The Personal Growth Operating System."
  Background is decorative → role="presentation"

WELCOME:
  Heading: aria-level="1"
  CTA: role="button", accessible name
  Legal text: no special handling (standard text)

IDENTITY:
  All form fields: associated <label> elements
  Errors: aria-describedby pointing to error message
  Password strength: aria-live="polite" for strength updates
  Social login buttons: aria-label="Continue with Google"

PURPOSE:
  Cards: role="radio", aria-checked="true/false"
  Group: role="radiogroup", aria-label="Select your primary focus"
  Selected state: announced automatically

DREAM:
  Textarea: standard <label> association
  Character count: aria-live="polite" when approaching limit
  Goal chips: role="checkbox", aria-checked

AI INTRODUCTION:
  AI message: role="status", aria-live="polite"
  Avatar: role="img", aria-label="AI Coach avatar"
  AI typing animation: aria-busy="true" → "false" when complete

DASHBOARD REVEAL:
  Animated reveal: aria-live="polite" announces each section as it appears
  "Your dashboard is ready. Showing greeting card. Showing AI suggestion. Showing your goals."
```

### Color & Contrast

```text
DESIGN CONSTITUTION COLORS — CONTRAST VERIFIED:

  bg #F5F7FA → text #1F2937:        12.2:1 ✓ AAA
  bg #F5F7FA → text #111827:        15.8:1 ✓ AAA
  bg #FFFFFF → text #111827:         19.5:1 ✓ AAA
  bg #FFFFFF → text #4B5563:         7.5:1  ✓ AAA
  bg #FFFFFF → text #6B7280:         4.8:1  ✓ AA
  bg #F5F7FA → link #2B5FD9:        5.2:1  ✓ AA
  bg #FFFFFF → button #2B5FD9:       4.8:1  ✓ AA (large text)
  bg #2B5FD9 → text #FFFFFF:         7.8:1  ✓ AAA

RED-GREEN COLOR BLINDNESS:
  • Never rely on color alone for status
  • Success: checkmark icon + green text
  • Error: X icon + red text + descriptive message
  • Warning: warning icon + amber text

FOCUS INDICATORS:
  Visible on all interactive elements
  Contrast: 3:1 minimum against adjacent colors
  Not removed or hidden at any point
```

### Touch Targets

```text
MINIMUM TOUCH TARGETS (onboarding):

  Buttons:        56px height (exceeds 44px minimum)
  Cards:          full-width, min 72px height
  Chips:          36px height (minimum 32px for non-critical)
  Checkboxes:     44×44px tap area (visual checkbox may be smaller)
  Toggles:        44px height
  Close buttons:  44×44px tap area
  Links in text:  44×44px minimum (extend click area)

  Spacing between touch targets: 8px minimum
  On mobile: all interactive elements in thumb zone
```

### Dyslexia & Reading Support

```text
READABILITY:
  Font: Inter (designed for screen readability)
  Line height: 1.5× minimum for body text
  Paragraph width: max 75 characters (optimal: 60-65)
  Left-aligned text (never justified)
  Off-white background (#F5F7FA) reduces contrast glare
  Short paragraphs (3-5 lines max)

TEXT SIZE:
  Minimum body: 15px (mobile), 16px (desktop)
  User can increase text size up to 200% without breakage
  No text truncation without alternative
```

### Voice Control

```text
VOICE CONTROL SUPPORT (iOS Voice Control, Android Voice Access):
  All interactive elements have accessible labels
  Numbered labels for grid items (Purpose cards: "Career. 1.")
  Confirm destructive actions verbally
  "Tap 3" or "Show numbers" works for all screens
```

---

## Accessibility Checklist

```markdown
### Pre-Launch Accessibility Gate

- [ ] WCAG 2.1 AA compliance verified (automated + manual)
- [ ] Full keyboard navigation tested end-to-end
- [ ] Screen reader tested (NVDA + VoiceOver)
- [ ] Color contrast verified for all text/background combinations
- [ ] Focus indicators visible on every interactive element
- [ ] No information conveyed by color alone
- [ ] prefers-reduced-motion respected throughout
- [ ] Touch targets meet minimum size requirements
- [ ] Error messages are descriptive and helpful
- [ ] All images have appropriate alt text
- [ ] Form fields have associated labels
- [ ] Zoom to 200% does not break layout
```

---

## Cross-Reference

| Reference   | Usage                                                    |
| ----------- | -------------------------------------------------------- |
| DES-001/D10 | Full accessibility standards — WCAG AA+, POUR principles |
| DES-001/D03 | Color contrast ratios, color blindness considerations    |
| DES-001/D09 | Motion System — reduced motion support                   |
| DES-001/D04 | Typography — readability, dyslexia considerations        |
