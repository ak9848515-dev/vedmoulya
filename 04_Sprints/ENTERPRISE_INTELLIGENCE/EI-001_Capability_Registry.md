# EI-001 — Capability Registry

> The catalog of every AI capability the platform can perform.
> Owner: AI Platform Team · Updated: 2026-08-03 (DOC-001)

## Purpose

Define the Capability Registry: a first-class, queryable catalog of AI capabilities (text, reasoning, vision, content-generation, …) with metadata — which providers support each capability, health, quality tier, cost — so routing and planning are data-driven.

## Scope

- Capability taxonomy and metadata schema
- Provider capability declarations
- Registry query API (for routing, planning, dashboards)
- Sync with provider adapters

## Current Status

🔵 **Designed.** Capability types and rules exist in `packages/ai`; the Orchestrator routes by capability. A persistent, queryable registry service is the build deliverable.

## Architecture

```
Capability Registry
  ├─ capabilities table (name, description, params, quality tiers)
  ├─ provider_capabilities (providerId, capability, supported, cost hints)
  ├─ sync job ← provider adapters (capability declarations)
  └─ query API → routing / EI-006 planner / dashboards
```

## Responsibilities

- AI Platform Team: registry schema, sync, query API
- Provider owners: accurate declarations

## Deliverables

- Registry service + API
- Sync from adapter declarations
- Routing integration

## Dependencies

- `packages/ai` (capability types)
- `services/orchestrator` (adapters)
- [03_Architecture/CAPABILITY_ARCHITECTURE.md](../../03_Architecture/CAPABILITY_ARCHITECTURE.md)

## Future Work

- Cost/quality metadata from EI-005
- Marketplace exposure (OSR-004)

## References

- [03_Architecture/CAPABILITY_ARCHITECTURE.md](../../03_Architecture/CAPABILITY_ARCHITECTURE.md)
- [EI-005_AI_Economy_Engine.md](./EI-005_AI_Economy_Engine.md)
