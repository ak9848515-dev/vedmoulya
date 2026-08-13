# Backup & Restore

> Protecting data: backups, restore procedures, and verification.
> Owner: Platform Engineering · Updated: 2026-08-03 (DOC-001)

## Purpose

Document the backup and restore strategy for databases (PostgreSQL, Redis), configuration, and secrets — with verified restore procedures.

## Scope

- Backup scope and cadence
- Backup tooling (`scripts/backup.sh`)
- Restore procedures and verification
- Secret rotation reference

## Current Status

Active. Backup script and runbook exist (`scripts/backup.sh`, `docs/runbooks/backup-restore-runbook.md`); secret rotation documented in `docs/ops/SECRET_ROTATION.md`.

## Architecture

```
Backup schedule → scripts/backup.sh → storage (snapshots/dumps)
Restore: documented runbook → verification (health checks, data spot checks)
```

## Responsibilities

- Platform Engineering: backup cadence, restore drills
- On-call: follow runbooks

## Deliverables

- Backup script (existing)
- Restore runbook (existing)
- Cadence and ownership (this document)

## Dependencies

- `../scripts/backup.sh`
- `../docs/runbooks/backup-restore-runbook.md`
- `../docs/ops/SECRET_ROTATION.md`

## Future Work

- Automated restore drills

## References

- [SECURITY.md](./SECURITY.md)
- [../docs/ops/SECRET_ROTATION.md](../docs/ops/SECRET_ROTATION.md)
