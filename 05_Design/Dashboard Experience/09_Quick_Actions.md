# Quick Actions

**DES-003 — Document 09/15 — Dashboard Experience**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Experience Officer (CXO)

---

## Purpose

Quick Actions provide **instant access** to the most common user tasks — knowledge capture, asking the AI, creating goals, and continuing learning. These actions are always available but never demanding.

---

## Layout

```text
QUICK ACTIONS BAR

DESKTOP: Horizontal row below Today's Focus
  ┌────────────────────────────────────────────────────────┐
  │  Satoshi 600 SemiBold — 16px — #111827               │
  │  Quick Actions                                         │
  │                                                        │
  │  space-3                                               │
  │                                                        │
  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
  │  │ ✏️       │ │ 🎤      │ │ 🤖      │ │ 🎯      │ │
  │  │ Capture  │ │ Voice    │ │ Ask AI   │ │ New      │ │
  │  │ Idea     │ │ Note     │ │          │ │ Goal     │ │
  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
  │                                                        │
  │  ┌──────────┐ ┌──────────┐ ┌──────────────────────┐   │
  │  │ 📚      │ │ 💭      │ │ [More...]            │   │
  │  │ Continue │ │ Add      │ │                      │   │
  │  │ Learning │ │ Memory   │ │                      │   │
  │  └──────────┘ └──────────┘ └──────────────────────┘   │
  └────────────────────────────────────────────────────────┘

MOBILE: Horizontally scrollable row
  Each action: compact pill with icon + label
```

---

## Actions Specification

| Action                | Icon    | Behavior                                        | Trigger      |
| --------------------- | ------- | ----------------------------------------------- | ------------ |
| **Capture Idea**      | ✏️ 24px | Opens quick note input (inline or bottom sheet) | Tap          |
| **Voice Note**        | 🎤 24px | Starts voice recording                          | Tap (mobile) |
| **Ask AI**            | 🤖 24px | Opens AI chat overlay                           | Tap          |
| **New Goal**          | 🎯 24px | Opens goal creation flow                        | Tap          |
| **Continue Learning** | 📚 24px | Opens current learning module                   | Tap          |
| **Add Memory**        | 💭 24px | Opens memory capture (quick text)               | Tap          |

---

## Action Button Spec

```text
QUICK ACTION BUTTON

┌────────────────────┐
│                    │
│  [Icon 24px]       │
│                    │
│  Inter 500 Med     │
│  14px — #374151    │
│                    │
│  Label             │
│                    │
└────────────────────┘

SPECS:
  width: 88px (D) / 72px (M)
  height: 72px (D) / 64px (M)
  bg: #FFFFFF, radius: 24px, shadow: Standard
  border: #E8EDF5 (1px)
  hover: border #2B5FD9, shadow Level 1
  active: bg Primary-50
  transition: 200ms ease-out
```

---

## Cross-Reference

| Reference   | Relationship                                    |
| ----------- | ----------------------------------------------- |
| DES-001/D07 | Component System — button variants              |
| DES-003/D10 | Modular Cards — quick actions can be customized |
| DES-003/D05 | AI Coach — "Ask AI" opens coach chat            |
