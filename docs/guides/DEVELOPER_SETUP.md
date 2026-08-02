# VedMoulya — Developer Setup Guide

**Version:** 1.0.0 · **Updated:** 2026-08-01 (SPRINT PR-001)

---

## Prerequisites

| Tool    | Version           | Notes                                      |
| ------- | ----------------- | ------------------------------------------ |
| Node.js | ≥ 20 (22 LTS rec) | `node -v`                                  |
| npm     | ≥ 10              | ships with Node 20+                        |
| Docker  | ≥ 24              | optional — infra services (Postgres/Redis) |
| Chrome  | latest            | required for Playwright e2e/a11y tests     |

---

## 1. Clone & Install

```bash
git clone https://github.com/ak9848515-dev/vedmoulya.git
cd VedMoulya
npm install
```

This installs all workspaces (`apps/*`, `packages/*`, `services/*`) via npm
workspaces. On Windows, run commands from **Git Bash** (POSIX syntax).

## 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` and set at minimum:

- `AUTH_JWT_SECRET` — generate with:
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- `IDENTITY_DATABASE_URL` and `REDIS_URL` (required outside `NODE_ENV=development`)
- AI provider keys if you use AI features (`AI_OPENAI_API_KEY`, etc.)

> **Fail-fast config** — in `NODE_ENV=production`, missing, empty, placeholder,
> or localhost secrets are rejected at startup with a clear message.

## 3. Start Infrastructure (optional)

```bash
docker compose up -d postgres redis          # dev infra
docker compose --profile observability up -d # + Prometheus/OTel/Grafana
```

## 4. Run the Web App

```bash
npm run dev          # Next.js dev server → http://localhost:3000
```

## 5. Run Tests

```bash
npm run test              # all unit tests (Vitest workspace)
npm run test:coverage     # per-workspace v8 coverage (80% gate)
npm run test:e2e          # Playwright (apps/web)
npm run test:a11y         # accessibility audit
npm run test:performance  # bundle-size budgets
```

## 6. Build

```bash
npm run build:core    # build foundational packages first
npm run build         # build every workspace
```

## 7. Lint, Typecheck, Format

```bash
npm run lint          # ESLint (flat config) — 0 errors / 0 warnings
npm run typecheck     # tsc --noEmit across workspaces
npm run format        # Prettier write
```

## 8. Adding a Workspace

1. Create the directory with a `package.json` using the `@vedmoulya/*` scope.
2. Wire it into `vitest.workspace.ts` if it has tests.
3. Add a `vitest.config.ts` with v8 coverage and `test`/`test:coverage` scripts.
4. Update this file's inventory below if relevant.

## Workspace Inventory

- **Apps:** `apps/web` (Next.js 15, tRPC client, Tailwind).
- **Packages (10):** `core`, `domain`, `services`, `ai`, `ui`, `config`,
  `information`, `intelligence`, `shared`, `testing`.
- **Services (12):** `api` (gateway), `identity`, `knowledge`, `memory`,
  `decision`, `execution`, `orchestrator` (AI), `learning`, `marketplace`,
  `notifications`, `career`, `business`.
- **Tooling:** `tooling/eslint-config`, `tooling/prettier-config`, `scripts/`.

## Troubleshooting

| Symptom                          | Fix                                              |
| -------------------------------- | ------------------------------------------------ |
| Startup fails on missing secret  | Set the required var in `.env.local` (fail-fast) |
| `npm ls` shows `invalid` entries | Run `npm install` to realign the lockfile        |
| Coverage gate fails a workspace  | Add tests for the uncovered branches (80% gate)  |
| Playwright can't find Chrome     | Install Chrome or set `PLAYWRIGHT_CHROMIUM_PATH` |

---

**Related:** [Module reference](./MODULE_REFERENCE.md) · [API reference](../api/API_REFERENCE.md) · [Architecture standards](../../09_Documents/Architecture%20Standards.md)
