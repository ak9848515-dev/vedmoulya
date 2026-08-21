# SPRINT-034 — UX AUDIT

**Founder Command Center · existing design system · no redesign**

---

## 1. Scope

The Command Center (`apps/web/src/components/CommandCenter.tsx`) reuses the
VedMoulya design system (violet `#7C3AED` accents, `#F8FAFC`/`#E2E8F0` cards,
`text-[10px]…text-[16px]` type scale, rounded-xl surfaces) — the same language
as WorldPanel and the AICompanion. No redesign, no new design tokens.

## 2. Layout

- **Desktop:** tabbed command center (TODAY / PORTFOLIO / INTELLIGENCE /
  AUTOMATION / APPROVALS) with dense but grouped cards; counts on tabs
  (pending approvals badge); clear hierarchy: section header → cards →
  microcopy.
- **Mobile:** tabs wrap and remain ≥40px touch targets; content stacks with no
  information loss; long values truncate.

## 3. Honesty in the UI

- **UNKNOWN / UNAVAILABLE / ERROR / NEEDS_REVIEW** are shown where data is not
  verified: signal sources report "UNAVAILABLE/ERROR — never fabricated";
  the ranking empty state says "UNKNOWN cost is never treated as zero";
  revenue figures are labelled "Estimates only — never a revenue promise."
- **No fabricated urgency:** TODAY with an empty briefing shows "nothing urgent
  needs attention. (No spam by design.)"
- **Fail-closed posture:** emergency-stop banner + "autonomy settings are not
  confirmed" notice render whenever the control plane reports them.
- **No unsupported certainty:** every recommendation answers WHAT / WHY /
  EVIDENCE / COST / RISK / NEXT ACTION; unsupported values are never printed
  as facts.

## 4. Approvals UX

- Each pending request exposes action, risk chip (LOW/MEDIUM/HIGH/UNKNOWN),
  reason, provider, estimated cost, reversibility, authority required and
  expected outcome.
- Approve/Reject buttons disable while a decision is in flight; a refusal from
  the Brain authority is surfaced verbatim (`role="alert"`), and a rejected
  request is never presented as executed or approved.
- Footer microcopy: "Approvals route through the existing authority (the
  Brain) — no voice shortcut, no implicit approval."

## 5. Accessibility

- `role="tablist"` / `role="tab"` / `aria-selected` / `role="tabpanel"`.
- `aria-label` on icon buttons (Refresh, tabs); `role="alert"` on errors.
- Focus-visible rings on all interactive elements.
- Keyboard-operable tabs and buttons.

## 6. Status

IMPLEMENTED + TESTED (11 component tests: tabs, no-spam, emergency stop,
UNKNOWN-cost honesty, signal honesty, approvals routing, rejection passthrough,
error + retry, boundary notice). FUTURE: drill-downs (per-stream cost/revenue
detail), timeline views, cost charts, voice presentation of the Command Center
(voice can present, never approve).
