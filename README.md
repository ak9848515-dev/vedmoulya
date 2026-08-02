# README.md

# VedMoulya

## Mission

Empower every determined individual to build a sustainable livelihood through knowledge, execution, and intelligent technology.

## Vision

Build the world's most trusted Execution Operating System that helps people transform knowledge into sustainable livelihoods.

## Motto

Knowledge • Value • Execution

## Core Philosophy

Knowledge alone does not change lives.

Knowledge → Understanding → Decision → Execution → Value → Livelihood

## Long-Term Goal

Help one million people create sustainable livelihoods.

## Current Status

- **Phase:** Production (v1.0.0)
- **Mission:** 001 — Company Constitution (foundation) → 020 — Version 1.0 (released)
- **Version:** 1.0.0
- **Status:** 🟢 Production certified — [2026-07-31 report](./docs/PROJECT_REPORT_2026-07-31.md)

---

## Overview

VedMoulya is a monorepo platform (Execution Operating System) composed of:

- **3 application layers** — Next.js web app, API gateway (tRPC), shared UI component library
- **12 services** — identity, knowledge, memory, decision, execution, orchestrator (AI), learning, marketplace, notifications, career, business, and the API gateway
- **10 packages** — core, domain, services, ai, ui, config, information, intelligence, shared, testing
- **TypeScript throughout** with strict mode, Vitest unit testing, ESLint, Prettier

The platform is architected around five core engines: **Identity**, **Knowledge Graph**, **Memory**, **Decision Intelligence**, and **Execution Intelligence**, unified by an **AI Orchestrator** with pluggable providers (OpenAI, Anthropic, Mock) and a Life OS **Dashboard**.

## Architecture

```
apps/web                 Next.js 15 web application (React 19, tRPC client, Tailwind CSS)
apps/*                   Additional applications
packages/core            Foundation: DI, event bus, config, logging, metrics, tracing, health
packages/domain          Domain entities, factories, value objects
packages/services        Application services (dashboard, career, learning, business, AI orchestration)
packages/ai              AI domain types (requests, responses, capabilities, providers)
packages/ui              UI component library (Radix UI + Tailwind)
packages/*               config, information, intelligence, shared, testing
services/api             API gateway — tRPC routers + middleware (auth, audit, rate-limit)
services/identity        Authentication: JWT, sessions, Google OAuth
services/orchestrator    AI provider abstraction, fallback/retry, request cache, metrics
services/knowledge       Knowledge graph service
services/memory          Memory engine service
services/decision        Decision intelligence service
services/execution       Execution engine service
services/*               learning, marketplace, notifications, career, business
tests/                   Shared vitest setup (provisions required env vars)
```

### Key engineering conventions

- **Fail-fast configuration** — production secrets (`AUTH_JWT_SECRET`, `IDENTITY_DATABASE_URL`, `REDIS_URL`, AI keys, OAuth/SMTP credentials) are validated at startup; missing, empty, placeholder, or localhost values are rejected with clear messages outside `NODE_ENV=development`.
- **Clean architecture** — services depend on packages, never the reverse; domain layer is framework-free.
- **Workspace tooling** — every workspace with tests ships a `vitest.config.ts`, `test` script, and coverage config.

## Quick Start

```bash
# Prerequisites: Node.js >= 20, npm >= 10, Docker (optional for infra)

git clone https://github.com/ak9848515-dev/vedmoulya.git
cd VedMoulya
npm install
npm run build:core    # Build foundational packages
```

### Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

- Set `AUTH_JWT_SECRET` (required — generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)
- Set `IDENTITY_DATABASE_URL` and `REDIS_URL` (required outside `NODE_ENV=development`)
- Set AI provider keys if you use AI features

### Run

```bash
npm run dev           # Start the web app (Next.js dev server)
npm run test          # Run all unit tests (Vitest workspace)
npm run build         # Build all workspaces
```

## Development

- **Workspace structure:** `apps/*`, `packages/*`, `services/*` — managed via npm workspaces.
- **Scripts (root):** `npm run dev`, `npm run build`, `npm run test`, `npm run lint`, `npm run typecheck`, `npm run format`.
- **Service dev servers:** each service has `dev` (tsx watch) and `build` (tsc) scripts.
- **Adding a workspace:** create `package.json` with the `@vedmoulya/*` scope, wire into `vitest.workspace.ts` if it has tests.
- **Conventional commits** enforced via commitlint + husky; commit type/scope from the repo's `commitlint.config.ts`.

## Testing

```bash
npm run test              # All unit tests (Vitest workspace — 206 files / 2693 tests)
npm run test:coverage     # Coverage report (per-workspace v8 coverage config)
npm run test:e2e          # Playwright end-to-end (apps/web)
npm run test:a11y         # Accessibility audit
npm run test:performance  # Bundle size checks
```

- Unit tests use Vitest with a shared setup (`tests/vitest.setup.ts`) that provisions required environment variables before any module imports `@vedmoulya/core`.
- The workspace runner is defined in `vitest.workspace.ts` (`packages/*/vitest.config.ts`, `services/*/vitest.config.ts`).

## Build

```bash
npm run build         # Build every workspace (tsc / next build)
npm run build:core    # Build foundational packages first
npm run clean:build   # Clear Next.js build cache
```

- Deterministic builds; `*.tsbuildinfo` artifacts are gitignored.
- CI runs typecheck → lint → tests → build → e2e in `.github/workflows/ci.yml`.

## Deployment

- **Containerized services** via `docker-compose.yml` (PostgreSQL, Redis, service containers).
- **Environment:** configure all secrets in the runtime environment (see `.env.example`). Startup fails fast with a clear message if a required production secret is missing, empty, placeholder, or a localhost default.
- **CI/CD:** GitHub Actions workflow runs 10 quality gates (architecture, code quality, testing/coverage, accessibility, performance, security scan, build, e2e).
- **Release process:** conventional commits → tag `v1.0.0` (current release) → certification reports under `docs/`.

## Documentation

- [Project report (2026-07-31)](./docs/PROJECT_REPORT_2026-07-31.md)
- [Release notes draft](./docs/RC-001_D18_Release_Notes_Draft.md)
- [Architecture standards](./09_Documents/Architecture%20Standards.md)
- [Implementation strategy](./06_Implementation/01_Implementation_Strategy.md)
- [Mission tracker](./09_Documents/Mission%20Tracker.md)
