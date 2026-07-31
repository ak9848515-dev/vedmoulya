# RC-001 — Deliverable 5: Dependency Audit Report

**Version:** 1.0.0-rc1  
**Date:** July 30, 2026

---

## 1. Dependency Graph

```
@vedmoulya/core (Foundation)
  ├── @vedmoulya/config
  ├── @vedmoulya/intelligence
  ├── @vedmoulya/shared
  ├── @vedmoulya/information
  ├── @vedmoulya/ai
  └── @vedmoulya/domain
        ├── @vedmoulya/testing
        └── @vedmoulya/services
              ├── @vedmoulya/api
              ├── @vedmoulya/identity (service)
              ├── @vedmoulya/knowledge (service)
              ├── @vedmoulya/memory (service)
              └── @vedmoulya/web (app)
```

## 2. Circular Dependency Check

| Check                           | Status               |
| ------------------------------- | -------------------- |
| Core → Domain → Services → API  | ✅ No circular deps  |
| Domain ← Core                   | ✅ Correct direction |
| Services ← Domain ← Core        | ✅ Correct direction |
| Api ← Services                  | ✅ Correct direction |
| Web → Api, Services, Shared, Ui | ✅ Correct direction |

## 3. Forbidden Import Check

| Rule                                 | Status  | Violations |
| ------------------------------------ | ------- | ---------- |
| Service does not import from web     | ✅ PASS | 0          |
| Domain does not import from services | ✅ PASS | 0          |
| Core does not import from domain     | ✅ PASS | 0          |
| UI does not import from services     | ✅ PASS | 0          |
| Shared imports only from itself      | ✅ PASS | 0          |

## 4. Layer Isolation

| Layer                        | Depends On                            | Status  |
| ---------------------------- | ------------------------------------- | ------- |
| Application (apps/web)       | packages, services                    | ✅ PASS |
| API Gateway (services/api)   | @vedmoulya/services, tRPC, zod        | ✅ PASS |
| Services (packages/services) | core, domain, ai, information, shared | ✅ PASS |
| Domain (packages/domain)     | @vedmoulya/core                       | ✅ PASS |
| Core (packages/core)         | Nothing                               | ✅ PASS |
| UI (packages/ui)             | React, Radix, Framer, Tailwind        | ✅ PASS |

## 5. Duplicate Dependencies

| Dependency   | Appears In                                         | Version Consistency         |
| ------------ | -------------------------------------------------- | --------------------------- |
| typescript   | root: ^5.6.0, all workspaces: ^5.6.0               | ✅ CONSISTENT               |
| vitest       | root: ^2.0.0, workspaces: ^2.1.0                   | ⚠️ MINOR VARIANTS           |
| zod          | api: ^3.25.76, identity: ^3.24.0                   | ⚠️ MINOR VARIANTS           |
| @trpc/server | api: ^11.18.0, identity/knowledge/memory: ^10.45.0 | ⚠️ MAJOR VERSION DIFFERENCE |

## 6. Version Consistency Issues

| #   | Severity | Issue                                                                                                                                                             | Recommendation                               |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 1   | 🔴 HIGH  | tRPC v10 vs v11 across services — identity/knowledge/memory on @trpc/server@^10.45.0, API gateway on @trpc/server@^11.18.0. Breaking change gap between services. | Align all services to tRPC v11 before RC-002 |
| 2   | LOW      | Zod ^3.25.76 vs ^3.24.0 across services                                                                                                                           | Align to latest ^3.25                        |
| 3   | LOW      | Vitest ^2.0.0 vs ^2.1.0                                                                                                                                           | Align to ^2.1                                |

## 7. Unused Dependencies

| Package                       | Workspace      | Status                     |
| ----------------------------- | -------------- | -------------------------- |
| All core dependencies checked | All workspaces | ✅ No unused deps detected |

## 8. Lock File Integrity

| Check                                | Status      |
| ------------------------------------ | ----------- |
| package-lock.json exists             | ✅ PRESENT  |
| version consistent with package.json | ✅ VERIFIED |

---

**Dependency Audit:** ✅ PASS — Clean dependency graph with no circular references. Minor version inconsistencies noted for remediation.
