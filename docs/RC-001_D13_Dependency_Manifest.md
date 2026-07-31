# RC-001 — Deliverable 13: Dependency Manifest

**Version:** 1.0.0-rc1  
**Date:** July 30, 2026

---

## 1. Internal Dependencies

| Package                    | Depends On                                                                     |
| -------------------------- | ------------------------------------------------------------------------------ |
| `@vedmoulya/core`          | (none)                                                                         |
| `@vedmoulya/config`        | (none)                                                                         |
| `@vedmoulya/intelligence`  | (none)                                                                         |
| `@vedmoulya/shared`        | (none)                                                                         |
| `@vedmoulya/information`   | `@vedmoulya/core`                                                              |
| `@vedmoulya/ai`            | `@vedmoulya/core`                                                              |
| `@vedmoulya/domain`        | `@vedmoulya/core`                                                              |
| `@vedmoulya/testing`       | `@vedmoulya/core`, `@faker-js/faker`                                           |
| `@vedmoulya/services`      | core, domain, ai, information, shared                                          |
| `@vedmoulya/ui`            | (external only: React, Radix, Framer, Tailwind)                                |
| `@vedmoulya/api`           | `@vedmoulya/services`, `@trpc/server`, `zod`                                   |
| `@vedmoulya/identity`      | core, domain, services, drizzle, postgres, hono, zod, trpc, jose, bcrypt, casl |
| `@vedmoulya/knowledge`     | core, domain, services, drizzle, postgres, hono, zod, trpc                     |
| `@vedmoulya/memory`        | core, domain, services, drizzle, postgres, hono, zod, trpc                     |
| `@vedmoulya/orchestrator`  | (none)                                                                         |
| `@vedmoulya/execution`     | (none)                                                                         |
| `@vedmoulya/business`      | (none)                                                                         |
| `@vedmoulya/career`        | (none)                                                                         |
| `@vedmoulya/learning`      | (none)                                                                         |
| `@vedmoulya/decision`      | (none)                                                                         |
| `@vedmoulya/marketplace`   | (none)                                                                         |
| `@vedmoulya/notifications` | (none)                                                                         |
| `@vedmoulya/web`           | api, services, shared, ui, tRPC, TanStack Query, Zustand, Next.js, React       |

## 2. External Dependencies Summary

| Category      | Dependencies                                                           |
| ------------- | ---------------------------------------------------------------------- |
| **Framework** | Next.js 15, React 19, Hono                                             |
| **API Layer** | tRPC 10/11, TanStack Query 5                                           |
| **Database**  | Drizzle ORM, Postgres.js                                               |
| **Auth**      | jose, bcrypt, CASL ability                                             |
| **UI**        | Tailwind 4, Radix UI, Framer Motion, Lucide, CVA, clsx, tailwind-merge |
| **Testing**   | Vitest, Testing Library, Storybook 8                                   |
| **Tooling**   | TypeScript 5.6, ESLint 9, Prettier 3, Husky, CommitLint                |
| **AI**        | OpenAI (client), Anthropic (client)                                    |

## 3. External Dependency Versions (Key)

| Dependency  | Version    | Risk              |
| ----------- | ---------- | ----------------- |
| React       | ^19.0.0    | ⚪ Current        |
| Next.js     | ^15.0.0    | ⚪ Current        |
| TypeScript  | ^5.6.0     | ⚪ Current        |
| Vitest      | ^2.1.0     | ⚪ Current        |
| Zod         | ^3.24-3.25 | ⚪ Current        |
| tRPC        | v10 + v11  | 🟡 Mixed versions |
| Drizzle ORM | ^0.38.0    | ⚪ Current        |
| Storybook   | ^8.6       | ⚪ Current        |

## 4. Dependency Direction Verification

| Direction                            | Status     |
| ------------------------------------ | ---------- |
| Core → Domain → Services → API → Web | ✅ CORRECT |
| No reverse dependencies              | ✅ PASS    |
| No circular dependencies             | ✅ PASS    |
| Shared kernel only where needed      | ✅ PASS    |

## 5. Frozen Dependency Contracts

All internal package interfaces, exports, and public APIs are frozen as of RC-001. No changes to dependency contracts without formal ECR (Engineering Change Request).

---

**Dependency Manifest:** ✅ FROZEN — All dependencies documented and frozen. tRPC version variance noted as technical debt.
