# Model Capabilities

> What models can do, mapped to VedMoulya capabilities.
> Owner: AI Platform Team · Updated: 2026-08-03 (DOC-001)

## Purpose

Document model capabilities as they map to VedMoulya's capability taxonomy (text, reasoning, vision, content-generation) so teams choose capabilities — not models — and providers can be swapped.

## Scope

- Capability definitions
- Model/quality-tier mapping (standard, premium)
- Constraints and limits
- Notes on selecting models per use case

## Current Status

Active; capability taxonomy in `packages/ai`; provider capabilities declared by adapters. Exact per-model specs live with provider documentation; this file keeps the platform-level mapping.

## Architecture

```
Capability (packages/ai types) → tier → provider/model mapping (orchestrator + provider comparison)
```

## Responsibilities

- AI Platform Team: mapping accuracy
- Feature teams: request by capability/tier

## Deliverables

- Capability model (this document)
- Provider comparison ([PROVIDER_COMPARISON.md](./PROVIDER_COMPARISON.md))

## Dependencies

- `packages/ai`
- `06_AI/PROVIDER_COMPARISON.md`

## Future Work

- Live capability registry sync (EI-001)

## References

- [PROVIDER_COMPARISON.md](./PROVIDER_COMPARISON.md)
- [03_Architecture/CAPABILITY_ARCHITECTURE.md](../03_Architecture/CAPABILITY_ARCHITECTURE.md)
