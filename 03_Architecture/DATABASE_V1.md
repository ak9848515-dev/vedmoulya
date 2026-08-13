# DATABASE V1 — RELEASE RECORD

> The frozen database release record for **VEDMOULYA OS v1.0**.
> Owner: Chief Release Architect · Sprint: OS-003 (EPIC-005) · Date: 2026-08-07
> Status: 🟢 **FROZEN**

---

## 1. Overview

VEDMOUYA OS v1.0 uses **PostgreSQL 16** as the production database. Every
Enterprise Intelligence store is a **JSONB registry** table created idempotently
(`CREATE TABLE IF NOT EXISTS`) by its Postgres repository — **migration-ready by
construction**, no migration framework required. Service modules (identity,
knowledge, memory, decision, execution, content-agency, client-ops) use their own
per-service `initializeDatabase()` DI wiring.

---

## 2. Schemas

| Schema                | Owner                                                                                                            | Purpose                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `public` (default)    | Postgres                                                                                                         | All EI registries + service stores (single-database, multi-table) |
| Per-service DBs (dev) | `vedmoulya_identity` · `vedmoulya_knowledge` · `vedmoulya_decision` · `vedmoulya_execution` · `vedmoulya_memory` | Dev-local separation (`.env.example`)                             |

> Production uses a single Postgres instance with all tables in the default
> schema; the dev `.env.example` splits service DBs for local isolation.

---

## 3. Tables (EI JSONB Registries — frozen)

| Table                         | Engine         | Repository                            | Key                | Indexes                                     |
| ----------------------------- | -------------- | ------------------------------------- | ------------------ | ------------------------------------------- |
| `capability_registry`         | EI-001         | `PostgresCapabilityRepository`        | `(collection, id)` | supporting filter indexes                   |
| `provider_registry`           | EI-002         | `PostgresProviderRepository`          | `(collection, id)` | supporting filter indexes                   |
| `context_registry`            | EI-003         | `PostgresContextRepository`           | `(collection, id)` | supporting filter indexes                   |
| `execution_strategy_registry` | EI-004         | `PostgresExecutionStrategyRepository` | `(collection, id)` | supporting filter indexes                   |
| `execution_graph_registry`    | EI-005         | `PostgresExecutionGraphRepository`    | `(collection, id)` | supporting filter indexes                   |
| `pipeline_registry`           | EI-006/INT-001 | `PostgresPipelineRepository`          | `(collection, id)` | supporting filter indexes                   |
| `goal_registry`               | EI-006         | `PostgresGoalRepository`              | `(collection, id)` | supporting filter indexes                   |
| `task_registry`               | EI-006         | `PostgresTaskRepository`              | `(collection, id)` | supporting filter indexes                   |
| `learning_registry`           | EI-007         | `PostgresLearningRepository`          | `(collection, id)` | supporting filter indexes                   |
| `brain_registry`              | EI-008         | `PostgresBrainRepository`             | `(collection, id)` | supporting filter indexes                   |
| `knowledge_registry`          | EI-009         | `PostgresKnowledgeRepository`         | `(collection, id)` | filter indexes (items + relationship edges) |
| `memory_registry`             | EI-010         | `PostgresMemoryRepository`            | `(collection, id)` | filter indexes (items + relationship edges) |
| `os_health_registry`          | OS-001         | `PostgresOSRepository`                | `(collection, id)` | `checkedAt` index                           |

### Service stores (per-service DI)

| Store                | Service                   | Repository                        |
| -------------------- | ------------------------- | --------------------------------- |
| Identity store       | `services/identity`       | `PostgresIdentityRepository`      |
| Knowledge store      | `services/knowledge`      | `PostgresKnowledgeRepository`     |
| Memory store         | `services/memory`         | `PostgresMemoryRepository`        |
| Decision store       | `services/decision`       | `PostgresDecisionRepository`      |
| Execution store      | `services/execution`      | `PostgresExecutionRepository`     |
| Content-Agency store | `services/content-agency` | `PostgresContentAgencyRepository` |
| Client-Ops store     | `services/content-agency` | `PostgresClientOpsRepository`     |

---

## 4. Indexes

| Index                          | Table                                                                  | Purpose                                                                     |
| ------------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Primary key `(collection, id)` | every EI registry                                                      | Unique entity lookup per collection                                         |
| Filter indexes                 | capability/provider/context/strategy/goal/task/pipeline/learning/brain | Fast filtered queries (status, category, priority, capability, family, ...) |
| Relationship edge indexes      | `knowledge_registry`, `memory_registry`                                | Graph traversal (source/target/type)                                        |
| `checkedAt` index              | `os_health_registry`                                                   | Health snapshot history queries                                             |

---

## 5. Constraints

| Constraint         | Enforcement                                                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Primary key        | `(collection, id)` on every EI registry                                                                                                  |
| Domain validation  | Service-layer CHECK-style validation (lifecycle, type, priority, status enums)                                                           |
| State transitions  | Domain rules (`ExecutionRules`, `GoalLifecycleService`, `KnowledgeLifecycleService`, `MemoryLifecycleService`, ...) — cannot be bypassed |
| Transactions       | Per-operation transactions; gateway uses per-store commits (single-writer-per-store)                                                     |
| Connection pooling | `DatabaseConnection` — poolMin/poolMax, idle timeout, max lifetime, graceful close                                                       |

---

## 6. Migrations

| Field           | Contract                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Strategy        | **Migration-ready by construction** — every Postgres repository creates its table with `CREATE TABLE IF NOT EXISTS` (idempotent, safe on every startup) |
| Framework       | None required (no Drizzle Kit migration files for EI stores; service modules use `initializeDatabase()`)                                                |
| Idempotency     | Re-running startup/seed never duplicates rows                                                                                                           |
| Schema version  | `2026-08-07-v1.0.0` (frozen)                                                                                                                            |
| Breaking change | Requires ADR + migration plan + version increment (per `ARCHITECTURE_FREEZE.md`)                                                                        |

---

## 7. Repositories

| Repository             | Interface                         | InMemory (test)                       | Postgres (production)                 |
| ---------------------- | --------------------------------- | ------------------------------------- | ------------------------------------- |
| Identity               | `IdentityRepository`              | `InMemoryIdentityRepository`          | `PostgresIdentityRepository`          |
| Memory                 | `MemoryRepository`                | `InMemoryMemoryRepository`            | `PostgresMemoryRepository`            |
| Decision               | `DecisionRepository`              | `InMemoryDecisionRepository`          | `PostgresDecisionRepository`          |
| Execution              | `ExecutionRepository`             | `InMemoryExecutionRepository`         | `PostgresExecutionRepository`         |
| Knowledge              | `KnowledgeRepository`             | `InMemoryKnowledgeRepository`         | `PostgresKnowledgeRepository`         |
| Content-Agency         | `ContentAgencyRepository`         | `InMemoryContentAgencyRepository`     | `PostgresContentAgencyRepository`     |
| Client-Ops             | `ClientOpsRepository`             | `InMemoryClientOpsRepository`         | `PostgresClientOpsRepository`         |
| Provider               | `ProviderRepository`              | `InMemoryProviderRepository`          | `PostgresProviderRepository`          |
| Capability             | `CapabilityRepository`            | `InMemoryCapabilityRepository`        | `PostgresCapabilityRepository`        |
| Context                | `ContextRepository`               | `InMemoryContextRepository`           | `PostgresContextRepository`           |
| Execution Strategy     | `ExecutionStrategyRepository`     | `InMemoryExecutionStrategyRepository` | `PostgresExecutionStrategyRepository` |
| Goal                   | `GoalRepository`                  | `InMemoryGoalRepository`              | `PostgresGoalRepository`              |
| Task                   | `TaskRepository`                  | `InMemoryTaskRepository`              | `PostgresTaskRepository`              |
| Pipeline               | `PipelineRepository`              | `InMemoryPipelineRepository`          | `PostgresPipelineRepository`          |
| Learning               | `LearningRepository`              | `InMemoryLearningRepository`          | `PostgresLearningRepository`          |
| Brain                  | `BrainRepository`                 | `InMemoryBrainRepository`             | `PostgresBrainRepository`             |
| Knowledge Intelligence | `KnowledgeIntelligenceRepository` | `InMemoryKnowledgeRepository`         | `PostgresKnowledgeRepository`         |
| Memory Intelligence    | `MemoryIntelligenceRepository`    | `InMemoryMemoryRepository`            | `PostgresMemoryRepository`            |
| OS                     | `OSIntelligenceRepository`        | `InMemoryOSRepository`                | `PostgresOSRepository`                |
| Execution Graph        | `ExecutionGraphRepository`        | `InMemoryExecutionGraphRepository`    | `PostgresExecutionGraphRepository`    |
| Execution Session      | `ExecutionSessionRepository`      | `InMemoryExecutionSessionRepository`  | `PostgresExecutionSessionRepository`  |
| Execution Queue        | `ExecutionQueueRepository`        | `InMemoryExecutionQueueRepository`    | `PostgresExecutionQueueRepository`    |
| Execution History      | `ExecutionHistoryRepository`      | `InMemoryExecutionHistoryRepository`  | `PostgresExecutionHistoryRepository`  |
| Worker Registry        | `WorkerRegistry`                  | `InMemoryWorkerRegistry`              | `PostgresWorkerRegistry`              |

**Production wiring:** `services/api/src/infrastructure/ProductionRepositories.ts`
resolves every engine store to its production Postgres factory
(`createProduction*Repository()`). **No in-memory repository is a production
default** — in-memory implementations are hermetic test doubles injected only in
tests (OS-002 §7).

---

## 8. Seed Data

| Field          | Contract                                                                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Script         | `scripts/seed-ei.ts`                                                                                                                                                            |
| Stores seeded  | 10 EI catalogs + OS snapshot: capability, provider, context, execution-strategy, goal, learning, brain, knowledge (+relationships), memory (+relationships), os_health_registry |
| Idempotency    | `INSERT … ON CONFLICT (id) DO UPDATE` — re-running updates, never duplicates                                                                                                    |
| Flags          | `--dry-run` (print plan, connect to nothing) · `--only capabilities,providers` · `EI_DATABASE_URL`                                                                              |
| URL resolution | `EI_DATABASE_URL` → `IDENTITY_DATABASE_URL` → `postgres://localhost:5432/vedmoulya`                                                                                             |
| Run            | `npm run seed:ei`                                                                                                                                                               |

---

## 9. Production Requirements

| Requirement      | Value                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------- |
| Database         | PostgreSQL 16 (managed provider recommended: Railway / RDS / Supabase)                 |
| Connection URL   | `IDENTITY_DATABASE_URL` (all EI stores share `config.database.url`)                    |
| Fail-fast        | `IDENTITY_DATABASE_URL` required (no localhost default) outside `NODE_ENV=development` |
| Pool             | `max: 5`, `idle_timeout: 30`, `max_lifetime: 1800` (EI stores)                         |
| Application name | Per-engine `application_name` (e.g. `vedmoulya-provider-registry`)                     |
| Table creation   | Idempotent `CREATE TABLE IF NOT EXISTS` on startup (fire-and-forget with warn log)     |
| Seed             | Run `npm run seed:ei` after first deploy to populate platform catalogs                 |

---

## 10. Development Requirements

| Requirement | Value                                                                       |
| ----------- | --------------------------------------------------------------------------- |
| Local DB    | `docker-compose.yml` — Postgres 16 container                                |
| Dev URLs    | `postgres://postgres:postgres@localhost:5432/vedmoulya_*` (per-service DBs) |
| Tests       | In-memory repositories injected explicitly (hermetic, no DB required)       |
| Seed        | `npm run seed:ei -- --dry-run` to preview; `npm run seed:ei` to apply       |
| CI          | `postgres://ci:ci@db.ci.internal:5432/vedmoulya_ci` (provisioned in CI)     |

---

## 11. Backup Expectations

| Field        | Contract                                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| Backup tool  | `scripts/backup.sh` (documented in `07_Operations/BACKUP.md` + `docs/runbooks/backup-restore-runbook.md`) |
| Frequency    | Daily full backup (recommended); point-in-time recovery via managed provider                              |
| Scope        | All EI registries + service stores (single Postgres instance)                                             |
| Verification | Restore test on a staging/scratch instance before relying on a backup                                     |
| Retention    | Per managed-provider policy (recommended ≥ 7 days + monthly archive)                                      |

---

## 12. Recovery Expectations

| Field              | Contract                                                                    |
| ------------------ | --------------------------------------------------------------------------- |
| Recovery tool      | `scripts/backup.sh` restore + `docs/runbooks/backup-restore-runbook.md`     |
| Rollback           | `docs/runbooks/rollback-runbook.md` + `docs/ops/ROLLBACK_GUIDE.md`          |
| Idempotent startup | Re-running the app re-creates missing tables (`CREATE TABLE IF NOT EXISTS`) |
| Seed re-apply      | `npm run seed:ei` re-populates platform catalogs idempotently               |
| Data loss window   | RPO = backup frequency (daily recommended); RTO = restore time              |
| Point-in-time      | Managed provider PITR recommended for production                            |

---

## 13. Breaking-Change Policy (Database)

Any change to a **frozen table, key, index, constraint, repository interface, or
seed contract** requires:

1. ADR · 2. Impact analysis · 3. Migration plan · 4. Version increment (major)
2. Regression validation — per `ARCHITECTURE_FREEZE.md` §6.

_Database record frozen at commit `dd4dffd3d7be6175b9bf37c0d122c642d937c942` on
2026-08-07._
