# Architecture Documentation

> Single source of truth for the VedMoulya architecture: system design, capability architecture, the Enterprise Intelligence vision, and each platform engine.
> Owner: Architecture Council · Updated: 2026-08-03 (DOC-001)

## Purpose

Document the structural and behavioral architecture of VedMoulya so that every developer and every AI agent can understand, extend, and govern the platform without guessing. This folder is the canonical reference for how the system is built and why.

## Scope

- System overview and module topology (monorepo, apps, packages, services)
- Capability architecture and the AI provider abstraction
- The Enterprise Intelligence vision and its engine designs
- Per-engine architecture: Memory, Knowledge, Decision, Execution, Quality, Learning
- Open-source policy and AI provider strategy

This folder describes **what exists and the agreed direction**. It does not replace per-module technical documentation, which lives in `docs/api`, `docs/mobile`, `docs/ops`, and `docs/runbooks`.

## Current Status

- **Phase:** Production (v1.0.0), certified 2026-07-31
- **EPIC-003 (AI Content Agency):** complete — AC-001, AC-002, AC-002.5 all green
- **Enterprise Intelligence (EI):** vision established; components realized progressively through the AI Orchestrator and the engine services
- Companion folders: `09_Documents` (reports), `04_Technology` (engineering standards), `05_Design` (experience bible)

## Architecture

The repository is organized as:

```
00_Foundation/   Constitution, mission, foundation decisions
03_Architecture/ This folder — architecture documentation
04_Sprints/      Epic & sprint management (MASTER_ROADMAP)
05_Docs/         Project-wide documentation index
06_AI/           AI guidelines, prompts, providers, workflows
07_Operations/   Deployment, setup, backup, security operations
08_Revenue/      Business model, packages, pricing, client workflow
09_Quality/      Testing strategy, performance, checklists
```

The platform itself is a clean-architecture monorepo: `apps/web` (Next.js) → `services/api` (tRPC gateway) → `packages/services` (application layer) → `packages/domain` (domain model) → infrastructure (PostgreSQL, Redis), with every AI call routed through the AI Orchestrator.

## Responsibilities

- Keep architecture docs truthful to the codebase — no invented implementation details
- Record architectural decisions as ADRs (`docs/adr`)
- Update engine docs when the corresponding service changes

## Deliverables

- System, capability, and policy documents (see list below)
- Per-engine architecture documents
- Enterprise Intelligence design series

## Dependencies

- Repository governance (`REPOSITORY.md`, `00_Foundation/CONSTITUTION.md`)
- Engineering standards (`04_Technology`)
- ADR records (`docs/adr`)

## Future Work

- EI-009 Enterprise Brain and EI-010 Self-Improvement designs
- Quality Engine formalization as a first-class service
- Capability registry automation

## References

- [VEDMOULYA_CONSTITUTION.md](./VEDMOULYA_CONSTITUTION.md)
- [SYSTEM_OVERVIEW.md](./SYSTEM_OVERVIEW.md)
- [CAPABILITY_ARCHITECTURE.md](./CAPABILITY_ARCHITECTURE.md)
- [ENTERPRISE_INTELLIGENCE.md](./ENTERPRISE_INTELLIGENCE.md)
- [04_Sprints/MASTER_ROADMAP.md](../04_Sprints/MASTER_ROADMAP.md)
