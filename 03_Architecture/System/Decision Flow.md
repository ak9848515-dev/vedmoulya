# Decision Flow

**Mission:** Define the complete lifecycle of every decision made by the VedMoulya Intelligence Platform — from user request to learning feedback.

**Version:** 1.0
**Status:** Draft
**Owner:** Chief Enterprise Architect
**Dependencies:** Core Components.md, VedMoulya Intelligence.md, Data Flow.md, Event Flow.md
**Created:** 2026-07-24
**Updated:** 2026-07-24

## Description

Every personalization, recommendation, coaching response, and platform action follows a standardized decision lifecycle. This document defines that lifecycle — the stages, the components involved, the data consulted, and the outputs produced.

---

## Decision Lifecycle Diagram

```
┌──────────┐
│  USER    │
│  REQUEST │
└────┬─────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STAGE 1: UNDERSTAND                           │
│                                                                  │
│  User DNA ───→ Human Journey ───→ Problem Analysis ───→ Context  │
│                                                                  │
│  Output: Complete user context bundle                            │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STAGE 2: KNOW                                │
│                                                                  │
│  Knowledge Retrieval ───→ Memory Recall ───→ Relationship Map    │
│                                                                  │
│  Output: Relevant knowledge + memory context                    │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STAGE 3: REASON                               │
│                                                                  │
│  Options Generation ───→ Evaluation ───→ Trade-off Analysis      │
│                                                                  │
│  Output: Ranked options with rationale                           │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STAGE 4: PLAN                                 │
│                                                                  │
│  Plan Generation ───→ Dependency Check ───→ Timeline Estimation  │
│                                                                  │
│  Output: Actionable plan with steps and timeline                 │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STAGE 5: EXECUTE                              │
│                                                                  │
│  AI Provider Selection ───→ Prompt Assembly ───→ Provider Call   │
│                        (if AI needed)                            │
│                                                                  │
│  OR                                                              │
│                                                                  │
│  System Action ───→ Task Dispatch ───→ Status Tracking            │
│                        (if system action)                        │
│                                                                  │
│  Output: AI Response or Executed Action                          │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STAGE 6: VALIDATE                             │
│                                                                  │
│  Quality Check ───→ Safety Check ───→ User Confirmation          │
│                                                                  │
│  Output: Validated output ready for user                         │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STAGE 7: DELIVER                              │
│                                                                  │
│  Format Output ───→ Generate Explanation ───→ Present to User    │
│                                                                  │
│  Output: User-facing recommendation or response                 │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STAGE 8: LEARN                                │
│                                                                  │
│  Collect Feedback ───→ Update DNA ───→ Update Memory ───→       │
│  Update Knowledge ───→ Analytics Event                          │
│                                                                  │
│  Output: Updated user model + system knowledge                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Stage Details

### Stage 1: Understand

**Trigger:** User request, scheduled action, or system event

**Components involved:** User DNA, User Identity, Context Engine

**Activities:**

1. Identify the user and authenticate
2. Load complete User DNA profile
3. Determine current Human Journey stage
4. **Problem Analysis** — Analyze which validated problems (RSH-001) the user is facing, cross-referencing their DNA, journey stage, and context
5. Load user context (time, energy, constraints, device)
6. Assemble complete context: Who the user is, where they are, what problems they face, what constraints apply

**Output:** Complete user context bundle

```json
{
  "userId": "uuid",
  "dna": {/* 8 dimensions */},
  "journeyStage": "02_Learn",
  "context": {/* time, device, constraints */},
  "activeProblems": ["PROB-001", "PROB-042"],
  "requestType": "learning_recommendation"
}
```

**Duration target:** < 50ms

---

### Stage 2: Know

**Trigger:** Completion of Stage 1

**Components involved:** Knowledge Engine, Memory Engine, Knowledge Relationships

**Activities:**

1. Query Knowledge Graph for relevant information
2. Retrieve user's conversation history and past decisions from Memory
3. Map relationships between request context and knowledge entities
4. Score and rank knowledge by relevance to the request

**Output:** Knowledge context bundle

- Relevant knowledge entities
- Memory snippets (past interactions, decisions)
- Relationship paths
- Identified knowledge gaps

**Duration target:** < 100ms

---

### Stage 3: Reason

**Trigger:** Completion of Stage 2

**Components involved:** Reasoning Engine, Decision Engine

**Activities:**

1. Generate possible options or approaches
2. Evaluate each option against user DNA, goals, and constraints
3. Apply decision frameworks (utility, risk, trade-off)
4. Rank options with confidence scores
5. Generate rationale for the top choice

**Output:** Decision record

- Ranked options
- Selected option with explanation
- Confidence score
- Alternatives considered and why rejected

**Duration target:** < 200ms (simple) to < 2s (complex)

---

### Stage 4: Plan

**Trigger:** Decision made that requires multi-step execution

**Components involved:** Planning Engine, Knowledge Engine

**Activities:**

1. Decompose the decision into actionable steps
2. Identify prerequisites and dependencies
3. Estimate time, effort, and resources per step
4. Generate alternative plan paths
5. Validate plan feasibility

**Output:** Actionable plan

- Ordered steps with descriptions
- Prerequisites and dependencies per step
- Time and resource estimates
- Alternative paths

**Duration target:** < 500ms

---

### Stage 5: Execute

**Trigger:** Plan ready (or direct execution for simple decisions)

**Components involved:** AI Orchestrator (for AI tasks), Execution Engine (for system tasks)

**Activities (AI path):**

1. Select optimal AI provider
2. Assemble prompt with full context from stages 1-4
3. Call provider with structured output format
4. Parse and validate response

**Activities (System path):**

1. Dispatch task to execution engine
2. Create task record with status tracking
3. Execute or queue for execution
4. Return task ID for status monitoring

**Output:** AI response or task confirmation

**Duration target:** AI: < 5s | System: < 100ms

---

### Stage 6: Validate

**Trigger:** Output received from Stage 5

**Components involved:** Security Layer, Safety Checks, User Confirmation

**Activities:**

1. Validate output quality and completeness
2. Check against safety policies and ethical boundaries
3. Verify output matches user's context and constraints
4. Flag for user confirmation if high-stakes decision

**Output:** Validated output (or rejected with explanation)

**Duration target:** < 50ms

---

### Stage 7: Deliver

**Trigger:** Output validated

**Components involved:** Recommendation Engine, User Interface

**Activities:**

1. Format output for the delivery channel (app, email, push)
2. Generate human-readable explanation
3. Include confidence score and data sources
4. Present to user with clear call-to-action

**Output:** User-facing recommendation, response, or notification

**Duration target:** < 50ms

---

### Stage 8: Learn

**Trigger:** User interaction with delivered output

**Components involved:** All components (feedback consumers)

**Activities:**

1. Collect explicit feedback (thumbs up/down, rating)
2. Collect implicit feedback (clicked, ignored, completed, dismissed)
3. Update User DNA with new signals
4. Update Memory with decision outcome
5. Update Knowledge Graph if new information discovered
6. Emit analytics event for platform learning

**Output:** Updated user model and system knowledge

**Duration target:** < 200ms (background)

---

## Decision Types and Path Variations

| Decision Type            | Stages Used      | Typical Duration | AI Required |
| ------------------------ | ---------------- | ---------------- | ----------- |
| Simple recommendation    | 1→2→3→7→8        | < 1s             | Sometimes   |
| Coaching response        | 1→2→3→5→6→7→8    | 2-10s            | Yes         |
| Learning path generation | 1→2→3→4→5→6→7→8  | 5-15s            | Yes         |
| Plan execution           | 1→2→3→4→5→7→8    | Varies (days)    | Sometimes   |
| Opportunity matching     | 1→2→3→7→8        | < 1s             | No          |
| Goal recommendation      | 1→2→3→7→8        | < 2s             | Sometimes   |
| Emergency alert          | 1→6→7 (shortcut) | < 100ms          | No          |

---

## Decision Audit Record

Every decision produces an immutable audit record:

```json
{
  "decisionId": "DEC-20260724-XXXXX",
  "timestamp": "2026-07-24T12:00:00Z",
  "userId": "uuid",
  "decisionType": "learning_recommendation",
  "stages": {
    "understand": {/* context bundle hash */},
    "know": {/* knowledge bundle hash */},
    "reason": {/* options, selection, confidence */},
    "plan": {/* plan steps */},
    "execute": {/* provider, response */},
    "validate": {/* passed, warnings */},
    "deliver": {/* channel, format */},
    "learn": {/* feedback, updates */}
  },
  "totalDuration": 3450
}
```

## Cross-References

- **Core Components.md** — The components that execute each stage
- **Data Flow.md** — How data moves through these stages
- **Knowledge Flow.md** — How knowledge is retrieved and used in stages 2-3
- **Event Flow.md** — Events emitted at each stage
- **VedMoulya Intelligence.md** — The philosophy this flow implements
- **PRD-002** — User DNA drives stages 1 and 8
- **PRD-001** — Human Journey contextualizes stages 1-4
- **RSH-001** — Problem Analysis in Stage 1 cross-references validated human problems
- **CMP-001** — Business strategy determines decision priorities

### Future Expansion

- Parallel decision flows for multi-goal scenarios
- Decision rehearsal (simulate before executing)
- Distributed decisions (multi-user, multi-agent)
- Meta-decisions (deciding how to decide)
- Automated decision optimization via reinforcement learning
