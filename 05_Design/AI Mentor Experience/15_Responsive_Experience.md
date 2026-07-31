# Responsive Experience

> **Document:** DES-005-D15 — AI Mentor Experience & Conversation System  
> **Status:** 🔒 **LOCKED** — Part of DES-005 AI Mentor Constitution v1.0

---

## Purpose

The Mentor conversation must feel native on every device — from mobile one-handed chat to desktop multi-panel coaching.

---

## Device Layouts

| Device                            | Layout                                      | Behavior                                           |
| --------------------------------- | ------------------------------------------- | -------------------------------------------------- |
| **Mobile (<480px)**               | Full-screen, bottom sheet entry             | Single column chat, avatar top-right, input bottom |
| **Tablet portrait (480-768px)**   | Overlay drawer (80% width)                  | Chat + reduced context sidebar                     |
| **Tablet landscape (768-1024px)** | Split: chat (60%) + context (40%)           | Both visible simultaneously                        |
| **Laptop (1024-1440px)**          | Drawer (480px) + dashboard behind           | Focused chat, dashboard dimmed                     |
| **Desktop (1440-1920px)**         | Drawer (560px max) + context sidebar        | Rich context, knowledge references                 |
| **Ultra-wide (>1920px)**          | Centered chat (720px) + dual context panels | Maximum context                                    |

---

## Input Adaptation

| Device      | Input Style                                                    |
| ----------- | -------------------------------------------------------------- |
| **Mobile**  | Bottom input bar, voice button prominent, keyboard auto-opens  |
| **Tablet**  | Bottom input bar, voice + attachment buttons                   |
| **Desktop** | Bottom input bar, full toolset (voice, attach, suggest, emoji) |

---

## Context Sidebar

| Device      | Context Availability                                                           |
| ----------- | ------------------------------------------------------------------------------ |
| **Mobile**  | Hidden by default, swipe or tap to reveal                                      |
| **Tablet**  | Collapsible panel on right, shown by default in landscape                      |
| **Desktop** | Always visible, 280px, shows: current goal, recent progress, related knowledge |

---

## Cross-References

| Reference     | Relationship                                                  |
| ------------- | ------------------------------------------------------------- |
| DES-001 v1.0  | Design Constitution — responsive grid, breakpoints            |
| DES-003A v1.1 | Dashboard — Coach responsive alignment                        |
| DES-004 v1.0  | Memory & Knowledge — responsive patterns                      |
| DES-005/D00   | AI Mentor Constitution — responsive standards                 |
| DES-005/D02   | Conversation Experience — responsive layout applied           |
| DES-005/D06   | Contextual Assistance — context sidebar content               |
| ARC-003       | Knowledge Graph — responsive context retrieval                |
| ARC-004       | Execution Intelligence — responsive decision context          |
| ARC-005       | AI Orchestration — responsive conversation pipeline           |
| PRD-002       | User DNA — responsive personalization                         |
| ENG-001       | Domain Model — responsive layout entities                     |
| ENG-002       | Implementation Standards — responsive implementation patterns |
| ENG-003       | AI Development Guidelines — responsive accessibility          |
