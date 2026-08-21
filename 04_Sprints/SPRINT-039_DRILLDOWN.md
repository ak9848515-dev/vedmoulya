# SPRINT-039 — COMMAND CENTER DRILL-DOWNS & VOICE PRESENTATION

**Presentation-only read model over the existing estate** · 2026-08-15

## Opportunity drill-down (Part L)

`world.opportunityDrilldownView` returns, for ONE problem, a bounded read model:
problem + assessment + observations + prospects + experiments + provider
economics + next best action + revenue state + verified-payment count — every
section advisory-only, owner-scoped, nothing that spends/approves/executes.

## Command Center UX

In the Command Center INTELLIGENCE tab, each opportunity radar entry is now
expandable (SPRINT-039 drill-down):

- **Evidence** — the observations with state + provenance source (EMPTY shown
  honestly: "No observations recorded yet — EMPTY by design.")
- **Prospects** — the customer-discovery records with status + segment
- **Next action** — the explainable advisory (STOP included) with capital mode
- Plus the existing assessment/experiment/provider-economics surfaces

The drill-down is presentation/composition ONLY — it renders the existing
`world.opportunityDrilldownView` read model and adds no decision surface.

## Voice read-only presentation

The existing `CommandCenterQuestionRouter` (SPRINT-035) gained SPRINT-039
questions over the evidence loop: "what evidence do we have / show me the
evidence / which opportunity has the strongest payment evidence / …". Answers
come from the read-only `CommandCenterPresentationPort` — deterministic routing,
no side effects. **VOICE ≠ AUTHORIZATION** is structurally preserved: a voice
question can never approve, spend, execute or calibrate.
