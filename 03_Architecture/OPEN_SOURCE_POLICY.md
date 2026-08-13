# Open Source Policy

> How VedMoulya uses, contributes to, and releases open-source software.
> Owner: Platform Engineering · Updated: 2026-08-03 (DOC-001)

## Purpose

Govern the use of open-source software (OSS) in the platform and the company's posture as a producer and consumer of the open-source ecosystem. This policy implements the constitutional principle: _reuse mature open-source software whenever appropriate_.

## Scope

- Adoption criteria for OSS dependencies
- License compliance and dependency governance
- Contribution policy
- Open-source release posture (the OSR program)

## Current Status

Adopted. The platform is built on mature OSS (Next.js, React, Tailwind, Hono, Drizzle, Zod, PostgreSQL, Redis, Vitest, Playwright, OpenTelemetry). Dependency audits, license review, and CVE tracking are operational (`docs/DEPENDENCY_POLICY.md`, `docs/CVE_TRACKING.md`). The Open Source program (OSR-001…004) is defined in `04_Sprints/OPEN_SOURCE/`.

## Architecture

- **Adoption:** prefer mature, maintained, permissively-licensed OSS; wrap behind VedMoulya interfaces
- **Governance:** `npm audit` baseline (high severity), dependency policy, CVE tracking, license review before merge
- **Contributions:** follow `CONTRIBUTING.md`; upstream fixes when feasible
- **Release:** OSR program governs any public release of VedMoulya components

## Responsibilities

- Platform Engineering: dependency governance and audits
- Architecture Council: OSS adoption decisions
- All contributors: license and security compliance

## Deliverables

- Dependency policy + CVE tracking (operational)
- OSR program documents (04_Sprints/OPEN_SOURCE)

## Dependencies

- `docs/DEPENDENCY_POLICY.md`
- `docs/CVE_TRACKING.md`
- `CONTRIBUTING.md`

## Future Work

- OSR-002 Technology Catalog maintenance automation
- OSR-004 Capability Marketplace evaluation

## References

- [04_Sprints/OPEN_SOURCE/OSR-001_Open_Source_Research.md](../04_Sprints/OPEN_SOURCE/OSR-001_Open_Source_Research.md)
- [04_Sprints/OPEN_SOURCE/OSR-002_Technology_Catalog.md](../04_Sprints/OPEN_SOURCE/OSR-002_Technology_Catalog.md)
- [docs/DEPENDENCY_POLICY.md](../docs/DEPENDENCY_POLICY.md)
