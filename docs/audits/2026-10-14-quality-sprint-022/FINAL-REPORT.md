# VedMoulya — Sprint 022: Playwright Mission Journey Acceptance

**Date (UTC):** 2026-10-14
**Branch:** `main` · **HEAD:** `a124274b0d1fa91f361e0a5775e144658405913a` (unchanged)
**Mode:** real browser acceptance against a locally running application + smallest targeted fix only.
**No commit, push, deployment, paid operation, or production-data change occurred.**

---

## Executive verdict: **PASS**

The goal → Mission journey was exercised **in a real browser against a locally running
application** (Next.js dev server + Docker Postgres + Redis), with no mocked API
responses and no fixtures standing in for the backend. All seven Sprint 022 scenarios
were verified, one real honesty defect was found and fixed, and all checks are green.

**One limitation is stated explicitly and is NOT counted as proven:** a **live
AI-provider execution did not run** (no provider credential); the mission runtime
executed the product path deterministically, and the UI's provider fact reported
`Not yet run` honestly. Nothing below claims a real AI-provider journey.

---

## 0. Preservation gate

- Branch/HEAD unchanged: `main` → `a124274b…` (identical to the pre-sprint baseline).
- **Stashes preserved: 5** (all pre-existing; none created/popped/dropped).
- `git status --porcelain` baseline = 93 paths; final = 94 (the +1 is **this report
  directory only**). All pre-existing modified/untracked files and audit artifacts
  remain untouched.
- No `git reset`, `git clean`, revert, stage, commit, push, deploy, credential change,
  or production-data change.
- Docker `vedmoulya-postgres` (healthy) and `vedmoulya-redis` (healthy) were already
  running and were reused read/write only through the application's own dev path.

---

## 1. Browser infrastructure reused (no parallel framework)

| Layer            | Reused artifact                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| Runner/config    | `apps/web/playwright.config.ts` (project `chromium`, `/health/ready` readiness gate, `reuseExistingServer`) |
| Auth fixture     | `apps/web/e2e/helpers/auth.ts` → `injectSession` (mints the real dev JWT)                                   |
| Shared constants | `apps/web/e2e/helpers/factory-journey.ts` → `BASE_URL`                                                      |
| Spec (rewritten) | `apps/web/e2e/missions-ux04-e2e-acceptance.spec.ts`                                                         |

**Exact commands run**

```bash
# 1. Start the real app (reused server for Playwright via reuseExistingServer)
npm run dev -p 3000            # from apps/web; /health/ready → 200 once gateway+DB ready

# 2. Run the journey acceptance spec in a real Chromium browser
export AUTH_JWT_SECRET=$(grep '^AUTH_JWT_SECRET=' "$(git rev-parse --show-toplevel)/.env.local" | cut -d= -f2- | tr -d '\r')
cd apps/web && npx playwright test e2e/missions-ux04-e2e-acceptance.spec.ts --project=chromium --reporter=list
# → 4 passed (2.3m), exit 0
```

`AUTH_JWT_SECRET` is required by the auth fixture (no default) and was **exported only
into the test process**; no secret value is recorded here.

---

## 2. Acceptance matrix

**Rule:** a mocked/fixture browser test is never recorded as real end-to-end
execution, and a source/unit inspection is never recorded as browser acceptance.

| #   | Scenario                                                           | Test method                        | Result              | Evidence                                                                                                                                                            | Limitation                                                                                       |
| --- | ------------------------------------------------------------------ | ---------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | Goal entry — enter a meaningful goal                               | **Real browser** against local app | PASS                | `mission-title-input` / `mission-objective-input` accept and retain the goal; no errors                                                                             | UI form path; no live AI call                                                                    |
| 2   | Explicit consent — entering a goal does **not** auto-create/launch | **Real browser**                   | PASS                | Before opt-in: URL has no `?mission=`, `mission-detail-tabs` count = 0, no "Mission created" text                                                                   | —                                                                                                |
| 3   | Opt-in launch — user explicitly starts the Mission                 | **Real browser**                   | PASS                | Click `run-mission-btn` → `mission-detail-tabs` visible, URL gains `?mission=<real id>`, state chip = a real backend state                                          | Mission created via `mission.createAndRun` (MissionService), the sole lifecycle owner            |
| 4   | Progress — real Mission status via the existing polling path       | **Real browser**                   | PASS                | `mission-state` shows a real state (`RUNNING` observed); `useMissionStatus` poll rendered live; objective timeline + fact grid visible; **no fabricated %** present | Poll interval is 5s while RUNNING                                                                |
| 5   | Results & evidence — verified vs unverified, evidence exposed      | **Real browser**                   | PASS                | Result tab: verification summary `n/n objectives verified`; each objective labelled exactly `Verified` / `Not yet verified`                                         | Reached via a terminal (cancelled) mission; evidence list renders only when real evidence exists |
| 6   | Failure & recovery — honest states, governed continuation          | **Real browser**                   | PASS (after fix D2) | Cancel is a **confirmed** governed action → `CANCELLED`; terminal continuation panel (`overview-continue-panel`) routes to Ask VedMoulya, not a second executor     | Also covers fixed label honesty                                                                  |
| 7   | Safety — no consequential action without authorization             | **Real browser**                   | PASS                | "Ready to submit" surface gated on a real VERIFIED objective; absent otherwise; no deploy/submit/publish control on the mission surface                             | External submission intentionally not performed                                                  |

**Evidence classification:** scenarios **1–7 were all verified by a real browser
journey against a locally running application**. No scenario was recorded as
API/unit-only, and none as mocked-browser. The only unverified aspect is the
**live AI-provider execution** (see §6).

---

## 3. Confirmed defects and minimal fixes

### D1 — Acceptance spec asserted UI that does not exist (test defect)

The provisional, untracked `missions-ux04-e2e-acceptance.spec.ts` failed on
`getByRole('heading', { name: 'Create new goal' })` and targeted a `/goals` opt-in
dialog that the product does not render (`/goals` is understanding-only). It was
rewritten into the real journey acceptance spec above (reusing the existing helpers
and config) — smallest change that makes the test assert real behaviour.

### D2 — A cancelled Mission was reported as "Mission Failed" (product honesty defect)

**Reproduced in the browser** (Result tab of a cancelled mission):

```
Result
Mission Failed
VedMoulya could not complete this mission.
```

A user-cancelled mission is not a failure. This violates scenario 6 ("blocked, failed,
or interrupted states are represented honestly").

**Minimal fix** — `apps/web/src/app/missions/_components/MissionResult.tsx`:
distinguish `CANCELLED` from `FAILED`/`COMPLETED` in the heading, subtitle, icon and
tone (`Mission Cancelled` / "You cancelled this mission before it finished." /
neutral slate). No lifecycle, engine, router, or scheduler was added; Mission remains
the sole autonomous lifecycle owner.

**Regression tests added**

- `apps/web/src/app/missions/__tests__/missions-ux04.test.tsx` — new case: a
  `CANCELLED` mission renders `Mission Cancelled`, never `Mission Failed`.
- `apps/web/e2e/missions-ux04-e2e-acceptance.spec.ts` — browser assertion that a
  cancelled mission shows `Mission Cancelled` and never `Mission Failed`.

No assertions were weakened; nothing was suppressed to make checks pass.

---

## 4. All checks and exact results

| Check                      | Command                                                                           | Exit | Result                                                  |
| -------------------------- | --------------------------------------------------------------------------------- | ---- | ------------------------------------------------------- |
| Browser journey acceptance | `npx playwright test e2e/missions-ux04-e2e-acceptance.spec.ts --project=chromium` | 0    | **4 passed**                                            |
| Missions regression unit   | `npx vitest run apps/web/src/app/missions/__tests__/missions-ux04.test.tsx`       | 0    | **36/36 passed** (was 35; +1 new)                       |
| Affected web suites        | `npx vitest run apps/web/src/app/missions apps/web/src/app/autonomous-builder`    | 0    | **59/59 passed** (3 files)                              |
| Typecheck                  | `npm run typecheck` (`tsc -b && tsc --noEmit -p services/api`)                    | 0    | green                                                   |
| Dependency cycles          | `npm run deps:cycles`                                                             | 0    | `no internal dependency cycles (57 workspaces scanned)` |

**Pre-existing / environment caveats**

- The **first** run of the provisional spec hung and failed only because
  `AUTH_JWT_SECRET` had not been exported into the test process. With the secret
  exported (as documented for this repo), the journey runs correctly. This is an
  environment/runbook requirement, not a product failure.
- No API source changed this sprint, so no API suite regression was introduced;
  the journey exercised the real `mission.createAndRun` / `mission.status` tRPC path.

---

## 5. Environment used

- Node `v24.18.0`; Playwright `1.62.0`.
- App: `npm run dev -p 3000` (`apps/web`), `NODE_ENV=development`, `.env.local` loaded.
- `/health/ready` → `200` (gateway initialized + Postgres reachable).
- Postgres (`pgvector/pgvector:pg16`) + Redis running in Docker; reused, not modified.
- Deterministic prerequisites observed: mission creation returned a real id; the
  status query returned a real `MissionStatusView`; cancellation returned `CANCELLED`.

---

## 6. Remaining blockers / what remains unverified

1. **No live AI-provider journey.** `AI_ENABLE_MOCK=false`, `AI_DEFAULT_PROVIDER=google`
   with no key. The mission runtime executed the **product path** deterministically and
   the provider fact rendered `Not yet run`; no real model generation was confirmed, so
   none is claimed.
2. **AICompanion answer/opt-in path not exercised end-to-end.** It depends on the live
   AI runtime (scenario above); the builder form (the BLD-024 one-button mission path)
   was used to verify entry/consent/opt-in instead.
3. **External submission / deployment deliberately not performed** (scenario 7 is a
   safety guarantee, verified by the absence of an unauthorized control).
4. Pre-existing ESLint/format noise in the working tree was left untouched (out of scope).

---

## 7. Closing

Sprint 022 is complete: the goal → Mission journey — entry, explicit consent, opt-in
launch, honest live progress, verified-vs-unverified results, honest terminal/recovery
states, and the safety gate — was proven **in a real browser against a locally running
application**, one real honesty defect was fixed with a regression test, and the
repository was preserved (HEAD unchanged, 5 stashes intact, report dir the only new
path). The report distinguishes exactly what was proven from what remains unverified
(the live AI-provider execution).
