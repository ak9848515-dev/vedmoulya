# VedMoulya Constitution

> The most important file in the repository. Engineering principles, mission, and non-negotiable constraints that govern every decision, every line of code, and every AI call.
> Owner: Founders & Architecture Council · Updated: 2026-08-03 (DOC-001)

## Purpose

Define the permanent principles of VedMoulya. All work — code, AI, documentation, business — must conform to this constitution. When in doubt, this document wins.

## Scope

- Mission, vision, and values
- Engineering principles (binding)
- AI usage principles (binding)
- Governance principles (binding)

This constitution is the canonical version. `00_Foundation/CONSTITUTION.md` remains the historical founding statement; this document extends it with engineering and AI governance.

## Current Status

Ratified. All sprints and modules are measured against these principles. Updated 2026-08-03 to formalize engineering and AI principles.

## Architecture

The constitution operates at three levels:

1. **Why** — Mission and vision
2. **What** — Engineering principles that shape the system
3. **How** — AI and governance rules that constrain daily work

## Responsibilities

- **All engineers and AI agents:** comply with the principles below
- **Architecture Council:** interpret and enforce
- **Reviewers:** reject changes that violate this constitution

## Deliverables

This document, plus the enforcement points in `REPOSITORY.md` and the CI quality gates.

## Dependencies

- `REPOSITORY.md` — repository governance and quality standards
- `00_Foundation/CONSTITUTION.md` — founding statement
- `04_Technology` — engineering standards

## Future Work

- Living interpretation notes for ambiguous cases
- Quarterly constitution review

## References

- [00_Foundation/CONSTITUTION.md](../00_Foundation/CONSTITUTION.md)
- [REPOSITORY.md](../REPOSITORY.md)

---

## Mission

Empower every determined individual to build a sustainable livelihood through knowledge, execution, and intelligent technology.

## Vision

Create the world's most trusted execution platform that transforms knowledge into livelihoods.

## Values

- Truth before hype
- Execution before information
- Outcomes before features
- Systems before shortcuts
- Continuous learning
- Human-first technology

---

## Engineering Principles

1. **Reuse mature open-source software whenever appropriate.** Do not reinvent infrastructure. Wrap and reuse.
2. **Build only capabilities that differentiate VedMoulya.** Everything else is adopted from the ecosystem.
3. **Every external technology must be wrapped behind VedMoulya interfaces.** No vendor lock-in; adapters at the boundary.
4. **Every AI call must have a token budget.** No unbounded prompts or contexts.
5. **Every AI call must have a cost budget.** Spend is bounded and observable.
6. **Every AI call must have a quality target.** Output is scored against a defined standard.
7. **Every AI call must use the minimum necessary context.** Retrieve, select, and prune before sending.
8. **Business modules must never directly call AI providers.** All AI execution goes through the Enterprise Intelligence layer (AI Orchestrator).
9. **All AI execution must go through the Enterprise Intelligence layer.** A single, governed, observable path.
10. **Every sprint must include documentation.** No undocumented work ships.
11. **Every architectural decision must be documented.** ADRs are mandatory for architecture changes.
12. **Revenue before perfection.** Ship value; perfect incrementally.

---

## Additional Governance Principles

- **Clean Architecture** — dependencies point inward; domain has zero infrastructure dependencies
- **DDD** — bounded contexts own their data; cross-context via events
- **Security by default** — all endpoints authenticated, data encrypted, access audited
- **Accessibility by default** — WCAG AA minimum, semantic HTML, keyboard navigation
- **Quality gates** — TypeScript strict, ≥80% coverage on new code, zero ESLint errors, no `any`, no `!`, no `console.log` in production code
