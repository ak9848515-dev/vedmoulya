# API V1 CONTRACT

> The frozen API contract snapshot for **VEDMOULYA OS v1.0** — every production
> namespace, its purpose, procedures, authentication, authorization, rate
> limits, validation, and response/error contracts.
> Owner: Chief Release Architect · Sprint: OS-003 (EPIC-005) · Date: 2026-08-07
> Status: 🟢 **FROZEN**

---

## 1. API Topology

VedMoulya exposes **two API surfaces**:

1. **API Gateway (tRPC)** — the primary typed client surface, served by the
   Next.js app at `/api/trpc/*`. 27 routers, typed procedures, zod-validated.
2. **Service HTTP APIs (OpenAPI 3.1)** — per-domain REST endpoints served by
   each backend service at `/api/v1/*` for inter-service and external
   integrations.

### 1.1 Versioning

| Surface           | Version                   | Breaking-change rule                        |
| ----------------- | ------------------------- | ------------------------------------------- |
| Gateway tRPC      | **v1** (namespaces below) | Bump major (2.x) via breaking-change policy |
| Service HTTP      | **v1** (`/api/v1/`)       | Bump to `/v2/` via breaking-change policy   |
| Response envelope | `ApiResponse` (frozen)    | Never changed at v1                         |

### 1.2 Transport & conventions

- Endpoint: `POST /api/trpc/<procedure.path>` (tRPC v11 HTTP)
- Auth: `Authorization: Bearer <jwt>`
- Content-Type: `application/json`
- Rate limits: enforced by gateway middleware (429 on exceed)
- Health: `health.*` procedures are public; everything else requires auth

---

## 2. Gateway Rate-Limit Tiers (frozen)

| Tier       | Default max | Window (ms) | Applied to                                                     |
| ---------- | ----------- | ----------- | -------------------------------------------------------------- |
| `standard` | 100         | 60,000      | Default for protected procedures                               |
| `heavy`    | 20          | 60,000      | Expensive operations (assemble, compress, generate, analytics) |
| `search`   | 30          | 60,000      | Search procedures                                              |
| `health`   | 200         | 60,000      | Health checks                                                  |
| `auth`     | 10          | 60,000      | Authentication procedures                                      |

Overridable via env: `RATE_LIMIT_STANDARD_MAX`, `RATE_LIMIT_HEAVY_MAX`,
`RATE_LIMIT_SEARCH_MAX`, `RATE_LIMIT_HEALTH_MAX`, `RATE_LIMIT_AUTH_MAX`
(+ `*_WINDOW_MS`).

---

## 3. Authentication & Authorization (frozen)

| Field                    | Contract                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| **Authentication**       | JWT via `middleware/auth.ts` (`isAuthenticated`); unauthenticated → `UNAUTHORIZED`               |
| **Authorization / IDOR** | `assertUserIdMatchesSession` on every user-scoped procedure; cross-user → `FORBIDDEN`            |
| **Session**              | Access token `AUTH_JWT_EXPIRES_IN` (default 15m), refresh `AUTH_REFRESH_EXPIRES_IN` (default 7d) |
| **Password**             | bcrypt, `AUTH_BCRYPT_ROUNDS` (default 12)                                                        |
| **Social**               | Google OAuth (behind `FF_SOCIAL_LOGIN_ENABLED`)                                                  |
| **OS namespace**         | Platform-wide by design (documented) — requires auth, but not user-scoped IDOR                   |
| **Public procedures**    | `health.check` · `health.live` · `health.ready` · `health.version` · `metrics.snapshot`          |

---

## 4. Input Validation (frozen)

- **Every procedure** declares a zod input schema at the tRPC boundary
  (`RouterRegistry.ts` — 3,297 lines of typed zod schemas).
- **Business rules are re-validated in application/domain services.**
- Invalid input → `BAD_REQUEST` (validation error contract).
- Frozen enums (subset): `capabilityAIFeatureEnum`, `providerFamilyEnum`,
  `goalCategoryEnum`, `goalStatusEnum`, `contextSourceEnum`, `contextCategoryEnum`,
  `contextPriorityEnum`, `compressionStrategyEnum`, `strategyPriorityEnum`,
  `executionModeEnum`, `orchestratorFlowTypeEnum`, `learningCategoryEnum`,
  `learningOutcomeEnum`, `brainDecisionTypeEnum`, `brainDecisionStatusEnum`,
  `knowledgeCategoryEnum`, `knowledgeSourceTypeEnum`, `knowledgeLifecycleEnum`,
  `knowledgeValidationEnum`, `knowledgeRelationshipTypeEnum`, `memoryClassEnum`,
  `memoryLifecycleEnum`.

---

## 5. Response & Error Contracts (frozen)

### 5.1 Success envelope

```json
{
  "success": true,
  "data": { "...": "procedure-specific DTO" }
}
```

- All router responses run through `ResponseMapper.fromServiceResult`.
- DTOs are cast at the tRPC boundary (JSON-safe shapes) — no domain objects leak.

### 5.2 Error envelope

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED | FORBIDDEN | BAD_REQUEST | TOO_MANY_REQUESTS | NOT_FOUND | INTERNAL_SERVER_ERROR | ...",
    "message": "human-readable message",
    "details": {}
  }
}
```

### 5.3 HTTP status mapping

| tRPC code               | HTTP | When                                              |
| ----------------------- | ---- | ------------------------------------------------- |
| `UNAUTHORIZED`          | 401  | Missing/invalid JWT                               |
| `FORBIDDEN`             | 403  | Cross-user access attempt (IDOR)                  |
| `BAD_REQUEST`           | 400  | Zod validation failure / invalid input            |
| `TOO_MANY_REQUESTS`     | 429  | Rate limit exceeded                               |
| `NOT_FOUND`             | 404  | Missing entity                                    |
| `INTERNAL_SERVER_ERROR` | 500  | Unexpected failure (logged via structured logger) |

---

## 6. Production Namespaces (27 routers)

> Procedures below are the frozen **v1 contract**. Namespaces are grouped by
> router; every procedure is authenticated (JWT + IDOR + rate-limit + zod)
> unless marked PUBLIC.

### 6.1 `health.*` — PUBLIC

**Purpose:** Liveness / readiness / version probes for infrastructure.

| Procedure        | Type  | Auth   | Rate tier | Input |
| ---------------- | ----- | ------ | --------- | ----- |
| `health.check`   | query | PUBLIC | health    | void  |
| `health.live`    | query | PUBLIC | health    | void  |
| `health.ready`   | query | PUBLIC | health    | void  |
| `health.version` | query | PUBLIC | health    | void  |

### 6.2 `metrics.*`

**Purpose:** Runtime metrics snapshot.

| Procedure           | Type  | Auth   | Rate tier | Input  |
| ------------------- | ----- | ------ | --------- | ------ |
| `metrics.dashboard` | query | auth   | standard  | userId |
| `metrics.lifecycle` | query | auth   | standard  | userId |
| `metrics.snapshot`  | query | PUBLIC | standard  | void   |

### 6.3 `identity.*`

**Purpose:** Authentication — register, login, profile, sessions.

| Procedure                                                         | Type     | Auth | Rate tier | Input (excerpt) |
| ----------------------------------------------------------------- | -------- | ---- | --------- | --------------- |
| `identity.getProfile`                                             | query    | auth | standard  | userId          |
| `identity.updateProfile`                                          | mutation | auth | standard  | userId, updates |
| (auth endpoints served via HTTP routes `/api/v1/identity/auth/*`) | —        | —    | —         | —               |

### 6.4 `lifeos.*`

**Purpose:** Life OS orchestration — snapshot, view model, global search, navigation, config, cache.

| Procedure                | Type     | Auth | Rate tier | Input (excerpt)                                      |
| ------------------------ | -------- | ---- | --------- | ---------------------------------------------------- |
| `lifeos.getSnapshot`     | query    | auth | standard  | userId                                               |
| `lifeos.getViewModel`    | query    | auth | heavy     | userId                                               |
| `lifeos.globalSearch`    | query    | auth | search    | searchInput (categories, query, sources, maxResults) |
| `lifeos.invalidateCache` | mutation | auth | standard  | userId                                               |
| `lifeos.getNavigation`   | query    | auth | standard  | void                                                 |
| `lifeos.updateConfig`    | mutation | auth | standard  | configUpdate (userId, module, config)                |
| `lifeos.getConfig`       | query    | auth | standard  | userId                                               |
| `lifeos.getCacheMetrics` | query    | auth | standard  | void                                                 |

### 6.5 `dashboard.*`

**Purpose:** Life OS dashboard — sections, focus, execution, decisions, insights, refresh.

| Procedure                   | Type     | Auth | Rate tier | Input (excerpt) |
| --------------------------- | -------- | ---- | --------- | --------------- |
| `dashboard.getDashboard`    | query    | auth | standard  | userId          |
| `dashboard.getViewModel`    | query    | auth | standard  | userId          |
| `dashboard.getIdentity`     | query    | auth | standard  | userId          |
| `dashboard.getFocus`        | query    | auth | standard  | userId          |
| `dashboard.getExecution`    | query    | auth | heavy     | userId          |
| `dashboard.getDecisions`    | query    | auth | standard  | userId          |
| `dashboard.getInsights`     | query    | auth | standard  | userId          |
| `dashboard.refreshSection`  | mutation | auth | standard  | userId, section |
| `dashboard.invalidateCache` | mutation | auth | standard  | userId          |

### 6.6 `career.*`

**Purpose:** Career module — career view, skills, gaps, recommendations, jobs.

| Procedure                | Type     | Auth | Rate tier | Input (excerpt) |
| ------------------------ | -------- | ---- | --------- | --------------- |
| `career.getCareer`       | query    | auth | standard  | userId          |
| `career.getViewModel`    | query    | auth | standard  | userId          |
| `career.getConfig`       | query    | auth | standard  | userId          |
| `career.invalidateCache` | mutation | auth | standard  | userId          |

### 6.7 `learning.*`

**Purpose:** Learning module — learning path view, progress, config.

| Procedure                  | Type     | Auth | Rate tier | Input (excerpt) |
| -------------------------- | -------- | ---- | --------- | --------------- |
| `learning.getLearning`     | query    | auth | standard  | userId          |
| `learning.getViewModel`    | query    | auth | standard  | userId          |
| `learning.getConfig`       | query    | auth | standard  | userId          |
| `learning.invalidateCache` | mutation | auth | standard  | userId          |

### 6.8 `business.*`

**Purpose:** Business module — analytics, KPIs, goals, finances.

| Procedure                  | Type     | Auth | Rate tier | Input (excerpt) |
| -------------------------- | -------- | ---- | --------- | --------------- |
| `business.getBusiness`     | query    | auth | standard  | userId          |
| `business.getViewModel`    | query    | auth | standard  | userId          |
| `business.getConfig`       | query    | auth | standard  | userId          |
| `business.invalidateCache` | mutation | auth | standard  | userId          |

### 6.9 `marketplace.*`

**Purpose:** Marketplace module — asset catalog, views, config.

| Procedure                     | Type     | Auth | Rate tier | Input (excerpt) |
| ----------------------------- | -------- | ---- | --------- | --------------- |
| `marketplace.getMarketplace`  | query    | auth | standard  | userId          |
| `marketplace.getViewModel`    | query    | auth | standard  | userId          |
| `marketplace.getConfig`       | query    | auth | standard  | userId          |
| `marketplace.invalidateCache` | mutation | auth | standard  | userId          |

### 6.10 `search.*`

**Purpose:** Cross-domain search.

| Procedure       | Type  | Auth | Rate tier | Input (excerpt)                               |
| --------------- | ----- | ---- | --------- | --------------------------------------------- |
| `search.global` | query | auth | search    | searchInput (query, categories, sources, ...) |
| `search.recent` | query | auth | search    | userId                                        |

### 6.11 `notifications.*`

**Purpose:** User notifications.

| Procedure               | Type     | Auth | Rate tier | Input (excerpt)        |
| ----------------------- | -------- | ---- | --------- | ---------------------- |
| `notifications.list`    | query    | auth | standard  | userId                 |
| `notifications.dismiss` | mutation | auth | standard  | userId, notificationId |

### 6.12 `configuration.*`

**Purpose:** User/workspace configuration.

| Procedure              | Type     | Auth | Rate tier | Input (excerpt) |
| ---------------------- | -------- | ---- | --------- | --------------- |
| `configuration.get`    | query    | auth | standard  | userId          |
| `configuration.update` | mutation | auth | standard  | configUpdate    |

### 6.13 `contentAgency.*`

**Purpose:** AI Content Agency — clients, brands, projects, content, calendar, invoices, analytics.

| Procedure                                                                                               | Type           | Auth | Rate tier | Input (excerpt)     |
| ------------------------------------------------------------------------------------------------------- | -------------- | ---- | --------- | ------------------- |
| `contentAgency.getDashboard`                                                                            | query          | auth | standard  | userId              |
| `contentAgency.getAnalytics`                                                                            | query          | auth | heavy     | userId              |
| `contentAgency.listClients` / `getClient` / `createClient` / `updateClient` / `deleteClient`            | CRUD           | auth | standard  | client schemas      |
| `contentAgency.listBrands` / `getBrand` / `upsertBrand` / `deleteBrand`                                 | CRUD           | auth | standard  | brand schemas       |
| `contentAgency.listProjects` / `getProject` / `createProject` / `updateProject` / `deleteProject`       | CRUD           | auth | standard  | project schemas     |
| `contentAgency.listContent` / `getContent` / `createDraft` / `regenerateContent`                        | query/mutation | auth | standard  | content schemas     |
| `contentAgency.generateContent`                                                                         | mutation       | auth | heavy     | generation input    |
| `contentAgency.transitionStatus`                                                                        | mutation       | auth | standard  | contentId, to       |
| `contentAgency.scheduleContent` / `publishContent`                                                      | mutation       | auth | standard  | contentId, schedule |
| `contentAgency.addReview`                                                                               | mutation       | auth | standard  | review input        |
| `contentAgency.getCalendar`                                                                             | query          | auth | standard  | userId              |
| `contentAgency.listInvoices` / `getInvoice` / `createInvoice` / `updateInvoiceStatus` / `deleteInvoice` | CRUD           | auth | standard  | invoice schemas     |
| `contentAgency.exportContent`                                                                           | query          | auth | standard  | contentId, format   |

### 6.14 `clientOps.*`

**Purpose:** Client Operations — CRM, proposals, contracts, quotations, payments, documents, portal, notifications, analytics.

| Procedure                                                                                                                                                                      | Type          | Auth | Rate tier                 | Input (excerpt)                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | ---- | ------------------------- | ------------------------------- |
| `clientOps.listLeads` / `getLead` / `createLead` / `updateLead` / `moveLead` / `archiveLead`                                                                                   | CRUD          | auth | standard                  | lead schemas + `leadStatusEnum` |
| `clientOps.addInteraction` / `addTask` / `completeTask` / `addContact` / `deleteContact`                                                                                       | mutations     | auth | standard                  | per-entity schemas              |
| `clientOps.listProposals` / `getProposal` / `createProposal` / `updateProposal` / `generateProposal` / `sendProposal` / `acceptProposal` / `rejectProposal` / `exportProposal` | CRUDWorkflow  | auth | standard (generate=heavy) | proposal schemas                |
| `clientOps.listContracts` / `getContract` / `createContract` / `updateContract` / `approveContract` / `terminateContract` / `renewContract` / `listExpiringContracts`          | CRUDWorkflow  | auth | standard                  | contract schemas                |
| `clientOps.listQuotations` / `getQuotation` / `createQuotation` / `updateQuotation` / `sendQuotation` / `acceptQuotation` / `rejectQuotation`                                  | CRUDWorkflow  | auth | standard                  | quotation schemas               |
| `clientOps.listPayments` / `addPayment` / `getRevenueOverview`                                                                                                                 | CRUD/Revenue  | auth | standard                  | payment schemas                 |
| `clientOps.listDocuments` / `getDocument` / `uploadDocument` / `updateDocument` / `deleteDocument` / `searchDocuments`                                                         | CRUD/Docs     | auth | standard                  | document schemas                |
| `clientOps.createPortalAccess` / `listPortalAccess` / `revokePortalAccess`                                                                                                     | Portal        | auth | standard                  | access schemas                  |
| `clientOps.listNotifications` / `markNotificationRead` / `markAllNotificationsRead`                                                                                            | Notifications | auth | standard                  | notification schemas            |
| `clientOps.getBusinessAnalytics`                                                                                                                                               | query         | auth | heavy                     | userId                          |

### 6.15 `capabilities.*` (EI-001)

**Purpose:** Enterprise Capability Registry & Marketplace.

| Procedure                                                                           | Type     | Auth | Rate tier | Input (excerpt)                                        |
| ----------------------------------------------------------------------------------- | -------- | ---- | --------- | ------------------------------------------------------ |
| `capabilities.getMarketplace`                                                       | query    | auth | standard  | userId                                                 |
| `capabilities.search`                                                               | query    | auth | search    | criteria (category, status, businessModule, tags, ...) |
| `capabilities.getCapability`                                                        | query    | auth | standard  | userId, id                                             |
| `capabilities.createCapability` / `updateCapability` / `deleteCapability`           | CRUD     | auth | standard  | capability schemas                                     |
| `capabilities.listByBusinessModule`                                                 | query    | auth | standard  | userId, module                                         |
| `capabilities.getDependencies` / `getTransitiveDependencies` / `getCompositionTree` | queries  | auth | standard  | userId, id                                             |
| `capabilities.getGraph`                                                             | query    | auth | standard  | userId                                                 |
| `capabilities.transitionStatus`                                                     | mutation | auth | standard  | userId, id, to                                         |
| `capabilities.createVersion`                                                        | mutation | auth | standard  | userId, id, version                                    |

### 6.16 `providers.*` (EI-002)

**Purpose:** Enterprise Provider Registry & Intelligence Platform.

| Procedure                                                          | Type           | Auth | Rate tier | Input (excerpt)                                                                                                         |
| ------------------------------------------------------------------ | -------------- | ---- | --------- | ----------------------------------------------------------------------------------------------------------------------- |
| `providers.getMarketplace`                                         | query          | auth | standard  | userId                                                                                                                  |
| `providers.search`                                                 | query          | auth | search    | providerSearchInput (query, families, capabilities, modalities, minHealthScore, minContextLength, feature, page, limit) |
| `providers.getProvider`                                            | query          | auth | standard  | userId, id                                                                                                              |
| `providers.registerProvider` / `updateProvider` / `deleteProvider` | CRUD           | auth | standard  | provider schemas                                                                                                        |
| `providers.transitionLifecycle` / `createVersion`                  | mutations      | auth | standard  | lifecycle/version schemas                                                                                               |
| `providers.recordHealthSample`                                     | mutation       | auth | standard  | providerHealthSampleInput                                                                                               |
| `providers.getFleetHealth`                                         | query          | auth | standard  | userId                                                                                                                  |
| `providers.getAvailabilityTier`                                    | query          | auth | standard  | userId, id                                                                                                              |
| `providers.getCapabilityMatrix` / `setCapabilityMatrix`            | query/mutation | auth | standard  | matrix schemas                                                                                                          |
| `providers.getProvidersForCapability`                              | query          | auth | standard  | capability input                                                                                                        |
| `providers.getBenchmarkDatasets`                                   | query          | auth | standard  | benchmark query                                                                                                         |
| `providers.getModelRegistry`                                       | query          | auth | standard  | userId                                                                                                                  |
| `providers.listByFamily`                                           | query          | auth | standard  | userId, family                                                                                                          |
| `providers.listByCapability`                                       | query          | auth | standard  | capability input                                                                                                        |

### 6.17 `context.*` (EI-003)

**Purpose:** Enterprise Context Intelligence Engine.

| Procedure                                                                         | Type      | Auth | Rate tier | Input (excerpt)                                                                   |
| --------------------------------------------------------------------------------- | --------- | ---- | --------- | --------------------------------------------------------------------------------- |
| `context.getContext`                                                              | query     | auth | standard  | userId, id                                                                        |
| `context.registerContext` / `bulkRegisterContext` / `deleteContext`               | mutations | auth | standard  | contextRegisterInput / bulk / id                                                  |
| `context.getSummary` / `getMetrics`                                               | queries   | auth | standard  | userId                                                                            |
| `context.rank`                                                                    | query     | auth | standard  | contextRankInput (capability, query, sources, categories, priorities, maxResults) |
| `context.filter`                                                                  | query     | auth | heavy     | contextQueryInput                                                                 |
| `context.compress`                                                                | query     | auth | heavy     | contextCompressInput (targetTokens, strategy, preserveCritical)                   |
| `context.assemble`                                                                | query     | auth | heavy     | contextAssembleInput (goal, capability, prompt, targetTokens)                     |
| `context.discover`                                                                | query     | auth | standard  | discovery input                                                                   |
| `context.search`                                                                  | query     | auth | search    | contextQueryInput                                                                 |
| `context.preview` / `context.explain`                                             | queries   | auth | standard  | id / explain input                                                                |
| `context.listBySource` / `listByCategory` / `listByPriority` / `listByCapability` | queries   | auth | standard  | source/category/priority/capability                                               |

### 6.18 `executionStrategy.*` (EI-004)

**Purpose:** Enterprise Execution Strategy Engine.

| Procedure                                                                                               | Type    | Auth | Rate tier | Input (excerpt)          |
| ------------------------------------------------------------------------------------------------------- | ------- | ---- | --------- | ------------------------ |
| `executionStrategy.createStrategy` / `validateStrategy` / `deleteStrategy`                              | CRUD    | auth | standard  | strategyCreateInput etc. |
| `executionStrategy.getStrategy`                                                                         | query   | auth | standard  | userId, id               |
| `executionStrategy.search`                                                                              | query   | auth | search    | strategySearchInput      |
| `executionStrategy.list` / `listByPriority` / `listByExecutionMode` / `listByCapability` / `listByGoal` | queries | auth | standard  | filters                  |
| `executionStrategy.explain`                                                                             | query   | auth | standard  | userId, id               |
| `executionStrategy.estimateTokens` / `estimateCost` / `estimateLatency`                                 | queries | auth | standard  | strategyEstimateInput    |
| `executionStrategy.getSummary`                                                                          | query   | auth | standard  | userId                   |

### 6.19 `orchestrator.*` (EI-005)

**Purpose:** Enterprise Execution Orchestrator.

| Procedure                                                        | Type      | Auth | Rate tier | Input (excerpt)                                                             |
| ---------------------------------------------------------------- | --------- | ---- | --------- | --------------------------------------------------------------------------- |
| `orchestrator.buildExecutionGraph`                               | mutation  | auth | heavy     | orchestratorBuildInput (strategyId, goalId, steps, mode, priority, budgets) |
| `orchestrator.validateExecutionGraph` / `optimizeExecutionGraph` | mutations | auth | heavy     | orchestratorBuildInput                                                      |
| `orchestrator.getGraph` / `explainExecutionGraph`                | queries   | auth | standard  | graphId                                                                     |
| `orchestrator.createExecutionSession`                            | mutation  | auth | heavy     | session input                                                               |
| `orchestrator.pauseSession` / `resumeSession` / `cancelSession`  | mutations | auth | standard  | sessionId                                                                   |
| `orchestrator.listSessions` / `getSession`                       | queries   | auth | standard  | sessionId / filters                                                         |
| `orchestrator.getMonitorSnapshot`                                | query     | auth | standard  | userId                                                                      |
| `orchestrator.planRecovery`                                      | query     | auth | standard  | userId                                                                      |
| `orchestrator.getQueue` / `listWorkers`                          | queries   | auth | standard  | filters                                                                     |
| `orchestrator.getSummary`                                        | query     | auth | standard  | userId                                                                      |

### 6.20 `goals.*` (EI-006)

**Purpose:** Enterprise Goal & Task Intelligence.

| Procedure                                                        | Type           | Auth | Rate tier       | Input (excerpt)                                                                  |
| ---------------------------------------------------------------- | -------------- | ---- | --------------- | -------------------------------------------------------------------------------- |
| `goals.createGoal`                                               | mutation       | auth | standard        | goalCreateInput                                                                  |
| `goals.analyzeGoal` / `validateGoal` / `explainGoal` / `getGoal` | query/mutation | auth | standard        | goalId                                                                           |
| `goals.generateTasks`                                            | mutation       | auth | heavy           | goalId                                                                           |
| `goals.listGoals` / `searchGoals`                                | queries        | auth | standard/search | userId / goalSearchInput                                                         |
| `goals.getTaskGraph`                                             | query          | auth | standard        | goalId                                                                           |
| `goals.listTasks`                                                | query          | auth | standard        | goalId                                                                           |
| `goals.transitionGoal`                                           | mutation       | auth | standard        | goalLifecycleInput (score/accept/activate/block/unblock/complete/cancel/archive) |
| `goals.buildStrategyHandoff`                                     | query          | auth | standard        | goalId                                                                           |
| `goals.getSummary`                                               | query          | auth | standard        | userId                                                                           |

### 6.21 `intelligence.*` (INT-001)

**Purpose:** Enterprise Intelligence Integration Platform — pipeline build/validate/explain.

| Procedure                       | Type     | Auth | Rate tier | Input (excerpt) |
| ------------------------------- | -------- | ---- | --------- | --------------- |
| `intelligence.buildPipeline`    | mutation | auth | heavy     | pipeline input  |
| `intelligence.validatePipeline` | query    | auth | standard  | pipeline input  |
| `intelligence.explainPipeline`  | query    | auth | standard  | pipelineId      |
| `intelligence.getPipeline`      | query    | auth | standard  | pipelineId      |
| `intelligence.listPipelines`    | query    | auth | standard  | filters         |
| `intelligence.getDashboard`     | query    | auth | standard  | userId          |

### 6.22 `learningIntelligence.*` (EI-007)

**Purpose:** Enterprise Learning Intelligence — events, models, insights, recommendations, reports.

| Procedure                                                                                        | Type      | Auth | Rate tier       | Input (excerpt)       |
| ------------------------------------------------------------------------------------------------ | --------- | ---- | --------------- | --------------------- |
| `learningIntelligence.recordEvent`                                                               | mutation  | auth | standard        | learningEventInput    |
| `learningIntelligence.listEvents` / `getEvent`                                                   | queries   | auth | standard/search | event query / eventId |
| `learningIntelligence.getTimeline`                                                               | query     | auth | standard        | timeline input        |
| `learningIntelligence.getModels` / `getInsights` / `getRecommendations` / `getRecommendation`    | queries   | auth | standard        | filters               |
| `learningIntelligence.approveRecommendation` / `rejectRecommendation` / `rollbackRecommendation` | mutations | auth | standard        | learningDecisionInput |
| `learningIntelligence.getAnalytics` / `getReports` / `getDashboard`                              | queries   | auth | standard/heavy  | filters               |

### 6.23 `enterpriseBrain.*` (EI-008)

**Purpose:** Enterprise Brain — decision plans (14 decision types), human-approval, handoff.

| Procedure                                            | Type      | Auth | Rate tier      | Input (excerpt)                                 |
| ---------------------------------------------------- | --------- | ---- | -------------- | ----------------------------------------------- |
| `enterpriseBrain.decideGoal`                         | mutation  | auth | heavy          | brainDecideGoalInput (goalId, budgetUsd, actor) |
| `enterpriseBrain.getPlan` / `listPlans`              | queries   | auth | standard       | planId / goalId                                 |
| `enterpriseBrain.listDecisions` / `getDecision`      | queries   | auth | standard       | brainListDecisionsInput / decisionId            |
| `enterpriseBrain.getTimeline` / `getHistory`         | queries   | auth | standard       | timeline/history input                          |
| `enterpriseBrain.approveDecision` / `rejectDecision` | mutations | auth | standard       | brainDecisionActionInput                        |
| `enterpriseBrain.approvePlan` / `rejectPlan`         | mutations | auth | standard       | brainPlanActionInput                            |
| `enterpriseBrain.handOffPlan`                        | mutation  | auth | standard       | brainPlanActionInput                            |
| `enterpriseBrain.getMetrics` / `getDashboard`        | queries   | auth | standard/heavy | userId                                          |

### 6.24 `knowledge.*` (EI-009)

**Purpose:** Enterprise Knowledge Intelligence — governed knowledge items, relationships, versions, trust, search.

| Procedure                                                          | Type          | Auth | Rate tier      | Input (excerpt)                  |
| ------------------------------------------------------------------ | ------------- | ---- | -------------- | -------------------------------- |
| `knowledge.create` / `update` / `delete`                           | CRUD          | auth | standard       | knowledge schemas                |
| `knowledge.getItem` / `listItems`                                  | queries       | auth | standard       | knowledgeId / knowledgeListInput |
| `knowledge.search`                                                 | query         | auth | search         | knowledgeSearchInput (8 modes)   |
| `knowledge.explain`                                                | query         | auth | standard       | knowledgeId                      |
| `knowledge.validate`                                               | mutation      | auth | standard       | knowledgeValidateInput           |
| `knowledge.createVersion` / `listVersions` / `getVersion` / `diff` | versioning    | auth | standard       | version schemas                  |
| `knowledge.relate` / `detectRelationships` / `listRelationships`   | relationships | auth | standard       | relationship schemas             |
| `knowledge.graph` / `shortestPath`                                 | graph         | auth | standard       | graph / path input               |
| `knowledge.listConsumers` / `recordConsumerUsage`                  | consumers     | auth | standard       | consumer schemas                 |
| `knowledge.listDependencies`                                       | query         | auth | standard       | knowledgeId                      |
| `knowledge.transitionLifecycle`                                    | mutation      | auth | standard       | lifecycle input                  |
| `knowledge.getAnalytics` / `getTimeline` / `getDashboard`          | queries       | auth | standard/heavy | filters                          |

### 6.25 `memoryIntelligence.*` (EI-010)

**Purpose:** Enterprise Memory Intelligence — capture, retrieve, rank, compress, consolidate, expire.

| Procedure                                                                                         | Type          | Auth | Rate tier      | Input (excerpt)                 |
| ------------------------------------------------------------------------------------------------- | ------------- | ---- | -------------- | ------------------------------- |
| `memoryIntelligence.capture` / `update` / `delete`                                                | CRUD          | auth | standard       | memory schemas                  |
| `memoryIntelligence.getItem` / `listItems`                                                        | queries       | auth | standard       | memoryId / list input           |
| `memoryIntelligence.retrieve`                                                                     | query         | auth | heavy          | retrieve input (11 match modes) |
| `memoryIntelligence.summarize` / `validate` / `consolidate` / `compress` / `expire` / `reinforce` | mutations     | auth | standard/heavy | memory schemas                  |
| `memoryIntelligence.transitionLifecycle`                                                          | mutation      | auth | standard       | lifecycle input                 |
| `memoryIntelligence.relate` / `detectRelationships` / `listRelationships`                         | relationships | auth | standard       | relationship schemas            |
| `memoryIntelligence.graph`                                                                        | query         | auth | standard       | graph input                     |
| `memoryIntelligence.getAnalytics` / `getTimeline` / `getDashboard`                                | queries       | auth | standard/heavy | filters                         |

### 6.26 `os.*` (OS-001)

**Purpose:** Enterprise OS Integration — system health, pipeline, diagnostics, platform validation, performance, snapshots.

**Authorization note:** the OS namespace is platform-wide by design (not
user-scoped), still behind auth + rate-limit + zod.

| Procedure               | Type  | Auth | Rate tier | Input |
| ----------------------- | ----- | ---- | --------- | ----- |
| `os.systemHealth`       | query | auth | standard  | void  |
| `os.pipelineHealth`     | query | auth | standard  | void  |
| `os.runDiagnostics`     | query | auth | standard  | void  |
| `os.validatePlatform`   | query | auth | standard  | void  |
| `os.engineStatus`       | query | auth | standard  | void  |
| `os.dependencyGraph`    | query | auth | standard  | void  |
| `os.performanceMetrics` | query | auth | standard  | void  |
| `os.dashboard`          | query | auth | standard  | void  |
| `os.snapshots`          | query | auth | standard  | void  |

### 6.27 `clientPortal.*`

**Purpose:** Client portal access — portal sessions, deliverables, invoices.

| Surface                                                 | Purpose                                                                               |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `/portal` route family + portal session management      | Client-facing access to deliverables/invoices (dedicated session, portal-session lib) |
| Portal login / content / deliverables / invoices routes | UI surface backed by clientOps portal access procedures                               |

---

## 7. Service HTTP APIs (OpenAPI v1) — frozen

| Service   | OpenAPI module                                                    | Port (dev) | REST resources                                                                                       |
| --------- | ----------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------- |
| Identity  | `services/identity/src/presentation/openapi/IdentityOpenAPI.ts`   | 3002       | `/api/v1/identity/auth/*` (register, login, refresh, google-oauth), `/users/*`, `/sessions/*`        |
| Knowledge | `services/knowledge/src/presentation/openapi/KnowledgeOpenAPI.ts` | 3003       | `/api/v1/knowledge/graphs`, `/graphs/:id/nodes`, `/search?q=`, `/recommendations`                    |
| Memory    | `services/memory/src/presentation/openapi/MemoryOpenAPI.ts`       | 3004       | `/api/v1/memory/memories`, `/retention`, `/reflection`, `/search?q=`                                 |
| Decision  | `services/decision/src/presentation/openapi/DecisionOpenAPI.ts`   | 3005       | `/api/v1/decision/decisions`, `/decisions/:id`, `/search?q=`, `/stats`, `/scenarios`, `/constraints` |
| Execution | `services/execution/src/presentation/openapi/ExecutionOpenAPI.ts` | 3006       | `/api/v1/execution/plans`, `/plans/:id/tasks`, `/plans/:id/progress`, `/schedule`                    |

---

## 8. Contract Guards

| Guard             | Contract                                                                |
| ----------------- | ----------------------------------------------------------------------- |
| tRPC router tests | Every router has direct handler tests (OS-002 added 48 EI router tests) |
| Error envelope    | `error.ts` middleware + `TRPCError` mapping — verified                  |
| IDOR              | `assertUserIdMatchesSession` — cross-user call → FORBIDDEN (tested)     |
| Rate limit        | per-endpoint tier assignment in RouterRegistry — tested                 |
| Audit             | tRPC middleware audit trail (`middleware/audit.ts`)                     |
| Request metrics   | `api.requests.total` / `latency_ms` / `error` Prometheus counters       |

---

## 9. Breaking-Change Policy (API)

Any change to a **frozen procedure name, input schema, response DTO, envelope,
error contract, enum member, or rate-limit behavior** requires:

1. ADR · 2. Impact analysis · 3. Migration plan · 4. Version increment (major)
2. Regression validation — per `ARCHITECTURE_FREEZE.md` §6.

_API contract frozen at commit `dd4dffd3d7be6175b9bf37c0d122c642d937c942` on
2026-08-07. Full canonical schemas source: `services/api/src/services/RouterRegistry.ts`_
