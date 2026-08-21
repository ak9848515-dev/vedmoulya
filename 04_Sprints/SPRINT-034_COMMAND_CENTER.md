# SPRINT-034 — COMMAND CENTER

**VedMoulya Founder Command Center — presentation/composition only**

---

## 1. What it is

The Founder Command Center (`apps/web/src/components/CommandCenter.tsx`,
mounted in the AICompanion) is the first real **founder-facing surface** of the
platform. It is **presentation and composition ONLY**: it consumes the EXISTING
read models (world overview, founder briefing, revenue snapshot, opportunity
pipeline, control-plane posture, blueprint approvals, cost) through the EXISTING
`world.*` gateway procedures. It creates no intelligence engine and duplicates
no data logic.

## 2. Sections

### A. TODAY

- FounderBriefing content (pending approvals, attention lines, what-changed).
- No-spam: when the briefing has no content, TODAY shows _"nothing urgent needs
  attention"_ — it never fabricates urgency.
- Emergency-stop banner + unconfirmed-autonomy notice (fail-closed posture).

### B. PORTFOLIO

- Business units, revenue streams, pipeline opportunities, measured cost/day.
- Estimated monthly revenue (evidence-backed only; _"never a promise"_ label).
- **Cost-weighted revenue ranking** — margin/ROI-aware ordering, never pure
  revenue; empty state says _"UNKNOWN cost is never treated as zero."_

### C. INTELLIGENCE

- World entity/relation counts (bounded graph) and world-signal status.
- Honest signal reporting: _"No live world-data source is reachable — status is
  UNAVAILABLE/ERROR, never fabricated."_

### D. AUTOMATION

- Defined workflows + blueprint approval requests (status chips).
- Boundary notice: _"Blueprints never execute — execution stays with the
  existing bridge after approval."_

### E. APPROVALS

- Pending blueprint approval requests exposing ACTION / REASON / BUSINESS /
  WORKFLOW / STEP / PROVIDER / ESTIMATED COST / DATA SCOPE / RISK / EXPECTED
  OUTCOME / REVERSIBILITY / AUTHORITY REQUIRED.
- Approve / Reject buttons call **`world.decideBlueprintApproval`**, which
  routes ONLY through the existing Brain approval authority. The UI itself can
  neither approve nor execute: a rejection from the authority is surfaced
  verbatim and nothing is reported as executed.
- Footer: _"Approvals route through the existing authority (the Brain) — no
  voice shortcut, no implicit approval."_

## 3. UX rules

- Existing VedMoulya design system (violet accents, rounded cards, same type
  scale as WorldPanel). No redesign.
- Tabs are touch-friendly (rounded pills, ≥40px targets), stack on mobile.
- Keyboard + `aria-selected` tablist, `role="alert"` error surfaces,
  live-region-friendly wording.
- No unsupported certainty: the UI prints UNKNOWN / UNAVAILABLE / ERROR /
  NEEDS_REVIEW where the data is not verified.
- Every recommendation is framed WHAT / WHY / EVIDENCE / COST / RISK /
  NEXT ACTION; nothing claims execution, spending or authorization by the UI.

## 4. Boundary guarantees (structural + tested)

- `CommandCenter` has no execute/spend/approve path of its own — the only
  mutating call is `world.decideBlueprintApproval` (→ Brain authority).
- The boundary notice _"the command center never executes, spends or
  authorizes by itself"_ is always rendered (tested).
- A rejected approval is never displayed as executed or approved (tested).

## 5. Status

IMPLEMENTED + TESTED (11 component tests). FULL PRODUCT UX (drill-downs,
timeline, cost charts) remains FUTURE — the Command Center is the read-model
surface the future product builds on.
