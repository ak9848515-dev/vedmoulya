# Release Process

> The governed path from code to certified release.
> Owner: Platform Engineering · Updated: 2026-08-03 (DOC-001)

## Purpose

Define how VedMoulya releases software: conventional commits → CI quality gates → certification reports → version tag, with production approval gates.

## Scope

- Release workflow (commit → PR → CI → tag → deploy)
- Quality gates required before release
- Certification and approval reports
- Rollback and ops procedures

## Current Status

Active and proven: v1.0.0 released 2026-07-31 with RC-001…003 certification reports and production approval.

## Architecture

```
Conventional commit → PR (review) → CI (typecheck, lint, tests, build, e2e, a11y, security, performance)
  → tag (vX.Y.Z) → certification report → production approval → deploy (Vercel/Railway)
```

## Responsibilities

- Platform Engineering: CI, deploys, rollback
- Quality Engineering: gates and certification
- Release manager: approvals

## Deliverables

- Release workflow (this document)
- Certification reports (`../docs/`)
- Deployment guides (`../docs/ops/`)

## Dependencies

- `.github/workflows/ci.yml`
- `../docs/ops/DEPLOYMENT_GUIDE.md`
- [RELEASE_CHECKLIST.md](../09_Quality/RELEASE_CHECKLIST.md)

## Future Work

- Release automation and staging environment

## References

- [../09_Quality/RELEASE_CHECKLIST.md](../09_Quality/RELEASE_CHECKLIST.md)
- [../07_Operations/DEPLOYMENT.md](../07_Operations/DEPLOYMENT.md)
