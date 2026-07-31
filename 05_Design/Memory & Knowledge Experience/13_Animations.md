# Animations

> **Document:** DES-004-D13 — Memory & Knowledge Experience  
> **Status:** 🔒 **LOCKED** — Part of DES-004 Memory Constitution v1.0  
> **Design Constitution:** DES-001 v1.0 · DES-002A v1.0 · DES-003A v1.1

---

## Purpose

Animations in the Memory & Knowledge Experience must feel calm, purposeful, and Apple-quality. Every animation serves a functional purpose — orienting the user, showing relationships, or celebrating completion.

**Why it exists:** Motion communicates hierarchy, connection, and state changes. Well-designed animation reduces cognitive load by guiding attention naturally.

**How it connects:** Every document in DES-004 references these animation specifications for consistency.

**What it changed:** Without defined motion, animations would be inconsistent or decorative. Standardized motion creates a unified, premium feel.

**How it influenced later decisions:** Animation patterns established here become the VedMoulya motion language for all future experiences.

---

## Motion Philosophy

| Principle        | Application                                                          |
| ---------------- | -------------------------------------------------------------------- |
| **Purposeful**   | Every animation has a function. No decorative motion.                |
| **Calm**         | Slow (300-600ms), smooth (ease-out), never jarring.                  |
| **Hierarchical** | Important elements animate first. Related elements animate together. |
| **Natural**      | Motion mimics physical world: friction, momentum, weight.            |
| **Respectful**   | Respect Reduced Motion setting. Provide static alternatives.         |

---

## Animation Parameters

| Parameter         | Default               | Exception                                                  |
| ----------------- | --------------------- | ---------------------------------------------------------- |
| **Duration**      | 300ms                 | 200ms (micro-interactions), 600ms (screen transitions)     |
| **Easing**        | ease-out              | ease-in-out (screen transitions), spring (selected states) |
| **Stagger delay** | 80ms between items    | 100ms for timeline                                         |
| **Scale**         | 0.95 → 1.0 (entrance) | 1.0 → 0.98 (press)                                         |
| **Opacity**       | 0 → 1 (fade in)       | 0.6 → 1 (hover)                                            |
| **Translate Y**   | 20px → 0 (slide up)   | 0 → -4px (lift)                                            |

---

## Screen Transitions

| Transition                     | Animation                                  | Duration | Easing                  |
| ------------------------------ | ------------------------------------------ | -------- | ----------------------- |
| Timeline → Memory Detail       | Content card scales up + slide center      | 400ms    | ease-out                |
| Memory Detail → Timeline       | Reverse: scale down + slide to position    | 350ms    | ease-out                |
| Knowledge Garden → Connections | Fade out current, fade in next             | 300ms    | ease-out                |
| Library → Memory Detail        | Slide in from right (desktop)              | 400ms    | ease-out                |
| Capture → Timeline             | Capture card slides into timeline position | 500ms    | ease-out                |
| Growth → Growth Detail         | Chart expands to full screen               | 400ms    | ease-out                |
| Search → Results               | Results fade in with staggered entrance    | 300ms    | ease-out (80ms stagger) |

---

## Component Animations

### Memory Card

| State           | Animation                       | Duration | Easing   |
| --------------- | ------------------------------- | -------- | -------- |
| Entrance        | Slide up + fade in              | 400ms    | ease-out |
| Press           | Scale to 0.98                   | 100ms    | ease-out |
| Release         | Scale to 1.0                    | 150ms    | spring   |
| Swipe (dismiss) | Follow finger, opacity fades    | >300ms   | linear   |
| Selected        | Border glow + subtle scale 1.02 | 200ms    | ease-out |

### Timeline

| Interaction        | Animation                     | Duration | Easing   |
| ------------------ | ----------------------------- | -------- | -------- |
| New memory appears | Slide in from bottom + fade   | 400ms    | ease-out |
| Scroll             | Native scroll with momentum   | —        | —        |
| Section header     | Sticky header fade            | 200ms    | ease-out |
| Year divider       | Larger gap + subtle line draw | 300ms    | ease-out |

### Knowledge Garden

| Interaction          | Animation                     | Duration | Easing                  |
| -------------------- | ----------------------------- | -------- | ----------------------- |
| Topic card entrance  | Staggered scale + fade (grid) | 400ms    | ease-out (80ms stagger) |
| Topic card hover     | Lift (Y -4px) + shadow deepen | 200ms    | ease-out                |
| Topic card expand    | Card grows, content fades in  | 400ms    | ease-out                |
| Connection line draw | Path draw animation           | 600ms    | ease-in-out             |

### Connections View

| Interaction       | Animation                           | Duration  | Easing      |
| ----------------- | ----------------------------------- | --------- | ----------- |
| Connection appear | Line draw from source to target     | 600ms     | ease-in-out |
| Node hover        | Subtle pulse (scale 1.05 → 1.0)     | 1.5s loop | ease-in-out |
| Node select       | Scale 1.1 + highlight ring          | 300ms     | ease-out    |
| Connection filter | Lines fade out, remaining re-layout | 400ms     | ease-out    |

### Life Chapters

| Interaction           | Animation                          | Duration | Easing   |
| --------------------- | ---------------------------------- | -------- | -------- |
| Chapter card entrance | Slide in from left (timeline)      | 500ms    | ease-out |
| Chapter expand        | Card expands, content reveal       | 400ms    | ease-out |
| Chapter divider       | Line draw across screen            | 600ms    | ease-out |
| Chapter auto-created  | Gentle appear with sparkle (quiet) | 500ms    | ease-out |

### Growth Charts

| Interaction       | Animation                            | Duration | Easing      |
| ----------------- | ------------------------------------ | -------- | ----------- |
| Chart entrance    | Chart draws in (progressively)       | 600ms    | ease-out    |
| Data point hover  | Dot scale to 1.5x                    | 200ms    | ease-out    |
| Time range switch | Data morphs (interpolated)           | 400ms    | ease-in-out |
| Radar overlay     | Overlay fades in, comparison appears | 400ms    | ease-out    |

### Search

| Interaction      | Animation                              | Duration | Easing                  |
| ---------------- | -------------------------------------- | -------- | ----------------------- |
| Search bar focus | Border color transition, slight expand | 200ms    | ease-out                |
| Results appear   | Staggered fade + slide up              | 300ms    | ease-out (80ms stagger) |
| Filter change    | Results cross-fade                     | 300ms    | ease-out                |
| No results       | Gentle shake (subtle, not jarring)     | 300ms    | ease-out                |

### Capture

| Interaction        | Animation                    | Duration   | Easing   |
| ------------------ | ---------------------------- | ---------- | -------- |
| Quick capture open | Slide up from bottom sheet   | 300ms      | ease-out |
| Type selector      | Icon active state transition | 200ms      | ease-out |
| Save confirmation  | Check mark draw + pulse      | 400ms      | ease-out |
| Voice recording    | Waveform bars animate        | Continuous | —        |

### Reflection

| Interaction              | Animation                        | Duration | Easing   |
| ------------------------ | -------------------------------- | -------- | -------- |
| Reflection prompt appear | Gentle fade + slide down         | 400ms    | ease-out |
| Journal type             | Smooth scroll to current line    | —        | —        |
| Save reflection          | Check mark pulse + card minimize | 400ms    | ease-out |
| Memory anniversary       | Flip card: then → now            | 600ms    | ease-out |

---

## Micro-Interactions

| Interaction    | Animation                        | Duration   | Easing   |
| -------------- | -------------------------------- | ---------- | -------- |
| Star memory    | Star fills with subtle color pop | 300ms      | ease-out |
| Bookmark       | Bookmark icon folds + fills      | 300ms      | ease-out |
| Tag add        | Tag chip scales in from 0        | 200ms      | ease-out |
| Tag remove     | Tag chip scales out              | 150ms      | ease-out |
| Share          | Share sheet slides up            | 300ms      | ease-out |
| Copy link      | Brief "Copied!" label appears    | 1.5s total | ease-out |
| Like/Gratitude | Heart fills with subtle pulse    | 300ms      | spring   |
| Expand card    | Card smoothly expands            | 400ms      | ease-out |

---

## Loading Animations

| Type               | Animation                          | Duration     | Notes               |
| ------------------ | ---------------------------------- | ------------ | ------------------- |
| Skeleton pulse     | Opacity 0.3 → 0.6 → 0.3            | 1.5s loop    | Base skeleton       |
| Staggered skeleton | Cards appear one by one            | 80ms stagger | For lists/grids     |
| Shimmer            | Gradient sweep across skeleton     | 2s loop      | For charts only     |
| Progress bar       | Indeterminate: back and forth      | 1.5s loop    | For sync/save       |
| Spinner            | Rotating arc (45° start, 270° arc) | 1s loop      | Minimal, small size |

---

## Accessibility (Reduced Motion)

| Setting                | Behavior                                                   |
| ---------------------- | ---------------------------------------------------------- |
| **Reduced Motion ON**  | All animations disabled. Instant transitions. No parallax. |
| **Skeleton**           | Static skeleton without pulse animation                    |
| **Screen transitions** | Instant cross-fade (no slide/scale)                        |
| **Hover effects**      | Color change only (no scale/lift)                          |
| **Micro-interactions** | Icon state change only (no animation)                      |
| **Loading**            | Static progress bar (no shimmer)                           |
| **Spinner**            | Static indicator dot (no rotation)                         |

---

## Performance

| Metric                 | Target                                                         |
| ---------------------- | -------------------------------------------------------------- |
| **Frame rate**         | 60fps (target 120fps on ProMotion)                             |
| **GPU usage**          | Minimal — prefer opacity/transform only                        |
| **Layout thrash**      | Zero — only animate compositor properties (opacity, transform) |
| **JS thread blocking** | No animation should block the main thread                      |
| **Memory**             | No animation memory leaks                                      |

---

## Cross-References

| Document         | Relationship                                                        |
| ---------------- | ------------------------------------------------------------------- |
| DES-001 v1.0     | Design Constitution — motion philosophy, reduced motion             |
| DES-003A v1.1    | Dashboard — Dashboard Animations (D13) motion language extends here |
| D02 Timeline     | Timeline card animations                                            |
| D03 Garden       | Garden card and connection animations                               |
| D04 Connections  | Connection line draw animations                                     |
| D05 Chapters     | Chapter timeline animations                                         |
| D06 Details      | Memory detail card animations                                       |
| D07 Search       | Search result and filter animations                                 |
| D08 AI Assistant | AI typing indicator animation                                       |
| D09 Capture      | Capture overlay and save animations                                 |
| D10 Reflection   | Reflection journal and anniversary animations                       |
| D11 Growth       | Growth chart entrance and morph animations                          |
| D12 States       | Loading skeleton and error animations                               |
