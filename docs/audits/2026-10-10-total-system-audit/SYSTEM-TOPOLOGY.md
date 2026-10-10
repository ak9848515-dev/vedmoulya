# System Topology and Ownership

Source-backed map captured at HEAD `86bad521`. Counts are repository inventory, not capability claims.

## Workspace shape

- npm workspaces are `apps/*`, `packages/*`, `services/*` (`package.json`). Inventory: 1 application, 49 package directories, 9 service directories. The dependency-cycle gate analyzes 58 TypeScript workspaces and passes.
- Next.js App Router: 63 `page.tsx` route files in `apps/web/src/app`; route existence alone does not establish interaction quality.
- API gateway: 49 router modules in `services/api/src/routers`; `RouterRegistry.ts` composes them and middleware lives in `services/api/src/middleware/` (auth, audit, rate limit, validation, errors).
- 996 test/spec files were counted under apps/packages/services by filename pattern; actual full test discovery ran 966 files.
- Root `vitest.config.ts` loads package-local Vitest configurations. `.github/workflows/ci.yml` contains quality, coverage/test, benchmark, security and E2E gates; `.github/workflows/release.yml` handles release workflow. `docker-compose.yml` describes local Postgres, Redis and telemetry infrastructure.

## Ownership map

| Owner               | Responsibility                                                                              | Main source evidence                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Web                 | UI, navigation and client-side state                                                        | `apps/web/src/app/**`, `apps/web/src/components/**`, `apps/web/src/lib/api-client.ts`                                                            |
| API                 | HTTP/tRPC composition, authentication context, domain application wiring                    | `services/api/src/services/ApiApplicationService.ts`, `services/api/src/services/RouterRegistry.ts`, `services/api/src/middleware/`              |
| Identity            | Authentication, OAuth state, authorization and identity persistence                         | `services/identity/src/auth/`, `services/identity/src/authorization/`, `services/identity/src/infrastructure/persistence/`                       |
| Mission             | Canonical autonomous lifecycle, objective selection, checkpoints, approval and continuation | `packages/mission-controller/src/`                                                                                                               |
| Planning            | Requirements-to-plan boundary and plan templates                                            | `packages/planning/src/`                                                                                                                         |
| Agent execution     | Governed step execution, retries, verification and recovery                                 | `packages/agent-execution/src/domain/AgentExecutionEngine.ts`, `verification.ts`, `recovery.ts`                                                  |
| Mission runtime     | Production composition and governed runtime tools                                           | `packages/mission-runtime/src/composition/MissionRuntime.ts`, `adapters/GovernedToolRegistry.ts`, `adapters/WorkspaceTools.ts`                   |
| Brain               | Reusable decision/experience capability composed by Mission                                 | `packages/brain/src/`, `services/api/src/services/ApiApplicationService.ts`                                                                      |
| Loop                | Single-turn task-graph generation/execution, not autonomous lifecycle                       | `packages/loop-engine/src/`                                                                                                                      |
| Providers           | Provider adapters, model capability/health and provider selection infrastructure            | `services/orchestrator/src/index.ts`, `services/orchestrator/src/providers/`, `packages/providers/src/`                                          |
| Memory and learning | Owner-scoped records and outcome-gated learning                                             | `packages/execution-memory/src/`, `packages/experience-optimization/src/`, `packages/learning-intelligence/src/`, `packages/context-fabric/src/` |

## Representative runtime path

`apps/web` opportunity/mission UI → authenticated tRPC procedure in `services/api/src/routers/` → application services in `ApiApplicationService` / `MissionService` → canonical `mission-controller` and `planning` → `agent-execution` → `mission-runtime` governed tools and provider composition → verification → persisted mission/artifact → UI status. Historical real local-provider evidence exists for an opportunity-to-report-to-human-approval draft; see [journeys](END-TO-END-JOURNEYS.md).

Provider registration is through `services/orchestrator/src/index.ts::registerPlatformProviders`, also used by `services/api/src/services/MissionService.ts`. `packages/orchestration-fabric` exists and has API surface, but its alternate routing path is intentionally not composed as a second production authority (deferred G-17).

## Boundaries and concerns

- Internal workspace cycle check passes across 58 manifests; no cycle was observed by that gate. This does not establish runtime initialization completeness.
- API composition and router registry are unusually large (historical audited sizes: ~3,150 and ~7,003 lines respectively); treat as maintainability risks, not automatic defects.
- Prior audit reports map extensive subsystem ownership and health contracts. This map reconciles those reports with the current HEAD and leaves deployment and full runtime claims explicitly unverified.
