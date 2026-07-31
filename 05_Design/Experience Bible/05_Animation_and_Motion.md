# Animation and Motion

> **Document:** DES-010A-D05 — Experience Bible  
> **Status:** 🔒 **LOCKED** — Part of Experience Bible v1.0

---

## Purpose

Animation and Motion defines the complete motion language of VedMoulya — every animation's purpose, timing, easing, and effect, from micro-interactions through page transitions.

---

## Motion Philosophy

| Principle         | Rule                                                                 |
| ----------------- | -------------------------------------------------------------------- |
| **Apple-quality** | Calm, purposeful, never flashy                                       |
| **Purposeful**    | Every animation serves a spatial, hierarchical, or causal function   |
| **Performant**    | Use `transform` and `opacity` only (GPU-accelerated)                 |
| **Calm**          | No decorative animations, no parallax, no 3D transforms, no confetti |
| **Respectful**    | `prefers-reduced-motion: reduce` → all animations 0ms                |

---

## Duration Scale

| Token   | MS        | Usage                                            |
| ------- | --------- | ------------------------------------------------ |
| instant | 0ms       | State changes with no visible transition         |
| micro   | 100-150ms | Hover states, press feedback, toggle switches    |
| fast    | 200-250ms | Standard transitions (color, bg, shadow)         |
| normal  | 250-300ms | Element movement (cards, lists, modals entering) |
| slow    | 300-400ms | Complex transitions (page changes, drawer slide) |
| slower  | 400-600ms | Celebratory moments, progress updates            |
| slowest | 600-900ms | Hero animations, morning welcome                 |

---

## Easing Curves

| Curve                   | Value                                  | Usage                                      |
| ----------------------- | -------------------------------------- | ------------------------------------------ |
| **Ease-out (Standard)** | `cubic-bezier(0.16, 1, 0.3, 1)`        | ALL entrances — cards, modals, tooltips    |
| **Ease-in-out**         | `cubic-bezier(0.65, 0, 0.35, 1)`       | Position changes, page transitions         |
| **Ease-in**             | `cubic-bezier(0.4, 0, 0.6, 1)`         | Exits — dismissing dialogs, removing items |
| **Spring (subtle)**     | `stiffness: 300, damping: 30, mass: 1` | Card hover lift, button press              |

---

## Micro-interaction Animations

| Interaction  | Property                           | Duration | Easing   |
| ------------ | ---------------------------------- | -------- | -------- |
| Button hover | Background color                   | 100ms    | ease-out |
| Button press | Scale 0.97                         | 100ms    | ease-out |
| Card hover   | Shadow increase + translateY(-2px) | 200ms    | ease-out |
| Toggle track | Background color                   | 200ms    | ease-out |
| Toggle thumb | Position + slight scale            | 200ms    | ease-out |
| Checkbox     | Checkmark scale                    | 150ms    | ease-out |
| Radio        | Dot appearance                     | 150ms    | ease-out |

---

## Component Animations

| Component | Enter                             | Exit                              | Duration                 | Easing             |
| --------- | --------------------------------- | --------------------------------- | ------------------------ | ------------------ |
| Modal     | Scale 0.95→1 + opacity 0→1        | Scale 1→0.95 + opacity 1→0        | 200ms enter / 150ms exit | ease-out / ease-in |
| Drawer    | translateX(100%→0)                | translateX(0→100%)                | 250ms enter / 200ms exit | ease-out / ease-in |
| Toast     | translateY(-20px→0) + opacity 0→1 | opacity 1→0 + translateY(0→-10px) | 200ms enter / 300ms exit | ease-out / ease-in |
| Tooltip   | opacity 0→1                       | opacity 1→0                       | 150ms                    | ease-out           |
| Dropdown  | opacity 0→1 + scale 0.95→1        | opacity 1→0                       | 200ms                    | ease-out           |
| Accordion | Height expand                     | Height collapse                   | 250ms                    | ease-out           |

---

## Page & Route Transitions

| Pattern        | Animation                        | Duration      | Easing             |
| -------------- | -------------------------------- | ------------- | ------------------ |
| Route leave    | opacity 1→0                      | 150ms         | ease-in            |
| Route enter    | opacity 0→1                      | 200ms         | ease-out           |
| Content change | Old fades out, new fades in      | 150ms + 200ms | ease-in + ease-out |
| List entry     | translateY(20px→0) + opacity 0→1 | 300ms         | ease-out           |
| List exit      | translateX(-100%) + opacity 1→0  | 200ms         | ease-in            |

---

## AI Animations

| Animation         | Duration       | Easing   | Notes                       |
| ----------------- | -------------- | -------- | --------------------------- |
| Thinking dots     | 300ms cycle    | ease-out | Three dots sequential fade  |
| Message streaming | ~50ms/word     | linear   | Word-by-word appearance     |
| Response reveal   | 300ms per line | ease-out | translateY(4px→0) + opacity |
| Confidence update | 600ms          | ease-out | Number counting, bar fill   |

---

## Life OS Animations

| Animation             | Duration      | Easing   | Notes                     |
| --------------------- | ------------- | -------- | ------------------------- |
| Morning welcome       | 2700ms total  | ease-out | 4-stage sequence          |
| Atmosphere transition | 500ms         | ease-out | Color/greeting shift      |
| Daily Brief cards     | 400ms stagger | ease-out | Sequential appearance     |
| Context switch        | 200-300ms     | ease-out | Deepen/Shift/Widen/Return |
| Reflection prompt     | 300ms         | ease-out | Gentle slide in           |

---

## Reduced Motion

| Rule          | Implementation                                                          |
| ------------- | ----------------------------------------------------------------------- |
| **Detect**    | `prefers-reduced-motion: reduce`                                        |
| **Effect**    | All animation durations → 0ms                                           |
| **Exception** | Still animate opacity for appear/disappear (critical for understanding) |
| **Exception** | Progress indicators (determinate)                                       |
| **Exception** | User-initiated feedback (click feedback)                                |
| **Exception** | Loading states, skeleton screens                                        |

---

## Haptic Policy (Future)

| Interaction          | Haptic Type      | Strength   | Status    |
| -------------------- | ---------------- | ---------- | --------- |
| Button press         | Light click      | Light      | 📝 Future |
| Success confirmation | Gentle pulse     | Medium     | 📝 Future |
| Error alert          | Sharp tap        | Strong     | 📝 Future |
| AI thinking          | Subtle vibration | Very light | 📝 Future |

---

## Sound Policy (Future)

| Interaction       | Sound                                      | Status                |
| ----------------- | ------------------------------------------ | --------------------- |
| Notifications     | None (visual only always)                  | 🔇 Decided — never    |
| Celebrations      | None (visual only always)                  | 🔇 Decided — never    |
| Voice interaction | Optional voice output user-controlled      | 📝 Future             |
| Navigation sounds | None                                       | 🔇 Decided — never    |
| AI voice persona  | Calm, warm voice output for Life Companion | 📝 Research — Phase 3 |

---

## Voice Experience (Future)

| Feature                          | Status     |
| -------------------------------- | ---------- |
| Voice input for AI conversations | 📝 Phase 2 |
| Voice output for AI responses    | 📝 Phase 2 |
| Voice commands for navigation    | 📝 Phase 3 |
| Voice mode for Life OS           | 📝 Phase 3 |

---

## AR/VR Readiness (Future)

| Capability                | Status     |
| ------------------------- | ---------- |
| Spatial UI components     | 📝 Phase 4 |
| 3D data visualization     | 📝 Phase 4 |
| Immersive life timeline   | 📝 Phase 5 |
| Virtual mentorship spaces | 📝 Phase 5 |

---

## Wearables (Future)

| Capability               | Status     |
| ------------------------ | ---------- |
| Quick opportunity alerts | 📝 Phase 3 |
| Micro-learning on watch  | 📝 Phase 3 |
| Daily brief glance       | 📝 Phase 3 |
| AI Companion on wearable | 📝 Phase 4 |

---

## Future Interaction Modes

| Mode               | Status      | Description                       |
| ------------------ | ----------- | --------------------------------- |
| Gesture navigation | 📝 Phase 2  | Swipe, pinch, long-press patterns |
| Voice control      | 📝 Phase 3  | Voice-activated actions           |
| Spatial UI         | 📝 Phase 4  | AR/VR interfaces                  |
| Brain-computer?    | 🤔 Research | Long-term exploration             |

---

## Quality Review

| Dimension           | Assessment                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Why**             | Motion communicates meaning — without it, users don't understand what changed or why                                           |
| **Psychology**      | Causal perception — animation helps users understand cause and effect; spatial awareness — motion shows where things come from |
| **Accessibility**   | Reduced motion must ALWAYS be respected; animations never convey critical information alone                                    |
| **Engineering**     | Use transform and opacity only; CSS animations preferred over JS for performance                                               |
| **Performance**     | Animations must run at 60fps; GPU-accelerated properties only                                                                  |
| **Scalability**     | Consistent timing and easing tokens scale to any new component                                                                 |
| **DES Consistency** | Elevates DES-001/D09 Motion System with stricter governance                                                                    |

---

## Design Freeze Status

**DES-010A-D05: Animation and Motion — LOCKED effective July 27, 2026.**
