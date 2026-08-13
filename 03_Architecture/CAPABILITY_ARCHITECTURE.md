# Capability Architecture

> How AI capabilities are modeled, routed, and delivered — the foundation of the Enterprise Intelligence layer.
> Owner: AI Platform Team · Updated: 2026-08-03 (DOC-001)

## Purpose

Define the capability model that decouples business modules from AI providers. A capability is a typed, named unit of AI work (e.g., `text`, `reasoning`, `vision`, `content-generation`) that the Orchestrator can fulfill through any registered provider.

## Scope

- Capability taxonomy (what capabilities exist)
- Routing rules (capability → provider)
- Quality tiers and constraints
- Provider adapters and the mock provider

## Current Status

Implemented in `packages/ai` + `services/orchestrator`. Capabilities include text, reasoning, vision, and content generation (added EPIC-003/AC-001). Routing supports quality tiers (`standard`, `premium`), token constraints (`maxOutputTokens`), request caching, and metrics. Mock provider enabled in development/testing; OpenAI and Anthropic adapters supported.

## Architecture

```
Business module → AI Service (typed DTO) → AIOrchestrationService
    → capability rules (AIRules) → provider selection → ProviderAdapter
    → cache → metrics → response DTO
```

- **Capabilities** live in `packages/ai/src/types` and `packages/ai/src/domain/rules/AIRules.ts`
- **Adapters** implement `ProviderAdapter` (`services/orchestrator`)
- **Selection** prefers providers that declare the requested capability; falls back and retries on failure
- **Constraints** bound every call: max tokens, quality tier, cost budget

## Responsibilities

- AI Platform Team: maintain capability taxonomy and routing rules
- Module teams: express AI needs as capabilities, never as provider-specific calls

## Deliverables

- Capability registry (types + rules)
- Provider adapters (OpenAI, Anthropic, Mock)
- Orchestration, caching, metrics, fallback/retry

## Dependencies

- `packages/ai` — capability types and rules
- `services/orchestrator` — adapters and orchestration
- `packages/services/src/ai/AIOrchestrationService.ts` — orchestration service

## Future Work

- EI-001 Capability Registry automation (discovery, health, cost metadata)
- Capability-specific quality scoring surfaced to consumers

## References

- [ENTERPRISE_INTELLIGENCE.md](./ENTERPRISE_INTELLIGENCE.md)
- [ADAPTER_FRAMEWORK.md](./ADAPTER_FRAMEWORK.md)
- [PROVIDER_SELECTION.md](./PROVIDER_SELECTION.md)
- [04_Sprints/ENTERPRISE_INTELLIGENCE/EI-001_Capability_Registry.md](../04_Sprints/ENTERPRISE_INTELLIGENCE/EI-001_Capability_Registry.md)
