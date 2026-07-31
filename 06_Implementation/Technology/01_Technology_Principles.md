# Technology Principles

**BLP-002 — Document 01/15 — Technology Stack & Platform Decisions**
**Version:** 1.0
**Status:** LOCKED
**Owner:** Chief Technology Officer
**Created:** 2026-07-27
**Design Freeze:** 2026-07-27

---

## Purpose

This document defines the **permanent technology principles** that govern every technology decision for VedMoulya. These principles are the lens through which every tool, framework, platform, and dependency is evaluated.

---

## Core Principles

### P1: TypeScript Everywhere

| Aspect                      | Detail                                                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Decision**                | TypeScript is the single language for all application code (frontend, backend, AI, shared libraries)                 |
| **Alternatives Considered** | Rust (too slow for rapid iteration), Go (poor AI ecosystem), Python (poor frontend integration)                      |
| **Reason**                  | Single language maximizes code sharing, reduces context switching, and leverages the full-stack TypeScript ecosystem |
| **Exception**               | Infrastructure scripts (Dockerfiles, CI/CD configs) may use YAML or HCL                                              |

### P2: Provider-Agnostic AI

| Aspect                      | Detail                                                                          |
| --------------------------- | ------------------------------------------------------------------------------- |
| **Decision**                | All AI capabilities depend on abstractions, not concrete providers              |
| **Alternatives Considered** | Lock-in to single provider (dangerous — violates ARC-005)                       |
| **Reason**                  | AI provider landscape evolves rapidly; provider lock-in is existential risk     |
| **Implementation**          | Vercel AI SDK provides the abstraction layer; providers implement the interface |

### P3: PostgreSQL Default

| Aspect                      | Detail                                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Decision**                | PostgreSQL is the default data store. Extensions provide graph, vector, and full-text search capabilities                                  |
| **Alternatives Considered** | Separate DB for each concern (MySQL, Neo4j, Elasticsearch, Pinecone — too complex for MVP)                                                 |
| **Reason**                  | PostgreSQL's extension ecosystem (pgvector, PostGIS, pg_graphql, full-text search) covers 90% of requirements without multiple data stores |
| **Exception**               | Dedicated stores added only when PostgreSQL cannot meet performance/scaling requirements                                                   |

### P4: Serverless-Ready by Design

| Aspect                      | Detail                                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Decision**                | All services are designed to run in serverless environments (edge, lambda, container) without modification |
| **Alternatives Considered** | Long-running servers (more ops complexity, higher cost at low scale)                                       |
| **Reason**                  | Serverless provides automatic scaling, zero idle cost, and reduced operational burden during MVP           |
| **Exception**               | Long-running AI inference workloads may require dedicated compute                                          |

### P5: Minimal Dependencies

| Aspect                      | Detail                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| **Decision**                | Every dependency must earn its place. Zero unnecessary dependencies.                     |
| **Alternatives Considered** | "Batteries included" frameworks (increase bundle size, security surface, complexity)     |
| **Reason**                  | Each dependency is a security risk, a maintenance burden, and a build-time cost          |
| **Implementation**          | Dependency review in every PR. Regular dependency audits. Bundle size enforcement in CI. |

### P6: Open Source First

| Aspect                      | Detail                                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Decision**                | Prefer open-source solutions over proprietary vendors where capability is equivalent                                  |
| **Alternatives Considered** | Enterprise vendors (higher cost, vendor lock-in, slower innovation cycles)                                            |
| **Reason**                  | Open source provides transparency, community support, self-hosting option, and no vendor lock-in                      |
| **Exception**               | Proprietary tools adopted when open-source alternatives don't meet requirements (e.g., OpenAI for frontier AI models) |

### P7: Standard Protocols

| Aspect                      | Detail                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Decision**                | Use standard protocols (HTTP, gRPC, WebSocket, OpenTelemetry, OpenAPI, OAuth 2.0, OIDC) over proprietary protocols |
| **Alternatives Considered** | Proprietary protocols (vendor lock-in, poor interoperability)                                                      |
| **Reason**                  | Standard protocols enable tooling ecosystem, interoperability, and future migration                                |

### P8: Cloud Agnostic (Within Reason)

| Aspect                      | Detail                                                                                                                             |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Decision**                | Architecture abstracts cloud provider primitives (object storage, queues, secrets). Prefer PostgreSQL-compatible managed services. |
| **Alternatives Considered** | Tight coupling to single cloud provider (migration impossible, pricing negotiation leverage lost)                                  |
| **Reason**                  | Cloud-agnostic architecture prevents lock-in and enables multi-cloud disaster recovery                                             |
| **Practicality**            | MVP targets a primary cloud provider (Vercel + Railway). Abstraction layer enables migration without rewrite.                      |

### P9: Developer Experience First

| Aspect                      | Detail                                                                                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Decision**                | Developer experience (DX) is a first-class concern in technology selection. Slower build times, confusing APIs, and poor debugging are unacceptable. |
| **Alternatives Considered** | "Bleeding edge" tools with poor DX (more time debugging than building)                                                                               |
| **Reason**                  | Small team + AI development requires frictionless tooling. Every developer minute saved is a feature delivered.                                      |

### P10: Future-Proof Through Abstraction

| Aspect                      | Detail                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Decision**                | Strategic abstractions isolate the system from technology evolution. AI providers, data stores, and cloud infrastructure are behind well-defined interfaces. |
| **Alternatives Considered** | Direct dependency on current best tool (painful migration when better options emerge)                                                                        |
| **Reason**                  | Technology landscape evolves rapidly. Abstractions enable adoption of better tools without rewriting.                                                        |

---

## Decision Framework

Every technology decision is evaluated against these criteria:

| Criterion              | Weight   | Description                                     |
| ---------------------- | -------- | ----------------------------------------------- |
| Architecture Alignment | Critical | Does it respect ARC-001 through ARC-005?        |
| TypeScript Support     | Critical | Does it have first-class TypeScript support?    |
| DX Quality             | High     | Is the developer experience excellent?          |
| Serverless Readiness   | High     | Can it run in serverless environments?          |
| Open Source            | Medium   | Is it open source with active community?        |
| MVP Practicality       | High     | Can we use it effectively with a small team?    |
| Future Scalability     | Medium   | Will it scale beyond MVP without replacement?   |
| Cost (MVP)             | Medium   | Is it cost-effective for MVP scale?             |
| Operational Complexity | High     | Can we operate it with minimal ops team?        |
| Ecosystem              | Medium   | Does it integrate well with other chosen tools? |

---

## Architecture References

| Reference | Relationship                                                                              |
| --------- | ----------------------------------------------------------------------------------------- |
| ARC-001   | Architecture Principles #3 (Privacy), #6 (Secure), #7 (Testable) guide technology choices |
| ARC-002   | Decision Intelligence requires provider-agnostic AI (P2), performance budget (P4)         |
| ARC-003   | Knowledge Graph requires PostgreSQL with graph capabilities (P3)                          |
| ARC-004   | Execution Engine requires event-driven infrastructure, Redis for state management         |
| ARC-005   | AI Orchestrator requires provider abstraction (P2), standard protocols (P7)               |

---

## Cross-References

| Reference     | Relationship                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------------- |
| CMP-001       | Constitutional values demand open-source, transparent technology (P6)                          |
| CMP-002       | Compliance requirements guide cloud provider selection, data encryption, audit logging         |
| RSH-001       | Research insights validate technology choices — proven tools for human problems                |
| PRD-001       | Human Journey Stages inform frontend framework choice (SSR for content, SPA for interactivity) |
| BLP-001 / D01 | Implementation Strategy defines the engineering philosophy these principles operationalize     |
| BLP-001 / D02 | Engineering Principle #6 (Provider-Agnostic AI) is directly implemented by P2                  |

---

## Quality Review

| Dimension              | Assessment                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| **Why**                | Without governing principles, technology choices become inconsistent, emotional, and difficult to defend. |
| **Business Impact**    | Right choices accelerate delivery 2-3x. Wrong choices cause 6-12 month rewrites.                          |
| **Engineering Impact** | TypeScript everywhere eliminates context switching. Provider-agnostic AI prevents rewriting AI features.  |
| **Operational Impact** | PostgreSQL default reduces data store complexity. Serverless-ready minimizes ops burden.                  |
| **Security Impact**    | Minimal dependencies reduces attack surface. Open source enables community security review.               |
| **Performance Impact** | Serverless-ready ensures auto-scaling. Minimal dependencies reduces bundle size.                          |
| **Cost Impact**        | Open source = no license costs. PostgreSQL default = one managed DB. Serverless = no idle cost.           |
| **Future Scalability** | Every principle anticipates future scale. Abstraction layers enable technology migration.                 |

---

## Design Freeze Status

| Status    | Date       | Notes                                                            |
| --------- | ---------- | ---------------------------------------------------------------- |
| ✅ LOCKED | 2026-07-27 | Technology Principles v1.0 frozen. Changes require CTO approval. |
