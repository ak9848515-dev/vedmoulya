# SPRINT-032 — ROADMAP: World Model & Business Operating System

> VedMoulya — World Model & Business Operating System
> Status: 🟢 IMPLEMENTED + TESTED (composition sprint — zero new engines)
> Verified from source 2026-08-14.

---

## 1. Mission

Evolve VedMoulya from an intelligent assistant into a **controlled AI operating
system** that can represent:

1. the user · 2. the user's work · 3. businesses · 4. workflows ·
2. opportunities · 6. AI capabilities · 7. providers · 8. markets ·
3. tasks · 10. outcomes · 11. economic value

— and connect them into ONE coherent intelligence fabric. **This is NOT a
request to build a new "world model AI engine".** The repository already
contains the Brain, Proactive Intelligence, the Intelligence Fabric, Voice,
Execution, Approval, Memory, Scheduler, Notification, CostLedger, Provider
Registry, Verification, Outcome infrastructure and the Autonomy Policy.
SPRINT-032 **composes** those capabilities.

**Core principle:** VedMoulya does not need to know everything. It needs to
know WHAT MATTERS, WHY IT MATTERS, WHAT CAN BE DONE, WHAT IT WILL COST, WHAT
COULD GO WRONG, WHAT AI CAPABILITY IS BEST, WHAT REQUIRES HUMAN AUTHORIZATION
and WHAT HAPPENED AFTERWARD.

---

## 2. Verified dependency / composition map (from source)

| Capability                  | Verified implementation                                                                                                              | Reuse for SPRINT-032                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| Brain (tasks/opportunities) | `packages/brain` `BrainApplicationService.listTasks/listOpportunities` (owner-scoped)                                                | world graph nodes (task/opportunity)          |
| Opportunity assessor        | `packages/proactive` `BusinessOpportunityAssessor` (research/score only, never spends)                                               | opportunity economics BASE assessment         |
| Action classification       | `packages/proactive` `ActionClassPolicy` (A/B/C/D over frozen `SENSITIVE_ACTIONS`)                                                   | human-vs-AI responsibility boundary           |
| Intelligence Fabric         | `packages/intelligence-fabric` `IntelligenceFabricService` — `select` (advisory), `validateWorkflow` (bounds), `costPort` (measured) | advisory workers + bounded decomposition      |
| Control plane (SPRINT-031)  | `packages/control-plane` `OpportunityLifecycle` + `AutonomySettings` + `EmergencyStop`                                               | opportunity lifecycle + autonomy posture      |
| Cost measurement            | `CostLedger` (trace spine) via `FabricCostPort`                                                                                      | cost snapshot in overview/pipeline            |
| Persistence                 | `@vedmoulya/core` `WriteThroughDocumentStore` family                                                                                 | owner-scoped world stores (mirror + Postgres) |
| Identity                    | gateway identity service                                                                                                             | owner scoping                                 |
| Approval / execution        | Brain `approve` + execution bridge + `RunBudgetGuard` (frozen)                                                                       | NOT duplicated — world never authorizes       |

## 3. What SPRINT-032 adds (composition only)

1. **`packages/world-model`** — a narrow COMPOSITION layer:
   - `WorldGraph` — bounded owner-scoped typed graph over EXISTING entities
     (provenance-required observations, stable-key idempotency, closed
     relation vocabulary, FIFO bounds, bounded paginated queries).
   - `BusinessUnitValidator` — configurable business units (identity,
     purpose, target customer, offerings, workflows, opportunities, costs,
     revenue, KPIs, automation level, AI capabilities, human responsibilities,
     approval requirements). NEVER hard-coded businesses, NEVER assumed
     profitable.
   - `OpportunityEconomics` — evidence-only opportunity economics: 16-factor
     breakdown with every factor exposed, advisory composite score (never
     objective truth), zero/low-capital classification (₹0 / ₹1000 / ₹5000 /
     ₹10000 / ₹25000 → NO_COST / LOW_COST / CAPITAL_REQUIRED / UNKNOWN).
   - `AIWorkforce` — provider-neutral role abstraction (ROLE ≠ MODEL ≠
     PROVIDER ≠ AGENT) + advisory worker suggestions through the Intelligence
     Fabric; workers can NEVER escalate authority (structural).
   - `WorkflowFactory` — generic business workflows + BOUNDED decomposition
     validated against the existing `WorkflowBounds` (depth ≤ 8 · tasks ≤ 24 ·
     fan-out ≤ 8 · calls ≤ 64 · cost ≤ $5 · time ≤ 600 s).
   - `HumanAIBoundary` — responsibility classification over the existing
     ActionClassPolicy (AI_ALLOWED / APPROVAL_REQUIRED / HUMAN_REQUIRED).
   - `WorldSignalSourcePort` — interface-only for external world data
     (market trends, AI releases, pricing changes, …); no live source ships,
     so the honest status is UNAVAILABLE (never SUCCESS).
2. **Owner-scoped persistence** for the world representation (in-memory +
   Postgres write-through, wired into the persistence bundle).
3. **Gateway `world.*` namespace** — 19 procedures (overview / graph.* /
   businessUnits.* / opportunities.* / workforce.* / workflow.* /
   signals.list / boundary.classify) — auth + rate tier + central IDOR + zod.
4. **Minimal UI** — `WorldPanel` (MY WORLD) in the AICompanion using the
   existing design system: bounded snapshot + opportunity pipeline with
   capital-budget filters + honest external-signal status.
5. **Structural tests** proving no authority bypass (no approve/spend/execute
   surface, no memory promotion, no escalation).

## 4. Explicitly NOT built (zero-new-engine policy)

- No `WorldEngine` / `KnowledgeGraphEngine` / `BusinessEngine` /
  `OpportunityEngine` / `WorkforceEngine` / `MarketEngine`.
- No universal knowledge graph, no internet scraping, no fabricated world
  facts (observations REQUIRE provenance).
- No new approval authority — the Brain `approve` remains authoritative.
- No new budget engine — `CostPolicyGuard` + `RunBudgetGuard` remain
  authoritative.
- No new provider selection — the Fabric remains advisory; the registry stays
  the only catalog.
- No automatic business launch, no autonomous execution, no 100 fake AI
  agents — the workforce is a ROLE abstraction with advisory bindings only.
- No memory promotion — observations are interaction artifacts with
  provenance; nothing here writes preferences/outcomes/learning.

## 5. Acceptance gates (verified)

1. Repository architecture audited ✅ (`SPRINT-032_WORLD_MODEL.md`)
2. Existing engines reused ✅ (ports over Brain / Proactive / Fabric / Control)
3. No duplicate intelligence engine created ✅
4. World representation bounded + owner-scoped ✅
5. Business units configurable ✅
6. Opportunity economics represented ✅
7. AI workforce abstraction provider-neutral ✅
8. Workflow decomposition bounded ✅
9. Intelligence Fabric reused ✅ (select + validateWorkflow + costPort)
10. CostLedger reused ✅ (via FabricCostPort snapshot)
11. Approval remains authoritative ✅ (structural tests)
12. External-source uncertainty explicit ✅ (UNAVAILABLE never SUCCESS)
13. Memory promotion controlled ✅ (structural tests)
14. Security tests pass ✅
15. Full test suite passes ✅
16. Typecheck passes ✅
17. Lint passes ✅
18. Build passes ✅
19. Documentation synchronized ✅
20. No secrets committed ✅

## 6. Honest status vocabulary

IMPLEMENTED · TESTED · MOCKED · OPERATOR-REQUIRED · PARTIAL · FUTURE.
"COMPLETE" is never claimed for something only documented. SPRINT-032
explicitly does NOT claim: global world awareness, unlimited AI providers,
guaranteed business revenue, a fully autonomous company, 100 autonomous
employees, or real-time market intelligence.
