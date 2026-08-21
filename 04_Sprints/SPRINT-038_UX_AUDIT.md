# SPRINT-038 — UX AUDIT

**Opportunity Radar in the existing Founder Command Center — no UI rebuild**

## What was added

The **OPPORTUNITY RADAR** section in the Command Center's INTELLIGENCE tab
(web `CommandCenter.tsx`), fed by `world.opportunityRadar` (presentation-only
read model — no new intelligence engine).

## Sections

The radar groups problems by lifecycle stage with counts:

- New Problems · Validated Problems · High-Value Problems
- Experiment Candidates · Running Experiments · Completed Experiments
- Payment Evidence · Business Candidates · Rejected Opportunities

Each entry exposes: WHAT (problem statement) · status · revenue state · level
(label) · three advisory scores · evidence count · verified-payment flag ·
STOP reason (when the system says "do not build this") · NEXT ACTION
(advisory text).

## Honest states

- **UNKNOWN** — scores with no evidence-backed factors display as 0 with a
  rationale saying UNKNOWN (never fabricated).
- **UNAVAILABLE** — world signals with no configured source report UNAVAILABLE.
- **NEEDS_REVIEW** — conflicting/incomplete evidence paths keep the problem in
  NEEDS_REVIEW for a human.
- STOP recommendations display the concrete reason.

## Design system

Uses the existing VedMoulya design tokens/cards (same patterns as the other
Command Center sections). Desktop: information-dense cards. Mobile: stacked,
touch-friendly. No redesign of the application.

## Accessibility / states

- Loading, empty, error, UNKNOWN, UNAVAILABLE states use the established
  patterns (existing Command Center tests cover the radar render + error
  recovery).
- Keyboard + ARIA + live-region conventions follow the existing panels.

## Tests

`CommandCenter.test.tsx` (15 tests) covers the radar render with mocked
`world.opportunityRadar`, radar-specific empty/loading states and the
signal-specific honesty footer.
