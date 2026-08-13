# EPIC-002 — Life OS Modules

> The user-facing engines of the Execution Operating System: career, learning, business, marketplace, notifications, dashboard.
> Owner: Module Teams · Updated: 2026-08-03 (DOC-001)

## Purpose

Deliver the Life OS product modules that help users build livelihoods: career guidance, learning paths, business intelligence, marketplace, and the dashboard that unifies them.

## Scope

- Career engine, learning engine, business builder, marketplace, notifications
- Dashboard and mobile experience (MOB-001/002)
- Identity (JWT, OAuth) and sessions

## Current Status

🟢 **Complete.** Modules shipped with tests, docs, and certification reports (BLD-016 series, RC reports).

## Architecture

```
apps/web (pages/routes) → services/api (tRPC) → packages/services
  → packages/domain → repositories (Postgres/Redis)
AI features → AI Orchestrator (never direct provider calls)
```

## Responsibilities

- Module teams: career, learning, business, marketplace
- Design: `05_Design/` experience bible

## Deliverables

- Career, learning, business, marketplace pages
- Dashboard + mobile (Android wrapper, safe-area, offline, dark mode)
- Notifications and analytics

## Dependencies

- EPIC-001 foundation
- `services/identity`, `services/knowledge`, `services/memory`, etc.

## Future Work

- Deeper module intelligence via EI layer

## References

- [MASTER_ROADMAP.md](../MASTER_ROADMAP.md)
- [../03_Architecture/SYSTEM_OVERVIEW.md](../03_Architecture/SYSTEM_OVERVIEW.md)
