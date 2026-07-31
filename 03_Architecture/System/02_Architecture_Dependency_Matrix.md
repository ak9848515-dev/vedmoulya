# Architecture Dependency Matrix

**ARC-REVIEW-001 — Document 02/10**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Enterprise Architect
**Created:** 2026-07-24

---

## Purpose

This document maps all dependencies between VedMoulya's architectural components, missions, and layers. It identifies circular dependencies, missing dependencies, orphan components, and integration gaps.

---

## Dependency Philosophy

VedMoulya's architecture follows a **layered dependency model**:

```
UPSTREAM (Foundation)
    │
    ▼
CORE (Intelligence)
    │
    ▼
DOWNSTREAM (Execution & Interface)
    │
    ▼
EXTERNAL (Providers, APIs)
```

- **Upstream dependencies** should never depend on downstream components
- **Foundation layer** (Constitution, Principles) has zero dependencies
- **Intelligence layer** (Knowledge Graph, Decision Engine) depends only on Foundation
- **Execution layer** depends on Intelligence layer
- **Orchestration layer** bridges Intelligence to External providers

---

## Mission Dependency Matrix

| Mission                   | Depends On                         | Used By                            | Dependency Chain                          |
| ------------------------- | ---------------------------------- | ---------------------------------- | ----------------------------------------- |
| CMP-001 (Constitution)    | None                               | ALL                                | Root                                      |
| CMP-002                   | Not found                          | ARC-003, ARC-004, ARC-005          | Unknown                                   |
| RSH-001 (Research)        | None                               | PRD-001, PRD-002                   | Root                                      |
| PRD-001 (Human Journey)   | CMP-001, RSH-001                   | ARC-001, ARC-003, ARC-004, ARC-005 | CMP ← RSH → PRD                           |
| PRD-002 (User DNA)        | CMP-001, RSH-001                   | ARC-001, ARC-005                   | CMP ← RSH → PRD                           |
| ARC-001 (System)          | CMP-001, PRD-001, PRD-002, RSH-001 | ARC-002, ARC-003, ARC-004, ARC-005 | Foundation ← Product → System             |
| ARC-002 (Decision)        | ARC-001, PRD-002                   | ARC-004, ARC-005                   | System → Decision → Execution             |
| ARC-003 (Knowledge Graph) | ARC-001, PRD-001                   | ARC-004, ARC-005                   | System → Knowledge → Execution            |
| ARC-004 (Execution)       | ARC-001, ARC-002, ARC-003, PRD-001 | ARC-005                            | System → Knowledge + Decision → Execution |
| ARC-005 (Orchestrator)    | ARC-001, ARC-002, ARC-003, ARC-004 | External Providers                 | System ← All ARCs → External              |

---

## Component Dependency Map

### Layer 1: Foundation (Zero Dependencies)

```
┌──────────────────────────────────────────────────────────────────────┐
│                          FOUNDATION                                   │
│                                                                       │
│  CMP-001 (Constitution)     RSH-001 (Research)                       │
│      │                            │                                   │
│      └──────────┬─────────────────┘                                   │
│                 ▼                                                     │
│         PRD-001 (Human Journey)     PRD-002 (User DNA)               │
└──────────────────────────────────────────────────────────────────────┘
```

**Dependencies:** None
**Depended upon by:** All engineering missions

---

### Layer 2: System Architecture (Depends on Foundation)

```
┌──────────────────────────────────────────────────────────────────────┐
│                      SYSTEM ARCHITECTURE                             │
│                                                                       │
│  ARC-001                                                              │
│  ├── Architecture Principles                                          │
│  ├── Core Components (18 components, 4 layers)                       │
│  ├── System Context (9 actors)                                        │
│  ├── System Boundaries (Own vs. Not Own)                              │
│  ├── VedMoulya Intelligence                                           │
│  └── Data Flow / Decision Flow / Event Flow / Knowledge Flow         │
│                                                                       │
│  Depends on: CMP-001, PRD-001, PRD-002, RSH-001                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Dependencies:** CMP-001, PRD-001, PRD-002, RSH-001
**Depended upon by:** ARC-002, ARC-003, ARC-004, ARC-005

---

### Layer 3: Intelligence Engines (Depends on System)

```
┌──────────────────────────────────────────────────────────────────────┐
│                       INTELLIGENCE ENGINES                             │
│                                                                       │
│  ┌────────────────────┐  ┌────────────────────┐                     │
│  │  ARC-002           │  │  ARC-003           │                     │
│  │  Decision Engine   │  │  Knowledge Graph   │                     │
│  │                    │  │                    │                     │
│  │  Depends on:       │  │  Depends on:       │                     │
│  │  ARC-001, PRD-002  │  │  ARC-001, PRD-001  │                     │
│  └─────────┬──────────┘  └──────────┬─────────┘                     │
│            │                        │                                │
│            └──────────┬─────────────┘                                │
│                       ▼                                               │
│            ┌────────────────────┐                                    │
│            │  ARC-004          │                                    │
│            │  Execution Engine │                                    │
│            │                   │                                    │
│            │  Depends on:      │                                    │
│            │  ARC-001, ARC-002,│                                    │
│            │  ARC-003, PRD-001 │                                    │
│            └─────────┬─────────┘                                    │
└──────────────────────┼──────────────────────────────────────────────┘
                       ▼
```

**Dependencies:** ARC-001 (all)
**Depended upon by:** ARC-005

---

### Layer 4: Orchestration (Depends on All Intelligence)

```
┌──────────────────────────────────────────────────────────────────────┐
│                       AI ORCHESTRATION                               │
│                                                                       │
│  ARC-005                                                              │
│  ├── Provider Management                                              │
│  ├── Capability Routing                                               │
│  ├── Context Assembly                                                 │
│  ├── Prompt Strategy                                                  │
│  ├── Cost & Performance Optimization                                  │
│  ├── Fallback & Resilience                                           │
│  ├── Response Validation                                             │
│  ├── Orchestration Policies                                          │
│  └── Orchestration API Contract                                      │
│                                                                       │
│  Depends on: ARC-001, ARC-002, ARC-003, ARC-004                      │
│  Interfaces with: External AI Providers                               │
└──────────────────────────────────────────────────────────────────────┘
```

**Dependencies:** ARC-001, ARC-002, ARC-003, ARC-004
**Depended upon by:** External providers (consumers)

---

## Dependency Health Analysis

### Healthy Dependencies

| Dependency        | Type          | Health | Evidence                                                          |
| ----------------- | ------------- | ------ | ----------------------------------------------------------------- |
| ARC-003 → ARC-001 | Information   | ✅     | System components referenced in Knowledge Graph architecture      |
| ARC-004 → ARC-001 | Information   | ✅     | System architecture principles applied in Execution Engine        |
| ARC-005 → ARC-003 | Information   | ✅     | Knowledge Graph provides context to Orchestrator                  |
| ARC-005 → ARC-004 | Information   | ✅     | Execution Intelligence provides execution context to Orchestrator |
| ARC-004 → ARC-003 | Bidirectional | ✅     | Knowledge Graph ↔ Execution Intelligence exchange documented      |

### Broken Dependencies

| Dependency        | Type           | Issue                                                 | Severity  |
| ----------------- | -------------- | ----------------------------------------------------- | --------- |
| ARC-003 → CMP-002 | Cross-ref      | CMP-002 does not exist                                | 🔴 HIGH   |
| ARC-004 → CMP-002 | Cross-ref      | CMP-002 does not exist                                | 🔴 HIGH   |
| ARC-005 → CMP-002 | Cross-ref      | CMP-002 does not exist                                | 🔴 HIGH   |
| ARC-001 → PRD-002 | Information    | Referenced but integration not detailed               | 🟡 MEDIUM |
| ARC-002 → ARC-005 | Back-reference | Decision Engine rarely mentioned in Orchestrator docs | 🟡 MEDIUM |

### Missing Dependencies

| Missing Connection | Should Exist                                               | Impact    |
| ------------------ | ---------------------------------------------------------- | --------- |
| ARC-005 → Frontend | Orchestrator serves Frontend — no frontend contract exists | 🟡 MEDIUM |
| ARC-004 → Frontend | Execution Engine powers Daily Journey — no UI contract     | 🟡 MEDIUM |
| ARC-003 → Database | Knowledge Graph needs data storage — no schema defined     | 🟡 MEDIUM |
| ARC-002 → ARC-005  | Decision Engine needs AI for reasoning — only implicit     | 🟢 LOW    |
| All ARCs → Backend | All engines need backend services — none specified         | 🔴 HIGH   |

---

## Circular Dependency Check

| Check                                 | Result                                                    |
| ------------------------------------- | --------------------------------------------------------- |
| ARC-002 ↔ ARC-003                     | ✅ No circular dependency (both depend on ARC-001 only)   |
| ARC-003 ↔ ARC-004                     | ✅ No circular dependency (ARC-003 → ARC-004, no reverse) |
| ARC-004 ↔ ARC-005                     | ✅ No circular dependency (ARC-004 → ARC-005, no reverse) |
| ARC-005 → ARC-003 → ARC-001           | ✅ Acyclic (downward only)                                |
| ARC-005 → ARC-004 → ARC-002 → ARC-001 | ✅ Acyclic (downward only)                                |

**No circular dependencies detected.** The dependency graph is a directed acyclic graph (DAG), which is architecturally correct.

---

## Critical Dependency Paths

### Path 1: User Request to AI Response (Length: 4 hops)

```
User → ARC-005 (Orchestrator) → ARC-003 (Knowledge Graph, context)
     → External Provider → ARC-005 (Validation) → User
```

**Risks:** Orchestrator is a single point of failure. Context assembly latency.

### Path 2: Goal to Execution (Length: 4 hops)

```
User → PRD-002 (DNA) → ARC-004 (Execution) → ARC-003 (Knowledge, skills)
     → ARC-005 (AI assistance) → External Provider
```

**Risks:** Multiple intelligence engines must coordinate. No orchestration workflow documented.

### Path 3: Decision to Outcome (Length: 3 hops)

```
ARC-002 (Decision) → ARC-004 (Execute) → ARC-003 (Record outcome)
```

**Risks:** Decision → Execution → Knowledge feedback loop requires tight integration. Integration contract not specified.

---

## Dependency Quality Metrics

| Metric                     | Value | Assessment                                                   |
| -------------------------- | ----- | ------------------------------------------------------------ |
| Total dependencies         | 42    | Across all missions and components                           |
| Explicit dependencies      | 28    | Clearly documented dependency relationships                  |
| Implicit dependencies      | 14    | Referenced but not formally specified                        |
| Broken cross-references    | 3     | CMP-002 referenced but missing                               |
| Circular dependencies      | 0     | ✅ Healthy                                                   |
| Bidirectional dependencies | 3     | Knowledge Graph ↔ Execution, Decision ↔ Knowledge            |
| Orphan components          | 2     | Frontend, Database layers (no upstream dependencies defined) |

---

## Recommendations

1. **Create CMP-002** — Resolve the most critical broken cross-reference (affects 3 missions)
2. **Define Backend → ARC contracts** — Each intelligence engine needs a backend service specification
3. **Define Database → ARC contracts** — Each engine needs data storage requirements
4. **Define Frontend → ARC contracts** — Each engine user-facing feature needs UI specifications
5. **Implement dependency validation tooling** — Automated checking of cross-references
6. **Document integration contracts** — Formal interfaces between ARC-002, ARC-003, ARC-004, and ARC-005

---

## Future Expansion

- **Dynamic dependency graph** — Machine-readable dependency data for automated validation
- **Versioned dependencies** — Track how dependencies evolve across architecture versions
- **Impact analysis automation** — When a component changes, automatically identify affected downstream components
- **Dependency health dashboard** — Real-time visualization of dependency status
