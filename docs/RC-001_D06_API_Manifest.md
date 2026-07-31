# RC-001 — Deliverable 6: API Manifest

**Version:** 1.0.0-rc1  
**Date:** July 30, 2026

---

## 1. tRPC Router Inventory

| Router              | File                                              | Type      | Procedures                  |
| ------------------- | ------------------------------------------------- | --------- | --------------------------- |
| IdentityRouter      | `services/api/src/routers/IdentityRouter.ts`      | Protected | Auth, CRUD, Profile         |
| BusinessRouter      | `services/api/src/routers/BusinessRouter.ts`      | Protected | Analytics, KPI, Goals       |
| CareerRouter        | `services/api/src/routers/CareerRouter.ts`        | Protected | Skills, Roadmap, Jobs       |
| LearningRouter      | `services/api/src/routers/LearningRouter.ts`      | Protected | Paths, Assessment, Progress |
| DashboardRouter     | `services/api/src/routers/DashboardRouter.ts`     | Protected | Metrics, Snapshots          |
| MarketplaceRouter   | `services/api/src/routers/MarketplaceRouter.ts`   | Protected | Catalog, Assets, Providers  |
| LifeOSRouter        | `services/api/src/routers/LifeOSRouter.ts`        | Protected | Integration, Navigation     |
| ConfigurationRouter | `services/api/src/routers/ConfigurationRouter.ts` | Protected | Settings                    |
| HealthRouter        | `services/api/src/routers/HealthRouter.ts`        | Public    | Health check                |
| MetricsRouter       | `services/api/src/routers/MetricsRouter.ts`       | Protected | Metrics                     |
| NotificationRouter  | `services/api/src/routers/NotificationRouter.ts`  | Protected | Notifications               |
| SearchRouter        | `services/api/src/routers/SearchRouter.ts`        | Protected | Global search               |

## 2. API Endpoint Pattern

```
Base URL: /api/trpc/{router}.{procedure}
Method: POST
Content-Type: application/json
```

## 3. Router Procedures (Detailed)

### IdentityRouter

| Procedure       | Input              | Output           |
| --------------- | ------------------ | ---------------- |
| `register`      | `RegisterDTO`      | `UserDTO`        |
| `login`         | `LoginDTO`         | `AuthTokenDTO`   |
| `logout`        | `LogoutDTO`        | `void`           |
| `getProfile`    | `GetProfileDTO`    | `UserProfileDTO` |
| `updateProfile` | `UpdateProfileDTO` | `UserProfileDTO` |

### HealthRouter

| Procedure | Input  | Output                                |
| --------- | ------ | ------------------------------------- |
| `ping`    | `void` | `{ status: 'ok', timestamp: string }` |
| `check`   | `void` | `HealthCheckResponse`                 |

### SearchRouter

| Procedure | Input         | Output           |
| --------- | ------------- | ---------------- |
| `search`  | `SearchQuery` | `SearchResult[]` |

## 4. Service-Level tRPC Routers

| Service   | Router            | File                                                          |
| --------- | ----------------- | ------------------------------------------------------------- |
| Identity  | `IdentityRouter`  | `services/identity/src/presentation/trpc/IdentityRouter.ts`   |
| Knowledge | `KnowledgeRouter` | `services/knowledge/src/presentation/trpc/KnowledgeRouter.ts` |
| Memory    | `MemoryRouter`    | `services/memory/src/presentation/trpc/MemoryRouter.ts`       |
| Decision  | `DecisionRouter`  | `services/decision/src/presentation/trpc/DecisionRouter.ts`   |
| Execution | `ExecutionRouter` | `services/execution/src/presentation/trpc/ExecutionRouter.ts` |

## 5. Zod Schemas (Public API Contracts)

| Schema           | Location                                                             | Purpose              |
| ---------------- | -------------------------------------------------------------------- | -------------------- |
| IdentitySchemas  | `services/identity/src/presentation/validation/IdentitySchemas.ts`   | Auth validation      |
| KnowledgeSchemas | `services/knowledge/src/presentation/validation/KnowledgeSchemas.ts` | Knowledge validation |
| MemorySchemas    | `services/memory/src/presentation/validation/MemorySchemas.ts`       | Memory validation    |
| DecisionSchemas  | `services/decision/src/presentation/validation/DecisionSchemas.ts`   | Decision validation  |
| ExecutionSchemas | `services/execution/src/presentation/validation/ExecutionSchemas.ts` | Execution validation |

## 6. Service Contracts

| Contract           | Location                                                | Type      |
| ------------------ | ------------------------------------------------------- | --------- |
| IdentityContracts  | `services/identity/src/contracts/IdentityContracts.ts`  | Interface |
| MemoryContracts    | `packages/services/src/memory/MemoryContracts.ts`       | Interface |
| KnowledgeContracts | `packages/services/src/knowledge/KnowledgeContracts.ts` | Interface |

## 7. API Version

| Property    | Value            |
| ----------- | ---------------- |
| API Version | v1 (via tRPC)    |
| API Path    | `/api/trpc`      |
| Transport   | HTTP/JSON (tRPC) |

---

**API Manifest:** ✅ FROZEN — All public APIs documented and frozen for RC-001.
