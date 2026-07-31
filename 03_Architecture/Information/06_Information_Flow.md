# Information Flow

**ENG-003 — Document 06/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Information Architect
**Created:** 2026-07-27
**Cross-references:** CMP-001, ARC-001, ARC-002, ARC-003, ARC-004, ARC-005, ENG-001, ENG-002, ENG-003/D01, ENG-003/D02, ENG-003/D03

---

## Purpose

This document defines the **information flow model** — how information moves through VedMoulya from its origin through transformation, consumption, feedback, and evolution. It describes information lineage, propagation, dependencies, and synchronization patterns.

---

## Flow Philosophy

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                   INFORMATION FLOW PHILOSOPHY                            │
│                                                                         │
│  Every piece of information has a LINEAGE — a traceable path from       │
│  its origin through every transformation to its final use.              │
│                                                                         │
│  Information flows are:                                                  │
│  1. TRACEABLE — Every transformation is recorded                        │
│  2. VERIFIABLE — Quality is maintained through each step                │
│  3. GOVERNED — Classification and privacy rules follow the flow        │
│  4. EFFICIENT — Information is not unnecessarily copied or moved       │
│  5. CONSISTENT — Information remains consistent across the system       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Flow Stages

### 1. Origin

**Purpose:** Information enters the VedMoulya ecosystem from one of five origins.

**Origin Types:**

| Origin                 | Description                                       | Sensitivity at Origin              | Quality at Origin                |
| ---------------------- | ------------------------------------------------- | ---------------------------------- | -------------------------------- |
| **User Input**         | User declares, enters, or uploads information     | PERSONAL (for user data)           | High (direct from user)          |
| **System Capture**     | System records an event or interaction            | Varies (CONFIDENTIAL to SENSITIVE) | High (direct observation)        |
| **AI Inference**       | AI system deduces or generates information        | DERIVED (labeled as such)          | Low to Medium (needs validation) |
| **External Ingestion** | External API or data source provides information  | Varies (per source agreement)      | Variable (depends on source)     |
| **Derivation**         | Information is computed from existing information | Same as source + DERIVED           | Medium (computed from source)    |

**Origin Requirements:**

- Every information piece records its origin type
- Origin metadata is immutable (cannot be changed after recording)
- Origin is linked to the creating service and user (if applicable)

### 2. Transformation

**Purpose:** Information is processed, enriched, filtered, or aggregated.

**Transformation Types:**

| Type              | Description                                       | Example                               |
| ----------------- | ------------------------------------------------- | ------------------------------------- |
| **Enrichment**    | Additional information is added                   | Knowledge entity gets relationships   |
| **Filtering**     | Irrelevant or low-quality information is removed  | Recommendation filtering              |
| **Aggregation**   | Multiple information points combined into one     | HPI computation from multiple metrics |
| **Inference**     | New information derived from patterns             | Skill inferred from activity          |
| **Translation**   | Information converted to different representation | Knowledge entity summarized           |
| **Validation**    | Information quality is verified                   | Cross-validation of skill assessment  |
| **Anonymization** | Personal identifiers removed                      | Analytics data anonymization          |

**Transformation Requirements:**

- Every transformation is recorded in the information lineage
- Source information is preserved (transformations do not destroy originals)
- Quality scores are updated after transformation
- Classification may change (e.g., aggregation may reduce sensitivity)

### 3. Consumption

**Purpose:** Information is used by services, users, and AI systems.

**Consumption Patterns:**

| Pattern          | Description                                    | Governance                |
| ---------------- | ---------------------------------------------- | ------------------------- |
| **Query**        | Service reads information without modifying it | Access control enforced   |
| **Reference**    | Information is cited or attributed in output   | Attribution tracked       |
| **Processing**   | Information is used as input to computation    | Lineage recorded          |
| **Presentation** | Information is displayed to user               | Privacy filters applied   |
| **Decision**     | Information informs a decision                 | Decision context recorded |

**Consumption Requirements:**

- Every consumption of SENSITIVE or PERSONAL information is audited
- Consumers access only the minimum information needed
- Consumption is bounded by classification (no unauthorized access)
- Consumption for AI processing follows minimum context principle (ARC-005)

### 4. Feedback

**Purpose:** Consumers provide feedback on information quality and utility.

**Feedback Types:**

| Type            | Description                                             | Effect                              |
| --------------- | ------------------------------------------------------- | ----------------------------------- |
| **Correctness** | Information is correct, incorrect, or partially correct | Quality score adjustment            |
| **Freshness**   | Information is current or outdated                      | Freshness score update              |
| **Relevance**   | Information was useful or not useful for the purpose    | Relevance score                     |
| **Confidence**  | User confirms or challenges confidence level            | Confidence adjustment               |
| **Override**    | User provides corrected value                           | Override recorded, source preserved |

**Feedback Loop:**

```text
Information → Consumer → Feedback → Information Quality Updated → Better Future Use
```

**Feedback Requirements:**

- Feedback is linked to the specific information version
- Feedback updates quality scores (ENG-003/D09)
- Feedback is attributed to the feedback provider
- Feedback may trigger re-validation or re-classification

### 5. Propagation

**Purpose:** Information changes propagate to dependent information and consumers.

**Propagation Types:**

| Type                   | Description                              | Speed            |
| ---------------------- | ---------------------------------------- | ---------------- |
| **Event-Driven**       | Changes announced through events         | Near real-time   |
| **Poll-Based**         | Consumers check for updates periodically | Minutes to hours |
| **Cache Invalidation** | Cached copies are invalidated            | Immediate        |
| **Batch Sync**         | Periodic bulk synchronization            | Hours to days    |

**Propagation Rules:**

1. **Direct Propagation** — Changes to source information propagate to directly derived information
2. **Cascading Propagation** — Changes propagate through chains (A → B → C)
3. **Bounded Propagation** — Propagation stops at information type boundaries (does not cross sensitivity levels without re-validation)
4. **Authoritative Source** — The authoritative source is always the origin service. Cached copies are never authoritative.

**Example Propagation Chain:**

```text
DNA Dimension Updated (Origin: DNA Service)
  ↓ Event: DNADimensionChanged
  ↓
Decision Service (Consumer)
  ↓ Re-evaluates pending decisions
  ↓
Planning Service (Consumer)
  ↓ Re-checks plan alignment
  ↓
Execution Service (Consumer)
  ↓ Re-computes task priority
  ↓
Progress Service (Consumer)
  ↓ Re-calculates HPI if applicable
```

### 6. Dependencies

**Purpose:** Information may depend on other information for its creation, validation, or quality.

**Dependency Types:**

| Type                      | Description                                              | Example                                       |
| ------------------------- | -------------------------------------------------------- | --------------------------------------------- |
| **Source Dependency**     | Information A is created from Information B              | Goal depends on User DNA                      |
| **Validation Dependency** | Information A's quality depends on Information B         | Skill confidence depends on assessment data   |
| **Quality Dependency**    | Information A's score depends on Information B's quality | Recommendation quality depends on DNA quality |
| **Lifecycle Dependency**  | Information A's lifecycle stage depends on Information B | Plan archival depends on Goal completion      |

**Dependency Rules:**

1. **Dependencies are Documented** — Every information dependency is documented in this architecture
2. **Dependency Quality Affects Dependent Quality** — If source information has low quality, derived information inherits lower quality
3. **Dependency Failures Are Detected** — If source information is unavailable or degraded, consumers are notified
4. **No Circular Dependencies** — Information dependencies form a directed acyclic graph

**Dependency Chain Example:**

```text
User DNA (Skill Dimension)
  └──▶ Goal Information (Goal depends on skill assessment)
        └──▶ Plan Information (Plan depends on goal)
              └──▶ Execution Information (Tasks depend on plan)
                    └──▶ Progress Information (HPI depends on execution)
                          └──▶ Decision Information (Future decisions reference past progress)
```

### 7. Synchronization

**Purpose:** Information consistency is maintained across the platform.

**Synchronization Patterns:**

| Pattern                  | When Used                        | Consistency Model                                   |
| ------------------------ | -------------------------------- | --------------------------------------------------- |
| **Strong Consistency**   | Within a single service boundary | Immediate — all reads see latest write              |
| **Eventual Consistency** | Across service boundaries        | Asynchronous — reads may see stale data temporarily |
| **Read-Your-Writes**     | User-facing operations           | User sees their own writes immediately              |
| **Snapshot Isolation**   | Analytics and reporting          | Point-in-time consistent views                      |

**Synchronization Rules:**

1. **Strong Within Service** — Information is strongly consistent within the owning service's boundary
2. **Eventual Across Services** — Information is eventually consistent across service boundaries
3. **Conflict Resolution** — Conflicts are resolved by: (a) last-writer-wins for non-critical data, (b) human review for critical data
4. **Staleness Tolerances** — Each consumer defines its staleness tolerance (how old information can be before refresh is needed)

---

## Information Lineage

### Lineage Model

Every piece of information carries a **lineage record** that traces its complete history. The lineage records:

- **Origin** — Whether the information arrived via user input, system capture, AI inference, external ingestion, or derivation. The creator (user, service, or AI model) and the creation timestamp are recorded.
- **Transformations** — Every enrichment, validation, aggregation, or other transformation applied to the information, in order. Each transformation records when it occurred, which service performed it, and what changed.
- **Consumptions** — Every significant use of the information, recording which consumer accessed it, when, and for what purpose.
- **Feedback** — Any corrections, confirmations, or quality ratings provided by consumers, linked to the specific version of the information.

**Lineage Example (narrative form):**

A skill assessment result is created when a user completes an assessment (Origin: system capture, Creator: User-123). The Knowledge Service enriches it by adding related skill relationships (Transformation: enrichment, added 3 prerequisite relationships). The Validation Gate validates it against past assessments (Transformation: validation, passed with score 0.85). The Decision Service consumes it for a career decision (Consumption: career path recommendation). The user later confirms the accuracy of the assessment (Feedback: confidence increased from 0.7 to 0.9).

This lineage is recorded as structured metadata attached to the information piece — not as free-form text, but as a chronological, queryable record of the information's complete history.

### Lineage Requirements

1. **Immutable** — Lineage records cannot be modified (only appended to)
2. **Complete** — Every transformation, consumption, and feedback is recorded
3. **Traceable** — From any information piece, you can trace back to its origin
4. **Linkable** — Lineage records link to related information (source, derived, referenced)

---

## Information Flow Diagram

```text
┌═══════════════════════════════════════════════════════════════════════════════════════════════┐
║                          VEDMOULYA INFORMATION FLOW                                            ║
║                          ──────────────────────────                                           ║
║                          End-to-end flow from origin through transformation to use             ║
╚═══════════════════════════════════════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                              INFORMATION ORIGINS                                              │
│                                                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   User      │  │   System    │  │     AI      │  │   External  │  │  Derived    │        │
│  │   Input     │  │   Capture   │  │  Inference   │  │  Ingestion  │  │  (Computed) │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │                │                 │
└─────────┼────────────────┼────────────────┼────────────────┼────────────────┼────────────────┘
          │                │                │                │                │
          ▼                ▼                ▼                ▼                ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                              INFORMATION CAPTURE & VALIDATION                                 │
│                                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                     VALIDATION GATES                                                     │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐   │   │
│  │  │  Format  │  │ Semantic │  │  Source  │  │  Cross-  │  │Consistency│  │  Human  │   │   │
│  │  │  Check   │  │  Check   │  │  Verify  │  │ Validate │  │  Check   │  │ Review  │   │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └─────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                                        │
│                                    ▼                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                     CLASSIFICATION LABELING                                             │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐              │   │
│  │  │Sensitivity│  │Handling  │  │  Audit   │  │Retention │  │  Label   │              │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘              │   │
│  └──────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                               │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                              INFORMATION FLOWS                                                │
│                                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                     SERVICE-TO-SERVICE FLOW                                              │   │
│  │                                                                                          │   │
│  │  Service A ──▶(Query/Command/Request/Event)──▶ Service B                                │   │
│  │  (Producer)     (via service contracts)          (Consumer)                              │   │
│  │                                                                                          │   │
│  │  Governance: Access control → Audit → Quality check → Classification enforcement        │   │
│  └──────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                     USER-FACING FLOW                                                     │   │
│  │                                                                                          │   │
│  │  Service ──▶(Privacy Filter)──▶(Personalization)──▶(Presentation)──▶ User              │   │
│  │                                                                                          │   │
│  │  Governance: Privacy filter → Consent check → Sensitivity masking → Audit              │   │
│  └──────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                     AI PROVIDER FLOW (Minimum Context)                                   │   │
│  │                                                                                          │   │
│  │  VedMoulya ──▶(Context Assembly)──▶(Privacy Filter)──▶(Minimal Prompt)──▶ AI Provider  │   │
│  │                                                                                          │   │
│  │  Governance: Minimum context → No PII → Ephemeral → Not used for training               │   │
│  └──────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                     ANALYTICS FLOW                                                        │   │
│  │                                                                                          │   │
│  │  Service ──▶(Event)──▶(Anonymization)──▶(Aggregation)──▶ Analytics Store                │   │
│  │                                                                                          │   │
│  │  Governance: Anonymization → Aggregation → Retention limit → Access control             │   │
│  └──────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                     AUDIT FLOW                                                            │   │
│  │                                                                                          │   │
│  │  Service ──▶(Audit Event)──▶(Integrity Check)──▶(Immutable Store)──▶ Audit Trail        │   │
│  │                                                                                          │   │
│  │  Governance: Integrity verification → Immutability → Retention → Access control         │   │
│  └──────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                               │
└──────────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                              FEEDBACK & EVOLUTION                                            │
│                                                                                               │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐               │
│  │ Information │────▶│  Consumer   │────▶│  Feedback   │────▶│  Quality    │               │
│  │  (Source)   │     │  (Service)  │     │  (Response) │     │  Update     │               │
│  └─────────────┘     └─────────────┘     └─────────────┘     └──────┬──────┘               │
│                                                                      │                        │
│                                                                      ▼                        │
│                                                               ┌─────────────┐               │
│                                                               │  Corrected  │               │
│                                                               │ Information │────▶ Consumers │
│                                                               └─────────────┘               │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Major Information Flows

### Flow 1: User Input → DNA → Intelligence → User

```text
User declares skill level
  ↓
DNA Service captures skill information (Origin: User Input)
  ↓
Validation Gate: Check consistency with past assessments
  ↓
Classification: PERSONAL (skill is part of User DNA)
  ↓
Event: DNADimensionChanged
  ↓
Decision Service consumes skill information for career decisions
  ↓
Recommendation Service consumes skill information for learning recommendations
  ↓
User sees updated skill profile (Presentation)
  ↓
User confirms or corrects skill level (Feedback)
  ↓
Quality score updated based on user confirmation
```

### Flow 2: User Action → Execution → Progress → User

```text
User completes a task
  ↓
Execution Service captures execution event (Origin: System Capture)
  ↓
Classification: CONFIDENTIAL
  ↓
Event: TaskCompleted
  ↓
Progress Service consumes execution event
  ↓
HPI recalculated (Transformation: Aggregation)
  ↓
Progress trend updated
  ↓
User sees updated progress dashboard (Presentation)
  ↓
Event: HPIChanged → triggers further consumption
```

### Flow 3: AI Decision → Plan → Execution → Feedback → Learning

```text
Decision Service recommends a learning path (Origin: AI Inference)
  ↓
Classification: DERIVED (from DNA + Knowledge)
  ↓
Event: DecisionMade
  ↓
Planning Service generates a study plan (Transformation)
  ↓
Execution Service schedules study tasks
  ↓
User follows the plan and completes tasks
  ↓
Execution feedback collected (Origin: System Capture)
  ↓
Feedback loop: Decision Service learns from outcomes
  ↓
Future decisions improved by past outcomes
```

---

## Flow Governance

| Governance Rule                | Description                                                    | Enforcement            |
| ------------------------------ | -------------------------------------------------------------- | ---------------------- |
| **Lineage Recording**          | Every transformation must record lineage                       | Audit, quality scoring |
| **Classification Propagation** | Derived information inherits source classification (or higher) | Automatic              |
| **Consent Validation**         | PERSONAL information flow requires user consent check          | Before any sharing     |
| **Minimum Context**            | AI provider flow must minimize information shared              | Context assembly gate  |
| **Anonymization Gate**         | Analytics flow must anonymize before aggregation               | Processing pipeline    |
| **Immutability Gate**          | Audit flow must be immutable before storage                    | Storage layer          |
| **Feedback Loop**              | Information consumers must provide quality feedback            | Quality scoring system |
| **Cycle Detection**            | Circular information flows are detected and prevented          | Dependency graph       |

---

## Cross-References

| Reference   | Relationship                                                                                |
| ----------- | ------------------------------------------------------------------------------------------- |
| ARC-001     | Event Flow (ARC-001) defines the event propagation mechanism that supports information flow |
| ARC-002     | Decision flow (ARC-002) is a specialization of information flow for decision information    |
| ARC-003     | Knowledge flow (ARC-003) defines how knowledge information flows through the graph          |
| ARC-004     | Execution flow (ARC-004) shows how execution information flows through the lifecycle        |
| ARC-005     | AI Orchestration information flow follows minimum context principles                        |
| ENG-001     | Domain events (ENG-001) are the triggers for many information flows                         |
| ENG-002     | Service contracts (ENG-002) define how information flows between services                   |
| ENG-003/D03 | Information lifecycle stages define the flow stages for each information type               |
