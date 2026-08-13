# OSR-002 — Technology Catalog

> The maintained catalog of open-source technology in use and under evaluation.
> Owner: Platform Engineering · Updated: 2026-08-03 (DOC-001)

## Purpose

Maintain a single catalog of open-source technologies: what is adopted (with rationale), what is under evaluation, and what was rejected (with reasons) — the reference for future decisions.

## Scope

- Catalog schema (category, technology, status, license, version, owner)
- Adopted stack (production)
- Evaluation queue
- Rejected decisions log

## Current Status

🟡 **Active.** The adopted stack is documented (see table); a structured catalog file is maintained by Platform Engineering.

## Architecture

```
Catalog entries: category | technology | status (adopted/evaluating/rejected) | license | version | rationale
```

### Adopted stack (production)

| Category      | Technology                                 |
| ------------- | ------------------------------------------ |
| Frontend      | Next.js 15, React, Tailwind CSS, shadcn/ui |
| Backend       | Hono, Drizzle ORM, Zod                     |
| Database      | PostgreSQL 16+ (pgvector)                  |
| Cache/Queue   | Redis 7+ (BullMQ)                          |
| AI SDK        | Vercel AI SDK (multi-provider)             |
| Testing       | Vitest, Playwright                         |
| Observability | OpenTelemetry, Grafana                     |
| CI/CD         | GitHub Actions                             |

## Responsibilities

- Platform Engineering: catalog upkeep
- All teams: consult catalog before adopting

## Deliverables

- Catalog (this document + structured file)
- Version and license tracking

## Dependencies

- [OSR-001_Open_Source_Research.md](./OSR-001_Open_Source_Research.md)
- `docs/DEPENDENCY_POLICY.md`

## Future Work

- Automation of catalog updates from dependency manifests

## References

- [README.md](../../README.md) (stack summary)
- [OSR-003_Integration_Framework.md](./OSR-003_Integration_Framework.md)
