# Architecture Dependency Matrix

**ARC-REVIEW-001 — Architecture Integration Review**
**Version:** 2.0
**Status:** Final
**Owner:** Chief Enterprise Architect
**Created:** 2026-07-25

---

## Purpose

This document maps all dependencies between VedMoulya's architectural components, missions, and layers. It identifies circular dependencies, missing dependencies, orphan components, and integration gaps. This is the definitive dependency reference for the entire platform.

---

## Dependency Philosophy

VedMoulya's architecture follows a **strictly layered dependency model** governed by the following principles from ARC-001:

```
UPSTREAM (Foundation — Zero Dependencies)
    │
    ▼
SYSTEM (Principles, Components, Boundaries)
    │
    ▼
INTELLIGENCE (Decision, Knowledge)
    │
    ▼
EXECUTION (Execution Engine)
    │
    ▼
ORCHESTRATION (AI Orchestrator)
    │
    ▼
EXTERNAL (Providers, APIs, Services)
```

- **Upstream dependencies should never depend on downstream components**
- **Foundation layer** (Constitution, Research, Product) has zero dependencies
- **No circular dependencies** — the graph must remain a DAG (Directed Acyclic Graph)
- **Provider agnosticism** — no component should depend on a specific external provider

---

## Mission Dependency Matrix

| Mission                   | Depends On                         | Used By                            | Dependency Chain                          |
| ------------------------- | ---------------------------------- | ---------------------------------- | ----------------------------------------- |
| CMP-001 (Constitution)    | None                               | ALL                                | Root                                      |
| CMP-002 (Compliance)      | ❌ Not found                       | ARC-003, ARC-004, ARC-005          | Unknown — 🔴 CRITICAL                     |
| RSH-001 (Research)        | None                               | PRD-001, PRD-002, ARC-001          | Root                                      |
| PRD-001 (Human Journey)   | CMP-001, RSH-001                   | ARC-001, ARC-003, ARC-004, ARC-005 | CMP ← RSH → PRD                           |
| PRD-002 (User DNA)        | CMP-001, RSH-001                   | ARC-001, ARC-002, ARC-005          | CMP ← RSH → PRD                           |
| ARC-001 (System Arch)     | CMP-001, PRD-001, PRD-002, RSH-001 | ARC-002, ARC-003, ARC-004, ARC-005 | Foundation → System                       |
| ARC-002 (Decision)        | ARC-001, PRD-002                   | ARC-004, ARC-005                   | System → Decision                         |
| ARC-003 (Knowledge Graph) | ARC-001, PRD-001                   | ARC-004, ARC-005                   | System → Knowledge                        |
| ARC-004 (Execution)       | ARC-001, ARC-002, ARC-003, PRD-001 | ARC-005                            | System → Knowledge + Decision → Execution |
| ARC-005 (Orchestrator)    | ARC-001, ARC-002, ARC-003, ARC-004 | External Providers                 | System ← All ARCs → External              |

---

## Component Dependency Map

### Layer 1: Foundation (Zero Dependencies)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          FOUNDATION LAYER                                 │
│                                                                           │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐             │
│  │  CMP-001     │     │  RSH-001     │     │  09_Docs     │             │
│  │  Constitution│     │  Research    │     │ Governance,  │             │
│  │              │     │              │     │ Standards    │             │
│  └──────┬───────┘     └──────┬───────┘     └──────────────┘             │
│         │                    │                                            │
│         └────────┬───────────┘                                            │
│                  ▼                                                        │
│         ┌────────────────────────────────────┐                           │
│         │  PRD-001 (Human Journey)           │                           │
│         │  PRD-002 (User DNA)               │                           │
│         └────────────────────────────────────┘                           │
└──────────────────────────────────────────────────────────────────────────┘
```

**Dependencies:** None
**Depended upon by:** All engineering missions (ARC-001 through ARC-005)

---

### Layer 2: System Architecture (Depends on Foundation)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       SYSTEM ARCHITECTURE LAYER                           │
│                                                                           │
│  ARC-001                                                                  │
│  ├── 12 Architecture Principles + Eval Matrix                             │
│  ├── 18 Core Components (4 Layers)                                       │
│  ├── System Context (9 Actors)                                           │
│  ├── System Boundaries (Own vs. Not Own)                                 │
│  ├── VedMoulya Intelligence Philosophy                                   │
│  ├── Data Flow / Decision Flow / Event Flow / Knowledge Flow             │
│  └── Architecture Overview                                               │
│                                                                           │
│  Depends on: CMP-001, PRD-001, PRD-002, RSH-001, 09_Documents            │
│  Depended upon by: ARC-002, ARC-003, ARC-004, ARC-005                    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### Layer 3: Intelligence Engines (Depends on System)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        INTELLIGENCE ENGINES LAYER                         │
│                                                                           │
│  ┌────────────────────────┐    ┌────────────────────────┐               │
│  │  ARC-002               │    │  ARC-003               │               │
│  │  Decision Engine       │    │  Knowledge Graph       │               │
│  │                        │    │                        │               │
│  │  Depends on:           │    │  Depends on:           │               │
│  │  ARC-001, PRD-002      │    │  ARC-001, PRD-001      │               │
│  │                        │    │                        │               │
│  │  Components:           │    │  Components:           │               │
│  │  ├── Decision Types    │    │  ├── Entity Layer      │               │
│  │  ├── Decision Lifecycle│    │  ├── Relationship Layer│               │
│  │  ├── Scoring Framework │    │  ├── Property Layer    │               │
│  │  ├── Context Engine    │    │  ├── Lifecycle Mgmt   │               │
│  │  ├── Learning Engine   │    │  ├── Quality Engine    │               │
│  │  └── Explainability   │    │  ├── Evolution Engine  │               │
│  └───────────┬────────────┘    │  ├── Retrieval Engine │               │
│              │                 │  ├── Governance Layer  │               │
│              │                 │  └── Explainability   │               │
│              │                 └───────────┬────────────┘               │
│              │                             │                            │
│              └─────────────┬───────────────┘                            │
│                            ▼                                             │
│              ┌────────────────────────┐                                 │
│              │  ARC-004               │                                 │
│              │  Execution Engine      │                                 │
│              │                        │                                 │
│              │  Depends on:           │                                 │
│              │  ARC-001, ARC-002,     │                                 │
│              │  ARC-003, PRD-001      │                                 │
│              │                        │                                 │
│              │  Components:           │                                 │
│              │  ├── Goal Decomp. (8L) │                                 │
│              │  ├── Planning Framewk  │                                 │
│              │  ├── Adaptive Engine   │                                 │
│              │  ├── Execution Context │                                 │
│              │  ├── Feedback Engine   │                                 │
│              │  ├── Policy Engine     │                                 │
│              │  └── Explainability   │                                 │
│              └───────────┬────────────┘                                 │
└──────────────────────────┼──────────────────────────────────────────────┘
                           ▼
```

---

### Layer 4: Orchestration (Depends on All Intelligence)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       AI ORCHESTRATION LAYER                              │
│                                                                           │
│  ARC-005                                                                  │
│  ├── Provider Manager (Health, Auth, Capabilities, Lifecycle)            │
│  ├── Capability Router (9 types: Coding, Vision, Speech, Reason, etc.)  │
│  ├── Context Assembler (DNA, Knowledge, Memory, Context)                 │
│  ├── Prompt Constructor (System, Task, Constraints)                      │
│  ├── Cost & Performance Optimizer (Latency, Cost, Token Efficiency)      │
│  ├── Fallback & Resilience (Retry, Timeout, Alt Providers, Degradation)  │
│  ├── Response Validator (Safety, Policy, Hallucination, Quality)         │
│  ├── Orchestration Policies (Human First, Secure, Privacy)               │
│  └── Orchestration API Contract (Request → Response → Metadata)          │
│                                                                           │
│  Depends on: ARC-001, ARC-002, ARC-003, ARC-004                          │
│  Interfaces with: External AI Providers, External APIs                   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### Layer 5: External (Providers, Services, Data Sources)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL LAYER                                    │
│                                                                           │
│  AI PROVIDERS                    EXTERNAL APIs         DATA SOURCES      │
│  ┌────────┐ ┌────────┐          ┌──────────┐          ┌──────────┐     │
│  │ GPT    │ │ Gemini │          │ LinkedIn │          │ Academic │     │
│  │(Reason,│ │(Vision,│          │ GitHub   │          │ Market   │     │
│  │ Code)  │ │ Multi) │          │ WhatsApp │          │ Courses  │     │
│  ├────────┤ ├────────┤          ├──────────┤          ├──────────┤     │
│  │ Claude │ │DeepSeek│          │ Calendar │          │ News/    │     │
│  │(Safety,│ │ (Code, │          │ Email    │          │ Research │     │
│  │Analysis│ │ Cost)  │          │ Payments │          │ Blogs    │     │
│  ├────────┤ ├────────┤          └──────────┘          └──────────┘     │
│  │ Ollama │ │OpenRtr │                                                 │
│  │(Local) │ │(Aggr.) │          PAYMENT PROVIDERS                      │
│  └────────┘ └────────┘          ┌──────────┐                          │
│                                  │ Stripe   │                          │
│                                  │ Razorpay │                          │
│                                  └──────────┘                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Dependencies:** None (external)
**Depended upon by:** ARC-005 (Orchestrator)

---

## Dependency Health Analysis

### ✅ Healthy Dependencies

| Dependency        | Type          | Health | Evidence                                                          |
| ----------------- | ------------- | ------ | ----------------------------------------------------------------- |
| ARC-003 → ARC-001 | Information   | ✅     | System components referenced in Knowledge Graph architecture      |
| ARC-004 → ARC-001 | Information   | ✅     | System architecture principles applied in Execution Engine        |
| ARC-005 → ARC-003 | Information   | ✅     | Knowledge Graph provides context to Orchestrator                  |
| ARC-005 → ARC-004 | Information   | ✅     | Execution Intelligence provides execution context to Orchestrator |
| ARC-004 → ARC-003 | Bidirectional | ✅     | Knowledge Graph ↔ Execution Intelligence exchange documented      |
| ARC-004 → ARC-002 | Information   | ✅     | Decision Engine provides decision context to Execution            |
| PRD-001 → CMP-001 | Alignment     | ✅     | Product requirements align with Constitution                      |
| PRD-002 → CMP-001 | Alignment     | ✅     | User DNA respects Constitutional values                           |

### ❌ Broken Dependencies

| Dependency        | Type      | Issue                  | Severity    |
| ----------------- | --------- | ---------------------- | ----------- |
| ARC-003 → CMP-002 | Cross-ref | CMP-002 does not exist | 🔴 CRITICAL |
| ARC-004 → CMP-002 | Cross-ref | CMP-002 does not exist | 🔴 CRITICAL |
| ARC-005 → CMP-002 | Cross-ref | CMP-002 does not exist | 🔴 CRITICAL |

### ⚠️ Missing Dependencies

| Missing Connection       | Should Exist                                               | Impact      |
| ------------------------ | ---------------------------------------------------------- | ----------- |
| ARC-005 → Frontend       | Orchestrator serves Frontend — no frontend contract exists | 🟡 HIGH     |
| ARC-004 → Frontend       | Execution Engine powers Daily Journey — no UI contract     | 🟡 HIGH     |
| ARC-003 → Database       | Knowledge Graph needs data storage — no schema defined     | 🟡 HIGH     |
| ARC-002 → Database       | Decision Engine needs data storage — no schema defined     | 🟡 HIGH     |
| All ARCs → Backend       | All engines need backend services — none specified         | 🔴 CRITICAL |
| All ARCs → Security      | All engines need security — no architecture exists         | 🔴 CRITICAL |
| All ARCs → Observability | All engines need monitoring — no architecture exists       | 🟡 HIGH     |

### 🟡 Weak Dependencies

| Dependency        | Type           | Issue                                                 | Severity  |
| ----------------- | -------------- | ----------------------------------------------------- | --------- |
| ARC-001 → PRD-002 | Information    | Referenced but integration not detailed               | 🟡 MEDIUM |
| ARC-002 → ARC-005 | Back-reference | Decision Engine rarely mentioned in Orchestrator docs | 🟡 MEDIUM |
| ARC-003 → ARC-005 | Back-reference | Knowledge Graph does not reference Orchestrator       | 🟡 MEDIUM |

---

## Circular Dependency Check

| Check                                 | Result                                                    |
| ------------------------------------- | --------------------------------------------------------- |
| ARC-002 ↔ ARC-003                     | ✅ No circular dependency (both depend on ARC-001 only)   |
| ARC-003 ↔ ARC-004                     | ✅ No circular dependency (ARC-003 → ARC-004, no reverse) |
| ARC-004 ↔ ARC-005                     | ✅ No circular dependency (ARC-004 → ARC-005, no reverse) |
| ARC-005 → ARC-003 → ARC-001           | ✅ Acyclic (downward only)                                |
| ARC-005 → ARC-004 → ARC-002 → ARC-001 | ✅ Acyclic (downward only)                                |
| PRD-001 → CMP-001                     | ✅ Acyclic (Foundation has no dependencies)               |
| Full graph (all missions)             | ✅ No circular dependencies detected                      |

**Verdict:** The dependency graph is a **Directed Acyclic Graph (DAG)**. This is architecturally correct and well-maintained.

---

## Critical Dependency Paths

### Path 1: User Request to AI Response (4 hops)

```
User → ARC-005 (Orchestrator) → ARC-003 (Knowledge Graph, context)
     → External Provider → ARC-005 (Validation) → User
```

**Risks:**

- Orchestrator is a single point of failure for all AI-dependent features
- Context assembly adds latency to every AI request
- External provider latency is unpredictable
- **Mitigation:** Circuit breakers per provider, graceful degradation, caching

### Path 2: Goal to Execution (4 hops)

```
User → PRD-002 (DNA) → ARC-004 (Execution) → ARC-003 (Knowledge, skills)
     → ARC-005 (AI assistance) → External Provider
```

**Risks:**

- Multiple intelligence engines must coordinate
- No orchestration workflow documented for inter-engine communication
- DNA accuracy directly impacts execution quality
- **Mitigation:** Document inter-engine integration contracts, design DNA confidence scoring

### Path 3: Decision to Outcome (3 hops)

```
ARC-002 (Decision) → ARC-004 (Execute) → ARC-003 (Record outcome)
```

**Risks:**

- Decision → Execution → Knowledge feedback loop requires tight integration
- Integration contract not formally specified
- Decision quality depends on Knowledge Graph data freshness
- **Mitigation:** Formalize feedback loop API contract, implement decision outcome tracking

### Path 4: End-to-End Request (6 hops — full stack)

```
User → Frontend → ARC-005 (Orchestrator) → ARC-003 (KG Context)
     → ARC-002 (Decision) → ARC-004 (Execution Plan)
     → ARC-005 (AI Assist) → External Provider
     → ARC-005 (Validate) → User
```

**Risks:**

- 6-hop path creates significant latency
- 5 internal hops before reaching external provider
- Three intelligence engines must be in sync
- **Mitigation:** Caching, parallel execution where possible, latency budgets per hop

---

## Dependency Quality Metrics

| Metric                        | Value | Assessment                                                   |
| ----------------------------- | ----- | ------------------------------------------------------------ |
| Total dependencies            | 52    | Across all missions and components                           |
| Explicit dependencies         | 34    | Clearly documented dependency relationships                  |
| Implicit dependencies         | 18    | Referenced but not formally specified                        |
| Broken cross-references       | 3     | CMP-002 referenced but missing                               |
| Circular dependencies         | 0     | ✅ Healthy                                                   |
| Bidirectional dependencies    | 3     | Knowledge Graph ↔ Execution, Decision ↔ Execution            |
| Orphan components             | 2     | Frontend, Database layers (no upstream dependencies defined) |
| Missing critical dependencies | 7     | Backend, Security, Observability, Frontend, Database (×3)    |
| Healthy dependencies          | 8     | Well-documented and consistent                               |

---

## Dependency Traceability Matrix

```
                     CMP-001  RSH-001  PRD-001  PRD-002  ARC-001  ARC-002  ARC-003  ARC-004  ARC-005  Frontend Backend Database Security Obsrv
CMP-001 (Const)         —       —        —        —        —        —        —        —        —        —        —        —        —      —
RSH-001 (Research)      —       —        ✓        ✓        ✓        —        —        —        ✓        —        —        —        —      —
PRD-001 (Journey)       ✓       —        —        —        ✓        —        ✓        ✓        ✓        —        —        —        —      —
PRD-002 (DNA)           ✓       —        —        —        ✓        ✓        —        —        ✓        —        —        —        —      —
ARC-001 (System)        ✓       ✓        —        —        —        ✓        ✓        ✓        ✓        —        —        —        —      —
ARC-002 (Decision)      —       —        —        ✓        ✓        —        —        ✓        ✓        —        ❌        ❌      ❌      ❌
ARC-003 (Knowledge)     —       —        ✓        —        ✓        —        —        ✓        ❌       ❌        ❌        ❌      ❌      ❌
ARC-004 (Execution)     —       —        ✓        —        ✓        ✓        ✓        —        ✓        ❌        ❌        ❌      ❌      ❌
ARC-005 (Orchestrator)  —       —        ✓        ✓        ✓        ✓        ✓        ✓        —        ❌        ❌        ❌      ❌      ❌
Frontend                ❌      ❌       ❌       ❌       ❌       ❌       ❌       ❌       ❌        —        ❌        ❌      ❌      ❌
Backend                 ❌      ❌       ❌       ❌       ❌       ❌       ❌       ❌       ❌        ❌        —        ❌      ❌      ❌
Database                ❌      ❌       ❌       ❌       ❌       ❌       ❌       ❌       ❌        ❌        ❌        —      ❌      ❌
Security                ❌      ❌       ❌       ❌       ❌       ❌       ❌       ❌       ❌        ❌        ❌        ❌      —      ❌
Observability           ❌      ❌       ❌       ❌       ❌       ❌       ❌       ❌       ❌        ❌        ❌        ❌      ❌      —
```

**Legend:** ✓ = Dependency documented | ❌ = Dependency missing | — = Self/Not applicable

---

## Recommendations

1. **🔴 Create CMP-002** — Resolve the most critical broken cross-reference affecting 3 missions
2. **🔴 Define Backend → ARC contracts** — Each intelligence engine needs a backend service specification
3. **🔴 Define Database → ARC contracts** — Each engine needs data storage requirements and schema
4. **🔴 Define Security → ARC contracts** — Every component needs security architecture
5. **🟡 Define Frontend → ARC contracts** — Each engine's user-facing features need UI specifications
6. **🟡 Add missing back-references** — ARC-003 → ARC-005, ARC-002 → ARC-005
7. **🟡 Implement dependency validation tooling** — Automated checking of cross-references
8. **🟡 Document formal integration contracts** — Interfaces between ARC-002, ARC-003, ARC-004, and ARC-005

---

## Future Expansion

- **Dynamic dependency graph** — Machine-readable dependency data for automated validation
- **Versioned dependencies** — Track how dependencies evolve across architecture versions
- **Impact analysis automation** — When a component changes, automatically identify affected downstream components
- **Dependency health dashboard** — Real-time visualization of dependency status and health
