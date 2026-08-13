# EPIC-010 — Design System & Visual Intelligence

> **Status:** IMPLEMENTED + TESTED (browser verification pending for rendered
> generated output — see Completion Report)
> **Date:** 2026-08-09
> **Workspace:** `@vedmoulya/experience` (`packages/experience`)

## 1. Architecture

```
EPIC-009 DesignSpecification (optional) ──┐
Archetype Experience Knowledge (catalog) ─┤
                                          ▼
                      ┌───────────────────────────────────┐
                      │ ExperienceEngine (orchestrator)   │
                      └──┬────────┬─────────┬────────┬────┘
                         ▼        ▼         ▼        ▼
                 DesignSystem  DesignDec  UIBlue   VisualCritic
                 Engine        isionEng   printEn  Engine
                               ine        gine       │
                                        │           ▼
                                        │      QualityEvaluator
                                        │           │
                                        ▼           ▼
                                  StateIntell   EvidenceClassifier
                                  Responsive      │
                                  Accessibility  ▼
                                        │     RefinementPlanner
                                        ▼           │
                                  TraceabilityEngine│
                                                    ▼
                                        experience.* tRPC → Quality center UI
```

All engines are deterministic and provider-neutral. Optional AI critique flows
through a narrow port over the frozen AI runtime (not implemented in this
epic's engine core — documented as the follow-up seam).

## 2. Design System (Phase 1)

`ApplicationDesignSystem` is **structured and tokenized** — never scattered
arbitrary styling:

- `tokens: DesignToken[]` — each token has `id` (`color.primary`, `space.md`,
  `radius.card`, `type.h1`), `group` (typography | color | spacing | radius |
  elevation | surface | component), `value`, `source`
  (DESIGN_SPEC | ARCHETYPE | SYSTEM), and `rationale`.
- `components: ComponentStyleSpec[]` — per-component key behavioral decisions
  for button, form, navigation, card, table, dialog, notification, badge,
  chart, empty/loading/error states.
- `byGroup` — structured token groups for tooling (theme generation).

`DesignSystemEngine.derive` merges the archetype baseline with any EPIC-009
`DesignSpecification`: the declared `visualPersonality` and `colorSystem`
override the archetype defaults (source = DESIGN_SPEC); the rest defaults from
the archetype (source = ARCHETYPE).

## 3. Domain-Aware Visual Strategy (Phase 2)

The catalog maps every frozen factory archetype to a concrete visual system:

| Archetype        | Personality                                        | Direction                                                                                                                           |
| ---------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `restaurant-app` | Visual, warm, product-focused                      | Warm appetizing palette, large imagery, big touch targets for one-handed mobile ordering; status colors always accompanied by text. |
| `abap-debugger`  | Professional, dense, diagnostic, developer-focused | Information-dense diagnostics, severity-colored chips, monospaced source, keyboard-operable textarea; severity never color-only.    |
| `generic-web`    | Clear, structured, adaptable                       | Neutral structured baseline with domain-flavored accents.                                                                           |
| `ai-app-builder` | Precise, flow-focused, structured                  | Builder-oriented flows; clear hierarchy for plans/approvals.                                                                        |

No universal visual template: each archetype carries its own token baseline,
component decisions, screen blueprint, and domain-appropriateness rule.

## 4. Design Decisions (Phase 3)

`DesignDecision` records discrete decisions: `id` (`DESIGN-001`), `decision`,
`rationale`, `source` (DESIGN_SPEC | ARCHETYPE | CRITIC | USER | SYSTEM),
`alternatives`, `confidence` (0..1), `affectedComponents`, and an optional
linked EPIC-009 design dimension. Every decision is traceable.

## 5. UI Blueprint (Phase 4)

`UIBlueprint` defines, before any code, the application's screen structure:
`screens` (id, route, title, sections, states, accessibility requirements),
`navigation` (nav items + primary action), `components` (shared surface
components), `responsive` behavior, `states`, `interactions`, and
`accessibility` requirements. Example (restaurant): Dashboard → Menu → Cart →
Checkout → Confirmation → Admin, each with its own state set.

## 6. State Intelligence (Phase 5)

`ScreenStateSpec` covers every important state per screen: LOADING, EMPTY,
SUCCESS, ERROR, PARTIAL, OFFLINE, UNAUTHORIZED, FORBIDDEN, VALIDATION_ERROR —
not just the happy path. Screens declare the states they genuinely need (e.g.
the admin dashboard declares UNAUTHORIZED/FORBIDDEN; the menu declares OFFLINE).

## 7. Responsive Intelligence (Phase 6)

`Breakpoint` (mobile/tablet/desktop) + `ResponsiveBehavior` per important
component: mobile behavior, tablet behavior, desktop behavior — explicitly
defined, never "just shrink the desktop layout".

## 8. Accessibility (Phase 7)

`AccessibilityEngine` emits per-screen accessibility requirements
(keyboard navigation, focus states, semantic structure, labels, contrast,
screen-reader support, touch-target sizing, reduced motion) and an
`auditProject` code check (deterministic static analysis of generated files):
`tabIndex` present, `nav/main/section` semantics, `aria-label`/`label`,
contrast tokens, `aria-live` for dynamic regions, min-height 44px touch
targets, and `prefers-reduced-motion` handling.

## 9. Provider Neutrality & the AI Seam

- No provider SDKs anywhere in the workspace.
- The design system, blueprint, critic, quality, and refinement engines are
  pure deterministic logic over typed inputs.
- Optional AI-powered critique would flow through a narrow port (the same
  `AIOrchestratorSpecialistPort` pattern the loop/factory use) — this is the
  documented follow-up, not a current dependency.
