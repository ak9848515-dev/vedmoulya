# SPRINT-033 — UX PLAN

**VedMoulya — the Founder Command Center (Part G)**

---

## 1. Implemented now (minimal, existing design system)

SPRINT-033 does NOT rebuild the UI. The existing **WorldPanel** (MY WORLD, in
the AICompanion) is extended with two evidence-only cards using the existing
slate/violet tokens:

1. **FOUNDER BRIEFING** (advisory, no-spam) — rendered only when
   `hasContent:true`:
   - pending-approval count
   - high-risk opportunity count (needs review)
   - emergency-stop notice
   - unconfirmed-autonomy-settings notice
   - footer: "Advisory only — nothing here approves, spends or executes."
2. **Revenue snapshot** (evidence-only) — rendered when revenue streams exist:
   - active/total stream counts
   - estimated monthly revenue (INR presentation) — only when evidence exists
   - advisory margin % — only when computed from evidence
   - automation % — only when evidence exists
   - footer: "Evidence-only figures — never a promise."

Both cards are keyboard/aria-accessible and mobile-friendly, consistent with
the rest of the companion.

## 2. Planned — the future Founder Command Center (FUTURE, not built)

The full command center is a FUTURE product surface (SPRINT-034+). The plan:

**TODAY**

- important events · opportunities · risks · pending approvals ·
  business performance · workflows running · failures · recommendations

**PORTFOLIO**

- businesses · revenue · costs · growth · health

**INTELLIGENCE**

- discoveries · trends · opportunities · recommendations

**AUTOMATION**

- workflows · executions · failures · human interventions

**APPROVALS**

- pending decisions · sensitive actions · business launches · spending

## 3. Design principles (unchanged)

- One design system (slate/violet tokens, lucide icons, focus-visible rings,
  mobile bottom-sheets).
- Advisory-first: every surface states what it is (advisory / evidence-only /
  requires approval) and never claims execution or authorization.
- Honest statuses: UNAVAILABLE / UNKNOWN / evidence-only / no-spam — no
  false-success wording, no income promises.
- The command center READS the existing estate (briefing, pipeline, revenue
  snapshot, control posture) — it is a presentation layer, not an engine.
