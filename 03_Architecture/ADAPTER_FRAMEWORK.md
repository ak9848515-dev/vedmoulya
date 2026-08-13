# Adapter Framework

> The boundary that keeps every external technology — especially AI providers — behind VedMoulya interfaces.
> Owner: AI Platform Team · Updated: 2026-08-03 (DOC-001)

## Purpose

Define the Adapter Framework (EI-002): the contract (`ProviderAdapter`) that wraps external AI providers so that business modules depend on capabilities, never on vendors. This is the implementation of the constitutional principle: _every external technology must be wrapped behind VedMoulya interfaces_.

## Scope

- The `ProviderAdapter` contract (execute, health, capability declarations)
- Provider registration and lifecycle
- Adding a new provider (onboarding checklist)
- Error normalization and retry semantics

## Current Status

Implemented. `services/orchestrator` defines `ProviderAdapter`; OpenAI, Anthropic, and Mock adapters exist; providers register at startup (`createOrchestrator`); EPIC-003 extended mock and capability routing for content generation.

## Architecture

```
interface ProviderAdapter {
  execute(request): Promise<AIResponse>
  isHealthy(): Promise<boolean>
  getHealth(): Promise<ProviderHealth>
  capabilities: CapabilityType[]
}

Orchestrator registry: providerId → adapter
New provider = implement contract + register → modules unchanged
```

## Responsibilities

- AI Platform Team: contract stability, onboarding guide
- Adapter implementers: faithful capability mapping, health truthfulness

## Deliverables

- Adapter contract + implementations (OpenAI, Anthropic, Mock)
- Registration and orchestration integration
- Hermetic tests via mock

## Dependencies

- `packages/ai` (types), `services/orchestrator` (contract)

## Future Work

- EI-002 formal adapter SDK and docs
- Community provider contributions (OSR tie-in)

## References

- [AI_PROVIDER_STRATEGY.md](./AI_PROVIDER_STRATEGY.md)
- [CAPABILITY_ARCHITECTURE.md](./CAPABILITY_ARCHITECTURE.md)
- [04_Sprints/ENTERPRISE_INTELLIGENCE/EI-002_Adapter_Framework.md](../04_Sprints/ENTERPRISE_INTELLIGENCE/EI-002_Adapter_Framework.md)
