# Interaction Language

> **Document:** DES-010A-D03 — Experience Bible  
> **Status:** 🔒 **LOCKED** — Part of Experience Bible v1.0

---

## Purpose

Interaction Language defines how users interact with VedMoulya — navigation patterns, search, gestures, feedback, micro-interactions, undo, and all interaction design principles.

---

## Interaction Design Principles

| Principle                  | Rule                                                                 |
| -------------------------- | -------------------------------------------------------------------- |
| **Progressive Disclosure** | Show what's needed now. Reveal complexity when the user seeks it.    |
| **Forgiving Input**        | Accept flexible input formats. Never punish imprecision.             |
| **Instant Feedback**       | Every action has an immediate, meaningful response.                  |
| **Undo Everything**        | Mistakes are reversible. No permanent consequences from exploration. |
| **Context Preservation**   | Navigate away and back without losing state or scroll position.      |
| **Human Pace**             | The system waits for the user, never the reverse.                    |

---

## Navigation Patterns

| Pattern        | Desktop                                     | Mobile                 |
| -------------- | ------------------------------------------- | ---------------------- |
| **Primary**    | Persistent sidebar (280px / 64px collapsed) | Bottom tab bar (5 max) |
| **Secondary**  | Breadcrumbs                                 | Hamburger menu         |
| **Contextual** | In-page section navigation                  | Section accordion      |
| **Quick**      | Command/Ctrl + K search                     | Gesture-based back     |

---

## Search

| Aspect       | Specification                                     |
| ------------ | ------------------------------------------------- |
| **Trigger**  | Command/Ctrl + K or Search icon                   |
| **Width**    | 640px (desktop), full-width (mobile)              |
| **Position** | Top-center, overlay style                         |
| **Overlay**  | Semi-transparent backdrop                         |
| **Debounce** | 300ms                                             |
| **Results**  | Categorized by type, keyboard navigable           |
| **Empty**    | "No results for [query]. Try different keywords." |

---

## Micro-interactions

| Interaction      | Duration | Animation                         | Notes        |
| ---------------- | -------- | --------------------------------- | ------------ |
| Button hover     | 100ms    | Background color transition       | Desktop only |
| Button press     | 100ms    | Scale 0.97                        | All devices  |
| Card hover       | 200ms    | Shadow increase, translateY(-2px) | Desktop only |
| Toggle switch    | 200ms    | Track + thumb transition          | All devices  |
| Checkbox         | 150ms    | Checkmark animation               | All devices  |
| Accordion expand | 250ms    | Height transition                 | All devices  |
| Dropdown open    | 200ms    | Fade + slight scale               | All devices  |
| Tooltip appear   | 150ms    | Fade in                           | All devices  |

---

## Feedback Patterns

| Action       | Feedback                                      | Timing          | Type       |
| ------------ | --------------------------------------------- | --------------- | ---------- |
| Button click | Background flash                              | 100ms           | Instant    |
| Form submit  | Loading state + success indicator             | Until complete  | Persistent |
| Save         | Icon transition (gray → green → red on error) | 300ms           | Persistent |
| Error        | Inline error message + field highlight        | Until resolved  | Persistent |
| Delete       | Confirmation dialog + undo toast              | 5s undo window  | Persistent |
| AI thinking  | Three dots animation                          | 300ms cycle     | Transient  |
| AI response  | Streaming text appearance                     | ~50ms/word      | Transient  |
| Success      | Checkmark + brief indicator                   | 2s auto-dismiss | Transient  |
| Celebration  | Inline, quiet, max 1/week                     | 600ms           | Transient  |

---

## Gesture Support (Mobile)

| Gesture     | Action                 | Area            |
| ----------- | ---------------------- | --------------- |
| Swipe left  | Dismiss / Delete       | Card            |
| Swipe right | Mark complete / Snooze | Card item       |
| Pull down   | Refresh                | Scroll views    |
| Tap         | Select / Activate      | All             |
| Long press  | Context menu           | Items           |
| Pinch       | Zoom in/out            | Content, charts |
| Double tap  | Like / Save            | Quick actions   |

---

## Undo System

| Property     | Specification                          |
| ------------ | -------------------------------------- |
| **Duration** | 5 second undo window                   |
| **Display**  | Toast at top or bottom                 |
| **Actions**  | ESC or click Undo to reverse           |
| **Stack**    | 50 steps max per session               |
| **Scope**    | Delete, Archive, Move, Update, Reorder |
| **Finality** | After 5s, action is permanent          |

---

## Keyboard Shortcuts

| Shortcut       | Action                  | Scope       |
| -------------- | ----------------------- | ----------- |
| `Cmd/Ctrl + K` | Global search           | Global      |
| `Cmd/Ctrl + B` | Toggle sidebar          | Global      |
| `?`            | Show keyboard shortcuts | Global      |
| `ESC`          | Close modal / Back      | Contextual  |
| `Enter`        | Confirm                 | Contextual  |
| `↑↓`           | Navigate list           | Contextual  |
| `/`            | AI-assisted writing     | Text inputs |

---

## Context Menu

| Property         | Value                                        |
| ---------------- | -------------------------------------------- |
| **Trigger**      | Right-click (desktop) or long-press (mobile) |
| **Width**        | 200-280px                                    |
| **Style**        | Elevated card, Level 3 shadow, 8px radius    |
| **Items**        | 4-8 max, icon (16px) + label                 |
| **Danger items** | Bottom of menu, red text                     |

---

## Quality Review

| Dimension           | Assessment                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------- |
| **Why**             | Interaction is how users experience the product — every millisecond matters                   |
| **Psychology**      | Fitts' Law — interaction targets must be large enough; feedback loops reinforce behavior      |
| **Accessibility**   | Every interaction must be available via keyboard; gestures must have non-gesture alternatives |
| **Engineering**     | Interaction patterns define the event handling architecture                                   |
| **Performance**     | Interactions must feel instant — 100ms threshold for perceived immediacy                      |
| **Scalability**     | Consistent interaction patterns scale across new features without relearning                  |
| **DES Consistency** | Elevates DES-001/D11 Interaction Patterns with more granular specs                            |

---

## Design Freeze Status

**DES-010A-D03: Interaction Language — LOCKED effective July 27, 2026.**
