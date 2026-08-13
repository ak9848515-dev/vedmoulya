# Enterprise Brain

> The master decision engine — the CEO of VedMoulya. It receives goals, understands business, plans, chooses capabilities and providers, allocates work, monitors, validates, learns, and improves.
> Owner: Chief Enterprise Intelligence Architect · Updated: 2026-08-03 (EI-000)

## Purpose

Define the Enterprise Brain: the orchestrating decision engine that coordinates all 13 engines into one coherent decision loop. It is not a chatbot and not a multi-agent framework — it is the operating system's executive layer. Every business module executes through it.

## Responsibilities

- Receive goals and route them through the engine pipeline
- Understand business context (memory, knowledge, decision, client state)
- Decide: accept/reject goals, choose capabilities, choose providers, allocate work
- Monitor execution and intervene (re-plan, re-allocate, escalate)
- Validate outcomes and feed learning
- Report the Overall Intelligence Score

## Inputs

- Goals/intents from all modules (Content Agency, Career, Learning, Business, Client Ops)
- Business context (Memory, Knowledge, Decision engines)
- Engine states (Goal, Task, Capability, Economy, Rating, Health, Benchmark, Quality, Learning)
- Client/module policies (budgets, preferences, compliance)

## Outputs

- **Master decisions:** goal acceptance, capability/provider selection, work allocation, escalation, re-planning
- **Enterprise Brain State:** current portfolio of active goals, engine health, budgets, the Overall Intelligence Score
- Coordination events (start, block, resume, abort, escalate)

## Algorithms

### Receive goal

1. Normalize intent → Goal draft
2. Score (Goal Score, Business Value, Confidence)
3. Decision: accept / reject / defer (thresholds from registry) — defer to owner if low confidence

### Understand business

- Assemble business context via Context Intelligence (memory, knowledge, client profile, market state)
- Business understanding informs value scoring and capability choice
- Reuses the Decision Engine for structured trade-offs (explainable choices)

### Plan

- Hand the accepted Goal to the Goal Engine → Task Planner → produce Task Plan + critical path
- Approve or amend the plan (cost/risk review against Business Value)

### Choose capabilities

- Resolve tasks to capabilities (Capability Engine)
- If a needed capability is missing → discovery/probe (or degrade to nearest)

### Choose providers

- Provider Rating + Health + Benchmark + Economy jointly rank providers per capability
- Selection: highest effective score within budget + allowed set; fallback order established

### Allocate work

- Work Allocation Engine divides work into stages with per-stage providers
- Brain approves allocation if total budget ≤ envelope and risk acceptable

### Monitor

- Parallel Execution reports status; Brain watches:
  - Budget consumption (Economy)
  - Quality gate outcomes (Quality)
  - Provider health changes (Health)
  - Blocked tasks (Task)
- Interventions: re-prioritize, re-allocate, switch provider, escalate to human

### Validate

- Final quality verdict + business validation before delivery (Quality Engine)
- Client approvals routed via the client portal flow

### Learn

- Outcomes stream to Learning Engine → proposals → human-gated review
- Brain adopts approved improvements (weights, prompts, routing)

### Improve

- Track the Overall Intelligence Score over time; the learning-velocity term demonstrates improvement
- Portfolio reviews: which goals delivered value; adjust prioritization policy

## Scoring

| Score                              | Source             | Used for          |
| ---------------------------------- | ------------------ | ----------------- |
| GoalScore/BusinessValue/Confidence | Mathematics §3/8/7 | Goal decisions    |
| CapabilityScore                    | Mathematics §2     | Capability choice |
| ProviderScore                      | Mathematics §1     | Provider choice   |
| TaskPriority                       | Mathematics §4     | Scheduling        |
| ExecutionScore                     | Mathematics §9     | Run assessment    |
| Overall Intelligence Score         | Mathematics §10    | Platform KPI      |

## Decision Flow

```
Receive → Understand → Plan → Choose capabilities → Choose providers
  → Allocate → Monitor → Validate → Learn → Improve
```

Every decision is explainable (records reasons + scores) — traceable to inputs and weights.

## Failure Handling

- **Low-confidence goal:** defer to human owner with evidence
- **Budget conflict:** re-plan smaller, or escalate for funding
- **Provider outage mid-run:** health-driven re-allocation (fallback chain)
- **Quality rejection loop:** escalate after regeneration budget; human review
- **Runaway spend:** hard circuit-break at client/module cap; notify
- **Learning proposal regression:** automatic rollback to previous version

## Learning

- Brain-level learning: portfolio value realization, decision quality (did the chosen provider/capability deliver?), prioritization policy tuning
- All improvements human-gated; versioned; reversible

## Future Expansion

- EI-009 Enterprise Brain synthesis (unified memory/knowledge querying)
- Proactive goal generation (from market/client signals)
- Multi-tenant brain isolation (per-client decision state)

## References

- [EI000_ENTERPRISE_INTELLIGENCE_SPECIFICATION.md](./EI000_ENTERPRISE_INTELLIGENCE_SPECIFICATION.md)
- [INTELLIGENCE_MATHEMATICS.md](./INTELLIGENCE_MATHEMATICS.md)
- [GOAL_ENGINE.md](./GOAL_ENGINE.md)
- [TASK_ENGINE.md](./TASK_ENGINE.md)
- [CAPABILITY_ENGINE.md](./CAPABILITY_ENGINE.md)
- [EXECUTION_STRATEGY_ENGINE_SPEC.md](./EXECUTION_STRATEGY_ENGINE_SPEC.md)
- [WORK_ALLOCATION_ENGINE.md](./WORK_ALLOCATION_ENGINE.md)
- [EXECUTION_GRAPH.md](./EXECUTION_GRAPH.md)
- [QUALITY_ENGINE_SPEC.md](./QUALITY_ENGINE_SPEC.md)
- [LEARNING_ENGINE_SPEC.md](./LEARNING_ENGINE_SPEC.md)
