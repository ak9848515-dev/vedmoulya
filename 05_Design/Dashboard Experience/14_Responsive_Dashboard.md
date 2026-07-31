# Responsive Dashboard

**DES-003 — Document 14/15 — Dashboard Experience**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Experience Officer (CXO)

---

## Purpose

This document defines the **responsive behavior** of the VedMoulya Dashboard across every device size and input modality. The dashboard must feel native on every screen while maintaining the same information hierarchy and emotional quality.

---

## Device Spectrum

| Category   | Width       | Layout Columns | Content Density                          |
| ---------- | ----------- | -------------- | ---------------------------------------- |
| Mobile S   | < 375px     | 4              | Minimal — 3 cards, full-width            |
| Mobile     | 375-767px   | 4              | Compact — 4 cards, full-width            |
| Foldable   | 600-800px   | 4-8            | Adaptive — content avoids hinge          |
| Tablet     | 768-1023px  | 8              | Moderate — 2-column grid                 |
| Desktop S  | 1024-1279px | 12             | Standard — 3-column layout               |
| Desktop L  | 1280-1439px | 12             | Full — sidebar + main + rail             |
| Wide       | 1440-1919px | 12             | Expanded — max-width 1280px              |
| Ultra-wide | 1920px+     | 12             | Constrained — max-width 1280px, centered |

---

## Desktop (1024px+)

```text
DESKTOP DASHBOARD — Full experience

  LAYOUT: Sidebar (240px) + Main (8 cols) + Right Rail (2 cols)

  HEADER: 64px, full-width, logo + search + profile
  SIDEBAR: Persistent, navigation + Life Score (compact)
  MAIN:    Today's Focus (hero) + 2-column card grid
  RIGHT:   AI Coach (sticky) + upcoming mini-calendar

  MAX WIDTH: 1280px centered
  SHADOWS: Standard on all cards
  HOVER: Available on all interactive cards
  SCROLL: Only main content area scrolls
```

---

## Tablet (768-1023px)

```text
TABLET DASHBOARD — Adapted experience

  LAYOUT: Sidebar (collapsible) + Main (8 cols)

  HEADER: 56px, compact, hamburger + logo + profile
  SIDEBAR: Collapsible (icon-only when closed, 64px)
  MAIN:    Today's Focus (full) + 2-column card grid
  RIGHT:   Absorbed into main — AI Coach becomes a card

  CONTENT DENSITY: Reduced by one tier
  TARGETS: 44px minimum (finger precision)
  GESTURES: Swipe back, tap for hover-equivalent
```

---

## Mobile (< 768px)

```text
MOBILE DASHBOARD — Focused experience

  LAYOUT: Single column, bottom tab bar

  HEADER: 56px, minimal, hamburger + logo
  CONTENT: Single column, cards stack vertically
  TODAY'S FOCUS: Full-width hero card
  AI COACH: Compact card below hero
  QUICK ACTIONS: Horizontally scrollable row
  SECONDARY: Collapsible sections

  BOTTOM NAV: 5 tabs (Home, Mentor, Goals, Learn, Profile)
  GESTURES: Tap primary, swipe for context actions
  KEYBOARD: Auto-hides on scroll
```

---

## Foldable & Dual-Screen

```text
FOLDABLE DASHBOARD — Seamless adaptation

  FOLDED (Single screen, < 600px):
    Same as Mobile layout

  UNFOLDED (Dual screen, 600-800px):
    Left screen: Today's Focus + Quick Actions
    Right screen: Life Score + AI Coach + Secondary cards

  HINGE:
    Content avoids hinge area (32px margin on each side)
    No interactive elements in hinge zone
    Continuity across fold — content adjusts on fold state change
    Smooth transition (300ms) when folding/unfolding

  TABLETOP MODE (Folded 90°):
    Dashboard on top screen
    Controls/input on bottom screen
```

---

## Landscape Orientation

```text
LANDSCAPE (MOBILE/TABLET)

  MOBILE LANDSCAPE:
    Dashboard header: compact (48px)
    Today's Focus: side-by-side with Quick Actions
    AI Coach: accessible via top-right icon
    Bottom nav: still present (compact)
    Max dashboard height: viewport - nav bars
    Content scrolls if needed

  TABLET LANDSCAPE:
    Same as Desktop layout
    Sidebar visible by default
    Full 3-column experience
```

---

## Touch vs Pointer Adaptation

| Interaction      | Touch (Mobile/Tablet)                      | Pointer (Desktop) |
| ---------------- | ------------------------------------------ | ----------------- |
| **Tap**          | Primary interaction                        | Click             |
| **Hover**        | Not available (tap reveals hidden actions) | Full hover states |
| **Context menu** | Long-press (800ms)                         | Right-click       |
| **Drag**         | Long-press to initiate                     | Click and drag    |
| **Scroll**       | Swipe                                      | Wheel / trackpad  |
| **Swipe**        | Navigate / dismiss actions                 | Not applicable    |
| **Pinch**        | Zoom (not used in dashboard)               | Not applicable    |

---

## Responsive Testing Checklist

```markdown
- [ ] Layout does not break at ANY breakpoint
- [ ] Top content is visible without scrolling (above the fold)
- [ ] Touch targets meet 44×44px minimum on mobile
- [ ] Text is not truncated or overlapping
- [ ] Cards resize gracefully (no hardcoded widths)
- [ ] Navigation is accessible (bottom tab on mobile, sidebar on desktop)
- [ ] AI Coach is accessible on all devices
- [ ] Today's Focus is prominent on all devices
- [ ] Content priority is preserved (P0 always visible)
- [ ] Performance: < 2s to interactive on all devices
```

---

## Cross-Reference

| Reference   | Relationship                                         |
| ----------- | ---------------------------------------------------- |
| DES-001/D05 | Layout & Grid — grid system, breakpoints             |
| DES-001/D14 | Responsive Design — component-level responsive specs |
| DES-001/D06 | Spacing System — responsive spacing tokens           |
| DES-003/D03 | Layout System — base layout for each device tier     |
| DES-003/D11 | Personalization — responsive card selection          |
