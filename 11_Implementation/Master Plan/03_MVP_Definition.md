# MVP Definition

**IMP-001 — Document 03/10 — Implementation Master Plan**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Program Architect
**Created:** 2026-07-27
**Cross-references:** CMP-001, CMP-002, RSH-001, PRD-001, PRD-002, ARC-001, ARC-002, ARC-003, ARC-004, ARC-005, ENG-001, ENG-002, ENG-003, ENG-004

---

## Purpose

This document defines **exactly what the VedMoulya MVP (Minimum Viable Product) contains and does not contain.** The MVP is the smallest working system that validates VedMoulya's core value proposition: AI-powered human potential realization through integrated intelligence.

---

## MVP Definition

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MVP SCOPE BOUNDARIES                                   │
│                                                                               │
│                                  ┌───────────────────────┐                    │
│                                  │     MVP CORE           │                   │
│                                  │                       │                   │
│                                  │  • User DNA           │                   │
│                                  │  • Knowledge Graph     │                   │
│                                  │  • Decision Engine     │                   │
│                                  │  • Execution Engine    │                   │
│                                  │  • AI Orchestration    │                   │
│                                  │  • Career Journey      │                   │
│                                  │  • Learning Journey    │                   │
│                                  │                       │                   │
│                                  └───────────────────────┘                    │
│                                         │                                     │
│           ┌─────────────────────────────┼─────────────────────────┐           │
│           │                             │                         │           │
│           ▼                             ▼                         ▼           │
│  ┌──────────────────┐        ┌──────────────────┐      ┌──────────────────┐  │
│  │ MVP INFRASTRUCTURE│        │ MVP AI PARTNERS  │      │ MVP PLATFORM     │  │
│  │                  │        │                  │      │                  │  │
│  │ • Security       │        │ • OpenAI (default) │     │ • Web App       │  │
│  │ • Audit          │        │ • Anthropic        │      │ • Simple Auth   │  │
│  │ • Identity       │        │ • DeepSeek         │      │ • Basic UI      │  │
│  │ • Orchestrator   │        │ • Mock (testing)   │      │                  │  │
│  └──────────────────┘        └──────────────────┘      └──────────────────┘  │
│                                                                               │
│  MVP = Foundation + Core Intelligence + Career + Learning + Web UI            │
│  MVP Alpha  = Core Intelligence (end of Phase 2)                             │
│  MVP Beta   = Career + Learning (end of Phase 4)                             │
│  MVP RC     = All of the above (end of Phase 6)                              │
│  MVP GA     = MVP RC + Enterprise readiness (end of Phase 7)                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## What Exists in MVP

### Foundation Services

| Service                      | MVP Version | Capabilities                                                                     |
| ---------------------------- | ----------- | -------------------------------------------------------------------------------- |
| **Security Service**         | Full        | Authentication, authorization, encryption, secrets management, rate limiting     |
| **Audit Service**            | Full        | Immutable audit log, event-driven audit, query interface, tamper detection       |
| **Identity Service**         | Full        | User registration, profile management, session management, identity verification |
| **AI Orchestration Service** | MVP         | Provider abstraction (3+ providers), basic routing, fallback, context assembly   |

### Core Intelligence Engines

| Engine               | MVP Version | Capabilities                                                                                                                              |
| -------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Knowledge Graph**  | Core        | Entity CRUD (User, Goal, Skill, Knowledge, Project, Decision), relationship management (6+ types), basic graph traversal, quality scoring |
| **Decision Engine**  | Core        | Decision lifecycle (12 stages), multi-criteria scoring, confidence assessment, explainability, feedback loop                              |
| **Execution Engine** | Core        | Goal decomposition, execution lifecycle (11 stages), plan generation, basic adaptive planning, policy enforcement                         |
| **Memory Service**   | Basic       | Short-term session memory, decision history, execution history, basic recall                                                              |

### Domain Modules

| Module              | MVP Version | Capabilities                                                                                                                                           |
| ------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Career Module**   | Full        | Career goal definition, skill profile, career path recommendation, skill gap analysis, career plan generation, progress tracking, milestone management |
| **Learning Module** | Full        | Learning goal definition, learning path generation, resource recommendation, progress tracking, knowledge gap analysis, spaced repetition              |

### Platform

| Component           | MVP Version | Capabilities                                                                                                                |
| ------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Web Application** | Full        | User dashboard, career dashboard, learning dashboard, goal management, progress visualization, knowledge explorer, settings |
| **Mobile Web**      | Responsive  | Same as web app (responsive design)                                                                                         |
| **APIs**            | RESTful     | All service contracts exposed as REST APIs                                                                                  |
| **Authentication**  | Standard    | Email/password, social login (Google, GitHub), OTP verification                                                             |
| **Documentation**   | Basic       | API docs, user guide, admin guide                                                                                           |

---

## What Does NOT Exist in MVP

### Foundation (Not in MVP)

| Service              | When Added         | Reason                                                               |
| -------------------- | ------------------ | -------------------------------------------------------------------- |
| Context Service      | Post-MVP (Phase 7) | Rich context assembly adds complexity beyond MVP needs               |
| Progress Service     | Post-MVP (Phase 7) | Cross-domain progress orchestration is an advanced feature           |
| Notification Service | Post-MVP (Phase 6) | Basic notifications exist in MVP as inline UI, not dedicated service |

### Domain Modules (Not in MVP)

| Module             | When Added         | Reason                                                                       |
| ------------------ | ------------------ | ---------------------------------------------------------------------------- |
| Business Module    | Phase 5            | Lower user priority than Career and Learning (based on RSH-001)              |
| Finance Module     | Phase 5            | Bound to Business module — not independent                                   |
| Health Module      | Post-MVP (Phase 7) | High sensitivity, requires mature compliance (CMP-002) before implementation |
| Marketplace Module | Phase 6            | Requires Business + Finance as prerequisites                                 |
| Community Module   | Phase 6            | Requires Marketplace + Identity maturity                                     |

### Platform Features (Not in MVP)

| Feature                     | When Added         | Reason                                                             |
| --------------------------- | ------------------ | ------------------------------------------------------------------ |
| Native Mobile Apps          | Post-MVP (Phase 7) | Web-first approach; native apps after web validation               |
| Desktop Application         | Post-MVP           | Low priority; web covers desktop use cases                         |
| Offline Mode                | Post-MVP (Phase 7) | Offline sync is significant complexity; defer after web validation |
| Enterprise SSO/SAML         | Phase 7            | Enterprise-only feature                                            |
| Multi-tenancy/Organizations | Phase 7            | Enterprise-only feature                                            |
| Advanced Analytics          | Phase 7            | Operational analytics exist in MVP; advanced analytics deferred    |
| Federated Intelligence      | Phase 7            | Requires multi-tenant maturity                                     |
| Autonomous Agents           | Post-MVP           | Advanced AI capability deferred beyond GA                          |
| Dedicated Mobile Apps       | Post-MVP           | Web PWA covers mobile MVP needs                                    |

### Intelligence Features (Not in MVP)

| Feature                                  | When Added         | Reason                                                       |
| ---------------------------------------- | ------------------ | ------------------------------------------------------------ |
| Real-time Collaborative Knowledge Graphs | Post-MVP           | Complex concurrency and conflict resolution                  |
| Predictive Analytics                     | Post-MVP (Phase 7) | Requires sufficient training data from MVP usage             |
| Autonomous Execution                     | Post-MVP           | Advanced capability; MVP requires user-in-the-loop           |
| Cross-user Anonymized Learning           | Phase 7            | Privacy and compliance complexity requires mature governance |
| Natural Language Planning                | Phase 7            | Advanced NLP capability; MVP uses structured planning        |
| Video/Audio Knowledge Capture            | Post-MVP           | Bandwidth and processing complexity deferred                 |

---

## MVP Success Criteria

### User Validation Criteria

| Criterion                            | Target                   | Measurement                      |
| ------------------------------------ | ------------------------ | -------------------------------- |
| User completes DNA profile           | ≥70% of registered users | Profile completeness metric      |
| User creates a career goal           | ≥50% of active users     | Goal creation count              |
| User completes first execution cycle | ≥40% of goal-creators    | Execution completion rate        |
| User returns within 7 days           | ≥40% of users            | 7-day retention                  |
| User returns within 30 days          | ≥20% of users            | 30-day retention                 |
| Career recommendation accuracy       | ≥70% user rating         | User feedback on recommendations |
| Learning recommendation accuracy     | ≥70% user rating         | User feedback on recommendations |

### Technical Criteria

| Criterion                        | Target                   | Measurement                     |
| -------------------------------- | ------------------------ | ------------------------------- |
| API availability                 | ≥99.5%                   | Uptime monitoring               |
| API response time (p95)          | ≤500ms                   | Latency monitoring              |
| AI response time (p95)           | ≤5s                      | AI response monitoring          |
| Knowledge Graph query time (p95) | ≤200ms                   | Query performance monitoring    |
| Decision computation time (p95)  | ≤1s                      | Decision performance monitoring |
| Data consistency                 | 100%                     | Consistency validation tests    |
| Audit completeness               | 100% of auditable events | Audit trail verification        |

### Business Criteria

| Criterion             | Target                    | Measurement         |
| --------------------- | ------------------------- | ------------------- |
| Registered users      | ≥1,000                    | User count          |
| Active users (weekly) | ≥200                      | Weekly active users |
| NPS score             | ≥30                       | User survey         |
| Critical bugs         | Zero in production        | Bug tracker         |
| Known issues          | Classified and documented | Issues log          |

---

## MVP Feature Flags

Features that are built but may be gated behind feature flags during MVP:

| Feature                          | Flag                      | Default | Rationale                                                   |
| -------------------------------- | ------------------------- | ------- | ----------------------------------------------------------- |
| Multiple AI providers            | `ai-multi-provider`       | ON      | Core value proposition; essential from day one              |
| Advanced decision explainability | `decision-deep-explain`   | ON      | Differentiator; but can be simplified if performance issues |
| Learning spaced repetition       | `learning-spaced-rep`     | ON      | Core learning feature; defer if complexity too high         |
| Career market data integration   | `career-market-data`      | OFF     | External data dependency; enable after baseline validation  |
| Social login                     | `auth-social-login`       | ON      | Reduces friction; essential for adoption                    |
| Knowledge import/export          | `knowledge-import-export` | OFF     | Enable based on user demand                                 |
| API rate limiting                | `api-rate-limiting`       | OFF     | Enable before public launch                                 |
| Advanced analytics dashboards    | `analytics-advanced`      | OFF     | Internal tool; enable for team use only                     |

---

## MVP Risk Boundaries

| Risk                    | Boundary                                               | Mitigation                                          |
| ----------------------- | ------------------------------------------------------ | --------------------------------------------------- |
| Scope creep             | Defined by "What Does NOT Exist" table above           | Architecture Review Board enforces scope boundaries |
| Quality regression      | Automated test suite for all MVP features              | CI/CD pipeline blocks merges that reduce coverage   |
| Performance degradation | MVP performance targets defined in success criteria    | Performance budget enforced in CI                   |
| Security vulnerability  | Security review gate before each release               | Penetration testing before Beta                     |
| Compliance violation    | CMP-002 compliance checklist for each release          | Compliance review gate                              |
| AI quality issues       | Human-in-the-loop for all AI-generated recommendations | User feedback loop + manual review triggers         |
| Data loss               | Backup and recovery procedures operational from Alpha  | Automated backups with point-in-time recovery       |

---

## MVP Release Definitions

### Alpha Release (Week 16)

**Purpose:** Internal validation of core intelligence engines

| Aspect                | Detail                                                              |
| --------------------- | ------------------------------------------------------------------- |
| **Audience**          | Internal team + invited testers (≤50)                               |
| **Capabilities**      | Knowledge Graph, Decision Engine, basic Execution, AI Orchestration |
| **Known Limitations** | No Career/Learning UI, basic web interface, limited error handling  |
| **Exit Criteria**     | Phase 2 exit criteria met                                           |
| **Data Persistence**  | Not guaranteed — data may be reset                                  |
| **SLA**               | None                                                                |

### Beta Release (Week 32)

**Purpose:** External validation with Career and Learning modules

| Aspect                | Detail                                                                             |
| --------------------- | ---------------------------------------------------------------------------------- |
| **Audience**          | Waitlisted users (≤500)                                                            |
| **Capabilities**      | Alpha capabilities + full Career module + full Learning module                     |
| **Known Limitations** | No Business/Finance/Marketplace, limited mobile support, performance not optimized |
| **Exit Criteria**     | Phase 4 exit criteria met                                                          |
| **Data Persistence**  | Guaranteed — no data resets after Beta                                             |
| **SLA**               | Best effort                                                                        |

### RC Release (Week 48)

**Purpose:** Pre-production validation of complete platform

| Aspect                | Detail                                                           |
| --------------------- | ---------------------------------------------------------------- |
| **Audience**          | All registered users (≤5,000)                                    |
| **Capabilities**      | Beta capabilities + Business + Finance + Marketplace + Community |
| **Known Limitations** | No enterprise features, performance targets not fully met        |
| **Exit Criteria**     | Phase 6 exit criteria met                                        |
| **Data Persistence**  | Guaranteed                                                       |
| **SLA**               | 99.5% availability target                                        |

### GA Release (Week 64)

**Purpose:** Production launch

| Aspect                | Detail                                     |
| --------------------- | ------------------------------------------ |
| **Audience**          | General public                             |
| **Capabilities**      | All MVP features + enterprise capabilities |
| **Known Limitations** | Documented in release notes                |
| **Exit Criteria**     | Phase 7 exit criteria met                  |
| **Data Persistence**  | Guaranteed with backup/recovery            |
| **SLA**               | 99.9% availability target                  |

---

## Cross-References

| Reference | Relationship                                                                                                           |
| --------- | ---------------------------------------------------------------------------------------------------------------------- |
| CMP-001   | MVP scope respects constitutional values — Career and Learning are the highest-impact human problems to solve first    |
| CMP-002   | MVP includes compliance controls for Career and Learning data; Health and Business compliance deferred to later phases |
| RSH-001   | MVP validates the highest-priority research findings — career development and learning are the top user problems       |
| PRD-001   | MVP covers Human Journey Stages 2 (Learn) and 3 (Build Career) — the core "Human Progress" journey                     |
| PRD-002   | User DNA is the personalization foundation for both Career and Learning in MVP                                         |
| ARC-001   | MVP respects architecture principles — modular, event-driven, AI-native from day one                                   |
| ENG-001   | MVP domain entities cover User, Goal, Skill, Knowledge, Project, Decision, Career, Learning                            |
| ENG-004   | MVP implements the minimum viable module set from the Solution Blueprint                                               |
