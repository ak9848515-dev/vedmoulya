# Module Inventory and Scores

Inventory built from the current filesystem (`git ls-files` + directory scan), not
from older documentation. Counts are tracked source files (`.ts`/`.tsx`, excluding
`dist`/`node_modules`) and test files.

- **58 npm workspaces** (`npm query .workspace`): 48 packages, 9 services, 1 app.
- **980 test files** (`*.test.ts|tsx`, `*.spec.ts`) tracked.
- **62 route pages** under `apps/web/src/app/**/page.tsx`.
- Total tracked files: 4,324.

Scoring key (per module): score /10 = judgement on the prescribed weighted
dimensions where applicable, with non-applicable dimensions redistributed and
noted. Confidence: H = high, M = medium, L = low.

---

## A. Packages (48)

| Package                               | Responsibility                                  | Src | Tests | Score | Conf | Note                                                                        |
| ------------------------------------- | ----------------------------------------------- | --: | ----: | ----: | ---- | --------------------------------------------------------------------------- |
| `@vedmoulya/core`                     | Foundation types/config/startup/preflight       |  83 |    28 |   8.0 | H    | 8 direct consumers; preflight + provider-runtime startup contract.          |
| `@vedmoulya/domain`                   | Domain model/value objects                      | 164 |    51 |   7.5 | H    | 7 direct consumers; broad and well-tested.                                  |
| `@vedmoulya/services`                 | Application-service hub (largest package)       | 347 |   158 |   7.5 | M    | Contains 2,137-line `ClientOperationsApplicationService`; central hub.      |
| `@vedmoulya/mission-runtime`          | Canonical autonomous mission lifecycle          |  45 |    22 |   7.5 | H    | Owns the frozen lifecycle; consumed by `services/api`.                      |
| `@vedmoulya/mission-controller`       | Mission control (BLD-024)                       |  41 |    20 |   7.0 | H    | 1,838-line service; wired via mission-runtime.                              |
| `@vedmoulya/agent-execution`          | Governed execution + verification engine        |  26 |    10 |   7.5 | H    | Tool allowlist/schema/timeout/rate-limit/audit; IDOR guard.                 |
| `@vedmoulya/brain`                    | Reusable intelligence/planning supply           |  38 |     9 |   7.0 | M    | 1,200-line `BrainApplicationService`; ownership correct (no 2nd lifecycle). |
| `@vedmoulya/planning`                 | Planning engine (BLD-017A)                      |  20 |     8 |   7.0 | M    | Deterministic planner; benchmark script exists.                             |
| `@vedmoulya/ai`                       | Provider-neutral AI contracts/types             |  20 |     4 |   7.0 | H    | Owns `ProviderStatus` union; health contract source of truth.               |
| `@vedmoulya/providers`                | Provider preferences/health/benchmark           |  57 |    18 |   7.5 | H    | 18 test files; Postgres + in-memory parity tests.                           |
| `@vedmoulya/world-model`              | World representation / business OS (SPRINT-032) |  50 |    23 |   7.0 | M    | 2,052-line service, 1,721-line types.                                       |
| `@vedmoulya/adaptive-loop`            | Adaptive loop (BLD-018A)                        |  21 |     8 |   6.5 | M    | 1,415-line adaptive-engine; consumed by mission-controller.                 |
| `@vedmoulya/execution-memory`         | Execution memory (BLD-019A)                     |  23 |     8 |   6.5 | M    | Consumed via api.                                                           |
| `@vedmoulya/execution-orchestrator`   | Execution orchestration                         |  34 |     8 |   6.5 | M    | Broadly consumed.                                                           |
| `@vedmoulya/execution-strategy`       | Execution strategy                              |  25 |     8 |   6.5 | M    | Broadly consumed.                                                           |
| `@vedmoulya/execution-bridge`         | Bridge to execution                             |  22 |     5 |   6.5 | M    | Consumed by api.                                                            |
| `@vedmoulya/loop-engine`              | Bounded loop engine                             |  31 |    13 |   6.5 | M    | Benchmark exists.                                                           |
| `@vedmoulya/experience`               | Design/experience knowledge                     |  22 |     4 |   6.5 | M    | 1,371-line catalog.                                                         |
| `@vedmoulya/experience-optimization`  | Experience optimization                         |  18 |     6 |   6.0 | M    | Consumed via mission-runtime/controller.                                    |
| `@vedmoulya/goals`                    | Goals engine                                    |  36 |    11 |   6.5 | M    | Consumed by api + others.                                                   |
| `@vedmoulya/requirements`             | Requirements engine + catalog                   |  43 |    10 |   6.5 | M    | 2,150-line knowledge catalog.                                               |
| `@vedmoulya/app-factory`              | App factory                                     |  45 |    16 |   6.5 | M    | Benchmark exists.                                                           |
| `@vedmoulya/capabilities`             | Capability registry (governed tools)            |  26 |    10 |   6.5 | M    | Central to governed execution.                                              |
| `@vedmoulya/capability-marketplace`   | Capability marketplace                          |  23 |     9 |   6.0 | M    | —                                                                           |
| `@vedmoulya/context`                  | Context assembly                                |  22 |     8 |   6.0 | M    | —                                                                           |
| `@vedmoulya/context-fabric`           | Context fabric                                  |  25 |     8 |   6.0 | M    | —                                                                           |
| `@vedmoulya/control-plane`            | Active intelligence control plane               |  19 |     7 |   6.0 | M    | Never executes; structural `executedNothing`.                               |
| `@vedmoulya/intelligence`             | Intelligence engine                             |  25 |     9 |   6.0 | M    | —                                                                           |
| `@vedmoulya/intelligence-fabric`      | Provider-neutral orchestration contract         |  19 |     8 |   6.0 | M    | Advisory; composes CostLedger/registry.                                     |
| `@vedmoulya/knowledge-intelligence`   | Knowledge intelligence                          |  43 |    17 |   6.5 | M    | 1,347-line catalog.                                                         |
| `@vedmoulya/learning-intelligence`    | Learning intelligence                           |  28 |    10 |   6.0 | M    | 1,036-line catalog.                                                         |
| `@vedmoulya/memory-intelligence`      | Memory intelligence                             |  34 |     8 |   6.0 | M    | 1,005-line catalog.                                                         |
| `@vedmoulya/enterprise-brain`         | Enterprise brain composition                    |  25 |     9 |   6.0 | M    | —                                                                           |
| `@vedmoulya/ecosystem`                | Ecosystem engine                                |  20 |     7 |   5.5 | M    | —                                                                           |
| `@vedmoulya/ecosystem-intelligence`   | Ecosystem intelligence                          |  27 |    11 |   5.5 | M    | —                                                                           |
| `@vedmoulya/os-intelligence`          | OS intelligence                                 |  37 |    14 |   6.0 | M    | —                                                                           |
| `@vedmoulya/proactive`                | Proactive intelligence (advisory)               |  18 |     7 |   6.0 | M    | Evidence-only; no execution.                                                |
| `@vedmoulya/live-intelligence-bridge` | Live intelligence bridge                        |  18 |     3 |   5.5 | M    | Only 3 test files.                                                          |
| `@vedmoulya/ai-world`                 | AI world discovery                              |  31 |    13 |   5.5 | M    | —                                                                           |
| `@vedmoulya/ai-world-scheduler`       | AI world scheduler                              |  18 |     5 |   5.5 | M    | —                                                                           |
| `@vedmoulya/rag`                      | RAG                                             |  19 |     7 |   6.0 | M    | Eval/calibrate scripts exist.                                               |
| `@vedmoulya/voice`                    | Speech seams + assistant                        |  21 |     7 |   5.5 | M    | Operator-required; mock-gated.                                              |
| `@vedmoulya/local-ai`                 | Local agent CLI (Ollama path)                   |  21 |    10 |   6.0 | M    | Runnable via `npm run local-agent`; not imported as a library.              |
| `@vedmoulya/ui`                       | Shared UI primitives                            |  62 |    12 |   6.5 | M    | 1 direct consumer (web).                                                    |
| `@vedmoulya/orchestration-fabric`     | Orchestration fabric (SPRINT-093)               |  19 |     2 |   4.0 | L    | G-17 second routing authority; only 2 test files; deferred.                 |
| `@vedmoulya/information`              | Constants/errors/types only                     |   6 |     0 |   4.5 | L    | Zero tests; consumed only by `packages/services`.                           |
| `@vedmoulya/shared`                   | Shared utilities                                |   6 |     1 |   5.5 | L    | Thin.                                                                       |
| `@vedmoulya/testing`                  | Test utilities/mock factories                   |   1 |     0 |   3.0 | L    | **No importer anywhere in source** (only docs/manifest/lockfile). Orphaned. |

## B. Services (9)

| Service                     | Responsibility                    | Src | Tests | Score | Conf | Note                                                             |
| --------------------------- | --------------------------------- | --: | ----: | ----: | ---- | ---------------------------------------------------------------- |
| `@vedmoulya/identity`       | Identity, auth, tokens, ownership |  33 |    33 |   7.5 | H    | 33 test files; JWT/ownership guards.                             |
| `@vedmoulya/orchestrator`   | Provider adapters + registration  |  21 |    11 |   7.0 | H    | Fail-closed keyless health w/ regression tests.                  |
| `@vedmoulya/api`            | tRPC API gateway composition root | 236 |   109 |   7.0 | H    | 49 routers; `RouterRegistry.ts` 7,003 lines; 3,150-line service. |
| `@vedmoulya/execution`      | Execution service                 |  57 |    23 |   6.5 | M    | —                                                                |
| `@vedmoulya/decision`       | Decision service                  |  54 |    27 |   6.5 | M    | —                                                                |
| `@vedmoulya/memory`         | Memory service                    |  34 |    18 |   6.5 | M    | —                                                                |
| `@vedmoulya/knowledge`      | Knowledge service                 |  30 |    14 |   6.5 | M    | —                                                                |
| `@vedmoulya/content-agency` | Content agency service            |   8 |     1 |   5.5 | M    | Thin; 1 test.                                                    |
| `@vedmoulya/notifications`  | **Empty** — package.json only     |   0 |     0 |   2.0 | H    | D-01. No `src/`, absent from lint scope.                         |

## C. Application — `@vedmoulya/web`

| Subsystem                           | Count |   Score | Conf | Note                                                              |
| ----------------------------------- | ----: | ------: | ---- | ----------------------------------------------------------------- |
| Routes (`src/app/**/page.tsx`)      |    62 |     6.5 | M    | Loading/error/empty/ARIA present in source; no fresh browser run. |
| Components (`src/components/*.tsx`) |    56 |     6.5 | M    | `CommandCenter.tsx` 1,521 lines; `EvidenceEntryPanel.tsx` 1,183.  |
| Page/component tests                |    48 |     7.0 | H    | Vitest; `CommandCenter` 19/19 green.                              |
| E2E specs (`e2e/*.spec.ts`)         |    13 |     5.5 | L    | Playwright specs exist; no fresh run in this audit.               |
| Stores                              |     4 |     6.0 | L    | Zustand-style stores.                                             |
| Lib (api client etc.)               |    39 |     6.0 | M    | `api-client.ts` 4,901 lines.                                      |
| **Web app overall**                 |       | **6.5** | M    | Source-verified only.                                             |

---

## D. Missing manifests, empties, and drift (confirmed)

| Item                              | Evidence                                                                                                    | Classification                                |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `services/notifications`          | Only `package.json`; `main`/`types` = `./src/index.ts` (absent); not in lint scope (58-scope list omits it) | Empty workspace                               |
| `packages/local-workspace`        | `dist/` + `tsconfig.tsbuildinfo` + `node_modules`; **no `package.json`, no `src/`**                         | Orphaned build artifact dir (not a workspace) |
| `@vedmoulya/testing`              | `git grep "@vedmoulya/testing"` → only docs/manifest/lockfile, no source importer                           | Orphaned test-utility package                 |
| G-02 docs vs code                 | `README`/runtime matrix vs `services/orchestrator/src/index.ts:214–247`                                     | Documentation drift                           |
| `@vedmoulya/orchestration-fabric` | `ApiApplicationService.ts:2799` constructs it with `enableProviderRouting: true`                            | Deferred (G-17)                               |

> Per instruction, no module is labelled "unused" from static search alone except
> where a package has **zero importers in source, tests, or generated consumers**
> (`@vedmoulya/testing`) or **no source at all** (`services/notifications`,
> `packages/local-workspace`). Transitive consumers are traced through
> `package.json` dependency edges before any wiring conclusion.
