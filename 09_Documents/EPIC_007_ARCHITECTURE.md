# EPIC-007 — AI Application Factory: Architecture

> **Status:** COMPLETE · **Date:** 2026-08-08
> **Position in the stack:** the APPLICATION FACTORY layer **above** the frozen
> platform. It reuses the AI Runtime, RAG, AI-SELECT, EI-003 optimization, the
> EvidenceEvaluator, the EPIC-006 LoopEngine, the ToolRuntime, the
> StructuredOutputValidator, Memory, Goal Intelligence, Decision Intelligence
> and the Operating System — it rebuilds none of them.

---

## 1. Layering (mirrors the frozen platform pattern)

```
┌──────────────────────────────────────────────────────────────────┐
│ apps/web  /applications  (Phase 20 UI)                            │
├──────────────────────────────────────────────────────────────────┤
│ services/api  factory.* tRPC namespace (Phase 20 API)             │
│   └─ FactoryRouter → FactoryApplicationService (DTO boundary)     │
├──────────────────────────────────────────────────────────────────┤
│ packages/app-factory  @vedmoulya/app-factory (BUILD)              │
│   types → contracts → domain → infrastructure → application →     │
│   catalog                                                          │
├──────────────────────────────────────────────────────────────────┤
│ FROZEN PLATFORM (reused, never modified):                          │
│   AIOrchestrationService (AI-SELECT / EI-002 / EI-004 / EI-003 /   │
│   Evidence-First) · RAG · ToolRuntime · EPIC-006 LoopEngine ·      │
│   CriticEvaluator · Identity · @vedmoulya/ui                       │
└──────────────────────────────────────────────────────────────────┘
```

## 2. The factory pipeline (Phase 1 → 18)

```
UNDERSTAND  create()   SpecificationEngine   → ApplicationSpecification
SPECIFY     create()   ArchitectureEngine    → ApplicationArchitecture
ARCHITECT   create()   TaskGraphBuilder      → ApplicationTaskGraph (loop-reusable)
PLAN        create()   BlueprintService + PlanPreviewService → preview + estimate
APPROVE     approve()  Phase 8 gate          → PLANNED (no files before approval)
GENERATE    build()    generateProject (deterministic archetype templates)
TEST        build()    ValidationPipeline    → lint/typecheck/unit/integration/build gates
CRITIQUE    build()    EPIC-006 LoopEngine   → bounded generation loop over the task graph
REFINE      build()    auto-fix deterministic gate failures (bounded)
SECURITY    build()    SecurityReviewer      → CRITICAL/HIGH block completion
UI QUALITY  build()    UIQualityEvaluator    → responsive/a11y/consistency checks
BUILD       build()    isolated workspace    → status READY/FAILED + termination reason
PACKAGE     deploy()   DeploymentAbstraction → local artifact (explicit authorization)
VCS         versionControl() init/branch/commit/diff/prepare-PR (never pushes)
```

## 3. Workspace layout

```
packages/app-factory/
├── src/
│   ├── types/app-types.ts            — ApplicationSpecification, Architecture,
│   │                                   TaskGraph, Blueprint, FileOperation,
│   │                                   ExecutionPolicy, SecurityReport, etc.
│   ├── contracts/factory-ports.ts    — SpecialistExecutionPort (reused from
│   │                                   loop-engine), ToolExecutionPort, ClockPort,
│   │                                   WorkspacePort, DeploymentAdapterPort,
│   │                                   VersionControlPort, FactoryEnginePorts
│   ├── domain/
│   │   ├── SpecificationEngine.ts    — Phase 1 (no uncontrolled interpretation)
│   │   ├── ArchitectureEngine.ts     — Phase 2 (technology-aware, not locked)
│   │   ├── TaskGraphBuilder.ts       — Phase 3 (application task graph)
│   │   ├── ExecutionPolicy.ts        — Phase 9 (classified actions + grants)
│   │   ├── FileOperationLayer.ts     — Phases 5–6 (READ→PLAN→PATCH→TEST→REVIEW)
│   │   ├── BlueprintService.ts       — Phase 7 (source of truth)
│   │   ├── PlanPreviewService.ts     — Phase 8 (approve-or-modify gate)
│   │   ├── ValidationPipeline.ts     — Phase 10 (deterministic gates + auto-fix)
│   │   ├── SecurityReviewer.ts       — Phase 12 (CRITICAL/HIGH block)
│   │   ├── UIQualityEvaluator.ts     — Phase 11 (production-quality bar)
│   │   ├── EconomicsTracker.ts       — Phase 17 (tokens/cost/cache/iterations)
│   │   ├── DeploymentAbstraction.ts  — Phase 16 (vendor-neutral)
│   │   ├── VersionControlService.ts  — Phase 15 (never auto-push)
│   │   ├── ApplicationRegistry.ts    — Phase 13 (DRAFT→…→ARCHIVED)
│   │   └── FactoryEngine.ts          — the orchestrating engine
│   ├── infrastructure/
│   │   ├── InMemoryWorkspace.ts      — Phase 14 (isolated, contained, rollback)
│   │   └── adapters.ts               — Local/Vercel deployment + InMemory VCS
│   ├── application/
│   │   ├── FactoryDTO.ts             — typed public contract (DTO boundary)
│   │   ├── FactoryMapper.ts
│   │   └── FactoryApplicationService.ts — factory.* execution contract
│   ├── catalog/
│   │   ├── archetypes.ts             — 3 controlled archetypes + specialist roles
│   │   └── generator.ts              — deterministic typed project files
│   └── index.ts
```

## 4. Key contracts

### 4.1 ApplicationSpecification (Phase 1)

Captures name, purpose, target users, user journeys, features, functional +
non-functional requirements, UI/backend/database/auth/authz requirements, AI
capabilities, RAG requirements, integrations, deployment target, security +
performance requirements, budget, constraints, acceptance criteria, and
`unresolved` requirements (inferred only when safe — otherwise marked
unresolved, never silently assumed).

### 4.2 ApplicationArchitecture (Phase 2)

Frontend / backend / database / authentication / authorization / AI layer /
RAG layer / tool layer / API layer / testing / deployment — technology-aware,
not vendor-locked (e.g. restaurant app → Next.js frontend, existing VedMoulya
API/runtime backend, Postgres, existing approved auth, VedMoulya AI Runtime,
VedMoulya RAG, supported deployment target).

### 4.3 ApplicationTaskGraph → LoopTaskGraph (Phase 3)

`TaskGraphBuilder` produces an application-specific task graph (requirements →
architecture → data model → API contract → UI design → implementation →
testing → security → performance → build → final validation, with parallel
waves where safe). `FactoryEngine.toLoopGraph` maps it onto the EPIC-006
`LoopTaskGraph` — **the frozen LoopEngine executes the build loop**, so the
factory genuinely reuses EPIC-006 (bounded, critiqued, evidence-checked)
rather than duplicating it.

### 4.4 ExecutionPolicy (Phase 9)

```
READ_ONLY → allowed          SAFE_WRITE → controlled
DESTRUCTIVE_WRITE → blocked unless explicitly authorized
NETWORK / DATABASE / CODE_EXECUTION → blocked by default
SECRET_ACCESS → prohibited unless explicitly configured
DEPLOYMENT → requires explicit authorization
```

Every file operation is classified (`classifyFileOperation`) and the workspace
refuses anything not granted by the policy.

### 4.5 WorkspacePort (Phase 14)

Isolated per-application workspace: root containment (no `..`, no absolute
host paths), policy enforcement, rollback capture before destructive ops, and
a full audit trail of `FileOperation` records (path, kind, reason, originating
task, validation status). The gateway provides a `workspaceFactory` so every
application gets its **own** workspace.

### 4.6 FactoryEnginePorts

`specialist` (the SAME port the loop engine uses — implemented in the gateway by
`AIOrchestratorSpecialistPort` over the frozen runtime), `tools`, `clock`,
`workspace`, `policy`, `deployments`, `versionControl`. **The factory never
imports a provider SDK and never executes shell/filesystem/network operations
outside these ports.**

## 5. Reuse map (what was reused, what was built)

| Capability                   | Source                                          | Action                           |
| ---------------------------- | ----------------------------------------------- | -------------------------------- |
| Specialist execution         | `AIOrchestratorSpecialistPort` (frozen runtime) | REUSE                            |
| Bounded generation loop      | EPIC-006 `LoopEngine`                           | REUSE (pre-built graph)          |
| Critique / evidence          | `CriticEvaluator` + runtime Evidence-First      | REUSE                            |
| Secure tools                 | ToolRuntime allowlist                           | REUSE                            |
| Clock                        | `SystemClock` (loop-engine)                     | REUSE                            |
| Auth/IDOR/rate limits        | gateway middleware                              | REUSE (inherited by `factory.*`) |
| Application layer            | `@vedmoulya/app-factory`                        | BUILD (differentiator)           |
| Deterministic generator      | `catalog/generator.ts`                          | BUILD                            |
| Controlled file ops + policy | domain layer                                    | BUILD                            |
| Deployment + VCS abstraction | adapters                                        | BUILD (wrapping future vendors)  |

## 6. Gateway wiring (services/api)

- `ApiApplicationService` constructs `FactoryApplicationService` with the same
  `AIOrchestratorSpecialistPort(this.ai)` + `createLoopToolPort()` the loop
  uses, `SystemClock`, `DEFAULT_EXECUTION_POLICY`, the safe
  Local/Vercel deployment adapters, the in-memory VCS journal, and a
  per-application `workspaceFactory`.
- `RouterRegistry` registers the `factory` namespace: `create`/`build`/`deploy`
  are heavy-tier; `approve`/`status`/`getDetail`/`list`/`vc*` are standard-tier.
  Every procedure is behind auth + IDOR + rate-limit middleware (Phase 10
  security inheritance).
- DTO boundary: internal engine details (ports, execution internals) are never
  exposed — `FactoryDTO` is the contract.

## 7. Isolation guarantees

- **Cross-application contamination:** prevented by construction (per-app
  workspaces, root-relative paths).
- **Uncontrolled execution:** none — the policy blocks NETWORK/DATABASE/
  CODE_EXECUTION by default, and the workspace blocks any non-granted write.
- **Uncontrolled deployment:** none — `authorized: false` is always blocked;
  VCS operations never push.
- **Uncontrolled AI:** the generation loop is bounded by the EPIC-006 budgets
  (iterations, tokens, cost, latency, provider calls, tool calls) and always
  terminates with an explicit reason.
