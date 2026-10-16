# VedMoulya — S12 Controlled Release Closure (FINAL REPORT)

**Date (UTC):** 2026-10-16
**Branch:** `main` · **HEAD:** `f50663af` · **Upstream:** `origin/main` — **ahead 3** (2 pre-existing local-only commits + 1 closure commit)
**Mode:** controlled release closure. No reset, clean, amend, rewrite, push, deploy, or production migration. All 5 stashes preserved. No credential printed, logged, or committed.

---

## 1. Final Git state

| Item                                 | State                                  | Evidence                                                                                                      |
| ------------------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Branch                               | `main`                                 | `git status -sb`                                                                                              |
| HEAD                                 | `f50663af`                             | `git rev-parse HEAD`                                                                                          |
| Pre-existing local-only commits      | `f1dbce7f`, `495dec3e` — **preserved** | `git log`                                                                                                     |
| Closure commit                       | `f50663af`                             | §4                                                                                                            |
| Upstream divergence                  | `origin/main` — ahead 3, behind 0      | `git status -sb`                                                                                              |
| Stashes                              | **5/5 preserved**                      | `git stash list` (`pre-security-baseline-healthprobe`; 3 lint-staged backups; `WIP release-candidate-v1.0.0`) |
| Untracked (preserved, NOT committed) | `lint-out.txt`, `lint-output.txt`      | `git status --short`                                                                                          |

Nothing was pushed. No deployment, production migration, or paid purchase was performed.

---

## 2. Four-file review (the pre-existing working-tree changes)

| File                                                         | Change                                                                                                                                                   | Verdict                                                                                             |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `.env.example`                                               | Documents the OPT-IN `IDENTITY_SCHEMA_READINESS_GATE` and the live-provider verifier switches (`AI_PRODUCTION_VERIFY_PROVIDER` / `AI_PRODUCTION_MODEL`). | PASS — comment-only, no secret value, consistent with `SERVER_ENV_KEYS` and the readiness contract. |
| `.env.production.example`                                    | Documents the OPT-IN gate (default DISABLED, fail-closed when enabled).                                                                                  | PASS — no secret shapes; `config:contract` green for both example files.                            |
| `docs/audits/2026-10-15-s12-b-live-provider/FINAL-REPORT.md` | Adds §8 (owner decision + closure). §1–§7 preserved as history.                                                                                          | PASS — every new claim is backed by the re-run in §3.                                               |
| `docs/ops/DEPLOYMENT_GUIDE.md`                               | Adds the identity drift-gate contract and a live-provider verification subsection; lists the two new switches.                                           | PASS — matches the shipped behaviour (verified live in §5).                                         |

Secret safety: a shape scan of the staged diff found **no** credential material. `config:contract` confirms no real-looking secrets in either example file.

---

## 3. S012-B — evidence and disposition: **CLOSED**

**Owner decision (2026-10-16):** Google Gemini is accepted as the supported provider for this acceptance journey. OpenAI stays selectable and is no longer a release gate.

**Live re-run (real provider, no mock substitutes for the live leg):**

| Command                                                                                         | Exit  | Observed                                                                                                                                           |
| ----------------------------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsx --env-file=.env.local scripts/ai-production-verify.ts`                                 | **0** | `✅ PRODUCTION AI VERIFICATION PASSED — 15/15 checks, 5 live provider calls, 0 failures` on `google · gemini-3.5-flash`                            |
| `npx tsx --env-file=.env.local scripts/ai-critique-verify.ts`                                   | **0** | `✅ AI CRITIQUE VERIFICATION PASSED — 7/7 checks, 0 failures`; live critique `provider: google · model: gemini-3.5-flash`, 959 tokens, `$0.005451` |
| `LIVE_FAMILIES=google LIVE_MODEL_OVERRIDE=gemini-3.5-flash-lite …/_provider-live-acceptance.ts` | 0     | probe `connected: true`, 46 models; generation HTTP 200 `generation_success`, `answerLength: 2`                                                    |
| `LIVE_FAMILIES=openrouter …/_provider-live-acceptance.ts`                                       | 0     | probe `connected: true`, 465 models; generation HTTP 401 `invalid_api_key` (false-positive probe)                                                  |

**Latent defects corrected** (they made the success path unreachable on _any_ provider; earlier runs exited 3 at the first live call, so they had never surfaced):

1. §C `explainSelection` threw `ProviderRoutingAdvisor not configured` → the advisor is now wired from the real registered adapters (`createOrchestratorRoutingPorts`), and the check reads the DTO's actual fields.
2. §E `groundingRequired` with no `ragQuery` is rejected by the runtime → a query plus a no-knowledge-base retrieval port now exercise the real abstention path.
   No check was weakened; §F remains a labelled deterministic harness, uncounted in `liveCalls`.

**Credential slot:** `AI_OPENROUTER_API_KEY` in `.env.local` held a misplaced OpenAI project key (`sk-proj…`, 164 chars) that OpenRouter rejected with HTTP 401. It was **neutralized** (commented out, value preserved, never printed/logged/committed), so the family now honestly reports no credential (fail-closed). A genuine `sk-or-v1-…` key is required to re-enable OpenRouter.

---

## 4. Commit summary

`f50663af fix(identity): repair the readiness gate and close s012-b on gemini` — 9 files, +339/−36.

Includes the four reviewed files above plus the closure code: the two verifier scripts, the acceptance criteria (`BLOCKER-REPORT-S12-PRODUCTION.md` §2), and the identity readiness gate fix with its regression tests (§5). Staged diff verified; secret scan clean; no push.

---

## 5. Deployment readiness-gate evidence

`IDENTITY_SCHEMA_READINESS_GATE` in the **actual deployment environment: NOT RUN / BLOCKED** (owner confirmation: no authorized deployment environment is reachable from here). All evidence below is **local**, and this distinction is preserved — local green does not prove the deployed value or schema.

**Defect found and fixed (local, real PostgreSQL):** the committed `apps/web/src/lib/identity-schema-gate.ts` called `assertIdentitySchemaCurrent()` / `pendingMigrations()` **without the required `db` argument**. Against the real module both threw `TypeError: …undefined (reading 'execute')`, so an **ENABLED** gate always returned `unavailable` → `/health/ready` was **permanently 503**. The mocked unit tests (23) could not see it. The fix passes the initialized identity pool into both calls, and two regression assertions now require it.

**Verified against real PostgreSQL after the fix** (temporary gitignored probe, since removed):

| State                                | Result                                                                                 |
| ------------------------------------ | -------------------------------------------------------------------------------------- |
| Disabled (no flag)                   | `{"status":"disabled"}` — no I/O, response unchanged                                   |
| Schema current                       | `{"status":"current","version":"005_timestamptz_instants"}` → ready                    |
| Schema behind (rolled back to `004`) | `{"status":"pending","pendingMigrations":["005_timestamptz_instants"]}` → blocks (503) |
| Unreachable database                 | `{"status":"unavailable"}` → blocks (503)                                              |

Real-PostgreSQL migration suite `services/identity/__tests__/migrations.postgres.test.ts` also passed (9 tests). **Deployment-environment confirmation remains an operator action.**

---

## 6. Full release-checklist results

| Gate                          | Command                                            | Result                                                                                                                                                                   |
| ----------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Typecheck                     | `npm run typecheck`                                | **PASS** (exit 0)                                                                                                                                                        |
| Lint                          | `npm run lint`; `npm run lint:root`                | **PASS** (58 scopes, `failed=0`; root `failed=0`)                                                                                                                        |
| Format                        | `npm run format`                                   | **PASS** (after `prettier --write` on 3 edited files)                                                                                                                    |
| Config contract               | `npm run config:contract`                          | **PASS**                                                                                                                                                                 |
| Dependency cycles             | `npm run deps:cycles`                              | **PASS** (57 workspaces)                                                                                                                                                 |
| Full test suite               | `npm run test`                                     | **PASS** — 1005 files, 0 failures (442s)                                                                                                                                 |
| Coverage gate                 | `npm run test:coverage`                            | **PASS** — 28/28 workspaces                                                                                                                                              |
| Production build (web)        | `npm run build -w apps/web`                        | **PASS** (exit 0)                                                                                                                                                        |
| Bundle budgets                | `npm run test:performance`                         | **PASS** (exit 0); 2 pre-existing soft warnings: `providers/page.js` 130 kB, `settings/page.js` 60 kB (limit 50 kB)                                                      |
| Security audit                | `npm run audit` (critical)                         | **PASS** for the critical gate (exit 0); 17 pre-existing vulns (5 low, 12 high), e.g. `webpack-dev-middleware` via Storybook — no fix available                          |
| Secret scan                   | `scripts/s56-secret-scan.ps1` shape (grep replica) | **PASS** — no real secrets; hits are test fixtures (e.g. `AKIAIOSFODNN7EXAMPLE`) and built `.next` bundles. (The PowerShell script hung locally; replicated faithfully.) |
| Quality gates verify          | `npm run quality:gates:verify`                     | **PASS** — 18/18                                                                                                                                                         |
| Live provider acceptance      | §3                                                 | **PASS** — both verifiers exit 0                                                                                                                                         |
| Accessibility                 | `npm run test:a11y`                                | **PASS** — 6/6                                                                                                                                                           |
| DB migration / schema drift   | `migrations.postgres.test.ts` + gate probe §5      | **PASS (local)**                                                                                                                                                         |
| Integration / E2E             | `npm run test:e2e`                                 | **NOT RUN** — fails fast without `AUTH_JWT_SECRET`; the CI job provisions Postgres 16 + Redis and seeds `e2e-user`, which is not available locally                       |
| Production config / readiness | deployment env                                     | **NOT RUN / BLOCKED** — no authorized deployment environment                                                                                                             |
| Deployment smoke              | —                                                  | **NOT RUN** — no authorized deployment environment                                                                                                                       |
| Benchmarks                    | `npm run benchmarks`                               | **NOT RUN** — not part of the enumerated release checklist                                                                                                               |

---

## 7. Outstanding risks, dependencies, and operator actions

1. **S012-A (identity database)** — remains open/operator-gated: a managed, non-localhost `IDENTITY_DATABASE_URL` must be provisioned in an authorized platform environment; then `preflight:prod` / `doctor:prod` / `test:a11y` and `/health/ready` must pass there.
2. **S012-C (staging DR)** — remains open: no authorized staging environment exists for a backup/PITR restore drill (RTO ≤ 30 min).
3. **Readiness gate in production** — confirm `IDENTITY_SCHEMA_READINESS_GATE` in the real deployment and that its identity DB is at `005_timestamptz_instants` before enabling; enabling it against a behind/unreachable DB correctly returns 503.
4. **Deployment-environment readiness** — not confirmed from here (local-only evidence).
5. **OpenRouter** — disabled (no genuine key); supply `sk-or-v1-…` to re-enable.
6. **npm audit** — 12 high-severity advisories (pre-existing, none critical).
7. **S024-4A (revocation)** — implementation verified on real PostgreSQL, but its evidence requirement (an approved, merged migration) is now satisfied only by this commit for the readiness side; the durable-revocation migration is that earlier local-only commit `f1dbce7f`.
8. **The gate fix was applied to a local-only (unpushed) commit's content** — it should get review before any push.

---

## 8. Final release decision

**NO-GO for public production release.** Repository-side release gates are green and **S012-B is closed**, but production remains gated by the two operator/platform conditions that cannot be closed from the repository — **S012-A (managed identity database)** and **S012-C (staging DR drill)** — and the deployment-environment readiness gate is unconfirmed.

**CONDITIONAL GO for an authorized staging deployment** once the operator actions in §7.1–§7.3 are completed and their evidence captured there.
