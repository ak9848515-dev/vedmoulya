# Iconography

> **Document:** DES-010A-D10 — Experience Bible  
> **Status:** 🔒 **LOCKED** — Part of Experience Bible v1.0

---

## Purpose

Iconography defines the icon language of VedMoulya — style, stroke, sizing, usage rules, and accessibility requirements.

---

## Icon Style

| Property    | Standard                                                        |
| ----------- | --------------------------------------------------------------- |
| **Style**   | **Outline only** — never filled (except active/selected states) |
| **Stroke**  | **1.5px** — consistent across all icons                         |
| **Corners** | **Rounded** — 2px radius, never sharp geometric                 |
| **Fill**    | Transparent interior                                            |
| **Sizes**   | 16, 18, 20, 22, 24, 28, 32, 48px — predefined sizes only        |

---

## Icon Rules

| Rule                      | Explanation                                   |
| ------------------------- | --------------------------------------------- |
| **Outline only**          | Never mix icon styles                         |
| **No filled variants**    | Except for active/selected states             |
| **Icons support text**    | Never use icons alone for critical navigation |
| **Consistent stroke**     | 1.5px across all icons and sizes              |
| **Rounded corners**       | 2px radius on all corners                     |
| **Predefined sizes only** | Never scale icons between predefined sizes    |
| **Semantic color**        | Icons inherit semantic color from context     |

---

## Icon Sizes by Component

| Component            | Icon Size |
| -------------------- | --------- |
| Navigation — sidebar | 20px      |
| Navigation — top bar | 18px      |
| Buttons — SM         | 16px      |
| Buttons — MD         | 18px      |
| Buttons — LG         | 20px      |
| Buttons — XL         | 22px      |
| Cards — icon         | 24px      |
| Cards — avatar       | 32px      |
| Empty states         | 48px      |
| AI avatar            | 48px      |

---

## Icon Categories

| Category       | Purpose                                | Color                                       |
| -------------- | -------------------------------------- | ------------------------------------------- |
| **Navigation** | Wayfinding, moving through the product | Neutral-500 (default), #2B5FD9 (active)     |
| **Actions**    | Create, edit, delete, save, share      | Neutral-500 (default), semantic for meaning |
| **Status**     | Completion, warning, error, info       | Semantic colors                             |
| **Objects**    | Modules, features, content types       | Neutral-500 (default)                       |
| **AI**         | AI interactions, intelligence          | #7C3AED                                     |

---

## Quality Review

| Dimension           | Assessment                                                                          |
| ------------------- | ----------------------------------------------------------------------------------- |
| **Why**             | Icons communicate meaning quickly — inconsistent icon style erodes visual trust     |
| **Psychology**      | Picture superiority effect — icons are processed faster than text                   |
| **Accessibility**   | Icons never convey meaning alone; always paired with text for critical interactions |
| **Engineering**     | SVG sprite system for performance; consistent viewBox                               |
| **Performance**     | SVG icons are resolution-independent and size-efficient                             |
| **Scalability**     | Outline + 1.5px stroke system extends infinitely                                    |
| **DES Consistency** | Elevates DES-001/D07 Icon rules with stricter governance                            |

---

## Design Freeze Status

**DES-010A-D10: Iconography — LOCKED effective July 27, 2026.**
