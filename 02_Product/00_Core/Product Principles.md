# VedMoulya Product Principles

**Version:** 1.0
**Status:** Canonical
**Author:** Product & Architecture Council
**Created:** 2026-07-24
**Updated:** 2026-08-16
**Dependencies:** CONSTITUTION.md, Human Journey.md (PRD-001)

## Description

The foundational product principles governing all design, engineering, feature prioritization, and AI interaction models across the VedMoulya Execution Operating System. Every feature, API, algorithm, and UX pattern must demonstrably adhere to these non-negotiable principles.

---

## 1. The Core Transformation Principle

> **Knowledge alone does not change lives.**
> $$\text{Knowledge} \longrightarrow \text{Understanding} \longrightarrow \text{Decision} \longrightarrow \text{Execution} \longrightarrow \text{Value} \longrightarrow \text{Livelihood}$$

- **Rule:** Never build features that merely store or curate passive knowledge without an explicit bridge to decision-making and real-world execution.
- **Enforcement:** Every knowledge note, book summary, or insight in the system must support an attached action, experiment, or goal hypothesis.

---

## 2. Truth Over Hype (Evidence-First Honesty)

- **Principle:** The platform never flatters the user, hallucinates market traction, or fabricates success.
- **Rule:** Unverified claims are categorized as `HYPOTHESIS`. Compliments do not equal customer validation. Verbal interest does not equal willingness to pay. Only a verified, reconciled payment unlocks `REVENUE_VERIFIED`.
- **Enforcement:** When data is absent or uncalibrated, the UI and API explicitly display `UNKNOWN`. Stale evidence automatically decays and never inflates scores.

---

## 3. Human Sovereignty & The ultimate Authority

- **Principle:** AI is an advisor, amplifier, and tireless operator; the Human is the ultimate sovereign and decision-maker.
- **Rule:** The system will never autonomously commit financial funds, execute legally binding agreements, contact external clients without consent, or alter user governance charters.
- **Enforcement:** The `HumanAIBoundary` and `ActionClassPolicy` classify actions into Classes A, B, C, and D. Sensitive actions (Classes C & D) require explicit, out-of-band user approval. Voice or conversational agents cannot self-authorize.

---

## 4. Fail-Closed Security & Privacy by Default

- **Principle:** A system that manages a person's livelihood must be impervious to unauthorized snooping, accidental data leakage, or adversarial tampering.
- **Rule:** All personal intelligence, financial ledgers, User DNA, and internal plans must be owner-scoped with tenant isolation, strict IDOR prevention, and encrypted persistence. Each storage adapter and deployed environment must provide evidence that these controls are active.
- **Enforcement:** No shared telemetry without explicit opt-in. In development, run safely in-memory; in production, enforce strict secret validation and audit logging.

---

## 5. Deterministic AI Governance & Bounded Execution

- **Principle:** Autonomous AI execution must be bounded by deterministic budgets, schemas, and verification critics.
- **Rule:** Unbounded agentic loops or open-ended token burns are prohibited. Every execution run has hard budgets on time, cost, loop depth, and tool invocations.
- **Enforcement:** Every agent execution plan must pass through an independent, deterministic critic before invocation and verify real-world artifacts (e.g., file existence, unit test runs) rather than relying on LLM self-reporting.

---

## 6. Progressive Disclosure & Anti-Overwhelm

- **Principle:** A stressed human cannot navigate a complex cockpit. Complexity must be earned through progress.
- **Rule:** Users in Stage 0 (Survive) or Stage 1 (Discover) see only the immediate tools and metrics necessary for survival and direction. Advanced enterprise orchestration, workforce delegation, and multi-cloud scaling remain hidden until relevant stages are unlocked.
- **Enforcement:** Interface adaptation engine dynamically adjusts menu depth, dashboard density, and notification frequency based on the user's active Journey Stage and HPI level.

---

## 7. Sustainable Unit Economics & Livelihood Preservation

- **Principle:** Software should generate multiples of its cost in verified livelihood value.
- **Rule:** Cost transparency is absolute. Every AI workflow, API call, and background engine calculates its expected and observed infrastructure cost.
- **Enforcement:** The system advises on low-cost/no-cost execution alternatives first. High-cost cloud models are reserved strictly for high-leverage decisions where cheaper or local models cannot fulfill the specification.
