# APP-001 — Context & Personal Intelligence Fabric Architecture

**VedMoulya Enterprise Operating System — Post-V1 Application Platform**
**Sprint:** EPIC-006 / APP-001 — CONTEXT & PERSONAL INTELLIGENCE FABRIC
**Date:** 2026-08-07
**Mode:** IMPLEMENTATION (Post-V1 application-platform layer, consumes frozen OS contracts)
**Role:** Chief Intelligence Platform Architect

---

## 1. Purpose

APP-001 makes VedMoulya capable of answering, as a reusable platform
capability (not a demo):

> _"Given this user, this goal, this task and this permission set — what
> information, relationships, memories and knowledge are relevant, where did
> they come from, why were they selected, and what is the **minimum useful
> context package** for the next agent/workflow?"_

It establishes the context foundation consumed by APP-002 Agent Builder,
APP-003 Agent Lifecycle, APP-004 Intelligence Trace/Debugger and APP-006
Application Factory. **It is not an intelligence engine** — it is an
application-platform layer that consumes the frozen OS through narrow port
contracts.

---

## 2. Architectural Rule

The frozen OS v1.0 architecture remains authoritative. APP-001 **extends** the
platform through new application-platform contracts; it does **not** fork,
modify, weaken or duplicate any frozen EI/OS contract.

**Reused contracts (unchanged, consumed):**

| Frozen capability                 | Reused via                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| Context Intelligence (EI-003)     | `@vedmoulya/context` DTOs + port contracts                                              |
| Memory Intelligence (EI-010)      | `@vedmoulya/memory-intelligence` `MemorySearchResult` port                              |
| Knowledge Intelligence (EI-009)   | `@vedmoulya/knowledge-intelligence` `KnowledgeSearchResult` port                        |
| Goal & Task Intelligence (EI-006) | `@vedmoulya/goals` `GoalDTO`/`GoalSearchCriteria` ports                                 |
| Capability Registry (EI-001)      | `@vedmoulya/capabilities` catalog + search port                                         |
| Provider Registry (EI-002)        | `@vedmoulya/providers` search port                                                      |
| OS Intelligence (OS-001)          | dependency/lifecycle conventions, health-pass pattern                                   |
| Identity / auth                   | gateway `auth` middleware (JWT), `isAuthenticated`, `assertUserIdMatchesSession` (IDOR) |
| Repositories / DTO / mappers      | package layering + Postgres JSONB pattern of EI-001…EI-010                              |
| UI design system                  | `@vedmoulya/ui` Tabs, shared components, dark mode, 50 kB lazy-view budget              |
| Telemetry                         | gateway request metrics (PH-002)                                                        |

---

## 3. What Existed vs What Was Added (Gap Matrix)

| Requirement                                                                                                                             | Existing?  | Gap → Added                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------- |
| Context retrieval/ranking (EI-003)                                                                                                      | ✅ existed | No duplication — consumed via ports                                 |
| Memory lifecycle (EI-010)                                                                                                               | ✅ existed | No second memory system — consumed via port                         |
| Knowledge facts (EI-009)                                                                                                                | ✅ existed | Consumed via port                                                   |
| Personal relationship graph (user↔goals/projects/tasks/skills/knowledge/memories/documents/apps/preferences/work/learning/AI)           | ❌         | **`PersonalGraphService`** + graph repository                       |
| Business/enterprise context graph (org↔people/teams/clients/projects/processes/apps/documents/policies/knowledge/business-capabilities) | ❌         | **`BusinessGraphService`**                                          |
| Unified Context Fabric abstraction over personal + business + memory + knowledge + permissions + provenance                             | ❌         | **`ContextFabricApplicationService`**                               |
| Hybrid retrieval strategy (keyword + graph + memory + recency + task/user relevance + permission filtering)                             | ❌         | **`ContextSearchService`** + `RetrievalStrategy` interface          |
| Mandatory permission-aware context pipeline (identity → permission → eligible sources → retrieve → filter → rank → package)             | ❌         | **`PermissionEvaluationService`**                                   |
| Context provenance (where/when/why/confidence/permissions)                                                                              | ❌         | **`ProvenanceService`**                                             |
| Human-readable context explanation ("selected because…")                                                                                | ❌         | **`ContextExplanationService`**                                     |
| Minimum-useful context package (relevance + completeness + permission safety + freshness + token efficiency)                            | ❌         | **`ContextAssemblyService`**                                        |
| Replaceable graph backend (future graph DB seam)                                                                                        | ❌         | **`GraphRepository`** abstract interface + In-memory/Postgres impls |
| `contextFabric.*` tRPC namespace                                                                                                        | ❌         | **`ContextFabricRouter`** (11 procedures)                           |
| `/context-fabric` web explorer (8 tabs)                                                                                                 | ❌         | Lazy views, real data flow                                          |
| Seed catalog                                                                                                                            | ❌         | 11th `seed:ei` store (`context_fabric_graph`)                       |

---

## 4. Package Layout

New workspace **`packages/context-fabric`** (`@vedmoulya/context-fabric`),
following the EI-001…EI-010 layering:

```
src/
├── types/            fabric-types.ts          — ContextEntity, ContextRelationship,
│                                                PersonalGraph, BusinessGraph, ContextSource,
│                                                ContextPermission, ContextProvenance,
│                                                ContextRetrievalQuery/Result, ContextRankingResult,
│                                                ContextExplanation, ContextFabricPackage
├── contracts/        fabric-engines.ts        — FabricEngines narrow port bundle (goal/memory/
│                                                knowledge/capability/provider/context ports)
├── domain/
│   ├── rules/        FabricRules.ts           — entity-type/relationship-type catalogs, scoring tables
│   ├── repository/   GraphRepository.ts       — abstract graph seam (future graph DB replaceable)
│   └── services/     PermissionEvaluationService.ts, ProvenanceService.ts, ContextSearchService.ts,
│                     ContextAssemblyService.ts, PersonalGraphService.ts, BusinessGraphService.ts,
│                     ContextExplanationService.ts, FabricHealthService.ts
├── infrastructure/   InMemoryGraphRepository.ts (hermetic test double),
│                     PostgresGraphRepository.ts (JSONB, production default)
├── application/      ContextFabricDTO.ts, ContextFabricApplicationService.ts
├── catalog/          fabric-catalog.ts        — realistic personal + business seed graph
└── index.ts
```

## 5. Domain Model

### 5.1 Entities & Relationships

- **Personal graph** entity types: user, goal, project, task, skill,
  knowledge, memory, document, application, preference, work_history,
  learning_history, ai_interaction.
- **Business graph** entity types: organization, person, team, client,
  project, process, policy, business_capability (+ shared types).
- **Relationship types**: `owns`, `member_of`, `responsible_for`, `uses`,
  `implements`, `describes`, `produces`, `refines`, `depends_on`,
  `related_to`, `similar_to`, `contains` — each with provenance, confidence,
  source, timestamps, lifecycle and permissions.

Every entity carries: id, type, label, summary, owner, scope (personal /
organization), organizationId, source, tags, confidence, importance,
permission model (visibility scope + grantedAt + grantedBy), timestamps.

### 5.2 Permission-Aware Pipeline (mandatory)

```
Identity → Permission evaluation → Eligible sources → Retrieval → Filtering → Ranking → Context package
```

`PermissionEvaluationService.evaluate()` enforces, for every candidate item:

1. **Ownership** — the request userId must own the item (personal scope) or
   belong to the item's organization scope.
2. **Scope** — `organization` items are only reachable when the requester is
   a member of that organization (permission registry).
3. **Visibility** — `private`/`shared`/`public` visibility checks.
4. **Entity-level deny** — explicit denies override shared visibility.

A denied item never reaches retrieval results, ranking, or the context
package. This is the APP-001 security boundary (see §9).

### 5.3 Hybrid Retrieval

`ContextSearchService` implements a **strategy-based** hybrid ranker:

- keyword match (title/label/summary/tags)
- graph relationship boost (nearest-neighbour walking from goal/task/project)
- memory relevance (via the EI-010 `MemorySearchResult` port)
- recency (freshness weight)
- user relevance + task relevance
- permission filtering (mandatory pre-filter)

`RetrievalStrategy` is an interface — ranking can evolve without touching
domain/application contracts (matches "do not hardcode a single retrieval
algorithm").

### 5.4 Minimum Useful Context

`ContextAssemblyService` assembles a `ContextFabricPackage` given goal + task +
user + permissions + query, optimizing for relevance + completeness +
permission safety + freshness + **token efficiency** (token-budget-aware
truncation and preview selection, deterministic — no LLM required).

### 5.5 Provenance & Explanation

Every selected item answers _where / when / which source / why / what
confidence / what permissions_. `ContextExplanationService` produces
human-readable explanations ("Selected because: directly related to the
current goal · belongs to the current project · recently updated · user has
access · high semantic relevance") — the future basis of APP-004
Intelligence Trace.

---

## 6. Glean-Inspired Concepts Adopted

| Concept                           | Adopted as                                  | Native to VedMoulya via                     |
| --------------------------------- | ------------------------------------------- | ------------------------------------------- |
| Personal intelligence graph       | `PersonalGraphService`                      | existing persistence strategy, no graph DB  |
| Enterprise/business context graph | `BusinessGraphService`                      | same repository seam                        |
| Unified context fabric            | `ContextFabricApplicationService`           | extends EI-003, does not replace it         |
| Hybrid retrieval                  | `ContextSearchService` + strategy interface | deterministic ranker, no vector DB required |
| Permission-aware context          | `PermissionEvaluationService`               | reuses gateway auth + IDOR middleware       |
| Context provenance                | `ProvenanceService`                         | first-class provenance on every entity/edge |
| Context explanation               | `ContextExplanationService`                 | human-readable reasons for APP-004          |

**Architectural deviations from Glean:** no graph database is introduced for
architectural appearance; no LLM is mandatory for retrieval (deterministic
first, AI behind existing provider contracts only); no separate index/crawl
pipeline (the fabric indexes existing OS registries through ports).

---

## 7. Persistence Decision

- **`GraphRepository`** abstract interface — the seam for a future graph
  backend (Neo4j/AGE/Kùzu) without changing domain/application contracts.
- **`PostgresGraphRepository`** (production default via
  `createProductionContextFabricRepository`) — JSONB tables
  (`context_fabric_entities`, `context_fabric_relationships` keyed by
  `(collection, id)`), matching the frozen `DATABASE_V1.md` pattern:
  `CREATE TABLE IF NOT EXISTS`, indexes on (type, owner, organization_id,
  scope), migration-ready.
- **`InMemoryGraphRepository`** — hermetic test double.
- **Tradeoff documented:** Postgres JSONB relational tables are chosen over a
  graph store because scale does not justify the operational cost; the seam
  makes the future swap non-breaking.

---

## 8. API Contract (`contextFabric.*`)

11 procedures behind **auth + IDOR + rate-limit** middleware, zod-validated,
DTO boundaries (never exposes domain objects):

| Procedure                 | Input                                                                                      | Purpose                        |
| ------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------ |
| `getPersonalGraph`        | userId                                                                                     | personal intelligence graph    |
| `getBusinessGraph`        | userId, organizationId?                                                                    | enterprise context graph       |
| `search`                  | userId, query, goalId?/projectId?/taskId?, sources?, types?, tags?, minConfidence?, limit? | hybrid permission-gated search |
| `getEntity`               | userId, entityId                                                                           | single entity + provenance     |
| `getRelationships`        | userId, entityId, maxDepth?                                                                | relationships (depth-limited)  |
| `buildContextPackage`     | userId, query, goalId?/taskId?, tokenBudget?                                               | minimum useful context         |
| `explainContextSelection` | userId, entityId, goalId?/projectId?/taskId?                                               | human-readable reasons         |
| `getProvenance`           | userId, entityId                                                                           | full provenance trail          |
| `getPermissions`          | userId, entityId, organizationId?                                                          | permission evaluation result   |
| `getSources`              | userId                                                                                     | registered context sources     |
| `getHealth`               | userId                                                                                     | fabric health metrics          |

---

## 9. Security Model

- Every procedure user-scoped → gateway IDOR guard (`assertUserIdMatchesSession`).
- Retrieval is **permission-filtered before ranking** — a user can never
  receive context they are not authorized to access (cross-user, cross-tenant,
  unauthorized graph traversal, unauthorized document/memory leakage are all
  covered by `PermissionEvaluationService` unit tests).
- No secrets; no new env vars; rate-limit tiers reuse the frozen gateway tiers.
- The fabric is provider-independent; AI (semantic understanding, entity
  extraction, relationship inference, query expansion, summarization) stays
  behind existing AI/provider contracts and is never mandatory.

---

## 10. Web Experience (`/context-fabric`)

Enterprise Context Fabric Explorer — **8 tabs**: Overview, Personal Graph,
Business Graph, Search, Context Package, Provenance, Permissions, Diagnostics.

- Real data flow end-to-end (tRPC → application service → seeded graph +
  engine ports), not a static mockup.
- Loading skeletons, meaningful empty states, error states, retry.
- Dark mode, mobile-responsive, accessible controls, clear hierarchy.
- Lazy-loaded views — route bundle **2.36 kB** (50 kB budget).
- Search is interactive with real filters; context explanations are
  human-readable; graph relationships are presented as structured,
  understandable relationship lists.
- Navigation: new sidebar entry under Enterprise Intelligence in
  `navigation-store.ts` + `AppShell`.

## 11. Storybook

`apps/web/src/stories/ContextFabric.stories.tsx` documents the shared
presentational components with **normal / empty / loading / error /
restricted / high-volume** states: ContextFabricOverview, PersonalGraph,
BusinessGraph, ContextSearch, ContextResult, ContextPackage, ProvenancePanel,
PermissionBadge, ContextExplanation, RelationshipView.

---

## 12. Tests & Coverage

- **9 test files / 86 tests** in `packages/context-fabric` — graph entities,
  relationships, provenance, permissions, retrieval, ranking, context
  assembly, explanation, repositories (in-memory + hermetic Postgres), and the
  application service (including cross-user/cross-tenant denial cases).
- **Package coverage:** 93.17% statements · 81.14% branches · 97.08% functions
  (≥80% gate, ≥90% on permission/context-selection logic).
- **Gateway:** `ContextFabricRouter` unit suite + registry wiring tests
  (auth + IDOR + rate limits through the real tRPC pipeline) + production
  wiring test.
- **Regression:** full workspace suite green — **487 files / 6 309 tests**;
  coverage gate **29/29 workspaces ≥80%** (services/api function coverage
  raised to 80.72% via the `contextFabric` registry test).

## 13. Performance

- No N+1 (repository loads are bounded; relationships are depth-limited
  `maxDepth ≤ 5`).
- Search/assembly are single-pass, permission-pre-filtered, limit-capped.
- Token estimation is deterministic (char-based) — measurable and
  budget-enforced; no uncontrolled graph traversal.
- Route bundle 2.36 kB; page first-load 164 kB total (budget-compliant).

## 14. Seed

`scripts/seed-ei.ts` gains the **11th store** (`context_fabric_graph`): 22
entities across personal + business graphs with 27 relationships referencing
the seed goals/capabilities/context/identities.

---

## 15. Future Work

- APP-002 Agent Builder, APP-003 Agent Lifecycle, APP-004 Intelligence
  Trace/Debugger, APP-006 Application Factory consume `ContextFabricPackage`.
- Optional: pgvector semantic retrieval behind the `RetrievalStrategy`
  interface; graph-store backend behind `GraphRepository`.

_"Empower every determined individual to build a sustainable livelihood
through knowledge, execution, and intelligent technology."_
