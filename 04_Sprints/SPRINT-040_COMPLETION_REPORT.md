# SPRINT-040 — Completion Report

**VedMoulya Founder Evidence Loop + Local Runtime Verification** · 2026-08-16 ·
🟢 **COMPLETE** · **NEW ENGINES CREATED: 0**

The first end-to-end operational path over the frozen estate was built (as
verification + minimal defect fixes) and proven live: **Docker runtime →
register/login → founder observation → provenance validation → evidence
persistence → scoring → customer discovery → next-best-action → verified-payment
progression** — with the founder remaining the ultimate authority throughout.

---

## 1. Executive verdict

The existing architecture was demonstrated end-to-end **without weakening any
safety, evidence, authorization or production boundary**. Three genuine local
runtime defects were found and fixed minimally (table bootstrap, DB URL config,
sign-up verification closure); the SPRINT-039 evidence loop itself needed **zero
changes**. Every honesty requirement held under live verification. This sprint
would not have succeeded without the fixes — the very first auth call failed
with `REGISTRATION_FAILED` on a missing table.

## 2. Files changed

**Code (defect fixes, minimal):**

- `services/identity/src/infrastructure/persistence/PostgresIdentityRepository.ts` — added `ensureTable()` (idempotent `CREATE TABLE IF NOT EXISTS users` + unique email/google_id indexes; estate convention).
- `services/api/src/infrastructure/ProductionRepositories.ts` — `createProductionIdentityRepository()` now wires `ensureTable(repo, 'Identity users')` like every other factory.
- `apps/web/src/lib/auth-app.ts` — `getAuthApp()` is async and awaits the schema bootstrap (deterministic cold start).
- `apps/web/src/app/api/v1/identity/auth/[...path]/route.ts` — `await getAuthApp()`.
- `services/identity/src/auth/AuthService.ts` — dev/test-only auto-verify on sign-up (production/staging unchanged).

**Config (gitignored, dev-only):**

- `apps/web/.env.local` — `IDENTITY_DATABASE_URL` → local Docker Postgres (dev credentials already public in compose; no API keys).

**Tests (only for defects found):**

- `services/identity/__tests__/PostgresIdentityRepository.test.ts` — ensureTable DDL.
- `services/identity/__tests__/AuthService.test.ts` — verify split (dev vs production).
- `apps/web/src/auth/__tests__/auth-app.test.ts` — async bootstrap smoke test.

## 3. Existing capabilities verified

Identity Service (sign-up/sign-in/session/sign-out), Founder Evidence Loop
(observations, prospects, evidence quality, bounded calibration, next-best-action,
comparison, drill-downs), Opportunity Discovery & Revenue Validation
(problems, revenue ladder, radar), Command Center read models, gateway
`world.*` procedures (auth + rate tier + central IDOR + zod), shared persistence
bundle (Postgres write-through), Docker estate.

## 4. Defects found

1. **D1** — `users` table never created (identity DB init opened a connection only; the ONE store violating the estate `ensureTable()` convention) → first-run `REGISTRATION_FAILED`.
2. **D2** — `IDENTITY_DATABASE_URL` unset locally → password auth failure against Docker Postgres.
3. **D3** — no email-verification delivery exists, while the domain blocks sign-in for unverified accounts → registered users could never sign in.
4. **D4** — dev-env artifact: Next.js dev cache corruption (`vendor-chunks/@vercel.js`) → raw tRPC requests 500.

## 5. Fixes applied

- D1: `PostgresIdentityRepository.ensureTable()` + factory wiring + awaited in the web auth-app (idempotent, every startup, matches DATABASE_V1 convention).
- D2: `IDENTITY_DATABASE_URL` in `apps/web/.env.local` (gitignored).
- D3: dev/test-only `user.verifyEmail()` at registration in `AuthService.signUp` (mirrors the existing Google path); production/staging unchanged.
- D4: cleared `apps/web/.next` and restarted (no code change).

## 6. Docker runtime result

`vedmoulya-postgres` + `vedmoulya-redis` healthy; `vedmoulya_default` network up;
`http://localhost:3000/` and `/login` → 200. **Honest deviation:** `vedmoulya-web`
is not a container (not in compose) — the web app runs via `next dev` against
the Docker Postgres/Redis; no container was manufactured.

## 7. Authentication result

sign-up **201** · duplicate **409** · validation **400** · sign-in **200** ·
wrong password **401** · session **200** · sign-out **200**. No direct DB
inserts; no credentials in source; no secrets logged; rate limiting active.

## 8. Evidence-loop result

Observation entry requires provenance (missing → refused); evidence sanitized;
default evidence state honest (`HYPOTHESIS`-style default); a claimed `VERIFIED`
was **downgraded to `OBSERVED`**; evidence quality 8 dimensions with honest
`UNKNOWN`; calibration bounded (refuses to fabricate UNKNOWN factors, delta
never exceeds the cap, evidence trail kept); scores explainable with factors
returned; conflicting evidence visible.

## 9. Customer-discovery result

Prospect registered at `CONTACTED` (provenance-required); invalid jump to
`VERIFIED_PAYMENT` refused with the honest reason; bounded chain advanced
step-by-step. Discovery ≠ validation, interest ≠ WTP, WTP ≠ payment — all held.

## 10. Revenue-validation result

1 verified payment → `REVENUE_VERIFIED`; 2 → `REPEAT_REVENUE`; 3 →
`REPEATABLE_BUSINESS` — **only via `verifiedPaymentText` records** (LOCAL TEST,
clearly marked, never real revenue). Interest/WTP/payment-request did not
advance revenue state.

## 11. Command Center result

Radar + drill-downs + command center read models served; empty datasets display
honestly (`observationsList` → `[]` before entry); evidence distinguishable from
hypotheses; prospects distinguishable from verified customers; revenue states
explicit; next-best-action explainable; voice presentation read-only
(VOICE ≠ AUTHORIZATION preserved); no UI control grants authorization by
recommendation.

## 12. Test results

world-model **298** · identity **283** · api **1010** · web **220** — all passed.
Typecheck **0** · scoped lint **0/0** · `next build` **PASS** (56 pages).

## 13. Benchmark results

`npm run benchmarks` — **all harnesses PASS (exit 0)** (incl. evidence 20/20,
discovery 10/10, quality gates 16/16). None touched or weakened.

## 14. Security verification

- Provenance mandatory; VERIFIED not self-claimable; revenue only via verified
  payments; IDOR + auth + rate tier + zod on every exercised `world.*` call.
- Production fail-fast unchanged (no new keys; localhost defaults still refused
  outside development; `AUTH_JWT_SECRET` still required).
- No credentials/passwords/tokens printed in captured logs.
- D3 fix is dev/test-gated — production sign-in behavior identical to before.

## 15. Production-readiness impact

Positive and bounded: the `users`-table bootstrap removes a genuine first-run
failure in production (D1 was not local-only), and the identity store now
matches the documented "every Postgres repository creates its table idempotently"
contract. D3's production behavior is unchanged (a real verification flow
remains a documented future requirement). No production safeguards weakened.

## 16. Honest limitations

- `vedmoulya-web` is not containerized in compose (web runs via `next dev`).
- Email verification in production is still absent (pre-existing gap, unchanged).
- Live world signals, real provider execution and real revenue remain
  **OPERATOR-REQUIRED**; the sprint used only clearly-marked LOCAL TEST data and
  never fabricated customers, market size, revenue, payments, interviews, WTP,
  success metrics, external evidence or business outcomes.
- The drizzle schema's unique indexes on `status_state`/`created_at` were
  deliberately not mirrored (they would break multi-user operation) — a
  schema-level observation, documented, not changed.

## 17. NEW-ENGINE STATEMENT

**NEW ENGINES CREATED: 0.** No OpportunityEngine, RevenueEngine, MarketEngine,
StartupEngine, BusinessEngine, SuperBrain, AgentFactory or equivalent was
created. The sprint composed the existing Brain, World Model, Intelligence
Fabric, CostLedger, Founder Evidence Loop, Identity, Persistence, Approval
Authority and Command Center — the system observes, reasons, recommends and
records; **the founder decides**.

---

## ADDENDUM — LOGIN BUG RECTIFICATION (post-sprint verification)

**Symptom:** with the local runtime up, clicking "Sign In" on the browser never
left `/login`.

**Root cause (runtime, not auth code):** a `next build` run (Phase 10) had
overwritten the shared `apps/web/.next` directory while the `next dev` server
was still serving from it. The dev server's chunk files (`main-app.js`,
`app-pages-internals.js`) then returned 404 with a `text/plain` MIME type, so
React never hydrated: the login form was static SSR HTML, zero auth requests
were ever issued, and the click triggered a **native HTML GET form submission**
(`/login?email=…&password=…` — credentials in the URL). The auth stack
(`auth-api.ts` → `session-manager.ts` → `auth-store.ts` → `/login` page) was
verified correct end-to-end once the runtime was restored.

**Fix 1 (operational):** stop `next dev`, remove `apps/web/.next`, restart —
the standard remedy for a `next build`/`next dev` collision on the shared build
directory. All browser acceptance criteria then pass (19/19, see below).

**Fix 2 (hardening, real defect discovered):** the login `<form>` had no
`action`/`method`, so ANY pre-hydration or no-JS native submission leaked
credentials into the URL/query string/history. The form now declares
`action="/login" method="post"` so credentials travel only in the request
body; once React hydrates, `handleEmailSubmit`'s `preventDefault()` keeps the
SPA flow unchanged. No auth logic, contract, Google OAuth, refresh, offline or
secure-store behavior was touched.

**Browser verification (real Chrome via Playwright, headless):**
19/19 PASS — invalid password rejected (401 + visible error, no token
persisted) · unknown email rejected · sign-in leaves `/login` for the intended
`?next=` screen · refresh keeps the session (verified via `/session` 200) ·
`/login` while authenticated redirects away · logout clears the persisted
session and lands on `/login` · protected routes redirect to `/login?next=…`
after logout. No tokens or secrets were logged.

**Tests:** new regression suite
`apps/web/src/app/login/__tests__/page.test.tsx` (3 tests) covers the POST-form
contract and the redirect/error contract. Full web suite **223 passed**, identity
**283 passed**, typecheck **0**, lint **0 errors** on touched files,
`next build` **PASS**.

**Regression risk:** the operational collision (build while dev is running on
the same `.next`) can recur — it is a Next.js dev-workflow hazard, not an app
defect; the restart remedy is documented here. No code defect remains in the
auth lifecycle.
