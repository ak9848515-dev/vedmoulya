# EPIC-018 — VedMoulya Production Startup & Environment Reliability: Security

**Status:** IMPLEMENTED + VERIFIED (2026-08-11)

> The previous EPIC-018 (AI World Scheduler) security model was preserved in
> `09_Documents/EPIC_018_SCHEDULER_SECURITY.md`.

Security guarantees for the startup/preflight surface.

---

## 1. No secret leakage (VERIFIED by test)

- The `PreflightEngine` **never reads environment values into messages** — it
  only checks key presence and static rules. A dedicated test
  (`report output never contains environment values`) proves that serializing a
  full report does not contain the `AUTH_JWT_SECRET`, `AI_OPENAI_API_KEY`, or
  database/redis passwords present in the environment snapshot.
- The CLI redacts key-shaped strings from config-error text
  (`sk-…`, `sk-ant-…`, `AIza…`, `ghp_…`, long base64) as belt-and-braces before
  printing.
- `loadEnvFileSafe` reports parse errors **without file contents**.

## 2. Env files stay out of git

`.gitignore` already excludes `.env.local`, `.env.development`,
`.env.staging`, `.env.production` and `.env.*.local`. This epic creates no
committed secret files and never copies secrets between files.

## 3. Server-only secrets never reach the browser

All runtime secrets (`AUTH_JWT_SECRET`, `AI_*`, `*_DATABASE_URL`, `REDIS_URL`,
`SMTP_*`, `GOOGLE_CLIENT_*`, `OPS_OPERATOR_IDS`) are read only by the gateway
server bundle and CLI scripts. The client bundle only ever sees
`NEXT_PUBLIC_*` values (none defined). The web api-client exposes typed tRPC
procedures only.

## 4. Startup never hides failures

The preflight surfaces every blocker with its reason and fix — never a bare
`ERR_MODULE_NOT_FOUND` / `ECONNREFUSED` / "Could not find production build".
The original error is preserved in the `detail`/`why` fields (redacted for
values).

## 5. Untrusted input stance (unchanged)

Discovery/ecosystem content stays untrusted per EPIC-012C/015; provider
metadata is never auto-activated; production never silently serves the mock
provider (`AI_ENABLE_MOCK=true` is an explicit opt-in). The preflight enforces
the same production rule.
