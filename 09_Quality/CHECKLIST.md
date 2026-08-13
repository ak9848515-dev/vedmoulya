# Quality Checklist

> The per-change checklist every contributor runs before merging.
> Owner: Quality Engineering · Updated: 2026-08-03 (DOC-001)

## Purpose

Provide a single checklist covering code, AI, UX, docs, and mobile requirements so changes meet the quality bar consistently.

## Scope

- Code quality (types, lint, tests)
- AI compliance (routing, budgets, quality)
- UX/brand (dark mode, responsive, states)
- Documentation
- Mobile (Android, safe areas, offline)

## Current Status

Active. Enforced by CI gates and review; this checklist is the human-readable companion.

## Architecture

```
Change → run checklist → CI gates (typecheck, lint 0/0, tests, coverage, build, e2e, a11y, performance)
  → review → merge
```

## Responsibilities

- Developers: run the checklist
- Reviewers: verify compliance

## Deliverables

- Checklist (this document)

## Dependencies

- [TESTING_STRATEGY.md](./TESTING_STRATEGY.md)
- `../REPOSITORY.md`

## Future Work

- Automated checklist tooling

## References

- [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)
- [../03_Architecture/QUALITY_ENGINE.md](../03_Architecture/QUALITY_ENGINE.md)
