# EI-008 — Learning Engine

> Improve from outcomes: adaptive learning and outcome feedback.
> Owner: Learning Engine Team · Updated: 2026-08-03 (DOC-001)

## Purpose

Define the EI Learning Engine: adaptive learning paths, retention scheduling, and outcome-driven improvement — both for users (career/learning) and for the platform's own models of effectiveness (EI-010 tie-in).

## Scope

- Adaptive learning paths (user-facing, realized in services/learning)
- Retention scheduling (spaced repetition)
- Outcome feedback loops into planning/quality
- Learning analytics

## Current Status

🟢 **User learning realized** (`services/learning`); platform-level self-improvement loop is designed (EI-010).

## Architecture

```
Learning path → progress → retention model → adaptation
Outcomes (delivery, decisions) → feedback → quality/planning improvement
```

## Responsibilities

- Learning Engine Team: pedagogy, retention accuracy
- AI Platform Team: outcome feedback pipeline

## Deliverables

- Learning service (realized)
- Retention scheduling
- Outcome feedback loop

## Dependencies

- `services/learning`, `services/knowledge`
- [EI-010_Self_Improvement.md](./EI-010_Self_Improvement.md)

## Future Work

- Platform-wide improvement metrics

## References

- [03_Architecture/LEARNING_ENGINE.md](../../03_Architecture/LEARNING_ENGINE.md)
- [EI-010_Self_Improvement.md](./EI-010_Self_Improvement.md)
