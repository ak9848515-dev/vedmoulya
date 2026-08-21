# SPRINT-040 — Baseline Audit

**Audit date:** 2026-08-16 · **Auditor:** source inspection + live local runtime

---

## 1. Repository state

- Branch `main`; post-freeze estate (OS v1.0 frozen; SPRINT-022…039 layered on top).
- Prior sprint docs reviewed: `SPRINT-038_COMPLETION_REPORT.md` (opportunity
  discovery + revenue validation), `SPRINT-039_COMPLETION_REPORT.md` + evidence /
  customer-discovery / calibration docs (founder evidence loop), `CURRENT_ARCHITECTURE_STATE.md`,
  `PROJECT_STATUS.md`, `task_progress.md`.
- Implementation surface inspected (no duplication found):
  - `packages/world-model/src/domain/FounderEvidenceLoop.ts` — observations,
    prospects, evidence quality, bounded calibration, next-best-action, comparison.
  - `FounderObservation` / `CustomerDiscoveryRecord` / prospect status chain
    (`CONTACTED → CONVERSATION → PROBLEM_CONFIRMED → SOLUTION_INTEREST →
WTP_SIGNAL → PAYMENT_REQUESTED → VERIFIED_PAYMENT`).
  - Evidence stores (`world_observations` / `world_prospects` in the shared
    persistence bundle) + in-memory mirrors.
  - Scoring/calibration procedures (`world.evidenceQualityView`,
    `world.factorCalibrate`, `world.nextBestActionView`, `world.opportunityCompare`,
    `world.opportunityDrilldownView`).
  - Command Center drill-downs + voice read-only presentation.
  - Authentication routes (`/api/v1/identity/auth/*` — sign-up, sign-in, sign-out,
    refresh, session, google/*, health).
  - Docker configuration (`docker-compose.yml` — postgres, redis, prometheus,
    otel, grafana; **no web service**).

## 2. Identity surface (as-found)

- The web app serves the existing Identity Service auth router in-process:
  `apps/web/src/app/api/v1/identity/auth/[...path]/route.ts` →
  `apps/web/src/lib/auth-app.ts` (`getAuthApp()` — lazy Hono singleton) →
  `createAuthRouter(authService)` with `createProductionIdentityRepository()`.
- `createProductionIdentityRepository()` (services/api) resolves the
  `PostgresIdentityRepository` via the identity module's DI registration.
- Sign-up schema matches the sprint spec exactly: `email`, `password`
  (≥8, upper+lower+digit), `displayName`, optional `givenName`/`familyName`.
- Errors: `VALIDATION_ERROR` 400 · `REGISTRATION_FAILED` (400 duplicate / 409
  "Email already registered") · `AUTH_FAILED` 401 · `NO_TOKEN` / `TOKEN_INVALID` 401.
- Brute-force throttling on `/sign-in`, `/sign-up`, `/refresh` (per-client-IP).

## 3. Evidence-loop surface (as-found, SPRINT-039 — complete, exercised, honest)

- `world.observationRecord` — provenance MANDATORY, sanitized, explicit evidence
  states, `VERIFIED` cannot be self-claimed.
- `world.prospectRegister` / `world.prospectAdvance` — bounded chain, NOT a CRM;
  discovery ≠ validation, interest ≠ WTP, WTP ≠ payment.
- `world.evidenceQualityView` (8 deterministic dimensions), `world.factorCalibrate`
  (bounded delta ≤ 0.05, evidence trail, UNKNOWN never becomes zero),
  `world.nextBestActionView` (TALK_TO_CUSTOMERS / TEST_WTP / REQUEST_PAYMENT /
  VERIFY_PROBLEM / RUN_NO_COST_EXPERIMENT / STOP), `world.opportunityCompare`,
  `world.opportunityDrilldownView`.
- Revenue validation: only `verified_payment` reaches REVENUE_VERIFIED; 2 →
  REPEAT_REVENUE; 3+ → REPEATABLE_BUSINESS.

## 4. Docker estate (as-found)

- `vedmoulya-postgres` (pgvector/pg16, healthy, :5432, `vedmoulya/vedmoulya-dev`).
- `vedmoulya-redis` (healthy, :6379).
- `vedmoulya_default` network exists.
- **`vedmoulya-web` is NOT in the compose estate** — the web app runs via
  `next dev` (a web Dockerfile exists but is not wired into compose). The
  local-runtime path used for this sprint is `next dev` → Docker Postgres/Redis.

## 5. Defects found (genuine local-runtime gaps)

| #   | Defect                                                                                                                                                                                                | Impact                                                                                                                                                                  | Root cause                                                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| D1  | The `users` table is **never created anywhere** — identity DB init only opens a connection; every other Postgres store in the estate has an idempotent `ensureTable()` (`CREATE TABLE IF NOT EXISTS`) | First-run auth fails with `REGISTRATION_FAILED` (Postgres error 42P01) — local AND production first-run                                                                 | Identity store is the ONE store violating the estate convention (documented in DATABASE_V1 / platform contract as universal) |
| D2  | `IDENTITY_DATABASE_URL` unset in `apps/web/.env.local`                                                                                                                                                | `password authentication failed` against the Docker Postgres (default `postgres://localhost:5432/vedmoulya` has no credentials; compose uses `vedmoulya/vedmoulya-dev`) | Env-config gap, not code                                                                                                     |
| D3  | No email-verification delivery path exists anywhere (no SMTP usage in the identity service; no verify endpoint) while the domain blocks sign-in for unverified accounts                               | A registered email/password user could **never** sign in                                                                                                                | Pre-existing design gap (MVP definition lists email verification; nothing delivers it)                                       |
| D4  | (dev-env artifact) Next.js dev cache corruption — `Cannot find module './vendor-chunks/@vercel.js'`                                                                                                   | Raw tRPC requests 500 after a build/dev-server cache collision                                                                                                          | `.next` cache collision; resolved by clearing `.next` (dev-only, no code change)                                             |

No existing functionality was duplicated. The SPRINT-039 evidence loop itself
needed **no changes** — it was exercised as-built.

## 6. Scope decisions (per sprint rules)

- **No web container added to compose** — the objective is the operational path,
  not containerizing the web app; the path runs through `next dev` against the
  Docker estate. Adding a web service would manufacture work beyond the objective.
- **No SMTP / verification-token engine created** — fixed with a 3-line,
  dev/test-only auto-verify in the existing `AuthService.signUp` (mirrors the
  existing Google sign-in path). Production/staging behavior unchanged.
- **Schema semantics preserved** — the drizzle `users` schema declares
  `uniqueIndex` on `status_state`/`created_at`; the created DDL deliberately
  mirrors only the semantically-correct unique keys (email, google_id) — a
  unique index on status/createdAt would break multi-user operation. Documented
  as a schema-level observation, not changed.
