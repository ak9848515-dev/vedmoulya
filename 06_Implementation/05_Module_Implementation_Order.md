# Module Implementation Order

**BLP-001 — Document 05/15 — Implementation Strategy & Delivery Blueprint**
**Version:** 1.0
**Status:** LOCKED
**Owner:** Staff Software Engineer
**Created:** 2026-07-27
**Design Freeze:** 2026-07-27

---

## Purpose

This document defines the **exact order in which modules are implemented**, the dependency reasoning behind this order, parallel work opportunities, the critical path, and risk reduction strategies.

---

## Implementation Order

```text
MODULE IMPLEMENTATION ORDER — TOPOLOGICAL SORT

ORDER  MODULE                    DEPENDS ON                    PHASE  TRACK
─────  ──────                    ──────────                    ─────  ─────
  1    Dev Environment           (none)                        P1     A
  2    Engineering Standards     (none)                        P1     A
  3    Security Service          (none)                        P1     A
  4    Audit Service             3 (Security)                  P1     A
  5    Identity Service          3,4 (Security, Audit)         P1     A
  6    AI Orchestrator           (none)                        P1     A
  7    User DNA Service          5 (Identity)                  P2     A
  8    Memory Service            5,7 (Identity, DNA)           P2     A
  9    Context Service           5,7,8 (Identity, DNA, Mem)   P2     A
  10   Notification Service      5,9 (Identity, Context)       P2     B
  11   Analytics Service         All (events)                  P2     B
  12   Knowledge Graph           5,7 (Identity, DNA)           P3     A
  13   Decision Engine           5,7,9,12 (All intelligence)   P3     A
  14   Execution Engine          5,7,9,12,13 (All intelligence) P3    A
  15   Recommendation Engine     5,7,12 (Identity, DNA, KG)    P3     A
  16   Progress Service          7,14 (DNA, Execution)         P3     B
  17   Career Module             12,13,14,15 (All intelligence) P4     A
  18   Learning Module           12,13,14,15 (All intelligence) P5     A
  19   Business Module           12,13,14,15 (All intelligence) P6     A
  20   Finance Module            19 (Business)                  P6     A
  21   Marketplace               19,20 (Business, Finance)     P7     A
  22   Community Module          5,21 (Identity, Marketplace)  P7     B
  23   Life OS                   17-22 (All modules)           P8     A
  24   Enterprise Features       23 (Life OS + All)            P9     B
  25   Health Module             12,13,14 (Intelligence)       Post-GA A
```

---

## Why This Order

### Tier 0: Engineering Foundation (Order 1-2)

Development environment and standards have zero dependencies. They must exist before any code is written to ensure consistency from day one.

### Tier 1: Foundation Services (Order 3-6)

Security, Audit, Identity, and AI Orchestrator are the non-negotiable base. Every other service depends on:

- **Security** for authentication, authorization, encryption
- **Audit** for compliance (CMP-002)
- **Identity** for user context
- **AI Orchestrator** for AI-powered features

### Tier 2: Core Platform (Order 7-11)

User DNA, Memory, and Context enable personalization. Notification and Analytics provide infrastructure. Career and Learning depend on these for personalized experiences.

### Tier 3: Intelligence Engines (Order 12-16)

Knowledge Graph, Decision Engine, Execution Engine, and Recommendation Engine form the intelligence core. Every domain module depends on these engines:

- **Knowledge Graph** for entity/relationship management
- **Decision Engine** for intelligent recommendations
- **Execution Engine** for plan execution
- **Recommendation Engine** for personalization

### Tier 4: Domain Modules (Order 17-20)

Career and Learning are the highest-priority domains (RSH-001). Business and Finance follow. Each domain module depends on all intelligence engines.

### Tier 5: Integration Modules (Order 21-23)

Marketplace depends on Business/Finance. Community depends on Marketplace. Life OS is the final integration layer connecting all modules.

### Tier 6: Enterprise (Order 24-25)

Enterprise features and Health are post-GA, requiring the complete platform to be operational.

---

## Prerequisites

| Module           | Prerequisites                                         | Status Before Start                          |
| ---------------- | ----------------------------------------------------- | -------------------------------------------- |
| Dev Environment  | None                                                  | Technology decisions finalized               |
| Security Service | None                                                  | Compliance requirements documented (CMP-002) |
| Audit Service    | Security                                              | Audit event schema defined                   |
| Identity Service | Security, Audit                                       | User model defined                           |
| AI Orchestrator  | None                                                  | Provider contracts negotiated                |
| Knowledge Graph  | Identity, DNA, Security                               | Entity model approved (ENG-001)              |
| Decision Engine  | Identity, DNA, Knowledge, Context                     | Decision types defined (ARC-002)             |
| Execution Engine | Identity, DNA, Knowledge, Context, Decision, Planning | Execution lifecycle defined (ARC-004)        |
| Career Module    | All intelligence engines                              | Career contract defined (ENG-002)            |
| Learning Module  | All intelligence engines                              | Learning contract defined (ENG-002)          |

---

## Parallel Work Opportunities

### Track Architecture

```text
SPRINT  TRACK A (Main)            TRACK B (Support)         TRACK C (UI)
──────  ────────────────────────  ────────────────────────  ───────────────────
1-2     Dev Env + Standards       (waiting)                  (waiting)
3-6     Foundation Services       (waiting)                  Auth UI
7-12    Core Platform             Infrastructure Services    Platform UI
13-16   Intelligence (KG + Dec)   Context + Memory           Intelligence UI
17-20   Intelligence (Exec + Rec) Planning + Progress        Execution UI
21-28   Career Module             Analytics                  Career UI
29-36   Learning Module           Notification               Learning UI
37-44   Business + Finance        (consolidate)              Business/Finance UI
45-52   Marketplace + Community   Scale Infrastructure       Market/Community UI
53-56   Life OS                   Production Readiness       Life OS UI
57-65   Enterprise Features       Performance/Security       Enterprise UI
```

### Parallelization Rules

| Rule                                  | Description                                                       |
| ------------------------------------- | ----------------------------------------------------------------- |
| **UI follows Service**                | UI for a capability is never built before the service it consumes |
| **Infrastructure follows Foundation** | Infrastructure services start after Foundation is stable          |
| **Testing is parallel**               | QA writes tests alongside development, not after                  |
| **Documentation is parallel**         | Technical writing happens alongside development                   |
| **AI follows Data**                   | AI-dependent features built after data services they consume      |

---

## Critical Path

The critical path is the longest sequence of dependent work that determines the minimum project duration:

```text
Dev Env → Standards → Security → Audit → Identity → DNA → Knowledge Graph →
Decision Engine → Execution Engine → Career Module → Learning Module →
Business Module → Marketplace → Life OS → Production Readiness → GA

CRITICAL PATH DURATION: ~62 weeks (Foundation → GA)
```

**Critical Path Items (non-compressible):**

1. Foundation Services (Weeks 1-8) — Everything depends on these
2. Knowledge Graph → Decision → Execution (Weeks 13-20) — Intelligence sequential dependency
3. Career → Business → Marketplace (Weeks 21-44) — Domain sequential dependency
4. Marketplace → Life OS (Weeks 45-56) — Integration dependency

---

## Risk Reduction Strategy

### Parallel Track Risk Mitigation

| Risk                              | Mitigation                                                 | Implementation     |
| --------------------------------- | ---------------------------------------------------------- | ------------------ |
| Single point of failure (Founder) | AI pre-review + automated gates + knowledge transfer       | From Week 1        |
| Knowledge Graph complexity        | Implement minimum viable entities first; expand later      | Phase 3 Sprint 1-2 |
| AI provider reliability           | Multi-provider from day one; mock provider for dev         | Phase 1            |
| Integration complexity            | Contract-first development; integration tests per sprint   | From Week 1        |
| Performance issues                | Performance budget enforced in CI; baseline measured early | From Phase 1       |

### Ordering Decisions That Reduce Risk

| Decision                                             | Risk Reduced          | Rationale                                               |
| ---------------------------------------------------- | --------------------- | ------------------------------------------------------- |
| Security first (Order 3)                             | Security debt         | Security vulnerabilities prevented from day one         |
| Knowledge Graph before Decision (Order 12 before 13) | Data availability     | Decision engine requires quality knowledge              |
| Career before Learning (Order 17 before 18)          | Pattern establishment | Career establishes the domain pattern; Learning follows |
| MVP freeze (excluded items)                          | Scope creep           | Clear boundaries prevent uncontrolled expansion         |

---

## Architecture References

| Reference | Relationship                                                                     |
| --------- | -------------------------------------------------------------------------------- |
| ARC-001   | Architecture Principle #8 (Modular) ensures independent module implementation    |
| ARC-003   | Knowledge Graph is the first intelligence engine — all others depend on it       |
| ARC-004   | Execution Engine is implemented only after Decision and Planning are operational |
| ENG-002   | Service contracts define stable APIs for consumer modules                        |
| ENG-004   | Module Dependencies (D06) provide the dependency matrix for this order           |

---

## Cross-References

| Reference     | Relationship                                                                       |
| ------------- | ---------------------------------------------------------------------------------- |
| CMP-001       | "Execution First" — Execution Engine implemented as soon as dependencies are ready |
| CMP-002       | Security and Audit first — no service operates without compliance controls         |
| RSH-001       | Career and Learning are the first domain modules (highest-priority user problems)  |
| PRD-001       | Human Journey stages determine domain sequence                                     |
| BLP-001 / D03 | Development Phases implement this ordering at the phase level                      |
| BLP-001 / D09 | Testing Strategy validates module dependencies in CI                               |

---

## Quality Review

| Dimension                         | Assessment                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| **Why**                           | Without a defined order, teams build modules that block each other on missing dependencies. |
| **Engineering Reasoning**         | Topological sort ensures every module has its prerequisites before implementation begins.   |
| **Psychology Reasoning**          | Clear ordering reduces uncertainty. Teams know exactly what they'll build and when.         |
| **Accessibility Impact**          | UI is built only after services exist — accessibility built into UI from the start.         |
| **Trust Impact**                  | Predictable delivery builds stakeholder trust. No module surprises.                         |
| **Consistency with DES Missions** | References all intelligence and domain architectures for dependency validation.             |
| **Implementation Complexity**     | LOW — The order is defined; execution complexity is in dependency management.               |
| **Future Scalability**            | The model extends to any new module — add to topological sort where dependencies allow.     |

---

## Design Freeze Status

| Status    | Date       | Notes                                                                                        |
| --------- | ---------- | -------------------------------------------------------------------------------------------- |
| ✅ LOCKED | 2026-07-27 | Module Implementation Order v1.0 frozen. Changes require Architecture Review Board approval. |
