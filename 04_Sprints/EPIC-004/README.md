# EPIC-004 — Enterprise Intelligence

> The governed AI layer: capability registry, adapters, context, economy, planning, and learning.
> Owner: AI Platform Team · Updated: 2026-08-06 (EI-009)

## Purpose

Build the Enterprise Intelligence (EI) layer so every AI call on the platform is governed by capability routing, token/cost/quality budgets, minimum context, and centralized learning — per the Constitution.

## Scope

- EI-001 Capability Registry · EI-002 Provider Registry & Intelligence Platform · EI-003 Context Intelligence
- EI-004 Enterprise Execution Strategy Engine · EI-005 Execution Orchestrator (+ EI-005b Budget Enforcement) · EI-006 Goal & Task Intelligence + Integration Platform (INT-001)
- EI-007 Enterprise Learning Intelligence Platform · EI-008 Enterprise Brain (Central Decision Intelligence) · EI-009 Enterprise Knowledge Intelligence Platform · EI-010 Self-Improvement
- Enterprise Brain memory/knowledge synthesis vision (former EI-009 plan — re-designated to the backlog) · Execution Scheduler generalization (former EI-007 plan — re-designated to the backlog)

## Current Status

🟢 **Active (implemented).** EI-001…EI-009 delivered; CERT-002 certified (2026-08-06); next builds: EI-005b budget enforcement, provider rating/benchmark, EI-010.

## Architecture

See [03_Architecture/ENTERPRISE_INTELLIGENCE.md](../../03_Architecture/ENTERPRISE_INTELLIGENCE.md).

## Responsibilities

- AI Platform Team: EI design and builds
- All modules: route AI through EI

## Deliverables

- EI design series (EI-001…010 docs)
- Realized orchestrator core; remaining components as backlog

## Dependencies

- `packages/ai`, `services/orchestrator`
- Engine services (memory, knowledge, decision, execution, learning)

## Future Work

- EI-001…EI-004 builds complete; EI-005/006/007 next

## References

- [ENTERPRISE_INTELLIGENCE/](../ENTERPRISE_INTELLIGENCE/)
- [../03_Architecture/ENTERPRISE_INTELLIGENCE.md](../03_Architecture/ENTERPRISE_INTELLIGENCE.md)
