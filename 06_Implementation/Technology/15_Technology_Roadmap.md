# Technology Roadmap

**BLP-002 — Document 15/15 — Technology Stack & Platform Decisions**
**Version:** 1.0
**Status:** LOCKED
**Owner:** Chief Technology Officer
**Created:** 2026-07-27
**Design Freeze:** 2026-07-27

---

## Purpose

This document defines the **technology evolution roadmap** — how the technology stack evolves from MVP through enterprise scale.

---

## Technology Evolution Phases

```text
MVP (v1.0)               Growth (v1.1-v1.5)        Scale (v2.0+)         Enterprise
Aug 2026 - Mar 2028      Mar 2028 - 2029           2029 - 2030           2030+
─────────────────────────────────────────────────────────────────────────────
Next.js 15 + App Router  React Native (mobile)     Tauri (desktop)       Custom Design System
Tailwind CSS v4          Advanced Design System     Design Tokens v2       White-label theming
shadcn/ui                Custom components          Component Library     Enterprise UI Kit
Framer Motion            Advanced animations        Motion Design System  Accessibility suite
OpenAI GPT-4o            Claude + Gemini + Local    Multi-model routing    Model fine-tuning
OpenAI embeddings        Cohere + Voyage           Local embeddings       Custom embedding model
PostgreSQL + pgvector    Read replicas             Citus sharding         Global distribution
Redis (Upstash)          Redis Cluster             Redis Enterprise       Multi-region Redis
BullMQ (single queue)    Priority queues           Distributed queues     Kafka for events
Vercel + Railway         AWS (multi-region)        Kubernetes (EKS)       Private cloud
GitHub Actions           Self-hosted runners       Custom CI/CD           Enterprise CI/CD
Grafana Cloud            Self-hosted Grafana       Grafana Enterprise     Custom observability
Auth.js                  Auth.js + MFA             Enterprise SSO/SAML    Federated identity
Doppler                  Vault (Enterprise)        Vault Cluster          Air-gapped Vault
```

---

## Phase 1: MVP (v1.0) — Current

**Timeline:** Aug 2026 — Mar 2028

### Technology Stack

| Layer         | Technology                                         | Status     |
| ------------- | -------------------------------------------------- | ---------- |
| Frontend      | Next.js 15, Tailwind CSS, shadcn/ui, Framer Motion | ✅ DECIDED |
| Backend       | Hono, Drizzle ORM, Zod, tRPC                       | ✅ DECIDED |
| Database      | PostgreSQL 16+, pgvector, Redis (Upstash)          | ✅ DECIDED |
| AI            | OpenAI GPT-4o, Vercel AI SDK, DeepSeek V3          | ✅ DECIDED |
| Ops           | GitHub Actions, Docker, Vercel + Railway, Doppler  | ✅ DECIDED |
| Security      | Auth.js, CASL, structured audit logging            | ✅ DECIDED |
| Observability | OpenTelemetry, Grafana Cloud (free), Langfuse      | ✅ DECIDED |

---

## Phase 2: Growth (v1.1-v1.5)

**Timeline:** Mar 2028 — 2029

### Additions/Changes

| Area           | Change                       | Trigger                       |
| -------------- | ---------------------------- | ----------------------------- |
| Mobile         | React Native (Expo)          | Mobile web >30% sessions      |
| Search         | Migrate to Meilisearch       | PostgreSQL FTS insufficient   |
| AI             | Add Claude + Gemini support  | User base grows               |
| Infrastructure | Add AWS for multi-region     | Cost >$500/month              |
| Performance    | PostgreSQL read replicas     | Read traffic >10x             |
| Testing        | Self-hosted Playwright Cloud | E2E suite >100 tests          |
| CI/CD          | Self-hosted runners          | GitHub Actions minutes >6,000 |

---

## Phase 3: Scale (v2.0+)

**Timeline:** 2029 — 2030

### Additions/Changes

| Area     | Change                             | Trigger                  |
| -------- | ---------------------------------- | ------------------------ |
| Desktop  | Tauri desktop app                  | User demand for native   |
| Graph DB | Evaluate Neo4j                     | Graph queries >500ms p95 |
| Caching  | Redis Cluster                      | Cache misses >10%        |
| Compute  | Kubernetes (EKS)                   | >20 services running     |
| AI       | Multi-model routing + local models | AI cost >$1,000/month    |
| Auth     | Enterprise SSO/SAML                | Enterprise customers     |
| Security | Vault Cluster                      | Compliance requirements  |

---

## Phase 4: Enterprise (2030+)

**Timeline:** 2030+

### Additions/Changes

| Area           | Change                         | Trigger                      |
| -------------- | ------------------------------ | ---------------------------- |
| Frontend       | Enterprise Design System       | White-label requirements     |
| Backend        | Federated GraphQL              | Service mesh complexity      |
| Data           | Global PostgreSQL distribution | Multi-region users           |
| AI             | Fine-tuned models              | Domain-specific requirements |
| Infrastructure | Private cloud / air-gapped     | Government/healthcare        |
| Observability  | Enterprise SIEM integration    | SOC2 Type II                 |

---

## Architecture References

| Reference     | Relationship                                                             |
| ------------- | ------------------------------------------------------------------------ |
| BLP-001 / D03 | Development Phases provide the timeline for technology evolution         |
| BLP-001 / D15 | Implementation Roadmap aligns technology evolution with product releases |

---

## Cross-References

| Reference     | Relationship                                                             |
| ------------- | ------------------------------------------------------------------------ |
| BLP-002 / D12 | Decision Record documents the future evolution paths for each technology |
| BLP-002 / D13 | Risk Analysis evaluates the risks of each technology transition          |

---

## Quality Review

| Dimension              | Assessment                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| **Why**                | Technology roadmap ensures the stack evolves in lockstep with product needs and scale requirements. |
| **Business Impact**    | Clear evolution path prevents premature optimization. MVP uses simple, fast tools.                  |
| **Engineering Impact** | Engineers know when to expect tool changes. No surprises during scaling.                            |
| **Operational Impact** | Each phase has specific triggers for infrastructure changes.                                        |
| **Security Impact**    | Enterprise SSO, Vault, and compliance features have clear timelines.                                |
| **Performance Impact** | Scaling triggers (read replicas, Redis Cluster) are defined before they're needed.                  |
| **Cost Impact**        | Each technology upgrade has a cost justification and trigger threshold.                             |
| **Future Scalability** | The roadmap extends to enterprise scale with clear milestones.                                      |

---

## Design Freeze Status

| Status    | Date       | Notes                                                   |
| --------- | ---------- | ------------------------------------------------------- |
| ✅ LOCKED | 2026-07-27 | Technology Roadmap v1.0 frozen. Updated per phase gate. |
