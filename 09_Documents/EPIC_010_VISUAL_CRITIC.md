# EPIC-010 — Visual Critic & Evidence-First Review

> **Status:** IMPLEMENTED + TESTED
> **Date:** 2026-08-09
> **Workspace:** `@vedmoulya/experience`

## 1. Visual Critic Engine (Phase 8)

`VisualCriticEngine` evaluates generated application files (persisted project
files from the factory) against the design system and blueprint. It returns
structured findings:

```
FINDING VC-001 · HIGH · area: hierarchy · location: Dashboard
  issue: Primary action visually competes with secondary actions.
  evidence: <file-backed evidence — a real excerpt/selector from the files>
  recommendation: Increase primary CTA prominence and reduce secondary emphasis.
  evidenceClass: CONFIRMED | LIKELY | UNCERTAIN | NOT_FOUND
  autoFixable: true/false
```

### Rules (deterministic, file-backed)

- **hierarchy** — one `<h1>`, heading levels follow order, primary action
  distinct from secondary.
- **spacing / consistency** — design-token references (`var(--…)`, token ids)
  present; no scattered inline hex/arbitrary values; consistent color
  vocabulary.
- **readability** — adequate font-size/contrast hints.
- **responsiveness** — responsive primitives present (breakpoints, flex/grid,
  viewport metadata).
- **accessibility** — code-level a11y markers (`aria-*`, `role`, labels,
  `alt`, `:focus`, `prefers-reduced-motion`).
- **interaction_clarity** — buttons/links have `type`, labels, `disabled`
  handling, keyboard hints.
- **visual_density** — no oversized single files; balanced density.
- **domain_appropriateness** — color/personality consistent with the
  archetype's declared visual strategy (warm for restaurant, dense/professional
  for ABAP, etc.).

Every finding carries **evidence drawn from the actual generated files** — the
critic never invents defects. If evidence is insufficient, the finding is
marked `UNCERTAIN`/`NOT_FOUND` rather than manufactured.

## 2. Evidence Classification (Phase 10)

`EvidenceClassifier` classifies each finding as **CONFIRMED · LIKELY ·
UNCERTAIN · NOT_FOUND** by cross-checking the finding's claimed evidence
against the files. `ExperienceEngine.classify` re-runs the classifier over
every finding so the workspace shows the evidence class inline. The classifier
never manufactures confidence: a finding whose evidence string cannot be
located in the files is downgraded, not asserted.

## 3. Multi-Dimensional Quality (Phase 9)

`QualityEvaluator` produces a unified `ApplicationQualityEvaluation` across
**FUNCTIONAL · UX · VISUAL · ACCESSIBILITY · SECURITY · PERFORMANCE · AI ·
RAG · DATA · ARCHITECTURE**. Each dimension yields a score (0..1), findings,
evidence, and recommendations. **A high aggregate score NEVER hides a critical
failure**: any failing dimension (a CRITICAL/HIGH finding, a failed validation
gate, a CRITICAL/HIGH security finding, an oversized file, a single-file
"architecture") flips the verdict to **NOT_READY** and is listed in
`blockingDimensions`.

```
Overall: 92 → SECURITY: CRITICAL FAILURE → verdict NOT_READY (blocking: SECURITY)
```

Verdicts: `READY` (no failures, overall ≥ 0.7) · `READY_WITH_FINDINGS` (no
critical failure but below the bar) · `NOT_READY` (at least one failing
dimension — score is ignored for it).

### Dimension rules (deterministic)

- **FUNCTIONAL** — failed validation gates force failure; score = passed/total.
- **VISUAL / UX** — critic findings (severity-weighted); CRITICAL/HIGH force
  failure.
- **ACCESSIBILITY** — a11y findings; HIGH forces failure; score decays with
  finding count.
- **SECURITY** — external security findings (from the factory security
  review); any CRITICAL or HIGH forces failure.
- **PERFORMANCE** — files > 200KB force failure.
- **AI / RAG** — capability detection (no unnecessary RAG is added when
  absent).
- **DATA / ARCHITECTURE** — model references / layered file structure;
  single-file applications fail the architecture dimension.

## 4. Targeted Refinement (Phases 12–13)

`RefinementPlanner` maps a finding to the files that own its area (spacing →
styles/tokens; hierarchy → ui/components; accessibility → components/app; …)
and produces a **targeted** plan:

- `impact` — affected requirements/screens/components/files/tests,
  architecture/security/deployment impact, `targeted: true`, rationale.
- `fileOperations` — only the affected files (patch/create/delete with
  descriptions).
- `untouched` — everything else, explicitly preserved (never regenerate-all).
- `requiresApproval` — CRITICAL/HIGH findings require user approval.

`ExperienceEngine.planRefinement` re-runs the critic, resolves the finding,
and refuses unknown finding ids (no silent regeneration).

## 5. Traceability (Phase 16)

`TraceabilityEngine` indexes **requirement → design decision → component →
file → test → review** links from the blueprint, design decisions, and
generated files, so the workspace can answer "why was this component designed
this way?".
