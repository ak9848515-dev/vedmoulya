# Responsive Experience

> **Document:** DES-010-D14 — Life Operating System Experience  
> **Status:** 🔒 **LOCKED** — Part of DES-010 Life OS Constitution v1.0

---

## Purpose

Responsive Experience defines how the Life OS works across every device and context — desktop, laptop, tablet, foldables, and mobile, in every orientation, with every input method, and in all network conditions — while maintaining cross-device continuity.

---

## Device Breakpoints

| Device   | Width       | Layout            | Life OS Presence | Key Considerations                 |
| -------- | ----------- | ----------------- | ---------------- | ---------------------------------- |
| Desktop  | >1280px     | Full multi-column | Full experience  | Rich visualizations, multi-tasking |
| Laptop   | 1024-1280px | Multi-column      | Full experience  | Reduced whitespace                 |
| Tablet   | 768-1024px  | Hybrid            | Adapted          | Touch-optimized, bottom navigation |
| Foldable | 480-768px   | Single/multi flex | Compact          | Continuity across fold             |
| Mobile   | <480px      | Single column     | Essential        | Thumb-zone, gesture navigation     |

---

## Life OS by Device

| Life OS Feature   | Desktop            | Tablet       | Mobile                 |
| ----------------- | ------------------ | ------------ | ---------------------- |
| Daily Brief       | Full context bar   | Condensed    | Hero + 2 context items |
| Life Companion    | Side panel         | Overlay      | Bottom sheet           |
| Context Bar       | Persistent top     | Collapsible  | Compact indicator      |
| Life Timeline     | Full timeline      | 3-column     | Single column          |
| Reflection        | Full journal       | Full journal | Quick reflections      |
| Growth Ecosystem  | Full visualization | Compact      | Summary only           |
| Cross-module view | Multiple modules   | 1-2 modules  | Single module          |

---

## Input Methods

| Input         | Desktop      | Tablet       | Mobile         |
| ------------- | ------------ | ------------ | -------------- |
| Mouse         | Full         | Optional     | N/A            |
| Keyboard      | Primary      | Optional     | Via attachment |
| Touch         | N/A          | Primary      | Primary        |
| Stylus        | Optional     | Supported    | N/A            |
| Voice         | Optional     | Optional     | Supported      |
| Screen reader | Full support | Full support | Full support   |

---

## Cross-Device Continuity

| Feature            | Implementation         | Sync Method        |
| ------------------ | ---------------------- | ------------------ |
| Session            | OAuth + refresh tokens | Real-time          |
| State preservation | Per-module state saved | Real-time          |
| Drafts             | Auto-saved             | De-bounced (2s)    |
| Read state         | Items marked read      | Real-time          |
| Notifications      | Dismiss sync           | Real-time          |
| Settings           | Preference service     | On change          |
| Offline queue      | Local + sync           | Batch on reconnect |

---

## Offline Behavior

| State           | Behavior           | Available Data         | User Can              |
| --------------- | ------------------ | ---------------------- | --------------------- |
| Online          | Full functionality | All                    | Everything            |
| Weak connection | Reduced quality    | Prioritized content    | Critical actions only |
| Offline         | Cached experience  | Last view, saved items | Queue actions         |
| Reconnecting    | Background sync    | Queue status           | View queue            |

---

## Motion by Device

| Animation             | Desktop       | Mobile        | Notes                  |
| --------------------- | ------------- | ------------- | ---------------------- |
| Life Flow transitions | 300-500ms     | 200-300ms     | Faster on mobile       |
| Context switch        | 300ms         | 200ms         | Instant on mobile tap  |
| Companion appear      | 300ms         | 250ms         | Bottom sheet on mobile |
| Daily Brief entry     | 400ms stagger | 300ms stagger | Fewer items on mobile  |
| Reflection prompt     | 300ms         | 200ms         | Quick show on mobile   |
| Reduced motion        | All 0ms       | All 0ms       | prefers-reduced-motion |

---

## Quality Review

| Dimension                     | Assessment                                                                                                             |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Why**                       | Users access the Life OS from multiple devices — the integrated experience must be consistent everywhere               |
| **Life Psychology Reasoning** | Cognitive continuity — seamless cross-device experience reduces mental load                                            |
| **Human-Centered Reasoning**  | Life doesn't pause when you switch devices — neither should the OS                                                     |
| **Accessibility Impact**      | Every device variant meets WCAG 2.1 AA; cross-device sync preserves accessibility settings                             |
| **Trust Impact**              | Reliable cross-device state sync signals platform quality; lost data erodes trust                                      |
| **Implementation Complexity** | Medium-High — requires responsive components, state sync, offline support                                              |
| **Future Scalability**        | Can add device-specific optimizations, context-aware device switching (phone for quick actions, desktop for deep work) |

---

## Design Freeze Status

**DES-010-D14: Responsive Experience — LOCKED effective July 27, 2026.**
