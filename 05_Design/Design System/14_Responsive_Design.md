# Responsive Design

**DES-001 — Document 14/15 — Design System**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Design Officer (CDO)
**Created:** 2026-07-27
**Cross-references:** DES-001/D05, DES-001/D06, DES-001/D07, TECH-001/D02

---

## Purpose

This document defines the **responsive design strategy** for VedMoulya — how layouts, components, and content adapt across every device size and input modality.

---

## Responsive Philosophy

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    RESPONSIVE PHILOSOPHY                                  │
│                                                                           │
│  Responsive design is not about squeezing a desktop site onto mobile.    │
│  Responsive design is about creating the BEST experience                 │
│  for each device, not the SAME experience.                               │
│                                                                           │
│  • Mobile is not "less" — it's focused                                   │
│  • Desktop is not "more" — it's expansive                                │
│  • Tablet is not "in-between" — it's the perfect reading device         │
│  • Large screens are not "wasted space" — they're breathing room        │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Device Spectrum

```text
VEDMOULYA DEVICE SPECTRUM
══════════════════════════

CATEGORY        WIDTH           UX PRIORITY
──────────────────────────────────────────────────
Mobile S        < 375px         1-hand use, thumb zone
Mobile          375-767px       Reachability, speed
Foldable        600-800px       Multi-window, continuity
Tablet          768-1023px      Reading, split-view
Desktop S       1024-1279px     Productivity
Desktop L       1280-1439px     Multi-tasking
Wide            1440-1919px     Side-by-side workflows
Ultra-wide      1920px+         Max-width constrained (1536px)
```

---

## Adaptive Layout Strategy

### Content Priority System

Each page defines content priority levels:

```text
PRIORITY LEVELS

P1 — CRITICAL (Always visible):
  • Navigation (current location)
  • Primary content
  • Primary actions

P2 — IMPORTANT (Collapsible on mobile):
  • Secondary content
  • Supporting information
  • Related actions

P3 — SUPPLEMENTAL (Hidden on mobile, reveal on demand):
  • Metadata
  • Extended details
  • Historical data

P4 — EXTRA (Desktop only):
  • Sidebars
  • Detailed dashboards
  • Multi-column views
```

### Layout Adaptation

```text
PAGE LAYOUT BY DEVICE:

MOBILE (< 768px):
  ┌──────────────────────┐
  │ Top Bar (Menu + Logo)│  ← 56px height
  ├──────────────────────┤
  │                      │
  │   SINGLE COLUMN      │  ← P1 content
  │   (100% width)       │
  │                      │
  ├──────────────────────┤
  │ [P2 expand]          │  ← Expandable sections
  │ [P3 reveal]          │  ← "Show more" links
  ├──────────────────────┤
  │                      │
  │   Bottom Nav (5 tabs)│  ← 56px height, thumb-friendly
  └──────────────────────┘

TABLET (768-1023px):
  ┌─────────────────────────────────────┐
  │ Top Bar                    │ Profile│  ← 64px
  ├─────────────────────────────────────┤
  │                                     │
  │  2-COLUMN LAYOUT                    │
  │  ┌────────────┬──────────────────┐  │
  │  │ Side (30%) │ Main (70%)       │  │
  │  │ P2 content │ P1 content       │  │
  │  └────────────┴──────────────────┘  │
  │                                     │
  └─────────────────────────────────────┘

DESKTOP (1024px+):
  ┌─────────────────────────────────────────┐
  │ Sidebar │ Header (Search + Actions)     │  ← 64px
  │ 280px   ├─────────────────────────────┤
  │         │                             │
  │         │  3-COLUMN OR FLEX LAYOUT    │
  │  Nav    │  ┌──────┬──────┬──────┐     │
  │         │  │ Main │ Side │ Extra│     │
  │         │  │ (50%)│(25%) │(25%) │     │
  │         │  └──────┴──────┴──────┘     │
  │         │                             │
  └─────────┴─────────────────────────────┘
```

---

## Component Adaptation

### Navigation

```text
NAVIGATION BY DEVICE

MOBILE:
  • Bottom tab bar (5 primary destinations)
  • Hamburger menu for full navigation
  • Back swipe gesture
  • Swipe to navigate between sections
  • Reachability: key actions in bottom half of screen

TABLET:
  • Optional sidebar (can be hidden)
  • Back button in top bar
  • Split-view support
  • Drag and drop between panes

DESKTOP:
  • Persistent sidebar (280px)
  • Breadcrumb navigation
  • Keyboard shortcuts
  • Multi-window support
```

### Cards & Lists

```text
CARDS

MOBILE:
  • Full-width cards
  • 16px padding
  • Single column
  • Swipe for actions

TABLET:
  • 2-column grid
  • 24px padding
  • Card stack on smaller tablets

DESKTOP:
  • 3-column grid (or 2-column for denser content)
  • 24px padding
  • Hover effects (elevation lift)

LISTS

MOBILE:
  • Dense list items (56px height)
  • Swipe for delete/archive
  • Long-press for context menu

DESKTOP:
  • Comfortable list items (64px height)
  • Checkbox selection
  • Right-click context menu
  • Inline actions on hover
```

### Tables

```text
TABLES

MOBILE:
  • Cards instead of tables for most data
  • For critical tables: horizontal scroll with sticky first column
  • Key-value display (label: value) for each row

TABLET:
  • Simplified table (fewer columns visible)
  • Collapsible rows for additional data
  • Horizontal scroll for wide tables

DESKTOP:
  • Full table with all columns
  • Sortable headers
  • Column resize
  • Row actions on hover
```

### Forms

```text
FORMS

MOBILE:
  • Single column (always)
  • Full-width inputs
  • Floating labels (to save vertical space)
  • Auto-advance to next field
  • Large touch targets (44px minimum)

TABLET:
  • Single column (simple forms)
  • 2-column for address/name (related short fields)
  • Side-by-side for short inputs

DESKTOP:
  • Single column (preferred for focus)
  • 2-column for related fields
  • Inline validation on blur
  • Keyboard shortcuts (Tab, Enter, Escape)
```

---

## Typography Adaptation

```text
TYPE SCALING BY DEVICE

See DES-001/D04 for full type scale per device.

KEY RULES:
  • Mobile body:    14px (minimum comfortable reading)
  • Tablet body:    15px (slightly larger for reading distance)
  • Desktop body:   15px (standard reading size)

  • Mobile H1:      28px (Mobile scale)
  • Desktop H1:     36px (Desktop scale)
  • Display:        clamp(36px, 5vw, 72px) — fluid

LINE LENGTH:
  • Mobile:          Full width (automatic optimal at this width)
  • Tablet:          60-75 chars (constrained with padding)
  • Desktop:         60-75 chars (constrained to ~720px for readability)
```

---

## Touch & Pointing Device Adaptation

```text
TOUCH (Mobile, Tablet):
  • 44px minimum touch targets
  • 8px minimum spacing between targets
  • Swipe gestures for common actions
  • Haptic feedback for confirmations
  • Hold for context menus (no right-click)
  • Drag threshold: 10px (prevent drag on scroll)

POINTER (Desktop):
  • 32px minimum click targets
  • Hover states for interactive elements
  • Right-click context menus
  • Drag and drop
  • Scroll wheel on non-focused elements

HYBRID (Tablet with keyboard, Foldable):
  • Detect input mode changes
  • Adapt touch targets on keyboard attach
  • Support both touch and pointer patterns
```

---

## Responsive Testing Checklist

```markdown
### Per Screen Size

- [ ] Layout does not break at any breakpoint
- [ ] Content is readable without horizontal scroll
- [ ] Images and illustrations scale appropriately
- [ ] Touch targets meet minimum size requirements
- [ ] Text is not truncated or overlapping

### Per Device Capability

- [ ] Touch: All interactions work with finger
- [ ] Keyboard: All interactions work with keyboard
- [ ] Pointer: Hover states function correctly
- [ ] Screen reader: Content reads in logical order

### Per Orientation (Mobile/Tablet)

- [ ] Portrait: Content flows vertically without cutoff
- [ ] Landscape: Layout takes advantage of width
- [ ] Rotation: Smooth transition between orientations
```

**Cross-Reference:** DES-001/D05 (Layout & Grid — breakpoints), DES-001/D07 (Component System), DES-001/D10 (Accessibility)
