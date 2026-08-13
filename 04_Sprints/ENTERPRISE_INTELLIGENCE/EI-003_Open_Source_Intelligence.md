# EI-003 — Open Source Intelligence

> Systematic awareness of the open-source ecosystem feeding the platform.
> Owner: Platform Engineering · Updated: 2026-08-03 (DOC-001)

## Purpose

Provide ongoing intelligence on open-source options relevant to VedMoulya (AI tooling, infra, libraries) so adoption decisions are evidence-based and mature OSS is reused per the constitution.

## Scope

- Research process (OSR-001) and technology catalog (OSR-002)
- Signals: maintenance, licenses, security, community
- Decision intake into ADRs

## Current Status

🔵 **Designed.** Research and catalog processes defined (see `04_Sprints/OPEN_SOURCE/`); operational practices include dependency audits and CVE tracking.

## Architecture

```
Research signals → evaluation (maturity, license, security, fit)
  → Technology Catalog (OSR-002) → adoption decision (ADR)
  → integration via Adapter Framework (EI-002)
```

## Responsibilities

- Platform Engineering: research cadence, catalog upkeep
- Architecture Council: adoption decisions

## Deliverables

- OSR program documents
- Maintained technology catalog
- ADR trail for adoptions

## Dependencies

- `docs/DEPENDENCY_POLICY.md`, `docs/CVE_TRACKING.md`
- `04_Sprints/OPEN_SOURCE/`

## Future Work

- Automated catalog/health signals

## References

- [04_Sprints/OPEN_SOURCE/OSR-002_Technology_Catalog.md](../OPEN_SOURCE/OSR-002_Technology_Catalog.md)
- [03_Architecture/OPEN_SOURCE_POLICY.md](../../03_Architecture/OPEN_SOURCE_POLICY.md)
