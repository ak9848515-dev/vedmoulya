# EI-002 — Adapter Framework

> The contract that keeps every external technology behind VedMoulya interfaces.
> Owner: AI Platform Team · Updated: 2026-08-03 (DOC-001)

## Purpose

Formalize the Adapter Framework: the `ProviderAdapter` contract, provider registration, and onboarding path for new providers — so modules never depend on vendors.

## Scope

- Adapter contract (execute, health, capabilities)
- Registration lifecycle and DI
- Provider onboarding guide
- Error normalization, retry, timeouts

## Current Status

🟢 **Implemented (core).** `services/orchestrator` defines and registers OpenAI, Anthropic, Mock adapters. Formal SDK + docs are the remaining work.

## Architecture

```
interface ProviderAdapter { execute; isHealthy; getHealth; capabilities }
Registry: providerId → adapter (registered at startup)
New provider → implement contract → register → modules unchanged
```

## Responsibilities

- AI Platform Team: contract stability
- Adapter implementers: faithful capability mapping

## Deliverables

- Adapter contract + 3 implementations (realized)
- Onboarding documentation
- Adapter SDK hardening

## Dependencies

- `packages/ai`, `services/orchestrator`
- [03_Architecture/ADAPTER_FRAMEWORK.md](../../03_Architecture/ADAPTER_FRAMEWORK.md)

## Future Work

- Versioned contract, community provider contributions

## References

- [03_Architecture/ADAPTER_FRAMEWORK.md](../../03_Architecture/ADAPTER_FRAMEWORK.md)
- [EI-001_Capability_Registry.md](./EI-001_Capability_Registry.md)
