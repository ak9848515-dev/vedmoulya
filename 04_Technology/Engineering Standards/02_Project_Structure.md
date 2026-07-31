# Project Structure

**TECH-002 — Document 02/10 — Engineering Standards Manual**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Engineering Officer (CEngO)
**Created:** 2026-07-27
**Cross-references:** CMP-001, CMP-002, PRD-001, ARC-001, ENG-001, ENG-002, ENG-003, ENG-004, TECH-001/D08, IMP-001, 09_Documents/Repository Governance.md

---

## Purpose

This document defines the **project structure standards** for VedMoulya — how code, configuration, and documentation are organized across the repository. Every repository, package, and module must conform to these standards.

The repository governance rules (09_Documents/Repository Governance.md) define the top-level folder structure. This document defines the structure _within_ those folders — the architecture of packages, modules, and code organization.

---

## Repository Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    VEDMOULYA REPOSITORY ARCHITECTURE                      │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  MONOREPO ORGANIZATION                                            │    │
│  │                                                                   │    │
│  │  apps/          — Deployable applications (Next.js, mobile)       │    │
│  │  packages/      — Shared libraries and packages                   │    │
│  │  services/      — Backend services (modular monolith)             │    │
│  │  docs/          — Additional documentation                        │    │
│  │  tools/         — Build and development tooling                   │    │
│  │  00_Foundation+ — Domain documentation (governed elsewhere)       │    │
│  │                                                                   │    │
│  │  RATIONALE: Monorepo provides single-source-of-truth while        │    │
│  │  maintaining clear separation through workspace boundaries.       │    │
│  │                                                                   │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  DECISION: Monorepo (Phase 1-4) → Extracted services (Phase 5+)         │
│  Per IMP-001/D02: Start monolith, extract when validated by data.        │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Workspace Structure

### Application Packages (`apps/`)

Each deployable application lives in `apps/`:

```text
apps/
├── web/                    # Next.js web application (primary frontend)
│   ├── src/
│   │   ├── app/           # Next.js App Router pages and layouts
│   │   ├── components/    # Shared UI components
│   │   ├── lib/           # Utility functions and client-side logic
│   │   ├── hooks/         # Custom React hooks
│   │   ├── stores/        # State management stores
│   │   ├── types/         # TypeScript type definitions
│   │   └── styles/        # Global styles and CSS modules
│   ├── public/            # Static assets
│   ├── tests/             # Integration and E2E tests
│   └── package.json
├── mobile/                 # React Native / Flutter mobile application (Phase 3+)
└── desktop/               # Desktop application (Phase 5+)
```

### Shared Packages (`packages/`)

Shared libraries that are consumed by multiple applications or services:

```text
packages/
├── ui/                    # Design system components
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── tokens/       # Design tokens (colors, spacing, typography)
│   │   └── icons/        # SVG icon library
│   └── package.json
├── domain/                 # Core domain model (entities, value objects)
│   ├── src/
│   │   ├── entities/     # Domain entities
│   │   ├── value-objects/ # Value objects
│   │   ├── events/       # Domain events
│   │   └── services/     # Domain services
│   └── package.json
├── ai/                    # AI interaction patterns and types
│   ├── src/
│   │   ├── providers/    # AI provider interfaces
│   │   ├── context/      # Context assembly types
│   │   └── validation/   # Response validation types
│   └── package.json
├── config/                 # Shared configuration
├── types/                 # Shared TypeScript types
├── utils/                 # Shared utility functions
└── test-helpers/          # Shared test utilities and mocks
```

### Backend Services (`services/`)

Backend services following the modular monolith pattern:

```text
services/
├── api/                   # API gateway and routing
│   ├── src/
│   │   ├── routes/       # Route definitions
│   │   ├── middleware/   # Express/Fastify middleware
│   │   ├── validators/   # Request validation
│   │   └── handlers/     # Request handlers
│   └── package.json
├── identity/               # Identity and authentication service
├── knowledge/              # Knowledge Graph service
├── execution/              # Execution Engine service
├── decision/               # Decision Intelligence service
├── orchestrator/           # AI Orchestrator service
├── memory/                 # Memory Engine service
├── career/                 # Career Engine service
├── business/               # Business Builder service
├── learning/               # Learning Engine service
├── marketplace/            # Marketplace service
└── notifications/          # Notifications service
```

---

## Module Structure Standards

### Every package/service must follow this structure:

```text
package-name/
├── src/
│   ├── index.ts              # Public API barrel export
│   ├── types/                # TypeScript type definitions
│   ├── constants/            # Constants and enums
│   ├── config/              # Configuration and environment
│   ├── modules/             # Feature modules (domain-specific)
│   │   └── feature-module/
│   │       ├── index.ts
│   │       ├── feature.service.ts
│   │       ├── feature.controller.ts
│   │       ├── feature.repository.ts
│   │       ├── feature.dto.ts
│   │       └── __tests__/
│   │           ├── feature.service.test.ts
│   │           └── feature.controller.test.ts
│   ├── middleware/          # Express/Fastify middleware
│   ├── validators/         # Validation schemas
│   ├── errors/             # Custom error classes
│   └── utils/              # Internal utility functions
├── __tests__/               # Integration and E2E tests
│   └── fixtures/           # Test fixtures and data
├── docs/                   # Additional documentation
├── README.md               # Package documentation
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── .env.example
```

### File Naming by Type

| File Type    | Naming Convention           | Example                      |
| ------------ | --------------------------- | ---------------------------- |
| Service      | `kebab-case.service.ts`     | `user-profile.service.ts`    |
| Controller   | `kebab-case.controller.ts`  | `user-profile.controller.ts` |
| Repository   | `kebab-case.repository.ts`  | `user-profile.repository.ts` |
| DTO          | `kebab-case.dto.ts`         | `create-user.dto.ts`         |
| Interface    | `kebab-case.interface.ts`   | `user-service.interface.ts`  |
| Type         | `kebab-case.type.ts`        | `user-profile.type.ts`       |
| Constant     | `kebab-case.constant.ts`    | `user-roles.constant.ts`     |
| Error        | `kebab-case.error.ts`       | `user-not-found.error.ts`    |
| Guard        | `kebab-case.guard.ts`       | `auth.guard.ts`              |
| Interceptor  | `kebab-case.interceptor.ts` | `logging.interceptor.ts`     |
| Test         | `*.test.ts` or `*.spec.ts`  | `user.service.test.ts`       |
| Test Fixture | `*.fixture.ts`              | `user.fixture.ts`            |
| Test Mock    | `*.mock.ts`                 | `user-service.mock.ts`       |
| Story        | `*.stories.tsx`             | `button.stories.tsx`         |

---

## Internal Module Organization

### Feature Module Structure (Domain-Driven Design)

Each bounded context (ENG-001/D02) maps to a module in the codebase. Within each module:

```text
modules/user-profile/
├── application/                 # Application layer (use cases, DTOs)
│   ├── use-cases/
│   │   ├── create-user.use-case.ts
│   │   ├── update-user.use-case.ts
│   │   └── delete-user.use-case.ts
│   ├── dto/
│   │   ├── create-user.dto.ts
│   │   └── update-user.dto.ts
│   └── interfaces/
│       └── user-repository.interface.ts
├── domain/                      # Domain layer (entities, rules)
│   ├── entities/
│   │   └── user.entity.ts
│   ├── value-objects/
│   │   ├── email.value-object.ts
│   │   └── user-status.value-object.ts
│   ├── events/
│   │   └── user-created.event.ts
│   └── services/
│       └── user-domain.service.ts
├── infrastructure/               # Infrastructure layer (DB, external APIs)
│   ├── persistence/
│   │   └── user.repository.ts
│   ├── external/
│   │   └── email-service.ts
│   └── config/
│       └── user-module.config.ts
├── presentation/                # Presentation layer (controllers, middleware)
│   ├── controllers/
│   │   └── user.controller.ts
│   ├── middleware/
│   │   └── user-validation.middleware.ts
│   └── routes/
│       └── user.routes.ts
├── index.ts                     # Module barrel export
└── __tests__/
    ├── unit/
    ├── integration/
    └── fixtures/
```

### Layer Dependencies

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    LAYER DEPENDENCY RULES                                 │
│                                                                           │
│  presentation ──▶ application ──▶ domain                                  │
│       │                │             │                                    │
│       │                │             ▼                                    │
│       │                │       [NO DEPENDENCIES]                          │
│       │                ▼                                                   │
│       └─────────▶ infrastructure ──▶ domain                               │
│                                                                           │
│  RULES:                                                                  │
│  • Domain layer has ZERO external dependencies                           │
│  • Application depends only on domain                                    │
│  • Infrastructure depends on domain                                      │
│  • Presentation depends on application + infrastructure                  │
│  • Domain never imports from infrastructure, application, or presentation │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Configuration Management

### Environment Configuration

```text
├── .env.example           # Template with documented environment variables
├── .env.local             # Local development (gitignored)
├── .env.development       # Development environment
├── .env.staging           # Staging environment
└── .env.production        # Production environment (secrets managed externally)
```

### Environment Variable Standards

| Standard          | Rule                                              | Example                                       |
| ----------------- | ------------------------------------------------- | --------------------------------------------- |
| **Naming**        | UPPER_SNAKE_CASE                                  | `DATABASE_URL`                                |
| **Prefixing**     | Prefix with service/module name                   | `IDENTITY_DATABASE_URL`, `KG_REDIS_URL`       |
| **Documentation** | Every variable documented in `.env.example`       | `# The PostgreSQL connection string`          |
| **Secrets**       | Never committed. Use secret manager in production | GCP Secret Manager + SOPS for encrypted local |
| **Defaults**      | Provide sensible defaults where safe              | `LOG_LEVEL=info`                              |

**Cross-Reference:** TECH-001/D08 (Developer Tooling - Dev Container setup), TECH-001/D07 (Cloud & Deployment - Secret Management)

---

## Dependency Management

### Package Manager

| Aspect              | Standard                                                                   |
| ------------------- | -------------------------------------------------------------------------- |
| **Package Manager** | npm (or pnpm for monorepo workspace management)                            |
| **Lock File**       | `package-lock.json` or `pnpm-lock.yaml` committed to repository            |
| **Version Pinning** | Exact versions for production dependencies; caret (^) for dev dependencies |
| **Audit**           | `npm audit` runs in CI; critical vulnerabilities block merge               |

### Dependency Rules

| Rule                                        | Enforcement                                    |
| ------------------------------------------- | ---------------------------------------------- |
| Domain layer has zero external dependencies | Lint rule: no external imports in domain files |
| No circular dependencies                    | Import cycle detection in CI                   |
| No unused dependencies                      | `depcheck` or lint rule                        |
| No duplicate dependencies                   | `npm dedupe` or `pnpm dedupe`                  |
| Known vulnerable dependencies blocked       | CI fails on critical/high severity             |
| Dependency updates reviewed monthly         | Scheduled dependency audit sprint task         |
| New dependencies require justification      | Documented in PR description                   |

**Cross-Reference:** TECH-001/D01 (Buy vs. Build Philosophy)

---

## Test File Organization

### Test Directory Structure

```text
__tests__/
├── unit/                  # Unit tests (mirror source structure)
│   └── services/
│       └── user.service.test.ts
├── integration/           # Integration tests
│   └── api/
│       └── user.api.test.ts
├── e2e/                   # End-to-end tests
│   └── user-journey.test.ts
├── fixtures/              # Test data and stubs
│   ├── user.fixture.ts
│   └── database.fixture.ts
├── mocks/                 # Mock implementations
│   ├── services/
│   └── repositories/
└── helpers/               # Test utilities
    ├── test-db.ts
    └── test-factory.ts
```

### Co-located Tests

For simple components with limited external dependencies, tests may be co-located with source:

```text
components/
├── button/
│   ├── button.tsx
│   ├── button.test.tsx
│   ├── button.stories.tsx
│   └── index.ts
```

**Cross-Reference:** TECH-002/D06 (Testing Standards)

---

## Documentation Standards per Directory

### Required Files

| Directory/Module | Required Documentation                                  |
| ---------------- | ------------------------------------------------------- |
| **Root**         | `README.md` (project overview)                          |
| **`apps/*`**     | `README.md` (app overview, setup, deployment)           |
| **`packages/*`** | `README.md` (purpose, API, usage examples)              |
| **`services/*`** | `README.md` (purpose, boundaries, dependencies)         |
| **Each module**  | Module-level documentation in `index.ts` or doc comment |
| **Each API**     | OpenAPI/Swagger specification (v3)                      |
| **Each test**    | Descriptive test names (not comments)                   |

**Cross-Reference:** TECH-002/D07 (Documentation Standards)

---

## Migration & Evolution

### Structure Evolution

```text
PHASE 1-2 (Prototype → Alpha):
  Monorepo with limited packages
  Flat structure within packages
  Minimal module boundaries
  Co-located tests

PHASE 3-4 (Beta → MVP):
  Full monorepo structure as defined
  Clean module boundaries (DDD layers)
  Separate test directories for integration tests
  API documentation generated from code

PHASE 5+ (Growth → Enterprise):
  Extracted services from monolith
  Independent deployment per service
  Shared packages published to internal registry
  Polyglot services where justified (Go for performance-critical)
```

---

## Cross-Reference Summary

| Reference                                 | Relationship to Project Structure                                       |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| **09_Documents/Repository Governance.md** | Defines top-level folder structure; this document defines sub-structure |
| **ENG-001**                               | Domain model structure determines module boundaries                     |
| **ARC-001**                               | 4-layer architecture maps to module organization                        |
| **TECH-001/D08**                          | Developer tooling configures the monorepo workspace                     |
| **IMP-001/D02**                           | Monolith-first strategy evolves into extracted services                 |
| **TECH-001/D04**                          | Data storage decisions affect repository layer structure                |

---

## Document Governance

| Aspect                     | Standard                                                      |
| -------------------------- | ------------------------------------------------------------- |
| **Version**                | 1.0                                                           |
| **Status**                 | Final                                                         |
| **Owner**                  | Chief Engineering Officer (CEngO)                             |
| **Review Cadence**         | Quarterly (or upon significant repo restructuring)            |
| **Approval Required**      | CEngO + CTO                                                   |
| **Violation Consequences** | PR blocked if structure deviates without documented exception |
