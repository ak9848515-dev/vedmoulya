# Knowledge Retrieval

**ARC-003 — Document 07/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Knowledge Architect
**Created:** 2026-07-24
**Cross-references:** ARC-003/D01, ARC-002 (Decision Intelligence), PRD-001

---

## Purpose

Knowledge Retrieval defines the **conceptual strategies** for accessing and using knowledge from the Life Knowledge Graph. Retrieval is not just search — it is the intelligent, context-aware delivery of the right knowledge at the right time for the right purpose.

This is NOT a search algorithm specification. No relevance scoring, ranking functions, or query parsing is defined.

---

## Retrieval Paradigm

```
                    ┌─────────────────────────────┐
                    │      Retrieval Request       │
                    │  (Intent + Context + Scope)  │
                    └──────────────┬──────────────┘
                                   ▼
        ┌─────────────────────────────────────────────┐
        │           Retrieval Strategy Selection       │
        │  (Based on purpose, urgency, scope)          │
        └──────┬──────────┬──────────┬────────────────┘
               ▼          ▼          ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Decision │ │Personal- │ │ Planning │
        │ Support  │ │ ization  │ │ Engine   │
        └──────────┘ └──────────┘ └──────────┘
               ▼          ▼          ▼
        ┌─────────────────────────────────────────────┐
        │           Knowledge Response                 │
        │  (Entities + Relationships + Evidence)       │
        └─────────────────────────────────────────────┘
```

---

## Retrieval Strategies

### 1. Decision Support

**Purpose:** Provide the User with relevant context when making a decision.

**Trigger:** User is facing a decision point.

**What is retrieved:**

- Past decisions in similar contexts
- Outcomes of those decisions
- Skills and knowledge available
- Relevant goals and priorities
- Potential risks identified from past experience

**Response structure:**

- What is the decision context
- What has worked before (and what hasn't)
- What capabilities are available
- What goals are affected
- Confidence level of each insight

### 2. Personalization

**Purpose:** Tailor every interaction to the User's unique context.

**Trigger:** Any interaction with the User.

**What is retrieved:**

- Current goals and priorities
- Recent activities and progress
- Known skills and knowledge level
- Learning style and preferences
- Current challenges and blockers

**Response structure:**

- User's current context summary
- Relevant recent history
- Current focus areas
- Personalization parameters

### 3. Planning

**Purpose:** Support the Planning Engine in creating feasible, optimized plans.

**Trigger:** User creates or modifies a plan.

**What is retrieved:**

- Current capability assessment (skills + knowledge)
- Time availability and constraints
- Past project durations and outcomes
- Dependency chains and prerequisites
- Resource availability

**Response structure:**

- Capability inventory
- Dependency graph relevant to the plan
- Historical benchmarks
- Risk assessment based on past similar plans

### 4. Learning

**Purpose:** Recommend what to learn next and how to learn it.

**Trigger:** User wants to learn something new.

**What is retrieved:**

- Current knowledge gaps relative to goals
- Learning history and preferred methods
- Prerequisites for target knowledge
- Available learning resources
- Related skills that could be developed simultaneously

**Response structure:**

- Gap analysis (what you need vs. what you know)
- Recommended learning path
- Prerequisite knowledge required
- Estimated time investment
- Related skills that compound

### 5. Career

**Purpose:** Provide career-relevant knowledge and insights.

**Trigger:** User explores career options or opportunities.

**What is retrieved:**

- Current career trajectory
- Skills relevant to target roles
- Experience gaps for target positions
- Past interview performance
- Network connections in target companies

**Response structure:**

- Career context summary
- Skill gap analysis for target role
- Recommended next steps
- Timeline estimates based on historical progression

### 6. Business

**Purpose:** Support business decisions and operations.

**Trigger:** User interacts with business domain.

**What is retrieved:**

- Client history and relationships
- Service offerings and past delivery
- Financial patterns (income, expenses)
- Business goals and progress
- Market insights gathered from interactions

**Response structure:**

- Business health overview
- Client relationship summary
- Financial pattern analysis
- Growth opportunity identification

### 7. Search

**Purpose:** Direct, explicit retrieval of knowledge.

**Trigger:** User explicitly searches for knowledge.

**What is retrieved:**

- Entities matching the query
- Related entities through graph traversal
- Temporal context (when did this happen?)
- Source and evidence for each result

**Response structure:**

- Direct matches
- Related knowledge
- Context around each result
- Confidence and quality scores

### 8. Recommendations

**Purpose:** Proactively suggest actions, learning, or connections.

**Trigger:** Periodic or event-driven.

**What is retrieved:**

- Goals that are lagging
- Skills that are near-complete
- Connections between recently acquired knowledge
- Opportunities aligned with current capabilities
- Past successful patterns

**Response structure:**

- Recommendation rationale
- Supporting evidence from the graph
- Expected impact
- Confidence level
- Alternative recommendations

### 9. Execution

**Purpose:** Provide real-time knowledge support during task execution.

**Trigger:** User is executing a task.

**What is retrieved:**

- Relevant documentation and notes
- Past similar tasks and how they were done
- Required tools and resources
- Common pitfalls identified from history
- Success patterns

**Response structure:**

- Just-in-time knowledge snippets
- Relevant past examples
- Execution checklist derived from history
- Similar task outcomes for reference

---

## Retrieval Dimensions

### Temporal Dimension

Knowledge can be retrieved with temporal scope:

| Scope          | Meaning                                |
| -------------- | -------------------------------------- |
| **Current**    | Knowledge relevant to right now        |
| **Recent**     | Knowledge from the past N days/weeks   |
| **Historical** | Knowledge from any point in the past   |
| **Projected**  | Knowledge about future plans and goals |

### Contextual Dimension

Knowledge is retrieved in context:

| Context              | Scope                                 |
| -------------------- | ------------------------------------- |
| **Goal context**     | Knowledge related to specific goals   |
| **Domain context**   | Knowledge in a specific domain        |
| **Project context**  | Knowledge for a specific project      |
| **Temporal context** | Knowledge from a specific time period |

### Quality Dimension

Retrieval considers quality thresholds:

| Threshold               | Behavior                                            |
| ----------------------- | --------------------------------------------------- |
| **High quality only**   | Only return knowledge with confidence > 0.8         |
| **Moderate quality**    | Return knowledge with confidence > 0.5, flag lower  |
| **Include suggestions** | Include AI-suggested knowledge with confidence flag |
| **Include all**         | Return everything, sorted by quality                |

---

## Retrieval Response

Every retrieval response should include:

```
- What was retrieved (entities and relationships)
- Why it was retrieved (relevance to request)
- How confident we are (quality scores)
- Where it came from (source traceability)
- When it was valid (temporal context)
- What it is connected to (related knowledge)
```

---

## Retrieval Principles

| Principle         | Description                                                        |
| ----------------- | ------------------------------------------------------------------ |
| **Context-first** | Retrieval is always contextualized to the User's current situation |
| **Quality-aware** | Results include confidence and quality scores                      |
| **Explainable**   | Every result can explain why it was returned                       |
| **Temporal**      | Time is always part of the retrieval context                       |
| **Progressive**   | Start with high-confidence results, expand if needed               |
| **Minimal**       | Return only what is needed, not everything available               |

---

## Future Expansion

- **Predictive retrieval** — Pre-fetch knowledge based on predicted needs
- **Proactive retrieval** — Surface knowledge before the User asks
- **Collaborative retrieval** — Knowledge from trusted peers and mentors
- **Cross-user retrieval** — Anonymized insights from similar user journeys
- **Multimodal retrieval** — Images, audio, video alongside structured knowledge
