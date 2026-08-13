# Provider Comparison

> Current AI providers, their capabilities, and selection guidance.
> Owner: AI Platform Team · Updated: 2026-08-03 (DOC-001)

## Purpose

Compare the AI providers wired into the platform (OpenAI, Anthropic, Mock) across capabilities, quality tiers, and operational posture, so teams can make informed routing decisions — without hard-coding vendor preferences in modules.

## Scope

- Provider adapter status
- Capability coverage
- Quality tier behavior
- Dev/test semantics (Mock)
- Selection guidance (ties to EI-001/EI-005)

## Current Status

Active. OpenAI, Anthropic, and Mock adapters registered in `services/orchestrator`; Mock is the deterministic dev/test provider; content-generation capability added EPIC-003/AC-001.

## Architecture

```
ProviderAdapter (execute, health, capabilities)
  ├─ Mock (dev/test, deterministic, hermetic)
  ├─ OpenAI (production capable)
  └─ Anthropic (production capable)
Selection: capability + tier + health + cost policy (see PROVIDER_SELECTION.md)
```

## Responsibilities

- AI Platform Team: comparison currency, cost notes
- Feature teams: consult before requesting new capabilities

## Deliverables

- Comparison matrix (this document)
- Adapter status tracking

## Dependencies

- `services/orchestrator/src/providers/*`
- [03_Architecture/AI_PROVIDER_STRATEGY.md](../03_Architecture/AI_PROVIDER_STRATEGY.md)

## Future Work

- Cost/latency telemetry-backed comparison (EI-005)

## References

- [MODEL_CAPABILITIES.md](./MODEL_CAPABILITIES.md)
- [03_Architecture/PROVIDER_SELECTION.md](../03_Architecture/PROVIDER_SELECTION.md)
