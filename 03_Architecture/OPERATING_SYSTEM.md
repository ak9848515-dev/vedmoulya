# Enterprise Operating System

> The integration layer that turns the eleven Enterprise Intelligence Engines (EI-001…EI-010 + INT-001) into **one Enterprise Operating System** — no new engines, no redesigned architecture, no isolated components.
> Owner: Chief Enterprise Platform Integration Architect · Updated: 2026-08-07 (OS-001)

## Purpose

Describe how VedMoulya functions as a single operating system: every engine
consumes correct inputs, produces correct outputs, uses shared contracts,
shared DTOs and shared repositories, with no duplicated models, no duplicated
services and no circular dependencies. The OS layer (`@vedmoulya/os-intelligence`)
integrates, validates, optimizes and certifies the complete platform — it owns
no engine, duplicates no logic, and modifies nothing downstream.

## Scope

- The engine registry and dependency matrix (package build graph + consultation graph)
- The 15-stage event-flow pipeline and cross-engine validation
- System health, diagnostics, platform validation and performance
- Repository readiness and health-snapshot persistence
- The `os.*` gateway API and the Enterprise OS Dashboard

## Current Status

**🟢 COMPLETE (OS-001, 2026-08-07).** The integration layer ships as
`packages/os-intelligence`, exposed through the gateway `os.*` tRPC namespace
(9 procedures), rendered by the `/os` Enterprise OS Dashboard (6 tabs), seeded
into the `os_health_registry` store, and certified end-to-end. Full details:
[09_Documents/OS-001_Completion_Report.md](../09_Documents/OS-001_Completion_Report.md).

## Architecture

### Layering

`packages/os-intelligence` follows the same layering as every EI engine:
**types → contracts → domain → infrastructure → application → catalog**.

```
Enterprise OS Dashboard (/os)
        │  useOS* hooks (typed DTOs)
        ▼
Gateway os.* tRPC namespace (9 procedures, auth + IDOR + rate-limit, zod)
        │
        ▼
OSApplicationService (facade — owns no engine)
        ├─ OSHealthService            — system health pass + overall score
        ├─ OSPipelineValidationService — 15-stage event-flow validation
        ├─ OSCrossEngineValidationService — 9 integration pairs
        ├─ OSDependencyGraphService   — package graph (acyclicity gate) + consultation matrix
        ├─ OSDiagnosticsService       — diagnostics battery
        ├─ OSValidationService        — validatePlatform certification gate
        ├─ OSPerformanceService       — end-to-end + per-engine latency
        ├─ OSRepositoryStatusService  — repository readiness
        ├─ OSDashboardService         — dashboard + snapshot history
        └─ OSEngineProbeService       — parallel fan-out over engine ports
        │
        ▼
OSEngines port contracts (narrow seams — the same pattern as MemoryEngines/KnowledgeEngines/BrainEngines)
        ▼
Eleven Enterprise Intelligence Engines (EI-001…EI-010 + INT-001)
```

### System diagram

```
┌─────────────────────────── Enterprise Operating System ───────────────────────────┐
│                                                                                   │
│   Goal → Project → Task Planning → Capability → Knowledge → Memory → Provider     │
│   → Context → Decision (Brain) → Strategy → Execution Graph → Execution Session   │
│   → Learning → Knowledge Update → Memory Update                                   │
│                                                                                   │
│   engines:  goals · capabilities · providers · context · strategy · orchestrator  │
│             · intelligence · learning · brain · knowledge · memory                 │
│                                                                                   │
│   ports:    OS_ENGINE_SPECS (package · sprint · repository · table · port)         │
│   gates:    package graph acyclic · repository persisted · pipeline valid          │
│   stores:   *_registry Postgres JSONB tables + os_health_registry snapshots        │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### Integration matrix (who consults whom)

| Engine       | Consults                                                                                             |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| goals        | capabilities · providers · context · strategy · orchestrator                                         |
| capabilities | providers                                                                                            |
| providers    | capabilities                                                                                         |
| context      | knowledge · memory · capabilities · providers                                                        |
| knowledge    | goals · capabilities · providers · context · strategy · orchestrator · learning · brain              |
| memory       | goals · capabilities · providers · context · strategy · orchestrator · learning · brain · knowledge  |
| brain        | goals · learning · capabilities · providers · context · strategy · orchestrator · knowledge · memory |
| strategy     | goals · capabilities · providers · context                                                           |
| orchestrator | goals · capabilities · providers · strategy                                                          |
| intelligence | goals · capabilities · providers · context · strategy · orchestrator                                 |
| learning     | providers · capabilities · context · goals · orchestrator · brain                                    |

Consultation cycles are **expected and informational** in an integrated OS
(brain ↔ knowledge, memory ↔ knowledge, …). The acyclicity **gate** is the
package build graph (`OS_PACKAGE_DEPENDENCIES`) — verified acyclic at runtime.

### Cross-engine validation pairs (9)

Capability ↔ Provider · Provider ↔ Context · Context ↔ Knowledge ·
Knowledge ↔ Memory · Memory ↔ Learning · Learning ↔ Brain · Brain ↔ Strategy ·
Strategy ↔ Execution · Execution ↔ Learning

## Responsibilities

- The OS layer **observes** every engine through narrow port contracts — it never executes work
- The gateway resolves the production `PostgresOSRepository` (`os_health_registry`) by default
- Every engine stays the owner of its data, models and services — no duplication

## Deliverables

- `packages/os-intelligence` — integration layer (types, contracts, domain, infrastructure, application, catalog)
- Gateway `os.*` namespace — systemHealth, pipelineHealth, runDiagnostics, validatePlatform, engineStatus, dependencyGraph, performanceMetrics, dashboard, snapshots
- `/os` Enterprise OS Dashboard — Dashboard, Pipeline, Dependencies, Diagnostics, Performance, Snapshots tabs
- `scripts/seed-ei.ts` — 10th store: `os_health_registry` ← `createCatalogOSSnapshot()`
- Storybook — `OperatingSystem/*` stories (ScoreGauge, StatusBadge, StageBadge, SeverityBadge, EngineRow, StageRow, FindingRow, SnapshotRow)

## Dependencies

- All eleven EI engines (`@vedmoulya/*`), consumed through `OSEngines` port contracts
- `@vedmoulya/core` (health, metrics, types)
- Gateway (`services/api`) — router registry, production repository wiring
- Constitution AI principles (`VEDMOULYA_CONSTITUTION.md`)

## Future Work

- Live event-stream consumption (publish/subscribe across engines) — the current pass is a measured fan-out, not a streaming event bus
- Automated snapshot cadence (scheduled health passes)
- Provider rating / health / benchmark follow-on (EI-002b)

## References

- [09_Documents/OS-001_Completion_Report.md](../09_Documents/OS-001_Completion_Report.md)
- [ENTERPRISE_INTELLIGENCE.md](./ENTERPRISE_INTELLIGENCE.md)
- [MEMORY_INTELLIGENCE.md](./MEMORY_INTELLIGENCE.md)
- [KNOWLEDGE_INTELLIGENCE.md](./KNOWLEDGE_INTELLIGENCE.md)
