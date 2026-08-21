# SPRINT-032 — WORLD MODEL: The VedMoulya World Graph

> The minimum useful world representation required to make better decisions
> for the user — NOT a universal knowledge graph, NOT a scrape of the
> internet. Every stored fact is evidence-backed with provenance.

---

## 1. What the world model is NOT

- ❌ Not a database of every fact about every person/company on Earth.
- ❌ Not a new intelligence engine.
- ❌ Not a replacement for the Brain / Memory / Proactive / Fabric.
- ❌ Not an autonomous market-research crawler.

## 2. What it IS

A **bounded, owner-scoped typed index over the existing estate**. It maps the
concepts the platform already manages into typed nodes and typed edges so the
system can answer "how is this opportunity connected to my goals, capabilities
and providers?" without re-deriving anything.

### Concept map (verified against source)

| Concept        | Existing source                                            | World node type    |
| -------------- | ---------------------------------------------------------- | ------------------ |
| USER           | gateway identity / owner                                   | `user`             |
| GOALS          | `goals` package (GoalUnderstandingService)                 | `goal`             |
| PROJECTS       | `context-fabric` / `app-factory` projects                  | `project`          |
| SKILLS         | `learning-intelligence` / career                           | `skill`            |
| WORK           | Brain tasks / execution bridge runs                        | `work`             |
| PREFERENCES    | `PreferenceLedger` (explicit vs inferred)                  | `preference`       |
| PERMISSIONS    | Brain `SENSITIVE_ACTIONS` / ActionClassPolicy              | `permission`       |
| TASKS          | Brain `BrainTask`                                          | `task`             |
| WORKFLOWS      | SPRINT-032 `BusinessWorkflow` / proactive automation       | `workflow`         |
| OUTCOMES       | Brain `BrainOutcomeMemory` / outcome verdicts              | `outcome`          |
| OPPORTUNITIES  | Brain `Opportunity` + control `OpportunityLifecycleRecord` | `opportunity`      |
| BUSINESS       | SPRINT-032 `BusinessUnit` (configurable)                   | `business_unit`    |
| PROBLEMS       | `ProblemDefinition` (goals)                                | `problem`          |
| SERVICES       | capability marketplace offerings                           | `service`          |
| CUSTOMERS      | user-stated (evidence-carrying)                            | `customer`         |
| REVENUE / COST | CostLedger + user-stated (evidence-carrying)               | `revenue` / `cost` |
| RISK           | Opportunity risk / proactive risk levels                   | `risk`             |
| CAPABILITY     | capability marketplace `CapabilityId` catalog              | `capability`       |
| PROVIDER       | provider registry                                          | `provider`         |
| MODEL          | provider registry model catalog                            | `model`            |
| ROLE / WORKER  | SPRINT-032 `RoleSpec` / `WorkerSpec` (advisory)            | `role` / `worker`  |
| SIGNAL         | SPRINT-032 `WorldSignal` (interface-only)                  | `signal`           |

## 3. The graph contract (`WorldGraph`)

- **Entities** — typed nodes: `{ id, ownerId, type, label, stableKey,
externalId?, properties?, evidence[], provenance? }`.
- **Relations** — typed edges: `{ id, ownerId, type, fromType, fromId, toType,
toId, note?, provenance? }` with a CLOSED vocabulary of 25 shapes
  (e.g. `has_goal`, `requires_capability`, `served_by_provider`,
  `generates_revenue`, `evidence_of`).
- **Owner scoping** — every entity/relation is keyed by owner; a foreign
  owner can never address another owner's rows (query-level PKs + gateway
  IDOR middleware).
- **Provenance discipline** — observations REQUIRE a source
  (`brain-task`, `brain-opportunity`, `user-statement`, …) and a status
  (`VERIFIED` / `ESTIMATED` / `UNKNOWN`). No provenance → refused.
  No evidence → refused.
- **Idempotency** — `stableKey = owner:type:externalId`; re-observing the
  same external entity UPSERTS, never duplicates.
- **Bounded** — ≤ 200 entities / ≤ 500 relations per owner (FIFO eviction,
  oldest first). Queries are bounded + paginated; the graph is never loaded
  whole (no O(N²) world scans).

## 4. Business operating model

A business is represented as a system:

```
PROBLEM → CUSTOMER → SOLUTION → DELIVERY → COST → REVENUE → OUTCOME
```

`BusinessUnit` is a **configurable** record — the examples in the mission
(AI solutions, app builder, automation services, content/YouTube,
advertising, data services, AI consulting, digital products) are starter
keys, never hard-coded businesses and NEVER assumed profitable. Each unit
carries identity, purpose, target customer, offerings, workflows,
opportunities, costs, revenue, KPIs, automation level (0–5), AI
capabilities, human responsibilities and approval requirements.

## 5. Memory discipline

The world representation NEVER auto-promotes into permanent memory:
recommendations, provider outputs, AI guesses and unverified external facts
stay as interaction artifacts with provenance. Promotion would require the
existing evidence/authority rules (SPRINT-025 learning, PreferenceLedger).
Structural tests assert the world model has no preference/outcome/learning
write surface.

## 6. Performance

- Bounded per-owner stores with FIFO eviction.
- Bounded + paginated queries (limit/offset; type filters).
- The overview is a slice, never the whole graph.
- Postgres stores use the shared `WriteThroughDocumentStore` (mirror-first,
  async write-through, boot hydrate, shutdown flush) — reads never touch the
  database.

## 7. Deliverable

`packages/world-model` — types → contracts (narrow ports) → domain →
infrastructure (in-memory + Postgres) → application (`WorldModelService`),
wired into the gateway persistence bundle + `world.*` namespace.
