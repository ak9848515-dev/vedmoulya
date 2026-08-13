# Provider Selection

> How the Orchestrator chooses which provider fulfills a capability — by capability, health, quality, and cost.
> Owner: AI Platform Team · Updated: 2026-08-03 (DOC-001)

## Purpose

Define the provider selection rules of the AI Orchestrator: given a capability, quality tier, and constraints, select the best provider; fail over and retry when a provider is unhealthy or errors.

## Scope

- Selection criteria (capability support, health, quality tier, cost)
- Fallback ordering and retry policy
- Mock provider semantics in dev/test
- Determinism and testability

## Current Status

Implemented in `services/orchestrator` and `AIOrchestrationService`. Providers register their capabilities; selection routes by capability and tier; fallback/retry is in place; the Mock provider makes tests hermetic and deterministic. EPIC-003 added the `content-generation` capability and its routing.

## Architecture

```
Request(capability, tier, constraints)
  → candidate providers declaring capability
  → filter by health
  → rank by tier/cost policy
  → execute; on error/timeout → next candidate (retry with backoff)
  → cache + metrics
```

## Responsibilities

- AI Platform Team: selection policy, provider health, retry tuning
- Provider owners: accurate capability declarations and health checks

## Deliverables

- Selection + fallback + retry implementation
- Health checks (`isHealthy`, `getHealth`)
- Deterministic mock behavior

## Dependencies

- `services/orchestrator/src/providers/*`
- `packages/services/src/ai/AIOrchestrationService.ts`

## Future Work

- Cost-aware ranking (ties into EI-005)
- Latency-aware routing

## References

- [AI_PROVIDER_STRATEGY.md](./AI_PROVIDER_STRATEGY.md)
- [ADAPTER_FRAMEWORK.md](./ADAPTER_FRAMEWORK.md)
- [06_AI/PROVIDER_COMPARISON.md](../06_AI/PROVIDER_COMPARISON.md)
