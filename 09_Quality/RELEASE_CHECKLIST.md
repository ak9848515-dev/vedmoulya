# Release Checklist

> The gate that must pass before any release ships.
> Owner: Quality Engineering · Updated: 2026-08-03 (DOC-001)

## Purpose

Define the release readiness checklist: verification steps, quality gates, certification, and approval needed before tagging and deploying a release.

## Scope

- Pre-release verification (typecheck, lint, tests, build)
- E2E, a11y, security, performance gates
- Certification and approval reports
- Release notes and changelog

## Current Status

Active and proven: v1.0.0 released 2026-07-31 through RC-001…003 process.

## Architecture

```
Verify (typecheck/lint/tests/build) → gates (e2e/a11y/security/perf)
  → certification report → approval → tag → deploy → verify post-deploy
```

## Responsibilities

- Quality Engineering: run gates
- Release manager: sign-off
- Platform Engineering: deploy and verify

## Deliverables

- Release checklist (this document)
- Certification reports (`../docs/`)

## Dependencies

- `.github/workflows/ci.yml`
- [../05_Docs/RELEASE_PROCESS.md](../05_Docs/RELEASE_PROCESS.md)

## Future Work

- Automated release verification summary

## References

- [../05_Docs/RELEASE_PROCESS.md](../05_Docs/RELEASE_PROCESS.md)
- [../docs/RC-003_Production_Approval_Report.md](../docs/RC-003_Production_Approval_Report.md)
