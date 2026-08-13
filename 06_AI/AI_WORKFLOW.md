# AI Workflow

> How an AI request flows through the platform, step by step.
> Owner: AI Platform Team · Updated: 2026-08-03 (DOC-001)

## Purpose

Describe the canonical AI workflow — from feature call to provider response — and the multi-pass patterns used for high-quality output (research → draft → review passes).

## Scope

- Canonical orchestration flow
- Multi-pass workflow pattern (content agency example)
- Failure and retry handling
- Caching and metrics

## Current Status

Active. Canonical flow implemented in `AIOrchestrationService`; multi-pass pattern proven in the Content Agency (AC-001).

## Architecture

```
1. Feature AI Service builds typed request (capability, tier, constraints)
2. Orchestrator: budget check → cache lookup → provider selection → execute
3. Fallback/retry on failure → response DTO
4. Multi-pass (optional): pass N output → next pass (brand/grammar/SEO) → score → accept/regenerate
5. Metrics: tokens, cost, quality, latency
```

## Responsibilities

- AI Platform Team: orchestrator behavior
- Feature teams: follow the canonical flow

## Deliverables

- Canonical flow (this document)
- Orchestrator implementation
- Multi-pass reference (Content Agency)

## Dependencies

- `packages/services/src/ai/AIOrchestrationService.ts`
- `services/orchestrator`

## Future Work

- Workflow visualizations
- EI-006 planner-driven workflows

## References

- [AI_GUIDELINES.md](./AI_GUIDELINES.md)
- [03_Architecture/PROVIDER_SELECTION.md](../03_Architecture/PROVIDER_SELECTION.md)
