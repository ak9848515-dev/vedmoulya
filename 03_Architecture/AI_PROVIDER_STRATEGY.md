# AI Provider Strategy

> Provider-agnostic AI: why, how, and which providers.
> Owner: AI Platform Team · Updated: 2026-08-03 (DOC-001)

## Purpose

Define the strategy for AI providers: no vendor lock-in, capability-based routing, cost and quality governance, and a path to add or swap providers without touching business modules.

## Scope

- Provider abstraction and adapter contracts
- Supported providers (OpenAI, Anthropic, Mock)
- Selection, fallback, retry, and health
- Cost/quality posture

## Current Status

Implemented. `services/orchestrator` exposes `ProviderAdapter`; providers are registered at startup; the AI Orchestrator routes by capability, enforces quality tiers and token constraints, caches requests, records metrics, and fails over between providers. Mock provider is the default for development and hermetic tests.

## Architecture

```
AIOrchestrationService
  ├─ route(capability, qualityTier, constraints)
  ├─ selectProvider(capability, health, cost)
  ├─ execute with fallback/retry
  ├─ cache + metrics
  └─ ProviderAdapter implementations
       ├─ OpenAIAdapter
       ├─ AnthropicAdapter
       └─ MockProvider (dev/test)
```

## Responsibilities

- AI Platform Team: provider onboarding, routing quality, cost governance
- Module teams: never call providers directly; use capabilities via AI Services

## Deliverables

- Provider adapters and registration
- Routing/fallback/retry logic
- Health checks and usage metrics
- Provider comparison (06_AI/PROVIDER_COMPARISON.md)

## Dependencies

- `services/orchestrator`
- `packages/ai`
- `06_AI/PROVIDER_COMPARISON.md`, `06_AI/MODEL_CAPABILITIES.md`

## Future Work

- Additional providers via the adapter framework
- Provider-level cost dashboards (Enterprise Execution Strategy Engine)

## References

- [ADAPTER_FRAMEWORK.md](./ADAPTER_FRAMEWORK.md)
- [PROVIDER_SELECTION.md](./PROVIDER_SELECTION.md)
- [06_AI/PROVIDER_COMPARISON.md](../06_AI/PROVIDER_COMPARISON.md)
