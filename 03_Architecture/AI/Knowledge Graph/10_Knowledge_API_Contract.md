# Knowledge API Contract

**ARC-003 — Document 10/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Knowledge Architect
**Created:** 2026-07-24
**Cross-references:** ARC-003/D01, ARC-003/D07, ARC-001, ARC-002

---

## Purpose

The Knowledge API Contract defines the **conceptual interface** between the Life Knowledge Graph and all other systems within VedMoulya. This is NOT a REST API, NOT a GraphQL schema, and NOT a code interface. It is a **conceptual contract** describing what information flows in and out of the Knowledge Graph, and how consumers interact with it.

---

## Conceptual Contract

```
┌─────────────────────────────────────────────────────────────┐
│                     KNOWLEDGE GRAPH                          │
│                                                             │
│    ┌─────────────────────────────────────────────────┐      │
│    │            KNOWLEDGE API CONTRACT                │      │
│    │                                                  │      │
│    │  Inputs:   Capture, Query, Command, Feedback     │      │
│    │  Outputs:  Knowledge, Insight, Recommendation    │      │
│    │  Metadata: Confidence, Traceability, Quality     │      │
│    └─────────────────────────────────────────────────┘      │
│                                                             │
│    ┌────────────┐  ┌────────────┐  ┌────────────┐          │
│    │ Decision   │  │ Planning   │  │ AI         │          │
│    │Intelligence│  │ Engine     │  │Orchestrator│          │
│    └────────────┘  └────────────┘  └────────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Inputs — What Goes Into The Graph

### 1. Capture Request

**Purpose:** New knowledge enters the graph.

**Conceptual inputs:**

- **Entity type** — What kind of thing is this
- **Content** — The knowledge itself
- **Source** — Where it came from (conversation, document, user)
- **Context** — What was happening when it was captured
- **Temporal** — When it was captured

**Conceptual output:**

- **Confirmation** — Knowledge was captured
- **Entity reference** — What was created
- **Quality assessment** — Initial quality score
- **Suggested connections** — Existing entities it may relate to

### 2. Query Request

**Purpose:** Retrieve knowledge from the graph.

**Conceptual inputs:**

- **Intent** — Why knowledge is being requested (decision, planning, learning)
- **Context** — Current user context (goals, projects, stage)
- **Scope** — What domain, time period, or entity type
- **Quality threshold** — Minimum confidence required
- **Depth** — How much detail is needed (simple, standard, detailed)

**Conceptual output:**

- **Knowledge** — The entities and relationships that match
- **Relevance** — Why each result is relevant
- **Confidence** — Quality score for each result
- **Temporal** — When the knowledge was valid
- **Evidence** — Where the knowledge came from

### 3. Command Request

**Purpose:** Modify or manage knowledge in the graph.

**Conceptual inputs:**

- **Command type** — Create, Update, Archive, Delete, Connect, Disconnect
- **Target** — Which entity or relationship
- **Changes** — What is being changed
- **Reason** — Why the change is being made

**Conceptual output:**

- **Confirmation** — Change was applied
- **Previous state** — What it was before (for history)
- **New state** — What it is now
- **Impact** — What other entities are affected

### 4. Feedback Request

**Purpose:** Provide feedback on knowledge quality or recommendation accuracy.

**Conceptual inputs:**

- **Target** — Which recommendation or knowledge
- **Feedback type** — Correct, Incorrect, Helpful, Not Helpful
- **Correction** — What the correct knowledge should be (if applicable)
- **Context** — Why the feedback is being given

**Conceptual output:**

- **Acknowledgment** — Feedback was received
- **Quality update** — How confidence was adjusted
- **Gratitude** — Acknowledgment of the user's contribution

---

## Outputs — What Comes Out Of The Graph

### 1. Knowledge Response

**Purpose:** Return knowledge from a query.

**Conceptual structure:**

```
{
  "request": { What was asked },
  "results": [
    {
      "entity": { The knowledge entity },
      "relevance": { Why this is relevant },
      "confidence": { Quality score },
      "evidence": { Source and validation },
      "temporal": { When this was valid },
      "connections": [ { Related entities } ]
    }
  ],
  "metadata": {
    "total_results": { Count },
    "quality_range": { Min to max quality },
    "temporal_range": { Time period covered },
    "query_time": { How long it took }
  }
}
```

### 2. Insight Response

**Purpose:** Provide an interpreted insight derived from the graph.

**Conceptual structure:**

```
{
  "insight": { The insight itself },
  "type": { Pattern, Gap, Trend, Anomaly, Connection },
  "evidence": {
    "entities": [ { Key entities involved } ],
    "relationships": [ { Key relationships } ],
    "confidence": { Quality score }
  },
  "implication": { What this means for the user },
  "suggestion": { What the user might do about it }
}
```

### 3. Recommendation Response

**Purpose:** Suggest an action, learning, or connection.

**Conceptual structure:**

```
{
  "recommendation": { What is being recommended },
  "type": { Learning, Career, Business, Skill, Connection, Action },
  "rationale": {
    "primary_reason": { Main reason },
    "contributing_factors": [
      { "factor": "Goal X", "influence": "Strong" },
      { "factor": "Skill Y", "influence": "Medium" }
    ],
    "alternatives_considered": [ { Other options } ]
  },
  "confidence": { Confidence level },
  "expected_impact": { What will happen if followed },
  "alternative": { Next best option }
}
```

### 4. Status Response

**Purpose:** Report the health and state of the Knowledge Graph.

**Conceptual structure:**

```
{
  "status": { Healthy, Degraded, Syncing },
  "stats": {
    "total_entities": { Count },
    "total_relationships": { Count },
    "average_quality": { Score },
    "last_updated": { Timestamp }
  },
  "recent_activity": {
    "new_knowledge": { Count in last N period },
    "quality_changes": { Notable changes },
    "evolution": { How graph has changed }
  }
}
```

---

## Metadata

Every interaction with the Knowledge Graph carries metadata:

### Request Metadata

| Field          | Purpose                                      |
| -------------- | -------------------------------------------- |
| **Request ID** | Unique identifier for the request            |
| **Timestamp**  | When the request was made                    |
| **Source**     | Which system or user made the request        |
| **Context**    | Current user context (goals, project, stage) |
| **Priority**   | How urgent the request is                    |

### Response Metadata

| Field               | Purpose                                  |
| ------------------- | ---------------------------------------- |
| **Response ID**     | Linked to Request ID                     |
| **Processing time** | How long the response took               |
| **Quality summary** | Aggregate quality of returned knowledge  |
| **Cache status**    | Was this from cache or fresh computation |
| **Limitations**     | Any constraints on the response          |

---

## Confidence

Every knowledge response includes confidence information:

| Component                  | Description                             |
| -------------------------- | --------------------------------------- |
| **Overall confidence**     | Aggregate confidence of the response    |
| **Per-result confidence**  | Individual confidence for each result   |
| **Confidence breakdown**   | Accuracy, freshness, consistency scores |
| **Confidence explanation** | Why this confidence level was assigned  |

---

## Traceability

Every response is traceable back to its sources:

```
Response
  ├── Entity X (confidence: 0.85)
  │     ├── Source: Conversation with AI (2026-01-15)
  │     ├── Validated by: User (2026-01-16)
  │     └── Last verified: 2026-06-01
  ├── Relationship Y (confidence: 0.72)
  │     ├── Source: AI inference from Project Z
  │     └── Status: Suggested (not confirmed)
  └── Metadata
        ├── Query executed: 2026-07-24T10:30:00Z
        ├── Processing time: 1.2s
        └── Quality range: 0.65 — 0.92
```

---

## Consumer Responsibilities

| Responsibility        | Description                                         |
| --------------------- | --------------------------------------------------- |
| **Provide context**   | Every request must include user context             |
| **Handle confidence** | Consumers must respect confidence levels            |
| **Provide feedback**  | Consumers should report knowledge quality           |
| **Respect privacy**   | Consumers must honor visibility levels              |
| **Handle errors**     | Consumers must handle degraded responses gracefully |
| **Cache responsibly** | Consumers must respect freshness requirements       |

---

## Quality of Service

| Metric            | Target                                         |
| ----------------- | ---------------------------------------------- |
| **Response time** | < 500ms for standard queries                   |
| **Availability**  | 99.9% uptime                                   |
| **Freshness**     | Knowledge is never stale by more than 24 hours |
| **Accuracy**      | > 95% for high-confidence knowledge            |
| **Completeness**  | > 90% of queries return meaningful results     |

---

## Future Expansion

- **Streaming responses** — Real-time knowledge as it is captured
- **Push notifications** — Graph proactively pushes relevant knowledge
- **Batch operations** — Bulk knowledge operations for efficiency
- **Subscription model** — Subscribe to changes in specific knowledge areas
- **Webhook model** — External systems notified of knowledge changes
- **Federation API** — Cross-user knowledge graph queries
