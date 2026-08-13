# EPIC-008 — Real Application Workspace & Production UX: Baseline Audit

> **Audit date:** 2026-08-09 · **Baseline:** EPIC-007 🟢 GREEN (repo-wide ESLint 0/0,
> typecheck 0, app-factory 83/83 tests, gateway 524/524 tests, factory benchmark
> PASSED).
>
> **Purpose:** identify exactly what is already production-capable and what must
> be built for "a real user can create, inspect, modify, validate, resume and
> manage an application through VedMoulya". Nothing that is production-suitable
> today may be duplicated.

---

## 1. Scope of inspection

| Area                                            | Inspected                                                                                                                     |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Applications page                               | `apps/web/src/app/applications/page.tsx`                                                                                      |
| app-factory package                             | `packages/app-factory` (types → contracts → domain → infrastructure → application → catalog)                                  |
| ApplicationSpecification / Blueprint / Registry | `types/app-types.ts`, `domain/SpecificationEngine.ts`, `domain/BlueprintService.ts`, `domain/ApplicationRegistry.ts`          |
| Workspace management                            | `infrastructure/InMemoryWorkspace.ts`, `FactoryEngine.build()` (Phase 14 `workspaceFactory`)                                  |
| Generation loop / LoopEngine                    | `domain/FactoryEngine.ts` `runGenerationLoop` → `@vedmoulya/loop-engine` (pre-built graph)                                    |
| AI Runtime                                      | `@vedmoulya/ai` + `AIOrchestratorSpecialistPort` (frozen, reused — not re-audited in depth)                                   |
| File operations                                 | `domain/FileOperationLayer.ts`, `contracts/factory-ports.ts` (`WorkspacePort`)                                                |
| Git / VCS                                       | `infrastructure/adapters.ts` (`InMemoryVersionControl`), `domain/VersionControlService.ts`                                    |
| Deployment adapters                             | `infrastructure/adapters.ts` (Local + Vercel declared), `domain/DeploymentAbstraction.ts`                                     |
| UI components                                   | `@vedmoulya/ui` (Card, Loading, Button)                                                                                       |
| Auth / authorization                            | `services/api/src/middleware/auth.ts` (JWT), `RouterRegistry.ts` (`authMiddleware` + `assertUserIdMatchesSession` IDOR guard) |
| Persistence                                     | `services/api/src/infrastructure/ProductionRepositories.ts` (lazy Postgres pattern), `FactoryEngine` (in-memory Maps)         |
| API routers                                     | `services/api/src/routers/FactoryRouter.ts`, `RouterRegistry.ts` (`factory.*` namespace)                                      |

## 2. What is already production-capable (reuse — do not rebuild)

| Capability                                                         | Where                                                                                          | Verdict                        |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------ |
| Understand → Specify → Architect → Plan → Approve → Build pipeline | `FactoryEngine` + `FactoryApplicationService`                                                  | 🟢 production-shaped           |
| Phase 8 approval gate (no files before approval)                   | `PlanPreviewService`, `approve()`                                                              | 🟢                             |
| Bounded generation loop (EPIC-006 reuse)                           | `runGenerationLoop` over pre-built `LoopTaskGraph`                                             | 🟢                             |
| Isolated per-application workspaces (Phase 14)                     | `workspaceFactory` → `InMemoryWorkspace`; root containment, path-traversal rejection, rollback | 🟢 by construction             |
| File-operation audit trail + policy classification                 | `FileOperationLayer`, `ExecutionPolicy`, `classifyFileOperation`                               | 🟢                             |
| Validation gates + bounded auto-fix                                | `ValidationPipeline`                                                                           | 🟢                             |
| Security + UI-quality review (CRITICAL/HIGH block)                 | `SecurityReviewer`, `UIQualityEvaluator`                                                       | 🟢                             |
| Economics tracking (estimate vs actual)                            | `EconomicsTracker`, `EconomicsSnapshot`                                                        | 🟢                             |
| Deployment abstraction + explicit authorization                    | `DeploymentAbstraction`, `DeploymentAdapterPort`                                               | 🟢                             |
| VCS journal, never auto-pushes                                     | `VersionControlService`, `InMemoryVersionControl`                                              | 🟢 (in-memory)                 |
| Auth + IDOR at the API boundary                                    | JWT middleware + `assertUserIdMatchesSession` + owner-scoped `getOwned`                        | 🟢                             |
| `factory.*` tRPC namespace + zod + rate limits                     | `RouterRegistry` (create/approve/build/status/getDetail/deploy/list/vc*)                       | 🟢                             |
| `/applications` UX (start → plan → build → detail)                 | `page.tsx`                                                                                     | 🟡 usable, not yet a workspace |
| Deterministic generator + 3 validation apps                        | `catalog/generator.ts`, archetypes                                                             | 🟢                             |

## 3. Gaps blocking the EPIC-008 acceptance criterion

| #   | Gap                                                                                                                                                                                     | Phase   | Severity          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------- |
| G1  | **No persistence.** `FactoryEngine` keeps `projects`/`workspaces`/`economics` in process-local Maps. Applications vanish on restart; nothing survives page refresh / logout / redeploy. | 1, 2    | **BLOCKER**       |
| G2  | **No lifecycle management.** rename / archive / delete (policy) / resume are absent. Status is written but cannot be managed.                                                           | 1       | BLOCKER           |
| G3  | **No version history.** Significant states (approve/build/deploy/archive) are not recorded as inspectable versions; no rollback baseline.                                               | 14      | HIGH              |
| G4  | **UI is a panel, not a workspace.** `/applications` lacks Overview/Spec/Architecture/Files/Diff/Tests/Security/History/Deployment/Settings navigation; actions are scattered.           | 3       | HIGH              |
| G5  | Workspace durability: per-app `InMemoryWorkspace` is rebuilt from the deterministic generator on each build; resume must re-seed from persisted files (G1 unblocks this).               | 2, 17   | MEDIUM (after G1) |
| G6  | Diff review (accept/reject) and file-level AI actions (explain/fix/refactor) not exposed in UI; engine supports planned changes but UI only shows applied ops.                          | 7, 8, 9 | MEDIUM            |
| G7  | Repair loop UI (attempt 1/6, repair limit) not surfaced; validation failure → diagnose → patch → re-run is engine-capable but not user-facing.                                          | 10, 11  | MEDIUM            |
| G8  | Application preview (desktop/tablet/mobile) not rendered.                                                                                                                               | 13      | LOW               |
| G9  | Security results are in the status DTO but not persisted per version (G3 + G1 unblock).                                                                                                 | 12      | MEDIUM            |
| G10 | Performance measurement (N+1, duplicate AI calls, unbounded polling) not instrumented for the workspace.                                                                                | 21      | LOW               |
| G11 | Cross-user / cross-project security tests are not in the suite (engine-level IDOR exists and is covered by 83 tests; explicit negative tests pending).                                  | 22      | MEDIUM            |

## 4. Constraints honoured (from the epic)

- **Do NOT redesign EPIC-006 / EPIC-007.** The LoopEngine, AI Runtime, RAG,
  EvidenceEvaluator, provider routing, factory core are reused as-is.
- Persistence must follow the **established gateway convention**: lazy Postgres
  pool + JSONB document repository (`createProduction*Repository` +
  `ensureTable`), with an in-memory hermetic double for dev/tests — same as
  every EI engine (PR-002A/B, CERT-002 C-04).
- Workspace isolation and ownership are enforced **at the API/engine layer**,
  never only in the UI.
- No new third-party dependencies; no live DB required for hermetic tests
  (this machine has no Docker/WSL — the Postgres path is operator-verified).

## 5. Conclusion

The factory engine is architecturally production-shaped and the API boundary is
already auth+IDOR+rate-limit+zod guarded. The decisive blocker for the EPIC-008
acceptance criterion is **persistence (G1)** plus the **lifecycle operations
(G2)** and **version history (G3)** on top of it, then converting the panel UI
into a real **workspace (G4)**. G5–G11 follow once G1–G4 land.
