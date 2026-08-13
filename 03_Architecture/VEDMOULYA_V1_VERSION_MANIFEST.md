# VEDMOULYA V1 VERSION MANIFEST

> The authoritative, frozen version record for **VEDMOULYA OS v1.0**.
> Owner: Chief Release Architect · Sprint: OS-003 (EPIC-005) · Date: 2026-08-07

---

## 1. Version

| Field                   | Value                                      |
| ----------------------- | ------------------------------------------ |
| **OS Version**          | **1.0.0** (`v1.0.0`)                       |
| **Release Designation** | VEDMOULYA OS v1.0 FROZEN                   |
| **Release Date**        | 2026-08-07                                 |
| **License**             | MIT                                        |
| **Semantic Versioning** | SemVer 2.0.0 (all contracts frozen at 1.x) |
| **Git branch**          | `main`                                     |

---

## 2. Git Commit / Tag

| Field                         | Value                                                       |
| ----------------------------- | ----------------------------------------------------------- |
| **Release commit**            | `dd4dffd3d7be6175b9bf37c0d122c642d937c942`                  |
| **Release tag**               | `v1.0.0`                                                    |
| **Commit message**            | `feat(web): add capacitor android wrapper for mobile build` |
| **Preceding certified state** | OS-002 FINAL CERTIFICATION (🟢 CERTIFIED) on HEAD `dd4dffd` |

> The `v1.0.0` tag is created on the frozen release commit at the conclusion of
> OS-003. **Do not push or publish externally unless explicitly instructed.**

---

## 3. Package Versions (all `1.0.0`)

| Package     | Workspace        | Version |
| ----------- | ---------------- | ------- |
| Root        | `vedmoulya`      | 1.0.0   |
| Web app     | `@vedmoulya/web` | 1.0.0   |
| API gateway | `@vedmoulya/api` | 1.0.0   |

### Apps

| Workspace  | Package          | Version |
| ---------- | ---------------- | ------- |
| `apps/web` | `@vedmoulya/web` | 1.0.0   |

### Packages (10 foundation + 10 EI + 1 OS)

| Workspace                         | Package                             | Version |
| --------------------------------- | ----------------------------------- | ------- |
| `packages/ai`                     | `@vedmoulya/ai`                     | 1.0.0   |
| `packages/capabilities`           | `@vedmoulya/capabilities`           | 1.0.0   |
| `packages/config`                 | `@vedmoulya/config`                 | 1.0.0   |
| `packages/context`                | `@vedmoulya/context`                | 1.0.0   |
| `packages/core`                   | `@vedmoulya/core`                   | 1.0.0   |
| `packages/domain`                 | `@vedmoulya/domain`                 | 1.0.0   |
| `packages/enterprise-brain`       | `@vedmoulya/enterprise-brain`       | 1.0.0   |
| `packages/execution-orchestrator` | `@vedmoulya/execution-orchestrator` | 1.0.0   |
| `packages/execution-strategy`     | `@vedmoulya/execution-strategy`     | 1.0.0   |
| `packages/goals`                  | `@vedmoulya/goals`                  | 1.0.0   |
| `packages/information`            | `@vedmoulya/information`            | 1.0.0   |
| `packages/intelligence`           | `@vedmoulya/intelligence`           | 1.0.0   |
| `packages/knowledge-intelligence` | `@vedmoulya/knowledge-intelligence` | 1.0.0   |
| `packages/learning-intelligence`  | `@vedmoulya/learning-intelligence`  | 1.0.0   |
| `packages/memory-intelligence`    | `@vedmoulya/memory-intelligence`    | 1.0.0   |
| `packages/os-intelligence`        | `@vedmoulya/os-intelligence`        | 1.0.0   |
| `packages/providers`              | `@vedmoulya/providers`              | 1.0.0   |
| `packages/services`               | `@vedmoulya/services`               | 1.0.0   |
| `packages/shared`                 | `@vedmoulya/shared`                 | 1.0.0   |
| `packages/testing`                | `@vedmoulya/testing`                | 1.0.0   |
| `packages/ui`                     | `@vedmoulya/ui`                     | 1.0.0   |

### Services (12 + gateway)

| Workspace                 | Package                     | Version |
| ------------------------- | --------------------------- | ------- |
| `services/api`            | `@vedmoulya/api`            | 1.0.0   |
| `services/business`       | `@vedmoulya/business`       | 1.0.0   |
| `services/career`         | `@vedmoulya/career`         | 1.0.0   |
| `services/content-agency` | `@vedmoulya/content-agency` | 1.0.0   |
| `services/decision`       | `@vedmoulya/decision`       | 1.0.0   |
| `services/execution`      | `@vedmoulya/execution`      | 1.0.0   |
| `services/identity`       | `@vedmoulya/identity`       | 1.0.0   |
| `services/knowledge`      | `@vedmoulya/knowledge`      | 1.0.0   |
| `services/learning`       | `@vedmoulya/learning`       | 1.0.0   |
| `services/marketplace`    | `@vedmoulya/marketplace`    | 1.0.0   |
| `services/memory`         | `@vedmoulya/memory`         | 1.0.0   |
| `services/notifications`  | `@vedmoulya/notifications`  | 1.0.0   |
| `services/orchestrator`   | `@vedmoulya/orchestrator`   | 1.0.0   |

**Consistency:** All **35 workspaces** confirm `1.0.0` (verified from repository `package.json` manifests on 2026-08-07).

---

## 4. Engine Versions (Enterprise Intelligence)

| Engine                              | ID         | Package                             | Sprint | Version | Status    |
| ----------------------------------- | ---------- | ----------------------------------- | ------ | ------- | --------- |
| Capability Engine                   | EI-001     | `@vedmoulya/capabilities`           | EI-001 | 1.0.0   | 🟢 FROZEN |
| Provider Engine                     | EI-002     | `@vedmoulya/providers`              | EI-002 | 1.0.0   | 🟢 FROZEN |
| Context Engine                      | EI-003     | `@vedmoulya/context`                | EI-003 | 1.0.0   | 🟢 FROZEN |
| Execution Strategy Engine           | EI-004     | `@vedmoulya/execution-strategy`     | EI-004 | 1.0.0   | 🟢 FROZEN |
| Execution Orchestrator              | EI-005     | `@vedmoulya/execution-orchestrator` | EI-005 | 1.0.0   | 🟢 FROZEN |
| Goal/Task Engine                    | EI-006     | `@vedmoulya/goals`                  | EI-006 | 1.0.0   | 🟢 FROZEN |
| Learning Engine                     | EI-007     | `@vedmoulya/learning-intelligence`  | EI-007 | 1.0.0   | 🟢 FROZEN |
| Enterprise Brain                    | EI-008     | `@vedmoulya/enterprise-brain`       | EI-008 | 1.0.0   | 🟢 FROZEN |
| Knowledge Engine                    | EI-009     | `@vedmoulya/knowledge-intelligence` | EI-009 | 1.0.0   | 🟢 FROZEN |
| Memory Engine                       | EI-010     | `@vedmoulya/memory-intelligence`    | EI-010 | 1.0.0   | 🟢 FROZEN |
| Intelligence Integration (Pipeline) | INT-001    | `@vedmoulya/intelligence`           | EI-006 | 1.0.0   | 🟢 FROZEN |
| **OS Integration Layer**            | **OS-001** | `@vedmoulya/os-intelligence`        | OS-001 | 1.0.0   | 🟢 FROZEN |

---

## 5. API Version

| Surface                | Version                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Contract                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Gateway tRPC           | **v1** (27 routers, `health.*`, `identity.*`, `lifeos.*`, `dashboard.*`, `career.*`, `learning.*`, `business.*`, `marketplace.*`, `search.*`, `notifications.*`, `configuration.*`, `metrics.*`, `contentAgency.*`, `clientOps.*`, `capabilities.*`, `providers.*`, `context.*`, `executionStrategy.*`, `orchestrator.*`, `goals.*`, `intelligence.*`, `learningIntelligence.*`, `enterpriseBrain.*`, `knowledge.*`, `memoryIntelligence.*`, `os.*`, `client-portal.*`) | FROZEN — `03_Architecture/API_V1_CONTRACT.md` |
| Service HTTP (OpenAPI) | **v1** (`/api/v1/...`) — identity, knowledge, memory, decision, execution                                                                                                                                                                                                                                                                                                                                                                                               | FROZEN                                        |
| Response envelope      | `ApiResponse` (`fromServiceResult`)                                                                                                                                                                                                                                                                                                                                                                                                                                     | FROZEN                                        |
| Error contract         | `{ success:false, error:{ code, message, details? } }`                                                                                                                                                                                                                                                                                                                                                                                                                  | FROZEN                                        |

---

## 6. Database Migration Version

| Field                            | Value                                                                                                                                                                                                                                                                                              |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Schema version**               | `2026-08-07-v1.0.0` (frozen)                                                                                                                                                                                                                                                                       |
| **Migration strategy**           | Migration-ready by construction — every Postgres repository creates its table with `CREATE TABLE IF NOT EXISTS` (idempotent)                                                                                                                                                                       |
| **EI stores (JSONB registries)** | `capability_registry` · `provider_registry` · `context_registry` · `execution_strategy_registry` · `execution_graph_registry` · `pipeline_registry` · `goal_registry` · `task_registry` · `learning_registry` · `brain_registry` · `knowledge_registry` · `memory_registry` · `os_health_registry` |
| **Service stores**               | Identity · Knowledge · Memory · Decision · Execution · Content-Agency · Client-Ops (per-service DI `initializeDatabase`)                                                                                                                                                                           |
| **Seed**                         | `scripts/seed-ei.ts` — idempotent (`ON CONFLICT DO UPDATE`), `--dry-run` / `--only` / `EI_DATABASE_URL` supported                                                                                                                                                                                  |

---

## 7. UI Version

| Field             | Value                                                        |
| ----------------- | ------------------------------------------------------------ |
| **UI package**    | `@vedmoulya/ui` **1.0.0**                                    |
| **Web app**       | `@vedmoulya/web` **1.0.0**                                   |
| **Design system** | DES-010A Experience Bible tokens (frozen)                    |
| **Routes**        | 21+ top-level routes build + prerequisites (verified OS-002) |
| **Storybook**     | Build PASS; `OperatingSystem/*` + all EI stories             |
| **Mobile**        | Capacitor Android wrapper (`@capacitor/*`) — MOB-001/002     |

---

## 8. AI Provider Adapter Versions

| Adapter                    | Kind                                                                              | Status                    |
| -------------------------- | --------------------------------------------------------------------------------- | ------------------------- |
| `OpenAIProvider`           | Real HTTP transport (`https://api.openai.com/v1/chat/completions`, Bearer auth)   | FROZEN production adapter |
| `MockProvider`             | Test-only mock (never wired in production)                                        | FROZEN as test double     |
| Provider registry families | `openai` · `anthropic` · `google` · `deepseek` · `openrouter` · `ollama` · `mock` | FROZEN contract           |
| Routing strategy           | `capability` (default) · `AI_ROUTING_STRATEGY` env                                | FROZEN                    |

> **Classification (no overclaiming):** provider selection, capability matching,
> scoring, cost/latency/token budgeting, context assembly, memory/knowledge
> retrieval, retry/fallback, learning feedback are IMPLEMENTED and tested.
> Live AI completion calls require provisioned provider keys at runtime.
> `MockProvider` is confined to tests/development only (OS-002 §6).

---

## 9. Runtime Requirements

| Requirement         | Minimum              | Certified / CI                           | Notes                                                         |
| ------------------- | -------------------- | ---------------------------------------- | ------------------------------------------------------------- |
| **Node.js**         | `>=20.0.0`           | **Node 22** (CI-pinned, CERT-002/OS-002) | Node 24 + Vitest 4.1.10 is NOT supported locally (documented) |
| **npm**             | `>=10.0.0`           | 10.x                                     | Workspaces + `npm ci`                                         |
| **Package manager** | npm                  | npm                                      | `package-lock.json` is the reproducibility lockfile           |
| **OS**              | Linux/macOS/Windows* | ubuntu-latest (CI)                       | *Windows local lint/test have documented notes (see §Env)     |
| **Database**        | PostgreSQL 16        | PostgreSQL 16 (`docker-compose.yml`)     | Required for production repositories                          |
| **Cache / queue**   | Redis 7              | Redis 7                                  | Required outside `NODE_ENV=development`                       |
| **TypeScript**      | `strict: true`       | tsc -b whole repo                        | No `any`, no `!` assertions                                   |

---

## 10. Build Requirements

| Step                 | Command                             | Verified                                                       |
| -------------------- | ----------------------------------- | -------------------------------------------------------------- |
| Install              | `npm ci`                            | ✅                                                             |
| Foundation build     | `npm run build:core`                | ✅                                                             |
| Whole-repo build     | `npm run build`                     | ✅ (workspace dependency order — `fd0b48e`)                    |
| Typecheck            | `npm run typecheck`                 | ✅ 0 errors (re-verified 2026-08-07)                           |
| Lint                 | `npm run lint`                      | ✅ 0 errors / 0 warnings (`.eslint-report.json`; CI on ubuntu) |
| Tests                | `npm run test:coverage`             | ✅ 6,150 tests / 476 files (OS-002)                            |
| Coverage gate        | `node scripts/coverage-gate.mjs`    | ✅ 28/28 workspaces ≥80% (OS-002)                              |
| Production web build | `npm run build -w apps/web`         | ✅ `next build` PASS                                           |
| Bundle budgets       | `bash scripts/check-bundle-size.sh` | ✅ shared <150 kB, route <100 kB, page ≤50 kB                  |
| Storybook            | `npx storybook build`               | ✅ PASS                                                        |
| Audit                | `npm audit --audit-level=critical`  | ✅ PASS; `npm audit --omit=dev` → 0 vulns                      |
| CI pipeline          | `.github/workflows/ci.yml`          | ✅ 10 quality gates (Node 22)                                  |

---

## 11. Environment Requirements

| Field               | Value                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Config template     | `.env.example` → `.env.local` (development)                                                                                                |
| Production template | `.env.production.example`                                                                                                                  |
| Fail-fast secrets   | `AUTH_JWT_SECRET` · `IDENTITY_DATABASE_URL` · `REDIS_URL` · `AI_OPENAI_API_KEY` (when `FF_AI_ASSISTANT_ENABLED`) · OAuth/SMTP when enabled |
| Dev infra           | `docker-compose.yml` — Postgres 16, Redis 7, Prometheus, OTEL Collector, Grafana                                                           |
| Full map            | FROZEN in `07_Operations/ENVIRONMENT_V1.md`                                                                                                |

---

## 12. Certification Chain (Frozen Evidence)

| Cert       | Date           | Verdict                                                              |
| ---------- | -------------- | -------------------------------------------------------------------- |
| CERT-001   | 2026-08-05     | 🟡 conditions                                                        |
| CERT-002   | 2026-08-06     | 🟢 Enterprise Certified                                              |
| OS-001     | 2026-08-07     | 🟢 Enterprise OS Integration complete                                |
| OS-002     | 2026-08-07     | 🟢 FINAL OS CERTIFICATION (6,150 tests, 28/28 coverage, build green) |
| REL-001    | 2026-08-06     | 🟡 Release Ready with Operational Notes                              |
| **OS-003** | **2026-08-07** | **🟢 VEDMOULYA OS v1.0 FROZEN**                                      |

---

_Manifest frozen at release commit `dd4dffd3d7be6175b9bf37c0d122c642d937c942` on 2026-08-07._
