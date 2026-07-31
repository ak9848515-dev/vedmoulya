# End-to-End Flows

**ENG-004 — Document 04/10 — Solution Blueprint**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Solution Architect
**Created:** 2026-07-27
**Cross-references:** CMP-001, PRD-001, PRD-002, ARC-002, ARC-003, ARC-004, ARC-005, ENG-001, ENG-002, ENG-003

---

## Purpose

This document defines the **end-to-end flows** that demonstrate how the VedMoulya platform works from the user's perspective. Each flow traces through the layers, services, engines, and information types that participate in a complete user journey.

---

## Flow 1: Career Journey

**Description:** A user explores career paths, receives guidance, and takes action on a career decision.

```text
USER                PRESENTATION          CAREER SERVICE        DECISION SERVICE        KNOWLEDGE       PLANNING       EXECUTION
 │                       │                      │                     │                   SERVICE        SERVICE        SERVICE
 │  "Explore careers"    │                      │                     │                      │              │              │
 │──────────────────────▶│                      │                     │                      │              │              │
 │                       │  GetCareerGuidance() │                     │                      │              │              │
 │                       │─────────────────────▶│                     │                      │              │              │
 │                       │                      │  GetDNA(career_dim) │                      │              │              │
 │                       │                      │─────────────────────▶──── DNA Service ────▶│              │              │
 │                       │                      │                     │                      │              │              │
 │                       │                      │  Search(career_data)│                      │              │              │
 │                       │                      │───────────────────────────────────────────▶│              │              │
 │                       │                      │                     │                      │              │              │
 │                       │                      │  MakeDecision(      │                      │              │              │
 │                       │                      │   type:career)      │                      │              │              │
 │                       │                      │─────────────────────▶│                      │              │              │
 │                       │                      │                     │  GetKnowledge(market)  │              │              │
 │                       │                      │                     │──────────────────────▶│              │              │
 │                       │                      │                     │  GetMemories(past_exp)│              │              │
 │                       │                      │                     │─── Memory Service ──▶│              │              │
 │                       │                      │                     │                      │              │              │
 │                       │                      │                     │  ◀── Decision Made ──│              │              │
 │                       │                      │  ◀── Decision ────│  (selected path,      │              │              │
 │                       │                      │       Result        │   confidence,         │              │              │
 │                       │                      │                     │   explanation)        │              │              │
 │                       │                      │                     │                      │              │              │
 │                       │                      │  GeneratePlan(goal)  │                      │              │              │
 │                       │                      │───────────────────────────────────────────────────────▶│              │
 │                       │                      │                     │                      │              │              │
 │                       │                      │                     │                      │  ◀── Plan ──│              │
 │                       │                      │                     │                      │              │              │
 │                       │  ◀── Guidance ─────│                     │                      │              │              │
 │                       │  (path, plan,       │                     │                      │              │              │
 │                       │   explanation)      │                     │                      │              │              │
 │                       │                      │                     │                      │              │              │
 │  ◀── See guidance ──│                      │                     │                      │              │              │
 │                       │                      │                     │                      │              │              │
 │  "Start the plan"     │                      │                     │                      │              │              │
 │──────────────────────▶│                      │                     │                      │              │              │
 │                       │  StartExecution()    │                     │                      │              │              │
 │                       │───────────────────────────────────────────────────────────────────────────────────▶│
 │                       │                      │                     │                      │              │  Start tasks│
 │                       │                      │                     │                      │              │────────────▶│
 │                       │                      │                     │                      │              │  Track done │
 │                       │                      │                     │                      │              │  ◀──────────│
 │                       │                      │                     │                      │              │              │
 │  ◀── Plan started ──│                      │                     │                      │              │              │
```

---

## Flow 2: Learning Journey

**Description:** A user identifies skill gaps and starts a learning path.

```text
USER → Learning Service → DNA Service → Knowledge Service → Decision Service → Planning Service → Execution Service
 │         │                   │               │                   │                  │                 │
 │  "What   │                   │               │                   │                  │                 │
 │  should  │                   │               │                   │                  │                 │
 │  I learn?│                   │               │                   │                  │                 │
 │─────────▶│                   │               │                   │                  │                 │
 │          │  GetDNASkills()   │               │                   │                  │                 │
 │          │──────────────────▶│               │                   │                  │                 │
 │          │  ◀── skills ────│               │                   │                  │                 │
 │          │                   │               │                   │                  │                 │
 │          │  GetCareerGoal()  │               │                   │                  │                 │
 │          │──────────────────────────────────▶│                   │                  │                 │
 │          │  ◀── goal_skills │               │                   │                  │                 │
 │          │                   │               │                   │                  │                 │
 │          │  RecommendLearning(DNA, goal)      │                   │                  │                 │
 │          │────────────────────────────────────────▶              │                  │                 │
 │          │                   │               │    ◀── rec ─────│                  │                 │
 │          │                   │               │                   │                  │                 │
 │          │  GeneratePlan(learning_goal)       │                   │                  │                 │
 │          │───────────────────────────────────────────────────────────────────────▶│                 │
 │          │                   │               │                   │                  │  Schedule       │
 │          │                   │               │                   │                  │─────────────▶   │
 │          │  ◀── plan ─────│               │                   │                  │                 │
 │  ◀── rec ─│                   │               │                   │                  │                 │
 │  + plan   │                   │               │                   │                  │                 │
```

---

## Flow 3: Business Journey

**Description:** A user registers a business and receives guidance on growth.

```text
USER → Business Service → DNA Service → Knowledge Service → Decision Service → Finance Service
 │         │                  │               │                   │                 │
 │ "Start  │                  │               │                   │                 │
 │  a biz" │                  │               │                   │                 │
 │────────▶│                  │               │                   │                 │
 │         │  RegisterBiz()   │               │                   │                 │
 │         │── (creates info) │               │                   │                 │
 │         │                  │               │                   │                 │
 │         │  GetDNA(biz_dim) │               │                   │                 │
 │         │─────────────────▶│               │                   │                 │
 │         │  Search(biz_data)│               │                   │                 │
 │         │────────────────────────────────▶│                   │                 │
 │         │                  │               │                   │                 │
 │         │  MakeDecision(   │               │                   │                 │
 │         │   type:biz)      │               │                   │                 │
 │         │─────────────────────────────────────▶                │                 │
 │         │                  │               │                   │  GetFinancial()  │
 │         │                  │               │                   │─────────────────▶│
 │         │                  │               │                   │  ◀── finances ─│
 │         │                  │               │                   │                 │
 │         │  ◀── guidance ─│               │                   │                 │
 │  ◀──see │                  │               │                   │                 │
 │  guidance│                  │               │                   │                 │
```

---

## Flow 4: Daily Planning

**Description:** A user receives an optimized daily plan based on their goals, energy, and schedule.

```text
USER → Planning Service → Context Service → DNA Service → Health Service → Execution Service
 │         │                  │               │              │               │
 │  "Plan  │                  │               │              │               │
 │  my day"│                  │               │              │               │
 │────────▶│                  │               │              │               │
 │         │  GetContext()    │               │              │               │
 │         │─────────────────▶│               │              │               │
 │         │  ◀── context ──│               │              │               │
 │         │                  │               │              │               │
 │         │  GetDNA(energy,  │               │              │               │
 │         │   goals, focus)  │               │              │               │
 │         │──────────────────────────────▶   │              │               │
 │         │                  │               │              │               │
 │         │  GetEnergyPattern()              │              │               │
 │         │─────────────────────────────────────────────────▶               │
 │         │                  │               │              │               │
 │         │  GetActiveGoals()│               │              │               │
 │         │──────────────────────────────────────────────▶  │               │
 │         │                  │               │              │               │
 │         │  GeneratePlan(   │               │              │               │
 │         │   context,       │               │              │               │
 │         │   goals,         │               │              │               │
 │         │   energy)        │               │              │               │
 │         │                  │               │              │               │
 │  ◀──plan│                  │               │              │               │
 │         │                  │               │              │               │
 │  "Start │                  │               │              │               │
 │  plan"  │                  │               │              │               │
 │────────▶│                  │               │              │               │
 │         │  StartExecution()│               │              │               │
 │         │─────────────────────────────────────────────────────────────▶    │
 │         │                  │               │              │               │
 │  ◀──done│                  │               │              │               │
```

---

## Flow 5: Knowledge Capture

**Description:** New knowledge enters the system and propagates to dependent services.

```text
USER → Knowledge Service → Memory Service → Decision Service → Planning Service → AI Orchestration
 │         │                  │               │                  │                 │
 │ "I      │                  │               │                  │                 │
 │ learned │                  │               │                  │                 │
 │ X"     │                  │               │                  │                 │
 │────────▶│                  │               │                  │                 │
 │         │  Validate(knowl) │               │                  │                 │
 │         │── (format,       │               │                  │                 │
 │         │   semantic,      │               │                  │                 │
 │         │   consistency)   │               │                  │                 │
 │         │                  │               │                  │                 │
 │         │  Classify(knowl) │               │                  │                 │
 │         │── (sensitivity,  │               │                  │                 │
 │         │   handling,      │               │                  │                 │
 │         │   retention)     │               │                  │                 │
 │         │                  │               │                  │                 │
 │         │  Store(knowl)    │               │                  │                 │
 │         │── (persist with  │               │                  │                 │
 │         │   provenance)    │               │                  │                 │
 │         │                  │               │                  │                 │
 │         │  EVENT: KnowledgeAdded          │                  │                 │
 │         │────────────────────────────────────▶                │                 │
 │         │                  │               │  Re-evaluate     │                 │
 │         │                  │               │  pending decisions                │
 │         │                  │               │                  │                 │
 │         │  EVENT: KnowledgeAdded          │                  │                 │
 │         │───────────────────────────────────────────────────────▶              │
 │         │                  │               │                  │  Re-check plans │
 │         │                  │               │                  │                 │
 │  ◀──done│                  │               │                  │                 │
```

---

## Flow 6: Decision Making

**Description:** A user requests a decision and the platform evaluates options with explanation.

```text
USER → Decision Service → DNA Service → Knowledge Service → Memory Service → AI Orchestration
 │         │                  │               │                  │                 │
 │  "What  │                  │               │                  │                 │
 │  should │                  │               │                  │                 │
 │  I do?" │                  │               │                  │                 │
 │────────▶│                  │               │                  │                 │
 │         │  IdentifyType()  │               │                  │                 │
 │         │── (career,       │               │                  │                 │
 │         │   learning,      │               │                  │                 │
 │         │   business, etc) │               │                  │                 │
 │         │                  │               │                  │                 │
 │         │  AssembleContext │               │                  │                 │
 │         │─────────────────▶│               │                  │                 │
 │         │────────────────────────────────▶│                  │                 │
 │         │──────────────────────────────────────▶              │                 │
 │         │                  │               │                  │                 │
 │         │  GenerateOptions │               │                  │                 │
 │         │────────────────────────────────▶│  (search)        │                 │
 │         │                  │               │                  │                 │
 │         │  ScoreOptions()  │               │                  │                 │
 │         │── (utility, risk,│               │                  │                 │
 │         │   trade-off)     │               │                  │                 │
 │         │                  │               │                  │                 │
 │         │  ApplyPolicies() │               │                  │                 │
 │         │── (hard policies │               │                  │                 │
 │         │   enforced,      │               │                  │                 │
 │         │   moderate       │               │                  │                 │
 │         │   checked)       │               │                  │                 │
 │         │                  │               │                  │                 │
 │         │  GenerateExp()   │               │                  │                 │
 │         │── (rationale,    │               │                  │                 │
 │         │   confidence,    │               │                  │                 │
 │         │   alternatives)  │               │                  │                 │
 │         │                  │               │                  │                 │
 │  ◀──dec │                  │               │                  │                 │
 │  +expln │                  │               │                  │                 │
```

---

## Flow 7: Execution Cycle

**Description:** A task is executed, tracked, and the feedback loop is closed.

```text
USER → Execution Service → Planning Service → Knowledge Service → Progress Service
 │         │                  │               │                  │
 │  "Done!"│                  │               │                  │
 │────────▶│                  │               │                  │
 │         │  RecordComplete  │               │                  │
 │         │── (task_id,      │               │                  │
 │         │   status=done,   │               │                  │
 │         │   time_actual,   │               │                  │
 │         │   notes)         │               │                  │
 │         │                  │               │                  │
 │         │  EVENT: TaskCompleted            │                  │
 │         │─────────────────▶│               │                  │
 │         │                  │  CheckMilestone│                 │
 │         │                  │── (update      │                  │
 │         │                  │   progress)    │                  │
 │         │                  │               │                  │
 │         │  EVENT: TaskCompleted            │                  │
 │         │──────────────────────────────────────────────▶      │
 │         │                  │               │                  │
 │         │                  │               │  RecalcHPI()     │
 │         │                  │               │                  │
 │         │  RequestAdapt()  │               │                  │
 │         │─────────────────▶│               │                  │
 │         │                  │  AdjustPlan()  │                  │
 │         │                  │── (re-prioritize,                │
 │         │                  │    reschedule if needed)         │
 │         │                  │               │                  │
 │  ◀──done│                  │               │                  │
 │  +updated│                  │               │                  │
```

---

## Flow 8: Feedback Loop

**Description:** User provides feedback on a recommendation, closing the learning loop.

```text
USER → Recommendation Service → Decision Service → DNA Service → Knowledge Service
 │         │                        │               │               │
 │  "Not   │                        │               │               │
 │  useful"│                        │               │               │
 │────────▶│                        │               │               │
 │         │  SubmitFeedback(       │               │               │
 │         │   rec_id,              │               │               │
 │         │   rating=2,            │               │               │
 │         │   reason="not_relevant")               │               │
 │         │                        │               │               │
 │         │  EVENT: RecFeedback    │               │               │
 │         │───────────────────────▶│               │               │
 │         │                        │  LearnFromFeedback()          │
 │         │                        │── (adjust scoring weights)    │
 │         │                        │               │               │
 │         │                        │  Event: DecisionFeedback     │
 │         │                        │──────────────▶               │
 │         │                        │               │  AdjustInference()──┐
 │         │                        │               │  (re-evaluate       │
 │         │                        │               │   future inferences)│
 │         │                        │               │               │
 │  ◀──thanks │                        │               │               │
```

---

## Flow 9: Growth Journey (Cross-Domain)

**Description:** A user's progress across multiple domains is aggregated into a Holistic Growth View.

```text
USER → Progress Service → Career Service → Learning Service → Business Service → Finance Service
 │         │                  │               │               │               │
 │  "How   │                  │               │               │               │
 │  am I   │                  │               │               │               │
 │  doing?"│                  │               │               │               │
 │────────▶│                  │               │               │               │
 │         │  GetProgress(    │               │               │               │
 │         │   career_dim)    │               │               │               │
 │         │─────────────────▶│               │               │               │
 │         │  ◀── career_prog│               │               │               │
 │         │                  │               │               │               │
 │         │  GetProgress(    │               │               │               │
 │         │   learn_dim)     │               │               │               │
 │         │──────────────────────────────▶   │               │               │
 │         │  ◀── learn_prog │               │               │               │
 │         │                  │               │               │               │
 │         │  GetProgress(    │               │               │               │
 │         │   biz_dim)       │               │               │               │
 │         │─────────────────────────────────────────────▶    │               │
 │         │  ◀── biz_prog   │               │               │               │
 │         │                  │               │               │               │
 │         │  GetProgress(    │               │               │               │
 │         │   finance_dim)   │               │               │               │
 │         │──────────────────────────────────────────────────────────────▶   │
 │         │  ◀── fin_prog   │               │               │               │
 │         │                  │               │               │               │
 │         │  ComputeHPI()    │               │               │               │
 │         │── (aggregate all │               │               │               │
 │         │   domains,       │               │               │               │
 │         │   apply weights, │               │               │               │
 │         │   trend analysis)│               │               │               │
 │         │                  │               │               │               │
 │  ◀── HPI│                  │               │               │               │
 │  +trends│                  │               │               │               │
```

---

## Flow Summary

| Flow                  | Primary Service | Supporting Services                           | User Outcome                       |
| --------------------- | --------------- | --------------------------------------------- | ---------------------------------- |
| **Career Journey**    | Career          | DNA, Knowledge, Decision, Planning, Execution | Career path with actionable plan   |
| **Learning Journey**  | Learning        | DNA, Knowledge, Decision, Planning, Execution | Learning path with schedule        |
| **Business Journey**  | Business        | DNA, Knowledge, Decision, Finance             | Business guidance                  |
| **Daily Planning**    | Planning        | Context, DNA, Health, Execution               | Optimized daily plan               |
| **Knowledge Capture** | Knowledge       | Memory, Decision, Planning, AI                | Knowledge persisted and propagated |
| **Decision Making**   | Decision        | DNA, Knowledge, Memory, AI                    | Explained decision                 |
| **Execution Cycle**   | Execution       | Planning, Progress                            | Task completed, feedback captured  |
| **Feedback Loop**     | Recommendation  | Decision, DNA, Knowledge                      | Recommendations improved           |
| **Growth Journey**    | Progress        | Career, Learning, Business, Finance           | Holistic growth view               |

---

## Cross-References

| Reference | Relationship                                                                      |
| --------- | --------------------------------------------------------------------------------- |
| PRD-001   | Each flow corresponds to one or more Human Journey stages                         |
| PRD-002   | User DNA is consumed in every flow for personalization                            |
| ARC-002   | Decision flow illustrates the Decision Intelligence lifecycle                     |
| ARC-003   | Knowledge capture flow illustrates the Knowledge Graph lifecycle                  |
| ARC-004   | Execution cycle and daily planning illustrate Execution Intelligence              |
| ARC-005   | Decision flow uses AI Orchestration for context assembly                          |
| ENG-001   | Domain concepts (Goal, Knowledge, Decision) appear in every flow                  |
| ENG-002   | All 21 services participate across the 9 flows                                    |
| ENG-003   | Information types (Knowledge, Decision, Execution, etc.) are created in each flow |
