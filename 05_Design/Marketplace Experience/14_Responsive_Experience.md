# Responsive Experience

> **Document:** DES-009-D14 — Marketplace & Opportunity Ecosystem  
> **Status:** 🔒 **LOCKED** — Part of DES-009 Marketplace Constitution v1.1

---

## Purpose

The Responsive Experience ensures the marketplace works seamlessly across every device — desktop, laptop, tablet, foldables, and mobile — in every orientation, with every input method, and in all network conditions, while respecting accessibility preferences.

---

## Vision

Create a marketplace that feels native on every device — where the experience adapts intelligently to screen size, input method, network quality, and user preference — without sacrificing functionality or trust.

---

## Design Constitution Compliance

| Property        | Standard                        | Source       |
| --------------- | ------------------------------- | ------------ |
| Page Background | `#F5F7FA` (Warm Matte Light)    | DES-001 v1.0 |
| Cards           | `#FFFFFF` with border `#E8EDF5` | DES-001 v1.0 |
| Primary Color   | `#2B5FD9` (Deep Calm Blue)      | DES-001 v1.0 |
| Headings        | Satoshi                         | DES-001 v1.0 |
| Body            | Inter (never below 16px)        | DES-001 v1.0 |
| Card Radius     | 24px                            | DES-001 v1.0 |
| Motion          | 200-300ms, ease-out             | DES-001 v1.0 |
| Accessibility   | WCAG 2.1 AA — all breakpoints   | DES-001 v1.0 |

---

## Architecture References

| Reference   | Relationship                                                     |
| ----------- | ---------------------------------------------------------------- |
| DES-001/D05 | Layout & Grid — responsive grid system                           |
| DES-001/D06 | Spacing System — responsive spacing tokens                       |
| DES-001/D09 | Motion System — reduced motion, device-aware animations          |
| DES-001/D10 | Accessibility — screen readers, touch targets, keyboard          |
| DES-001/D14 | Responsive Design — design system responsive patterns            |
| ARC-001     | System Architecture — cross-device state sync                    |
| ARC-002     | Information Architecture — responsive data flow                  |
| ARC-003     | Knowledge Graph — device-aware experience personalization        |
| ARC-004     | Execution Intelligence — offline queue sync                      |
| ARC-005     | AI Orchestration — device-appropriate coach presence             |
| ENG-001     | Domain Model — Device, Session, Sync entities                    |
| ENG-002     | Implementation Standards — responsive patterns, offline support  |
| ENG-003     | AI Development Guidelines — device-appropriate AI interactions   |
| ENG-004     | Testing Standards — cross-device, offline, accessibility testing |
| RSH-001     | Research — device usage patterns, offline behavior               |
| CMP-001     | Competition — mobile marketplace experience analysis             |

### Relationship Summary

| Reference   | How D14 Depends On It                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------- |
| DES-001     | All responsive standards (layout, spacing, motion, accessibility) source from Design Constitution |
| DES-001/D05 | Layout & Grid — responsive grid system baseline                                                   |
| DES-001/D06 | Spacing System — responsive spacing tokens per breakpoint                                         |
| DES-001/D07 | Component System — adaptive components per device                                                 |
| DES-001/D09 | Motion System — reduced motion, device-capable animations                                         |
| DES-001/D10 | Accessibility — screen readers, touch targets, keyboard at all breakpoints                        |
| DES-001/D14 | Responsive Design — design system responsive patterns extend here                                 |
| DES-002     | Onboarding must be responsive for first-time users                                                |
| DES-003     | Dashboard responsive layout derived from these standards                                          |
| DES-003A    | Refined dashboard responsive improvements inform this spec                                        |
| DES-009/D00 | Information hierarchy adapts per device constraints                                               |
| DES-009/D02 | Marketplace dashboard responsive layout                                                           |
| DES-009/D03 | Opportunity feed responsive card layout                                                           |
| DES-009/D04 | Service marketplace responsive listing                                                            |
| DES-009/D05 | Collaboration workspace responsive design                                                         |
| DES-009/D06 | Mentorship responsive session interface                                                           |
| DES-009/D07 | Hiring responsive candidate discovery                                                             |
| DES-009/D08 | Freelancing responsive project management                                                         |
| DES-009/D09 | Partner ecosystem responsive profiles                                                             |
| DES-009/D10 | AI Coach responsive presence per device                                                           |
| DES-009/D11 | Trust score responsive display                                                                    |
| DES-009/D12 | Insights responsive charts and reports                                                            |
| DES-009/D13 | Settings responsive controls                                                                      |
| ARC-001     | System architecture enables cross-device state sync                                               |
| ARC-002     | Data flow design supports responsive content delivery                                             |
| ARC-003     | Knowledge Graph enables device-aware personalization                                              |
| ARC-004     | Execution intelligence supports offline queue and sync                                            |
| ARC-005     | AI pipeline provides device-appropriate coach presence                                            |
| ENG-001     | Domain entities define Device, Session, and Sync models                                           |
| ENG-002     | Implementation patterns define responsive and offline standards                                   |
| ENG-003     | AI ethics govern device-appropriate AI interactions                                               |
| ENG-004     | Testing standards validate cross-device and accessibility compliance                              |
| RSH-001     | Research informs device usage patterns and offline needs                                          |
| CMP-001     | Competitive analysis benchmarks mobile marketplace experience                                     |

---

## Specification Consistency

| Standard               | Reference             | Application                                              |
| ---------------------- | --------------------- | -------------------------------------------------------- |
| Typography             | DES-001/D04           | Desktop + mobile type scales; Body never below 16px      |
| Spacing                | DES-001/D06           | Responsive spacing: space-8 (desktop) → space-4 (mobile) |
| Motion                 | DES-001/D09           | Reduced motion respected; device-capability-aware        |
| Accessibility          | DES-001/D10           | WCAG 2.1 AA at all breakpoints; 44×44px touch targets    |
| Color Hierarchy        | DES-001/D03           | Consistent colors across all devices                     |
| Component Language     | DES-001/D07           | Adaptive components per device                           |
| AI Personality         | DES-001/D11 + DES-005 | Consistent Mentor persona across devices                 |
| Interaction Principles | DES-001/D11           | Input-appropriate interactions per device                |

---

## 1. Device Breakpoints & Layout (Major Experience Section)

The marketplace adapts to five device categories with distinct layout strategies.

```
┌────────────────────────────────────────────────────────┐
│  Device        Width      Layout             Grid      │
│  ────────────  ─────────  ─────────────────  ─────     │
│  Desktop       > 1280px   Multi-column       12-col    │
│  Laptop        1024-1280  Multi-column       12-col    │
│  Tablet        768-1024   Hybrid             8-col     │
│  Foldables     480-768    Single/multi       6-col     │
│  Mobile        < 480px    Single column      4-col     │
└──────────────────────────────────────────────────────────┘
```

| Breakpoint                | Layout Strategy                                              | Key Changes from Desktop                     |
| ------------------------- | ------------------------------------------------------------ | -------------------------------------------- |
| **Desktop (>1280px)**     | Full experience — dashboard, feed, coach in parallel columns | Baseline experience                          |
| **Laptop (1024-1280px)**  | Slightly reduced whitespace, smaller cards                   | Space-6 padding instead of space-8           |
| **Tablet (768-1024px)**   | Feed and detail in 2-column; coach slides in from right      | Coach becomes overlay panel                  |
| **Foldables (480-768px)** | Single-column primary; secondary panels as overlays          | Tab-based navigation; bottom sheet for coach |
| **Mobile (<480px)**       | Single-column; coach at bottom as compact bar                | Full-screen panels; gesture navigation       |

### Quality Review

| Dimension                     | Assessment                                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Why**                       | Users access marketplace from multiple devices — experience must be consistently great on all              |
| **Marketplace Reasoning**     | Mobile-first marketplace access is critical for discovery and quick actions; desktop for detailed work     |
| **Psychological Reasoning**   | Consistency — cross-device familiarity builds trust; fluency — smooth adaptation reduces friction          |
| **Accessibility Impact**      | Responsive design is accessibility — larger text on mobile, adequate touch targets, readable line lengths  |
| **Trust Impact**              | Broken responsive experience signals poor quality and erodes trust in the platform                         |
| **Implementation Complexity** | Medium-High — requires responsive CSS architecture, adaptive components, and thorough testing              |
| **Future Scalability**        | Can add device-specific features (camera for portfolio, location for discovery), foldable-specific layouts |

---

## 2. Input Methods (Major Experience Section)

The marketplace supports all input methods: touch, mouse, keyboard, stylus, and screen readers — with interactions optimized for each.

| Input Method      | Optimizations                                                                  | Considerations                       |
| ----------------- | ------------------------------------------------------------------------------ | ------------------------------------ |
| **Touch**         | 44×44px minimum targets, gesture support, no hover dependency, swipeable cards | Finger occlusion, one-handed zones   |
| **Mouse**         | Hover states, tooltips, drag-and-drop, right-click context menus               | Precision targeting, scroll wheel    |
| **Keyboard**      | Full tab order, visible focus indicators, shortcut keys, skip links            | No keyboard traps, logical order     |
| **Stylus**        | Precision input for signatures, annotations, drawing                           | Palm rejection, pressure sensitivity |
| **Screen Reader** | Semantic HTML, ARIA landmarks, live regions, alt text                          | Announcement order, dynamic content  |

### Quality Review

| Dimension                     | Assessment                                                                                                |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Why**                       | Users interact with marketplace through different input methods — all must be first-class                 |
| **Marketplace Reasoning**     | Input accessibility expands market reach; keyboard-friendly power users increase engagement               |
| **Psychological Reasoning**   | Mental models — users expect familiar input patterns; consistency — same actions work regardless of input |
| **Accessibility Impact**      | This IS accessibility — keyboard and screen reader support are mandatory, not optional                    |
| **Trust Impact**              | Responsive input handling signals platform quality and user respect                                       |
| **Implementation Complexity** | Medium — requires input detection, event handling per method, and comprehensive testing                   |
| **Future Scalability**        | Can add voice input, gesture customization, adaptive interfaces based on input patterns                   |

---

## 3. Cross-Device Continuity (Previously Uncovered Item)

The marketplace maintains state and context across devices — users can seamlessly switch between phone, tablet, and desktop.

| Feature                  | Implementation                                                    | Priority |
| ------------------------ | ----------------------------------------------------------------- | -------- |
| **Session Continuity**   | Logged in on all devices; session doesn't expire on device switch | P0       |
| **State Sync**           | Read items, bookmarks, drafts sync in real-time                   | P1       |
| **Notification Sync**    | Dismiss on one device = dismissed on all                          | P1       |
| **Partial Completion**   | Start a proposal on mobile, finish on desktop                     | P2       |
| **Device-aware Content** | Heavy content deferred to desktop; quick actions on mobile        | P1       |

### Quality Review

| Dimension                     | Assessment                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Why**                       | Users switch between devices throughout the day — continuity prevents frustration and lost work              |
| **Marketplace Reasoning**     | Cross-device continuity increases engagement time and reduces abandonment                                    |
| **Psychological Reasoning**   | Cognitive continuity — seamless switching reduces mental load; consistency — state preservation builds trust |
| **Accessibility Impact**      | Cross-device sync is particularly important for users who rely on specific device setups                     |
| **Trust Impact**              | Reliable state sync signals platform reliability; lost data erodes trust                                     |
| **Implementation Complexity** | Medium-High — requires real-time sync, conflict resolution, and offline queue                                |
| **Future Scalability**        | Can add device-specific optimization preferences, bandwidth-aware sync, peer-to-peer sync for offline        |

---

## 4. Offline Behavior (Major Experience Section)

The marketplace works gracefully offline — cached data, queued actions, and seamless reconnection.

| State               | Behavior                                        | Data Available                         | Actions                 |
| ------------------- | ----------------------------------------------- | -------------------------------------- | ----------------------- |
| **Online**          | Full functionality                              | All                                    | All                     |
| **Weak Connection** | Reduced image quality, defer non-critical loads | Prioritized content                    | Critical actions only   |
| **Offline**         | Cached experience                               | Last-viewed opportunities, saved items | Queue actions for later |
| **Reconnecting**    | Background sync, conflict resolution            | Queue status display                   | View queued actions     |

### Quality Review

| Dimension                     | Assessment                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Why**                       | Network is unreliable — users must be able to browse, save, and prepare actions even without connectivity          |
| **Marketplace Reasoning**     | Offline capability differentiates from competitors; reduces abandonment on unreliable networks                     |
| **Psychological Reasoning**   | Reliability — offline-ready platforms feel more dependable; frustration avoidance — preventing workflow disruption |
| **Accessibility Impact**      | Offline support is critical for users in areas with poor connectivity or on mobile data limits                     |
| **Trust Impact**              | Transparent offline state and reliable sync build trust; lost work destroys it                                     |
| **Implementation Complexity** | Medium-High — requires service worker, local storage, sync queue, conflict resolution                              |
| **Future Scalability**        | Can add smart pre-caching based on user patterns, prioritized sync, bandwidth-aware downloads                      |

---

## 5. Orientation & Layout Adaptation (Major Experience Section)

The marketplace responds to orientation changes on mobile and tablet devices.

| Orientation            | Behavior                                  | Layout Changes                         |
| ---------------------- | ----------------------------------------- | -------------------------------------- |
| **Portrait**           | Default mobile/tablet experience          | Single-column, content-first           |
| **Landscape**          | Wider layout, reveal secondary panels     | Two-column where possible, wider cards |
| **Split Screen**       | Marketplace adapts to available viewport  | Collapsed navigation, compact cards    |
| **Picture-in-Picture** | Coach can float as PiP during other tasks | Compact coach card, always-on-top      |

### Quality Review

| Dimension                     | Assessment                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Why**                       | Device orientation changes frequently — experience must respond gracefully                              |
| **Marketplace Reasoning**     | Orientation-responsive design increases usability; split-screen support is essential for tablets        |
| **Psychological Reasoning**   | Fluency — smooth orientation transitions feel natural; disruption — jarring transitions break flow      |
| **Accessibility Impact**      | Landscape often preferred by users with low vision; split-screen important for accessibility tool users |
| **Trust Impact**              | Responsive orientation handling signals platform polish; broken transitions signal poor quality         |
| **Implementation Complexity** | Medium — requires orientation detection, layout reflow, and state preservation                          |
| **Future Scalability**        | Can add orientation-lock preference, per-orientation layout customization                               |

---

## Specification Summary

| Device   | Screen Width | Primary Input    | Layout            | Coach         | Key Consideration    |
| -------- | ------------ | ---------------- | ----------------- | ------------- | -------------------- |
| Desktop  | >1280px      | Mouse + Keyboard | Multi-column      | Side panel    | Full feature set     |
| Laptop   | 1024-1280px  | Mouse + Keyboard | Multi-column      | Side panel    | Reduced padding      |
| Tablet   | 768-1024px   | Touch + Keyboard | 2-column hybrid   | Overlay panel | Touch optimization   |
| Foldable | 480-768px    | Touch            | Single/multi flex | Bottom sheet  | Flex adaptation      |
| Mobile   | <480px       | Touch            | Single column     | Compact bar   | Thumb-friendly zones |

---

## Cross-Device Continuity (Previously Uncovered Item)

| Feature       | Implementation         | Sync Method     | Offline Support    |
| ------------- | ---------------------- | --------------- | ------------------ |
| Session       | OAuth + refresh tokens | Real-time       | N/A                |
| Bookmarks     | Cloud-synced list      | Real-time       | Local cache        |
| Drafts        | Auto-save to cloud     | De-bounced (2s) | Local draft + sync |
| Read State    | Mark items as read     | Real-time       | Local queue        |
| Notifications | Dismiss state          | Real-time       | Local cache        |
| Settings      | Preference service     | On change       | Local fallback     |
| History       | Activity log           | Batch sync      | Partial cache      |

---

## Accessibility Across Devices

| Requirement           | Desktop   | Tablet     | Mobile              |
| --------------------- | --------- | ---------- | ------------------- |
| WCAG 2.1 AA           | ✅        | ✅         | ✅                  |
| 44×44px touch targets | ✅ Native | ✅         | ✅                  |
| Keyboard navigation   | ✅ Full   | ✅ Reduced | ✅ (tab navigation) |
| Screen reader         | ✅        | ✅         | ✅                  |
| Reduced motion        | ✅        | ✅         | ✅                  |
| Zoom to 200%          | ✅        | ✅         | ✅                  |
| Text spacing override | ✅        | ✅         | ✅                  |

---

## Motion

| Animation         | Desktop             | Mobile               | Notes                      |
| ----------------- | ------------------- | -------------------- | -------------------------- |
| Card entry        | 300ms, stagger 50ms | 250ms, stagger 30ms  | Faster on mobile           |
| Page transition   | 200ms fade          | 150ms slide          | Slide for native feel      |
| Coach panel       | 300ms slide         | 250ms bottom sheet   | Context-appropriate        |
| Offline indicator | 200ms fade          | 200ms slide from top | Prominent but non-blocking |
| Reduced motion    | All 0ms             | All 0ms              | prefers-reduced-motion     |

---

## Cross-References

| Reference    | Relationship                                                       |
| ------------ | ------------------------------------------------------------------ |
| DES-001 v1.0 | Design Constitution — all standards                                |
| DES-001/D05  | Layout & Grid — responsive grid system                             |
| DES-001/D06  | Spacing System — responsive spacing                                |
| DES-001/D09  | Motion System — device-aware animations                            |
| DES-001/D10  | Accessibility — required at all breakpoints                        |
| DES-001/D14  | Responsive Design — design system patterns                         |
| DES-009/D00  | Marketplace Constitution — information hierarchy adapts per device |
| DES-009/D02  | Marketplace Dashboard — responsive dashboard layout                |
| DES-009/D03  | Opportunity Discovery — responsive feed                            |
| DES-009/D10  | AI Marketplace Coach — responsive coach presence                   |
| ARC-001      | System Architecture — cross-device state sync                      |

---

## Future Scalability

| Capability                           | Horizon   | Impact                            |
| ------------------------------------ | --------- | --------------------------------- |
| Wearable marketplace notifications   | 12 months | Quick glance at opportunities     |
| Voice-controlled marketplace actions | 9 months  | Hands-free opportunity management |
| AR portfolio previews                | 12 months | Immersive portfolio browsing      |
| Adaptive bandwidth streaming         | 3 months  | Automatic quality adjustment      |
| Cross-device handoff gestures        | 6 months  | Seamless device transfer          |

---

## Implementation Complexity

| Component               | Complexity  | Key Dependencies                       |
| ----------------------- | ----------- | -------------------------------------- |
| Responsive Layout       | Medium      | CSS architecture, component adaptation |
| Input Method Support    | Medium      | Event handling, testing                |
| Cross-Device Continuity | Medium-High | Real-time sync, conflict resolution    |
| Offline Behavior        | Medium-High | Service worker, local storage          |
| Orientation Adaptation  | Medium      | Layout reflow, state preservation      |

---

## Design Freeze Status

**DES-009-D14: Responsive Experience — LOCKED effective July 27, 2026.**

All responsive experience design decisions are finalized. No further changes without formal Design Review.
