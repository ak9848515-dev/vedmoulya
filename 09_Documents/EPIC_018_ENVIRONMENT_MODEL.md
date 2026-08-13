# EPIC-018 — VedMoulya Production Startup & Environment Reliability: Environment Model

**Status:** IMPLEMENTED + VERIFIED (2026-08-11)

One authoritative environment-loading strategy for the startup/CLI path
(Phase 2). Runtime loading inside the web app is unchanged (Next.js loads
`apps/web/.env.local` itself — preserved).

---

## 1. The strategy

**Node's built-in `process.loadEnvFile()`** (Node ≥ 20.12 — this repo runs
Node 24) is the single loader used by the preflight and startup scripts. No
dotenv dependency was added. The loader is implemented once in
`packages/core/src/startup/preflight.ts` as `loadEnvFileSafe` / `loadEnvFilesSafe`
and is unit-tested.

File precedence (first existing file wins per key):

| Mode                 | Files tried (in order)                             |
| -------------------- | -------------------------------------------------- |
| development / test   | `<root>/.env.local` → `<root>/apps/web/.env.local` |
| production / staging | `<root>/.env.local` only (never the web dev file)  |

Missing files are **skipped silently**; unparseable files surface a warning
that never contains file contents.

## 2. Should a root `.env.local` exist?

**Investigation result (verified):**

- The web dev path already works through `apps/web/.env.local` (gitignored,
  holds `AUTH_JWT_SECRET`), which Next.js loads automatically.
- The root startup path (`startup.sh`, `preflight`) needs the same secret for
  the fail-fast config evaluation. The loader therefore **falls back to
  `apps/web/.env.local` in development** — no duplicated secret file.
- A root `.env.local` is **NOT created or committed** by this epic. If an
  operator wants one (e.g. for production-like local runs), it must be created
  manually with real values; `.gitignore` already excludes `.env.local` and
  `.env.*.local`.

**Conclusion:** no auto-created root `.env.local`. Production secrets come from
the platform environment (Vercel/Railway/CI), never from repository files.

## 3. Server-only vs browser (NEXT_PUBLIC)

- **Server-only:** every `AUTH_*`, `AI_*`, `*_DATABASE_URL`, `REDIS_URL`,
  `SMTP_*`, `GOOGLE_CLIENT_*`, `OPS_OPERATOR_IDS`, `OTEL_EXPORTER_OTLP_ENDPOINT`.
  These are read by the gateway server bundle and CLI scripts only.
- **Browser:** only `NEXT_PUBLIC_*` values ever reach the client bundle
  (Next.js convention — preserved; the web app defines no secrets with that
  prefix).
- The preflight/startup path **never prints values** — only key names and
  static messages (see `EPIC_018_SECURITY.md`).

## 4. What is preserved

- Next.js automatic env loading (`apps/web/.env.local`) — unchanged.
- The gateway's lazy config evaluation (`@vedmoulya/core` `getConfig()` runs on
  first real access, so `next build` with no env vars passes) — unchanged.
- The fail-fast production validation — unchanged and still enforced by the
  preflight (an invalid production environment is reported, never silently
  weakened).
