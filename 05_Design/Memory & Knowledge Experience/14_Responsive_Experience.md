# Responsive Experience

> **Document:** DES-004-D14 — Memory & Knowledge Experience  
> **Status:** 🔒 **LOCKED** — Part of DES-004 Memory Constitution v1.0  
> **Design Constitution:** DES-001 v1.0 · DES-002A v1.0 · DES-003A v1.1

---

## Purpose

The Memory & Knowledge Experience must feel native and intentional on every device — from foldables to ultra-wide desktops. Responsive behavior should never feel like "mobile version" or "tablet version." Every layout should feel purpose-designed for that form factor.

**Why it exists:** Users access VedMoulya across devices and contexts. A consistent, adapted experience builds trust and reduces cognitive load when switching devices.

**How it connects:** Every experience (Timeline, Garden, Connections, Search, Capture, Reflection, Growth) has responsive specifications defined here.

**What it changed:** Without responsive specifications, each screen would be designed independently, creating inconsistency and usability issues.

**How it influenced later decisions:** Responsive patterns established here become the template for all future VedMoulya experiences.

---

## Device Breakpoints

| Category                | Width           | Layout Columns                  | Examples                      |
| ----------------------- | --------------- | ------------------------------- | ----------------------------- |
| **Mobile**              | < 480px         | 4 columns                       | iPhone SE to iPhone Pro Max   |
| **Tablet portrait**     | 480px – 768px   | 8 columns                       | iPad Mini, iPad, Galaxy Tab   |
| **Tablet landscape**    | 768px – 1024px  | 8 columns                       | iPad, Surface Pro (landscape) |
| **Laptop**              | 1024px – 1440px | 12 columns                      | MacBook Air, Surface Laptop   |
| **Desktop**             | 1440px – 1920px | 12 columns (max 1280px content) | iMac, external monitors       |
| **Ultra-wide**          | > 1920px        | 12 columns (1280px centered)    | 32"+ monitors                 |
| **Foldable (unfolded)** | 600px – 800px   | 8 columns                       | Galaxy Fold, Pixel Fold       |
| **Foldable (folded)**   | < 480px         | 4 columns                       | Folded outer display          |

---

## Adaptive Layout Rules

### Mobile (< 480px)

| Principle             | Application                                                  |
| --------------------- | ------------------------------------------------------------ |
| **Single column**     | All content in single vertical scroll                        |
| **Full-width**        | Cards use full width minus 16px padding each side            |
| **Bottom navigation** | Tab bar for: Timeline · Garden · Search · Capture · Settings |
| **Overlays**          | Full-screen sheets for detail views                          |
| **Swipe gestures**    | Swipe back (detail→list), swipe to dismiss (capture)         |
| **Touch targets**     | Minimum 44x44px for all interactive elements                 |
| **Reduced content**   | Show less items, space them more generously                  |

### Tablet (480px – 1024px)

| Principle                  | Application                                      |
| -------------------------- | ------------------------------------------------ |
| **Dual column**            | 2-column grid for cards, or master-detail split  |
| **Sidebar**                | Collapsible sidebar for navigation               |
| **Split view**             | Memory list + detail panel side by side          |
| **Adaptive cards**         | Cards 1.5x standard width                        |
| **Hover states**           | Add hover (finger-compatible taps still primary) |
| **Landscape optimization** | 3-column grid in landscape                       |

### Laptop / Desktop (1024px – 1920px)

| Principle              | Application                                      |
| ---------------------- | ------------------------------------------------ |
| **Full layout**        | 3-zone: sidebar + content + detail/insight panel |
| **Multi-column**       | 3-column grid for garden, 3-column timeline      |
| **Hover interactions** | Rich hover: lifts, previews, tooltips            |
| **Keyboard shortcuts** | Full keyboard navigation (Cmd+K, arrows, Escape) |
| **Context menus**      | Right-click for quick actions                    |
| **Sidebar**            | Persistent left sidebar with navigation          |

### Ultra-wide (> 1920px)

| Principle               | Application                            |
| ----------------------- | -------------------------------------- |
| **Centered content**    | 1280px max-width container, centered   |
| **Side panels**         | Additional context panels on the sides |
| **Comfortable spacing** | Increased whitespace proportionally    |

### Foldable

| Principle           | Application                                                |
| ------------------- | ---------------------------------------------------------- |
| **Unfolded**        | Behave like tablet, account for hinge gap (16px safe zone) |
| **Folded**          | Behave like mobile                                         |
| **Hinge-sensitive** | Content avoids hinge zone                                  |
| **Spanning**        | Content intelligently spans both screens when unfolded     |
| **Transition**      | Smooth animation when folding/unfolding                    |

---

## Screen-Specific Responsive Layouts

### Memory Timeline

| Device               | Layout                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------- |
| **Mobile**           | Single column scroll, cards full-width, tap for detail                                  |
| **Tablet portrait**  | 2-column card grid, tap for overlay detail                                              |
| **Tablet landscape** | Master-detail: timeline list (left) + selected memory (right)                           |
| **Desktop**          | Master-detail: timeline list (left, 400px), preview (center), AI insights (right panel) |
| **Ultra-wide**       | Same as desktop, centered 1280px, extra whitespace                                      |

### Knowledge Garden

| Device               | Layout                                           |
| -------------------- | ------------------------------------------------ |
| **Mobile**           | Single column cards, tap to expand               |
| **Tablet portrait**  | 2-column card grid                               |
| **Tablet landscape** | 3-column card grid                               |
| **Desktop**          | 3-column main grid + topic detail panel on right |
| **Ultra-wide**       | 4-column grid, centered 1280px                   |

### Connections View

| Device               | Layout                                                        |
| -------------------- | ------------------------------------------------------------- |
| **Mobile**           | Simplified list view (connections as cards), toggle to visual |
| **Tablet portrait**  | Mini visual map (simplified), tap node for details            |
| **Tablet landscape** | Full visual map (reduced complexity), list panel on side      |
| **Desktop**          | Full visual map with controls, focus node detail panel        |
| **Ultra-wide**       | Full visual map with more visible connections                 |

### Life Chapters

| Device               | Layout                                                         |
| -------------------- | -------------------------------------------------------------- |
| **Mobile**           | Vertical timeline, tap chapter to expand                       |
| **Tablet portrait**  | Vertical timeline with chapter previews                        |
| **Tablet landscape** | Side-by-side: chapter list + expanded content                  |
| **Desktop**          | Horizontal timeline with rich chapter cards + detail on select |
| **Ultra-wide**       | Same as desktop, more visible timeline range                   |

### Search

| Device               | Layout                                                       |
| -------------------- | ------------------------------------------------------------ |
| **Mobile**           | Full-screen search, results list, tap for detail             |
| **Tablet portrait**  | Overlay search, results list + quick preview                 |
| **Tablet landscape** | Overlay search, split results + detail                       |
| **Desktop**          | Full search view: filters sidebar + results + detail preview |
| **Ultra-wide**       | Same as desktop with more result columns                     |

### Capture

| Device         | Layout                                               |
| -------------- | ---------------------------------------------------- |
| **Mobile**     | Full-screen bottom sheet, simplified options         |
| **Tablet**     | Centered overlay modal, all capture types            |
| **Desktop**    | Centered modal, full capture interface with AI panel |
| **Ultra-wide** | Same as desktop, AI panel visible alongside          |

### Reflection

| Device               | Layout                                               |
| -------------------- | ---------------------------------------------------- |
| **Mobile**           | Full-screen journal, swipe between prompts           |
| **Tablet portrait**  | Journal with memory reference panel                  |
| **Tablet landscape** | Journal + memory reference side by side              |
| **Desktop**          | Journal focus with optional timeline reference panel |
| **Ultra-wide**       | Journal centered 720px, timeline reference on side   |

### Growth

| Device               | Layout                                           |
| -------------------- | ------------------------------------------------ |
| **Mobile**           | Single chart at a time, swipe between dimensions |
| **Tablet portrait**  | 2x2 chart grid                                   |
| **Tablet landscape** | Overview top + 3 charts below                    |
| **Desktop**          | 4-chart grid + radar + key insight panel         |
| **Ultra-wide**       | 6-chart grid with radar prominently featured     |

---

## Portrait vs Landscape

| Aspect              | Portrait                | Landscape                |
| ------------------- | ----------------------- | ------------------------ |
| **Content density** | Less dense, more scroll | More dense, less scroll  |
| **Navigation**      | Bottom tab bar          | Sidebar + top bar        |
| **Cards**           | Full-width cards        | Grid layout              |
| **Detail views**    | Full-screen overlay     | Side panel               |
| **Gestures**        | Swipe for navigation    | Hover + click + keyboard |
| **Tooltips**        | Tap to show             | Hover to show            |

---

## Touch vs Pointer

| Interaction       | Touch                 | Mouse/Trackpad          | Stylus       |
| ----------------- | --------------------- | ----------------------- | ------------ |
| **Select**        | Tap                   | Click                   | Tap          |
| **Context menu**  | Long press (500ms)    | Right-click             | Long press   |
| **Preview**       | Force touch or swipe  | Hover                   | Hover        |
| **Drag**          | Touch and hold + drag | Click and drag          | Drag         |
| **Swipe dismiss** | Swipe left/right      | —                       | —            |
| **Scroll**        | Finger swipe          | Scroll wheel / trackpad | Scroll swipe |
| **Zoom (garden)** | Pinch                 | Scroll wheel + Cmd      | Pinch        |

---

## Accessibility in Responsive

| Requirement               | Implementation                                                  |
| ------------------------- | --------------------------------------------------------------- |
| **Zoom**                  | Text scales up to 200% without breaking layouts                 |
| **Orientation lock**      | Content works in both orientations                              |
| **Keyboard on mobile**    | External keyboard support when connected                        |
| **Touch target resizing** | Minimum 44x44px regardless of device density                    |
| **Focus indicator**       | Visible focus ring on all interactive elements, all devices     |
| **Landscape content**     | No content hidden in landscape — same content, different layout |
| **Split screen**          | VedMoulya works in 50/50 split screen on tablets                |
| **Picture in picture**    | AI Assistant can float in PiP on tablets                        |

---

## Performance per Device

| Metric             | Mobile                 | Tablet | Desktop                  |
| ------------------ | ---------------------- | ------ | ------------------------ |
| Timeline load      | <2s (4G), <1s (cached) | <1.5s  | <1s                      |
| Garden load        | <2s                    | <1.5s  | <1s                      |
| Connections render | <3s (simplified)       | <2s    | <1s                      |
| Search results     | <1s                    | <1s    | <500ms                   |
| Capture save       | <1s                    | <500ms | <500ms                   |
| Chart render       | <1s                    | <500ms | <300ms                   |
| Animation fps      | 60fps                  | 60fps  | 60fps (120fps ProMotion) |

---

## Cross-References

| Document         | Relationship                                                |
| ---------------- | ----------------------------------------------------------- |
| DES-001 v1.0     | Design Constitution — responsive grid, breakpoints, spacing |
| DES-003A v1.1    | Dashboard — Responsive Dashboard (D14) patterns extend here |
| D02 Timeline     | Timeline responsive layout specifications                   |
| D03 Garden       | Garden responsive grid specifications                       |
| D04 Connections  | Connections view responsive behavior                        |
| D05 Chapters     | Chapter timeline responsive layout                          |
| D06 Details      | Memory detail responsive views                              |
| D07 Search       | Search responsive behavior                                  |
| D08 AI Assistant | AI Assistant responsive placement                           |
| D09 Capture      | Capture responsive overlay                                  |
| D10 Reflection   | Reflection responsive journal                               |
| D11 Growth       | Growth chart responsive grid                                |
| D13 Animations   | Responsive animation adjustments                            |
