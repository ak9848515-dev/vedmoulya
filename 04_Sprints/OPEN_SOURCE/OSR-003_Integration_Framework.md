# OSR-003 — Integration Framework

> Patterns for wrapping external technology behind VedMoulya interfaces.
> Owner: Platform Engineering · Updated: 2026-08-03 (DOC-001)

## Purpose

Define the integration patterns for adopting open-source technology: wrap every external dependency behind a VedMoulya interface so the platform can swap, upgrade, or remove it without ripple effects.

## Scope

- Wrapping patterns (adapter, facade, anti-corruption layer)
- Integration lifecycle (adopt → wrap → test → observe)
- When to integrate vs. avoid (criteria)
- Repository of integration examples (AI providers, storage, queue)

## Current Status

🟡 **Active.** The pattern is proven by the AI provider adapter framework and repository abstractions (in-memory ↔ Postgres). A formal integration playbook is being assembled.

## Architecture

```
External technology → VedMoulya interface (adapter/facade)
  → modules depend only on the interface
  → swap = new adapter, modules unchanged
```

## Responsibilities

- Platform Engineering: integration playbooks
- Module teams: depend on interfaces, never on externals

## Deliverables

- Integration patterns (this document)
- Playbook for common categories (AI, storage, queue, observability)

## Dependencies

- [03_Architecture/ADAPTER_FRAMEWORK.md](../../03_Architecture/ADAPTER_FRAMEWORK.md)
- [03_Architecture/OPEN_SOURCE_POLICY.md](../../03_Architecture/OPEN_SOURCE_POLICY.md)

## Future Work

- Pattern catalog per technology category

## References

- [03_Architecture/ADAPTER_FRAMEWORK.md](../../03_Architecture/ADAPTER_FRAMEWORK.md)
- [OSR-002_Technology_Catalog.md](./OSR-002_Technology_Catalog.md)
