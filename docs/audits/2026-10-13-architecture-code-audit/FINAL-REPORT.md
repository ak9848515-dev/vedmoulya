# VedMoulya Architecture-to-Code Audit — Sprint 020A-1

**Date (UTC):** 2026-10-13
**Branch:** `main` · **HEAD:** `a124274b0d1fa91f361e0a5775e144658405913a`
**Mode:** READ-ONLY. No source edits, no commits, no pushes, no deployments,
no credential/database changes, no live provider calls.
**Diagram status:** No diagram image file exists anywhere in the repository
(`docs/audits/2026-10-13-quality-sprint-020A/` holds only `baseline-git.txt`;
no `.png/.svg/.drawio/.mmd/.mermaid` asset found). This audit therefore uses
the Sprint 020A-1 brief's **named component and arrow lists** as the diagram
source of truth.

---

## 1. Executive verdict

**The diagram is a conceptual composite, not a picture of the active
production system.** Most boxes map to real files, but most arrows do not
describe the production Mission path.

- **Active production spine = canonical Mission lifecycle**, not the
  diagram's factory → generator → refinement spine:
  Ask/Mission UI → `mission.*` → `MissionService` → `createMissionRuntime()`
  → `MissionControllerService` → planning ports → `AgentExecutionService`
  (via `AIOrchestrationAgentPort`) → `AIOrchestrationService` →
  `ProviderRoutingAdvisor` (+EI-002/EI-004/RAG ports) → provider adapter →
  ToolRuntime → `verifyAgainstPolicy` → checkpoint → execution memory → UI
  status poll. Proven by `mission-runtime-e2e.test.ts` (15/15, re-run today).
- **Factory/generator/refinement = REAL but SEPARATE, dormant-from-Mission
  system** (`packages/app-factory`, gateway `factory.*`, UI
  `/applications`). It builds scaffolded app projects from app ideas; it is
  not on the Mission user-goal-to-result path.
- **Brain = reusable intelligence/decision capability, not the Mission
  executor** (`BrainApplicationService` + `OutcomePriorityEngine`, gateway
  `brain.*`, 68/68 tests pass). The Mission loop does not call Brain to
  execute objectives.
- **Providers = infrastructure** (adapters + `AIOrchestrationService`
  routing) — the diagram's layering here is accurate.
- **No second lifecycle should be introduced.** The repo holds four
  loop-like engines (controller / loop-engine / adaptive-loop /
  agent-execution); production Mission wires only controller + planning +
  agent-execution, with an explicit comment excluding adaptive-loop
  (`MissionRuntime.ts:22-25`). The diagram collapses these into one
  refinement box — its most misleading simplification.

**The diagram fails as a depiction of the active system.** Component truth
high; wiring truth low.

---

## 2. Component-by-component implementation matrix

Status: **ACTIVE** = on the real Mission journey · **WIRED-SIDE** =
gateway-wired but not on Mission path · **DORMANT** = implemented, not
called by active journey · **ABSENT** = not found · **RENAMED** = exists
under a different name.

### 2.1 User experience

| Diagram box         | Actual source                                                                                                                     | Symbol                                                | Status                                 | Real caller → callee                                                                                              | Bootstrap                                                     | On journey | Tests                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------- |
| Web app + entry     | `apps/web/src/app/page.tsx`, `autonomous-builder/page.tsx`, `applications/page.tsx`, `components/AICompanion.tsx`                 | default pages; `AICompanion`                          | ACTIVE                                 | `AskAIInput` → UI store → `handleSend` → `classifyAskIntent` → `ai.stream` XOR `mission.createAndRun`             | tRPC `api.*` hooks (`lib/api-client.ts`)                      | YES        | `ux08-ask-entrypoints`, `ask-vedmoulya` 15/15, `AICompanion` 9/9, `missions-ux04` 35/35 |
| Idea → goal/request | `lib/ask-vedmoulya.ts` (`missionDraftFromRequest`, `isGoalLikeRequest`) + `RequirementsRouter` → `RequirementsApplicationService` | draft helpers; `RequirementsApplicationService.start` | ACTIVE (draft) + WIRED-SIDE (sessions) | goal text → draft → `mission.createAndRun`; idea → `requirements.start→…→approve→handoffToFactory→factory.create` | `RouterRegistry` (`mission.*`, `requirements.*`, `factory.*`) | draft YES  | ask-vedmoulya 15/15; `ProductIntelligenceEngine` 23                                     |

### 2.2 Product creation

| Diagram box                  | Actual source                                                                                                                                   | Symbol              | Status     | Real caller → callee                                                                                                    | Bootstrap                                         | On journey   | Tests                                            |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------ | ------------------------------------------------ |
| Product/task requirements    | `packages/requirements/.../RequirementsApplicationService.ts` + `ProductIntelligenceEngine.ts`; `packages/goals/.../GoalsApplicationService.ts` | services as named   | WIRED-SIDE | `RequirementsRouter` → service → engine → store; `handoffToFactory` composes `factory.create`                           | `ApiApplicationService`; `RouterRegistry`         | NO (Mission) | `ProductIntelligenceEngine` 23, session-store 10 |
| Factory (`FactoryEngine.ts`) | `packages/app-factory/src/domain/FactoryEngine.ts` — EXISTS                                                                                     | `FactoryEngine`     | WIRED-SIDE | `FactoryRouter.create/approve/build` → `FactoryApplicationService` → `FactoryEngine` → `generateProject` + `LoopEngine` | `ApiApplicationService`; `factory.*` (heavy tier) | NO (Mission) | `FactoryEngine`, edge-cases, persistence suites  |
| Generator (`generator.ts`)   | `packages/app-factory/src/catalog/generator.ts` — EXISTS                                                                                        | `generateProject()` | WIRED-SIDE | `FactoryEngine.ts:56` import → deterministic templates → `ValidationPipeline`                                           | via factory                                       | NO (Mission) | factory suites; hermetic by header               |

### 2.3 Execution runtime

| Diagram box                       | Actual source                                                                                          | Symbol                                                            | Status                            | Real caller → callee                                                                                                                    | Bootstrap                                               | On journey   | Tests                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------ | --------------------------------------------- |
| Refinement loop (`LoopEngine.ts`) | `packages/loop-engine/src/domain/LoopEngine.ts` — EXISTS                                               | `LoopEngine` + `RefinementPlanner`/`CriticEvaluator`/`LoopBudget` | WIRED-SIDE + DORMANT-from-Mission | `LoopRouter` → `LoopApplicationService` → `LoopEngine`; `FactoryEngine` reuses with pre-built graph. **Mission never instantiates it.** | `ApiApplicationService`; `loop.*`                       | NO (Mission) | `LoopEngine`, `LoopApplicationService` suites |
| Adaptive (`adaptive-engine.ts`)   | `packages/adaptive-loop/src/domain/adaptive-engine.ts` — EXISTS                                        | `AdaptiveEngine` + `AdaptiveLoopService`                          | DORMANT-from-Mission              | `AdaptiveLoopService` → engine; **no production caller**; Mission explicitly excludes it (`MissionRuntime.ts:22-25`)                    | package-internal; no `adaptive.*` router                | NO           | `adaptive-engine`, service, guard suites      |
| Agent execution                   | `packages/agent-execution/src/domain/AgentExecutionEngine.ts` + `application/AgentExecutionService.ts` | both as named                                                     | ACTIVE                            | `MissionRuntime.ts:31` → `AgentExecutionAdapter` → service → `AIOrchestrationAgentPort` → `orchestrate()`                               | `createMissionRuntime()`; `MissionService.getRuntime()` | YES          | `execution-engine` 21/21; runtime e2e 15/15   |

---

## 3. Exact end-to-end call graph (REAL user-goal-to-result path)

Mission journey (production — NOT the diagram's factory path):

```
1. UI — page.tsx (AskAIInput) / AICompanion.handleSend()
   → classifyAskIntent() / isGoalLikeRequest()
2. ANSWER: api.ai.stream (AIRouter) → AIOrchestrationService.stream()
   ACTION: useMissionCreateAndRun() → api.mission.createAndRun (MissionRouter)
3. MissionRouter.ts → MissionService.getRuntime() → createMissionRuntime()
   [mission-runtime/composition/MissionRuntime.ts]
4. MissionControllerService [mission-controller/application]
   → DevelopmentObjectiveSelector (FsRepositoryInspector)
   → MissionPlanningAdapter → PlanningApplicationService/PlannerService
     (AIOrchestrationPlannerPort → AIOrchestrationService)
   → AgentExecutionAdapter → AgentExecutionService [agent-execution]
     (AIOrchestrationAgentPort.execute() → AIOrchestrationService.orchestrate())
5. AIOrchestrationService [services/src/ai] (+ AIDomainService, AIRequestFactory)
   → ProviderRoutingAdvisor (+ EI-002/EI-004/RAG ports from RuntimePorts.ts)
   → ProviderAdapter.execute() [services/orchestrator] → ToolRuntime registry
6. verifyAgainstPolicy [agent-execution/domain/verification.ts] → checkpoint
   (InMemory/Postgres stores) → ExecutionMemoryService.ingestRun()
   → experience-optimization (advisory only)
7. Persistence: PostgresMissionStores (+ in-memory fallbacks)
8. UI: useMissionStatus() poll → MissionStatusView → MissionOverview /
   MissionResult / ObjectiveTimeline / MissionActivity / LiveMissionView
```

Factory journey (diagram's path — separate product, `/applications`):

```
factory.create (FactoryRouter) → FactoryApplicationService → FactoryEngine
(UNDERSTAND→SPECIFY→ARCHITECT→PLAN) → generateProject() [catalog/generator.ts]
→ LoopEngine (pre-built graph) → ValidationPipeline → approve → build →
package → deploy/export (explicit authorization only)
```

Brain journey (reusable intelligence — never executes Mission objectives):

```
brain.* (BrainRouter) → BrainApplicationService → IntentInterpreter →
ModeSelector → candidates (marketplace/providers/ai-world/memory ports) →
ProviderRoleAssigner → ParallelPlanner → approval → execution port →
ConflictDetector → CriticStrategy → OutputAssembler → OutcomeEvaluator /
OutcomePriorityEngine → DecisionRecorder → LearningSignals
```

Legacy/alternate loops (none on Mission path; no second lifecycle to add):
loop-engine standalone (`loop.*`), adaptive-loop (no gateway route),
orchestration-fabric / ecosystem workflows, execution-orchestrator / bridge
/ strategy surfaces. Mission runtime wires controller + planning +
agent-execution ONLY.

---

## 4. Arrow-by-arrow verification matrix

| # | Diagram arrow | Verdict | Evidence |

---

## 5. Active, dormant, duplicate, missing

- **ACTIVE (Mission):** Ask/Mission UI · `MissionRouter`/`MissionService` ·
  `createMissionRuntime` · `MissionControllerService` · planning ports ·
  `AgentExecutionService/Engine` · `AIOrchestrationService` +
  `AIDomainService`/`AIRequestFactory` · provider adapters · ToolRuntime ·
  verification · checkpoints · execution memory · status-poll UI.
- **WIRED-SIDE (real, not Mission):** requirements · app-factory+generator ·
  loop-engine service · Brain+OutcomePriorityEngine · ai-world · knowledge ·
  intelligence pipelines · execution-orchestrator/bridge/strategy ·
  orchestration-fabric · ecosystem · goals.
- **DORMANT (from Mission):** adaptive-loop (no route, no composition);
  LoopEngine-as-Mission-loop (factory + `loop.*` only).
- **DUPLICATES (scoped, no action — read-only):** 4 loop-like coordinators;
  3 execution coordinators beside the controller; 2 retrieval systems
  (knowledge-graph vs RAG). Header contracts scope each; the diagram hides
  the seams.
- **MISSING:** work-coordination singleton; coordination/orchestration →
  pipeline edges; Mission→Brain execution dependency (correctly absent).

---

## 6. Critical gaps + misleading edges

1. Diagram spine ≠ production spine (factory path is a side product).
2. Four loops collapsed into one box — invites the second-lifecycle
   mistake the code deliberately avoids.
3. Brain mispositioned if read as executor (advisory only for Missions).
4. Routing internals (advisor + EI-002/EI-004/RAG/health gates) absent.
5. Knowledge→RAG conflates sibling stores; verified edge is RAG→runtime.
6. Two coordination→pipeline arrows have no implementation.

---

## 7. Evidence strength

| Claim                      | Strength                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------- |
| Mission e2e                | Integration (`mission-runtime-e2e` 15/15) + unit (controller, execution-engine 21/21) |
| Agent→orchestration→domain | Integration + static import                                                           |
| Factory→generator→loop     | Unit (factory/loop/RAG batch 39/39) + static import                                   |
| Brain + OutcomePriority    | Unit (68/68)                                                                          |
| Adaptive→agent (prod)      | Static-negative → DORMANT                                                             |
| Coordination→pipeline      | Static-negative → MISSING                                                             |
| RAG read/write             | Unit (repository/chunking suites)                                                     |
| Live/browser E2E           | NOT claimed — no live calls, no browser run                                           |

---

## 8. Next actions (severity × dependency)

1. [P0] Publish §3 as the canonical Mission architecture picture. (docs)
2. [P0] Label factory spine "Application Factory (/applications, side)".
3. [P1] Header note marking adaptive-loop DORMANT-from-Mission.
4. [P1] Split intelligence box (knowledge vs RAG vs Brain-outcome vs
   pipeline-catalog); draw verified RAG→orchestrator edge.
5. [P2] Delete/replace the two MISSING arrows with real consumers.
6. [P2] Contract note: Brain advises, never executes objectives.

---

## 9. Checks, limitations, preservation

- **Gate (pre):** `main`, `a124274b…`, dirty tree (~60 mod + ~25 untracked
  incl. 018/019/020A evidence dirs, prior UI edits), 5 stashes (incl.
  `pre-security-baseline-healthprobe`). **Post: nothing reset / cleaned /
  reverted / staged / committed / pushed / deployed / re-credentialed; no
  DB touched.** Only addition: this report directory. Stashes preserved.
- **Commands (all exit 0):** mission-runtime e2e 15/15 · agent-execution
  engine 21/21 · factory+loop+RAG batch 39/39 · brain+priority 68/68 ·
  loop+adaptive engines green. No live providers, no external submits, no
  paid usage, no prod writes. Provider-screen focus failure not
  encountered (those tests not run, per brief).
- **Limits:** no diagram asset in-repo → arrows classified from brief's
  named edge list (flagged, not assumed). Static-negatives rest on
  import/caller + registry inspection, not dynamic tracing. No browser E2E.
  Full typecheck/lint skipped (read-only; unrelated failures untouched).

|---|---|---|---|
| 1 | Product requirements → factory | VERIFIED (side path) | `RequirementsApplicationService.handoffToFactory` → `factory.create`; both routers in `RouterRegistry` |
| 2 | Factory → generator | VERIFIED (side) | `FactoryEngine.ts:56` direct import of `generateProject`; factory tests |
| 3 | Factory → refinement loop | VERIFIED (side) | `FactoryEngine.ts:25` imports `LoopEngine` + `toLoopGraph()` mapping |
| 4 | Adaptive decisions → agent execution | DORMANT | header routes via `AgentAiExecutionPort`, but zero production wiring; Mission explicitly excludes it (`MissionRuntime.ts:22-25`); isolated unit tests only |
| 5 | Agent execution → AI orchestration | VERIFIED (Mission) | `AIOrchestrationAgentPort.ts:30` → `orchestrate()`; composed `MissionRuntime.ts:31`; e2e 15/15 |
| 6a | Work coordination → intelligence pipeline | MISSING | no work-coordination module; no edge into `packages/intelligence` found |
| 6b | Execution orchestration → intelligence pipeline | MISSING | no edge from orchestrator/bridge/strategy into intelligence pipeline; consumed via `IntelligenceRouter` instead |
| 7 | AI orchestration → AI request domain | VERIFIED | `AIOrchestrationService.ts:10-20` direct imports; every call |
| 8 | Knowledge retrieval → RAG repository | PARTIAL | both systems real but SIBLINGS (knowledge-graph vs RAG chunks); verified half is RAG→runtime via `createRagRetrievalPort` (`RuntimePorts.ts:194`) |

**Arrows: 9 assessed → VERIFIED 5 · PARTIAL 1 · DORMANT 1 · MISSING 2 ·
STRUCTURAL ONLY 0 · UNKNOWN 0.**

| Work coordination | NO single module. Nearest: `packages/orchestration-fabric` (`OrchestratorService`, `DependencyGraphService`, `PriorityScheduler`) + `packages/ecosystem` (`WorkflowExecutionService`) | multiple | WIRED-SIDE (split) | `OrchestratorRouter` → service; workflow routes adjacent | `ApiApplicationService` | NO (Mission) | fabric + integration suites |
| Execution orchestration | `packages/execution-orchestrator` + `packages/execution-bridge` (`ExecutionRunService`) + `packages/execution-strategy` | `OrchestratorApplicationService`, `ExecutionRunService` | WIRED-SIDE | `OrchestratorRouter`/`ExecutionBridgeRouter`/`ExecutionStrategyRouter` → services | `ApiApplicationService` | NO (Mission has own controller state machine) | orchestrator + bridge suites |

### 2.4 Intelligence services

| Diagram box                              | Actual source                                                                                                               | Symbol                                               | Status                 | Real caller → callee                                                                                                      | Bootstrap                                         | On journey                                       | Tests                            |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------ | -------------------------------- |
| Task intelligence                        | `packages/brain` (`IntentInterpreter`, `ParallelPlanner`, `DailyOutcomeEngine`) + `packages/goals` + loop-engine decomposer | `BrainApplicationService`, `GoalsApplicationService` | WIRED-SIDE             | `BrainRouter`/`GoalsRouter` → services                                                                                    | `ApiApplicationService`                           | NO (Mission uses `DevelopmentObjectiveSelector`) | Brain 68/68; goals suites        |
| Outcome prioritization                   | `packages/brain/src/domain/OutcomePriorityEngine.ts` — EXISTS                                                               | `OutcomePriorityEngine`                              | WIRED-SIDE             | `BrainApplicationService` → rank daily/opportunity actions                                                                | brain-internal                                    | NO (Mission)                                     | `OutcomePriorityEngine` suite    |
| AI orchestration                         | `packages/services/src/ai/AIOrchestrationService.ts`                                                                        | `orchestrate/stream/explainSelection`                | ACTIVE                 | planning port + agent port + `ai.stream` → `AIRouter` → service → `ProviderRoutingAdvisor` → adapter                      | `ApiApplicationService` + MissionRuntime          | YES                                              | budget + e2e suites              |
| AI World discovery                       | `packages/ai-world/src/domain/DiscoveryOrchestrator.ts` + `application/DiscoveryApplicationService.ts`                      | both as named                                        | WIRED-SIDE             | `AIWorldRouter` → service → orchestrator → sources → store                                                                | `ApiApplicationService` + scheduler               | NO (Mission)                                     | orchestrator + service suites    |
| Knowledge retrieval                      | `packages/knowledge-intelligence/.../KnowledgeApplicationService.ts` + `KnowledgeGraph`                                     | service as named                                     | WIRED-SIDE             | `KnowledgeRouter` → service → graph/rules                                                                                 | `ApiApplicationService`                           | NO (direct)                                      | service suite                    |
| Intelligence pipeline                    | `packages/intelligence/.../IntelligenceApplicationService.ts` + `PipelineBuilderService`                                    | service as named                                     | WIRED-SIDE             | `IntelligenceRouter` → service → engines → `PostgresPipelineRepository`                                                   | `ApiApplicationService`; `ProductionRepositories` | NO (Mission)                                     | service + catalog/builder suites |
| AI request domain (`AIDomainService.ts`) | `packages/ai/src/domain/services/AIDomainService.ts` — EXISTS                                                               | `AIDomainService`                                    | ACTIVE (transitive)    | `AIOrchestrationService.ts:10-20` imports domain service + factory + rules — every orchestrate call                       | `packages/services` composition                   | YES                                              | `DomainLogic` suite              |
| RAG repo + chunks                        | `packages/rag/.../RagRepository.ts` + `RagApplicationService.ts` + `Postgres/InMemoryRagRepository` + `ChunkingService`     | service + repo as named                              | ACTIVE (retrieval leg) | `RagRouter` → service → repo; runtime via `createRagRetrievalPort(rag)` (`RuntimePorts.ts:194`); loop via `RagSearchPort` | `ApiApplicationService`                           | YES (retrieval; ingest off hot path)             | RAG suite 39/39 batch            |

**Components: 17 assessed → ACTIVE 5 · WIRED-SIDE 9 · DORMANT-from-Mission 2
(adaptive-engine, loop-as-Mission-loop) · ABSENT-as-named 1 (work
coordination singleton — RENAMED/distributed).**
