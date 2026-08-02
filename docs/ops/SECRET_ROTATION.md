# VedMoulya — Secret Rotation Procedure

| Field   | Value                      |
| ------- | -------------------------- |
| Version | 1.0.0                      |
| Updated | 2026-08-01 (SPRINT PR-002) |
| Owner   | Platform Engineering       |

---

## Purpose

Define the rotation procedure for every secret used by the platform, and the
expected impact of rotating each one. All secrets are validated at startup
(fail-fast) — rotated values must be real secrets (no placeholders,
localhost, or development defaults) in `NODE_ENV=production`/`staging`.

## Secret Inventory

| Secret                                   | Used by             | Rotation triggers                         | Rotation impact                            |
| ---------------------------------------- | ------------------- | ----------------------------------------- | ------------------------------------------ |
| `AUTH_JWT_SECRET`                        | All services (auth) | Suspected leak, ≥ 90 days, personnel exit | Invalidates all sessions (expected outage) |
| `IDENTITY_DATABASE_URL` …                | Per-service DB      | Provider credential change, leak          | Pool reconnect (transient)                 |
| `REDIS_URL`                              | Cache/sessions      | Provider credential change, leak          | Cache rebuild (safe)                       |
| `AI_OPENAI_API_KEY` / Anthropic / Google | AI orchestrator     | Leak, key expiry, ≥ 90 days               | AI requests fail until rotated             |
| `GOOGLE_CLIENT_ID`/`SECRET`              | Social login        | Leak, app re-key                          | Social login unavailable                   |
| `SMTP_USER` / `SMTP_PASS`                | Notifications       | Leak, mailbox compromise                  | Email sending unavailable                  |

## Rotation Procedure (generic)

1. **Prepare** — generate the replacement secret (provider console or
   `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).
2. **Vault** — store the new value in the secrets manager; do not commit to
   git or `.env.local`.
3. **Validate** — confirm the new value passes the startup validation rules
   (≥ required length, not a placeholder/localhost).
4. **Deploy** — redeploy services with the new environment; fail-fast config
   will reject invalid values at boot with a clear message.
5. **Verify** — check `/api/trpc/health.check` and the affected flow (auth,
   AI, email, social login).
6. **Revoke/retire** — rotate the old value out (provider revoke where
   supported) after confirming the new value works.
7. **Document** — record the rotation in the
   [Decision Log](../../09_Documents/Decision%20Log.md) with timestamp and
   reason (never the secret value).

## JWT Secret Rotation — Notes

- Rotating `AUTH_JWT_SECRET` invalidates **all** existing sessions and
  refresh tokens at once. Schedule it as a maintenance window and notify
  users to re-authenticate.
- On suspected leak, rotate immediately — the fail-fast validator will also
  reject placeholder/known secrets at boot as defense-in-depth.

## Scheduled Rotation

- **High-sensitivity** (`AUTH_JWT_SECRET`, AI keys): every 90 days.
- **Medium** (OAuth, SMTP): every 180 days or on personnel exit.
- **Infrastructure** (DB, Redis URLs): on provider credential changes.

---

**Related:** [Backup & Restore runbook](../runbooks/backup-restore-runbook.md) ·
[Deployment guide](./DEPLOYMENT_GUIDE.md) · [Rollback runbook](../runbooks/rollback-runbook.md)
