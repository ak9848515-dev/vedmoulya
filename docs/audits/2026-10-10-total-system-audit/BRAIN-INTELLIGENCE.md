# Brain and Intelligence Wiring

## Actual responsibility and path

Mission owns the autonomous understand/plan/execute/verify/learn/continue lifecycle (`packages/mission-controller`). Brain is a reusable decision capability (`packages/brain`); Planning creates bounded plans (`packages/planning`); Agent Execution executes and verifies steps (`packages/agent-execution`); Loop remains a task-graph single-turn engine (`packages/loop-engine`). API composition and mission services call existing engines rather than a newly introduced lifecycle. This matches the prior ownership audit and the brief’s required boundary.

## Evidence observed

- `npm run typecheck` passed at baseline; focused test run passed 302/302 tests across agent-execution, mission-runtime, and provider-experience suites.
- The full suite completed 12,868 tests with one UI fixture failure; this does not directly indicate a Brain failure.
- Historical REVENUE-004A evidence in the previous audit documents a local Ollama request, governed artifact creation, deterministic verification and approval-gated draft. It was not rerun in this baseline.
- Deterministic planning/brain/intelligence benchmark scripts exist and are wired into CI (`.github/workflows/ci.yml`). Their current run status is pending.

## Open questions

- No fresh, instrumented trace correlated raw user intent, assembled context, structured requirements, selected model, provider request, verification criteria, memory write and next objective.
- Learning records exist, but a new outcome demonstrably changing a subsequent decision is not freshly proven here.
- Context relevance, prompt budget behavior, failure repair bounds and runtime model ranking require direct acceptance evidence, not interface presence.
- Full autonomy and long-running execution need clear user-visible waiting/continuation and honest failure states.

## G-17 constraint

`packages/orchestration-fabric` provider routing stays deferred and uncomposed as a production authority. Current API/provider wiring continues to use `services/orchestrator::registerPlatformProviders`; no architecture change is made by this audit.
