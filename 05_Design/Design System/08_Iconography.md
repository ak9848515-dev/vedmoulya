# Iconography

**DES-001 — Document 08/15 — Design System**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Design Officer (CDO)
**Created:** 2026-07-27
**Cross-references:** DES-001/D03, DES-001/D04, DES-001/D07, TECH-001/D02

---

## Purpose

This document defines the **iconography system** for VedMoulya — style, sizing, usage rules, and design principles for all icons across the platform.

---

## Icon Philosophy

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    ICON PHILOSOPHY                                        │
│                                                                           │
│  Icons at VedMoulya are wayfinding, not decoration.                      │
│                                                                           │
│  Every icon serves a purpose:                                            │
│  • Reduce cognitive load — visual recognition is faster than reading     │
│  • Reinforce meaning — icons support text, never replace it             │
│  • Create consistency — the same icon always means the same thing       │
│  • Add personality — subtle warmth in the visual style                  │
│                                                                           │
│  If an icon doesn't help the user navigate or understand, remove it.     │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Icon Style

```text
VEDMOULYA ICON STYLE — Constitution v1.0
══════════════════════════════════════════

STYLE:          Outlined (line-based) — Outline only. Never filled. Never mixed.
STROKE WIDTH:   1.5px (consistent across all icons)
CORNER RADIUS:  2px (slight rounding on all corners) — Icons are rounded
FILL:           No fill (transparent interior)
SIZE:           16px, 18px, 20px, 22px, 24px, 28px, 32px, 48px
GRID:           24×24px base grid (scales to other sizes)
ALIGNMENT:      Pixel-perfect alignment to 1px grid

VISUAL WEIGHT:  Balanced — neither too heavy nor too thin
                Slightly heavier than typical for better recognition

CHARACTER:      Clean, warm, approachable
                Rounded terminals — soft, never sharp geometric

CONSTITUTION RULE:
  • Outline only. Rounded. 1.5px stroke.
  • Never mix icon styles.
  • No filled variants except for active/selected states.
```

---

## Icon Sizes

```text
ICON SIZE USAGE
════════════════

SIZE    PX    USAGE
────────────────────────────────────────
SM      16px  Inline with text, table cells, small badges
MD      18px  Button icons (default button size)
DEFAULT 20px  Navigation items, list items
LG      22px  Large buttons, card headers
XL      24px  Primary actions, empty states
2XL     28px  Section headers, feature icons
3XL     32px  Page-level icons, dialog headers
4XL     48px  Feature illustrations, hero sections

Each size exists on a 1px grid.
Always use predefined sizes — never in-between values.
```

---

## Icon Categories

```text
ICON INVENTORY (by category)
═════════════════════════════

NAVIGATION
  Home, Discover, Learn, Build, Earn, Grow, Manage,
  Community, AI, Platform, Settings, Profile, Help

ACTIONS
  Add, Edit, Delete, Duplicate, Archive, Share, Download,
  Upload, Export, Import, Link, Copy, Move, Pin

COMMUNICATION
  Chat, Message, Email, Notification, Bell, Alert, Feedback,
  Comment, Mention, Announcement

CONTENT
  Document, File, Folder, Image, Video, Audio, Code,
  Book, Article, Course, Podcast, Template

PROGRESS
  Check, Circle, Star, Heart, Trophy, Award, Medal,
  Progress, Milestone, Achievement, Streak, Level

AI & INTELLIGENCE
  AI, Spark, Brain, Lightbulb, Insight, Analysis, Prediction,
  Recommendation, Coach, Mentor, Assistant, Automation

SOCIAL & PEOPLE
  User, Users, Group, Team, Mentor, Coach, Partner,
  Follower, Following, Connection, Network

DATA & METRICS
  Chart, Graph, Bar, Pie, Line, Analytics, Dashboard,
  Metric, KPI, Report, Trend, Statistic

TIME & SCHEDULE
  Calendar, Clock, Timer, Schedule, Deadline, Reminder,
  History, Recent, Future, Timeline

STATUS & INDICATORS
  Check (circle), X (circle), Warning, Error, Info, Help,
  Question, Lock, Unlock, Verified, Loading, Sync
```

---

## Icon Usage Rules

| Rule                   | Good                                        | Bad                                                      |
| ---------------------- | ------------------------------------------- | -------------------------------------------------------- |
| **Icons support text** | Icon + label                                | Icon alone (except universally recognized: search, menu) |
| **Consistent meaning** | Same icon = same meaning everywhere         | Using different icons for the same concept               |
| **Appropriate size**   | 16px inline with 16px text                  | 24px icon next to 14px text                              |
| **Color discipline**   | Neutral-500 for passive, Primary for active | Primary for all icons regardless of state                |
| **Spacing**            | Icon to text: 8px (space-2)                 | Icon touching text                                       |
| **No decoration**      | Functional icons only                       | Icons used as bullets or decoration                      |

---

## Icon States

| State        | Treatment                                              |
| ------------ | ------------------------------------------------------ |
| **Default**  | Neutral-500 (passive) / Neutral-900 (active)           |
| **Hover**    | Color transitions to interactive color (Primary, etc.) |
| **Disabled** | Neutral-300, no interaction                            |
| **Active**   | Primary-600 or appropriate semantic color              |
| **Selected** | Primary-600, filled variant                            |
| **Error**    | Danger                                                 |
| **Success**  | Success                                                |

---

## Creating New Icons

### Design Checklist

```text
□ Follows the VedMoulya icon style (1.5px stroke, 2px radius)
□ Works at 24×24px base grid
□ Recognizable at 16px minimum
□ Has a clear, single meaning
□ Doesn't duplicate existing icons
□ Approved by CDO before implementation

ICON NAMING CONVENTION
══════════════════════
Pattern: icon-{category}-{name}

Examples:
  icon-nav-home
  icon-action-add
  icon-ai-spark
  icon-status-check
  icon-progress-trophy
```

---

## Do's and Don'ts

```text
✅ DO — Constitution v1.0
  • Use icons to speed up visual scanning
  • Pair icons with labels in navigation
  • Animate icons on completion (checkmark animation)
  • Use filled variant ONLY for active/selected states
  • Maintain consistent stroke width across all icons
  • Always use rounded corners on all icons

❌ DON'T — Constitution v1.0
  • Use icons without labels for critical navigation
  • Mix outlined and filled variants in the same context
  • Custom color icons (use system color tokens)
  • Animate icons unnecessarily (motion sickness)
  • Use stock icon sets (inconsistent with brand)
  • Use filled icons as defaults (outline only)
  • Use sharp or geometric corners (rounded only)
```
