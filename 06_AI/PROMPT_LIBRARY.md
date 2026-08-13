# Prompt Library

> Reusable prompt patterns and builders for AI features.
> Owner: AI Platform Team · Updated: 2026-08-03 (DOC-001)

## Purpose

Catalog the prompt-building patterns used across the platform so prompts are consistent, brand-aware, context-minimal, and quality-scored — and so teams reuse proven templates instead of reinventing.

## Scope

- Prompt builder patterns (Content Agency reference)
- Multi-pass review prompts
- Quality scoring rubrics
- Anti-patterns (context dumping, unbounded prompts)

## Current Status

Active. Content Agency ships production prompt builders (`ContentAgencyAIService`, `ClientOpsAIService`) with brand-aware, retrieval-augmented prompts and weighted scoring.

## Architecture

```
Template + retrieved context (minimum) → prompt
  → orchestrator call (token budget) → output → scoring rubric → accept/regenerate
```

## Responsibilities

- AI Platform Team: curate library, score rubrics
- Feature teams: reuse builders, contribute patterns

## Deliverables

- Prompt pattern catalog (this document)
- Production builders in Content Agency

## Dependencies

- `packages/services/src/content-agency/*AIService.ts`
- [AI_GUIDELINES.md](./AI_GUIDELINES.md)

## Future Work

- Versioned prompt registry with A/B evaluation

## References

- [AI_WORKFLOW.md](./AI_WORKFLOW.md)
- [03_Architecture/CONTEXT_INTELLIGENCE.md](../03_Architecture/CONTEXT_INTELLIGENCE.md)
