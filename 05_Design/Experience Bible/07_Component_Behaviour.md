# Component Behaviour

> **Document:** DES-010A-D07 — Experience Bible  
> **Status:** 🔒 **LOCKED** — Part of Experience Bible v1.0

---

## Purpose

Component Behaviour defines the visual and behavioral specifications for every UI component in VedMoulya — including all states, variants, and module-specific card types.

---

## Component State Model

Every interactive component must define all 8 states:

| State        | Visual                                | Behavior                |
| ------------ | ------------------------------------- | ----------------------- |
| **Default**  | Resting visual                        | Ready for interaction   |
| **Hover**    | Subtle visual change                  | Desktop mouse over      |
| **Focus**    | Visible focus ring (3px, Primary-500) | Keyboard focus          |
| **Active**   | Pressed/selected state                | Momentary or persistent |
| **Loading**  | Skeleton or spinner                   | Processing              |
| **Disabled** | 40% opacity                           | No interaction          |
| **Error**    | Danger color indicator                | Failed state            |
| **Empty**    | Invitation to interact                | No data                 |

---

## Button Behaviour

| Variant   | Default                   | Hover          | Active         | Disabled    |
| --------- | ------------------------- | -------------- | -------------- | ----------- |
| Primary   | #2B5FD9 bg, white text    | #3B6FE3        | #1E4AA8        | 40% opacity |
| Secondary | white bg, #111827 text    | Neutral-100 bg | Neutral-200 bg | 40% opacity |
| Ghost     | transparent, #374151 text | Neutral-100 bg | Neutral-200 bg | 40% opacity |
| Danger    | #EF4444 bg, white text    | #DC2626        | #B91C1C        | 40% opacity |
| AI        | #7C3AED bg, white text    | #8B5CF6        | #6D28D9        | 40% opacity |

**Loading:** Show spinner, disable interaction, preserve width
**Full-width:** `width: 100%` in constrained containers
**Radius:** 14px ALL variants
**Sizes:** SM (32px), MD (40px default), LG (48px), XL (56px)

---

## Card Behaviour

### Standard Cards

| State    | Shadow   | Border  | Transform        |
| -------- | -------- | ------- | ---------------- |
| Default  | Standard | #E8EDF5 | None             |
| Hover    | Level 3  | #CBD5E1 | translateY(-2px) |
| Active   | Level 2  | #2B5FD9 | translateY(-1px) |
| Selected | Level 2  | #2B5FD9 | None             |

### Module-Specific Cards

| Card Type               | Identifier              | Primary Content       | Trust Signal         | Actions               |
| ----------------------- | ----------------------- | --------------------- | -------------------- | --------------------- |
| **AI Card**             | Purple border + AI icon | Coach message         | Confidence indicator | Talk, Dismiss, Why    |
| **Memory Card**         | Timestamp badge         | Memory content        | Freshness indicator  | Save, Dismiss, Share  |
| **Knowledge Card**      | Source badge            | Concept + connections | Confidence score     | Expand, Connect, Save |
| **Career Card**         | Career stage badge      | Role/opportunity      | Trust score          | Apply, Save, Why      |
| **Business Card**       | Business stage badge    | Venture/service       | Stage indicator      | View, Connect, Save   |
| **Marketplace Card**    | Category badge          | Opportunity           | Trust + pricing      | Apply, Save, Why      |
| **Life OS Card**        | Life state indicator    | Journey progress      | Life score           | Start, View, Why      |
| **Goal Card**           | Goal color left bar     | Goal description      | Progress bar         | Complete, Edit        |
| **Recommendation Card** | Reason badge            | Recommendation        | Confidence           | Apply, Learn, Dismiss |
| **Coach Card**          | AI avatar               | One-line insight      | —                    | Talk, Dismiss         |

---

## Form Element Behaviour

| Element    | Default            | Focus             | Error         | Disabled       |
| ---------- | ------------------ | ----------------- | ------------- | -------------- |
| Text Input | Neutral-300 border | Primary-500 ring  | Danger border | Neutral-100 bg |
| Textarea   | Neutral-300 border | Primary-500 ring  | Danger border | Neutral-100 bg |
| Select     | Neutral-300 border | Primary-500 ring  | Danger border | Neutral-100 bg |
| Checkbox   | Neutral-300 border | Primary-500 ring  | Danger border | 40% opacity    |
| Radio      | Neutral-300 border | Primary-500 ring  | Danger border | 40% opacity    |
| Toggle     | Neutral-300 track  | Primary-500 track | Danger track  | 40% opacity    |

---

## Notification & State Cards

| State           | Layout                                 | Icon                    | Action                |
| --------------- | -------------------------------------- | ----------------------- | --------------------- |
| **Loading**     | Skeleton shimmer matching final layout | —                       | None (transient)      |
| **Empty**       | Centered card, illustration, message   | Action-oriented icon    | Primary action button |
| **Error**       | Compact card, error message            | Alert icon (#EF4444)    | Retry or Dismiss      |
| **Offline**     | Compact banner, status                 | Wifi-off icon (#F59E0B) | Reconnect button      |
| **Recovery**    | Gentle card, guidance                  | Refresh icon (#2B5FD9)  | Primary action        |
| **Success**     | Quick indicator, auto-dismiss          | Checkmark (#22C55E)     | None                  |
| **Celebration** | Quiet inline, max 1/week               | Star (#C89B3C)          | Dismiss               |

---

## Quality Review

| Dimension           | Assessment                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| **Why**             | Components are the building blocks of every screen — consistent behaviour is the foundation of trust |
| **Psychology**      | Consistency builds predictability; predictable interfaces feel safer and more trustworthy            |
| **Accessibility**   | Every state includes text labels; color is never the only differentiator                             |
| **Engineering**     | Component library with defined states ensures implementation consistency                             |
| **Performance**     | Defined states prevent unnecessary re-renders and layout shifts                                      |
| **Scalability**     | Component system extends to any new module without redesigning foundations                           |
| **DES Consistency** | Elevates DES-001/D07 Component System with stricter governance                                       |

---

## Design Freeze Status

**DES-010A-D07: Component Behaviour — LOCKED effective July 27, 2026.**
