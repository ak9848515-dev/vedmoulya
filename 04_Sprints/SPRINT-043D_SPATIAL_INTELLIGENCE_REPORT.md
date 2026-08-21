# SPRINT-043D — SPATIAL INTELLIGENCE — PHASE 2 (PRESENTATION) REPORT

**Opportunity Radar (SVG) + Digital Twin (SVG) + Command Center List ↔ Radar toggle**

**Status:** ✅ **CONTINUATION SPRINT (2026-08-17) — presentation layer finished over the verified 043D mapping foundation**
**NEW ENGINES CREATED: 0**

---

## 1. Executive Verdict

**🟢 GREEN.** The 043D spatial presentation layer is finished: a deterministic 2D/SVG
**Opportunity Radar** (opportunity · importance · evidence state · STOP · UNKNOWN ·
category · selection — no invented relationships or scores) and an honest **Digital Twin**
(operating state, NOT an avatar — UNKNOWN stays UNKNOWN, missing is never a 0-score), both
consuming the verified `lib/spatial/radar-mappings.ts` mapping layer exclusively, plus the
Command Center **List ↔ Radar** presentation toggle over the SAME already-fetched data (no new
route, no new data-fetching, no duplicate gateway calls).

One genuine defect was found during continuation and fixed minimally: **D1 — a
rules-of-hooks violation in `DigitalTwinSpatial.tsx`** (`useMemo`/`useState` after a
conditional early return). In the Command Center the twin starts with empty dimensions
(FORMING) and becomes populated after reads load — the hook count changed between renders,
which crashes React ("Rendered more hooks than during the previous render"). Fixed by hoisting
all hooks above the early return; a regression test (forming → populated re-render) covers it,
and the Command Center integration test now exercises the exact data-flow path.

**Honest scope labels:** mapping 15/15 PASS · spatial component tests 12/12 PASS · web suite
321/321 PASS · typechecks root/web/api/identity/world-model **0** · scoped lint **0/0** ·
`next build` **PASS (58/58)** · opportunity benchmark 20/20 PASS · **browser verification
NOT EXECUTED (OPERATOR REQUIRED — gateway not running in this environment; DOM behaviour is
covered by jsdom + Testing Library)** · full benchmarks chain NOT EXECUTED (no harness touched).

## 2. Existing 043D State

On takeover the following was already in the working tree (untracked WIP):

- `apps/web/src/lib/spatial/radar-mappings.ts` + `__tests__/radar-mappings.test.ts` — **the
  mapping layer, VERIFIED 15/15 PASS** (opportunity categorization, deterministic angle,
  radial band, visual sizing, evidence-only opacity, STOP-first ordering, Digital-Twin
  honesty invariants).
- `apps/web/src/components/spatial/OpportunityRadarSpatial.tsx` — WIP, largely complete.
- `apps/web/src/components/spatial/DigitalTwinSpatial.tsx` — WIP **with the hooks-order
  violation described in §1**.
- `apps/web/src/components/spatial/__tests__/*` — 5 + 5 component tests.
- `apps/web/src/components/CommandCenter.tsx` — WIP already mounting `OpportunityRadarSpatial`
  behind a List/Radar toggle and `DigitalTwinSpatial` in the INTELLIGENCE tab.
- No SPRINT-043D report existed.

Nothing was restarted; the sprint was continued from this verified state.

## 3. Mapping Layer

`lib/spatial/radar-mappings.ts` (156 lines) is the single authoritative state→visual mapping
source: `categorizeRadarEntry` (STOP/VERIFIED/OBSERVED/UNKNOWN from authoritative fields
only), `radarAngleDeg` (deterministic hash angle), `radarRadius` (category band), `radarSizePx`
(0..1 score → 10..26 px, clamped), `radarOpacity` (evidence presence only), `radarEvidenceLabel`
(never overstates), `radarSortEntries` (STOP→VERIFIED→OBSERVED→UNKNOWN), `radarColor` (043B
semantic tokens + textual label — never color alone), `isRadarEmpty`, and the twin helpers
`twinStatus` (FORMING/KNOWN/PARTIAL) and `twinValueLabel` (UNKNOWN is "not yet known", never 0).

**Untouched this sprint** (the mapping tests were NOT rewritten).

## 4. Mapping Test Results

`lib/spatial/__tests__/radar-mappings.test.ts` — **15/15 PASS** (unchanged, re-run):

- honesty categorization (STOP from authoritative stop fields only · VERIFIED requires a
  recorded verified payment · OBSERVED requires ≥1 evidence record · no evidence stays UNKNOWN,
  never a low score)
- deterministic bounded layout (stable angle 0..360 · size 0→10px / 1→26px / undefined→10px ·
  opacity = evidence presence · evidence labels never overstate)
- ordering + empty + color-with-label invariants
- twin honesty (all-unknown→FORMING · all-known→KNOWN · mixed→PARTIAL · UNKNOWN rendered as
  "not yet known", never 0)

## 5. OpportunityRadarSpatial

`apps/web/src/components/spatial/OpportunityRadarSpatial.tsx` (281 lines, `'use client'`).
PURE PRESENTATION: it consumes `RadarSpatialEntry` and delegates every state→visual mapping to
the mapping layer — **no mapping logic is duplicated in TSX**. SVG/CSS only; no WebGL, no
Three.js, no R3F, no GSAP, no chart/animation library. Zero data fetching; the authenticated
pipeline stays authoritative.

## 6. Radar Information Architecture

"Constellation" layout: center hub = total opportunity count; each opportunity is a node on a
deterministic angle with a radial band by category (verified/STOP closer to the decision
center, unknowns toward the rim — per `radarRadius`). Layout is presentational only and never
implies a data relationship (angles are a stable hash of the problemId). Category legend is
built ONLY from categories actually present (never invented). Structure:
`RadarCanvas (SVG) + node hit-areas + SelectedOpportunity detail panel + legend` — the smallest
readable split; no over-engineering.

## 7. Radar SVG

Semantic, accessible SVG: `role="img"` + `<title>` + `<desc>`, each node is a `role="button"`
circle with `tabIndex={0}`, full `aria-label` (category · statement · evidence label · next
action · importance), `aria-selected`, and a padded transparent hit area (≥14px radius touch
target). SVG gives deterministic rendering, responsive `viewBox`, keyboard-compatible elements,
and easy testing. The SVG is never purely decorative.

## 8. Radar State Mapping

Every visual property comes from the mapping layer: node size = `radarSizePx` (advisory score),
opacity = `radarOpacity` (evidence presence), color = `radarColor` (043B teal/gold/red/neutral
semantic tokens), position = `radarAngleDeg` + `radarRadius`, ordering = `radarSortEntries`.
UNKNOWN nodes are dashed + faint; VERIFIED nodes get a gold halo; STOP nodes get a red dashed
ring + ✕ marker. No invented thresholds, scores, or relationships.

## 9. Radar Interaction

Click AND keyboard (Enter/Space) both select a node (`onSelect` emits the problemId; internal
selection for the detail panel). The selected detail panel shows ONLY authoritative fields —
NAME (problemStatement) · STATE (category) · REVENUE (revenueState) · EVIDENCE
(`radarEvidenceLabel`) · IMPORTANCE (`scoreLabel` — "UNKNOWN" when absent, never 0) · NEXT
ACTION — plus an honest score bar. Hover is not required for any interaction. The detail panel
only renders when the selection still exists in the dataset (no fabricated fallback to an
unrelated node).

## 10. Radar Empty State

`isRadarEmpty` → an intentional empty state ("Your opportunity field is forming.") with
product-aligned copy: opportunities appear as VedMoulya learns from evidence; observations
create evidence; verified evidence raises confidence; founder decisions remain authoritative.
**Never fabricated nodes.** The Command Center also keeps its own empty-list copy for the list
view.

## 11. Radar UNKNOWN

UNKNOWN is a first-class visual state: dashed outline, 0.5 opacity (evidence-presence mapping),
neutral color, label "no evidence yet". UNKNOWN is never rendered as 0 or as low confidence —
the mapping layer's `radarOpacity`/`categorizeRadarEntry`/`scoreLabel` guarantees this, and the
"UNKNOWN importance is rendered as UNKNOWN" test asserts it.

## 12. Radar STOP

STOP comes ONLY from authoritative stop fields (`nextAction === 'STOP'` or `stopReason`). It is
visually unmistakable: red dashed ring, red ✕, STOP-first ordering (top of DOM order, closest
attention). It is never styled as success (test: "does NOT style STOP as a success"). The
selected detail exposes the stop reason and next action so the founder understands
"Do not build / continue this without new evidence."

## 13. DigitalTwinSpatial

`apps/web/src/components/spatial/DigitalTwinSpatial.tsx` (237 lines, `'use client'`). A 2D/SVG
orbital model: center = IDENTITY (operating identity anchor, not a human avatar); concentric
rings = state dimensions (GOALS / PROGRESS / EVIDENCE / OPPORTUNITIES). All honesty rules are
delegated to `twinStatus` / `twinValueLabel`. **D1 fixed here**: all hooks now run
unconditionally before the FORMING early return.

## 14. Digital Twin Model

Dimensions are composed in the Command Center (`twinDimensionsFromCommandCenter`) ONLY from
already-loaded reads: opportunities ← radar entry count, evidence ← summed evidenceCount,
progress ← opportunity pipeline count. A dimension whose source has not loaded is omitted → the
twin renders it as UNKNOWN (never a fabricated 0). Ring layout is a single const `RINGS` tuple
(layout affordance, not a relationship); radius per dimension key is a bounded `Record` with a
rim fallback.

## 15. Digital Twin Honesty

The 043D mapping invariants are authoritative and enforced here: UNKNOWN stays UNKNOWN (dashed
neutral node, aria-label "not yet known"); missing information never becomes 0 / empty score /
low confidence / negative state. Twin status chip is honest (FORMING/KNOWN/PARTIAL — after the
FORMING early return only KNOWN or PARTIAL can render). Known-zero (`value === 0`) renders as
"no items yet" — a real recorded zero, distinct from UNKNOWN.

## 16. Digital Twin Empty State

For a new user (no dimensions, or all UNKNOWN): a forming state — "Your Digital Twin is
forming." — with copy explaining the twin reveals itself dimension by dimension from honest,
verifiable data. Never a fake populated twin.

## 17. Digital Twin Interaction

Each dimension node is a `role="button"` circle (`tabIndex={0}`, aria-label with the honest
value label, `aria-selected`) supporting click AND Enter/Space. Selecting a dimension exposes
its existing information via the honest `twinValueLabel` (e.g. "3 · 3 evidence records") and
note — no second source of truth, no new queries.

## 18. Command Center Toggle

`CommandCenter.tsx` INTELLIGENCE tab: a presentation-level **List / Radar** segmented toggle
(`aria-pressed`, `role="group"`). It switches the SAME already-fetched `radar` state between the
dense list (a11y/information fallback) and `<OpportunityRadarSpatial entries={radar.entries.map(toSpatialEntry)} />`.
No new route, no new data-fetching architecture, no duplicate gateway calls — verified by the
integration test that asserts the `opportunityRadar` refetch count does not change across
toggles and that the two views never render simultaneously. The Digital Twin section renders
below from the same reads.

## 19. Accessibility

Keyboard (Tab focus, Enter/Space activate), semantic labels (`aria-label`/`aria-selected`/
`aria-pressed`/`role`), screen-reader titles/descriptions, visible focus rings, non-color state
communication (dash patterns, ✕ marker, textual labels + legend — color is never the only
signal), and the dense List view as the non-visualization fallback. Tested: keyboard selection
test on the radar; aria-selected assertions.

## 20. Reduced Motion

Consumes the 043B global reduced-motion policy (no perpetual motion anywhere): the only
transition is a 200 ms node `transition-all` on state change; there is no pulsing, no
auto-rotation, no animation loop. Node state changes are additionally communicated
non-visually (aria-selected + detail panel), so selection has clear non-motion feedback.

## 21. Responsive Design

The SVG uses a responsive `viewBox`; the Command Center column wraps naturally. On mobile the
detail panel renders below the visualization (not overlaid), the list fallback remains one
toggle away, and the List view is always available if the spatial view is worse than the list.
Touch targets are ≥14px-radius padded hit areas. No `ResizeObserver` and no per-pixel mobile
fork — keep it simple.

## 22. Performance

SVG-only, tiny bundle. No 3D, no animation/chart libraries. Node count is bounded by the radar
read model (≤ 50 entries, gateway-limited); no continuous animation loops; memoization is
limited to the two obvious derivations (`sorted`/`nodes` via `useMemo`). No premature
optimization.

## 23. Dependencies

**Added: 0 · Removed: 0.** Uses `lucide-react` (already a dependency, one icon) and React/SVG.
No Three.js, React Three Fiber, GSAP, D3, or any charting/animation library.

## 24. Architecture

Presentation-only composition over the frozen estate. The mapping layer is presentation logic
(not business logic); the components are presenters; the Command Center passes the SAME read
model to both views. Backend/domain/gateway contracts untouched. No new engines, routes, or
data-fetching architecture.

## 25. Security

No database calls, no tokens, no authorization logic, no alternate gateway route, no cross-user
data anywhere in the spatial layer. The existing authenticated pipeline (`api.world.*` queries)
remains authoritative. Nothing client-side authorizes anything.

## 26. Tests

| Suite                                                 | Result                                                                                                                                                                                                                                                    |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/spatial` mapping tests (unchanged)               | **15/15 PASS**                                                                                                                                                                                                                                            |
| `components/spatial/OpportunityRadarSpatial.test.tsx` | **6/6 PASS** (empty · populated+STOP-first · STOP-not-success · selection+detail · UNKNOWN-importance · keyboard selection)                                                                                                                               |
| `components/spatial/DigitalTwinSpatial.test.tsx`      | **6/6 PASS** (empty forming · all-UNKNOWN forming · **forming→populated hooks regression** · PARTIAL orbital · dashed-UNKNOWN ≠ 0-score · onSelect+honest label)                                                                                          |
| `components/__tests__/CommandCenter.test.tsx`         | **19/19 PASS** (incl. new: List↔Radar toggle + no-duplicate-fetch · Digital Twin reveals dimensions from same data)                                                                                                                                       |
| Full web workspace                                    | **321/321 PASS (30 files)**                                                                                                                                                                                                                               |
| Full root suite                                       | **9207/9208** — 1 pre-existing unrelated failure: `@vedmoulya/knowledge-intelligence` "zero-fills the 14-day trend" (catalog `createdAt` 2026-06-15..07-22 now fall outside the 14-day window as of 2026-08-17; date-dependent, untouched by this sprint) |

Test changes this sprint: +1 radar component test (keyboard), twin tests +1 net (replaced a
no-op assertion with a real dashed-UNKNOWN check and added the hooks regression), +2 Command
Center integration tests. The 15 mapping tests were NOT rewritten.

## 27. Typechecks

| Scope                                               | Result              |
| --------------------------------------------------- | ------------------- |
| apps/web (`tsc --noEmit -p apps/web/tsconfig.json`) | **0 errors — PASS** |
| root (`tsc -b`)                                     | **0 — PASS**        |
| services/api                                        | **0 — PASS**        |
| services/identity                                   | **0 — PASS**        |
| packages/world-model                                | **0 — PASS**        |

## 28. Lint

Scoped lint over all touched source files (`components/spatial/**`, `lib/spatial/**`,
`CommandCenter.tsx`): **0 errors · 0 warnings — PASS**. (Full-estate lint not re-run;
no other workspace was touched.)

## 29. Benchmarks

`opportunity:benchmark` (the data domain behind the radar): **20/20 PASS**. Full `npm run
benchmarks` chain NOT EXECUTED — no benchmark harness, world-model or domain code changed
(presentation-only; the world-model + api suites ran green above confirming no backend
perturbation).

## 30. Build

**`next build` PASS — compiled in ~19s, 58/58 static pages generated, exit 0.** Build-safety
rule honoured: no `next dev` was running (`:3000` free), `.next` was not shared with a dev
server.

## 31. Browser Verification

**NOT EXECUTED — OPERATOR REQUIRED.** The gateway/identity services are not running in this
environment (port 8080 does not answer; only Docker Postgres + Redis are healthy), so a live
session could not be started. DOM behaviour (toggle, selection, keyboard, empty/UNKNOWN/STOP
rendering, no-duplicate-fetch) IS covered by the jsdom + Testing Library suites above; visual
rendering, layout, colour and real-Chrome interaction remain operator-required. Per the sprint
rule, no browser claim is made — label is NOT EXECUTED, not PASS.

## 32. Visual Review

Code-level review only (not browser-rendered): the Radar reads as a calm constellation (teal
evidence, gold verified, red STOP, dashed UNKNOWN, deterministic positions), the Twin as
concentric state rings around IDENTITY — aligned with 043B tokens (teal intelligence, coral
human action, gold achievement, neutral context, red error). Layout uses existing Command
Center card styles (rounded-xl, 043B palette) — no second design system. Final pixel/overflow
review is operator-required (§31).

## 33. Files Changed

- `apps/web/src/components/spatial/DigitalTwinSpatial.tsx` — **D1 fix** (hooks before early
  return) + single `RINGS` tuple refactor (removes lint-flagged parallel-array indexing) +
  honest status chip + return types.
- `apps/web/src/components/spatial/OpportunityRadarSpatial.tsx` — WIP formatting normalised,
  honest selected-detail lookup (no fabricated fallback), explicit return types. All mapping
  still delegated to the mapping layer.
- `apps/web/src/components/spatial/__tests__/DigitalTwinSpatial.test.tsx` — vitest import
  (repo convention), real dashed-UNKNOWN assertion, hooks-order regression test.
- `apps/web/src/components/spatial/__tests__/OpportunityRadarSpatial.test.tsx` — vitest import,
  keyboard-selection test, `noUncheckedIndexedAccess`-safe fixture access.
- `apps/web/src/components/CommandCenter.tsx` — toggle button handlers moved to brace form
  (lint `no-confusing-void-expression`); the toggle + twin mounting were already WIP.
- `apps/web/src/components/__tests__/CommandCenter.test.tsx` — +2 integration tests
  (List↔Radar toggle / no-duplicate-fetch; Digital Twin same-data dimensions).
- `04_Sprints/SPRINT-043D_SPATIAL_INTELLIGENCE_REPORT.md` — this report.

Untouched (WIP preserved): `lib/spatial/radar-mappings.ts`, `lib/spatial/__tests__/radar-mappings.test.ts`.

## 34. Code Footprint

- `OpportunityRadarSpatial.tsx`: 281 lines · `DigitalTwinSpatial.tsx`: 237 lines ·
  radar tests: 80 · twin tests: 78 · mapping layer: 156 (+144 tests) — total **~976 lines**
  including the pre-existing verified mapping layer. Minimal by design: maximum clarity per
  line, no speculative abstraction.

## 35. Known Limitations

- Browser verification not executed (§31); visual quality bar (§29 of the brief) is
  code-reviewed, not pixel-verified.
- The 043B reduced-motion policy is consumed, but a dedicated `prefers-reduced-motion` test
  was not added (the only transition is a 200 ms state change; no motion loops exist).
- The full benchmarks chain and full-estate lint were not re-run (nothing outside the web
  presentation layer changed).
- Pre-existing, unrelated: the `knowledge-intelligence` 14-day-trend test is date-dependent and
  fails as of 2026-08-17 (catalog dates outside the window) — NOT caused by this sprint.
- The radar component keeps an internal `selected` state (prop-initialised); a controlled
  `selectedProblemId` update after mount is not synced (no consumer needs it today — the
  Command Center uses internal selection).

## 36. Remaining 3D Decision

**No 3D.** This sprint delivers the excellent 2D spatial experience the brief demands. A future
3D experiment would need an evidence-based proposal covering: reason, benefit, bundle cost,
accessibility strategy, fallback and performance impact — none of which exists today. The SVG
layer is intentionally 3D-ready only in the sense that all layout is computed in the mapping
layer (same inputs would feed a future WebGL layer), but no 3D work is started.

## 37. Next Sprint

- Operator: browser verification of the Radar/Twin (visual quality, mobile, reduced-motion),
  full-estate lint + full benchmarks chain, and a `next dev` restart.
- Product: evidence-entry polish gated by browser review; a future "valid transitions"
  procedure to remove the mirrored chain constant in the evidence panel (flagged in SPRINT-042).
- Fix the pre-existing date-dependent `knowledge-intelligence` trend test (catalog dates drift
  out of the 14-day window) in an estate-optimization sprint — NOT this sprint (§27 of the brief).

## 38. Experience Verdict

**🟢 GREEN (code-verified).** A founder can read the Radar quickly: STOP is unmistakable,
evidence strength is visible, UNKNOWN is honest, selection opens the real fields, and the dense
list is one toggle away. The Digital Twin explains "what is known vs unknown" honestly for a new
user (forming state) and reveals dimensions only from recorded data. Five-second comprehension
and "switch back to the list" are structurally guaranteed by the same-data toggle; final
in-browser confirmation is operator-required (§31).

## 39. Engineering Verdict

**🟢 GREEN.** The presentation layer is finished over the verified mapping foundation with a
real defect found and fixed minimally (D1 — rules-of-hooks violation), honest mapping
consumption (no duplicated logic in TSX), zero new engines/dependencies/routes, and all
runnable gates green: mapping 15/15 · spatial 12/12 · web 321/321 · typechecks 0 across five
scopes · scoped lint 0/0 · `next build` PASS (58/58) · opportunity benchmark 20/20. Browser
verification is honestly reported as NOT EXECUTED (operator-required), never claimed as PASS.

## 40. FINAL VERDICT

SPRINT-043D Phase 2 is complete: the spatial presentation layer — **OpportunityRadarSpatial**
and **DigitalTwinSpatial** (2D/SVG, 043B tokens, honest UNKNOWN/STOP/empty states, accessible
interaction) — is implemented, integrated into the Command Center behind a same-data
**List ↔ Radar** toggle, and covered by focused tests including a regression for the one real
defect found (hooks-order). Everything runnable passes; nothing unrun is claimed. The mapping
layer stays the single source of visual truth; the list stays the dense/a11y fallback; founder
authority, evidence honesty and the frozen architecture are untouched.

## 41. NEW-ENGINE STATEMENT

**NEW ENGINES CREATED: 0.**

---

### Completion statement

- **Source files modified:** 6 (2 components, 2 component test files, CommandCenter + its
  test) + 1 new report.
- **Mapping layer + mapping tests:** untouched (15/15 re-verified).
- **Dependencies added:** 0 · **Dependencies removed:** 0.
- **Existing architecture preserved:** YES (backend/domain/gateway contracts authoritative and
  untouched; presentation only).
- **Pre-existing WIP preserved:** YES (no reset/checkout/stash/clean; the mapping layer and all
  prior sprint reports untouched).
- **Defects found & fixed:** D1 — `DigitalTwinSpatial` rules-of-hooks violation (would crash
  the Command Center when reads populate the twin); fixed minimally + regression test.
- **Honest labels:** all claims above use PASS / NOT EXECUTED / OPERATOR REQUIRED — nothing
  fabricated.
