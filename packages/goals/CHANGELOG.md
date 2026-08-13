# Changelog

## [1.0.0] — 2026-08-04

### Added (EI-006 — Enterprise Goal & Task Intelligence Engine)

- Goal registry: Goal model (title, description, category, business, priority,
  urgency, importance, complexity, estimated effort, status, confidence, goal
  score, success criteria, milestones, dependencies, tags, metadata) with
  lifecycle (proposed → scored → accepted → active ⇄ blocked → completed →
  archived), event timeline, and hierarchy (parent/child + score aggregation).
- Goal understanding: deterministic category detection across business,
  personal, learning, career, revenue, project, health, custom + capability /
  context / priority hints.
- Goal classification: business domain, required capabilities (shared
  `@vedmoulya/ai` taxonomy), required context, risk level, complexity, and
  token/cost budget ranges.
- Task intelligence: decomposition via per-category templates (sequential /
  parallel / conditional / optional / nested), 0–100 prioritization (business
  value, urgency, importance, dependencies, risk, confidence), dependency DAG
  with cycle detection, weighted critical path, slack, and parallel groups.
- Success criteria: every goal ships definition + validation + completion
  criteria + expected outcome.
- Milestones: derived from the task plan with achievement tracking.
- Validation: 8 checks (identity, description, criteria completeness,
  milestones, dependencies, classification, task graph, capabilities).
- Strategy handoff: `buildStrategyHandoff` converts the task plan into an
  EI-004 Execution Strategy input.
- In-memory Goal + Task repositories (seeded catalog: 5 goals).
- `GoalsApplicationService` facade: create, analyze, generateTasks, validate,
  explain, list, search, lifecycle transitions, task graph, strategy handoff,
  summary.
