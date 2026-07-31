# Typography System

**DES-001 — Document 04/15 — Design System**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Design Officer (CDO)
**Created:** 2026-07-27
**Cross-references:** DES-001/D01, DES-001/D10, TECH-001/D02, TECH-002/D03

---

## Purpose

This document defines the complete **typography system** for VedMoulya — font families, hierarchy, sizing, weights, line heights, letter spacing, responsive scaling, and usage rules.

---

## Typography Philosophy

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    TYPOGRAPHY PHILOSOPHY                                  │
│                                                                           │
│  Typography is the voice of VedMoulya made visible.                      │
│                                                                           │
│  • Clean without being cold                                              │
│  • Confident without being loud                                          │
│  • Warm without being casual                                             │
│  • Readable without being boring                                         │
│                                                                           │
│  Good typography is invisible.                                           │
│  Great typography makes the reader forget they're reading.               │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Font Families

### Primary: Inter

```text
INTER — PRIMARY FONT
═════════════════════
Designer:     Rasmus Andersson
Category:     Sans-serif, Humanist
License:      Open Source (SIL OFL 1.1)
Why Inter:    Purpose-built for screen readability. Excellent x-height,
              open apertures, and clear letterforms. The perfect balance of
              warmth and precision. Used by GitHub, Linear, Mozilla.

Usage:        All UI text — headings, body, labels, buttons, navigation
Weights:      300 (Light), 400 (Regular), 500 (Medium), 600 (Semi-Bold),
              700 (Bold)

FONT URL:     https://rsms.me/inter/
Import:       @import url('https://rsms.me/inter/inter.css');
```

### Display: Satoshi (or Cabinet Grotesk)

```text
SATOSHI — DISPLAY FONT
════════════════════════
Designer:     Fontshare (Indian Type Foundry)
Category:     Sans-serif, Geometric
License:      Open Source (SIL OFL 1.1)
Why Satoshi:  Clean geometric forms with distinctive character. The
              perfect complement to Inter for headlines and hero text.
              Adds a touch of sophistication and distinctiveness.

Usage:        Display text, hero headlines, large headings (H1-H2),
              marketing copy, brand materials
Weights:      300 (Light), 400 (Regular), 500 (Medium), 700 (Bold),
              900 (Black)

FONT URL:     https://www.fontshare.com/fonts/satoshi
```

### Monospace: JetBrains Mono

```text
JETBRAINS MONO — MONOSPACE FONT
══════════════════════════════════
Designer:     JetBrains
Category:     Monospace, Developer Focused
License:      Open Source (SIL OFL 1.1)
Why JetBrains: Superior readability for code and data. Increased x-height,
               distinctive letterforms, and ligature support.

Usage:        Code blocks, data displays, technical content, CLI
Weight:       400 (Regular)
```

---

## Type Scale

### Desktop Type Scale

```text
TYPOGRAPHY SCALE (Desktop) — Constitution v1.0
══════════════════════════════════════════════

TOKEN           SIZE      WEIGHT    LINE-HEIGHT  LETTER-SPACING  USAGE
────────────────────────────────────────────────────────────────────────
Display         56px      700 Bold  68px         -0.02em         Hero sections, brand pages
Hero            48px      700 Bold  58px         -0.02em         Feature heroes, splash

H1              40px      600 Semi  50px         -0.015em        Page titles
H2              32px      600 Semi  42px         -0.01em         Section titles
H3              28px      600 Semi  38px         0em             Sub-section titles
H4              24px      500 Med   34px          0em             Card titles
Section         20px      600 Semi  28px          0em             Section headers within cards

Body            16px      400 Reg   26px          0em             Primary reading text
Caption         14px      500 Med   20px          0.02em          Captions, secondary info
Tiny            12px      400 Reg   16px          0em             Meta, timestamps, legal

Button          14px      500 Med   20px          0.02em          Button labels
Label           14px      500 Med   18px          0.02em          Form labels, tags
Input           16px      400 Reg   24px          0em             Input fields

Overline        12px      600 Semi  16px          0.08em          Label above sections
Small           12px      400 Reg   16px          0em             Legal text, timestamps
```

### Mobile Type Scale

```text
TYPOGRAPHY SCALE (Mobile) — Constitution v1.0
══════════════════════════════════════════════

TOKEN           SIZE      WEIGHT    LINE-HEIGHT  LETTER-SPACING
────────────────────────────────────────────────────────────────
Display         36px      700 Bold  44px         -0.02em
Hero            32px      700 Bold  40px         -0.02em
H1              28px      600 Semi  36px         -0.015em
H2              24px      600 Semi  32px         -0.01em
H3              22px      600 Semi  30px         0em
H4              20px      500 Med   28px         0em
Section         18px      600 Semi  26px         0em
Body            16px      400 Reg   24px         0em
Caption         14px      500 Med   20px         0.02em
Tiny            12px      400 Reg   16px         0em
Button          14px      500 Med   20px         0.02em
```

---

## Typography Rules

### Hierarchy Rules

| Rule                                   | Explanation                                            |
| -------------------------------------- | ------------------------------------------------------ |
| **One H1 per page**                    | The page title. Everything else nests below it.        |
| **Skip levels only intentionally**     | H1 → H3 is deliberate, not accidental omission.        |
| **Never use size for hierarchy alone** | Weight + spacing + color must reinforce hierarchy.     |
| **Three levels max per content area**  | Beyond H1-H2-H3, use style variations, not new levels. |

### Line Length

```text
READABILITY RULES
══════════════════

Optimal line length: 60-75 characters per line
Maximum line length: 85 characters
Minimum:            30 characters

WIDER THAN 85 CHARACTERS:
  Use columns, grids, or multi-column layouts
  Increase font size
  Increase line-height to 1.7-1.8x

NARROWER THAN 30 CHARACTERS:
  Decrease font size
  Consider single-column mobile layout
```

### Spacing

```text
PARAGRAPH SPACING
  Between paragraphs: 1.5× font-size (1.5em)
  Between lists:      1× font-size

HEADING SPACING
  Before heading:     2× base font-size
  After heading:      0.5× base font-size

LIST SPACING
  List item spacing:  0.5× font-size
  Nested indent:      1.5× base font-size
```

### Responsive Scaling

```text
RESPONSIVE TYPOGRAPHY — Constitution v1.0
═════════════════════════════════════════

Use CSS clamp() for fluid typography:

  Display:    clamp(2.25rem, 4vw, 3.5rem)     — Scales from 36px ↔ 56px
  Hero:       clamp(2rem, 3.5vw, 3rem)        — Scales from 32px ↔ 48px
  H1:         clamp(1.75rem, 3vw, 2.5rem)     — Scales from 28px ↔ 40px
  H2:         clamp(1.5rem, 2.5vw, 2rem)      — Scales from 24px ↔ 32px
  H3:         clamp(1.375rem, 2vw, 1.75rem)   — Scales from 22px ↔ 28px
  Body:       clamp(1rem, 1vw, 1rem)           — 16px (never below)

IMPORTANT: Never reduce Body below 16px at any breakpoint.
Body size is fixed at 16px minimum for readability.

Breakpoints:
  Mobile:    < 768px   — Mobile scale
  Tablet:    768-1024px — Hybrid (use mobile scale for body, desktop for H1-H2)
  Desktop:   > 1024px  — Full desktop scale
  Wide:      > 1536px  — Max size (no further scaling)
```

---

## Typography in Components

| Component           | Font           | Weight       | Size           | Special                               |
| ------------------- | -------------- | ------------ | -------------- | ------------------------------------- |
| **Navigation**      | Inter          | 500 Medium   | 14px           | Letter-spacing: 0.02em                |
| **Buttons**         | Inter          | 500 Medium   | 14px           | Letter-spacing: 0.02em, Sentence case |
| **Cards — Title**   | Satoshi        | 600 SemiBold | 20px (Section) | —                                     |
| **Cards — Body**    | Inter          | 400 Regular  | 16px (Body)    | Line-height: 1.625                    |
| **Forms — Label**   | Inter          | 500 Medium   | 14px           | Letter-spacing: 0.02em                |
| **Forms — Input**   | Inter          | 400 Regular  | 16px           | —                                     |
| **Tables — Header** | Inter          | 600 SemiBold | 12px           | UPPERCASE, 0.05em tracking            |
| **Tables — Row**    | Inter          | 400 Regular  | 14px           | —                                     |
| **Error text**      | Inter          | 400 Regular  | 14px           | Use Danger color                      |
| **AI Chat**         | Inter          | 400 Regular  | 16px           | AI purple accent border               |
| **Code**            | JetBrains Mono | 400 Regular  | 14px           | —                                     |

---

## Typography Accessibility

| Requirement                  | Standard                             | Check                                       |
| ---------------------------- | ------------------------------------ | ------------------------------------------- |
| **Minimum body size**        | 16px — never below at any breakpoint | Enforced by clamp() and fixed body size     |
| **Line height**              | 1.5× for body text                   | Minimum 1.5× (26px for 16px body)           |
| **Letter spacing**           | User can override                    | No fixed widths that break spacing override |
| **Font weight for headings** | Minimum 600 for clear hierarchy      | 600/700, never below                        |
| **Text color contrast**      | 4.5:1 for body, 3:1 for large text   | Per WCAG 2.1 AA                             |
| **Resizable text**           | Up to 200% without loss of content   | Test at 200% zoom                           |
| **Dyslexia**                 | Use sans-serif, adequate spacing     | Inter is designed for readability           |

**Cross-Reference:** DES-001/D10 (Accessibility Standards)

---

## Typography Token Naming

```text
Pattern: text-{size}-{weight}

Examples:
  text-display-bold       — Display text, bold weight
  text-h1-semi            — H1, semi-bold
  text-body               — Body text, regular
  text-caption-medium     — Caption, medium weight
  text-overline-semi      — Overline, semi-bold
```
