# SPRINT-039 — UX AUDIT

**Command Center drill-down + voice presentation review** · 2026-08-15

## What changed

- **INTELLIGENCE tab** — each opportunity radar entry is now expandable to a
  drill-down: Evidence (observations with state + provenance source) ·
  Prospects (discovery records with status + segment) · next action · existing
  assessment/experiment/provider surfaces.
- **Voice** — read-only answers to evidence questions ("what evidence do we
  have", "show me the evidence", "which opportunity has the strongest payment
  evidence").

## Honest-empty UX

The drill-down renders **"No observations recorded yet — EMPTY by design."** and
**"No customer discovery records yet — EMPTY by design."** when the ledger is
empty — the founder is never shown fabricated evidence or fake progress. This is
a deliberate product decision: the evidence loop ships EMPTY until real
observations are entered.

## Presentation-only boundary

The drill-down is a presentation/composition surface only: it renders the
existing read model, adds no decision surface, and never shows a spend/approve/
execute affordance on the evidence loop. Voice stays read-only
(VOICE ≠ AUTHORIZATION).

## Consistency

- Existing design system + expandable-card pattern from SPRINT-035 drill-downs.
- Plain-language labels ("Evidence (N)" / "Prospects (N)") with honest counts.
- Expand state stays a `ReadonlySet` (lint-clean); a11y patterns unchanged.

## Verdict

No UX regressions; CommandCenter test suite green (16 tests). The honest-empty
copy is the correct treatment for a data-collection surface that must never
fabricate.
