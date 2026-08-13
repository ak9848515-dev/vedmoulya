# EPIC-009 — Design Intelligence

**Date:** 2026-08-09 · **Part of:** EPIC-009 Product Intelligence & Requirements Engine

---

## 1. The principle

> Do NOT default every application to a chatbot UI. Choose the interaction model
> from the requirements. Design must be application-specific.

## 2. Experience strategy (Phase 14)

`ExperienceStrategyEngine` picks a primary interaction model from the
requirement profile — dashboard, chat, copilot, wizard, workflow, canvas,
editor, search, command center, mobile-first workflow, or structured form —
with `reasons`, `alternatives` (with tradeoffs), `screens`, and `navigation`.

Examples from the catalog:

- **Restaurant ordering** → mobile-first workflow + dashboard (browse → cart →
  checkout → track; admin dashboard).
- **ABAP debugger** → focused, information-dense editor + chat assistant.
- **Finance dashboard** → analytical dashboard + structured forms.
- **AI support** → chat + copilot with escalation workflows.
- **Enterprise workflow** → workflow + dashboard with approval routing.

The engine records the model choice and its reasons so the user can inspect
**why** the experience was designed that way.

## 3. Design specification (Phase 15)

`DesignIntelligenceEngine` produces a `DesignSpecification` **before code
generation**, covering: visual personality, target audience, brand direction,
color system, typography, spacing, components, iconography, motion, responsive
strategy, accessibility, interaction states, empty states, loading states, and
error states.

Design personalities are per-archetype and declarative (in the catalog):

| Archetype     | Personality                                |
| ------------- | ------------------------------------------ |
| Restaurant    | visual / warm / product-focused            |
| ABAP debugger | focused / professional / information-dense |
| Finance       | trustworthy / clear / analytical           |
| Education     | friendly / engaging / accessible           |
| AI builder    | premium / capable / guided                 |

No proprietary design of any other product is copied; the personalities adopt
only general, proven patterns from modern AI application-builder UX.

## 4. States as first-class citizens

The design specification explicitly plans empty / loading / error / interaction
states — so generated applications never show raw stack traces or blank screens.
The UI surfaces these plans in the Design panel of the Product Builder.

## 5. Why this matters for the factory

The `DesignSpecification` (with the `ProductBrief` and `ExperienceStrategy`)
is handed to the Application Factory as the design contract for generation —
the factory's blueprint consumes the same structured product language, so the
generated app inherits the agreed experience instead of inventing one.
