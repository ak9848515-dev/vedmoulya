# Color System

**DES-001 — Document 03/15 — Design System**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Design Officer (CDO)
**Created:** 2026-07-27
**Cross-references:** CMP-002, ARC-001, DES-001/D01, DES-001/D10, TECH-002/D03

---

## Purpose

This document defines the complete **color system** for VedMoulya — every color, its psychological rationale, usage rules, accessibility requirements, and both light and dark mode definitions.

---

## Color Philosophy

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    COLOR PHILOSOPHY                                       │
│                                                                           │
│  Color at VedMoulya is not decoration. It is communication.              │
│                                                                           │
│  Each color serves a specific psychological and functional purpose:      │
│                                                                           │
│  • Calm blues for trust and intelligence                                │
│  • Warm accents for growth and humanity                                 │
│  • Generous neutrals for focus and clarity                              │
│  • Purposeful greens for success without gamification                   │
│  • Soft gradients for depth without visual noise                        │
│                                                                           │
│  The system is designed for:                                            │
│  • WCAG 2.1 AA compliance (minimum)                                     │
│  • Equal effectiveness in light and dark mode                           │
│  • Scalability across 15+ component types                               │
│  • Emotional consistency across every touchpoint                        │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Color Psychology

### Why These Colors?

```text
VEDMOULYA COLOR PSYCHOLOGY
═══════════════════════════

PRIMARY — Deep Calm Blue (#2B5FD9)
──────────────────────────────────
Psychology:   Trust, intelligence, stability, depth
Why:          Blue is universally associated with trust and competence.
              This specific blue is warm-leaning (slightly purple undertone)
              — not cold like corporate blues. It feels alive, not clinical.
Used for:     Primary actions, key interactive elements, brand anchors

SECONDARY — Warm Teal (#0EA5A9)
────────────────────────────────
Psychology:   Growth, clarity, renewal, balance
Why:          Teal bridges blue (trust) and green (growth). It represents
              the VedMoulya mission — trusted guidance toward personal growth.
Used for:     Secondary actions, links, progressive indicators

ACCENT — Sunset Coral (#FF6B5B)
────────────────────────────────
Psychology:   Warmth, energy, humanity, emotion
Why:          Coral adds the human element. It prevents the palette from
              feeling cold or corporate. It's the color of encouragement.
Used for:     Highlights, celebrations, human warmth moments, AI Coach accent

NEUTRAL — Warm Gray (#6B7280 → #F3F4F6)
─────────────────────────────────────────
Psychology:   Stability, reliability, calm
Why:          Warm grays (slight brown/beige undertone) feel more natural
              and human than pure cool grays. They create a calm foundation.
Used for:     Text, backgrounds, borders, surfaces

SUCCESS — Mindful Green (#10B981)
──────────────────────────────────
Psychology:   Achievement, progress, harmony
Why:          Chosen for its calming warmth — not a bright, gamified green.
              It says "progress made" without "you won!" hype.
Used for:     Completion states, positive feedback, goal achieved

WARNING — Warm Amber (#F59E0B)
───────────────────────────────
Psychology:   Attention, caution, opportunity
Why:          Amber signals "pay attention" without the alarm of red.
              It's warm and human — like a thoughtful heads-up.
Used for:     Approaching limits, expiring items, medium-priority alerts

DANGER — Mindful Red (#EF4444)
───────────────────────────────
Psychology:   Urgency, importance, error
Why:          Red is reserved for genuine issues. Its use is rare,
              which makes it meaningful when it appears.
Used for:     Destructive actions, critical errors, data loss warnings
```

---

## Color Palettes

### Light Mode

```text
PRIMARY PALETTE
═══════════════
Primary-900:  #1A3D8F    (Deep navy — hero backgrounds)
Primary-800:  #1E4AA8
Primary-700:  #2355BF
Primary-600:  #2B5FD9    ★ PRIMARY (Brand color)
Primary-500:  #3B6FE3    (Interactive state)
Primary-400:  #5B8AEB    (Hover)
Primary-300:  #7FA5F2
Primary-200:  #A8C2F7
Primary-100:  #D4E1FC
Primary-50:   #EFF4FE    (Subtle backgrounds)

SECONDARY BLUE PALETTE (Constitution v1.0)
══════════════════════════════════════════
SecondaryBlue-600:  #5B8DEF   ★ SECONDARY BLUE
SecondaryBlue-500:  #7BA5F2
SecondaryBlue-400:  #9BBBF5
SecondaryBlue-300:  #BBD1F8
SecondaryBlue-200:  #DBE7FB
SecondaryBlue-100:  #EAF2FF   ★ LIGHT BLUE

SECONDARY PALETTE (Original — for supporting use)
══════════════════════════════════════════════════
Secondary-700: #0D969A
Secondary-600: #0EA5A9
Secondary-500: #1EB4B8
Secondary-400: #3EC2C5
Secondary-300: #66D0D3
Secondary-200: #96E0E2
Secondary-100: #C5EFF0
Secondary-50:  #E8F8F9

ACCENT PALETTE (Coral — warm accent, limited use)
══════════════════════════════════════════════════════
Accent-700:  #EE5545
Accent-600:  #FF6B5B     ★ ACCENT (Coral)
Accent-500:  #FF7D6E
Accent-400:  #FF9386
Accent-300:  #FFB0A5
Accent-200:  #FFCEC7
Accent-100:  #FFE8E3
Accent-50:   #FFF4F2

NEUTRAL PALETTE (Warm)
══════════════════════
Neutral-900:  #111827    (Heading text)
Neutral-800:  #1F2937    (Body text)
Neutral-700:  #374151    (Secondary text)
Neutral-600:  #4B5563    (Placeholder text)
Neutral-500:  #64748B    ★ NEUTRAL (Constitution v1.0)
Neutral-400:  #94A3B8
Neutral-300:  #CBD5E1    (Borders, dividers)
Neutral-200:  #E2E8F0    (Disabled backgrounds)
Neutral-100:  #F1F5F9    (Card backgrounds — subtle)
Neutral-50:   #F5F7FA    ★ PAGE BACKGROUND (Warm Matte Light)

SEMANTIC COLORS (Constitution v1.0)
═══════════════════════════════════
Success:    #22C55E
Success-bg: #F0FDF4
Warning:    #F59E0B
Warning-bg: #FFFBEB
Danger:     #EF4444
Danger-bg:  #FEF2F2
Info:       #3B82F6
Info-bg:    #EFF6FF

PREMIUM GOLD (Constitution v1.0 — limited use)
═══════════════════════════════════════════════
PremiumGold:    #C89B3C
PremiumGold-light: #E8D5A0
PremiumGold-dark:  #9B7630

Usage: ONLY for Premium features, Achievements, Awards, Milestones.
       Never for navigation. Never as primary brand color.

SURFACE COLORS
══════════════
Surface:      #FFFFFF    (Cards, modals, elevated surfaces)
Surface-border: #E8EDF5 (Constitution v1.0 — card borders)
Surface-elevated: #FFFFFF (with standard shadow)
Surface-modal:    #FFFFFF
Overlay:      rgba(15, 23, 42, 0.5)
Glass:        rgba(255, 255, 255, 0.8) + backdrop-blur
```

### Dark Mode

```text
DARK MODE PALETTE
═════════════════

PRIMARY (Dark):        #6B8FEF    (Lighter for contrast)
SECONDARY BLUE (Dark): #7BA5F2
LIGHT BLUE (Dark):     #1E3A5F
SECONDARY (Dark):      #3EC2C5
ACCENT (Dark):         #FF8B7D

NEUTRAL (Dark):
Neutral-900:  #F8FAFC    (Heading text)
Neutral-800:  #F1F5F9    (Body text)
Neutral-700:  #E2E8F0    (Secondary text)
Neutral-600:  #CBD5E1    (Placeholder)
Neutral-500:  #94A3B8    ★ NEUTRAL (Dark)
Neutral-400:  #64748B
Neutral-300:  #475569    (Borders)
Neutral-200:  #334155
Neutral-100:  #1E293B    (Cards)
Neutral-50:   #0F172A    (Page background)

SURFACE (Dark):
Surface:      #1E293B
Surface-border: #334155
Surface-elevated: #334155
Surface-modal:    #1E293B
Overlay:      rgba(0, 0, 0, 0.7)
Glass:        rgba(30, 41, 59, 0.8) + backdrop-blur

SEMANTIC (Dark):
Success:    #22C55E
Success-bg: #052E16
Warning:    #F59E0B
Warning-bg: #451A03
Danger:     #EF4444
Danger-bg:  #450A0A
Info:       #3B82F6
Info-bg:    #1E3A5F

PREMIUM GOLD (Dark):
PremiumGold:    #D4A84B
PremiumGold-dark: #8B6F2E
```

---

## AI-Specific Colors

AI interactions have their own color treatment to signal "intelligence is active":

```text
AI PRIMARY:   #7C3AED    (Violet-purple — intelligence, creativity)
AI SECONDARY: #8B5CF6
AI ACCENT:    #A78BFA
AI BG:        #F5F3FF    (Light mode)
AI BG-DARK:   #1F1B2E    (Dark mode)
AI BORDER:    #E9D5FF    (Light mode)
AI BORDER-DARK:#4C1D95   (Dark mode)
AI GLOW:      rgba(124, 58, 237, 0.15) (Subtle glow effect)
```

**Psychology:** Purple combines blue (trust) and red (energy). It signals that AI is different from the core platform — intelligent but distinct. It's the color of creativity, wisdom, and imagination.

---

## Gradients

```text
PRIMARY GRADIENT (Hero, splash):
  #2B5FD9 → #0EA5A9  (Trust → Growth)

WARM GRADIENT (Celebration, highlights):
  #FF6B5B → #F59E0B  (Human warmth → Optimism)

DEEP GRADIENT (Depth backgrounds):
  #1A3D8F → #0A7A7D  (Deep navy → Teal)

AI GRADIENT (AI interactions):
  #7C3AED → #6D28D9  (Deep purple → Violet)

GLASS GRADIENT (Glassmorphism surfaces):
  rgba(255, 255, 255, 0.6) → rgba(255, 255, 255, 0.2)
```

---

## Elevation & Shadow

```text
ELEVATION SYSTEM (Light Mode) — Constitution v1.0
══════════════════════════════════════════════════

Standard Shadow (Cards):
  0 8px 30px rgba(15, 23, 42, 0.06)
  Very soft. Premium. Never floating. Never heavy.
  Used for: Standard cards, elevated surfaces

Level 0:  No shadow (flat surfaces)
Level 1:  0 1px 2px rgba(15, 23, 42, 0.05)        [Subtle depth]
Level 2:  0 1px 3px rgba(15, 23, 42, 0.07), 0 1px 2px rgba(15, 23, 42, 0.03)  [Dropdowns]
Level 3:  0 4px 6px rgba(15, 23, 42, 0.06), 0 2px 4px rgba(15, 23, 42, 0.04) [Dialogs]
Level 4:  0 10px 15px rgba(15, 23, 42, 0.07), 0 4px 6px rgba(15, 23, 42, 0.04) [Modals]
Level 5:  0 20px 25px rgba(15, 23, 42, 0.09), 0 8px 10px rgba(15, 23, 42, 0.05) [Toasts]

AI GLOW:  0 0 20px rgba(124, 58, 237, 0.15)       [AI thinking indicator]
```

---

## Color Accessibility

### Contrast Ratios

| Token                     | On #F5F7FA | On #FFFFFF | On Primary-900 | WCAG                                   |
| ------------------------- | ---------- | ---------- | -------------- | -------------------------------------- |
| Neutral-900               | 17.3:1     | 19.5:1     | —              | AAA                                    |
| Neutral-800               | 12.1:1     | 13.6:1     | —              | AAA                                    |
| Neutral-700               | 8.9:1      | 10.1:1     | —              | AAA                                    |
| Primary-600               | 4.2:1      | 4.8:1      | —              | AA (body +18px)                        |
| Primary-600 on Neutral-50 | 4.2:1      | —          | —              | ✓ AA                                   |
| Primary-700 for text      | 5.8:1      | 6.7:1      | —              | AAA                                    |
| SecondaryBlue-600         | 4.3:1      | 4.9:1      | —              | AA                                     |
| PremiumGold #C89B3C       | 2.9:1 (❌) | —          | —              | Use only for large decorative elements |

**Rule:** Always verify contrast ratios. Primary-700 or Primary-800 should be used for text on light backgrounds. Primary-600 is the interactive/brand color, not text color. Premium Gold is decorative only — never use for text or critical UI.

### Color Blindness

| Type                           | Concern                   | Mitigation                                                              |
| ------------------------------ | ------------------------- | ----------------------------------------------------------------------- |
| **Deuteranopia** (green-blind) | Red/green differentiation | Never rely on color alone to convey meaning. Always use icons + labels. |
| **Protanopia** (red-blind)     | Red/green differentiation | Same mitigation. Accent and Danger must have supporting indicators.     |
| **Tritanopia** (blue-blind)    | Blue/yellow issues        | Primary may appear gray. Ensure shape + text + icon support.            |
| **Achromatopsia** (full)       | No color perception       | Full grayscale must be usable. Every state has a non-color indicator.   |

---

## Usage Rules

| Rule                                                    | Application                                                      |
| ------------------------------------------------------- | ---------------------------------------------------------------- |
| Rule                                                    | Application                                                      |
| ------                                                  | -------------                                                    |
| **Primary for primary actions only**                    | One primary button per view                                      |
| **Accent for emphasis, not bulk**                       | Accent is a highlight, not a background                          |
| **Semantic colors for meaning**                         | Green = success, Red = error, Amber = warning — never decorative |
| **AI purple for AI boundaries**                         | Any AI-generated content has purple treatment                    |
| **One emotional accent per screen**                     | Coral or Light Blue should appear once to maintain impact        |
| **Premium Gold is extremely limited**                   | Only for Premium features, Achievements, Awards, Milestones      |
| **Light Blue (#EAF2FF) for background accents**         | Use as alternative to Coral in less warm contexts                |
| **Never use pure white (#FFFFFF) for page backgrounds** | Page background is always #F5F7FA                                |
| **Dark mode is first-class**                            | Design in dark mode first, then adapt to light                   |

---

## Color Token Naming

```text
Pattern: {type}-{role}-{strength}

Examples:
  bg-primary-600        — Background, primary role, strength 600
  text-neutral-900      — Text, neutral role, darkest
  border-secondary-400  — Border, secondary role, 400
  accent-600            — Accent color (default strength)
```

**Cross-Reference:** DES-001/D06 (Spacing System — token naming), TECH-002/D03 (Naming Conventions)
