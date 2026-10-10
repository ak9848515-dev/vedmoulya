# 04_Technology — Engineering Standards & Technology Architecture

**Version:** 1.0  
**Status:** Active & Standardized  
**Owner:** Principal Technology Architect  
**Created:** 2026-07-24  
**Updated:** 2026-08-16

---

## Overview

The `04_Technology` directory defines the concrete engineering standards, architectural decisions, and technology stack parameters that power the VedMoulya Execution Operating System.

```
04_Technology/
├── Engineering Standards/     # Coding standards, naming conventions, and linting rules
├── Technology Decisions/       # Architecture Decision Records (ADRs) for database, language, and framework choices
└── README.md                  # This directory overview and navigation map
```

---

## Core Technology Stack

- **Monorepo Architecture:** npm workspaces managing 58 packages, services, and applications.
- **Language & Runtime:** TypeScript (Strict Mode throughout) on Node.js 20+ / 24+.
- **Frontend Layer (`apps/web`):** Next.js 15 (React 19, Server Components, tRPC client, Tailwind CSS, Radix UI).
- **API Gateway (`services/api`):** tRPC v11 with typed procedures, central rate-limiting, IDOR guards, and Zod input validation.
- **Persistence Layer:** PostgreSQL with owner-scoped tables, idempotent migrations, and Redis caching.
- **AI Orchestration (`services/orchestrator`):** Pluggable multi-provider abstraction supporting OpenAI, DeepSeek, and offline deterministic Mock runners with hard token/cost budgets.
- **Testing & Quality:** Vitest workspace runners, Playwright E2E, ESLint flat config, Prettier, and dependency cycle detection.

---

## Key Subdirectories

### 1. [Engineering Standards](./Engineering%20Standards/)

Authoritative specifications for software engineering across the estate:

- Clean Architecture (Dependencies flow inwards: services → packages → domain/core).
- Fail-fast configuration checks on production startup.
- Strict type safety (`noImplicitAny`, zero unchecked type assertions in critical paths).
- Comprehensive unit test coverage with deterministic fixtures.

### 2. [Technology Decisions](./Technology%20Decisions/)

Formal Architecture Decision Records (ADRs) explaining key design trade-offs:

- ADR-001: Selection of TypeScript Monorepo architecture.
- ADR-002: Next.js + tRPC over REST for type-safe end-to-end communication.
- ADR-003: Postgres + Redis persistent data fabric over complex distributed datastores.
- ADR-004: Hermetic Mock-first testing convention for AI provider isolation.

---

## Verification & Quality Gates

All engineering changes must satisfy the root verification gates:

```bash
npm run typecheck      # Type check whole repository
npm run lint           # Strict ESLint across all 58 scopes
npm run deps:cycles    # Dependency cycle detection
npm run config:contract# Configuration contract verification
npm run test           # Vitest unit test suite
```
