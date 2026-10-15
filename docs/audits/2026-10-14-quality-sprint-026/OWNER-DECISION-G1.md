# Owner Decision Record — G1: Mission Routing Intelligence Composition

**Document:** Owner decision record (architecture)
**Gap:** G1 — "Mission AI routing does not use the enterprise intelligence the canonical doc attributes to it"
**Sources:** Sprint 023 §4 · Sprint 025 §1 · `docs/architecture/CANONICAL-MISSION-ARCHITECTURE.md` §5.1
**Owner required:** Platform / AI-runtime owner
**Status:** OPEN — awaiting owner decision. **No behaviour change was made.**
**Date raised (UTC):** 2026-10-14 (Sprint 026)

---

## 1. What is actually true today (verified, source-backed)

1. Production composes `MissionService` **without** `runtimeOptions` and **without** an injected
   orchestrator:

   ```ts
   // services/api/src/services/ApiApplicationService.ts:2904
   new MissionService({
     workspaceRoot,
     sql,
     requireDurablePersistence,
     credentials,
     aiObservability,
   });
   ```

   `grep -n runtimeOptions services/api/src/services/ApiApplicationService.ts` → **0 matches**
   (re-verified in Sprint 026).

2. `MissionService.createRuntime()` therefore lets `MissionRuntime` create its **own**
   `AIOrchestrationService`, and for a self-created orchestrator wires the **deterministic** ports:

   ```
   orchestrator.configureIntelligence(createOrchestratorRoutingPorts(orchestrator))
   // packages/mission-runtime/src/composition/MissionRuntime.ts:285
   ```

   `createOrchestratorRoutingPorts` (`OrchestratorRoutingPorts.ts`) deliberately supplies a **neutral**
   profile: `NEUTRAL_BENCHMARK_SCORE = 50`, `NEUTRAL_COST_PER_1K = 0`, `balanced` strategy, no measured
   evidence, no `ExecutionHealthService` verdicts, no unavailable-model exclusion, no RAG.

3. The **Ask/gateway** path uses the enterprise ports via `this.aiIntelligence`
   (`createProviderIntelligencePort` + `createExecutionStrategyPort` + `createRagRetrievalPort`)
   in `services/api/src/infrastructure/RuntimePorts.ts`
   (`ApiApplicationService.ts:1443-1478`).

4. Both paths share the **same frozen** `ProviderRoutingAdvisor` and the same retry/fallback,
   mock-safety, and evidence gates. The difference is **input data only**, not authority.

**Determination (Sprint 025 §1.1): case (c)** — the integration seam exists
(`MissionRuntimeOptions.orchestrator`, `MissionRuntime.ts:125`; reachable via
`MissionServiceOptions.runtimeOptions`), the two port contracts are identical, but the API composition
never uses it. The enterprise routing capability is genuinely absent from Mission execution; this is
**not** an intentional permanent separation.

---

## 2. The decision to be made

Choose **one**:

### Option A — Compose the enterprise intelligence into Mission execution

Inject the existing `aiIntelligence` ports into the Mission runtime's **shared** orchestrator
(`MissionRuntimeOptions.orchestrator`) **and** add a user-orchestrator intelligence hook so the per-user
orchestrators (`MissionRuntime.ts:312`) use the same authority.

- **Pros:** Missions get measured evidence, live execution-health gating, unavailable-model exclusion,
  enterprise strategy and RAG — matching the canonical document's intent.
- **Cons / behavioural implications (enumerated in Sprint 025 §1.3):**
  1. Live health verdicts can **exclude a provider missions use today** (`UNAVAILABLE` folds into the
     `healthy` gate) → a working mission could become `WAITING_FOR_PROVIDER`. **User-visible regression
     surface, not a strict improvement.**
  2. `measured` evidence can **reorder** candidates → different provider, cost and quality for identical
     missions.
  3. Enterprise candidates come from the provider **registry**; Mission adapters come from
     `registerPlatformProviders` — the sets can diverge, so the advisor's `selected` provider may not be
     an executable candidate.
  4. Only the **shared** orchestrator is fixed by injecting one; the per-user orchestrators need a
     **contract addition**, or one deployment runs two different routing authorities.
- **Blast radius:** `MissionServiceOptions` + `MissionRuntimeOptions` + `ApiApplicationService`; changes
  provider selection for **every** mission. Exceeds a "smallest safe change".

### Option B — Accept deterministic Mission routing as intended

Keep the deterministic `OrchestratorRoutingPorts.ts` as the deliberate Mission-path profile; keep the
canonical document as corrected in Sprint 025 §5.1 (Mission spine = deterministic; Ask = enterprise).

- **Pros:** Zero behavioural risk; no regression surface; matches the _documented fallback_ role.
- **Cons:** Missions do not benefit from measured evidence / health gating / RAG.

---

## 3. Recommendation

**Option B for this cycle** (no code change), because:

- The evidence proves a _composition_ gap, but the only reachable code change (injecting an orchestrator)
  is exactly the "silently switch provider-selection behaviour" the sprint briefs forbid.
- It can newly exclude providers missions use today and cannot cover the per-user orchestrators without a
  new contract — i.e. it is not safely closable as a smallest change.
- The canonical document has already been corrected to state the **true** wiring (Sprint 025 §4), so the
  "false VERIFIED edge" defect is closed.

If the owner prefers Option A, it must be delivered as an **explicit, tested, opt-in switch** with:
a user-orchestrator intelligence hook, a contract test proving both authorities agree, and a regression
suite asserting no currently-usable provider becomes `WAITING_FOR_PROVIDER` purely from the switch.

---

## 4. Closure requirement

| Field                       | Value                                                                                              |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| Owner                       | Platform / AI-runtime                                                                              |
| Blocked on                  | An explicit product/architecture decision (A or B)                                                 |
| If A                        | New contract for per-user orchestrator intelligence + injection behind a switch + regression suite |
| If B                        | No action; canonical document already correct                                                      |
| Evidence to attach on close | The chosen option, the file(s) changed (if A), and the executed test command(s)                    |

**This record does not itself close G1; it converts an ambiguous "PARTIAL" into a precise, owned decision.**
