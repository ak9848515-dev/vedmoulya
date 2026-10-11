# Security, Persistence, Deployment, and Operations

## Security

| Check                                 | Command / source                                               | Result                                                                                                                                   |
| ------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Production dependency vulnerabilities | `npm audit --production`                                       | **0 vulnerabilities** (exit 0)                                                                                                           |
| All dependency vulnerabilities        | `npm audit --audit-level=high`                                 | **17 (5 low, 12 high)** — all dev/Storybook (`webpack-dev-middleware` path traversal, GHSA-g84c-rxfj-3j2c, **no fix available**); exit 1 |
| Auth/token                            | `services/identity` (33 test files)                            | JWT + ownership guards present                                                                                                           |
| Ownership / IDOR                      | `agent-execution`, routers                                     | owner-scoped `userId` guard; path-jailed workspace tools                                                                                 |
| Operator gating                       | `OperatorGate` (`OPS_OPERATOR_IDS`, empty = deny-all)          | Present in composition                                                                                                                   |
| Governed tools                        | capability → allowlist → schema → timeout → rate-limit → audit | Source + tests                                                                                                                           |
| E2E lint (`eslint-plugin-security`)   | `npm run lint` (58 scopes)                                     | exit 0, 0 failed                                                                                                                         |

### Confirmed security observations

- **S-1 (P3):** 12 high dev-only advisories with no upstream fix (Storybook
  `webpack-dev-middleware`). Impact confined to dev tooling; production deps are
  clean. Mitigation: upgrade/replace Storybook when a fix lands; not release-blocking.
- **S-2 (unverified risk):** distributed rate limits (Redis `ioredis` is a
  dependency) and exhaustive per-router authorization were not enumerated in this
  pass; only spot-checked.
- **S-3 (unverified risk):** retention/deletion lifecycle and backup/restore for
  non-identity data not proven.

No **P0** (authorization bypass, data-loss, fabricated-success) defect was
confirmed. Fail-closed provider health removes one historical "fabricated
healthy" class of concern.

## Persistence & data integrity

| Item                  | Evidence                                                                                                                                                     | Status                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| Identity persistence  | `services/identity` Postgres repositories + 33 tests                                                                                                         | Present, tested                        |
| Mission durable store | `ApiApplicationService.ts` mission composition: `sql = hasDatabase() ? createEISql(...) : undefined`; `requireDurablePersistence: isProductionEnvironment()` | Wired; **restart/recovery not re-run** |
| Provider preferences  | `PostgresProviderPreferencesStore` + in-memory parity tests                                                                                                  | Tested                                 |
| Backup / restore      | —                                                                                                                                                            | **Unproven**                           |
| Migrations            | Not inspected in this pass                                                                                                                                   | **Missing evidence**                   |

## Deployment & operations

| Item                      | Evidence                                                                 | Status                      |
| ------------------------- | ------------------------------------------------------------------------ | --------------------------- |
| CI workflows              | `.github/` present                                                       | Present; not run this pass  |
| Docker                    | `Dockerfile` (web), `docker-compose.yml`                                 | Present; not built/deployed |
| Health endpoints          | `apps/web/src/app/health/{live,ready,check}`, `HealthRouter`             | Present                     |
| Telemetry / observability | `observability/`, trace provider, CostLedger, AlertEngine, AuditTrail    | Present                     |
| Preflight / doctor        | `scripts/preflight.ts`, `scripts/doctor.ts`, `packages/core/src/startup` | Present                     |
| Staging/deployed evidence | —                                                                        | **None**                    |
| Rollback proof            | —                                                                        | **None**                    |

## Operations findings

- **O-1 (P2):** No deployed/staging evidence; rollback and restore unproven.
- **O-2 (P3):** Repository root carries many uncommitted-to-history log/artifact
  files (`.rev*.log`, `_*.log`, `*.tsbuildinfo`) — tracked as work products;
  preserved (not deleted) per audit rules, but they add inventory noise.
- **O-3 (P3):** `packages/local-workspace/` (dist-only, no `package.json`) and
  `tsconfig.tsbuildinfo` files inside packages are build residue that should not
  be tracked.
