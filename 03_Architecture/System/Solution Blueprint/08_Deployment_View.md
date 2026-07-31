# Deployment View

**ENG-004 — Document 08/10 — Solution Blueprint**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Solution Architect
**Created:** 2026-07-27
**Cross-references:** CMP-001, ARC-001, ARC-005, ENG-002

---

## Purpose

This document provides the **conceptual deployment view** of the VedMoulya platform. It describes how the platform is deployed across web, mobile, desktop, cloud, local AI, external AI, and offline modes. This is NOT a cloud architecture, NOT an infrastructure specification, and NOT an implementation guide. It is a **conceptual model** of deployment concerns.

---

## Deployment Philosophy

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                   DEPLOYMENT PHILOSOPHY                                 │
│                                                                         │
│  The service architecture (ENG-002) is DEPLOYMENT INDEPENDENT.          │
│                                                                         │
│  This means:                                                             │
│  1. Service contracts do not assume any deployment topology             │
│  2. Services can be deployed together or separately                     │
│  3. Services can run on cloud, edge, or on-device                       │
│  4. Deployment decisions are LATER concerns — after contract design     │
│                                                                         │
│  The deployment view shows one possible conceptual topology,            │
│  not the ONLY topology.                                                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Conceptual Deployment Architecture

```text
┌═══════════════════════════════════════════════════════════════════════════════════════════════┐
║                          CONCEPTUAL DEPLOYMENT VIEW                                           ║
║                          ───────────────────────                                             ║
║                          Platform-independent — only the logical topology is described        ║
╚═══════════════════════════════════════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  PRESENTATION CLIENTS                                                                        │
│                                                                                              │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐                 │
│  │   WEB APP           │  │   MOBILE APP         │  │   DESKTOP APP       │                 │
│  │   (Browser)         │  │   (iOS / Android)    │  │   (Electron, native) │                 │
│  │                     │  │                      │  │                     │                 │
│  │  • Responsive UI    │  │  • Native UI         │  │  • Rich UI          │                 │
│  │  • Progressive      │  │  • Push notifications │  │  • Offline-first    │                 │
│  │  • Offline-capable  │  │  • Offline-first     │  │  • Local storage    │                 │
│  │  • Local caching    │  │  • Local AI (on-dev) │  │  • Local AI (Ollama)│                 │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘                 │
│                                                                                              │
│  All clients communicate through the same service contracts (ENG-002) via secure API.        │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  CLOUD PLATFORM (Primary Deployment)                                                         │
│                                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  API GATEWAY                                                                          │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │   │
│  │  │ Auth       │  │ Rate Limit │  │  Routing   │  │  Version   │  │  Load      │     │   │
│  │  │ Check      │  │            │  │            │  │  Negotiate │  │  Balance   │     │   │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘  └────────────┘     │   │
│  └──────────────────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                                         │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  SERVICE MESH                                                                          │   │
│  │                                                                                        │   │
│  │  Services are deployed as independently scalable units.                                │   │
│  │  Each service runs in its own container/process.                                       │   │
│  │  Services communicate through contracts, not directly.                                 │   │
│  │                                                                                        │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                   │   │
│  │  │Identity│ │  DNA   │ │Knowledge│ │ Memory │ │Decision│ │Planning│                   │   │
│  │  │Service │ │Service │ │Service  │ │Service │ │Service │ │Service │                   │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘                   │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                   │   │
│  │  │Execut. │ │Recommend│ │ Career │ │Learning│ │Business│ │Finance │                   │   │
│  │  │Service │ │Service  │ │Service │ │Service │ │Service │ │Service │                   │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘                   │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                   │   │
│  │  │ Health │ │Marketpl│ │Notifica│ │Analyt. │ │AI Orch.│ │Security│                   │   │
│  │  │Service │ │Service │ │Service │ │Service │ │Service │ │Service │                   │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘                   │   │
│  │                                                                                        │   │
│  └──────────────────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                                         │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  EVENT BUS / STREAMING PLATFORM                                                       │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐                    │   │
│  │  │  Event Topics    │  │  Event Streams    │  │  Event Storage   │                    │   │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘                    │   │
│  └──────────────────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                                         │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  DATA LAYER                                                                           │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │   │
│  │  │ Knowledge   │  │  Memory    │  │  User DNA  │  │  Event     │  │  Analytics │     │   │
│  │  │  Graph DB   │  │  Store     │  │  Store     │  │  Store     │  │  Store     │     │   │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘  └────────────┘     │   │
│  └──────────────────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                                         │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Deployment Topologies

### Topology 1: Cloud-First (Primary)

**Description:** All services run in the cloud. Clients connect remotely.

| Component       | Location         | Characteristics                             |
| --------------- | ---------------- | ------------------------------------------- |
| All 21 services | Cloud            | Full capability, all services available     |
| All data stores | Cloud            | Full persistence, backup, disaster recovery |
| AI Providers    | External (Cloud) | Accessed through AI Orchestration           |
| User Context    | Cloud            | Real-time context assembled in cloud        |
| Offline Mode    | Client (limited) | Cached data, limited capabilities           |

**Best for:** Full-featured usage, first-time users, complex operations

### Topology 2: Hybrid (Cloud + Local AI)

**Description:** Core services run in cloud. AI inference runs locally for privacy and latency.

| Component        | Location                    | Characteristics                              |
| ---------------- | --------------------------- | -------------------------------------------- |
| All 21 services  | Cloud                       | Full capability                              |
| AI Inference     | Client (local)              | Local models (Ollama, on-device) for privacy |
| Sensitive Data   | Client (local)              | Never leaves device for private processing   |
| AI Orchestration | Cloud (with local fallback) | Routes to local AI for sensitive tasks       |
| Context          | Client (local real-time)    | Low-latency context processing               |

**Best for:** Privacy-sensitive users, offline-capable usage, reduced AI costs

### Topology 3: Offline Mode

**Description:** Limited service capability runs entirely on the client device.

| Component          | Location                | Characteristics                         |
| ------------------ | ----------------------- | --------------------------------------- |
| Identity (cached)  | Client                  | Cached credentials for local auth       |
| Memory (local)     | Client                  | Local conversation history              |
| Context            | Client                  | Local real-time context                 |
| Local AI           | Client                  | Small local models for basic assistance |
| Execution (cached) | Client                  | Cached plans and tasks                  |
| Cloud Sync         | Client (when connected) | Synchronize when online                 |
| All other services | Cloud (when connected)  | Deferred to online mode                 |

**Best for:** Travel, limited connectivity, data-sensitive scenarios

### Topology 4: Enterprise (Multi-Tenant)

**Description:** Isolated service instances for enterprise tenants.

| Component       | Location           | Characteristics                             |
| --------------- | ------------------ | ------------------------------------------- |
| Shared Services | Cloud (shared)     | Security, Audit, Identity, AI Orchestration |
| Tenant Services | Cloud (per tenant) | Isolated service instances per tenant       |
| Tenant Data     | Cloud (per tenant) | Complete data isolation                     |
| Tenant AI       | Configurable       | Per-tenant AI provider choices              |
| Compliance      | Per-region         | Data residency, regulatory compliance       |

**Best for:** Enterprise customers, regulated industries, team deployment

---

## Synchronization Model

### Sync States

| State        | Description                            | Trigger                    |
| ------------ | -------------------------------------- | -------------------------- |
| **Online**   | Full cloud connectivity                | Network available          |
| **Offline**  | No cloud connectivity                  | Network unavailable        |
| **Syncing**  | Synchronizing local changes with cloud | Reconnecting after offline |
| **Conflict** | Local and cloud changes conflict       | Both changed while offline |

### Sync Flow

```text
Client (Offline)                Client (Reconnecting)           Cloud
      │                                │                           │
      │  User makes changes locally     │                           │
      │  (create goal, complete task)   │                           │
      │                                │                           │
      │  Changes stored in local queue  │                           │
      │                                │                           │
      │         ─── Network Available ──▶                           │
      │                                │                           │
      │         Send change log         │                           │
      │──────────────────────────────────────────▶                  │
      │                                │                           │
      │                                │     Process changes        │
      │                                │     (validate, apply)     │
      │                                │                           │
      │         Receive confirmation    │                           │
      │◀──────────────────────────────────────────                  │
      │                                │                           │
      │         Receive cloud changes  │                           │
      │◀──────────────────────────────────────────                  │
      │                                │                           │
      │  Local queue cleared           │                           │
      │  State synchronized            │                           │
      │                                │                           │
```

### Conflict Resolution

| Conflict Type                          | Resolution Strategy                      |
| -------------------------------------- | ---------------------------------------- |
| **Same field, different values**       | Last-writer-wins (with version tracking) |
| **Deleted locally, modified remotely** | Remote wins (deletion undone)            |
| **Modified locally, deleted remotely** | Local wins (deletion rejected)           |
| **Created both places**                | Merge with timestamp + unique IDs        |

---

## External AI Provider Connectivity

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AI PROVIDER CONNECTIVITY                                  │
│                                                                              │
│  VedMoulya Cloud                    External AI Providers                    │
│  ───────────────                    ──────────────────────                  │
│                                                                              │
│  ┌──────────────────────┐          ┌──────────┐  ┌──────────┐              │
│  │  AI Orchestration   │──────────▶│   GPT    │  │  Gemini  │              │
│  │  Service            │  HTTPS    │  (OpenAI)│  │ (Google) │              │
│  │                     │          └──────────┘  └──────────┘              │
│  │  • Capability       │          ┌──────────┐  ┌──────────┐              │
│  │    routing          │──────────▶│  Claude  │  │ DeepSeek │              │
│  │  • Context assembly │  HTTPS    │(Anthropic)│  │          │              │
│  │  • Provider fallback│          └──────────┘  └──────────┘              │
│  │  • Response         │          ┌──────────┐                             │
│  │    validation       │──────────▶│  Ollama  │                             │
│  │  • Cost tracking    │  HTTP     │ (Local)  │                             │
│  └──────────────────────┘          └──────────┘                             │
│                                                                              │
│  Security:                                                                   │
│  • All provider communication is encrypted (HTTPS/mTLS)                     │
│  • Minimum context principle: only necessary data is sent                   │
│  • No PII sent to providers                                                  │
│  • API keys managed by Security Service                                      │
│  • Provider responses validated before delivery to caller                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Deployment Governance

| Concern                    | Principle                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------- |
| **Environment Parity**     | Development, staging, and production environments should be as similar as possible |
| **Immutable Deployments**  | Services are deployed as immutable artifacts — no hot-patching                     |
| **Blue-Green Deployments** | New versions deploy alongside old versions for zero-downtime upgrades              |
| **Feature Flags**          | New capabilities are deployed behind feature flags, not code branches              |
| **Canary Releases**        | New versions are rolled out to a subset of users first                             |
| **Rollback Ready**         | Every deployment has a tested rollback plan                                        |
| **Observability**          | Every deployment is observable — metrics, logs, traces, health checks              |

---

## Cross-References

| Reference | Relationship                                                                                              |
| --------- | --------------------------------------------------------------------------------------------------------- |
| CMP-001   | "Human-first" — deployment decisions prioritize user experience (latency, offline)                        |
| CMP-002   | Compliance requirements affect data residency and deployment location decisions (planned document)        |
| RSH-001   | Validated human problems in underserved connectivity areas drive offline mode requirements                |
| PRD-001   | Human Journey stages require different deployment considerations (Discover=online, Build=offline-capable) |
| PRD-002   | User DNA privacy requirements affect local vs. cloud processing decisions                                 |
| ARC-001   | Principle #7 (Scalable) — scaling is a deployment concern, not a contract concern                         |
| ARC-002   | Decision Intelligence may require low-latency deployment for real-time decisions                          |
| ARC-003   | Knowledge Graph deployment topology affects query latency and availability                                |
| ARC-004   | Execution service deployment must support offline task execution with sync                                |
| ARC-005   | AI Orchestration manages provider connectivity regardless of deployment topology                          |
| ENG-001   | Domain entities must be synchronized correctly across deployment boundaries                               |
| ENG-002   | Service contracts are deployment-independent — they work in any topology                                  |
| ENG-003   | Information classification affects where data can be stored and processed (cloud vs. on-device)           |
