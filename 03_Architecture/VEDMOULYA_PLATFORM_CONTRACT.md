# VEDMOULYA PLATFORM CONTRACT

> The public, frozen contract of **VEDMOULYA OS v1.0** — what the OS provides,
> what it does not provide, and the integration boundaries every consumer must
> follow.
> Owner: Chief Release Architect · Sprint: OS-003 (EPIC-005) · Date: 2026-08-07
> Status: 🟢 **FROZEN**

---

## 1. What the OS Provides

VEDMOULYA OS v1.0 is the **Execution Operating System** — a governed AI
execution platform where every AI interaction flows through the Enterprise
Intelligence layer. It provides:

### 1.1 Core Platform

| Capability            | Contract                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Life OS Dashboard** | Unified view of goals, tasks, execution, decisions, insights, and journey across modules                     |
| **Identity & Auth**   | User registration, login, JWT sessions, refresh tokens, Google OAuth, bcrypt password hashing                |
| **Module Shells**     | Career · Learning · Business · Marketplace · Notifications modules with service + UI layers                  |
| **AI Content Agency** | Client, brand, project, calendar, content generation, review, approval, delivery, invoice, payment workflow  |
| **Client Ops**        | CRM (leads, contacts, tasks), proposals, contracts, quotations, invoices, payments, documents, portal access |
| **Shared UI System**  | `@vedmoulya/ui` component library (DES-010A tokens), Storybook-documented, WCAG AA                           |
| **Mobile Wrapper**    | Capacitor Android wrapper (MOB-001/002): secure storage, haptics, offline cache, dark mode                   |

### 1.2 Enterprise Intelligence Engines (EI-001…EI-010)

| Engine                               | Provides                                                                                                                                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **EI-001 Capability**                | Capability registry, marketplace, composition, dependencies, lifecycle, versioning                                                                                      |
| **EI-002 Provider**                  | Provider registry, scoring, health, availability tiers, capability matrix, benchmarks, model registry                                                                   |
| **EI-003 Context**                   | Context registration, ranking, filtering, compression, assembly, explainability                                                                                         |
| **EI-004 Execution Strategy**        | Strategy creation, validation, budget/token/cost/latency estimation, risk, fallback, capability planning                                                                |
| **EI-005 Execution Orchestrator**    | Execution graph build/validate/optimize, sessions, queue, workers, monitor, recovery, history                                                                           |
| **EI-006 Goal/Task**                 | Goal create/analyze/validate/explain, task decomposition, dependency graph, lifecycle, strategy handoff                                                                 |
| **EI-007 Learning**                  | Learning events → models → insights → recommendations → reports (human-approval safety)                                                                                 |
| **EI-008 Enterprise Brain**          | Per-goal decision plans (14 decision types), human-approval gate, handoff to orchestrator                                                                               |
| **EI-009 Knowledge**                 | Governed knowledge items — versioned, validated, trust-scored, relationship-aware, searchable, explainable                                                              |
| **EI-010 Memory**                    | Evolving experience — captured, ranked, compressed, consolidated, retained, retrieved (14 memory classes)                                                               |
| **INT-001 Intelligence Integration** | Cross-engine pipeline build/validate/explain — the typed Enterprise Pipeline                                                                                            |
| **OS-001 OS Integration**            | Engine registry, dependency matrix (acyclic gate), 15-stage pipeline validation, cross-engine pairs (9), diagnostics, `validatePlatform`, performance, health snapshots |

### 1.3 Cross-Cutting Contracts

| Contract                      | Provides                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| **API Gateway (tRPC)**        | 27 routers, auth + IDOR + rate-limit + audit + metrics middleware, zod-validated, ApiResponse envelope |
| **Repository Contracts**      | Per-engine `*Repository` interfaces with InMemory (test) + Postgres (production) implementations       |
| **Production Wiring**         | `createProduction*Repository()` factories — all 23+ stores Postgres-backed                             |
| **Postgres JSONB Registries** | Idempotent `CREATE TABLE IF NOT EXISTS` — migration-ready by construction                              |
| **Seed**                      | `scripts/seed-ei.ts` — idempotent, dry-run supported                                                   |
| **Structured Logging**        | `@vedmoulya/core` JSON logger                                                                          |
| **Metrics**                   | Prometheus registry + `/api/metrics`                                                                   |
| **Tracing**                   | OpenTelemetry integration                                                                              |
| **Health Checks**             | `health.check` · `health.live` · `health.ready` · `health.version`                                     |
| **Rate Limiting**             | 5 tiers: standard 100 · health 200 · search 30 · heavy 20 · auth 10 (per env configurable)             |
| **Security Headers**          | CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy                |
| **Error Handling**            | `Result<T, E>` pattern, `AppError` taxonomy, consistent `ApiResponse` error envelope                   |
| **Feature Flags**             | `@vedmoulya/core` feature flags (social login, AI assistant, marketplace)                              |

---

## 2. What the OS Does NOT Provide

| Not provided                                   | Status           | Boundary                                                                                                   |
| ---------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------- |
| **No chat memory / LLM memory**                | By design        | Memory (EI-010) is evolving _experience_ — not conversation history, not a vector database                 |
| **No vector database**                         | By design        | Retrieval is deterministic (11 memory match modes, 8 knowledge search modes)                               |
| **No fake AI completion**                      | By design        | Real AI calls require provisioned keys; no "AI done" claims without real transport                         |
| **No business application logic in the OS**    | By design        | Business apps (epic EPIC-006+) must consume the OS through published contracts                             |
| **No new engine boundaries**                   | FROZEN           | Post-v1 changes require ADR + impact analysis + migration plan + version increment + regression validation |
| **No direct engine modification for features** | FROZEN           | Business features may not modify engine boundaries                                                         |
| **No auto-scaling / multi-tenant SaaS**        | Out of scope     | Deployment targets: Vercel (web), Railway/VPS (services), managed Postgres/Redis                           |
| **No staging environment**                     | Post-V1          | Documented future work (REL-001)                                                                           |
| **No load-testing / cold-start benchmarks**    | Post-V1          | Documented as known limitations                                                                            |
| **No iOS wrapper**                             | Post-V1          | Android shipped (MOB-001/002); iOS documented in EPIC-007 backlog                                          |
| **No PWA service worker**                      | Post-V1          | No install prompt / offline support (tracked)                                                              |
| **No on-device Android verification**          | Environment note | Capacitor wrapper verified by build + unit tests, not on-device (no SDK on audit machine)                  |

---

## 3. Engine Boundaries

### 3.1 Layering (binding for every engine)

```
types → contracts → domain → infrastructure → application → catalog
```

- **Domain entities have zero infrastructure dependencies** (Clean Architecture, ARC-001)
- **Domain services depend only on contracts** (`*Repository` interfaces, narrow `Engines` port bundles)
- **Application services** orchestrate domain services; **DTOs** are cast at the tRPC boundary
- **Routers** are thin adapters — no business logic, no direct repository use

### 3.2 Consultation Rule

Engines consume each other **only through narrow port contracts**
(`OSEngines`, `MemoryEngines`, `KnowledgeEngines`, `BrainEngines`, ...) injected
as application-service dependencies. **No cross-package domain imports between
engines.** Consultation cycles are informational; the **package build graph is
verified acyclic** at runtime (`dependencies.acyclic === true`).

### 3.3 Ownership

Each engine package owns, in its `src/`:

- **types** — shared type definitions
- **contracts** — repository + port interface contracts
- **domain** — entities, rules, domain services
- **infrastructure** — `InMemory*` (test double) and `Postgres*` (production) implementations
- **application** — application services + DTOs
- **catalog** — seed catalogs

The **gateway** (`services/api`) owns DI wiring — it resolves production
repositories and services. No engine imports another engine's domain.

---

## 4. Integration Contracts

| Integration                 | Contract                                                                                                                                                                                              | Verified       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Pipeline (15 stages)        | Goal → Project → Task Planning → Capability → Knowledge → Memory → Provider → Context → Brain Decision → Strategy → Execution Graph → Execution Session → Learning → Knowledge Update → Memory Update | ✅ OS-001      |
| Cross-engine pairs (9)      | Capability↔Provider · Provider↔Context · Context↔Knowledge · Knowledge↔Memory · Memory↔Learning · Learning↔Brain · Brain↔Strategy · Strategy↔Execution · Execution↔Learning                           | ✅ OS-001      |
| Repository readiness        | Every EI store resolves to a persisted Postgres repository                                                                                                                                            | ✅ OS-002      |
| Acyclic package graph       | No circular dependencies                                                                                                                                                                              | ✅ OS-001 gate |
| Health snapshot persistence | `os_health_registry` Postgres store                                                                                                                                                                   | ✅ OS-001      |

---

## 5. Extension Points

> **FROZEN.** Extension points are the only sanctioned seams for post-v1 work.

| Extension point                                   | How to extend                                                                                                                 | Constraint                                                                             |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **New AI provider**                               | Register in `provider_registry` (EI-002) + implement the `AIProvider` transport adapter when a real call is required          | Must go through Enterprise Intelligence; must respect provider contract; test-parallel |
| **New capability**                                | Register in `capability_registry` (EI-001) + compose from existing capabilities                                               | No new engine boundary                                                                 |
| **New knowledge category**                        | Extend `knowledgeCategoryEnum` (EI-009) via ADR if the category is new                                                        | Breaking-change policy applies                                                         |
| **New memory class**                              | Extend `memory` types (EI-010) via ADR if the class is new                                                                    | Breaking-change policy applies                                                         |
| **New business module**                           | Build as a **consumer** of the frozen OS contracts (new app/service package that calls tRPC/contracts — never modify engines) | EPIC-006+ (POST-V1)                                                                    |
| **New application**                               | Application Factory (APP-001) — EPIC-006                                                                                      | POST-V1                                                                                |
| **Provider Rating / Health / Benchmark**          | Backlog (post-freeze) — build on EI-002/EI-007 data                                                                           | POST-V1                                                                                |
| **EI-005b Budget enforcement & spend dashboards** | Backlog (post-freeze)                                                                                                         | POST-V1                                                                                |

---

## 6. Provider Integration

| Provider aspect   | Contract                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| Transport         | `OpenAIProvider` (real `fetch` to `https://api.openai.com/v1/chat/completions`, Bearer auth) — production |
| Test double       | `MockProvider` — tests/development only, never wired in production paths                                  |
| Registry          | `provider_registry` Postgres JSONB table (EI-002)                                                         |
| Families (frozen) | `openai` · `anthropic` · `google` · `deepseek` · `openrouter` · `ollama` · `mock`                         |
| Selection         | `getProvidersForCapability`, `getFleetHealth`, `getAvailabilityTier`, capability matrix                   |
| Routing           | `capability` (default) · `AI_ROUTING_STRATEGY` env                                                        |
| Fail-fast         | `AI_OPENAI_API_KEY` required in production when AI enabled with default provider                          |
| Budgets           | Token/cost/latency budgets via EI-004 `BudgetEngineService`                                               |
| Retry/fallback    | `AIOrchestrationService` — retry limit 3, fallback rules, timeout mapping, candidate chains               |

---

## 7. Capability Integration

- Capabilities are registered in `capability_registry` (EI-001) with lifecycle,
  version, composition, dependencies, business module, and required AI features.
- Providers map capabilities through the capability matrix (EI-001 ↔ EI-002).
- Context assembly and execution strategy select capabilities by capability
  type (frozen `capabilityAIFeatureEnum`).
- Business modules declare business-module scoping
  (`content-agency`, `learning`, `career`, `marketing`, `business`, `platform`).

---

## 8. Knowledge Integration

- **Authoritative source of governed facts** — every engine consults Knowledge
  (EI-009) through the narrow `KnowledgeEngines` port bundle.
- 14 knowledge categories, 8 search modes, 10 relationship types, trust scoring,
  versioning, lifecycle (draft → review → active → deprecated → archived).
- Knowledge **never** holds chat memory or user-specific experience — that is
  Memory (EI-010), kept architecturally separate but tightly integrated.
- Consumers tracked (`consumerType`: engine, module, user, system).
- Production store: `knowledge_registry` Postgres JSONB.

---

## 9. Memory Integration

- **Evolving experience layer** — captured, ranked, compressed, consolidated,
  retained, retrieved by every engine through the narrow `MemoryEngines` port bundle.
- 14 memory classes, 10 relationship types, 11 match modes, lifecycle
  (captured → validated → consolidated → ranked → compressed → active →
  archived → expired), retention TTLs.
- Memory **never** holds authoritative facts — those live in Knowledge (EI-009).
- No chat memory, no LLM memory, no vector database (by design).
- Production store: `memory_registry` Postgres JSONB.

---

## 10. Execution Integration

- **Goal** (EI-006) → **Strategy** (EI-004) → **Graph/Session** (EI-005) →
  **Learning** (EI-007) chain is the execution spine.
- **Enterprise Brain** (EI-008) sits above: decides (14 decision types per goal),
  human-approves, then hands the plan to the Execution Orchestrator.
- **Execution Strategy** (EI-004) produces strategies with budgets (tokens,
  cost, latency), risk, fallback, capability planning.
- **Execution Orchestrator** (EI-005) builds/validates/optimizes the execution
  graph, creates sessions, runs queue + workers, monitors, recovers, and writes
  history.
- **Learning** (EI-007) records every execution event and produces
  recommendations (human-approval gate).
- Production stores: `goal_registry`, `task_registry`, `execution_strategy_registry`,
  `execution_graph_registry`, `learning_registry`, `brain_registry`.

---

## 11. Application Integration

> The published consumption surface for business applications (EPIC-006+).

| Surface                  | How applications consume the OS                                                                                                                                                                                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **tRPC gateway v1**      | Typed client over `services/api` — `health.*`, `identity.*`, `lifeos.*`, `dashboard.*`, module namespaces, EI namespaces (`capabilities.*`, `providers.*`, `context.*`, `executionStrategy.*`, `orchestrator.*`, `goals.*`, `intelligence.*`, `learningIntelligence.*`, `enterpriseBrain.*`, `knowledge.*`, `memoryIntelligence.*`, `os.*`) |
| **Service HTTP v1**      | OpenAPI REST per domain service (identity, knowledge, memory, decision, execution) at `/api/v1/...`                                                                                                                                                                                                                                         |
| **Shared UI**            | `@vedmoulya/ui` components + DES-010A design tokens                                                                                                                                                                                                                                                                                         |
| **Domain contracts**     | Shared interfaces in `@vedmoulya/domain` + per-engine contract packages                                                                                                                                                                                                                                                                     |
| **Repository contracts** | Per-engine `*Repository` interfaces (Postgres production implementations)                                                                                                                                                                                                                                                                   |

### Application integration rules (binding)

1. Applications must consume the OS **through published contracts** — never
   through direct engine-domain imports.
2. Applications must **not modify engine boundaries** to support a feature.
3. All AI execution must flow through the Enterprise Intelligence layer —
   business modules must never call AI providers directly.
4. New features follow the breaking-change policy (`ARCHITECTURE_FREEZE.md`).
5. Post-v1 application work happens in **EPIC-006 — VEDMOULYA APPLICATION
   PLATFORM** (first sprint APP-001 Application Factory).

---

## 12. Contract Change Policy (Summary)

Any change to this platform contract requires (see `ARCHITECTURE_FREEZE.md`):

1. **ADR** — Architectural Decision Record
2. **Impact analysis** — consumers, tests, docs
3. **Migration plan** — for contract consumers
4. **Version increment** — SemVer (breaking → major)
5. **Regression validation** — full quality gates

_Contract frozen at commit `dd4dffd3d7be6175b9bf37c0d122c642d937c942` on 2026-08-07._
