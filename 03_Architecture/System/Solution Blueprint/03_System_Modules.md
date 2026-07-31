# System Modules

**ENG-004 — Document 03/10 — Solution Blueprint**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Solution Architect
**Created:** 2026-07-27
**Cross-references:** CMP-001, PRD-001, PRD-002, ARC-001, ARC-002, ARC-003, ARC-004, ARC-005, ENG-001, ENG-002, ENG-003

---

## Purpose

This document defines every **module** within the VedMoulya platform — their purpose, ownership, and dependencies. Modules are the functional building blocks that compose the platform.

---

## Module Map

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                            VEDMOULYA MODULE MAP                                              │
│                                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                   PRODUCT MODULES (PRD-001 Human Journey)                              │  │
│  │                                                                                        │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │  │
│  │  │ Discover │  │  Learn   │  │  Build   │  │  Earn    │  │  Grow    │                 │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘                 │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                               │  │
│  │  │  Manage  │  │Community │  │    AI    │  │ Platform │                               │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                               │  │
│  └──────────────────────────────────────────────────────────────────────────────────────┘  │
│                                      │                                                       │
└──────────────────────────────────────┼──────────────────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────┼──────────────────────────────────────────────────────┐
│                   SERVICE MODULES (ENG-002 Services)                                          │
│                                      │                                                       │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐  │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐ │  │
│  │  │Identity │  │  DNA   │  │Progress│  │Knowl.  │  │Memory  │  │Context │  │Decision│ │  │
│  │  └────────┘  └────────┘  └────────┘  └────────┘  └────────┘  └────────┘  └────────┘ │  │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐ │  │
│  │  │Planning│  │Execut. │  │Recomm. │  │ Career │  │Learning│  │Business│  │Finance │ │  │
│  │  └────────┘  └────────┘  └────────┘  └────────┘  └────────┘  └────────┘  └────────┘ │  │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐ │  │
│  │  │ Health │  │Marketpl│  │Notifica│  │Analyt. │  │AI Orch.│  │Security│  │ Audit  │ │  │
│  │  └────────┘  └────────┘  └────────┘  └────────┘  └────────┘  └────────┘  └────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────────────────────┘  │
│                                      │                                                       │
└──────────────────────────────────────┼──────────────────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────┼──────────────────────────────────────────────────────┐
│                   INTELLIGENCE ENGINES (ARC-002 through ARC-005)                              │
│                                      │                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Decision │  │Knowledge │  │ Execution │  │ Planning │  │    AI    │  │ Reason   │       │
│  │ Engine   │  │  Graph   │  │  Engine   │  │  Engine  │  │Orchestra.│  │ Engine   │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                                              │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Module Definitions

### Product Modules (PRD-001 Human Journey)

| Module        | Purpose                                                                       | Journey Stage | Owner                 |
| ------------- | ----------------------------------------------------------------------------- | ------------- | --------------------- |
| **Discover**  | Help users discover their potential, career paths, and opportunities          | Stage 1       | Chief Product Officer |
| **Learn**     | Guide users through learning paths, courses, and skill development            | Stage 2       | Chief Product Officer |
| **Build**     | Help users build businesses, services, portfolios, and proof of work          | Stage 3       | Chief Product Officer |
| **Earn**      | Enable users to earn income through services, opportunities, and monetization | Stage 4       | Chief Product Officer |
| **Grow**      | Support career growth, transitions, and long-term professional development    | Stage 5       | Chief Product Officer |
| **Manage**    | Help users manage their business, finances, operations, and productivity      | Stage 6       | Chief Product Officer |
| **Community** | Connect users with peers, mentors, coaches, and collaborators                 | Stage 7       | Chief Product Officer |
| **AI**        | Provide AI-powered coaching, guidance, and intelligence across all stages     | All stages    | Chief AI Architect    |
| **Platform**  | Platform infrastructure, settings, security, and account management           | All stages    | CTO                   |

### Service Modules (ENG-002 — 21 Services)

#### User Services

| Service      | Module ID | Purpose                                                              | Owner                 |
| ------------ | --------- | -------------------------------------------------------------------- | --------------------- |
| **Identity** | SVC-ID    | User registration, authentication, authorization, session management | CTO                   |
| **DNA**      | SVC-DNA   | User DNA model — 8 dimensions — store, serve, update                 | Chief Product Officer |
| **Progress** | SVC-PROG  | Human Progress Index, growth rates, momentum, trend analysis         | Chief Product Officer |

#### Knowledge Services

| Service       | Module ID | Purpose                                                      | Owner                     |
| ------------- | --------- | ------------------------------------------------------------ | ------------------------- |
| **Knowledge** | SVC-KNOW  | Knowledge Graph gateway — entities, relationships, quality   | Chief Knowledge Architect |
| **Memory**    | SVC-MEM   | Session persistence, conversation history, contextual recall | Chief Knowledge Architect |
| **Context**   | SVC-CTX   | Real-time dynamic context assembly and management            | Chief Knowledge Architect |

#### Intelligence Services

| Service            | Module ID | Purpose                                                       | Owner                     |
| ------------------ | --------- | ------------------------------------------------------------- | ------------------------- |
| **Decision**       | SVC-DEC   | Context-aware decisions with scoring, confidence, explanation | Chief Decision Architect  |
| **Planning**       | SVC-PLAN  | Goal decomposition, plan generation, adaptation               | Chief Execution Architect |
| **Execution**      | SVC-EXEC  | Task orchestration, state tracking, feedback loops            | Chief Execution Architect |
| **Recommendation** | SVC-REC   | Personalized recommendations with scoring and diversity       | Chief Product Officer     |

#### Domain Services

| Service      | Module ID  | Purpose                                                       | Owner                 |
| ------------ | ---------- | ------------------------------------------------------------- | --------------------- |
| **Career**   | SVC-CAR    | Career paths, transitions, professional growth                | Chief Product Officer |
| **Learning** | SVC-LEARN  | Learning paths, courses, assessments, skill gaps              | Chief Product Officer |
| **Business** | SVC-BIZ    | Business guidance, client management, operations              | Chief Product Officer |
| **Finance**  | SVC-FIN    | Income/expense tracking, financial goals, pricing             | Chief Product Officer |
| **Health**   | SVC-HEALTH | Energy patterns, productivity, well-being, burnout prevention | Chief Product Officer |

#### Additional Modules

| Module        | Module ID    | Purpose                                                                             | Owner                 |
| ------------- | ------------ | ----------------------------------------------------------------------------------- | --------------------- |
| **Portfolio** | SVC-PORT     | Manage user's portfolio of projects, achievements, credentials, and proof of work   | Chief Product Officer |
| **Settings**  | SVC-SETTINGS | User preferences, notification preferences, privacy settings, account configuration | CTO                   |

> **Note on Module Coverage:** The user's specification lists "Execution" twice — once as a product module (execution-as-action) and once as a service module (SVC-EXEC). Execution as a service is listed under Intelligence Services above. The product-level Execution experience is delivered through the PRD-BUILD and PRD-MANAGE product modules.
>
> **Portfolio** is not a standalone service in the service catalog (ENG-002). It is a domain concept owned by Career and Execution services. As a product concern, Portfolio services are delivered through the Career, Build, and Community product modules.
>
> **Settings** is a cross-cutting concern managed through the Platform product module and Identity Service.

#### Infrastructure Services

| Service              | Module ID     | Purpose                                                     | Owner                  |
| -------------------- | ------------- | ----------------------------------------------------------- | ---------------------- |
| **Marketplace**      | SVC-MKT       | Listings, transactions, reviews, dispute resolution         | Chief Product Officer  |
| **Notification**     | SVC-NOTIF     | Multi-channel notification delivery and preferences         | CTO                    |
| **Analytics**        | SVC-ANALYTICS | Event collection, metrics, dashboards, anomaly detection    | CTO                    |
| **AI Orchestration** | SVC-AI        | Provider abstraction, routing, context assembly, validation | Chief AI Architect     |
| **Security**         | SVC-SEC       | Authentication, authorization, encryption, threat detection | Chief Security Officer |
| **Audit**            | SVC-AUDIT     | Immutable audit trail, compliance verification              | Chief Security Officer |

### Intelligence Engines (ARC-002 through ARC-005)

| Engine                     | Mission | Purpose                                                               | Primary Service              |
| -------------------------- | ------- | --------------------------------------------------------------------- | ---------------------------- |
| **Decision Intelligence**  | ARC-002 | 10 decision types, lifecycle, scoring, confidence, explanation        | Decision Service             |
| **Knowledge Graph**        | ARC-003 | 31 entity types, 25 relationship types, 8 quality dimensions          | Knowledge Service            |
| **Execution Intelligence** | ARC-004 | 11-stage execution lifecycle, 8-level goal decomposition              | Planning, Execution Services |
| **AI Orchestrator**        | ARC-005 | 9 capability types, provider management, context assembly, validation | AI Orchestration Service     |

---

## Module Dependencies Summary

| Module ID     | Module Name      | Depends On                                                                      | Provided To               |
| ------------- | ---------------- | ------------------------------------------------------------------------------- | ------------------------- |
| PRD-DIS       | Discover         | SVC-CAR, SVC-REC                                                                | User                      |
| PRD-LEARN     | Learn            | SVC-LEARN, SVC-CAR, SVC-REC                                                     | User                      |
| PRD-BUILD     | Build            | SVC-BIZ, SVC-EXEC, SVC-PLAN                                                     | User                      |
| PRD-EARN      | Earn             | SVC-FIN, SVC-MKT, SVC-CAR                                                       | User                      |
| PRD-GROW      | Grow             | SVC-CAR, SVC-LEARN, SVC-REC                                                     | User                      |
| PRD-MANAGE    | Manage           | SVC-BIZ, SVC-FIN, SVC-EXEC                                                      | User                      |
| PRD-COMMUNITY | Community        | SVC-MKT, SVC-NOTIF, SVC-CAR                                                     | User                      |
| PRD-AI        | AI               | SVC-AI, SVC-DEC, SVC-REC, SVC-KNOW                                              | User                      |
| PRD-PLATFORM  | Platform         | SVC-ID, SVC-SEC, SVC-AUDIT, SVC-PROG                                            | User                      |
| SVC-ID        | Identity         | SVC-SEC, SVC-AUDIT                                                              | All services              |
| SVC-DNA       | DNA              | SVC-ID, SVC-SEC, SVC-KNOW                                                       | All intelligence + domain |
| SVC-PROG      | Progress         | SVC-ID, SVC-DNA, SVC-EXEC, SVC-CAR, SVC-LEARN, SVC-BIZ, SVC-FIN                 | Recommendation, UI        |
| SVC-KNOW      | Knowledge        | SVC-ID, SVC-SEC, SVC-DNA                                                        | All intelligence + domain |
| SVC-MEM       | Memory           | SVC-ID, SVC-SEC, SVC-DNA                                                        | Intelligence, AI          |
| SVC-CTX       | Context          | SVC-ID, SVC-SEC, SVC-DNA, SVC-MEM                                               | Intelligence, AI          |
| SVC-DEC       | Decision         | SVC-ID, SVC-DNA, SVC-KNOW, SVC-MEM, SVC-CTX, SVC-SEC                            | All domain                |
| SVC-PLAN      | Planning         | SVC-ID, SVC-DNA, SVC-KNOW, SVC-MEM, SVC-CTX, SVC-DEC, SVC-SEC                   | Execution, domain         |
| SVC-EXEC      | Execution        | SVC-ID, SVC-DNA, SVC-KNOW, SVC-MEM, SVC-CTX, SVC-DEC, SVC-PLAN, SVC-SEC         | All domain                |
| SVC-REC       | Recommendation   | SVC-ID, SVC-DNA, SVC-KNOW, SVC-MEM, SVC-CTX, SVC-SEC                            | All domain, UI            |
| SVC-CAR       | Career           | SVC-ID, SVC-DNA, SVC-KNOW, SVC-DEC, SVC-REC, SVC-PLAN, SVC-EXEC, SVC-SEC        | Marketplace, REC          |
| SVC-LEARN     | Learning         | SVC-ID, SVC-DNA, SVC-KNOW, SVC-DEC, SVC-REC, SVC-PLAN, SVC-EXEC, SVC-SEC        | Career, REC               |
| SVC-BIZ       | Business         | SVC-ID, SVC-DNA, SVC-KNOW, SVC-DEC, SVC-REC, SVC-PLAN, SVC-EXEC, SVC-SEC        | Finance, MKT              |
| SVC-FIN       | Finance          | SVC-ID, SVC-DNA, SVC-KNOW, SVC-DEC, SVC-PLAN, SVC-EXEC, SVC-SEC                 | Business, REC             |
| SVC-HEALTH    | Health           | SVC-ID, SVC-DNA, SVC-CTX, SVC-EXEC, SVC-SEC                                     | Planning, EXEC, REC       |
| SVC-MKT       | Marketplace      | SVC-ID, SVC-DNA, SVC-KNOW, SVC-CAR, SVC-BIZ, SVC-FIN, SVC-DEC, SVC-REC, SVC-SEC | UI                        |
| SVC-NOTIF     | Notification     | SVC-ID, SVC-CTX, SVC-SEC                                                        | All services (loosely)    |
| SVC-ANALYTICS | Analytics        | (all services as event source)                                                  | UI, Admin                 |
| SVC-AI        | AI Orchestration | SVC-ID, SVC-CTX, SVC-MEM, SVC-KNOW, SVC-SEC                                     | All services (AI needs)   |
| SVC-SEC       | Security         | (none)                                                                          | All services              |
| SVC-AUDIT     | Audit            | SVC-SEC                                                                         | All services              |

---

## Module Ownership Map

| Owner                     | Product Modules           | Service Modules                                                                         | Intelligence Engines             |
| ------------------------- | ------------------------- | --------------------------------------------------------------------------------------- | -------------------------------- |
| Chief Product Officer     | All 9 (Discover-Platform) | DNA, Progress, Recommendation, Career, Learning, Business, Finance, Health, Marketplace | —                                |
| Chief Knowledge Architect | —                         | Knowledge, Memory, Context                                                              | Knowledge Graph (ARC-003)        |
| Chief Decision Architect  | —                         | Decision                                                                                | Decision Intelligence (ARC-002)  |
| Chief Execution Architect | —                         | Planning, Execution                                                                     | Execution Intelligence (ARC-004) |
| Chief AI Architect        | AI Product Module         | AI Orchestration                                                                        | AI Orchestrator (ARC-005)        |
| CTO                       | Platform Product Module   | Identity, Notification, Analytics                                                       | —                                |
| Chief Security Officer    | —                         | Security, Audit                                                                         | —                                |

---

## Cross-References

| Reference | Relationship                                                                    |
| --------- | ------------------------------------------------------------------------------- |
| PRD-001   | 9 Product Modules correspond to the 9 Human Journey modules                     |
| ENG-002   | 21 Service Modules correspond to the 21 services defined in the service catalog |
| ARC-002   | Decision Intelligence engine powers the Decision Service                        |
| ARC-003   | Knowledge Graph engine powers the Knowledge Service                             |
| ARC-004   | Execution Intelligence engine powers Planning and Execution Services            |
| ARC-005   | AI Orchestrator engine powers the AI Orchestration Service                      |
| ENG-001   | Domain Model concepts are implemented through these modules                     |
