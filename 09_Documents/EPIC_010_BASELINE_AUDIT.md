# EPIC-010 — Adaptive Application Experience & Visual Intelligence: Baseline Audit

> **Status:** BASELINE — FROZEN
> **Date:** 2026-08-09
> **Upstream:** EPIC-006 (GREEN), EPIC-007 (GREEN), EPIC-008 (GREEN), EPIC-009 (GREEN)
> **Method:** Verified from source, not from prior completion reports.

## 1. Purpose

EPIC-010 adds the layer ABOVE the Application Factory that makes generated
applications **visually excellent, coherent, application-specific, responsive,
accessible, and continuously reviewable**. This audit records what exists
today (verified from source), what is reusable, and what must be built.

## 2. What Was Inspected

| Area                            | Source                                                                                                        | Findings                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/applications` UI              | `apps/web/src/app/applications/page.tsx`, `workspace.tsx`                                                     | Create flow (goal → UNDERSTAND→SPECIFY→ARCHITECT→PLAN→APPROVE→build) + 12-tab `ApplicationWorkspace` (Overview · Specification · Architecture · Plan · Build · Files · Diff · Tests · Security · Preview · History · Deployment · Settings), desktop + mobile responsive, loading/empty/error states everywhere.                            |
| ApplicationWorkspace            | `workspace.tsx`                                                                                               | Renders only persisted evidence (validation, security, economics, repair attempts); no fake build state. Preview is a sandboxed iframe of the bundled generated HTML with device toggle.                                                                                                                                                    |
| Preview                         | `workspace.tsx` `PreviewTab` + factory `preview`                                                              | Server-side bundled HTML from persisted files; distinguishes functional preview from validation evidence; **no visual-quality claim is made** — consistent with EPIC-008's honest-limitations stance.                                                                                                                                       |
| DesignSpecification (EPIC-009)  | `packages/requirements/src/types/requirement-types.ts`, `DesignIntelligenceEngine.ts`, `catalog/knowledge.ts` | Typed `DesignSpecification` (visualPersonality, targetAudience, brandDirection, colorSystem, typography, spacing, components, iconography, motion, responsiveStrategy, accessibility, interactionStates, empty/loading/error states, rationale). Derived per-archetype from catalog knowledge; **declarative only** — no executable tokens. |
| FactoryEngine                   | `packages/app-factory/src/domain/FactoryEngine.ts`                                                            | Deterministic generate/validate/security/review; bounded 6-attempt repair loop; persists full project document on every mutation.                                                                                                                                                                                                           |
| LoopEngine                      | `packages/loop-engine`                                                                                        | Bounded orchestration with six hard budgets; critic/evaluator; evidence-first; never infinite.                                                                                                                                                                                                                                              |
| Generated application templates | `packages/app-factory` blueprint + `generateProject`                                                          | Deterministic structured projects (typed files, tests, security). **No design-system token layer** — styling is per-template strings.                                                                                                                                                                                                       |
| Shared UI components            | `@vedmoulya/ui`                                                                                               | `Card`, `Loading`, `Button` used by the workspace.                                                                                                                                                                                                                                                                                          |
| Validation                      | `ValidationPipeline`                                                                                          | Deterministic gates; PARTIAL ≠ PASS; repair loop.                                                                                                                                                                                                                                                                                           |
| Deployment                      | `DeploymentAdapterPort`                                                                                       | Local implemented; explicit authorization.                                                                                                                                                                                                                                                                                                  |

## 3. Verified Capabilities (reusable, frozen)

1. **Persistent application workspace** (EPIC-008): full project document survives
   refresh/logout/restart; lifecycle ops with owner-scoped `getOwned`; version
   history; IDOR refused at the engine.
2. **Application Factory** (EPIC-007): typed specification, architecture, task
   graph, generation, validation, security review, UI-quality gate, economics,
   isolated workspaces, no arbitrary execution.
3. **LoopEngine** (EPIC-006): bounded orchestration; the natural host for the
   Phase 11 generate→review→refine loop.
4. **Product Intelligence** (EPIC-009): `DesignSpecification` with application-
   specific personality; full requirements intelligence; change impact (Phase
   24); traceability indexer; cost planning.
5. **AI Runtime**: provider routing, RAG, evidence evaluation, token
   optimization, structured output, metrics — the narrow port any optional AI
   critique must flow through.

## 4. Gaps EPIC-010 Must Fill (verified from source)

| Gap                                                                                                                                                            | Evidence                                                                                                                                                                                  | EPIC-010 Phase |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| No executable **design system** (tokens, component specs, groups) — EPIC-009 design is declarative prose; generated styling is per-template strings.           | `DesignSpecification` is a string/array-of-strings shape; `design-knowledge.ts` in `packages/requirements` is catalog prose.                                                              | Phase 1        |
| No **domain-aware visual strategy** mapping archetype → concrete palette/type/spacing/component rules.                                                         | `packages/app-factory` blueprint picks colors per-template; no shared domain visual model.                                                                                                | Phase 2        |
| No **DesignDecision** record with rationale/source/alternatives/confidence.                                                                                    | EPIC-009 derives `design` but does not record discrete decisions.                                                                                                                         | Phase 3        |
| No **UI blueprint** (screens/routes/navigation/components/states) before generation.                                                                           | EPIC-009 `userJourneys` exist; no UI structure blueprint.                                                                                                                                 | Phase 4        |
| No explicit **state / responsive / accessibility intelligence** per screen.                                                                                    | Workspace tabs show states ad hoc; no spec per generated screen.                                                                                                                          | Phases 5–7     |
| No **visual critic** over generated files.                                                                                                                     | EPIC-007 has a deterministic `UIQualityEvaluator` (limited rules) — no hierarchy/spacing/alignment/consistency/domain-appropriateness critic with structured findings + evidence classes. | Phases 8–10    |
| No **multi-dimensional quality evaluation** (FUNCTIONAL/UX/VISUAL/ACCESSIBILITY/SECURITY/PERFORMANCE/AI/RAG/DATA/ARCHITECTURE) with critical-failure override. | Factory has validation + security reports separately; no unified model.                                                                                                                   | Phase 9        |
| No **targeted refinement** planner (change impact, only affected files).                                                                                       | Factory rebuilds are whole-project; EPIC-009 `changeImpact` is requirement-level, not file-level.                                                                                         | Phases 12–13   |
| No **Quality center** in the workspace UI.                                                                                                                     | 12 tabs; none surface a unified quality score with drill-down.                                                                                                                            | Phase 15       |
| No **design→implementation traceability** link.                                                                                                                | EPIC-009 `TraceabilityIndexer` links requirements→artifacts; no design-decision→component→file chain.                                                                                     | Phase 16       |

## 5. Reuse Decisions (build-vs-adopt)

- **ADOPT (frozen):** AI runtime ports, RAG, EvidenceEvaluator, token
  optimization, LoopEngine, Application Factory, workspace persistence,
  owner-scoped IDOR, deployment adapters, EPIC-009 `DesignSpecification`.
- **ADAPT:** EPIC-009 `DesignSpecification` is consumed as input to the design
  system engine (personality + declared colors override archetype defaults);
  EPIC-007's `UIQualityEvaluator` remains the factory's build gate while the
  new visual critic operates above it on persisted files.
- **BUILD (new, this epic):** `@vedmoulya/experience` workspace — design system
  engine, design decision engine, UI blueprint engine, state/responsive/
  accessibility intelligence, visual critic, evidence classifier,
  multi-dimensional quality evaluator, targeted refinement planner, and a
  traceability engine. All deterministic and provider-neutral.
- **REJECT:** rebuilding the AI runtime, the factory, the loop, or the
  persistence layer; copying any proprietary application-builder implementation
  (only general, proven product patterns are adopted).

## 6. Constraints

- Business engines remain provider-neutral (no provider SDKs in product code).
- Optional AI critique flows through a narrow port over the frozen runtime.
- No overclaiming: if visual validation is not actually executed, the status is
  **IMPLEMENTATION VERIFIED / VISUAL VALIDATION PENDING**.

## 7. Verdict

**BASELINE CONFIRMED.** The intelligence layer above the factory is genuinely
missing today; the frozen platform provides every port it needs. EPIC-010
builds **only** the missing experience layer and reuses everything else.
