# VM-QUALITY-SPRINT-004 — Final Report

**Baseline:** `7.1 / 10` (sprint 003, `docs/audits/2026-10-11-quality-sprint-003/FINAL-REPORT.md`)
**Final score (baseline weights, unchanged):** **7.2 / 10** (+0.1)
**Started at HEAD `04265adf`; ended at HEAD `93e16270` + this report's commit.**

## 1. What actually changed this sprint

| Step                        | Outcome                                         | Evidence                     |
| --------------------------- | ----------------------------------------------- | ---------------------------- |
| 1 — S-1 portal security     | **Fixed + tested**                              | `9aa302d0`                   |
| 2 — D-10 privacy lifecycle  | **Inventory + gateway privacy test**            | `93e16270`                   |
| 3 — D-08 browser E2E / a11y | **a11y gate GREEN; journeys blocked (credits)** | `.sprint4-a11y-official.log` |
| 5 — D-07 advisories         | **Measured: 0 production advisories**           | `npm audit --omit=dev`       |
| 6 — Live AI / perf          | **Blocked** (provider credits)                  | `.sprint4-journey.log`       |
| 4 — D-09 recovery drills    | **Not attempted** (no staging, not authorized)  | —                            |
| 7 — Verification            | Done; see §4                                    | this report                  |

### Step 1 — portal security (committed `9aa302d0`)

All 14 token-scoped portal procedures classified; confirmed defect fixed: the
portal had **no rate limiting** (it is outside the JWT/`authProcedure` tiers).
Narrowest behavior-preserving change: a dedicated `portalProcedure` =
`baseProcedure` + IP-keyed limiter, and the 10 portal procedures now use it. Six
negative-case tests added (unauthorized / cross-client / revoked access / rate
limit). Prior sprint status: "S-1 portal unrated". Now: rated, fixed, regression-tested.

### Step 2 — D-10 privacy & data lifecycle (committed `93e16270`)

Twelve data categories inventoried with owner, storage, retention declaration,
**enforcement status** and verification (`STEP2-PRIVACY-DATA-LIFECYCLE.md`).
Key verified findings:

- The live gateway applies authentication **and** an IDOR guard
  (`assertUserIdMatchesSession`) to every authenticated procedure tier.
- The exposed user-delete path is a **soft archive**; a hard `deleteUser` exists but
  is route-unreachable (latent dead code, no cascade).
- `packages/information` retention is **declared but never enforced** (no purge
  consumer) — recorded as an open policy gap rather than "fixed" with an invented
  period; the same for the absence of an automatic memory-expiration sweep.

### Step 3 — D-08 browser E2E & accessibility

- Environment repaired: `e2e-user` seeded idempotently (removed the whole
  `NOT_FOUND` failure class from sprint 003).
- Diagnosed and fixed a **corrupted production `.next` bundle**
  (`vendor-chunks/@capacitor.js` missing → `/health/live` 500 → gate timeout) by a
  clean rebuild — `REBUILD_EXIT=0`, `BUILD_ID` present.
- **`npm run test:a11y` → 6 passed / 0 failed, exit 0** — the first green
  accessibility release gate for this repository.
- Critical journey run **failed honestly** on a cloud provider with no credits
  (`AI_APICallError: You have no credits remaining`), _not_ reported as a pass.

### Step 5 — D-07 advisories

`npm audit --omit=dev` → **0 advisories** in production dependencies. All 12
high-severity advisories are dev-only: Storybook webpack chain (no upstream fix)
and commitizen/lint-staged chains (semver-major-only fixes). Dispositions recorded
in `STEP5-DEPENDENCY-ADVISORIES.md`; no blanket overrides or forced majors.

## 2. Score comparison (baseline weights, unchanged)

| Dimension                  |   Weight | Base (003) | Now |             Weighted |
| -------------------------- | -------: | ---------: | --: | -------------------: |
| Architecture               |      15% |        6.8 | 6.8 |                10.20 |
| End-to-end functionality   |      15% |        7.8 | 7.8 |                11.70 |
| AI intelligence            |      12% |        7.4 | 7.4 |                 8.88 |
| Runtime / recovery         |      12% |        6.9 | 6.9 |                 8.28 |
| Tests                      |      10% |        8.0 | 8.1 |                 8.10 |
| Security                   |      10% |        7.1 | 7.5 |                 7.50 |
| Persistence                |       8% |        6.3 | 6.3 |                 5.04 |
| UX / accessibility         |       8% |        6.5 | 7.0 |                 5.60 |
| Performance                |       5% |        5.5 | 5.5 |                 2.75 |
| Documentation / operations |       5% |        6.8 | 7.2 |                 3.60 |
| **Total**                  | **100%** |    **6.7** |     | **71.65 → 7.2 / 10** |

**Why each increase (and nothing more):**

- **Security +0.4** — a confirmed live defect (unrated, unlimited portal
  procedures) was fixed with IP-keyed limiting and 6 regression tests; identity
  ownership is now verified through the real pipeline. No other security control
  changed, so this is not raised further.
- **Tests +0.1** — new pipeline-level IDOR test plus the Step 1 negative cases.
- **UX / accessibility +0.5** — the accessibility release gate moved from
  **blocked/failing** to **executed green (6/6)**. Content-route structure checks
  still time out in dev mode, so this is not raised to 7.5+.
- **Documentation / operations +0.4** — portal matrix, privacy inventory, E2E
  evidence with root causes, advisory dispositions, rebuild runbook.
- **Unchanged** — Architecture (no split performed), E2E functionality (journeys
  unverified), AI (no live cloud success), Runtime/recovery (no staging), Persistence,
  Performance (no measurement). Documentation alone does **not** raise a score.

## 3. Deliverables

1. **Portal security matrix** — `STEP1-PORTAL-SECURITY.md` (14/14 procedures
   classified; every confirmed defect has a regression test).
2. **Privacy / data-lifecycle inventory** — `STEP2-PRIVACY-DATA-LIFECYCLE.md`
   (12 categories, owners, enforcement status, 6 open policy questions).
3. **Browser E2E & accessibility evidence** — `STEP3-E2E-A11Y-EVIDENCE.md`
   (green a11y gate; journeys blocked; exact non-secret causes).
4. **Staging recovery evidence** — **not produced**; no staging environment
   available and no authorization to create one. Prerequisite documented.
5. **Dependency-advisory dispositions** — `STEP5-DEPENDENCY-ADVISORIES.md`.
6. **Live-provider & performance results** — **blocked**; cloud credits absent
   (local Ollama reachable but not yet exercised end-to-end). No performance
   numbers were fabricated.
7. **Module scores with confidence** — §5 below.
8. **Before/after comparison** — §2, unchanged weights.
9. **Open defects with severity/owner/next action** — §6.
10. **Commits, tests, worktree** — §4 and §7.

## 4. Verification actually run

| Check                                                                     | Result                                                |
| ------------------------------------------------------------------------- | ----------------------------------------------------- |
| `npm run typecheck`                                                       | ✅ exit 0                                             |
| `npm run deps:cycles`                                                     | ✅ 57 workspaces, no cycles                           |
| `npx vitest run services/api/.../router-registry.test.ts -t "IDOR guard"` | ✅ 1 passed                                           |
| Portal security suite (Step 1, at `9aa302d0`)                             | ✅ 61 passed (+6 new)                                 |
| Neighboring api security suites (Step 1)                                  | ✅ 161 passed                                         |
| `npm run build -w apps/web` (clean rebuild)                               | ✅ `REBUILD_EXIT=0`, `BUILD_ID` present               |
| `npm run test:a11y` (official gate)                                       | ✅ **6 passed / 0 failed, exit 0**                    |
| `e2e/brain.spec.ts` (production build)                                    | ❌ failed — provider out of credits                   |
| `npx eslint` on changed file                                              | ⚠️ test files are eslint-ignored by config (0 errors) |
| Full repo `npm run lint` / `npm run test`                                 | not run this sprint (time/CPU); reported as not run   |

## 5. Module scores (updated; confidence + wiring)

| Module                                               |   Score | Conf | Change | Next action                                                                      |
| ---------------------------------------------------- | ------: | ---- | ------ | -------------------------------------------------------------------------------- |
| `@vedmoulya/api` (gateway)                           |     7.5 | H    | ↑      | split `RouterRegistry.ts` (7,041 lines — D-02)                                   |
| Client portal (content-agency + portal tier)         |     7.5 | H    | ↑      | keep rate-limited; add per-token buckets if product requires                     |
| `services/identity` + `@vedmoulya/services` identity |     7.5 | H    | ↑      | decide hard-erase vs archive policy; remove/wire latent public routers           |
| `packages/information`                               |     5.5 | H    | ↔      | decide whether retention is enforced; otherwise state "declarative only" in docs |
| `@vedmoulya/memory-intelligence`                     |     7.0 | M    | ↔      | add a scheduled expiration sweep or document manual invocation                   |
| Providers/adapters                                   |     7.5 | H    | ↔      | cloud credits + calibration (unchanged)                                          |
| `mission-runtime` / `mission-controller`             | 7.5/7.0 | H    | ↔      | staging restart drill (D-09)                                                     |
| Web app (`apps/web`)                                 |     7.0 | H    | ↑      | content-route structure checks under production build                            |
| Whole platform                                       | **7.2** | M    | ↑ 0.1  | clear the blocked items in §6                                                    |

## 6. Open defects (severity, owner, next action)

| ID                  | Sev | Status        | Defect                                                                                                                                  | Owner         | Next action                                                                 |
| ------------------- | --- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------- |
| D-08a               | P2  | Open          | Critical browser journeys unverified (cloud provider out of credits)                                                                    | platform      | run journeys against local Ollama, or fund a cloud key                      |
| D-08b               | P2  | Open          | Knowledge-graph DDL/query failure in the configured DB (`knowledge_graphs` init, `knowledge_nodes ILIKE`)                               | persistence   | investigate DB permissions/schema provisioning                              |
| D-10a               | P3  | Open          | `packages/information` retention declared but unenforced                                                                                | info/services | product decision + purge job if required                                    |
| D-10b               | P3  | Open          | Hard `deleteUser` (no cascade) is latent dead code; public identity routers unmounted but unauthenticated                               | identity      | delete, or guard-then-mount under review                                    |
| D-10c               | P3  | Open          | Memory expiration has no automatic trigger                                                                                              | memory        | scheduled sweep or documented manual invocation                             |
| D-09                | P2  | Blocked       | No staging backup/restore/rollback/restart drill                                                                                        | ops           | provision staging (out of scope: not authorized)                            |
| D-02                | P2  | Open          | Oversized composition files (`RouterRegistry.ts` 7,041; `api-client.ts` 4,901)                                                          | api/web       | behavior-preserving splits                                                  |
| D-07                | P3  | Dispositioned | 12 dev-only high advisories, 0 production                                                                                               | eng           | track; upgrade when upstream patches                                        |
| D-04/D-01/D-03/D-11 | P3  | Open          | workspace/inventory hygiene                                                                                                             | eng           | dedicated housekeeping change                                               |
| —                   | P3  | Open          | Local web app does not read the root `.env.local` (Next loads app-dir env only) → loopback fallbacks; production runs need injected env | web           | load root env in `apps/web/scripts/run-next.mjs` with no-override semantics |

## 7. Commits, push, worktree

| Commit          | Message                                                               |
| --------------- | --------------------------------------------------------------------- |
| `9aa302d0`      | fix(api): rate-limit the token-scoped client portal per client ip     |
| `93e16270`      | test(api): verify cross-user identity access is denied at the gateway |
| _(this report)_ | docs(docs): record sprint 004 privacy, e2e and advisory evidence      |

- **Push status:** not pushed (no push authorized this sprint).
- **Worktree:** only intended files staged per commit; `_sprint3-live/` (untracked
  user evidence) preserved untouched; evidence logs `.sprint4-*` remain untracked
  and gitignored.
- **Secrets:** no secrets, env files, tokens or session credentials were committed.
  A credential string briefly surfaced in a local diagnostic shell output and was
  deliberately excluded from every artifact and commit.

## 8. Constraints honored

Mission remains the only autonomous lifecycle; `brain.*` unchanged;
`@vedmoulya/orchestration-fabric` still deferred and not activated; canonical
provider registry, governed execution, durable mission behavior and honest
provider failures preserved; human approval for external submission/payment/
irreversible actions untouched; no destructive git commands; no roadmap stage marked
complete; no blocked check reported as passing; every fix is a small, test-backed
commit.

## 9. Where the 9.0 target actually stands

Getting from 7.2 to 9.0 is **not** blocked by documentation — it is blocked by
four things this sprint could not move:

1. **Live cloud mission with valid credentials** (D-08a) — the highest-leverage gap.
2. **Staging recovery drills** (D-09) — backup/restore/rollback/restart evidence.
3. **Content-route structure verification under a production build** (D-08) plus the
   knowledge-graph DB defect (D-08b).
4. **Architecture scale-down** of the 7,041-line `RouterRegistry.ts` (D-02).

Until those land, the honest ceiling for this repository remains in the low-to-mid
7s, regardless of how much evidence is written around them.
