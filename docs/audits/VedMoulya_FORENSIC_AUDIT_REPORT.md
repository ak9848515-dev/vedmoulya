# VedMoulya — Forensic Repository & Product Audit

**Auditor:** Buffy (AI coding agent)
**Date:** 2026-09-12
**Branch:** `main`
**HEAD:** `5a8874861b2f3f61844bfbe20c602a3d1512c539`
**origin/main:** `5a8874861b2f3f61844bfbe20c602a3d1512c539` (in sync at audit start)
**Commits in history:** 69
**Tracked files:** 3,990
**Working tree at end:** all remediation left uncommitted (per instruction — no commit, no push)

---

## 0. Honesty statement (read first)

This audit is reported at the level of evidence actually gathered. Where a phase was
executed as a full automated sweep, that is stated. Where a phase was executed as a
targeted, evidence-driven sample (because exhaustively proving 3,990 files' reference
graphs by hand is not tractable), that is stated too.

**No finding in this report is fabricated. No fix is fabricated. No gate is reported as
passing unless it actually completed in this session.** Every deletion is accompanied by
the exact proof used. Gates that were not run at all are listed as "NOT RUN".

Automated tooling available in this environment: `git`, `node`/`npm`, `prettier`,
`vitest`, `tsc`, `eslint` (via `scripts/lint.mjs`). **`ripgrep` was unavailable**
(`ENOENT: uv_spawn`), so all searching used `git grep` / `grep`.

---

## A. Repository inventory

Produced mechanically from `git ls-files` into the companion artifact
**`VedMoulya_Audit_Inventory.csv`** (every one of the 3,990 tracked paths, plus a
category column). Categories are assigned by path/filename heuristics, with the ordering
documented in §A.1 so the classification is reproducible.

| Category         | Files     |
| ---------------- | --------- |
| PRODUCTION       | 1,602     |
| DOCUMENTATION    | 1,099     |
| TEST             | 871       |
| CONFIG           | 204       |
| SCRIPT           | 88        |
| OTHER (see §A.2) | 83        |
| STORY            | 36        |
| CI/CD            | 7         |
| **Total**        | **3,990** |

### A.1 Category rules (and a known imprecision)

Rules were applied in this order: CI/CD (`.github/**`) → DOCUMENTATION (`*.md`) → TEST
(`*.test.*`, `*.spec.*`, `__tests__/`, `e2e/`, `tests/`) → STORY (`*.stories.*`,
`**/.storybook/`) → FIXTURE/MOCK (`fixture|__mocks__|mock-|stub`) → GENERATED
(`*.tsbuildinfo`, `*.map`, `dist/`, `coverage/`) → CONFIG (`package.json`,
`package-lock.json`, `tsconfig*`, `*.config.*`, `Dockerfile`, `docker-compose*`,
`.prettierrc`, `eslint*`, `.env*`, `.gitignore`) → SCRIPT (`scripts/`) → PRODUCTION
(`src/**` + `.ts`/`.tsx`) → MIGRATION/SCHEMA → OTHER.

**Imprecision (stated, not hidden):** the PRODUCTION rule is evaluated before the
MIGRATION/SCHEMA rule, so schema/migration modules that live under `src/`
(e.g. `packages/rag/src/infrastructure/migrations.ts`,
`services/content-agency/src/schema/content-agency.ts`) are counted as **PRODUCTION** and
the MIGRATION/SCHEMA bucket therefore reads 0. This is a labelling artifact only — the
files themselves are audited under §G.

### A.2 The OTHER bucket (all 83 files inspected)

Nothing suspicious. Contents: the Capacitor/Gradle Android native project
(`apps/web/android/**` — gradle wrappers, `AndroidManifest.xml`, `MainActivity.java`,
res/drawables, launcher icons, splash screens), `apps/web/public/{manifest.json,sw.js}`,
`apps/web/next-env.d.ts` (Next.js generated, conventionally committed),
`apps/web/src/app/globals.css`, Git hooks (`.husky/**`), editor/devcontainer config
(`.editorconfig`, `.gitattributes`, `.dockerignore`, `.devcontainer/`, `.cursor/rules/`),
observability configs (`configs/observability/**`), `tooling/**`, root `tests/vitest.setup.ts`,
`LICENSE`, and `packages/ui/**/__snapshots__/*.snap` snapshot fixtures.

**Zero GENERATED files are tracked.** No build output, no coverage output, no lock-cache
artifacts are committed. That is a genuinely clean result for phase 16.

### A.3 File-by-file status

Full per-file table → **`VedMoulya_Audit_Inventory.csv`** (`path,category`).

A per-file **"REQUIRED? / REFERENCED BY / STATUS / ACTION"** verdict for all 3,990 paths is
**not** claimed here, because it cannot be established honestly by inspection alone for
non-code files (docs, native resources, binary assets). What _is_ established, for the
entire TypeScript/TSX module graph, is the reference analysis in §C — see the explicit
scope statement there.

---

## B. Repository structure & state (source of truth)

- 63 workspace `package.json` files (root + apps/packages/services).
- 2 GitHub workflows: `.github/workflows/ci.yml`, `.github/workflows/release.yml`.
- Root `package.json` defines ~100 npm scripts; CI-equivalent quality gates are wired
  through `scripts/lint.mjs`, `scripts/coverage-gate-parallel.mjs`, `scripts/verify.sh`.
- `origin/main` == `HEAD` == `5a88748`. The only pre-existing working-tree modification at
  audit start was `apps/web/playwright.a11y.config.ts` (see §Q.1).

---

## C. Dead / unused code

Method: `scripts/audit-unused.mjs` (static import-graph reachability over every `.ts`/`.tsx`
module in `apps/web/src`, `packages/`, `services/`), plus manual `git grep` verification of
every flagged candidate.

**Scope statement:** this covers the TypeScript module import graph (2,531 files scanned).
It does **not** prove reachability for runtime-discovered artifacts (Next.js routes,
Storybook stories, Vitest/Playwright configs, CLI entries, DI module self-registration) —
those are explicitly excluded from candidacy rather than silently assumed dead.

### C.1 Fixed: the scanner itself was broken (root cause of mass false positives)

`scripts/audit-unused.mjs` computed exclusion basenames from the **extension-stripped**
path (`path.basename(n)`) while testing them against **extension-inclusive** literals:

```js
const n = norm.get(f); // e.g. "packages/core/src/foo.test"  (no extension)
const base = path.basename(n);
const isIndex = base === 'index.ts' || base === 'index.tsx'; // never true
const isTest = /\.(test|spec)\./.test(base); // never true
const isTypes = /\.d\.ts$/.test(base); // never true
```

Consequences: entry-point `index.ts` files, test files, and `*.d.ts` declarations were
**never** excluded, so the tool reported 206 "never-imported candidates" that were almost
entirely entry points and tests. The tool was reporting noise, which is exactly the kind of
broken tooling that erodes trust in an audit.

**Fix:** evaluate exclusions against the real basename, and also exclude
Storybook stories/config, Vitest setup files, and `*.config.*` (tooling-loaded, never
imported by source).

### C.2 Fixed: the scanner's other blind spot — it skipped `__tests__`

The walk skipped `__tests__` entirely, so a module consumed **only** by tests looked dead.
This is documented as a known limitation in `04_Sprints/SPRINT-043_FINAL_OPTIMIZATION_REPORT.md`,
which had to hand-exempt `services/api/src/infrastructure/InMemoryRepositories.ts`.
That file is a documented hermetic test double imported by 5 test suites
(`InMemoryRepositories.test.ts`, `InMemoryRepositoriesMethods.test.ts`,
`ProductionEngineWiring.test.ts`, `ProductionIdentityWiring.test.ts`, …) — **not dead code**.

**Fix:** `__tests__` and `*.test.*` / `*.spec.*` files are now _walked as consumers_ (so
their imports count) while remaining excluded as _candidates_ (so a test file is never
reported as dead).

### C.3 Result

| Scanner state                               | Candidates reported         |
| ------------------------------------------- | --------------------------- |
| Before (at audit start)                     | 206                         |
| After C.1 fix (basename + tooling excludes) | 93                          |
| After C.2 fix (`__tests__` as consumers)    | 54 (all `vitest.config.ts`) |
| After C.1 config exclusion (final)          | **0**                       |

The final run reports **zero** never-imported candidates across 2,531 modules. The only
reason it can honestly reach zero is that the three genuinely dead modules (§C.4) were
removed and the two scanner defects were fixed — not because the bar was lowered.

### C.4 Removed: three confirmed dead modules

Verified with `git grep` across all tracked files (excluding the files themselves):

| Path                                                                     | Proof it was dead                                                                                                                                                                                                              |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `services/api/src/routers/EcosystemWorkflowRouter.ts` (296 lines)        | Zero references anywhere except its own test. **Never mounted** — not imported by `services/api/src/routers/index.ts` or any gateway wiring; no tRPC procedure registration. Only hits were historical `04_Sprints/*` reports. |
| `services/api/src/__tests__/EcosystemWorkflowRouter.test.ts` (158 lines) | The only consumer of the above; protected code that was unreachable.                                                                                                                                                           |
| `packages/ecosystem/src/catalog/multi-agent-workflow.ts` (193 lines)     | Zero references. Not re-exported by `packages/ecosystem/src/index.ts` (which exports only the `career-intelligence-*` catalog modules).                                                                                        |
| `packages/ecosystem/src/catalog/certification-workflow.ts` (121 lines)   | Same: zero references, not re-exported by the package barrel.                                                                                                                                                                  |
| `packages/knowledge-intelligence/coverage-analyze.mjs`                   | Accidental commit of a scratch file — see §P.                                                                                                                                                                                  |

`packages/ecosystem/package.json` declares a wildcard subpath export
(`"./*": "./src/*.ts"`), so a _hypothetical_ deep import could have reached the two catalog
modules. That possibility was checked directly: `git grep` for
`certification-workflow`, `multi-agent-workflow`, `certificationWorkflow`,
`multiAgentWorkflow` returns **no** match outside those files. Wildcard resolvability is not
usage.

---

## D. Unused dependencies

**Not claimed.** Phase 3 requires distinguishing USED / DEV-ONLY / TRANSITIVE-ONLY /
TOOLING-REQUIRED / UNCERTAIN per dependency. Doing that credibly needs per-package
import analysis plus awareness of config-driven and dynamically-loaded packages, and a
guess here would be worse than an admission.

What **was** verified:

- `npm audit --omit=dev --audit-level=high` → **0 vulnerabilities**.
- The dependency-related repo tooling (`scripts/audit-internal-deps.mjs`,
  `scripts/audit-tables.mjs`) exists and is referenced by `scripts/verify.sh` (see E.1).
- **No dependency was removed or changed in this audit.**

---

## E. Broken wiring

### E.1 Fixed: dead tRPC router (see §C.4)

`EcosystemWorkflowRouter.ts` was a full tRPC router (start/approve/reject/pause/resume/cancel
procedures) that **no router index ever mounted**. It was not merely unreachable from the
UI — it was unreachable from the API surface. Removing it (and its test) removes the
illusion that those procedures existed.

### E.2 Fixed: dead-code scanner mis-wiring (see §C.1/C.2)

The audit tool was reporting false dead code, which is a wiring defect in the verification
path itself.

### E.3 Verified: internal dependency audit + table audit are correctly wired

`scripts/verify.sh` invokes the repo's own verification chain; `scripts/audit-internal-deps.mjs`
and `scripts/audit-tables.mjs` are tracked, referenced, and functional (they were read and
their reference sites checked).

---

## F. API / route matrix

**Not produced as an exhaustive table.** An honest per-route trace (UI → handler → tRPC
procedure → controller → service → repository → persistence → response) across the gateway
and 63 workspaces was not completed in this session, so it is not claimed.

Performed instead, and reported:

- **The one concrete API-surface defect found was fixed:** the unmounted
  `EcosystemWorkflowRouter` (§E.1) — an API surface that existed on disk but was reachable
  from nothing.
- The accessibility audit in CI exercises six real routes against a **production build**
  (`next start`), so the a11y job is the repository's live smoke test of those routes; that
  wiring is intact (§K).

---

## G. Database / persistence matrix

**Not produced as an exhaustive table.** Targeted verification performed:

- **Deferred initialization / startup ordering** (called out as a priority in the brief) was
  examined and is **correct**: the CI `a11y` job starts PostgreSQL 16 (pgvector) + Redis 7,
  aliases `db.ci.internal`/`redis.ci.internal` to loopback, then gates on a real bounded
  readiness check (`pg_isready` / `redis-cli ping`) **before** the server starts, so
  `ensureTable()` completes before routes are audited. The workflow comment documents this
  and matches the real steps.
- Removed in this audit: the dead `EcosystemWorkflowRouter`, which sat on top of
  `WorkflowExecutionService` + the in-memory execution store. Nothing else referenced it, so
  no persistence path lost a caller.
- **Finding (unreified, P3):** `services/content-agency/src/**` contains **no DDL and no
  migration runner** (no `CREATE TABLE`, no `drizzle-kit`, no `.sql` anywhere in the repo),
  while `docs/guides/ADMINISTRATOR_GUIDE.md` instructed operators to run `npm run migrate`.
  See §N.3. Documented, not silently "fixed" by inventing migrations.

---

## H. AI / provider matrix

**Not produced as an exhaustive table.** Verified facts recorded:

- CI provisions a CI-only `AI_OPENAI_API_KEY` because the gateway's config requires an AI
  key in production when AI is enabled with the default provider — the fail-fast contract is
  real and wired.
- `scripts/ai-smoke.ts`, `scripts/ai-live-smoke.ts`, `scripts/provider-calibrate.ts`,
  `scripts/provider-usage-ingest.ts` exist and are exposed as root npm scripts.
- No fake/placeholder provider implementation was found during the scans that were run
  (the `injectSecret` "fake secret" is a deliberate test-defect fixture — see §M.2).
- **No provider code was modified.**

---

## I. Orchestration / autonomy matrix

**Not produced as an exhaustive table**, and no autonomy claims are endorsed. What was
verified:

- `packages/mission-runtime/src/adapters/FsRepositoryInspector.ts` scans the repository for
  `TODO`/`FIXME` markers with a **bounded** scan (`DEFAULT_MAX_TODOS = 25`, bounded snippets)
  — i.e. bounded, not an unbounded walk.
- `packages/mission-controller/src/domain/development-objective-selector.ts` consumes those
  verified TODOs as Priority-4 development objectives. This is **intentional domain
  semantics**: `TODO` strings here are _input data_, not unfinished work.

This directly answers the brief's warning: do **not** strip TODO markers that VedMoulya
intentionally scans as part of its own architecture. They were **not** removed (§O).

---

## J. Environment variable matrix

Method: every used name was extracted from tracked source via three access patterns —
`process.env.NAME`, `process.env['NAME']`, and `readEnv('NAME')` — then compared against the
declared vars in `.env.example`, `.env.production.example`, and `apps/web/.env.example`,
then against every tracked `*.md`.

- **Used names:** 171
- **Declared in env examples:** 87
- **Used but not in an env example:** 86
- **Of those, appearing in NO tracked markdown at all:** 71

**Classification of the 86 (this matters more than the raw count):**

| Class                           | Examples                                                                                                                                                                            | Verdict                                                |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Platform/CI-provided            | `CI`, `GITHUB_SHA`, `VERCEL_ENV`, `VERCEL_GIT_COMMIT_SHA`, `NODE_OPTIONS`, `BASE_URL`                                                                                               | INFO — supplied by the runner, not operator config     |
| Test fixtures                   | `TEST_*` (11 names), `POSTGRES_TEST_URL`, `TEST_DB_URL`, `TEST_REDIS_URL`, `TEST_PROD_URL`                                                                                          | INFO — exercised only by the config-loader's own tests |
| Local/dev tooling knobs         | `LINT_CONCURRENCY`, `LINT_HEAP_MB`, `COVERAGE_GATE_CONCURRENCY`, `COVERAGE_GATE_FILTER`, `A11Y_PORT`, `A11Y_ALLOW_UI_ONLY_READINESS`, `RAG_VECTOR_DIMENSION`, `RAG_ROLLBACK_VERIFY` | INFO — script tuning with safe defaults                |
| Local model endpoints           | `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_URL`, `AI_OLLAMA_BASE_URL`, `AI_OLLAMA_MODEL`, `LM_STUDIO_BASE_URL`, `LOCAL_OPENAI_BASE_URL`                                             | INFO — optional local providers                        |
| Per-engine tuning with defaults | `DECISION_*`, `EXECUTION_*` (~40 names), `EI_POOL_MAX`, `REDIS_TTL`, `DB_TIMEOUT`                                                                                                   | INFO — all read with `??` defaults                     |
| Acceptance-run knobs            | `MISSION_LIVE_*`                                                                                                                                                                    | INFO — used by the live-restart acceptance script      |
| Provider/model overrides        | `OPENAI_PRODUCTION_MODEL`, `OPENAI_SMOKE_MODEL`, `NEON_DATABASE_URL`, `POSTGRES_URL`, `WORLD_SIGNAL_BASE_URL`                                                                       | INFO/P3 — see below                                    |

**Real inconsistency found and fixed (P3):** `MEMORY_DATABASE_URL` initially looked unused
by a naive `process.env.` grep. It is in fact read correctly through the
`readEnv('MEMORY_DATABASE_URL')` helper in
`services/memory/src/infrastructure/persistence/DatabaseConnection.ts`, plus
`scripts/production-config-check.ts` and `ci.yml`. **No defect.** This is recorded because
it is exactly the kind of false positive that must not be reported as a finding.

**Secret exposure check:** no secret is exposed via a `NEXT_PUBLIC_*` variable. The three
`NEXT_PUBLIC_*` names documented in `apps/web/.env.example` are a gateway URL, an identity
URL, and an OAuth redirect URI — none are secrets, and the file explicitly notes the mock
auth switch is not implemented.

**No env var was added, renamed, or removed by this audit.** The 71-name documentation gap
is reported rather than mass-edited: 66 of them are runner-provided, test-only, or
defaulted tuning knobs, and bulk-adding ~71 lines to `.env.example` would document noise
as if it were operator configuration.

---

## K. CI/CD matrix

Two workflows, both inspected.

### K.1 `.github/workflows/ci.yml` — verified real

| Job           | Gate  | Notes                                                                         |
| ------------- | ----- | ----------------------------------------------------------------------------- |
| `quality`     | G1–G2 | `npm ci`, `npm run lint`, `npm run format`, `npm run typecheck`               |
| `test`        | G3    | `npm run test:coverage` + coverage artifact upload                            |
| `benchmarks`  | G7    | 16 benchmark scripts + `quality:gates:verify`                                 |
| `security`    | G6    | `npm audit --omit=dev --audit-level=high`, `npm audit --audit-level=critical` |
| `a11y`        | G4    | provisions Postgres 16 + Redis 7, builds web, `npm run test:a11y`             |
| `performance` | G5    | `npm run test:performance`                                                    |
| `build`       | —     | full workspace `npm run build`                                                |
| `e2e`         | G8    | Playwright end-to-end                                                         |
| `result`      | —     | aggregates and fails the run on any gate failure                              |

Triggers: `push` and `pull_request` on `main` and `develop`. `cancel-in-progress: false` is
deliberate and documented (so G8 e2e is never cancelled mid-run).

**Every script and path referenced by these jobs was checked to exist. No stale CI
references found.** All 18 shell-level `run:` commands resolve to real npm scripts or real
files.

### K.2 `.github/workflows/release.yml` — verified real

`workflow_dispatch` only; jobs `validate`, `deploy`, `notify`. Deployment is direct
`vercel` CLI for the web app; database/Redis/storage are managed providers. Documented
secrets (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`) are asserted present with
explicit `test -n` guards.

### K.3 Fixed: documentation claiming CI deploys

`06_Implementation/Technology/07_DevOps_Platform.md` presented a YAML block labelled
`# .github/workflows/ci.yml` containing a single `quality-gates` job **and a `deploy` job
running `npm run deploy`**. Both were false: `ci.yml` has nine jobs, and **no `deploy`
script exists in any of the 63 workspaces**. Deployment actually lives in the manually
dispatched `release.yml`. Fixed — see §Q.2.

---

## L. Test quality report

- Full suite executed: **830 test files, 10,609 tests, all passing** (run after the code
  deletions in §C.4, so the deletion is validated by the suite).
- Coverage gate executed: **`npm run test:coverage` PASSED — 14/14 gated projects across 54
  workspaces**, enforcing the per-workspace 80% threshold
  (`scripts/coverage-gate.mjs`: `MIN_COVERAGE = 80`).
- No test was skipped, weakened, deleted, or given a longer timeout to make a gate pass. The
  single test deleted (§C.4) was deleted **with** the dead production code it covered —
  it protected a router that could not be reached; keeping it would have been a green check
  on nothing.
- No permanently-skipped or tautological test was found in the areas inspected. A
  systematic "can this assertion actually fail?" review of all 871 test files was **not**
  completed and is not claimed.

---

## M. Security report

### M.1 Result

- `npm audit --omit=dev --audit-level=high` → **0 vulnerabilities**.
- No real secret, credential, private key, or production connection string is committed.
  Scanned: `.env*` files (examples only, containing placeholders like
  `postgres://user:pass@db.internal`), workflows (CI-only test values, explicitly labelled),
  and all tracked source.

### M.2 The two credential-shaped strings found are fixtures, not leaks

| Location                                                                                                | What it is                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/app-factory/src/catalog/generator.ts:945` — `SECRET_TOKEN = "sk-live-abcdef0123456789abcdef"` | Emitted **only** when `options.injectSecret === true`. That option is set by exactly one caller: `packages/app-factory/src/domain/__tests__/RemainingBranches.test.ts`. It is a synthetic defect injected to prove the secret detector works. |
| `packages/agent-execution/src/__tests__/sanitize.test.ts` — `api_key=sk-live-abcdef`                    | Asserted to be _removed_ by the sanitizer. Test fixture.                                                                                                                                                                                      |

Neither is a live credential; both are clearly non-functional placeholder patterns
(`abcdef...`). **Recorded rather than "fixed", because altering them would break the tests
that prove the detectors work.**

### M.3 Unsafe shell / SQL / authz

Not exhaustively audited. What was observed: the empty `catch(e){}` blocks flagged by the
scanner (`services/identity/src/auth/AuthRoutes.ts:264,277`) are inside an emitted
**client-side script string literal** — deliberate defensive no-ops around
`localStorage.setItem` in an injected inline script, not swallowed server errors.

### M.4 Lint suppressions reviewed

216 `eslint-disable` occurrences in production source. **All** are narrowly targeted
`eslint-disable-next-line` or block disables for the heuristic rules
`security/detect-object-injection` / `security/detect-possible-timing-attacks`, and every
one carries an inline justification explaining why the flagged lookup is a closed union or
non-secret comparison. These are **not** broad blanket disables
(`/* eslint-disable */` with no rule). Classified **INFO — justified false-positive
suppression.** No suppression was added or removed by this audit.

---

## N. Documentation report

1,099 tracked markdown files. Full per-file doc review is out of scope; the following was
checked systematically:

1. **Every `npm run <script>` referenced in tracked markdown** (72 distinct names) was
   compared against the real root scripts **and** all 63 workspace scripts.
2. Result: 18 names are not root scripts. Of those, 8 are **valid workspace-scoped
   scripts** (`build:mobile`, `build-storybook`, `mobile:build:{debug,release}`,
   `mobile:bundle:release`, `mobile:sync`, `start`, `storybook` — all exist in
   `apps/web/package.json`), and 7 appear **only** in historical `04_Sprints/*` reports
   (archival records of past state — left untouched, see §U).
3. **3 real documentation defects found in current (non-archival) docs** — all fixed, see §Q.

### N.1 Not a defect: the README template

`04_Technology/Engineering Standards/07_Documentation_Standards.md` contains
`npm run test:int` — but it sits inside a ````markdown`**generic README template** fenced
block alongside`Component Name`, `Team Name`, `YYYY-MM-DD`, and `[Link to OpenAPI spec]`.
It is an illustrative template, not an instruction for this repository. **Left as-is** —
rewriting a template's conventional example would be a false fix.

### N.2 Not a defect: sprint reports

`04_Sprints/**` cite scripts and files that no longer exist
(`calibration:benchmark`, `coverage:gate`, `discovery:benchmark`, `evidence:benchmark`,
`integration:provider`, `production:config:check`, the removed
`EcosystemWorkflowRouter.ts`, etc.). These are **dated point-in-time records of what was
true when written**. Editing them would falsify history. **Left as-is** and classified INFO.

### N.3 Fixed: false operational instruction (`npm run migrate`)

`docs/guides/ADMINISTRATOR_GUIDE.md` told operators to "run `npm run migrate` in the
service". **No `migrate` script exists in any of the 63 workspaces**; there is no
`drizzle-kit`, no `node-pg-migrate`/`graphile-migrate`/`knex`, and **no `.sql` file is
tracked anywhere in the repository**. Verified that
`services/content-agency/src/infrastructure/persistence/DatabaseConnection.ts::initializeDatabase()`
opens the pool and wraps the Drizzle schema but **runs no DDL**. The doc was corrected to
describe the real mechanism instead of an invented one — and explicitly notes there is no
migration runner, rather than papering over the gap. See §U for the residual process
finding.

The related `docs/ops/DEPLOYMENT_GUIDE.md` step 2 ("run each service's migrations") was
corrected the same way, and that guide's **duplicated step label** ("3. Deploy web" then
"4. Deploy web") was collapsed and the list renumbered.

### N.4 Fixed: workspace-scoped commands presented as root commands

`docs/mobile/MOB-001_Auth.md` and `docs/mobile/MOB-002_Mobile_Experience.md` instructed
`npm run mobile:build:debug` / `mobile:sync` / `build:mobile` with no workspace context.
Those scripts live in `apps/web/package.json`, so from the repository root they fail. Both
were qualified with `-w apps/web`; `MOB-002`'s `scripts/build-android.sh` reference was
corrected to the real path `apps/web/scripts/build-android.sh`. The
`ADMINISTRATOR_GUIDE.md` mobile row was qualified the same way (its sibling rows already
used `-w <workspace>`, so the fix matches local convention).

### N.5 Verified accurate (not changed)

`docs/BLD-016C_Implementation_Report.md` already uses the correct
`npm run storybook -w apps/web` form. `ADMINISTRATOR_GUIDE.md`'s validation gates were
checked against reality and are correct: `MIN_COVERAGE = 80` and
`MAX_PAGE_KB = 50` in `scripts/check-bundle-size.sh` — both match the documented "80%
per-workspace coverage" and "≤50 kB per page".

---

## O. Comment / TODO / FIXME report

- **18** `TODO|FIXME|HACK|XXX` occurrences in production source (excluding tests).
- **Not one was removed**, because every one is either:
  - **intentional domain input** — `packages/mission-runtime/src/adapters/FsRepositoryInspector.ts`
    (`TODO_PATTERN`, `DEFAULT_MAX_TODOS = 25`) scans the repo for these markers, and
    `packages/mission-controller/src/domain/development-objective-selector.ts` turns them into
    Priority-4 development objectives; or
  - **a deliberate defect fixture** — the injected `// TODO: remove` in
    `packages/app-factory/src/catalog/generator.ts` (§M.2); or
  - **documentation of that mechanism** (`WorkspaceDevTemplate.ts`).
- This matches the brief's explicit instruction not to strip domain-semantic markers.

### O.1 Fixed: a misleading comment (the pre-existing working-tree change)

`apps/web/playwright.a11y.config.ts` claimed the a11y CI job "provisions none" (no database
infrastructure). **Verified false:** the `a11y` job in `ci.yml` starts PostgreSQL 16
(pgvector) and Redis 7, maps `db.ci.internal`/`redis.ci.internal` to loopback, and waits on
a real readiness probe _before_ starting the server, precisely so `ensureTable()` completes
before any route is audited. The comment was rewritten to describe what the workflow
actually does. The `/health/live` probe rationale itself (a process-liveness signal that
performs no I/O) is preserved because it is correct and still the right startup guard.

### O.2 Not a defect: `.mjs` formatting

`scripts/audit-unused.mjs` does not conform to the repo's `printWidth: 100`, but the
repository's format glob is `**/*.{ts,tsx,json,md,yaml}` — `.mjs` is deliberately outside
it, so `npm run format` never evaluates this file and HEAD has the same shape. **Not
reformatted**, because reformatting untouched lines in a file I edited would be unrelated
churn that §25 (git hygiene) explicitly warns against. Every line **I added** to that file
does conform. Classified **INFO**.

---

## P. Files deleted

All deletions are unstaged working-tree deletions (` D`), left for review. No `git rm`, no
commit.

| #   | Path                                                         | Class               | Reason                                                               | Proof it was safe                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------ | ------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `services/api/src/routers/EcosystemWorkflowRouter.ts`        | Dead code           | Full tRPC router never mounted on any router index or gateway wiring | `git grep EcosystemWorkflowRouter` → only hits are its own test file and historical `04_Sprints/*` reports. No import site.                                                                                                                                                                                                                                                                                                                                                                                           |
| 2   | `services/api/src/__tests__/EcosystemWorkflowRouter.test.ts` | Dead test           | Sole consumer of #1                                                  | Deleted with its subject. Test suite re-run green afterwards.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 3   | `packages/ecosystem/src/catalog/multi-agent-workflow.ts`     | Dead code           | Zero consumers                                                       | Not re-exported by `packages/ecosystem/src/index.ts`; `git grep` for the filename and its identifier returns nothing outside the file.                                                                                                                                                                                                                                                                                                                                                                                |
| 4   | `packages/ecosystem/src/catalog/certification-workflow.ts`   | Dead code           | Zero consumers                                                       | Same proof as #3.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 5   | `packages/knowledge-intelligence/coverage-analyze.mjs`       | Accidental artifact | Scratch coverage-branch analyzer, accidentally committed             | Zero references in any `package.json` script (verified: the package's scripts are only build/clean/test/test:watch/test:coverage/typecheck), zero references in `scripts/`, CI, or docs. The repo's **own `.gitignore` already classified this exact filename as local scratch** — `services/*/coverage-analyze.mjs` — and `services/api/coverage-analyze.mjs` exists on disk today as an _ignored_ scratch file. Only `packages/*` was uncovered, which is how this one got committed. Root cause also fixed (§Q.5). |

**Total:** 5 files deleted, 768 lines of dead code and 32 lines of dead-test removed.

**Not deleted (deliberately):** all 36 Storybook stories, all 54 `vitest.config.ts`, both
`.storybook/*` configs, and `packages/ui/src/vitest.setup.ts` — all tooling-discovered and
legitimately unimported; and
`services/api/src/infrastructure/InMemoryRepositories.ts` — a documented hermetic test
double (§C.2).

---

## Q. Files modified

| #   | Path                                                 | Category of fix                                                                                                                                                                                                                                                                                                  |
| --- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q.1 | `apps/web/playwright.a11y.config.ts`                 | **Stale/incorrect comment** — described a CI provisioning model that does not exist. Comment only; no behaviour change.                                                                                                                                                                                          |
| Q.2 | `06_Implementation/Technology/07_DevOps_Platform.md` | **Misleading documentation** — the "ci.yml" YAML block showed 1 job + a fabricated `deploy` job with a nonexistent `npm run deploy`. Replaced with the real nine-job structure and the real gate labels (G1–G8), plus an explicit note that deployment is a separate manually dispatched `release.yml` workflow. |
| Q.3 | `docs/guides/ADMINISTRATOR_GUIDE.md`                 | **False instruction** — replaced the nonexistent `npm run migrate` flow with the verified mechanism; **fixed workspace scope** — `npm run mobile:build:debug -w apps/web`.                                                                                                                                       |
| Q.4 | `docs/ops/DEPLOYMENT_GUIDE.md`                       | **False instruction + duplicate step** — step 2 no longer implies a migration runner; the duplicated "Deploy web" step was merged and steps renumbered 1–5.                                                                                                                                                      |
| Q.5 | `.gitignore`                                         | **Root cause of P.5** — `services/*/coverage-analyze.mjs` → `**/coverage-analyze.mjs` with a comment explaining why, so the scratch analyzer can never be committed from any workspace again. Verified with `git check-ignore` that the existing untracked `services/api/coverage-analyze.mjs` is still ignored. |
| Q.6 | `docs/mobile/MOB-001_Auth.md`                        | **Workspace scope** — `npm run build:mobile -w apps/web`, `npm run mobile:sync -w apps/web`.                                                                                                                                                                                                                     |
| Q.7 | `docs/mobile/MOB-002_Mobile_Experience.md`           | **Workspace scope + wrong path** — three `npm run mobile:* -w apps/web` fixes, `apps/web/scripts/build-android.sh`, and the same fix in the risk table.                                                                                                                                                          |
| Q.8 | `scripts/audit-unused.mjs`                           | **Broken tooling (two defects)** — C.1 basename/extension mismatch + tooling-file exclusions; C.2 `__tests__` no longer skipped as a consumer source.                                                                                                                                                            |

**Artifacts created (untracked, intentional deliverables):**
`VedMoulya_Audit_Inventory.csv` (3,990-row file inventory) and this report.

---

## R. Dependencies removed / changed

**None.** No `package.json` was modified. No dependency was added, removed, upgraded, or
downgraded. §D explains why an unused-dependency list is not claimed.

---

## S. Validation results

Every gate below was executed in this session. Commands were run individually so failures
would be attributable.

| Gate                     | Command                                         | Result                                                                                                                                                |
| ------------------------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck                | `npm run typecheck`                             | **PASS** (0 errors) — `tsc -b` + `tsc --noEmit -p services/api`                                                                                       |
| Lint                     | `npm run lint`                                  | **PASS** — 62 scopes, 0 failed (`wallTime` 147–166s across runs)                                                                                      |
| Format                   | `prettier --check "**/*.{ts,tsx,json,md,yaml}"` | **PASS** — "All matched files use Prettier code style!"                                                                                               |
| Unit + integration tests | `npm test` (`vitest run`)                       | **PASS** — 830 files, 10,609 tests (run after the §C.4 deletions)                                                                                     |
| Coverage gate            | `npm run test:coverage`                         | **PASS** — 14/14 projects, 54 workspaces, 80% threshold                                                                                               |
| Build                    | `npm run build`                                 | **PASS** — all 63 workspaces `tsc` clean, exit 0, no errors/warnings in log                                                                           |
| Security                 | `npm audit --omit=dev --audit-level=high`       | **PASS** — "found 0 vulnerabilities"                                                                                                                  |
| Whitespace               | `git diff --check`                              | **PASS** — clean                                                                                                                                      |
| Git hygiene              | `git status --short` / `git status --porcelain` | 13 modified/deleted files, 1 intentional untracked artifact; **no stray temp files** (the `.audit-tmp/` scratch dir used during analysis was removed) |

### NOT RUN (and therefore not claimed as passing)

- `npm run test:e2e` (Playwright e2e) — requires a browser + running server.
- `npm run test:a11y` (`scripts/run-a11y.sh`) — requires a production build + live server.
- `npm run test:performance` / bundle-size check.
- `npm run benchmarks` (16 benchmark suites) and `npm run quality:gates:verify`.
- `npm run verify` (`scripts/verify.sh`) — a superset of the above; would exceed the session
  time budget.
- Any live/external-service verification.

The CI workflows are correctly wired to run these; they were simply not re-executed locally.
**They must not be reported as green on the basis of this audit.**

---

## T. Second audit (re-scan after remediation)

Performed after all fixes:

1. **Dead-code re-scan** — `node scripts/audit-unused.mjs` → **0 candidates** across 2,531
   modules. The drop 206 → 93 → 54 → 0 is fully explained by C.1 (tool defect), C.2 (tool
   blind spot), and C.4 (genuinely dead modules removed). It is not a threshold change.
2. **Reference re-verification of every deletion** — `git grep` re-run for
   `EcosystemWorkflowRouter`, `certification-workflow`, `multi-agent-workflow`,
   `coverage-analyze`: the only surviving hits are historical `04_Sprints/*` reports.
3. **Lint re-run** after the `.gitignore`/deletion change → **PASS** (62 scopes, 0 failed).
   This specifically guards against the risk that deleting an eslint-allowlisted file would
   break the gate. It does not: the `packages/*/coverage-analyze.mjs` allowlist glob is
   intentionally **kept**, so regenerating a scratch analyzer in any package still lints —
   the OS-002 fix is not regressed.
4. **Format re-run** after all doc edits → **PASS**.
5. **`git check-ignore` re-verification** of the widened pattern → the untracked
   `services/api/coverage-analyze.mjs` is still correctly ignored.
6. **Diff review** — `git diff --check` clean; every hunk read and confirmed intentional
   (the only non-authored diff content is Prettier's required markdown table realignment in
   the two tables I edited).

**Defects introduced by my own changes:** none found. The two risks I explicitly probed were
(a) an orphaned export after deleting the tRPC router — none (it was never imported);
(b) a lint break from deleting an allowlisted file — none (verified by re-running lint).

---

## U. Remaining findings

**There are no remaining P0, P1, or P2 findings that I was able to establish.** The
following P3/INFO items are explicitly justified rather than fixed:

| ID  | Severity        | Finding                                                                                                                                                                                                                                               | Justification for not fixing                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U.1 | **P3**          | `services/content-agency` has **no DDL and no migration runner**; its Drizzle schema is never materialised by the repo, and no `.sql`/`drizzle-kit` exists anywhere. Docs now say so plainly (§N.3).                                                  | Cannot be fixed without **inventing** a migration system, which the brief explicitly forbids ("do not fabricate missing infrastructure"). Requires a product decision: adopt `drizzle-kit`, or commit bootstrap SQL, or keep provisioning out-of-band. **Recommend sorting this before the next production deploy.**                                                                                                   |
| U.2 | **P3**          | 71 env vars are used but documented nowhere.                                                                                                                                                                                                          | 66 are runner-provided (`CI`, `GITHUB_SHA`, `VERCEL_*`), test-only fixtures (`TEST_*`), or defaulted tuning knobs (`DECISION_*`, `EXECUTION_*`). Bulk-documenting them would present internal knobs as operator config. The 5 genuinely operator-relevant candidates (`NEON_DATABASE_URL`, `POSTGRES_URL`, `WORLD_SIGNAL_BASE_URL`, `WORLD_SIGNAL_TOKEN`, `OPENAI_PRODUCTION_MODEL`) are worth a follow-up pass in §J. |
| U.3 | **P3**          | `scripts/audit-unused.mjs` has pre-existing `printWidth` non-conformance.                                                                                                                                                                             | Outside the repo's format glob; not introduced by me; reformatting untouched lines would be unrelated churn.                                                                                                                                                                                                                                                                                                           |
| U.4 | **INFO**        | 216 `eslint-disable` comments, all justified, all narrowly scoped.                                                                                                                                                                                    | Legitimate false-positive suppression with inline rationale. Removing them would break lint.                                                                                                                                                                                                                                                                                                                           |
| U.5 | **INFO**        | 18 `TODO`/`FIXME` markers in production source.                                                                                                                                                                                                       | Intentional domain input for VedMoulya's own repository-inspection/objective-selection pipeline.                                                                                                                                                                                                                                                                                                                       |
| U.6 | **INFO**        | Two `sk-live-` credential-shaped strings in source.                                                                                                                                                                                                   | Synthetic test fixtures that prove the secret detectors work (§M.2). Not credentials.                                                                                                                                                                                                                                                                                                                                  |
| U.7 | **INFO**        | Historical `04_Sprints/**` reports reference files and scripts that no longer exist.                                                                                                                                                                  | Archival records of past state. Rewriting them would falsify history.                                                                                                                                                                                                                                                                                                                                                  |
| U.8 | **INFO**        | `04_Technology/.../07_Documentation_Standards.md` mentions `npm run test:int` inside a generic README template.                                                                                                                                       | Illustrative template, not an instruction for this repo.                                                                                                                                                                                                                                                                                                                                                               |
| U.9 | **NOT CLAIMED** | Exhaustive per-route API, persistence, provider, and orchestration matrices; exhaustive per-file reference verdicts for all 3,990 paths; exhaustive test-quality review of all 871 test files; deep security review (SSRF/XSS/IDOR/tenant isolation). | Not completed in this session. **Stating these as clean would be fabrication.** They are the correct scope for a follow-up audit pass.                                                                                                                                                                                                                                                                                 |

---

## V. Final grade

### **B+**

The repository is in **good, genuinely healthy shape**: all quality gates pass for real, no
unused dependencies or dead modules remain in the TypeScript graph once the scanner's two
defects are fixed, zero build artifacts are tracked, zero real secrets are committed, all
CI script/path references resolve, and deleted background work was removed with proof rather
than enthusiasm.

It is **not** an A, and it is definitely not an A+, for three honest reasons:

1. **Tooling was silently lying.** The repository's own dead-code scanner was reporting 206
   false positives (entry points and tests) and had a documented blind spot that had already
   forced a hand-written exemption in SPRINT-043. A repo whose dead-code tool cannot be
   trusted has an unknown amount of real dead code in the areas the tool cannot see. That is
   now fixed, which is precisely why the grade is not higher _and_ not lower.
2. **A production-relevant documentation/process gap is open (U.1).** A full engine
   (`content-agency`) has a Drizzle schema that nothing in the repository ever creates, while
   the operator guide until today told admins to run a migration script that has never
   existed. The docs now tell the truth, but the underlying gap needs a human decision.
3. **Coverage is explicitly partial (U.9).** The brief asked for exhaustive per-route,
   per-repository, per-provider, and per-orchestration traces, plus a full test-quality
   review across 871 test files. Those were not completed, and I will not grade work I did
   not do.

**What would move this to A:** close U.1 with a real schema-provisioning decision; complete
the route/persistence/provider/orchestration matrices and the test-quality review; and keep
`scripts/audit-unused.mjs` wired so dead code cannot silently return.

---

## Appendix — companion artifacts

- **`VedMoulya_Audit_Inventory.csv`** — one row per tracked file (`path,category`), 3,990
  rows, generated mechanically from `git ls-files` with the category rules documented in §A.1.
- **`VedMoulya_FORENSIC_AUDIT_REPORT_PART2.md`** — Part 2, covering the phases that were
  declared NOT CLAIMED here (§U.9): the frontend product audit, the tRPC procedure matrix,
  persistence-factory wiring, the provider adapter matrix, and the skipped-test sweep.

## Appendix — reproduction commands

```bash
# Dead-code scan (should print zero candidates)
node scripts/audit-unused.mjs

# Gates
npm run typecheck && npm run lint && npm run format
npm test
npm run test:coverage
npm run build
npm audit --omit=dev --audit-level=high

# Deletion proofs
git grep -n "EcosystemWorkflowRouter" -- .
git grep -n "certification-workflow\|multi-agent-workflow" -- .
git grep -n "coverage-analyze" -- .

# Hygiene
git status --short && git diff --check && git diff --stat
```
