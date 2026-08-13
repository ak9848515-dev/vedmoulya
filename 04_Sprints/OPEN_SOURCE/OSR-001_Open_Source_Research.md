# OSR-001 — Open Source Research

> Evidence-based research process for adopting open-source technology.
> Owner: Platform Engineering · Updated: 2026-08-03 (DOC-001)

## Purpose

Define the research process VedMoulya follows before adopting any open-source technology, so decisions are evidence-based and mature OSS is reused per the constitution.

## Scope

- Research workflow (discover → evaluate → compare → decide)
- Evaluation criteria (maturity, license, security, community, fit)
- Decision output (ADR + catalog entry)
- Cadence and ownership

## Current Status

🟡 **Active.** Process defined here; operational practices include dependency audits and CVE tracking (`docs/DEPENDENCY_POLICY.md`, `docs/CVE_TRACKING.md`).

## Architecture

```
Discover → Evaluate (criteria matrix) → Compare → Decide (ADR)
  → adopt via Adapter Framework → catalog entry (OSR-002)
```

## Responsibilities

- Platform Engineering: research cadence
- Architecture Council: adoption sign-off

## Deliverables

- Research process (this document)
- Evaluation criteria matrix
- ADR trail

## Dependencies

- `docs/DEPENDENCY_POLICY.md`
- [03_Architecture/OPEN_SOURCE_POLICY.md](../../03_Architecture/OPEN_SOURCE_POLICY.md)

## Future Work

- Research template + scorecards

## References

- [OSR-002_Technology_Catalog.md](./OSR-002_Technology_Catalog.md)
- [03_Architecture/OPEN_SOURCE_POLICY.md](../../03_Architecture/OPEN_SOURCE_POLICY.md)
