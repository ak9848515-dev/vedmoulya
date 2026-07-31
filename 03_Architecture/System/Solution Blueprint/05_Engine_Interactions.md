# Engine Interactions

**ENG-004 — Document 05/10 — Solution Blueprint**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Solution Architect
**Created:** 2026-07-27
**Cross-references:** CMP-001, PRD-002, ARC-002, ARC-003, ARC-004, ARC-005, ENG-001, ENG-002, ENG-003

---

## Purpose

This document defines the **interactions** among all major intelligence engines within the VedMoulya platform. It shows how engines collaborate to produce intelligent behavior — how User DNA informs decisions, how decisions trigger plans, how plans drive execution, how execution generates feedback, and how feedback closes the loop.

---

## Engine Map

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                        VEDMOULYA INTELLIGENCE ENGINES                        │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     USER UNDERSTANDING ENGINES                         │  │
│  │                                                                        │  │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    │  │
│  │  │   User DNA      │    │   Memory        │    │   Progress      │    │  │
│  │  │   (PRD-002)     │───▶│   Engine        │───▶│   Engine        │    │  │
│  │  │   Who the user  │    │   What happened  │    │   How user grows │    │  │
│  │  │   is            │    │                  │    │                  │    │  │
│  │  └─────────────────┘    └─────────────────┘    └─────────────────┘    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     KNOWLEDGE ENGINES                                  │  │
│  │                                                                        │  │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    │  │
│  │  │  Knowledge      │    │   Context       │    │   Relationship  │    │  │
│  │  │  Graph (ARC-003)│───▶│   Engine        │◀───│   Engine        │    │  │
│  │  │  What is known  │    │   Current state │    │   How connected │    │  │
│  │  └─────────────────┘    └─────────────────┘    └─────────────────┘    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     DECISION & REASONING ENGINES                       │  │
│  │                                                                        │  │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    │  │
│  │  │   Decision      │───▶│   Planning      │───▶│   Reasoning     │    │  │
│  │  │   Engine        │    │   Engine        │    │   Engine        │    │  │
│  │  │   (ARC-002)     │    │   How to achieve│    │   Why & what if │    │  │
│  │  │   What to choose│    │                 │    │                 │    │  │
│  │  └─────────────────┘    └─────────────────┘    └─────────────────┘    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     ACTION & ORCHESTRATION ENGINES                     │  │
│  │                                                                        │  │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    │  │
│  │  │   Execution     │◀───│  Recommendation │    │   AI            │    │  │
│  │  │   Engine        │    │  Engine         │    │   Orchestrator   │    │  │
│  │  │   (ARC-004)     │    │  What fits best │    │   (ARC-005)     │    │  │
│  │  │   Making happen │    │                 │    │   AI routing    │    │  │
│  │  └─────────────────┘    └─────────────────┘    └─────────────────┘    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                         │
│                                    ▼                                         │
│                           ┌─────────────────┐                              │
│                           │   AI Providers   │                              │
│                           │   (External)     │                              │
│                           └─────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Engine Interactions

### 1. User DNA ↔ Knowledge Graph

**Nature:** Bidirectional — DNA uses Knowledge for skill definitions; Knowledge uses DNA for personalization.

```text
User DNA                        Knowledge Graph
────────                        ───────────────
Skills dimension                Skill definitions & taxonomies
Knowledge dimension             Knowledge entities & concepts
Goals dimension                 Career paths & learning paths
Learning Profile dimension      Learning content catalog

Interaction:
  DNA → KG: "What skills are required for career path X?"
  KG  → DNA: "Skills: Python(8), ML(7), Statistics(6)..."
  DNA → KG: "User has Skill(ML, self-declared=6, assessed=7)"
  KG  → KG: Update user skill node
```

**Reference:** PRD-002 (User DNA), ARC-003 (Knowledge Graph)

---

### 2. User DNA ↔ Decision Intelligence

**Nature:** DNA is the primary input for all personalized decisions.

```text
User DNA                        Decision Intelligence
────────                        ────────────────────
All 8 dimensions                All 10 decision types

Interaction:
  Decision → DNA: "Get DNA for career decision"
  DNA     → Decision: "Identity: mid-career, Skills: {Python: 7, ...},
                       Goals: Senior ML Engineer, Context: employed,
                       Progress: on track"
  Decision→ Decision: Score options against DNA dimensions
  Decision→ User: "Recommended path: ML Engineering.
                   Confidence: 0.85. Reason: Aligns with your goal
                   and leverages your Python skills."
```

**Reference:** PRD-002 (User DNA), ARC-002 (Decision Types, Decision Scoring)

---

### 3. Decision Intelligence ↔ Execution Intelligence

**Nature:** Decisions trigger execution; execution outcomes inform future decisions.

```text
Decision Intelligence           Execution Intelligence
─────────────────────           ──────────────────────
Decision Record                 Goals, Plans, Tasks, Outcomes

Interaction:
  Decision → Planning: "Selected career path: ML Engineering.
                        Generate plan from current state."
  Planning → Execution: "Here is a plan with 3 milestones,
                         12 tasks, 90-day timeline."
  Execution→ Planning: "Task 5 completed. Progress: 42%."
  Planning → Planning: "Adapt plan based on progress."
  Execution→ Decision: "Feedback: Plan completed. Outcome: achieved."
  Decision → Decision: "Learn from outcome. Adjust scoring."
```

**Reference:** ARC-002 (Decision Lifecycle), ARC-004 (Execution Lifecycle)

---

### 4. Knowledge Graph ↔ Decision Intelligence

**Nature:** Knowledge Graph provides the factual basis for decisions.

```text
Knowledge Graph                 Decision Intelligence
──────────────                  ────────────────────
Entities & Relationships        Decision Scoring & Context

Interaction:
  Decision → KG: "What are the prerequisites for becoming
                  a Senior ML Engineer?"
  KG     → Decision: "Required skills: Python(8), ML(7),
                      Statistics(7), Deployment(6).
                      Related roles: Data Scientist, ML Engineer."
  Decision→ KG: "What market demand exists for this role?"
  KG     → Decision: "Market: +35% demand YoY,
                      Salary range: $120K-$180K,
                      Top locations: SF, NYC, Remote."
  Decision→ Decision: "Score option against market data."
```

**Reference:** ARC-003 (Knowledge Graph — Retrieval), ARC-002 (Decision Context)

---

### 5. Execution Intelligence ↔ Memory

**Nature:** Execution events are recorded as memories; past memories inform execution.

```text
Execution Intelligence          Memory
─────────────────────           ──────
Task completions, logs          Conversation history, past experiences

Interaction:
  Execution → Memory: "Record: User completed task 'Learn Python
                       basics' on 2026-07-27. Duration: 45min.
                       Energy: high. Notes: 'Enjoyed it.'"
  Memory → Memory: "Consolidate with related memories."
  Planning → Memory: "Get past execution patterns for similar goals."
  Memory → Planning: "Pattern: User works best 9-11 AM. Tasks
                      with this type average 2x estimated time."
  Planning → Planning: "Adjust estimates based on memory."
```

**Reference:** ARC-004 (Execution Feedback), ENG-003 (Memory Information Type)

---

### 6. AI Orchestrator ↔ All Engines

**Nature:** AI Orchestrator is the gateway to external AI. All engines may request AI capabilities through it.

```text
Any Engine                      AI Orchestrator                 AI Provider
──────────                      ────────────────                ───────────
Decision, Planning, etc.        Routing, Context, Validation    GPT, Claude, etc.

Interaction:
  Engine → AIO: "I need text generation capability.
                 User input: 'Help me write a project proposal.'
                 Context: user_goal, expertise_level.
                 Quality tier: standard."
  AIO → AIO: "Assemble context from DNA, Memory, Knowledge.
              Apply privacy filter (remove PII).
              Select best provider (GPT-4o: quality 9.2, cost $0.003)."
  AIO → Provider: "[Minimal context] + [User request]"
  Provider → AIO: "Generated text response"
  AIO → AIO: "Validate response (safety, policy, quality, format)"
  AIO → Engine: "Response + metadata (provider, confidence, cost)"
```

**Reference:** ARC-005 (AI Orchestration — Context Assembly, Capability Routing, Response Validation)

---

### 7. Recommendation Engine ↔ All Domain Engines

**Nature:** Recommendations are cross-domain — they use data from all engines.

```text
Recommendation Engine           Career    Learning   Business   Health
─────────────────────           ──────    ───────    ────────   ──────
Personalized suggestions        Domain data

Interaction:
  Rec → DNA: "Get full user profile for recommendations"
  Rec → Career: "What career paths match this profile?"
  Rec → Learning: "What learning paths address skill gaps?"
  Rec → Business: "What business opportunities are available?"
  Rec → Knowledge: "What connections exist between domains?"
  Rec → Rec: "Score all options. Apply diversity filter.
              Generate explanations."
  Rec → User: "Top 3 recommendations with explanations."
  User → Rec: "Feedback: clicked #2."
```

---

### 8. Progress Engine ↔ All Engines

**Nature:** Progress is computed from events across all engines.

```text
Progress Engine                 Decision   Execution   Career   Learning   Finance
──────────────                  ───────    ────────    ──────   ───────    ──────
HPI, Growth Rates               Outcome data

Interaction:
  Execution → Progress: "EVENT: TaskCompleted. Domain: Learning.
                         Duration: 2h. Quality: 4/5."
  Career → Progress: "EVENT: CareerStageChanged. New stage: Senior."
  Finance → Progress: "EVENT: IncomeRecorded. Amount: $5K. Month: July."
  Progress → Progress: "Recalculate HPI. Update growth rates.
                        Check for plateaus or regressions."
  Progress → User: "Your HPI improved 5% this month. Career is your
                    fastest-growing dimension (+12%). Learning
                    plateau detected (-2% this month)."
```

---

## Interaction Summary Matrix

| Engine                    | DNA    | KG     | Decision | Planning | Execution | Memory | Rec    | Progress | AIO    |
| ------------------------- | ------ | ------ | -------- | -------- | --------- | ------ | ------ | -------- | ------ |
| **User DNA**              | —      | Reads  | Inputs   | Reads    | Reads     | —      | Inputs | Inputs   | Inputs |
| **Knowledge Graph**       | Writes | —      | Inputs   | Reads    | Reads     | —      | Reads  | —        | Reads  |
| **Decision Intelligence** | Reads  | Reads  | —        | Outputs  | Inputs    | Reads  | Inputs | Reads    | Uses   |
| **Planning**              | Reads  | Reads  | Reads    | —        | Outputs   | Reads  | —      | —        | Uses   |
| **Execution**             | Reads  | Writes | Feeds    | Reads    | —         | Writes | —      | Feeds    | Uses   |
| **Memory**                | Reads  | —      | Reads    | Reads    | Reads     | —      | Reads  | —        | Reads  |
| **Recommendation**        | Reads  | Reads  | Uses     | —        | —         | Reads  | —      | Reads    | Uses   |
| **Progress**              | Writes | —      | Reads    | —        | Reads     | —      | —      | —        | —      |
| **AI Orchestrator**       | Reads  | Reads  | Uses     | Uses     | Uses      | Reads  | Uses   | —        | —      |

---

## Engine Interaction Principles

1. **DNA is Read-Only for Most Engines** — Only the DNA Engine and Progress Engine may write to DNA. All other engines read only.

2. **Knowledge Graph is the Knowledge Hub** — All engines consume from and contribute to the Knowledge Graph. It is the shared knowledge backbone.

3. **Decisions Feed Plans** — Decision outcomes are the primary input for plan generation. Plans rarely exist without a preceding decision.

4. **Execution Closes the Loop** — Execution outcomes flow back to Decision and Planning for learning and adaptation.

5. **AI Orchestrator is the Only AI Gateway** — No engine calls AI providers directly. All AI goes through the Orchestrator.

6. **Progress is Computed, Not Captured** — Progress metrics are derived from events across all engines, not captured as a single data point.

7. **Recommendations are Cross-Domain** — Recommendations synthesize data from all domains. No single domain owns the recommendation.

---

## Cross-References

| Reference | Relationship                                                                  |
| --------- | ----------------------------------------------------------------------------- |
| ARC-002   | Decision Intelligence is the central engine for all decision-making           |
| ARC-003   | Knowledge Graph is the knowledge backbone — consumed by all engines           |
| ARC-004   | Execution Intelligence is the action engine — closes the feedback loop        |
| ARC-005   | AI Orchestrator is the gateway — provides AI capabilities to all engines      |
| PRD-002   | User DNA is the personalization core — consumed by all intelligence engines   |
| ENG-001   | Domain concepts provide the semantic structure for engine interactions        |
| ENG-002   | 21 services implement these engine interactions through service contracts     |
| ENG-003   | Information types (Knowledge, Decision, Execution, etc.) flow between engines |
