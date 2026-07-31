# Decision API Contract

**Mission:** Define the conceptual request/response contract for the VedMoulya Decision Intelligence Engine — inputs and outputs only, no implementation details, no code.

**Version:** 1.0
**Status:** Draft
**Owner:** Chief Decision Intelligence Architect
**Dependencies:** Decision Intelligence.md, Decision Lifecycle.md, Decision Context.md, Decision Scoring.md, Decision Explainability.md
**Created:** 2026-07-24
**Updated:** 2026-07-24

## Description

This document defines the conceptual contract that all components use to communicate with the Decision Intelligence Engine. It specifies what information must be provided (inputs) and what information will be returned (outputs). No implementation details, REST endpoints, or code are defined.

---

## API Contract Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    REQUEST                                       │   │
│  │                                                                  │   │
│  │  ┌─────────────┐                                                │   │
│  │  │  Decision   │ ← Decision type (career, learning, etc.)       │   │
│  │  │  Type       │                                                │   │
│  │  ├─────────────┤                                                │   │
│  │  │  User       │ ← User ID, authentication token                │   │
│  │  │  Identity   │                                                │   │
│  │  ├─────────────┤                                                │   │
│  │  │  Context    │ ← Complete Decision Context Bundle              │   │
│  │  │  Bundle     │   (static, dynamic, session, env, user)        │   │
│  │  ├─────────────┤                                                │   │
│  │  │  Options    │ ← Optional: pre-filtered candidate options     │   │
│  │  │             │   (if not provided, engine generates)          │   │
│  │  ├─────────────┤                                                │   │
│  │  │  Policies   │ ← Optional: override default policies          │   │
│  │  ├─────────────┤                                                │   │
│  │  │  Format     │ ← Desired explanation format                   │   │
│  │  │             │   (short, standard, detailed)                  │   │
│  │  └─────────────┘                                                │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│                    ┌─────────────────┐                               │
│                    │  DECISION       │                               │
│                    │  INTELLIGENCE   │                               │
│                    │  ENGINE         │                               │
│                    └─────────────────┘                               │
│                              │                                       │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    RESPONSE                                     │   │
│  │                                                                  │   │
│  │  ┌─────────────┐                                                │   │
│  │  │  Decision   │ ← Unique decision identifier                   │   │
│  │  │  ID         │                                                │   │
│  │  ├─────────────┤                                                │   │
│  │  │  Selected   │ ← The recommended option with score            │   │
│  │  │  Option     │                                                │   │
│  │  ├─────────────┤                                                │   │
│  │  │  All        │ ← All options with scores (for alternatives)   │   │
│  │  │  Options    │                                                │   │
│  │  ├─────────────┤                                                │   │
│  │  │  Confidence │ ← Confidence score 0.0-1.0 + level            │   │
│  │  ├─────────────┤                                                │   │
│  │  │  Score      │ ← Total score breakdown per dimension          │   │
│  │  │  Breakdown  │                                                │   │
│  │  ├─────────────┤                                                │   │
│  │  │  Policy     │ ← Policy check results (passed/blocked)        │   │
│  │  │  Results    │                                                │   │
│  │  ├─────────────┤                                                │   │
│  │  │  Explanation│ ← Human-readable explanation (requested fmt)   │   │
│  │  ├─────────────┤                                                │   │
│  │  │  Plan       │ ← If planning phase executed: actionable plan  │   │
│  │  └─────────────┘                                                │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Request Structure

### Required Fields

| Field           | Type   | Description                                         | Source                                       |
| --------------- | ------ | --------------------------------------------------- | -------------------------------------------- |
| `decisionType`  | Enum   | One of the 10 decision types                        | Caller specifies the type of decision needed |
| `userId`        | String | Unique user identifier                              | User Identity                                |
| `contextBundle` | Object | Complete Decision Context (see Decision Context.md) | Context Engine                               |

### Optional Fields

| Field                 | Type    | Default             | Description                                                                                                     |
| --------------------- | ------- | ------------------- | --------------------------------------------------------------------------------------------------------------- |
| `candidateOptions`    | Array   | Generated by engine | Pre-filtered list of options to evaluate. If not provided, the engine generates options from available catalogs |
| `policyOverrides`     | Object  | Default policies    | Temporary policy overrides for specific scenarios (logged in audit)                                             |
| `explanationFormat`   | Enum    | "standard"          | Desired explanation format: "short", "standard", "detailed", "raw"                                              |
| `includeAlternatives` | Boolean | true                | Whether to return alternative options                                                                           |
| `maxAlternatives`     | Integer | 3                   | Maximum number of alternatives to return                                                                        |
| `requireConfirmation` | Boolean | false               | Force user confirmation step regardless of confidence                                                           |
| `includePlan`         | Boolean | false               | Whether to generate an execution plan                                                                           |

---

## Response Structure

### Success Response

| Field            | Type   | Description                                                              |
| ---------------- | ------ | ------------------------------------------------------------------------ |
| `decisionId`     | String | Unique identifier for this decision (used for tracking, feedback, audit) |
| `selectedOption` | Object | The recommended option with its score                                    |
| `allOptions`     | Array  | All evaluated options with scores                                        |
| `confidence`     | Object | Confidence score and level                                               |
| `scoreBreakdown` | Object | Per-dimension scores                                                     |
| `policyResults`  | Object | Policy check results                                                     |
| `explanation`    | Object | Human-readable explanation                                               |
| `plan`           | Object | Optional execution plan                                                  |

#### selectedOption Object

| Field             | Type   | Description                                                                        |
| ----------------- | ------ | ---------------------------------------------------------------------------------- |
| `id`              | String | Option identifier                                                                  |
| `label`           | String | Human-readable option name                                                         |
| `description`     | String | Brief option description                                                           |
| `type`            | Enum   | Option type (course, project, opportunity, etc.)                                   |
| `score`           | Number | Total score (6-130)                                                                |
| `scoreComponents` | Object | Per-dimension scores: { priority, impact, effort, confidence, urgency, readiness } |

#### confidence Object

| Field     | Type   | Description                                                             |
| --------- | ------ | ----------------------------------------------------------------------- |
| `score`   | Number | 0.0 - 1.0                                                               |
| `level`   | Enum   | "low", "medium", "high", "very_high"                                    |
| `factors` | Object | { dataQuality, historicalPerformance, similarUserPatterns } with scores |

#### explanation Object

| Field               | Type   | Description                                         |
| ------------------- | ------ | --------------------------------------------------- |
| `format`            | Enum   | "short", "standard", "detailed", "raw"              |
| `summary`           | String | One-line summary (all formats)                      |
| `reason`            | String | Primary reason (standard+)                          |
| `dnaAttribution`    | Array  | List of DNA attributes used (standard+)             |
| `problemsAddressed` | Array  | List of problem IDs addressed (detailed)            |
| `journeyStage`      | String | Current journey stage context (detailed)            |
| `confidenceText`    | String | Confidence explanation (standard+)                  |
| `alternatives`      | Array  | Alternative options with reasons (standard+)        |
| `rawData`           | Object | Machine-readable explanation data (raw format only) |

#### plan Object (optional)

| Field                | Type   | Description                                  |
| -------------------- | ------ | -------------------------------------------- |
| `steps`              | Array  | Ordered list of execution steps              |
| `totalEstimatedTime` | String | Estimated total duration                     |
| `prerequisites`      | Array  | Prerequisites the user needs before starting |

---

## Error Responses

| Condition                     | Error Type              | Behavior                                             |
| ----------------------------- | ----------------------- | ---------------------------------------------------- |
| User not found                | identity_error          | Return error; no decision made                       |
| Insufficient DNA data         | data_insufficient_error | Return error; specify which dimensions are missing   |
| No options generated          | no_options_error        | Return error; suggest expanding criteria             |
| All options blocked by policy | policy_blocked_error    | Return error; explain which policies were triggered  |
| Engine timeout                | timeout_error           | Return partial results if available; otherwise error |
| Invalid decision type         | invalid_type_error      | Return error; list valid types                       |

---

## Feedback Contract

After a decision is delivered and the user interacts with it, feedback is sent back to the engine:

| Field            | Type               | Description                                                    |
| ---------------- | ------------------ | -------------------------------------------------------------- |
| `decisionId`     | String             | The decision ID this feedback is for                           |
| `action`         | Enum               | "accepted", "rejected", "modified", "dismissed", "ignored"     |
| `rating`         | Integer (optional) | 1-5 rating                                                     |
| `reason`         | String (optional)  | User's reason for rejection                                    |
| `modifiedOption` | String (optional)  | If modified, what the user chose instead                       |
| `completed`      | Boolean (optional) | Did the user complete the recommended action?                  |
| `outcome`        | Object (optional)  | What happened as a result? (goal progress, skill change, etc.) |

---

## Contract Versioning

| Version | Date       | Changes                                    |
| ------- | ---------- | ------------------------------------------ |
| 1.0     | 2026-07-24 | Initial decision intelligence API contract |

- Major version changes when required or optional fields change
- Adding new optional fields is a minor change
- Removing or changing required fields is a major change
- Backward compatibility maintained within major versions

## Cross-References

- **Decision Lifecycle.md** — The lifecycle this contract supports (Phases 1-8)
- **Decision Context.md** — The context bundle sent in requests
- **Decision Scoring.md** — The score breakdown returned in responses
- **Decision Confidence.md** — The confidence object returned in responses
- **Decision Explainability.md** — The explanation object returned in responses
- **Decision Policies.md** — The policy results returned in responses
- **Decision Learning.md** — The feedback contract that closes the loop
- **ARC-001 (Core Components — Decision Engine)** — The system component implementing this contract
- **ARC-001 (Integration Points)** — How this contract integrates with other systems

### Future Expansion

- **Batch decision API** — Request multiple decisions at once
- **Streaming decision API** — Real-time decision updates as context changes
- **Decision preview API** — Preview what decision would be made without committing
- **Decision history API** — Query past decisions and their outcomes
- **Decision comparison API** — Compare multiple options with detailed scoring
- **Decision simulation API** — "What if" scenarios without affecting the user's state

- **PRD-002 (User DNA)** — DNA data flows through this contract as context
- **PRD-001 (Human Journey)** — Journey stage data flows through this contract
- **RSH-001 (Human Problems)** — Problem data flows through this contract
- **CMP-001** — Business requirements shape contract capabilities
