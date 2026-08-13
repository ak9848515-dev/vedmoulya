# Architecture Decisions

> How architectural decisions are recorded and reviewed.
> Owner: Architecture Council · Updated: 2026-08-03 (DOC-001)

## Purpose

Document the ADR (Architecture Decision Record) process: every architectural decision is recorded with context, decision, and consequences — per the constitution ("every architectural decision must be documented").

## Scope

- ADR process and template
- Location of records (`docs/adr/`)
- Decision log (`09_Documents/Decision Log.md`)

## Current Status

Active. ADRs stored in `docs/adr/`; repository governance requires ADRs for architecture changes (see `REPOSITORY.md`).

## Architecture

```
Proposal → ADR (context, decision, consequences) → review (Architecture Council) → merge to docs/adr/
```

## Responsibilities

- Architecture Council: ADR review and numbering
- Authors: propose ADRs for any architecture change

## Deliverables

- ADR process (this document)
- ADR records (`../docs/adr/`)
- Decision log (`../09_Documents/Decision Log.md`)

## Dependencies

- `../docs/adr/`
- `../REPOSITORY.md`

## Future Work

- ADR template automation

## References

- [../docs/adr/](../docs/adr/)
- [../09_Documents/Decision Log.md](../09_Documents/Decision%20Log.md)
