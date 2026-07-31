# Technology Roadmap

**TECH-001 — Document 10/10 — Technology Decision Record**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Technology Officer (CTO)
**Created:** 2026-07-27
**Cross-references:** CMP-001, CMP-002, ARC-001, ARC-005, ENG-002, ENG-004, IMP-001/D02, IMP-001/D06

---

## Purpose

This document defines the **technology evolution roadmap** for VedMoulya — how the technology stack evolves from prototype through enterprise scale. Technology decisions are made just-in-time, not all at once.

---

## Technology Evolution Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TECHNOLOGY EVOLUTION ROADMAP                                │
│                                                                               │
│  PHASE 1-2           PHASE 3-4            PHASE 5-6            PHASE 7+     │
│  PROTOTYPE → ALPHA   BETA → MVP           GROWTH               ENTERPRISE    │
│  (Weeks 1-20)        (Weeks 21-36)       (Weeks 37-52)        (Weeks 53-64) │
│ ─────────────────── ──────────────────── ──────────────────── ───────────── │
│                     │                    │                    │              │
│ FRONTEND            │                    │                    │              │
│  React + Next.js     │  React + Next.js   │  React + Next.js   │  React + React│
│  Tailwind CSS        │  Tailwind CSS      │  Tailwind CSS      │  Native (add)│
│  TypeScript          │  TypeScript        │  TypeScript        │  PWA → Tauri │
│                                                                               │
│ BACKEND              │                    │                    │              │
│  TypeScript (Node)   │  TypeScript (Node) │  TypeScript (Node) │  Go (extract)│
│  Modular Monolith    │  Modular Monolith  │  Modular Mono+     │  Services    │
│  In-process Events   │  In-process Events │  Message Queue     │  Event Stream│
│                                                                               │
│ DATA                 │                    │                    │              │
│  Postgres            │  Postgres          │  Postgres          │  Postgres    │
│  + Redis             │  + Redis           │  + Redis           │  + Redis     │
│  + Object Store      │  + Object Store    │  + Graph DB        │  + Graph DB  │
│  + pgvector          │  + Document Store  │  + Vector DB (ext) │  + Vector DB │
│                     │  + pgvector        │  + Event Stream    │  + Columnar  │
│                                                                               │
│ AI PROVIDERS         │                    │                    │              │
│  3 Providers         │  3+ Providers      │  5+ Providers      │  N Providers │
│  Manual Routing      │  Rule-Based Route  │  ML-Based Route    │  Local AI    │
│  No Cache            │  Response Cache    │  Pattern Cache     │  Full Cache  │
│                                                                               │
│ AUTH                 │                    │                    │              │
│  Email/Password      │  + Social Login    │  + MFA/TOTP        │  + SSO/SAML  │
│  JWT (localStorage)  │  + JWT (cookie)    │  + Passkeys        │  + SCIM      │
│  Simple RBAC         │  Simple RBAC       │  Granular RBAC     │  ABAC        │
│                                                                               │
│ CLOUD                │                    │                    │              │
│  GCP (single-zone)   │  GCP (multi-zone)  │  GCP (multi-region)│  Multi-cloud │
│  GKE (1-3 nodes)     │  GKE (HA)          │  GKE + CDN         │  GKE + EKS   │
│  Cloud SQL           │  Cloud SQL (repl)  │  Cloud SQL (scale) │  Distributed │
│                                                                               │
│ TOOLING              │                    │                    │              │
│  VS Code + Copilot   │  VS Code + Cursor  │  + QA Tools        │  + DevOps    │
│  GitHub Projects     │  GitHub Projects   │  Linear (migrate)  │  Full Suite  │
│  GitHub Actions      │  GitHub Actions    │  Advanced CI/CD    │  Multi-env   │
│                                                                               │
│ TESTING              │                    │                    │              │
│  Unit + Contract     │  + Integration     │  + E2E + AI Qual   │  + Security  │
│  Manual E2E          │  Automated E2E     │  + Perf Testing    │  + Chaos     │
│  AI Test Gen         │  AI Test Gen       │  + Reg. Testing    │  + Pen Test  │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1-2: Prototype → Alpha (Weeks 1-20)

### Technology Decisions to Make

| Decision                                      | Timing | Status     | Reference    |
| --------------------------------------------- | ------ | ---------- | ------------ |
| Frontend: React + Next.js + TypeScript        | Week 1 | ⬜ PENDING | TECH-001/D02 |
| Backend: TypeScript (Node.js)                 | Week 1 | ⬜ PENDING | TECH-001/D03 |
| Primary Database: PostgreSQL                  | Week 1 | ⬜ PENDING | TECH-001/D04 |
| Cache: Redis                                  | Week 1 | ⬜ PENDING | TECH-001/D04 |
| Object Storage: S3-compatible                 | Week 1 | ⬜ PENDING | TECH-001/D04 |
| Vector: pgvector (PostgreSQL)                 | Week 1 | ⬜ PENDING | TECH-001/D04 |
| AI Providers: OpenAI + Anthropic + DeepSeek   | Week 1 | ⬜ PENDING | TECH-001/D05 |
| Auth: JWT + bcrypt + library                  | Week 1 | ⬜ PENDING | TECH-001/D06 |
| Cloud: GCP                                    | Week 1 | ⬜ PENDING | TECH-001/D07 |
| CI/CD: GitHub Actions                         | Week 1 | ⬜ PENDING | TECH-001/D08 |
| Testing: Vitest + Playwright + Contract tests | Week 1 | ⬜ PENDING | TECH-001/D09 |

### What We DON'T Decide Yet

| Decision                  | Deferred Until        | Reason                                           |
| ------------------------- | --------------------- | ------------------------------------------------ |
| Graph database vendor     | Phase 5-6 (Growth)    | Relational KG is sufficient for MVP entity count |
| Dedicated vector database | Phase 5-6 (Growth)    | pgvector handles MVP embedding volume            |
| Event streaming platform  | Phase 7+ (Enterprise) | In-process events → message queue sufficient     |
| Service mesh              | Phase 5-6 (Growth)    | Monolith doesn't need service mesh               |
| Multi-cloud               | Phase 7+ (Enterprise) | Single cloud sufficient for MVP scale            |
| Enterprise SSO/SAML       | Phase 7+ (Enterprise) | Not needed for individual users                  |
| Mobile native apps        | Phase 7+ (Enterprise) | Web-first approach                               |
| Go extraction             | Phase 5-6 (Growth)    | Only if performance data justifies it            |

---

## Phase 3-4: Beta → MVP (Weeks 21-36)

### Technology Confirmations

| Decision                            | Status    | Confirmation Point                         |
| ----------------------------------- | --------- | ------------------------------------------ |
| React + Next.js is the right choice | ⬜ Verify | After Career + Learning UI implementation  |
| Modular monolith is sufficient      | ⬜ Verify | After Career + Learning module integration |
| PostgreSQL handles MVP workload     | ⬜ Verify | After Career + Learning data volume        |
| AI provider routing works           | ⬜ Verify | After multi-provider testing               |
| JWT auth is adequate                | ⬜ Verify | After beta user feedback                   |

### New Technology Considerations

| Consideration                | Trigger                                     | Action                                                        |
| ---------------------------- | ------------------------------------------- | ------------------------------------------------------------- |
| Document store (preferences) | Flexible preference schemas become unwieldy | Add MongoDB, Firestore, or document layer on Postgres (JSONB) |
| HttpOnly cookies for auth    | Security review recommendation              | Switch JWT from localStorage to httpOnly cookie               |
| Response cache for AI        | AI costs higher than expected               | Implement response cache layer                                |
| Automated E2E test suite     | Manual testing takes too long               | Build Playwright test suite for critical paths                |

---

## Phase 5-6: Growth (Weeks 37-52)

### Technology Additions

| Addition                                              | Rationale                                       | Timing     |
| ----------------------------------------------------- | ----------------------------------------------- | ---------- |
| **Graph Database** (extract from relational KG)       | Entity count > 10,000 or query latency > 200ms  | Week 37-40 |
| **Dedicated Vector Database** (extract from pgvector) | Embedding count > 1M or query latency > 100ms   | Week 37-40 |
| **Message Queue** (extract from in-process events)    | Need reliable cross-module event delivery       | Week 41-44 |
| **MFA/TOTP**                                          | Beta feedback requests stronger auth            | Week 41-44 |
| **Passkeys** (WebAuthn)                               | User demand for passwordless auth               | Week 45-48 |
| **Granular RBAC**                                     | Permission requirements become complex          | Week 45-48 |
| **Performance Testing**                               | Traffic increases beyond MVP baselines          | Week 45-48 |
| **Linear** (migrate from GitHub Projects)             | Team size > 10, need stronger sprint management | Week 49-52 |

### Technology Confirmations

| Decision                                       | Status      | Confirmation Point                              |
| ---------------------------------------------- | ----------- | ----------------------------------------------- |
| Should any service be extracted from monolith? | ⬜ Evaluate | After Business + Marketplace module integration |
| Is one cloud provider sufficient?              | ⬜ Evaluate | After multi-region assessment                   |
| Is current test strategy effective?            | ⬜ Evaluate | After growth-phase bug rate analysis            |
| Should Go be introduced?                       | ⬜ Evaluate | If performance data shows TypeScript bottleneck |

---

## Phase 7+: Enterprise (Weeks 53-64)

### Technology Additions

| Addition                                  | Rationale                                       | Timing     |
| ----------------------------------------- | ----------------------------------------------- | ---------- |
| **Event Stream** (Kafka/Redpanda)         | High-throughput event processing for enterprise | Week 53-56 |
| **Service Mesh** (Istio/Linkerd)          | Microservices need traffic management           | Week 53-56 |
| **Enterprise SSO/SAML**                   | Enterprise customer requirement                 | Week 53-56 |
| **SCIM**                                  | Automated user provisioning                     | Week 57-60 |
| **ABAC** (Attribute-Based Access Control) | Fine-grained permission requirements            | Week 57-60 |
| **Multi-Cloud DR** (GKE + EKS)            | Enterprise reliability requirements             | Week 57-60 |
| **Chaos Engineering**                     | Production resilience validation                | Week 57-60 |
| **Penetration Testing**                   | Compliance certification requirement            | Week 61-64 |
| **React Native** (mobile)                 | User demand validated, team capacity available  | Week 61-64 |
| **Tauri** (desktop)                       | User demand for native desktop experience       | Week 61-64 |
| **Local AI** (Ollama)                     | Enterprise privacy requirements                 | Week 61-64 |

### Technology Sunsetting Considerations

| Technology                      | Sunset If                                    | Replacement                       |
| ------------------------------- | -------------------------------------------- | --------------------------------- |
| GitHub Projects                 | Team > 10 engineers                          | Linear                            |
| pgvector (embedded in Postgres) | Dedicated vector DB performs better at scale | Pinecone/Weaviate/Milvus          |
| JWT-in-localStorage             | Enterprise security requirements             | httpOnly cookies or opaque tokens |
| Single GCP region               | Global user base                             | Multi-region GCP or multi-cloud   |
| Modular Monolith                | More than 5 services extracted               | Service-oriented architecture     |

---

## Technology Decision Timing Map

```text
DECISION TIMING MAP: What to decide when
──────────────────────────────────────────────────────────────────────────────

WEEK 1 (Phase 1 Start) ──────────────────────────────────────────────────────
  ✅ Frontend: React + Next.js + TypeScript + Tailwind CSS
  ✅ Backend: TypeScript (Node.js) — Modular Monolith
  ✅ Database: PostgreSQL + Redis + S3-compatible Object Store
  ✅ Vector: pgvector (PostgreSQL extension)
  ✅ AI: OpenAI + Anthropic + DeepSeek (abstraction layer)
  ✅ Auth: JWT + bcrypt + email/password + social login
  ✅ Cloud: GCP (single zone) + GKE + Terraform
  ✅ CI: GitHub Actions
  ✅ IDE: VS Code + Copilot
  ✅ Testing: Vitest + Playwright + Contract tests

WEEK 9 (Phase 2 Start) ──────────────────────────────────────────────────────
  ✅ AI Provider Routing: Rule-based routing implemented
  ✅ Auth: Social login (Google + GitHub) operational

WEEK 21 (Phase 3 Start) ─────────────────────────────────────────────────────
  ⬜ Document Store: Add if JSONB in Postgres is insufficient
  ⬜ Auth: httpOnly cookies if security review recommends it

WEEK 37 (Phase 5 Start) ─────────────────────────────────────────────────────
  ⬜ Graph Database: Extract if relational KG performance degrades
  ⬜ Vector Database: Extract if pgvector performance degrades
  ⬜ Message Queue: If in-process events insufficient
  ⬜ MFA/TOTP: If user demand validated

WEEK 45 (Phase 6 Start) ─────────────────────────────────────────────────────
  ⬜ Passkeys: If user demand validated
  ⬜ Granular RBAC: If permission requirements complex

WEEK 53 (Phase 7 Start) ─────────────────────────────────────────────────────
  ⬜ Enterprise SSO/SAML: Enterprise customer requirement
  ⬜ Event Stream: If message queue insufficient
  ⬜ Service Mesh: If microservices extraction well underway
  ⬜ Multi-Cloud: If DR requirements demand it

POST-GA ─────────────────────────────────────────────────────────────────────
  ⬜ React Native: Mobile app demand validated
  ⬜ Tauri: Desktop app demand validated
  ⬜ Local AI: Privacy/cost requirement
  ⬜ Go extraction: Performance data justifies it
```

---

## Technology Decision Principles

### Timing Principles

| Principle                                          | Description                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| **Just-in-time, not just-in-case**                 | Decide technology when you need it, not when you think you might         |
| **Defer decisions to the last responsible moment** | The more you know later, the better the decision                         |
| **Prototype before committing**                    | Build a small proof of concept before finalizing any technology decision |
| **Default to simple**                              | When in doubt, choose the simplest option that works now                 |
| **Cost of delay vs. cost of wrong decision**       | If delay cost > wrong decision cost, decide now. Otherwise, defer.       |

### Technology Debt Policy

| Debt Type                               | Acceptable?     | Max Lifetime         | Resolution                             |
| --------------------------------------- | --------------- | -------------------- | -------------------------------------- |
| Monolith instead of services            | Yes (strategic) | Until growth trigger | Extract services individually          |
| pgvector instead of dedicated vector DB | Yes (strategic) | Until growth trigger | Migrate to dedicated vector DB         |
| JWT/localStorage instead of cookies     | Yes (temporary) | Phase 3-4            | Switch when security review recommends |
| No E2E test automation                  | No              | 3 sprints            | Build automated E2E                    |
| No performance testing                  | No              | 2 sprints            | Add performance baseline               |
| Manual deployment                       | No              | 1 sprint             | Automate CI/CD                         |

---

## Cross-References

| Reference   | Relationship                                                                                         |
| ----------- | ---------------------------------------------------------------------------------------------------- |
| CMP-001     | "Technology is a means, not an end" — technology roadmap serves the human journey, not the other way |
| CMP-002     | Compliance requirements (SSO, audit, data residency) drive enterprise-phase technology additions     |
| ARC-001     | Architecture principles govern when to evolve technology — not all at once                           |
| ARC-005     | AI provider abstraction enables provider additions without architecture changes                      |
| ENG-002     | Service contracts are deployment-independent — technology evolution never breaks contracts           |
| ENG-004     | Solution Blueprint module dependencies define when new technologies are needed                       |
| IMP-001/D02 | Technology roadmap aligns with the 7-phase implementation roadmap                                    |
| IMP-001/D06 | Module Implementation Order determines when related technologies are introduced                      |
