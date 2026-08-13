# Decision Engine

> Decision intelligence: structured, explainable decisions instead of guesses.
> Owner: Decision Engine Team · Updated: 2026-08-03 (DOC-001)

## Purpose

Document the Decision Engine (`services/decision`): the service that helps users — and the platform itself — make structured decisions with criteria, trade-offs, scoring, and explainability.

## Scope

- Decision model (options, criteria, weights, scores)
- Explainability (why this option won)
- AI-assisted analysis (via the Orchestrator — never direct provider calls)
- Consumers (career, business, content agency decisions)

## Current Status

Implemented as `services/decision` with application services, decision explainability service, and Postgres repositories; tests green (AC-002.5 validation). The Content Agency reuses the Decision Engine for go/no-go and client decisions.

## Architecture

```
Decision request → criteria/weights → scoring → ranking → explanation
AI assist: Decision AI Service → Orchestrator (capability: reasoning/text)
```

## Responsibilities

- Decision Engine Team: model correctness, explainability, AI assist quality
- Consumers: route decision AI through the Orchestrator

## Deliverables

- Decision service + explainability
- AI-assisted decision workflow
- Decision history and audit

## Dependencies

- `services/decision`
- `packages/services/src/decision`
- [ENTERPRISE_INTELLIGENCE.md](./ENTERPRISE_INTELLIGENCE.md) (AI path)

## Future Work

- Multi-agent deliberation (EI-009 tie-in)
- Decision outcome tracking for self-improvement (EI-010)

## References

- [packages/services/src/decision](../packages/services/src/decision)
- [EXECUTION_ENGINE.md](./EXECUTION_ENGINE.md)
