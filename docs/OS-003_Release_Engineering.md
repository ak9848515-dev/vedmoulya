# OS-003 — Release Engineering

> The consolidated, verified release engineering record for **VEDMOULYA OS v1.0**.
> Owner: Chief Release Architect · Sprint: OS-003 (EPIC-005) · Date: 2026-08-07
> Status: 🟢 **FROZEN**

---

## 1. Release Scripts (verified)

| Script           | Path                                                     | Purpose                                                                                                     | Verified   |
| ---------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------- |
| CI pipeline      | `.github/workflows/ci.yml`                               | 10 quality gates (typecheck, lint, format, tests+coverage, security, a11y, performance, build, e2e, result) | ✅         |
| Release pipeline | `.github/workflows/release.yml`                          | alpha → internal-beta → closed-beta → public-beta → rc → ga; Vercel deploy, GHCR image, smoke test, tag     | ✅         |
| Build all        | `scripts/build/all.sh`                                   | Whole-repo build in dependency order                                                                        | ✅         |
| Build core       | `scripts/build/core.sh`                                  | Foundation packages                                                                                         | ✅         |
| Build web        | `scripts/build/web.sh`                                   | Web app production build                                                                                    | ✅         |
| CI run           | `scripts/ci/run.sh`                                      | Local CI gate runner                                                                                        | ✅         |
| Deploy           | `scripts/deploy/deploy.sh`                               | Deployment orchestration                                                                                    | ✅         |
| Smoke test       | `scripts/deploy/smoke-test.sh`                           | Post-deploy smoke test                                                                                      | ✅         |
| Dev setup        | `scripts/dev/setup.sh`                                   | Local environment setup                                                                                     | ✅         |
| Dev start        | `scripts/dev/start.sh`                                   | Local dev server                                                                                            | ✅         |
| Backup           | `scripts/backup.sh`                                      | Database backup                                                                                             | ✅         |
| Startup          | `scripts/startup.sh`                                     | Service startup                                                                                             | ✅         |
| Shutdown         | `scripts/shutdown.sh`                                    | Graceful shutdown                                                                                           | ✅         |
| Seed EI          | `scripts/seed-ei.ts`                                     | Idempotent EI catalog seed                                                                                  | ✅         |
| Coverage gate    | `scripts/coverage-gate.mjs`                              | 28/28 workspaces ≥80%                                                                                       | ✅         |
| Bundle budget    | `scripts/check-bundle-size.sh`                           | Shared <150 kB, route <100 kB, page ≤50 kB                                                                  | ✅         |
| A11y             | `scripts/run-a11y.sh`                                    | Accessibility audit                                                                                         | ✅         |
| Load test        | `scripts/load-test.mjs` + `scripts/load/k6-load-test.js` | Load testing (post-v1)                                                                                      | ⚠️ post-v1 |

---

## 2. Versioning (frozen)

| Field             | Value                                              |
| ----------------- | -------------------------------------------------- |
| Root version      | `1.0.0`                                            |
| All 35 workspaces | `1.0.0` (lockstep)                                 |
| Git tag           | `v1.0.0`                                           |
| Release commit    | `dd4dffd3d7be6175b9bf37c0d122c642d937c942`         |
| SemVer policy     | `ARCHITECTURE_FREEZE.md` §7                        |
| Breaking change   | ADR + impact + migration + major bump + regression |

---

## 3. Build Process (verified)

| Step       | Command                             | Result                                    |
| ---------- | ----------------------------------- | ----------------------------------------- |
| Install    | `npm ci`                            | ✅                                        |
| Foundation | `npm run build:core`                | ✅                                        |
| Whole repo | `npm run build`                     | ✅ (workspace dependency order)           |
| Typecheck  | `npm run typecheck`                 | ✅ 0 errors (re-verified 2026-08-07)      |
| Lint       | `npm run lint`                      | ✅ 0/0 (`.eslint-report.json`; CI ubuntu) |
| Web prod   | `npm run build -w apps/web`         | ✅ `next build` PASS (OS-002)             |
| Bundle     | `bash scripts/check-bundle-size.sh` | ✅ PASS (OS-002)                          |
| Storybook  | `npx storybook build`               | ✅ PASS (OS-002)                          |

---

## 4. Database Migration Process (verified)

| Step           | Command                                            | Notes                                     |
| -------------- | -------------------------------------------------- | ----------------------------------------- |
| Table creation | Automatic on startup                               | `CREATE TABLE IF NOT EXISTS` (idempotent) |
| Seed           | `npm run seed:ei`                                  | Idempotent `ON CONFLICT DO UPDATE`        |
| Dry-run        | `npm run seed:ei -- --dry-run`                     | Preview without connecting                |
| Selective      | `npm run seed:ei -- --only capabilities,providers` | Target specific stores                    |
| Custom URL     | `EI_DATABASE_URL=... npm run seed:ei`              | Seed a different database                 |

---

## 5. Seed Process (verified)

- **Script:** `scripts/seed-ei.ts`
- **Stores:** capability, provider, context, execution-strategy, goal, learning,
  brain, knowledge (+relationships), memory (+relationships), os_health_registry
- **Idempotent:** re-running updates, never duplicates
- **URL resolution:** `EI_DATABASE_URL` → `IDENTITY_DATABASE_URL` → dev default

---

## 6. Health Checks (verified)

| Probe                 | Endpoint                             | Purpose                 |
| --------------------- | ------------------------------------ | ----------------------- |
| `health.check`        | `POST /api/trpc/health.check`        | Overall (public)        |
| `health.live`         | `POST /api/trpc/health.live`         | Liveness (public)       |
| `health.ready`        | `POST /api/trpc/health.ready`        | Readiness (public)      |
| `health.version`      | `POST /api/trpc/health.version`      | Version (public)        |
| `metrics.snapshot`    | `POST /api/trpc/metrics.snapshot`    | Metrics (public)        |
| `/api/metrics`        | HTTP                                 | Prometheus scrape       |
| `os.systemHealth`     | `POST /api/trpc/os.systemHealth`     | OS engine health (auth) |
| `os.validatePlatform` | `POST /api/trpc/os.validatePlatform` | Platform gate (auth)    |

---

## 7. Rollback Procedure (verified)

| Step | Action                                                    | Reference                                    |
| ---- | --------------------------------------------------------- | -------------------------------------------- |
| 1    | Identify the failing release (commit/tag)                 | `git log`                                    |
| 2    | Revert to previous release tag (e.g. `v1.0.0` → previous) | `git checkout <tag>`                         |
| 3    | Redeploy web app (Vercel)                                 | `release.yml` / `docs/ops/ROLLBACK_GUIDE.md` |
| 4    | Redeploy API gateway image (GHCR)                         | `docker build -f services/api/Dockerfile`    |
| 5    | Restore database if schema/data changed                   | `scripts/backup.sh` restore                  |
| 6    | Re-run seed if needed                                     | `npm run seed:ei`                            |
| 7    | Verify health checks                                      | `health.*` + `os.systemHealth`               |
| 8    | Document the rollback                                     | `docs/runbooks/rollback-runbook.md`          |

---

## 8. Backup Procedure (verified)

| Step | Action                            | Reference                                 |
| ---- | --------------------------------- | ----------------------------------------- |
| 1    | Run `scripts/backup.sh`           | Daily full backup                         |
| 2    | Verify backup file exists + size  | `ls -la`                                  |
| 3    | Store off-site / managed provider | `07_Operations/BACKUP.md`                 |
| 4    | Test restore on scratch instance  | `docs/runbooks/backup-restore-runbook.md` |

---

## 9. Recovery Procedure (verified)

| Step | Action                       | Reference                                   |
| ---- | ---------------------------- | ------------------------------------------- |
| 1    | Restore database from backup | `scripts/backup.sh` restore                 |
| 2    | Re-apply seed (idempotent)   | `npm run seed:ei`                           |
| 3    | Restart services             | `scripts/startup.sh`                        |
| 4    | Verify health                | `health.*` + `os.systemHealth`              |
| 5    | Verify critical journeys     | Smoke test (`scripts/deploy/smoke-test.sh`) |

---

## 10. CI Validation (verified)

| Gate                            | CI job        | Result                              |
| ------------------------------- | ------------- | ----------------------------------- |
| G1 Architecture (typecheck)     | `quality`     | ✅                                  |
| G2 Code quality (lint + format) | `quality`     | ✅                                  |
| G3 Testing + coverage           | `test`        | ✅ 6,150 tests / 28/28 coverage     |
| G4 Accessibility                | `a11y`        | ✅                                  |
| G5 Performance                  | `performance` | ✅                                  |
| G6 Security (audit + CodeQL)    | `security`    | ✅                                  |
| G7 Build                        | `build`       | ✅                                  |
| G8 E2E                          | `e2e`         | ✅ (CI-provisioned Postgres + keys) |
| Result                          | `result`      | ✅ all gates green                  |

---

## 11. Reproducibility

A clean environment (Node 22, npm 10, ubuntu-latest) can:

1. `npm ci` — install
2. `npm run typecheck` + `npm run lint` — validate
3. `npm run build` — build
4. `npm run test:coverage` — test
5. `npm run build -w apps/web` + Dockerfiles — package
6. `release.yml` — deploy

**No undocumented manual steps.** Known local-environment notes (Windows lint
OOM, Node 24 test crash, bash scripts on Windows) are documented in
`07_Operations/ENVIRONMENT_V1.md` §8 and are environment-specific, not defects.

---

_Release engineering record frozen at commit
`dd4dffd3d7be6175b9bf37c0d122c642d937c942` on 2026-08-07._
