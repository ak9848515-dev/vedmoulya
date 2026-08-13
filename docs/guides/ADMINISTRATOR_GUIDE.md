# VedMoulya — Administrator Guide

**Version:** 1.0.1 · **Updated:** 2026-08-03 (SPRINT AC-002.5)
**Scope:** Deploying, configuring and operating the AI Content Agency for real clients.

---

## 1. Architecture

The Content Agency reuses the VedMoulya platform — **no duplicated services**.

```
apps/web (Next.js + tRPC client)
   │  /api/trpc (Next.js route → gateway router)
   ▼
services/api (API gateway — AppRouter, auth, validation, rate limit)
   │  creates ContentAgencyApplicationService + ClientOperationsApplicationService
   ▼
packages/services — content-agency (AC-001 + AC-002 application services)
   │   ContentAgencyAIService ──► AIOrchestrationService (Provider Manager, no direct calls)
   │   ClientOpsAIService ──────► AIOrchestrationService
   ▼
services/content-agency (Postgres repositories via Drizzle, DI module)
   ▼
PostgreSQL (vedmoulya)
```

Reused platform services: Identity (auth), AI Orchestrator (providers/routing),
Memory Engine, Knowledge Engine (retrieval context), Dashboard/Analytics, Notifications.

## 2. Configuration (fail-fast in production)

The gateway validates the following at startup in production:

| Variable                                  | Purpose                |
| ----------------------------------------- | ---------------------- |
| `AUTH_JWT_SECRET`                         | Identity token signing |
| `IDENTITY_DATABASE_URL`                   | Identity Postgres DSN  |
| `REDIS_URL`                               | Cache / sessions       |
| Google OAuth client secret + redirect URI | Agency + portal auth   |
| SMTP credentials                          | Email notifications    |

The content-agency module reuses the platform Postgres connection
(`DATABASE_URL` / per-module DSN) — see `services/content-agency/src/schema/`.

## 3. Module Wiring & DI

- `services/content-agency/src/infrastructure/di/ContentAgencyModule.ts` registers
  `content-agency.repository` and `content-agency.client-ops.repository`.
- The gateway resolves production repositories through
  `services/api/src/infrastructure/ProductionRepositories.ts` → `registerContentAgencyServices()`
  - `initializeDatabase()` (lazy connect, idempotent).
- Adding a screen? Follow `apps/web/src/app/content-agency/_components/use-agency-page.ts`
  for the shared auth guard + breadcrumbs, and `AgencySubNav.tsx` for navigation.

## 4. Database

Tables are defined with Drizzle in `services/content-agency/src/schema/content-agency.ts`:
clients, brands, projects, content items (+ versions, reviews), invoices, leads
(+ interactions, tasks, contacts), proposals (+ versions), contracts (+ versions,
approvals), quotations, payments, documents (+ versions), portal access, ops
notifications.

**Migration flow:** run `npm run migrate` in the service (or the module's
`initializeDatabase()`) against the target Postgres before deploying new code.

## 5. Validation Gates (must be green before a client goes live)

```bash
npm run typecheck          # 0 TS errors
npm run lint               # 0 errors / warnings
npm run test               # all workspace tests
npm run build -w apps/web  # production build
npm run test:coverage      # 80% per-workspace coverage
bash scripts/check-bundle-size.sh  # ≤50 kB per page
bash scripts/run-a11y.sh   # accessibility audit
```

## 6. Operating the Agency

| Task                 | How                                                           |
| -------------------- | ------------------------------------------------------------- |
| Start Postgres/Redis | `docker compose up -d postgres redis`                         |
| Run API gateway      | `npm run dev -w services/api` (or the service entry)          |
| Run web app          | `npm run dev -w apps/web`                                     |
| Observability        | Prometheus + Grafana via the `observability` compose profile  |
| Metrics              | AI cost/tokens/latency, per-module latency, process gauges    |
| Mobile (Android)     | `npm run mobile:build:debug` (Capacitor) — see `docs/mobile/` |

## 7. Security Notes

- Portal tokens are **one-time display, hashed at rest (SHA-256)**; revoke via
  **Operations → Client Portal**.
- Client portal data is scoped to the linked client record (server-side checks).
- Documents are size-capped (2 MB MVP storage, data-URL based) — upgrade to object
  storage before large client volumes.
- AI provider keys are managed by the AI Orchestrator; no direct provider calls in
  the agency services.

## 8. Known Limitations (AC-002.5)

- PDF/DOCX export is on the roadmap (Markdown/HTML shipped).
- Live browser E2E requires the full stack (Docker + OAuth credentials) —
  see `docs/AC-002.5_Workflow_Simulation.md` for the hermetic E2E evidence.
- `listLeads`/`listPayments` do per-item child queries (N+1) — fine at first-client
  scale; batch-load before scaling (see sprint report).

---

**Related:** [Agency User Guide](./AGENCY_USER_GUIDE.md) · [Client Workflow Guide](./CLIENT_WORKFLOW_GUIDE.md) · [Developer setup](./DEVELOPER_SETUP.md) · [Deployment guide](../ops/DEPLOYMENT_GUIDE.md)
