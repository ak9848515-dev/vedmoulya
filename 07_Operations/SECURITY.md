# Security Operations

> Security posture, practices, and response.
> Owner: Platform Engineering · Updated: 2026-08-03 (DOC-001)

## Purpose

Document the security posture of VedMoulya: principles (security by default), dependency/CVE management, secrets, authentication, and incident response. The authoritative policy lives at the repository root (`../SECURITY.md`); this file is the operations view.

## Scope

- Security principles and compliance
- Dependency and CVE management
- Secrets and fail-fast configuration
- Authentication/authorization model
- Incident response

## Current Status

Active. Security review performed (RC-001 D08), CVE tracking operational, fail-fast secret validation enforced outside development, endpoints authenticated by default.

## Architecture

```
Security by default → auth (JWT/OAuth via services/identity) → audit + rate-limit (gateway)
Dependencies → npm audit baseline → CVE tracking (docs/CVE_TRACKING.md)
Secrets → validated at startup; rotation via docs/ops/SECRET_ROTATION.md
```

## Responsibilities

- Platform Engineering: CVE triage, secret hygiene
- All contributors: follow secure coding standards

## Deliverables

- Security posture (this document)
- CVE tracking (`../docs/CVE_TRACKING.md`)
- Dependency policy (`../docs/DEPENDENCY_POLICY.md`)

## Dependencies

- `../SECURITY.md`
- `../docs/CVE_TRACKING.md`
- `../docs/RC-001_D08_Security_Review.md`

## Future Work

- Penetration testing cadence

## References

- [../SECURITY.md](../SECURITY.md)
- [../docs/DEPENDENCY_POLICY.md](../docs/DEPENDENCY_POLICY.md)
