# EPIC-009 — Product Intelligence & Requirements Engine: Baseline Audit

> **Status:** BASELINE — FROZEN
> **Date:** 2026-08-09
> **Upstream:** EPIC-006 (🟢 GREEN), EPIC-007 (🟢 GREEN), EPIC-008 (🟢 GREEN)

## 1. Purpose

EPIC-009 adds the **INTELLIGENCE LAYER ABOVE THE APPLICATION FACTORY**: it
understands the _problem_ behind a user's idea before any application work
begins — extracting requirements with provenance, detecting ambiguity and
conflicts, asking only high-value questions, proposing safe defaults, and
producing a complete product specification, design, architecture, AI/RAG/tool
strategy, security plan, cost plan and build plan for **user approval** before
the frozen Application Factory (EPIC-007/008) and LoopEngine (EPIC-006) run.

**Do not rebuild any frozen system.** This audit lists exactly what exists,
what is reusable, and what EPIC-009 must add (and only add).

## 2. Frozen Baseline Inventory

### 2.1 AI Runtime (AI-RUNTIME-002/003 — GREEN)

| Capability                                            | Location                                                        | Reuse in EPIC-009                                         |
| ----------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------- |
| AI orchestration (routing, execution, retry/fallback) | `packages/services/src/ai/AIOrchestrationService.ts`            | Intent enrichment via the specialist port (optional seam) |
| Provider routing (AI-SELECT)                          | `packages/services/src/ai/runtime/ProviderRoutingAdvisor.ts`    | Inherited automatically by the runtime                    |
| Context optimization (EI-003)                         | `packages/services/src/ai/runtime/ContextOptimizer.ts`          | Inherited; never send the whole repo                      |
| Prompt cache                                          | `packages/services/src/ai/runtime/PromptCacheManager.ts`        | Inherited                                                 |
| Structured output                                     | `packages/services/src/ai/runtime/StructuredOutputValidator.ts` | Strategy output for generated apps                        |
| Evidence evaluation (Evidence-First)                  | `packages/services/src/ai/runtime/EvidenceEvaluator.ts`         | RAG strategy grounding requirement                        |
| Token estimation                                      | `packages/ai/src/domain/services/TokenEstimationService.ts`     | Cost plan (Phase 21)                                      |
| Token optimization result                             | `packages/services/src/ai/runtime/TokenOptimizationResult.ts`   | Cost plan assumptions                                     |
| AI metrics                                            | `packages/services/src/ai/AIMetrics.ts`                         | Benchmark (Phase 33)                                      |
| RAG (Postgres/pgvector)                               | `packages/rag`, `createRagRetrievalPort`                        | RAG strategy + retrieval for generated apps               |

### 2.2 EPIC-006 LoopEngine (GREEN)

| Capability                                                                       | Location                                                      | Reuse                                                                |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------- |
| Bounded orchestrated loop (PLAN→EXECUTE→OBSERVE→EVALUATE→CRITIQUE→REFINE→VERIFY) | `packages/loop-engine/src/domain/LoopEngine.ts`               | Executes the application build after EPIC-009 approval               |
| Goal understanding                                                               | `packages/loop-engine/src/domain/GoalUnderstandingService.ts` | Not duplicated — EPIC-009 understands _products_, not loop goals     |
| Task decomposition / graph                                                       | `packages/loop-engine/src/domain/TaskDecompositionService.ts` | Reused by the factory build                                          |
| Critic evaluator (deterministic gates)                                           | `packages/loop-engine/src/domain/CriticEvaluator.ts`          | Reused by the factory build                                          |
| Refinement planner                                                               | `packages/loop-engine/src/domain/RefinementPlanner.ts`        | Reused by the factory build                                          |
| Ports (specialist/rag/tools/clock)                                               | `packages/loop-engine/src/contracts/loop-ports.ts`            | EPIC-009 defines its own _narrower_ enrichment seam; no loop rewrite |
| Budgets (tokens/cost/latency/calls)                                              | `packages/loop-engine/src/domain/LoopBudget.ts`               | Inherited by the build                                               |

### 2.3 EPIC-007 Application Factory (GREEN)

| Capability                                                  | Location                                                                  | Reuse                                                                           |
| ----------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Specification engine (deterministic keyword rules)          | `packages/app-factory/src/domain/SpecificationEngine.ts`                  | EPIC-009 produces a **richer** spec upstream; the factory's engine is untouched |
| Architecture engine (per-archetype stack)                   | `packages/app-factory/src/domain/ArchitectureEngine.ts`                   | EPIC-009 adds choice/reason/alternative/tradeoff + strategy layers above it     |
| Task graph builder                                          | `packages/app-factory/src/domain/TaskGraphBuilder.ts`                     | Reused unchanged for builds                                                     |
| Blueprint + plan preview (Phase 8 approval gate)            | `BlueprintService.ts`, `PlanPreviewService.ts`                            | Reused unchanged                                                                |
| File operation layer + execution policy                     | `FileOperationLayer.ts`, `ExecutionPolicy.ts`                             | Reused unchanged                                                                |
| Validation pipeline + repair loop (6 attempts)              | `ValidationPipeline.ts`, `FactoryEngine.ts` (`MAX_REPAIR_ATTEMPTS = 6`)   | Reused unchanged                                                                |
| Security reviewer / UI quality evaluator                    | `SecurityReviewer.ts`, `UIQualityEvaluator.ts`                            | Reused unchanged                                                                |
| Registry + lifecycle (rename/archive/delete/resume/history) | `ApplicationRegistry.ts`, `FactoryEngine.ts`, `application-repository.ts` | Reused unchanged — the requirements session hands off to `factory.create`       |
| Owner isolation / IDOR                                      | `FactoryEngine.getOwned`                                                  | Pattern reused by the requirements session store                                |
| Economics tracker                                           | `EconomicsTracker.ts`                                                     | Cost plan targets                                                               |
| Deployment + VCS abstraction                                | `DeploymentAbstraction.ts`, `VersionControlService.ts`                    | Reused unchanged                                                                |

### 2.4 EPIC-008 Persistent Workspace (GREEN)

| Capability                                                            | Location                                                               | Reuse                                                      |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| Persistent application projects (Postgres JSONB / in-memory hermetic) | `PostgresApplicationRepository.ts`, `InMemoryApplicationRepository.ts` | Same pattern for requirement sessions                      |
| Version history (append-only)                                         | `FactoryEngine.withVersion`, `ApplicationVersion`                      | Pattern reused for requirement versioning (Phase 26)       |
| 12-tab workspace UI                                                   | `apps/web/src/app/applications/workspace.tsx`                          | Reused unchanged — EPIC-009 opens it after handoff         |
| Browser journey (e2e)                                                 | `apps/web/e2e/applications-journey.spec.ts`                            | Must keep passing — the classic create button is preserved |

### 2.5 Gateway (frozen patterns)

| Capability                                 | Location                                             | Reuse                                                    |
| ------------------------------------------ | ---------------------------------------------------- | -------------------------------------------------------- |
| Router registry + tRPC procedures with zod | `services/api/src/services/RouterRegistry.ts`        | New `requirements.*` procedures follow the same pattern  |
| Auth middleware (JWT) + IDOR guard         | `services/api/src/middleware/auth.ts`                | Applied to every `requirements.*` procedure              |
| Rate limit tiers                           | `services/api/src/middleware/rate-limit.ts`          | `standard` tier for question ops, `heavy` for start/plan |
| Service wiring                             | `services/api/src/services/ApiApplicationService.ts` | Add `requirements` service next to `loop`/`factory`      |

### 2.6 Web UI (frozen patterns)

| Capability               | Location                                 | Reuse                                                                         |
| ------------------------ | ---------------------------------------- | ----------------------------------------------------------------------------- |
| Create flow (StartPanel) | `apps/web/src/app/applications/page.tsx` | Extended with the EPIC-009 product-builder experience; classic path preserved |
| API client hooks         | `apps/web/src/lib/api-client.ts`         | New `useRequirements*` hooks follow the existing `useFactory*` pattern        |
| Design system            | `@vedmoulya/ui`, Tailwind `globals.css`  | Reused for the builder UI                                                     |

## 3. Reuse Decisions (nothing rebuilt)

1. **No new AI provider logic** — EPIC-009 engines are deterministic; optional
   intent enrichment flows through the frozen AI runtime via a narrow port.
2. **No new RAG engine** — the RAG strategy _for the generated app_ consumes
   the existing RAG + EvidenceEvaluator contracts.
3. **No new tool runtime** — tool strategy plans reuse the frozen ToolRuntime
   allowlist model (`echo, current_time, calculator` by default).
4. **No new file/policy layer** — the factory's FileOperationLayer and
   ExecutionPolicy stay the only write path for generated code.
5. **No new loop** — builds still run through the EPIC-006 LoopEngine with the
   application task graph.
6. **No new workspace** — after approval the user lands in the frozen
   EPIC-008 `ApplicationWorkspace`.
7. **No duplicate persistence** — requirement sessions get their own
   owner-scoped store (in-memory hermetic + Postgres JSONB), mirroring the
   app-factory repository pattern.

## 4. What EPIC-009 Adds (only)

- `@vedmoulya/requirements` workspace (types → contracts → domain →
  infrastructure → application → catalog).
- `ProductIntent` + provenance (explicit / inferred / assumption / unknown /
  confidence / source).
- `RequirementSet` (13 categories), `RequirementGraph`, `AmbiguityReport`,
  `QuestionPlan` (BLOCKING/IMPORTANT/OPTIONAL + bundling), `SafeDefault` set,
  `RequirementCompleteness`, `RequirementConflict` detection.
- `ProductBrief`, `UserJourneySet`, `ExperienceStrategy`,
  `DesignSpecification`, `ProductArchitecture` (choice/reason/alternative/
  tradeoff), `AIStrategy`, `RAGStrategy`, `ToolStrategy`, `SecurityPlan`,
  `CostPlan`, `BuildPlan`.
- `PlanReview` + approval gate, `ChangeImpact` analysis, `TraceabilityIndex`,
  `RequirementVersion` control.
- `requirements.*` tRPC namespace, `/applications` product-builder UI
  (conversation + progressive intelligence panel), deterministic tests,
  security tests, benchmark, docs.

## 5. Frozen Verdicts (do not re-litigate)

- EPIC-006 verdict: **🟢 GREEN — COMPLETE**.
- EPIC-007 verdict: **🟢 GREEN — COMPLETE**.
- EPIC-008 verdict: **🟢 GREEN — COMPLETE**.
- AI-RUNTIME-003 verdict: **🟢 CONDITION-FREE PRODUCTION APPROVED**.
