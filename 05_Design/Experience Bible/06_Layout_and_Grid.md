# Layout and Grid

> **Document:** DES-010A-D06 — Experience Bible  
> **Status:** 🔒 **LOCKED** — Part of Experience Bible v1.0

---

## Purpose

Layout and Grid defines the structural foundation of every VedMoulya screen — the grid system, breakpoints, content density rules, and layout patterns that ensure visual consistency across the entire product.

---

## Grid System

| Breakpoint | Width       | Columns | Gutter | Margin |
| ---------- | ----------- | ------- | ------ | ------ |
| Mobile S   | < 360px     | 4       | 12px   | 12px   |
| Mobile     | 360-480px   | 4       | 16px   | 16px   |
| Foldable   | 480-768px   | 6       | 16px   | 16px   |
| Tablet     | 768-1024px  | 8       | 20px   | 20px   |
| Laptop     | 1024-1280px | 12      | 24px   | 24px   |
| Desktop    | 1280-1536px | 12      | 24px   | 32px   |
| Wide       | > 1536px    | 12      | 24px   | 40px   |

---

## Content Density

| Density Level   | Description                      | When Used                 |
| --------------- | -------------------------------- | ------------------------- |
| **Spacious**    | Generous whitespace, large cards | Default — most screens    |
| **Comfortable** | Standard spacing                 | Information-dense screens |
| **Compact**     | Reduced padding                  | Data tables, lists        |
| **Minimal**     | Maximum space per element        | Focus mode, reading       |

---

## Layout Patterns

### Dashboard Layout

```
┌──────┬──────────────────────────────────────────┬──────┐
│      │                                          │      │
│ Side │           Main Content Area              │ AI   │
│ bar  │                                          │ Panel│
│      │  ┌──────────────────────────────────┐    │      │
│ 280px│  │  Hero Card (Today's Focus)       │    │320px │
│      │  └──────────────────────────────────┘    │      │
│      │  ┌──────┐ ┌──────┐ ┌──────┐             │      │
│      │  │ Card │ │ Card │ │ Card │             │      │
│      │  └──────┘ └──────┘ └──────┘             │      │
│      │                                          │      │
└──────┴──────────────────────────────────────────┴──────┘
```

### Content Layout

```
┌────────────────────────────────────────────────────────┐
│  Header (64px)                                          │
├────────────────────────────────────────────────────────┤
│  ┌───────────┬──────────────────────────────────┐       │
│  │           │                                  │       │
│  │ Sections  │         Content Area             │       │
│  │           │                                  │       │
│  │ 240-280px │                                  │       │
│  │           │                                  │       │
│  └───────────┴──────────────────────────────────┘       │
└────────────────────────────────────────────────────────┘
```

### Focus Layout

```
┌────────────────────────────────────────────────────────┐
│  Minimal, centered content                              │
│                                                         │
│            ┌────────────────────────┐                   │
│            │    Single focus item    │                   │
│            │    Max 720px wide      │                   │
│            └────────────────────────┘                   │
│                                                         │
│  Everything else hidden or minimized                    │
└────────────────────────────────────────────────────────┘
```

---

## Layout Principles

| Principle                 | Rule                                                         |
| ------------------------- | ------------------------------------------------------------ |
| **Consistent structure**  | Same layout pattern for same content type across all modules |
| **Visual hierarchy**      | Most important content is top-left (LTR) or top-center       |
| **Responsive by default** | Every layout works on every breakpoint                       |
| **Touch-friendly**        | Minimum 44×44px touch targets on all interactive elements    |
| **Keyboard-friendly**     | Logical tab order matching visual layout                     |
| **Readable line lengths** | Body text: 60-75 characters max                              |

---

## Section Spacing

| Context          | Desktop | Tablet | Mobile |
| ---------------- | ------- | ------ | ------ |
| Between sections | 64px    | 48px   | 32px   |
| Within sections  | 40px    | 32px   | 24px   |
| Sub-sections     | 24px    | 20px   | 16px   |
| Card padding     | 24px    | 20px   | 16px   |
| Page margin      | 40px    | 24px   | 16px   |

---

## Quality Review

| Dimension           | Assessment                                                                              |
| ------------------- | --------------------------------------------------------------------------------------- |
| **Why**             | Layout is the foundation of visual hierarchy — wrong layout makes everything else wrong |
| **Psychology**      | Gestalt principles — proximity, similarity, closure guide layout decisions              |
| **Accessibility**   | Logical tab order, readable line lengths, adequate whitespace                           |
| **Engineering**     | CSS Grid + Flexbox implementation; consistent breakpoint system                         |
| **Performance**     | Responsive images and content loading per breakpoint                                    |
| **Scalability**     | Layout patterns extend to any new module without redesign                               |
| **DES Consistency** | Elevates DES-001/D05 Layout & Grid and DES-001/D06 Spacing                              |

---

## Design Freeze Status

**DES-010A-D06: Layout and Grid — LOCKED effective July 27, 2026.**
