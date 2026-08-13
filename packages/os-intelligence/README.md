# @vedmoulya/os-intelligence

Enterprise Operating System Integration Layer (EPIC-005 / OS-001).

The integration layer that turns the eleven Enterprise Intelligence Engines
(EI-001…EI-010 + INT-001) into **one Enterprise Operating System** — it does
not implement new engines and does not redesign architecture. It integrates,
validates, optimizes and certifies the complete platform:

- **Engine registry** — one canonical catalog of every engine, its package,
  sprint, repository and database table (no duplicated models, no isolated
  engines).
- **Engine dependency matrix** — the package build graph (verified acyclic —
  no circular dependencies) and the runtime consultation graph (the
  integration matrix of who consults whom through narrow port contracts).
- **System health** — a live health pass over every engine port with latency
  measurement, per-engine totals, repository readiness and an **overall OS
  health score**.
- **Pipeline validation** — the 15-stage end-to-end flow
  (Goal → Task Planning → Capability → Knowledge → Memory → Provider →
  Context → Brain → Strategy → Orchestrator → Learning → Knowledge Update →
  Memory Update), every stage validated against the owning engine's live data.
- **Cross-engine validation** — the nine integration pairs (Capability ↔
  Provider, Provider ↔ Context, Context ↔ Knowledge, Knowledge ↔ Memory,
  Memory ↔ Learning, Learning ↔ Brain, Brain ↔ Strategy, Strategy ↔ Execution,
  Execution ↔ Learning).
- **Diagnostics** — engine, dependency, contract, repository, pipeline,
  lifecycle, event-flow, ownership and database-migration checks.
- **Platform validation** — the definitive `validatePlatform` gate used by
  final certification.
- **Performance** — end-to-end and per-engine latency measurement.
- **Health snapshots** — persisted `os_health_registry` snapshots
  (in-memory double + Postgres production repository) for the OS dashboard
  history.

Every engine is consumed through narrow `OSEngines` port contracts satisfied
by the owning engine's application service — the same seam pattern as
`MemoryEngines` (EI-010) and `KnowledgeEngines` (EI-009). No engine is
modified; no logic is duplicated.
