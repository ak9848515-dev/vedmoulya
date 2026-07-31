# Module Dependencies

**ENG-004 — Document 06/10 — Solution Blueprint**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Solution Architect
**Created:** 2026-07-27
**Cross-references:** CMP-001, ARC-001, ARC-002, ARC-003, ARC-004, ARC-005, ENG-001, ENG-002, ENG-003

---

## Purpose

This document defines the **dependency matrix** for all modules in the VedMoulya platform — specifying allowed dependencies, forbidden dependencies, and layering rules that govern module relationships.

---

## Dependency Philosophy

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                   DEPENDENCY PHILOSOPHY                                   │
│                                                                         │
│  1. Dependencies flow from HIGHER intent to LOWER capability            │
│  2. Domain modules never depend on other domain modules directly        │
│  3. Infrastructure modules never depend on domain modules               │
│  4. No circular dependencies — modules form a DAG                       │
│  5. Dependencies are on CONTRACTS, not on implementations               │
│  6. Every dependency is EXPLICIT and DOCUMENTED                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Dependency Hierarchy

```text
┌────────────────────────────────────────────────────────────────────┐
│                    MODULE DEPENDENCY HIERARCHY                       │
│                                                                     │
│  TIER 0: FOUNDATION (no dependencies)                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  Security    │  │  Audit       │  │  Identity    │             │
│  │  Service     │  │  Service     │  │  Service     │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│                                                                     │
│  TIER 1: USER & KNOWLEDGE (depend on Tier 0)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  DNA         │  │  Knowledge   │  │  Memory      │             │
│  │  Service     │  │  Service     │  │  Service     │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│  ┌──────────────┐                                                  │
│  │  Context     │                                                  │
│  │  Service     │                                                  │
│  └──────────────┘                                                  │
│                                                                     │
│  TIER 2: INTELLIGENCE (depend on Tiers 0-1)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  Decision    │  │  Planning    │  │  Recommend.  │             │
│  │  Service     │  │  Service     │  │  Service     │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│  ┌──────────────┐                                                  │
│  │  Execution   │                                                  │
│  │  Service     │                                                  │
│  └──────────────┘                                                  │
│                                                                     │
│  TIER 3: DOMAIN (depend on Tiers 0-2)                              │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                    │
│  │Career│ │Learn │ │Business│ │Finance│ │Health│                    │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘                    │
│                                                                     │
│  TIER 4: INFRASTRUCTURE (depend on Tiers 0-3)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ Marketplace  │  │ Notification │  │  Analytics   │             │
│  │  Service     │  │  Service     │  │  Service     │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│  ┌──────────────┐  ┌──────────────┐                               │
│  │  Progress    │  │  AI Orch.   │                               │
│  │  Service     │  │  Service     │                               │
│  └──────────────┘  └──────────────┘                               │
│                                                                     │
│  PRODUCT MODULES (depend on all service tiers)                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │ Discover  │ │  Learn   │ │  Build   │ │  Earn    │ │  Grow    ││
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘│
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│  │  Manage   │ │Community │ │    AI    │ │ Platform │             │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘             │
└────────────────────────────────────────────────────────────────────┘
```

---

## Dependency Matrix

### Service-to-Service Dependencies

| Service          | Depends On                                                                                     | Provided To                         |
| ---------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------- |
| Security         | (none)                                                                                         | ALL                                 |
| Audit            | Security                                                                                       | ALL                                 |
| Identity         | Security, Audit                                                                                | ALL                                 |
| DNA              | Identity, Security, Audit                                                                      | ALL intelligence, domain            |
| Knowledge        | Identity, Security, Audit, DNA                                                                 | ALL intelligence, domain            |
| Memory           | Identity, Security, Audit, DNA                                                                 | Intelligence, AI                    |
| Context          | Identity, Security, Audit, DNA, Memory                                                         | Intelligence, AI                    |
| Decision         | Identity, DNA, Knowledge, Memory, Context, Security, Audit                                     | Planning, Execution, ALL domain     |
| Planning         | Identity, DNA, Knowledge, Memory, Context, Decision, Security, Audit                           | Execution, ALL domain               |
| Execution        | Identity, DNA, Knowledge, Memory, Context, Decision, Planning, Security, Audit                 | ALL domain                          |
| Recommendation   | Identity, DNA, Knowledge, Memory, Context, Security, Audit                                     | ALL domain, UI                      |
| Career           | Identity, DNA, Knowledge, Decision, Recommendation, Planning, Execution, Security, Audit       | Marketplace, Recommendation         |
| Learning         | Identity, DNA, Knowledge, Decision, Recommendation, Planning, Execution, Security, Audit       | Career, Recommendation              |
| Business         | Identity, DNA, Knowledge, Decision, Recommendation, Planning, Execution, Security, Audit       | Finance, Marketplace                |
| Finance          | Identity, DNA, Knowledge, Decision, Planning, Execution, Security, Audit                       | Business, Recommendation            |
| Health           | Identity, DNA, Context, Execution, Security, Audit                                             | Planning, Execution, Recommendation |
| Marketplace      | Identity, DNA, Knowledge, Career, Business, Finance, Decision, Recommendation, Security, Audit | UI                                  |
| Notification     | Identity, Context, Security, Audit                                                             | ALL (loosely — events)              |
| Analytics        | (ALL as event source)                                                                          | UI, Admin                           |
| AI Orchestration | Identity, Context, Memory, Knowledge, Security, Audit                                          | ALL (AI capability)                 |
| Progress         | Identity, DNA, Execution, Career, Learning, Business, Finance, Security, Audit                 | Recommendation, UI                  |

### Product Module Dependencies

| Product Module | Depends On Services                                              |
| -------------- | ---------------------------------------------------------------- |
| Discover       | Career, Recommendation, Knowledge, DNA                           |
| Learn          | Learning, Career, Recommendation, Knowledge, Planning, Execution |
| Build          | Business, Execution, Planning, Knowledge, Finance                |
| Earn           | Finance, Marketplace, Career, Recommendation, Execution          |
| Grow           | Career, Learning, Recommendation, Progress, Knowledge            |
| Manage         | Business, Finance, Execution, Planning, Health                   |
| Community      | Marketplace, Notification, Career, Identity                      |
| AI             | AI Orchestration, Decision, Recommendation, Knowledge, Memory    |
| Platform       | Identity, Security, Audit, Progress, Notification                |

---

## Forbidden Dependencies

### Absolute Forbidden Patterns

| Pattern                          | Reason                                | Correction                          |
| -------------------------------- | ------------------------------------- | ----------------------------------- |
| Domain → Domain (direct)         | Creates tight coupling                | Route through Intelligence layer    |
| Infrastructure → Domain          | Infrastructure must not know domains  | Use events, not direct calls        |
| Foundation → Higher layer        | Circular dependency                   | Foundation depends on nothing       |
| Any → AI Provider (direct)       | Provider lock-in                      | Route through AI Orchestration      |
| Shared database between services | Data coupling violation               | Each service owns its data          |
| Synchronous chain 3+ deep        | Temporal coupling, cascading failures | Use events or workflow coordination |

### Specific Forbidden Patterns

| From             | To                  | Why Forbidden                        | Allowed Alternative                            |
| ---------------- | ------------------- | ------------------------------------ | ---------------------------------------------- |
| Career           | Learning            | Domain coupling                      | Use Decision Service for cross-domain          |
| Learning         | Career              | Domain coupling                      | Use Decision Service for cross-domain          |
| Business         | Marketplace         | Domain→Infrastructure coupling       | Use Recommendation for matching                |
| Execution        | Notification (sync) | Runtime coupling                     | Execution emits event; Notification subscribes |
| Analytics        | Any domain (sync)   | Hard dependency                      | Collect events asynchronously                  |
| AI Orchestration | Any domain          | Infrastructure must not know domains | Uses Context, Memory, Knowledge                |

---

## Layering Rules

### Rule 1: Strict Downward Dependency

All dependencies flow from higher tiers to lower tiers. A module in Tier N may depend on modules in Tiers 0 through N-1. No module in Tier N may depend on modules in Tier N+1 or above.

### Rule 2: Same-Tier Dependencies

Modules in the same tier should not depend on each other directly. If two same-tier modules need to collaborate, they should communicate through a lower-tier shared service or through events.

### Rule 3: Maximum Dependency Depth

No module should depend on a chain of more than 3 modules. Deep dependency chains indicate that intermediate modules should be bypassed or that the architecture needs refactoring.

### Rule 4: Dependency Inversion

Modules depend on **contracts**, not on other modules. The contract defines the capability; any module fulfilling that contract can serve as the dependency.

### Rule 5: Event-Based Decoupling

Cross-tier communication for state changes should use events, not synchronous calls. Events decouple the producer from consumers and allow multiple consumers without producer awareness.

### Rule 6: Explicit Documentation

Every dependency must be documented. Undocumented dependencies are architectural violations that must be resolved.

---

## Dependency Verification

### Verification Criteria

| Criterion                                 | Method                              |
| ----------------------------------------- | ----------------------------------- |
| No circular dependencies                  | Automated dependency graph analysis |
| No forbidden patterns                     | Automated pattern detection         |
| All dependencies documented               | Documentation audit                 |
| Dependency direction correct              | Layer verification                  |
| Contract-based (not implementation-based) | Contract compliance audit           |

### Verification Frequency

| Check                     | Frequency   | Owner              |
| ------------------------- | ----------- | ------------------ |
| Dependency graph analysis | Quarterly   | Solution Architect |
| Pattern detection         | Monthly     | CI Pipeline        |
| Documentation audit       | Quarterly   | Service Stewards   |
| Contract compliance       | Per release | Service Teams      |

---

## Cross-References

| Reference | Relationship                                                                                                            |
| --------- | ----------------------------------------------------------------------------------------------------------------------- |
| CMP-001   | "Execution before information" — Execution Service is available as a dependency for all domain services                 |
| CMP-002   | Compliance requirements may introduce additional dependency constraints (planned document)                              |
| RSH-001   | Validated human problems determine which domain services need to be connected as dependencies                           |
| PRD-001   | Human Journey stages determine which product modules depend on which services                                           |
| PRD-002   | User DNA is a Tier 1 dependency — all intelligence and domain services depend on it                                     |
| ARC-001   | Architecture Principles #4 (Composable) and #8 (Modular) govern dependency rules                                        |
| ARC-002   | Decision Service is a Tier 2 dependency — domain services depend on it for decision-making                              |
| ARC-003   | Knowledge Service is a Tier 1 dependency — many services depend on it for knowledge access                              |
| ARC-004   | Execution and Planning Services are Tier 2 dependencies — domain services depend on them for action                     |
| ARC-005   | AI Orchestration is cross-cutting — all services may consume AI capabilities through it, but none depend on it directly |
| ENG-001   | Bounded context boundaries enforce cross-context dependency rules                                                       |
| ENG-002   | Service dependencies defined in ENG-002/D06 are consolidated here                                                       |
| ENG-003   | Information types define data dependencies that services must respect                                                   |
