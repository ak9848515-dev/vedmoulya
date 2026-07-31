# MVP Definition

**BLP-001 — Document 04/15 — Implementation Strategy & Delivery Blueprint**
**Version:** 1.0
**Status:** LOCKED
**Owner:** VP of Engineering
**Created:** 2026-07-27
**Design Freeze:** 2026-07-27

---

## Purpose

This document defines **exactly what the VedMoulya MVP contains, does not contain, and under what conditions scope is frozen.** It is the binding scope contract that prevents scope creep and ensures focused delivery.

---

## MVP Scope Overview

```text
MVP = Foundation + Core Platform + Core Intelligence + Career + Learning + Web UI

MINIMUM VIABLE PRODUCT BOUNDARIES:

INCLUDED                     DEFERRED                     EXCLUDED
┌────────────────────┐      ┌────────────────────┐      ┌────────────────────┐
│ Foundation         │      │ Business Module    │      │ Native Mobile Apps │
│ Core Platform      │      │ Finance Module     │      │ Enterprise SSO     │
│ Knowledge Graph    │      │ Marketplace        │      │ Multi-tenancy      │
│ Decision Engine    │      │ Community Module   │      │ Federated AI       │
│ Execution Engine   │      │ Life OS Layer      │      │ Autonomous Agents  │
│ Career Module      │      │ Health Module      │      │ Desktop App        │
│ Learning Module    │      │ Advanced Analytics │      │ AR/VR              │
│ Web Application    │      │ API Marketplace    │      │ Offline Mode       │
│ Basic Auth         │      │ Native Mobile      │      │                    │
└────────────────────┘      └────────────────────┘      └────────────────────┘
```

---

## Included in MVP

### Foundation Services (ALL Included)

| Service                      | Version | Capabilities                                                                   |
| ---------------------------- | ------- | ------------------------------------------------------------------------------ |
| **Security Service**         | Full    | Authentication, authorization, encryption, secrets management, rate limiting   |
| **Audit Service**            | Full    | Immutable audit log, event-driven audit, query interface, tamper detection     |
| **Identity Service**         | Full    | User registration, profile management, session management, email verification  |
| **AI Orchestration Service** | Full    | Provider abstraction (3+ providers), basic routing, fallback, context assembly |

### Core Platform (ALL Included)

| Service                  | Version | Capabilities                                                           |
| ------------------------ | ------- | ---------------------------------------------------------------------- |
| **User DNA Service**     | Full    | DNA profile, assessment engine, preference management, personalization |
| **Memory Service**       | Full    | Short/long-term memory, recall, memory decay, history persistence      |
| **Context Service**      | Core    | Context assembly, state management, session continuity                 |
| **Notification Service** | Basic   | Email notifications, in-app notifications, preference management       |
| **Analytics Service**    | Basic   | Event ingestion, basic dashboards, usage metrics                       |

### Core Intelligence (ALL Included)

| Engine                    | Version | Capabilities                                                                                      |
| ------------------------- | ------- | ------------------------------------------------------------------------------------------------- |
| **Knowledge Graph**       | Full    | Entity CRUD (6 types), relationship management (6+ types), graph traversal, quality scoring       |
| **Decision Engine**       | Full    | Decision lifecycle (12 stages), multi-criteria scoring, confidence, explainability, feedback      |
| **Execution Engine**      | Full    | Goal decomposition, execution lifecycle (11 stages), plan generation, adaptive planning, policies |
| **Recommendation Engine** | Core    | Personalization, opportunity scoring, content ranking, basic recommendations                      |

### Domain Modules (Career + Learning Included)

| Module              | Version | Capabilities                                                                                          |
| ------------------- | ------- | ----------------------------------------------------------------------------------------------------- |
| **Career Module**   | Full    | Career goals, skill profile, path recommendation, skill gap analysis, career plans, progress tracking |
| **Learning Module** | Full    | Learning goals, learning paths, resource recommendation, progress tracking, spaced repetition         |

### Platform (Web App Included)

| Component           | Version    | Capabilities                                                                         |
| ------------------- | ---------- | ------------------------------------------------------------------------------------ |
| **Web Application** | Full       | Dashboard, career UI, learning UI, goal management, progress visualization, settings |
| **Mobile Web**      | Responsive | Same as web (responsive design, mobile-first)                                        |
| **REST APIs**       | Full       | All service contracts exposed as REST APIs with versioning                           |
| **Authentication**  | Standard   | Email/password, social login (Google, GitHub), OTP verification                      |
| **Documentation**   | Basic      | API docs, user guide, deployment guide                                               |

---

## Excluded from MVP

### Foundation & Platform

| Feature                         | When Planned | Rationale                                             |
| ------------------------------- | ------------ | ----------------------------------------------------- |
| Context Service (Advanced)      | Phase 7      | Rich context assembly not needed for MVP intelligence |
| Progress Service                | Phase 7      | Cross-domain progress orchestration is advanced       |
| Notification Service (Advanced) | Phase 7      | MVP uses basic in-app notifications                   |
| Native Mobile Apps              | Post-MVP     | Web-first; native apps after web validation           |
| Desktop Application             | Post-MVP     | Web covers desktop use cases                          |
| Offline Mode                    | Post-MVP     | Offline sync is significant complexity                |
| Enterprise SSO/SAML             | Phase 7      | Enterprise-only feature                               |
| Multi-tenancy/Organizations     | Phase 7      | Enterprise-only feature                               |
| API Marketplace                 | Phase 7      | Third-party API exposure deferred                     |

### Domain Modules

| Module              | When Planned | Rationale                                       |
| ------------------- | ------------ | ----------------------------------------------- |
| Business Module     | Phase 6      | Lower priority than Career/Learning per RSH-001 |
| Finance Module      | Phase 6      | Bound to Business module                        |
| Health Module       | Phase 8      | High sensitivity, requires mature compliance    |
| Marketplace Module  | Phase 7      | Requires Business + Finance prerequisites       |
| Community Module    | Phase 7      | Requires Marketplace + Identity maturity        |
| Life OS Integration | Phase 8      | Integration layer for post-MVP maturity         |

### Intelligence Features

| Feature                        | When Planned | Rationale                                     |
| ------------------------------ | ------------ | --------------------------------------------- |
| Real-time Collaborative KG     | Post-MVP     | Complex concurrency and conflict resolution   |
| Predictive Analytics           | Phase 7      | Requires sufficient training data             |
| Autonomous Execution           | Post-MVP     | MVP requires user-in-the-loop                 |
| Cross-user Anonymized Learning | Phase 7      | Privacy complexity requires mature governance |
| Natural Language Planning      | Phase 7      | MVP uses structured planning                  |
| Video/Audio Knowledge Capture  | Post-MVP     | Bandwidth and processing complexity           |

---

## Deferred (With Validation Triggers)

| Feature            | Deferred Until | Trigger for Earlier Start                          |
| ------------------ | -------------- | -------------------------------------------------- |
| Business Module    | Phase 6        | ≥20% of Beta users request business features       |
| Finance Module     | Phase 6        | ≥20% of Beta users request financial tracking      |
| Native Mobile Apps | Post-MVP       | ≥30% mobile web usage with session duration >10min |
| Offline Mode       | Post-MVP       | ≥20% of users experience connectivity issues       |
| Dark Mode          | Post-MVP       | ≥30% of users request dark mode                    |

---

## Stretch Goals

These features are desirable but will only be included if sprint velocity exceeds 120% of target for 3 consecutive sprints:

| Stretch Goal                             | Effort  | Value                       | Complexity |
| ---------------------------------------- | ------- | --------------------------- | ---------- |
| Advanced Analytics Dashboards            | 2 weeks | High — user insights        | Low        |
| Knowledge Import/Export                  | 1 week  | Medium — data portability   | Low        |
| Career Market Data Integration           | 3 weeks | High — salary benchmarks    | Medium     |
| Social Login Expansion (Apple, LinkedIn) | 1 week  | Medium — reduced friction   | Low        |
| Learning Resource API Integration        | 2 weeks | Medium — content enrichment | Medium     |

---

## Technical Assumptions

| #   | Assumption                                                           | Risk   | Mitigation                                                   |
| --- | -------------------------------------------------------------------- | ------ | ------------------------------------------------------------ |
| 1   | TypeScript/Node.js is appropriate for all services                   | Low    | Proven technology for the requirements                       |
| 2   | PostgreSQL is sufficient for Knowledge Graph (no dedicated graph DB) | Medium | Graph queries optimized; migrate to Neo4j if needed post-MVP |
| 3   | AI provider APIs remain available and reasonably priced              | Medium | Provider-agnostic abstraction; 3+ providers supported        |
| 4   | Monorepo with npm workspaces scales to 15+ packages                  | Low    | Well-established pattern for this scale                      |
| 5   | Single-region deployment sufficient for MVP                          | Low    | Multi-region planned for Phase 7                             |
| 6   | Web-first meets MVP user needs                                       | Low    | PWA covers basic mobile needs                                |

---

## Release Assumptions

| #   | Assumption                                   | Implication                     |
| --- | -------------------------------------------- | ------------------------------- |
| 1   | Alpha testers: internal + ≤50 invited        | No SLA, data may be reset       |
| 2   | Beta testers: ≤500 waitlisted users          | Best-effort support, no SLA     |
| 3   | RC testers: ≤5,000 registered users          | 99.5% availability target       |
| 4   | GA: general public                           | 99.9% availability target       |
| 5   | Phase durations are estimates, not deadlines | Adjust based on actual velocity |

---

## Non-Goals (MVP)

| #   | Non-Goal                                    | Rationale            |
| --- | ------------------------------------------- | -------------------- |
| 1   | Serve 10,000+ concurrent users              | Post-MVP scalability |
| 2   | Support enterprise compliance (SOC2, HIPAA) | Phase 7              |
| 3   | Provide native mobile applications          | Post-MVP             |
| 4   | Support offline-first architecture          | Post-MVP             |
| 5   | Provide real-time collaboration             | Post-MVP             |
| 6   | Support multiple languages (i18n)           | Post-MVP             |
| 7   | Provide white-label/custom branding         | Enterprise only      |
| 8   | Support third-party developer API           | Phase 7              |

---

## Scope Freeze Criteria

The MVP scope is considered **frozen** when the following conditions are met:

| #   | Condition                                       | Verification                |
| --- | ----------------------------------------------- | --------------------------- |
| 1   | MVP Definition document approved by ARB         | Approval recorded           |
| 2   | All included features have defined contracts    | Contract documents complete |
| 3   | All excluded features documented with rationale | Exclusion list reviewed     |
| 4   | Scope change process defined                    | Change control documented   |
| 5   | Stakeholder agreement documented                | Sign-off recorded           |

### Scope Change Process

```text
Scope Change Request → Product Lead Review → Impact Assessment →
Architecture Review Board → Approved/Rejected → Backlog Updated
```

**Rules:**

- No scope changes in the current sprint
- Every addition must trade an equivalent-effort feature
- Scope change requires >3 ARB members approval
- Emergency changes (security, compliance) bypass process but require post-facto approval

---

## Architecture References

| Reference | Relationship                                                                          |
| --------- | ------------------------------------------------------------------------------------- |
| ENG-004   | Solution Blueprint module dependencies validate MVP scope sequence                    |
| ARC-001   | Architecture Principle #9 (Execution First) governs MVP — execution is the core value |
| PRD-001   | Human Journey Stages 2 (Learn) and 3 (Build Career) are the MVP stages                |
| RSH-001   | Research validates Career and Learning as the highest-priority problems               |

---

## Cross-References

| Reference     | Relationship                                                                       |
| ------------- | ---------------------------------------------------------------------------------- |
| CMP-001       | MVP scope respects constitutional values — Career and Learning are highest-impact  |
| CMP-002       | MVP includes compliance controls for Career/Learning data; Health/Finance deferred |
| PRD-002       | User DNA is the personalization foundation for both Career and Learning in MVP     |
| BLP-001 / D03 | MVP maps to Development Phases 1-5                                                 |
| BLP-001 / D15 | Implementation Roadmap shows MVP timeline                                          |
| DES-010A      | All MVP UI complies with Experience Bible                                          |

---

## Quality Review

| Dimension                         | Assessment                                                                                                |
| --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Why**                           | Without a frozen MVP scope, development suffers from scope creep, missed deadlines, and unfocused effort. |
| **Engineering Reasoning**         | Clear scope boundaries enable focused engineering, accurate estimation, and predictable delivery.         |
| **Psychology Reasoning**          | Clear \"what's excluded\" reduces anxiety about feature requests. Team can focus on included scope.       |
| **Accessibility Impact**          | Accessibility is included in MVP — every screen meets WCAG AA minimum.                                    |
| **Trust Impact**                  | Delivering what's promised builds trust. Excluded features with rationale builds transparency.            |
| **Consistency with DES Missions** | MVP scope is aligned with DES-001 through DES-010 design requirements.                                    |
| **Implementation Complexity**     | LOW — Scope definition is low complexity; following it requires discipline.                               |
| **Future Scalability**            | The excluded/deferred model scales: every feature has a clear path to inclusion.                          |

---

## Design Freeze Status

| Status    | Date       | Notes                                                                           |
| --------- | ---------- | ------------------------------------------------------------------------------- |
| ✅ LOCKED | 2026-07-27 | MVP Definition v1.0 frozen. Changes require Architecture Review Board approval. |
