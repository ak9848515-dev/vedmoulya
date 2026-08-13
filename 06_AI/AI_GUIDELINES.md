# AI Guidelines

> The rules every AI feature on VedMoulya must follow.
> Owner: AI Platform Team · Updated: 2026-08-03 (DOC-001)

## Purpose

Operationalize the constitution's AI principles into concrete engineering rules for anyone building AI features: routing, budgets, context, quality, and observability.

## Scope

- Routing: all AI through the Orchestrator (never direct provider calls)
- Budgets: token, cost, quality target per call
- Context: minimum necessary
- Quality: scoring and thresholds
- Observability: metrics and logs

## Current Status

Active and enforced by design (orchestrator choke point) and review.

## Architecture

```
AI feature → AI Service (typed DTO) → Orchestrator (budgets, routing, cache, metrics) → provider
```

## Responsibilities

- AI Platform Team: enforce guidelines, maintain tooling
- Feature teams: follow guidelines, declare budgets

## Deliverables

- This guideline document
- Enforcement in `services/orchestrator`

## Dependencies

- [03_Architecture/VEDMOULYA_CONSTITUTION.md](../03_Architecture/VEDMOULYA_CONSTITUTION.md)
- [03_Architecture/ENTERPRISE_INTELLIGENCE.md](../03_Architecture/ENTERPRISE_INTELLIGENCE.md)

## Future Work

- Automated budget checks in CI

## References

- [AI_WORKFLOW.md](./AI_WORKFLOW.md)
- [PROMPT_LIBRARY.md](./PROMPT_LIBRARY.md)
