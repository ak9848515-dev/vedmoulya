# Learning Engine

> Adaptive learning paths, retention, and skill development — knowledge that compounds.
> Owner: Learning Engine Team · Updated: 2026-08-03 (DOC-001)

## Purpose

Document the Learning Engine (`services/learning`): the service behind career and skill development, adaptive learning paths, knowledge retention, and learning analytics, reused by the Content Agency's learning workflows.

## Scope

- Learning paths and modules
- Adaptive sequencing and retention
- Progress and analytics
- Reuse by other modules (content agency, career)

## Current Status

Implemented as `services/learning` with application services and Postgres persistence; wired into the web app (learning page) and API gateway. Reuse pattern confirmed in EPIC-003 (no duplicated services).

## Architecture

```
Learning path → modules → progress tracking → adaptation (retention/performance)
Analytics → dashboards
```

## Responsibilities

- Learning Engine Team: pedagogy quality, progress accuracy
- Consumers: surface learning in their contexts via APIs

## Deliverables

- Learning service + repository
- Adaptive sequencing logic
- Learning analytics

## Dependencies

- `services/learning`
- `services/knowledge` (content)
- [ENTERPRISE_INTELLIGENCE.md](./ENTERPRISE_INTELLIGENCE.md) (AI assist)

## Future Work

- EI-008 Learning Engine generalization
- Spaced-repetition scheduling

## References

- [04_Sprints/ENTERPRISE_INTELLIGENCE/EI-008_Learning_Engine.md](../04_Sprints/ENTERPRISE_INTELLIGENCE/EI-008_Learning_Engine.md)
- [SYSTEM_OVERVIEW.md](./SYSTEM_OVERVIEW.md)
