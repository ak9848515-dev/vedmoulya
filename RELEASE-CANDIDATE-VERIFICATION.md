# VedMoulya — Release Candidate Verification Summary

**Date (UTC):** 2026-10-15
**Branch:** `main` · **Base HEAD:** `c5ff4400` (pushed to `origin/main`)
**Scope:** Verification of the accumulated sprint change set + the E2E fixes below
**Release status:** **NOT production-releasable** — see _Operator-gated blockers_.

This document states exactly what was verified, with which command, and what was
**not** verified or is blocked by the environment.

---

## 1. Quality gates

Each gate below was run locally on this tree. The only changes after the gates
were taken at `c5ff4400` are this suite's E2E spec and this document, neither of
which is an input to the unit-test suite or the production build: lint, format,
typecheck and the E2E suite were re-run after the spec change, and both audit
commands were re-run after the dependency check described in §4.

| Gate               | Command                                   | Result                                                               |
| ------------------ | ----------------------------------------- | -------------------------------------------------------------------- |
| Typecheck          | `npm run typecheck`                       | ✅ exit 0                                                            |
| Lint               | `npm run lint`                            | ✅ 58/58 scopes, 0 failed                                            |
| Format             | `npm run format`                          | ✅ clean                                                             |
| Unit/integration   | `npm test`                                | ✅ 1,000 files · 13,195 tests                                        |
| Dependency cycles  | `npm run deps:cycles`                     | ✅ no cycles                                                         |
| Production build   | `npm run build`                           | ✅ exit 0 (web build re-verified: `npm run build -w @vedmoulya/web`) |
| Audit — production | `npm audit --omit=dev --audit-level=high` | ✅ exit 0 — **0 vulnerabilities**                                    |
| Audit — full tree  | `npm audit --audit-level=critical`        | ✅ exit 0 — 17 dev-only advisories, **0 critical**                   |

The two audit commands are the gates enforced in CI (`.github/workflows/ci.yml`
167–170) and in `release.yml` (75–78).

## 2. End-to-end (Playwright, real app, nothing mocked in the browser)

Specs: `apps/web/e2e/ai-companion-mission-optin.spec.ts` (5 tests),
`apps/web/e2e/missions-ux04-e2e-acceptance.spec.ts` (4 tests).

```bash
cd apps/web && npx playwright test \
  e2e/ai-companion-mission-optin.spec.ts \
  e2e/missions-ux04-e2e-acceptance.spec.ts \
  --project=chromium --workers=1 --repeat-each=2
```

**Result: 9 tests × 2 repeats = 18/18 passed (1.6 min on the committed revision,
1.2 min for the same set just before), exit 0.**

### Environment the run requires (all three are load-bearing)

1. **Seeded local databases.** In this checkout `.env.local` points
   `DATABASE_URL` and `IDENTITY_DATABASE_URL` at a cloud Neon endpoint that
   accepts TCP but times out on queries. Identity reads then fail
   (`select ... from "users" where id = 'e2e-user'`), the Ask panel's user-scoped
   AI-readiness never settles, and the journeys stall. The Docker development
   Postgres (`docker compose`, database `vedmoulya`) is the database these specs
   expect — it already contains `e2e-user`. Runs used shell-level overrides
   (shell variables outrank `.env.local`, per `apps/web/src/lib/server-env.ts`):

   ```bash
   export DATABASE_URL="postgresql://<user>:<pw>@localhost:5432/vedmoulya"
   export IDENTITY_DATABASE_URL="$DATABASE_URL"
   export DATABASE_URL_UNPOOLED="$DATABASE_URL"
   ```

2. **A deterministically answering provider.** `AI_DEFAULT_PROVIDER=google`,
   `AI_ENABLE_MOCK=false`, cloud provider calls fail/timeout
   (`AI_PROVIDER_TIMEOUT_MS=60000`, with retries and fallback across providers)
   and Ollama is not running on `localhost:11434`. In that configuration the panel
   legitimately stays busy, the Send control stays disabled, and the AI legs
   cannot complete — every attempt then exhausts the spec's own timeout budget.
   The run therefore uses the repository's E2E convention (also used by CI,
   `.github/workflows/ci.yml` line 339):

   ```bash
   export AI_ENABLE_MOCK=true   # deterministic mock provider; never silent in production
   ```

3. **A warm dev server.** `AUTH_JWT_SECRET` must be exported to the test process
   (no default — `apps/web/e2e/helpers/auth.ts` fails fast). Pre-warm
   `/health/ready`, `/login` and `/autonomous-builder` before running the specs;
   a cold `next dev` compiles the gateway on first hit and that time is charged to
   the per-test budgets.

### Two defects found in the E2E spec and fixed (this change)

Both were in `apps/web/e2e/ai-companion-mission-optin.spec.ts`. Neither weakened
an assertion; both restored the assertions' intended meaning.

1. **The readiness-chip locator could never match a resolved state.** The panel
   renders the status dot, then `{' '}`, then the label, so the chip's text
   content is `" AI Ready"` (leading space). The spec matched it with the anchored
   regex `/^(AI Ready|AI not available|Checking AI…)$/`, which is compared against
   the raw text and therefore only ever matched `Checking AI…` (the one variant
   without a leading space). The two resolved branches of the honesty test were
   silently unreachable. Measured directly:
   `PARA_TEXTCONTENT=" AI Ready"`, anchored count `0`, unanchored count `1`.
   Fixed by locating with a whitespace-tolerant pattern (`AI_STATUS_CHIP`) while
   still trimming and validating the value against `AI_STATUS`.

2. **A goal-echo assertion collided with persisted history.** The same goal text
   is also the title of persisted mission-history entries rendered by
   `apps/web/src/app/autonomous-builder/page.tsx`. Once any such mission exists,
   the unscoped `page.getByText(GOAL_PROMPT)` resolved to two elements and failed
   with a strict-mode violation. Fixed by scoping the assertion to the companion
   panel (`ask-vedmoulya-panel`), which is what the assertion means.

Before these fixes the same suite reported `8 passed / 1 failed` in one
environment and `2 failed / 7 did not run` in another, driven by those defects and
by the missing provider — not by the journey logic.

## 3. Known limitations (reported, not hidden)

1. **Production release remains blocked** on four operator-gated conditions:
   managed identity database, funded live cloud AI credits, authorized staging for
   DR drills, and deployment of the token-denylist migration — see
   `BLOCKER-REPORT-S12-PRODUCTION.md`. No in-repo change can clear them.
2. **Live cloud AI generation is unverified** (independent of the E2E above, which
   runs on the deterministic mock): `AI_ANTHROPIC_API_KEY`/`AI_DEEPSEEK_API_KEY`
   are empty and the configured cloud providers fail or time out. This is blocker
   S012-B.
3. **17 dev-only npm advisories** remain (5 low, 12 high, 0 critical) — see §4.
4. **Not run in this environment:** `npm run quality` performance benchmarks,
   `npm run test:a11y`, preflight/doctor in production mode — all
   network/credential/platform dependent.
5. The E2E result in §2 is for the environment described there; it is **not** a
   result for this checkout's default `.env.local` (cloud identity DB, no working
   provider), which cannot serve these specs.

## 4. Dependency audit detail (dev-only)

All 17 advisories are transitive, dev-only, and outside the shipped bundle.

| Family                                                                  | Advisory            | Patched version                                    | Decision             |
| ----------------------------------------------------------------------- | ------------------- | -------------------------------------------------- | -------------------- |
| `webpack-dev-middleware` (via `@storybook/builder-webpack5`, Storybook) | GHSA-g84c-rxfj-3j2c | `>=7.4.5` — outside the parent's declared `^6.1.2` | Accepted, documented |
| `braces` (via `micromatch` ← `commitizen`, `lint-staged`)               | GHSA-vfj7-8cjw-p6xm | **none** (`<=3.0.3` affected)                      | Accepted, documented |
| `elliptic` (via `crypto-browserify` ← `node-polyfill-webpack-plugin`)   | GHSA-848j-6mx2-7j84 | **none** (`<=6.6.1` affected)                      | Accepted, documented |

What was attempted for the only fixable family (Storybook's
`webpack-dev-middleware`): adding a root `overrides` entry pinned to the patched
`7.4.5` — the same mechanism this repository already uses for `vite`, `uuid`,
`esbuild`, `postcss`, `sharp`, `fast-uri` and `undici`. npm registers the override
but **cannot re-resolve it** for this workspace-nested dependency: the tree keeps
6.1.3 and `npm ls` reports it as `invalid: "7.4.5"` (exit `ELSPROBLEMS`), which
would make installs in CI nondeterministic. The override was therefore reverted and
the dependency tree restored and re-verified (install exit 0, tree valid, audit
gates unchanged).

`npm audit` itself reports `fixAvailable: false` for the Storybook chain. The
remaining escape route is an upstream Storybook release that raises its declared
range to `^7.x`; until then this is a local-docs-tooling-only exposure with no
production, shipping or build-gate impact (both enforced gates pass, §1).
