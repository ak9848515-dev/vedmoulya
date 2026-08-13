# Quality Engine

> Every AI output is scored; every release is gated. Quality is a system property, not an afterthought.
> Owner: Quality Engineering · Updated: 2026-08-03 (DOC-001)

## Purpose

Document the Quality Engine: the practices and components that ensure AI output quality (scoring rubrics, brand consistency, failure/retry handling) and engineering quality (coverage gates, lint, typecheck, build, accessibility).

## Scope

- AI output quality scoring (weighted rubrics: brand, grammar, SEO)
- Version history and regeneration
- Failure handling and retry
- Engineering quality gates (CI) and coverage thresholds

## Current Status

Operational. Content Agency applies weighted quality scoring and multi-pass review with versioned regeneration and retry handling (AC-001). CI enforces typecheck → lint (zero warnings) → tests (≥80% coverage) → build → e2e → a11y → performance budgets. A first-class Quality Engine service is a future EI component.

## Architecture

```
AI output → quality score (rubric weights) → threshold? → accept/regenerate
Engineering: CI gates (typecheck, lint --max-warnings=0, coverage, build, a11y, bundle)
```

## Responsibilities

- Quality Engineering: gate definitions, scoring rubrics
- Module teams: meet gates, surface quality scores

## Deliverables

- CI quality gates (operational)
- Content agency scoring + version history (realized)
- Quality checklist (09_Quality/CHECKLIST.md)

## Dependencies

- CI workflow (`.github/workflows/ci.yml`)
- `09_Quality/` checklists
- [EXECUTION_ENGINE.md](./EXECUTION_ENGINE.md)

## Future Work

- Central quality scoring service
- Regression harness for AI output quality

## References

- [09_Quality/TESTING_STRATEGY.md](../09_Quality/TESTING_STRATEGY.md)
- [09_Quality/RELEASE_CHECKLIST.md](../09_Quality/RELEASE_CHECKLIST.md)
