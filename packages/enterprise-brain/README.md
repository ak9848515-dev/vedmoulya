# @vedmoulya/enterprise-brain

**Enterprise Brain — Central Decision Intelligence** (EPIC-004 / EI-008).

The Enterprise Brain is the highest decision-making layer of VedMoulya. It is
**not** another AI model, **not** another orchestrator, and **not** another
provider. It coordinates every Enterprise Intelligence Engine and **decides** —
it never executes.

The Brain consumes the Goal & Task Intelligence Engine (EI-006/goals), the
Learning Intelligence Platform (EI-007), the Capability Registry (EI-001), the
Provider Registry (EI-002), the Context Intelligence Engine (EI-003), the
Execution Strategy Engine (EI-004), and the Execution Orchestrator (EI-005)
through narrow port contracts. It owns none of them.

## Why it exists

VedMoulya's engines each excel at one job, but nothing sat above them to make
the cross-engine choices: _which goal runs first, which provider, which
capability, which context, which strategy, which budget, which quality gate,
which retry and fallback policy, and what the run should teach the platform._
The Enterprise Brain is that layer. When a goal arrives it runs the decision
pipeline — Receive Goal → Analyze → Consult every engine → Generate an
explained Decision Plan → hand it to the Execution Orchestrator (after human
approval). It never performs the execution itself.

## Architecture

```
src/
  types/         Brain domain types (14 decision types, decisions, plans,
                 confidence, reason, context, history, metrics, dashboard)
  contracts/     Engine port contracts — structurally satisfied by the seven
                 existing EI engine application services (no logic duplicated)
  domain/
    value-objects/ BrainDecisionId
    rules/       BrainDecisionRules — validation + lifecycle transitions
    repository/  BrainRepository contract
    services/    BrainDecisionService (14 decision generators),
                 BrainExplainerService (why/evidence/tradeoffs/alternatives/risks),
                 BrainMetricsService, BrainPlanService (the 11-step pipeline)
  infrastructure InMemoryBrainRepository, PostgresBrainRepository
  application/   BrainApplicationService + DTOs + mapper
  catalog/       Seed plan + 14 decisions referencing the seed goals/providers/…
```

The package depends on the engine packages (`@vedmoulya/goals`,
`@vedmoulya/learning-intelligence`, `@vedmoulya/capabilities`,
`@vedmoulya/providers`, `@vedmoulya/context`,
`@vedmoulya/execution-strategy`, `@vedmoulya/execution-orchestrator`) **by
type and by reuse** — the pipeline reads each engine's public DTOs through
narrow ports (`contracts/brain-engines.ts`). No engine logic is duplicated.

## The 14 decisions

Goal Priority · Task Priority · Execution Order · Capability Selection ·
Provider Selection · Context Strategy · Execution Strategy · Budget Strategy ·
Quality Thresholds · Risk Assessment · Retry Policy · Fallback Policy ·
Learning Feedback · Business Objectives

## Explainability

Every decision includes **why** (plain-language rationale), **evidence**
(engine-derived facts), **confidence** (score 0–1 + level + factors),
**trade-offs**, **alternatives**, and **risks**. When an engine is
unavailable the Brain still decides, with lower confidence and explicit
"unavailable" evidence — it degrades gracefully.

## Human approval

The Brain proposes; humans dispose. Plans and decisions are born `proposed`
and only become actionable after explicit approval. An approved plan can be
handed to the Execution Orchestrator (`handOffPlan`) — the only "execution"
the Brain performs is marking the handoff. Every transition bumps the version
and appends an audited, actor-scoped history entry (DecisionHistory). A
re-decision for the same goal supersedes the previous plan.

## Usage

```ts
import { BrainApplicationService, InMemoryBrainRepository } from '@vedmoulya/enterprise-brain';

const svc = new BrainApplicationService(
  new InMemoryBrainRepository(),
  { goals, learning, capabilities, providers, context, strategies, orchestrator }, // the seven engines
);

const { data: plan } = await svc.decideGoal({ goalId: 'goal_blog_seed' });
// plan: 14 explained decisions + pipeline trace + overall confidence
await svc.approvePlan({ planId: plan!.planId, actor: 'human-owner' });
await svc.handOffPlan({ planId: plan!.planId, actor: 'human-owner' });
const dashboard = await svc.getDashboard();
```

## Scope

- The 14 Enterprise Brain decisions with full explainability
- The 11-step decision pipeline over all seven EI engines (graceful degradation)
- Human-approval workflow: approve/reject decisions, approve/reject plans, handoff to the orchestrator (versioned + audited)
- Decision timeline, DecisionHistory, decision metrics, dashboard
- Postgres-backed repository (`brain_registry` JSONB table, migration ready)

Explicitly **not** implemented here: execution, AI calls, provider routing,
goal/task/strategy/capability logic (those stay in their owning engines), and
business modules. The Brain decides; it never executes.

## Tests

```bash
npm test -w packages/enterprise-brain
```
