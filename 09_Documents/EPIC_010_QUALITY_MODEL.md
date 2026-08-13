# EPIC-010 — Quality Model, API Contract & Security

> **Status:** IMPLEMENTED + TESTED
> **Date:** 2026-08-09
> **Workspace:** `@vedmoulya/experience` · Gateway: `experience.*`

## 1. The experience.* API Contract

| Procedure             | Tier     | Input                                  | Output                                                                                            |
| --------------------- | -------- | -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `experience.evaluate` | standard | `{ userId, applicationId }`            | `ExperienceEvaluateDTO` — designSystem, blueprint, designDecisions, critic, quality, traceability |
| `experience.findings` | standard | `{ userId, applicationId }`            | `ExperienceFindingsDTO` — evidence-classified findings with summaries                             |
| `experience.refine`   | standard | `{ userId, applicationId, findingId }` | `ExperienceRefineDTO` — targeted refinement plan (change impact + file ops + untouched)           |

All procedures are authenticated, rate-limited (standard tier), and
**owner-scoped**: the router resolves the persisted application through
`factory.getDetail`, which enforces ownership at the factory engine (`getOwned`)
— the exact IDOR boundary `handoffToFactory` uses. The experience router adds
no second trust model.

## 2. Gateway Wiring

- `services/api/src/routers/ExperienceRouter.ts` — handler contract + factory
  function; pulls `files`, `securityReport.findings`, and `lastValidation.gates`
  from the persisted application and feeds them to the service.
- `services/api/src/services/ApiApplicationService.ts` — `experience`
  property constructed alongside `requirements`.
- `services/api/src/services/RouterRegistry.ts` — zod inputs
  (`experienceEvaluateInput`, `experienceRefineInput`) and the `experience`
  router block registered under the standard tier.
- Web hooks: `useExperienceEvaluate`, `useExperienceFindings`,
  `useExperienceRefine` in `apps/web/src/lib/api-client.ts`.

## 3. UI — Application Quality Center (Phase 15)

A new **Quality** tab in `ApplicationWorkspace` (`apps/web/src/app/applications/workspace.tsx`):

- **Verdict banner** — `READY / READY_WITH_FINDINGS / NOT_READY`, overall
  score (0..100), verdict reason, and blocking dimensions (a critical failure
  visibly overrides any high score).
- **Dimension grid** — all 10 dimensions with scores and drill-down
  recommendations; failed dimensions are highlighted red.
- **Critic findings** — severity/area/evidence-class chips, issue, file-backed
  evidence, recommendation, and a **Fix automatically** button that calls
  `experience.refine` and renders the change-impact plan (affected files,
  untouched preservation count, approval-required flag).
- **Design decisions + traceability** — rationale/source/alternatives per
  decision and the requirement→decision→component→file→test→review chain.
- Loading / error / empty states for every query (evaluation unavailable until
  the application has generated files).

## 4. Security Model

- **IDOR**: every `experience.*` call resolves through the factory's owner-
  scoped `getOwned` — a foreign user id is refused at the engine (proven by
  the cross-user lifecycle tests).
- **No new data plane**: the experience layer reads persisted application
  files through the same workspace the factory owns; it writes nothing.
- **No arbitrary execution**: refinement produces a _plan_ (file operations +
  impact), never a shell/fs/network action. Applying refinement remains an
  explicit, approval-gated user action.
- **No secrets**: the DTO exposes only design/quality evidence; internal engine
  mechanics are never leaked.
- **No provider coupling**: optional AI critique is a documented follow-up
  seam; today the engines are fully deterministic.
- **Prompt-injection surface**: critic rules are deterministic patterns over
  generated files; no model is asked to interpret untrusted content in this
  layer.

## 5. Performance & Token Efficiency (Phases 17/22)

- Deterministic engines: evaluation ~1ms per application (measured in the
  benchmark); **zero AI calls, zero RAG calls** in the experience pipeline.
- Targeted refinement selects only the files that own the affected area
  (rank/filter) — never the entire repository/application.
- The quality model reuses persisted validation + security evidence instead of
  re-deriving it (no duplicate AI/retrieval).
