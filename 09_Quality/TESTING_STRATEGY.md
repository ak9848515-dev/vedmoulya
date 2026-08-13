# Testing Strategy

> How VedMoulya tests: unit, integration, e2e, a11y, performance.
> Owner: Quality Engineering · Updated: 2026-08-03 (DOC-001)

## Purpose

Document the testing strategy: layers, tooling, coverage gates, and hermetic practices that keep the platform reliable.

## Scope

- Test layers (unit, integration, e2e, a11y, performance)
- Tooling (Vitest, Playwright)
- Coverage requirements (≥80% on new code)
- Hermetic patterns (mock providers, in-memory repos, env setup)

## Current Status

Active. Vitest workspace (206 files / 2693 tests baseline), Playwright e2e, a11y and bundle checks, coverage gates in CI; content-agency suite green (AC-002.5).

## Architecture

```
Unit (services/packages, Vitest, hermetic) → Integration (repos/DI)
  → E2E (Playwright, apps/web) → A11y (axe) → Performance (bundle budgets)
CI: coverage gate ≥80%
```

## Responsibilities

- Quality Engineering: gates, tooling
- Developers: tests with every change

## Deliverables

- Testing strategy (this document)
- Test infrastructure (existing)
- Checklists ([CHECKLIST.md](./CHECKLIST.md))

## Dependencies

- `vitest.config.ts`, `tests/vitest.setup.ts`
- `.github/workflows/ci.yml`

## Future Work

- Contract testing, AI output regression harness

## References

- [CHECKLIST.md](./CHECKLIST.md)
- [../03_Architecture/QUALITY_ENGINE.md](../03_Architecture/QUALITY_ENGINE.md)
