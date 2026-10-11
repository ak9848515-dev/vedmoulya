# Architecture and Dependency Map

Derived from internal `@vedmoulya/*` dependency edges (dependencies +
peerDependencies) across all 58 workspaces.

## Layered topology (acyclic — `deps:cycles` exit 0)

```
┌─────────────────────────────────────────────────────────────┐
│ apps/web  (Next.js app, 18 internal deps)                     │  presentation
│   → services/api via tRPC [trpc]/route.ts + api-client.ts     │
└─────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────────────────────────────────────────┐
│ services/api  (composition root, 48 internal deps)  + 49 routers │  gateway
│   ApiApplicationService → RouterRegistry → DomainApplicationServices │
└─────────────────────────────────────────────────────────────┘
        │            │            │            │
   services/identity  services/orchestrator  services/{execution,decision,
   memory,knowledge,content-agency}          notifications(empty)
        │
┌─────────────────────────────────────────────────────────────┐
│ packages/services  (application-service hub, fan-in 14)        │  app layer
└─────────────────────────────────────────────────────────────┘
        │
┌─────────────────────────────────────────────────────────────┐
│ Domain engines: mission-runtime, mission-controller, brain,    │  domain
│ planning, agent-execution, execution-*, loop-engine,           │
│ adaptive-loop, experience*, goals, requirements, app-factory,  │
│ capabilities, world-model, intelligence*, memory/learning/     │
│ knowledge-intelligence, eco*, os-intelligence, ai-world*,      │
│ context*, rag, voice, proactive, control-plane, providers, ai, │
│ orchestration-fabric(deferred)                                 │
└─────────────────────────────────────────────────────────────┘
        │
┌─────────────────────────────────────────────────────────────┐
│ packages/domain, packages/information  (models/constants)      │  model
└─────────────────────────────────────────────────────────────┘
        │
┌─────────────────────────────────────────────────────────────┐
│ packages/core  (foundation, fan-in 42)  ·  packages/shared      │  foundation
└─────────────────────────────────────────────────────────────┘
```

## Fan-in (most depended-upon modules)

| Rank | Module                              | Fan-in |
| ---: | ----------------------------------- | -----: |
|    1 | `@vedmoulya/core`                   |     42 |
|    2 | `@vedmoulya/ai`                     |     19 |
|    3 | `@vedmoulya/services`               |     14 |
|    4 | `@vedmoulya/context`                |     10 |
|    4 | `@vedmoulya/providers`              |     10 |
|    6 | `@vedmoulya/capabilities`           |      9 |
|    6 | `@vedmoulya/execution-strategy`     |      9 |
|    6 | `@vedmoulya/goals`                  |      9 |
|    9 | `@vedmoulya/domain`                 |      8 |
|    9 | `@vedmoulya/execution-orchestrator` |      8 |

## Fan-out (broadest composition nodes)

| Module                           | Fan-out | Reading                                                           |
| -------------------------------- | ------: | ----------------------------------------------------------------- |
| `@vedmoulya/api`                 |      48 | The single composition root; almost every engine is reached here. |
| `@vedmoulya/web`                 |      18 | Presentation entry.                                               |
| `@vedmoulya/os-intelligence`     |      11 | Broad intelligence composer.                                      |
| `@vedmoulya/memory-intelligence` |      10 | Broad intelligence composer.                                      |
| `@vedmoulya/mission-runtime`     |       9 | Correct: composes intelligence, owns lifecycle.                   |

## Zero fan-in modules (not depended upon by any workspace)

| Module                     | Dir                      | Classification                                          |
| -------------------------- | ------------------------ | ------------------------------------------------------- |
| `@vedmoulya/local-ai`      | `packages/local-ai`      | Entry point via `npm run local-agent` (CLI) — expected. |
| `@vedmoulya/web`           | `apps/web`               | App entry (top of graph) — expected.                    |
| `@vedmoulya/testing`       | `packages/testing`       | **Orphaned** — no source/test importer (D-04).          |
| `@vedmoulya/notifications` | `services/notifications` | **Empty** — package.json only (D-01).                   |

## Ownership boundaries (preserved)

- **Mission** (`mission-runtime`, orchestrated by `mission-controller`) owns the
  autonomous lifecycle. **Brain** (`brain`, `planning`) supplies reusable,
  stateless intelligence. No second autonomous lifecycle exists.
- **Provider routing** flows through the single canonical
  `AIOrchestrationService` (`services/orchestrator`). `orchestration-fabric`
  (`ApiApplicationService.ts:2799`) is the deferred second authority (G-17 / D-05).
- **Execution** is governed in `agent-execution` (allowlist → schema → timeout →
  rate-limit → audit → verification); approval/delivery is draft-only.

## Structural risks

1. `@vedmoulya/api` fan-out of 48 concentrates the entire platform behind one
   3,150-line service and a 7,003-line router registry (D-02).
2. Several near-duplicate capability clusters (learning vs learning-intelligence,
   context vs context-fabric, execution vs execution-strategy) — potential
   ownership/navigation ambiguity.
3. Two zero-fan-in units are genuine dead weight (D-01, D-04).
