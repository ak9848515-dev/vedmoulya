# Architecture Rules

**TECH-002 — Document 05/10 — Engineering Standards Manual**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Engineering Officer (CEngO)
**Created:** 2026-07-27
**Cross-references:** CMP-001, CMP-002, PRD-001, PRD-002, ARC-001, ARC-002, ARC-003, ARC-004, ARC-005, ENG-001, ENG-002, ENG-003, ENG-004, TECH-001, IMP-001

---

## Purpose

This document defines the **mandatory architecture rules** that govern all VedMoulya system design. Every component, service, and module must comply with these rules. These rules operationalize the 12 Architecture Principles (ARC-001) into enforceable design constraints.

---

## Architecture Rule Hierarchy

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE RULE HIERARCHY                            │
│                                                                           │
│  LEVEL 1: IMMUTABLE RULES (Cannot be violated)                          │
│  ────────────────────────────────────────────                           │
│  These rules have zero exceptions. Violation requires CEO-level         │
│  approval and documented mitigation.                                    │
│                                                                           │
│  LEVEL 2: STRICT RULES (Exception with ADR)                             │
│  ────────────────────────────────────────────                           │
│  These rules can be violated only with a documented Architecture         │
│  Decision Record (ADR) explaining rationale and mitigation.             │
│                                                                           │
│  LEVEL 3: GUIDELINES (Best practices, deviation allowed with reason)    │
│  ────────────────────────────────────────────                           │
│  These are strong recommendations. Deviations are documented in PR      │
│  descriptions or code comments.                                         │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Immutable Architecture Rules (Level 1)

### Rule 1.1: Domain-Driven Separation

**Rule:** All code must be organized by domain concept (bounded context), not by technical layer.

```text
✅ CORRECT (DDD):
  services/identity/
    ├── domain/       — User entity, identity rules
    ├── application/  — Use cases, DTOs
    └── infrastructure/ — Database, external APIs

❌ WRONG (Technical layering):
  services/controller/  — All controllers
  services/services/    — All services
  services/repository/  — All repositories
```

**Rationale:** Domain-driven organization (ENG-001) ensures that related concepts change together. Technical layering creates coupling across unrelated domains.

**Cross-Reference:** ENG-001/D02 (Bounded Contexts), ARC-001 (Principle #8: Modular)

---

### Rule 1.2: Provider Abstraction

**Rule:** No business logic may directly call an AI provider, cloud service, or third-party API. All external calls must go through an abstraction layer.

```text
✅ CORRECT:
  Domain Service → AI Orchestrator Interface → AI Orchestrator → AI Provider

❌ WRONG:
  Domain Service → AI Provider SDK (direct call)
```

**Rationale:** Provider Agnostic (ARC-001, Principle #2) is a core architectural value. Direct provider coupling violates the architecture and creates lock-in.

**Enforcement:** Architecture review gate. Any import of an AI provider SDK in business logic code is automatically rejected.

**Cross-Reference:** ARC-005 (AI Orchestrator), TECH-001/D01 (Provider Agnostic)

---

### Rule 1.3: Domain Layer Purity

**Rule:** The domain layer must have ZERO external framework dependencies. It imports only standard library types and interfaces defined within the domain layer.

```text
✅ CORRECT (domain/*.ts):
  import { UserId } from './user-id.value-object'
  import { Email } from './email.value-object'
  // No external imports

❌ WRONG (domain/*.ts):
  import { z } from 'zod'
  import { ObjectId } from 'mongodb'
  import { IsEmail } from 'class-validator'
```

**Rationale:** The domain layer (ENG-001) must remain pure to be testable, replaceable, and framework-agnostic. External dependencies in the domain layer create coupling to infrastructure choices.

**Cross-Reference:** ENG-001 (Domain Layer), ENG-002 (Service Contracts)

---

### Rule 1.4: Privacy by Default

**Rule:** All personal data must be encrypted at rest and in transit. No personal data may be logged, traced, or sent to external providers without explicit consent and classification.

**Enforcement:**

- Automated: ESLint rule prohibits logging PII-typed variables
- Architectural: AI Orchestrator enforces minimum context principle (ARC-005)
- Review: Privacy review required for any PR that handles personal data

**Cross-Reference:** CMP-002 (Privacy by Design), ARC-001 (Principle #6: Privacy First)

---

### Rule 1.5: Event-Driven Communication

**Rule:** Cross-boundary communication must use asynchronous events (not direct API calls) for all non-request-response interactions.

```text
✅ CORRECT:
  Service A → Domain Event → Event Bus → Service B (async)

  Direct calls allowed for:
  - Query/request-response patterns (GET requests)
  - Command patterns (specific action requests)

❌ WRONG:
  Service A → HTTP call → Service B (for events/callbacks)
  Service A → Direct DB access → Service B's data
```

**Rationale:** Loose coupling through events (ARC-001, Principle #5: Event Driven) ensures that services are independently evolvable and deployable.

**Cross-Reference:** ARC-001 (Principle #5), ENG-001/D06 (Domain Events)

---

## Strict Architecture Rules (Level 2)

### Rule 2.1: Layered Dependency Direction

**Rule:** Dependencies flow inward. Outer layers depend on inner layers. Inner layers never depend on outer layers.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    DEPENDENCY DIRECTION                                   │
│                                                                           │
│  Presentation (UI/API) ──▶ Application (Use Cases) ──▶ Domain (Core)    │
│  Infrastructure ──────────────────────────────────────────▶ Domain       │
│                                                                           │
│  ⚠ INNER LAYERS MUST NEVER IMPORT FROM OUTER LAYERS                      │
│  ⚠ DOMAIN LAYER MUST NOT DEPEND ON ANY OTHER LAYER                       │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

**Exception Process:** ADR required describing why the dependency direction is violated and what mitigation is in place.

**Cross-Reference:** ENG-001 (Domain Model Layering), Clean Architecture principles

---

### Rule 2.2: API Contract First

**Rule:** All service-to-service APIs must have a documented contract (OpenAPI v3 or equivalent) before implementation begins.

**Exception Process:** Prototype-phase exploratory APIs may be defined after implementation, but must be documented before the PR merges.

**Cross-Reference:** ENG-002 (Service Contracts)

---

### Rule 2.3: Event Schema Versioning

**Rule:** All domain events must have a versioned schema. Breaking changes require a new event version. Consumers must handle multiple versions.

```text
user-created.v1.ts  → Original schema
user-created.v2.ts  → Breaking change (added fields)
```

**Exception Process:** Pre-production events within the same sprint may evolve without versioning.

**Cross-Reference:** ENG-001/D06 (Domain Events)

---

### Rule 2.4: Component Statelessness

**Rule:** Application services must be stateless. State lives in databases, caches, or external stores. In-memory state is allowed only for caching with TTL.

**Exception Process:** Client-side state management (React state) and session data are exempt.

**Cross-Reference:** ARC-001 (Principle #7: Scalable)

---

### Rule 2.5: Observability Requirement

**Rule:** Every service must emit:

- Health check endpoint (`GET /health`)
- Metrics (request count, latency, error rate)
- Structured logs (with correlation IDs)
- Traces (distributed tracing across service boundaries)

**Exception Process:** Internal utility libraries that have no runtime behavior.

**Cross-Reference:** ARC-001 (Principle #10: Observable)

---

### Rule 2.6: Aggregate Consistency Boundaries

**Rule:** Each aggregate root (ENG-001/D03) defines a transactional consistency boundary. Operations within an aggregate are strongly consistent. Cross-aggregate operations are eventually consistent.

```text
Example:
  User Aggregate: User entity + Profile value object
    → Strong consistency within User (saving profile updates user timestamp)
    → Eventual consistency: User Created → Knowledge Graph receives event
```

**Cross-Reference:** ENG-001/D03 (Aggregates), DDD tactical patterns

---

### Rule 2.7: Feature Flag Architecture

**Rule:** All new features must be behind a feature flag. Feature flags are runtime-configurable and do not require deployment to toggle.

```text
if (featureFlags.isEnabled('social-login')) {
  registerSocialLoginHandler()
}
```

**Exception Process:** Security patches and critical bug fixes.

---

## Architecture Guidelines (Level 3)

### Guideline 3.1: Modular Monolith First

Build as a modular monolith. Extract services only when validated by data (performance bottleneck, independent scaling need, team ownership boundary).

**Cross-Reference:** IMP-001/D02 (Implementation Strategy), TECH-001/D01 (Monolith-first)

### Guideline 3.2: Database per Bounded Context

Each bounded context should have its own database schema or database. Shared databases between contexts are permitted only for reference data.

**Cross-Reference:** ENG-001/D02 (Bounded Contexts), TECH-001/D04 (Data & Storage)

### Guideline 3.3: CQRS for Read-Optimized Queries

Separate read models from write models when the read pattern differs significantly from the write pattern.

### Guideline 3.4: Saga Pattern for Distributed Transactions

Use saga pattern (choreography or orchestration) for multi-aggregate transactions. Two-phase commit (XA transactions) is prohibited.

### Guideline 3.5: API Gateway Pattern

All external API traffic goes through the API gateway. Services are not directly exposed to external clients.

### Guideline 3.6: Circuit Breaker for External Dependencies

All external service calls (AI providers, third-party APIs) must have circuit breakers configured with appropriate thresholds.

---

## Architecture Decision Process

### When an ADR is Required

Any decision affecting architecture rules, module boundaries, or cross-cutting concerns requires an ADR:

```text
ADR REQUIRED FOR:
  • New service creation
  • Module boundary change
  • Technology/framework selection
  • Exception to Level 1 or Level 2 rules
  • Cross-cutting concern design (auth, logging, caching, etc.)
  • API contract changes affecting multiple consumers
  • Database schema changes affecting multiple contexts
  • New external dependency introduction

NO ADR NEEDED FOR:
  • Internal implementation within a module
  • Bug fixes
  • Test additions/changes
  • Code refactoring within module boundaries
```

### ADR Template

```markdown
# ADR-NNN: Title

- **Status:** [Proposed | Accepted | Deprecated | Superseded]
- **Date:** YYYY-MM-DD
- **Owner:** [Name]

## Context

Why this decision was needed

## Decision

What was decided

## Rationale

Why this option was chosen over alternatives

## Alternatives Considered

What was considered and rejected, with brief rationale

## Implications

What this decision affects (performance, security, maintainability, etc.)

## Compliance

How this decision aligns with each applicable Architecture Rule

## Reviewed By

- [Reviewer 1] - [Date]
- [Reviewer 2] - [Date]
```

---

## Architecture Compliance

### Automated Compliance Checks

| Check                               | Tool                                | Frequency       |
| ----------------------------------- | ----------------------------------- | --------------- |
| Layer dependency direction          | ESLint (import restrictions)        | Pre-commit + CI |
| Provider SDK import detection       | ESLint (no-restricted-imports)      | Pre-commit + CI |
| Domain layer purity                 | ESLint (external-imports-in-domain) | Pre-commit + CI |
| API contract validation             | OpenAPI diff tool                   | CI              |
| Event schema version detection      | Custom script                       | PR check        |
| Feature flag check for new features | Code review                         | PR review       |

### Architecture Review Cadence

| Review Type                   | Frequency | Scope                  | Participants                                    |
| ----------------------------- | --------- | ---------------------- | ----------------------------------------------- |
| **PR Architecture Gate**      | Per PR    | Rule compliance        | Code reviewer + CEngO (for Level 2+ exceptions) |
| **Architecture Sync**         | Weekly    | Cross-cutting concerns | All engineers                                   |
| **Architecture Review Board** | Monthly   | ADRs, major decisions  | CEngO, CTO, Architects                          |
| **Architecture Health Check** | Quarterly | Rule compliance audit  | CEngO + Engineering team                        |

---

## Architecture Rules Summary Matrix

| Rule                     | Level     | Category     | Enforcement       | Exception Path |
| ------------------------ | --------- | ------------ | ----------------- | -------------- |
| 1.1 DDD Separation       | Immutable | Organization | Lint + Review     | CEO approval   |
| 1.2 Provider Abstraction | Immutable | Coupling     | Architecture gate | CEO approval   |
| 1.3 Domain Layer Purity  | Immutable | Organization | ESLint            | CEO approval   |
| 1.4 Privacy by Default   | Immutable | Security     | Lint + Review     | CEO approval   |
| 1.5 Event-Driven Comm.   | Immutable | Integration  | Architecture gate | CEO approval   |
| 2.1 Layered Dependencies | Strict    | Organization | ESLint            | ADR            |
| 2.2 API Contract First   | Strict    | Process      | CI check          | ADR            |
| 2.3 Event Versioning     | Strict    | Integration  | CI check          | ADR            |
| 2.4 Stateless Components | Strict    | Design       | Review            | ADR            |
| 2.5 Observability        | Strict    | Operations   | Review + CI       | ADR            |
| 2.6 Aggregate Boundaries | Strict    | Design       | Review            | ADR            |
| 2.7 Feature Flags        | Strict    | Process      | Review            | ADR            |

---

## Cross-Reference Summary

| Reference        | Relationship to Architecture Rules                                         |
| ---------------- | -------------------------------------------------------------------------- |
| **ARC-001**      | 12 Principles are operationalized as rules (Rule 1.2 = Principle #2, etc.) |
| **ENG-001**      | DDD patterns (bounded contexts, aggregates, domain events) become rules    |
| **ENG-002**      | Service contracts enforce API contract-first rule                          |
| **CMP-002**      | Compliance requirements are encoded in privacy and security rules          |
| **TECH-001/D01** | Technology decision framework evaluates tech against these rules           |
| **IMP-001/D08**  | Quality Assurance defines compliance verification process                  |

---

## Document Governance

| Aspect                     | Standard                                                            |
| -------------------------- | ------------------------------------------------------------------- |
| **Version**                | 1.0                                                                 |
| **Status**                 | Final                                                               |
| **Owner**                  | Chief Engineering Officer (CEngO)                                   |
| **Review Cadence**         | Quarterly                                                           |
| **Approval Required**      | CEngO + CTO                                                         |
| **Violation Consequences** | Level 1 violations block deployment; Level 2 exceptions require ADR |
