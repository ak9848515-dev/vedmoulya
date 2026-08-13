# Performance

> Performance budgets, measurements, and known watch items.
> Owner: Quality Engineering · Updated: 2026-08-03 (DOC-001)

## Purpose

Document performance standards and findings: bundle budgets, load testing, query patterns, and identified watch items — so the platform stays fast as it grows.

## Scope

- Bundle size budgets (pages ≤50 kB, shared ≤150 kB)
- Load testing and performance checks
- Query/repository patterns (N+1 watch items)
- Monitoring (OpenTelemetry)

## Current Status

Active. All bundle budgets pass as of AC-002.5 (home page ≈49 kB — watch item); full Next.js build green; N+1 in lead/payment lists flagged as pre-scale watch item.

## Architecture

```
Bundle checks (scripts/check-bundle-size.sh) → CI performance gate
Load testing (scripts/load-test.mjs) → observability (OpenTelemetry/Grafana)
Repo patterns: single-select queries; N+1 watch items tracked
```

## Responsibilities

- Quality Engineering: budgets and measurement
- Developers: respect budgets and query patterns

## Deliverables

- Performance standards (this document)
- Bundle/load tooling (existing)
- Watch-item register

## Dependencies

- `scripts/check-bundle-size.sh`
- `scripts/load-test.mjs`
- `../docs/RC-001_D09_Performance_Review.md`

## Future Work

- Resolve N+1 patterns; add LCP/TTI budgets

## References

- [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)
- [../docs/RC-001_D09_Performance_Review.md](../docs/RC-001_D09_Performance_Review.md)
