# Information Lifecycle

**ENG-003 — Document 03/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Information Architect
**Created:** 2026-07-27
**Cross-references:** CMP-001, ARC-001, ARC-003, ARC-004, PRD-002, ENG-001, ENG-002, ENG-003/D01, ENG-003/D02

---

## Purpose

This document defines the **information lifecycle** — the stages that every piece of information passes through from creation to eventual deletion. Each stage has defined responsibilities, quality gates, and governance rules. Not all information passes through all stages, but all information follows this model.

> **Note on Stage Ordering:** The lifecycle stages are ordered logically — Creation through Deletion. Retention (Stage 9) is placed after Archiving (Stage 8) and before Deletion (Stage 10) because information is archived first, retained for the required period, and then deleted. This ordering differs slightly from the linear list (where Retention precedes Archiving) but better reflects the actual temporal sequence.

---

## Lifecycle Diagram

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          INFORMATION LIFECYCLE                                │
│                                                                              │
│   ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐          │
│   │ 1.     │   │ 2.     │   │ 3.     │   │ 4.     │   │ 5.     │          │
│   │CREATION│──▶│CAPTURE │──▶│VALIDATE│──▶│CLASSIFY│──▶│  USE   │          │
│   └────────┘   └────────┘   └────────┘   └────────┘   └────────┘          │
│                                                              │              │
│                      ┌───────────────────────────────────────┘              │
│                      ▼                                                      │
│   ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐          │
│   │ 6.     │   │ 7.     │   │ 8.     │   │ 9.     │   │ 10.    │          │
│   │ SHARE  │──▶│ EVOLVE │──▶│ ARCHIVE│──▶│RETENTION│──▶│DELETE │          │
│   └────────┘   └────────┘   └────────┘   └────────┘   └────────┘          │
│                                                                              │
│   Each stage has quality gates, governance rules, and audit requirements.    │
│   Information can cycle back (e.g., USE → EVOLVE → VALIDATE)                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Stage 1: Creation

**Purpose:** Information comes into existence through one of five creation methods.

### Creation Methods

| Method        | Description                                   | Example Information Types                          | Quality at Creation              |
| ------------- | --------------------------------------------- | -------------------------------------------------- | -------------------------------- |
| **Declared**  | User explicitly provides information          | Identity, Goals, Finance, Career                   | High (user knows their own data) |
| **Captured**  | System records an interaction or event        | Memory, Execution, Audit, Context                  | High (direct observation)        |
| **Inferred**  | System deduces information from existing data | Skill (from assessment), Progress (from trends)    | Medium (requires validation)     |
| **Generated** | AI produces information from context          | Knowledge (from analysis), Decision (from scoring) | Low-Medium (requires validation) |
| **Ingested**  | External source provides information          | Knowledge (from APIs), Market data                 | Variable (depends on source)     |

### Creation Requirements

Every creation event must record:

- **Method** — How the information was created (declared, captured, inferred, generated, ingested)
- **Timestamp** — When it was created
- **Creator** — Who or what created it (user ID, service ID, AI provider)
- **Context** — What was happening when it was created (optional but recommended)
- **Initial Quality Assessment** — Preliminary quality score based on creation method

### Creation Events

| Event              | Description                                                                  |
| ------------------ | ---------------------------------------------------------------------------- |
| InformationCreated | Emitted when any new information is created (carries method, type, identity) |

---

## Stage 2: Capture

**Purpose:** Information is structured, indexed, and stored in its appropriate information store.

### Capture Process

| Step                  | Description                                                        |
| --------------------- | ------------------------------------------------------------------ |
| **Structure**         | Information is formatted according to its information type schema  |
| **Index**             | Information is indexed for retrieval (semantic, keyword, temporal) |
| **Store**             | Information is persisted in the appropriate information store      |
| **Provenance Record** | Capture metadata (source, timestamp, method) is recorded           |
| **Integrity Check**   | Basic integrity validation (no corruption, valid structure)        |

### Capture Characteristics by Information Type

| Type      | Capture Characteristics                      | Storage Consideration            |
| --------- | -------------------------------------------- | -------------------------------- |
| Identity  | Structured, verified, encrypted at rest      | Highest security, limited access |
| Knowledge | Indexed, relationship-mapped, quality-scored | Graph-structured for discovery   |
| Memory    | Time-ordered, relevance-scored, consolidated | Append-only, decay-aware         |
| Context   | Real-time, ephemeral, snapshots              | In-memory, short TTL             |
| Decision  | Structured, immutable, auditable             | Append-only, long retention      |
| Execution | Append-only, time-ordered, feedback-linked   | High write volume                |
| Finance   | Structured, encrypted, immutable             | Append-only, long retention      |
| Audit     | Immutable, cryptographically linked          | Append-only, never modified      |

### Capture Events

| Event               | Description                                                    |
| ------------------- | -------------------------------------------------------------- |
| InformationCaptured | Emitted when information is successfully captured              |
| CaptureFailed       | Emitted when capture fails (storage error, validation failure) |

---

## Stage 3: Validation

**Purpose:** Information is checked for accuracy, completeness, consistency, and trustworthiness.

### Validation Gates

| Gate                    | What It Validates                              | Applicable To             |
| ----------------------- | ---------------------------------------------- | ------------------------- |
| **Format Validation**   | Information conforms to expected structure     | All types                 |
| **Semantic Validation** | Information makes sense in context             | All types                 |
| **Consistency Check**   | Information is consistent with existing data   | Knowledge, DNA, Career    |
| **Source Verification** | Source is known and trusted                    | Knowledge, Ingested data  |
| **Cross-Validation**    | Information agrees with related data points    | Skills, Progress, Finance |
| **Human Review**        | Human reviews and confirms (for critical data) | Identity, Finance, Health |

### Validation Outcomes

| Outcome             | Meaning                                             | Next Stage                          |
| ------------------- | --------------------------------------------------- | ----------------------------------- |
| **Passed**          | Information meets all validation criteria           | Proceed to Classification           |
| **Flagged**         | Minor issues found, information usable with warning | Proceed to Classification (flagged) |
| **Failed**          | Information does not meet validation criteria       | Return to Creation or Reject        |
| **Requires Review** | Human review needed before acceptance               | Hold for Review                     |

### Confidence Assignment

Based on validation results, every piece of information is assigned a confidence score:

| Validation Level                                   | Confidence Score | Meaning                           |
| -------------------------------------------------- | ---------------- | --------------------------------- |
| Source verified + cross-validated + human reviewed | 0.9 - 1.0        | Highly trusted                    |
| Source verified + cross-validated                  | 0.7 - 0.9        | Trusted                           |
| Source verified only                               | 0.5 - 0.7        | Moderately trusted                |
| Unverified source                                  | 0.3 - 0.5        | Low trust — use with caution      |
| AI generated, unverified                           | 0.0 - 0.3        | Speculative — requires validation |

### Validation Events

| Event                | Description                                |
| -------------------- | ------------------------------------------ |
| InformationValidated | Emitted when information passes validation |
| InformationFlagged   | Emitted when information has minor issues  |
| InformationRejected  | Emitted when information fails validation  |

---

## Stage 4: Classification

**Purpose:** Information is labeled with its sensitivity level, access policies, and handling requirements.

### Classification Dimensions

| Dimension       | Values                                                         | Description                     |
| --------------- | -------------------------------------------------------------- | ------------------------------- |
| **Sensitivity** | Public, Internal, Confidential, Sensitive, Personal, Regulated | Who can access this information |
| **Visibility**  | Global, Platform, Service, User-Only, Consent-Required         | Scope of access                 |
| **Handling**    | Normal, Encrypted, Anonymized, Pseudonymized                   | How information must be handled |
| **Retention**   | Transient, Session, Short-Term, Long-Term, Permanent           | How long information is kept    |
| **Audit Level** | None, Basic, Detailed, Full                                    | What audit is required          |

### Classification by Information Type

| Type          | Default Sensitivity         | Handling               | Audit Level |
| ------------- | --------------------------- | ---------------------- | ----------- |
| Identity      | Personal                    | Encrypted + Anonymized | Full        |
| Knowledge     | Internal                    | Normal                 | Basic       |
| Goal          | Confidential                | Normal                 | Basic       |
| Skill         | Confidential                | Normal                 | Basic       |
| Progress      | Confidential                | Normal                 | Basic       |
| Memory        | Personal                    | Encrypted              | Detailed    |
| Decision      | Confidential                | Normal                 | Detailed    |
| Plan          | Confidential                | Normal                 | Basic       |
| Execution     | Confidential                | Normal                 | Detailed    |
| Finance       | Personal (Highly Sensitive) | Encrypted              | Full        |
| Career        | Confidential                | Normal                 | Basic       |
| Health        | Sensitive                   | Encrypted              | Detailed    |
| Business      | Confidential                | Normal                 | Basic       |
| Marketplace   | Confidential                | Normal                 | Detailed    |
| Analytics     | Internal                    | Anonymized             | Basic       |
| Audit         | Confidential                | Immutable              | Full        |
| Configuration | Confidential                | Encrypted (secrets)    | Full        |
| Context       | Confidential                | Transient              | None        |

### Classification Events

| Event                 | Description                                            |
| --------------------- | ------------------------------------------------------ |
| InformationClassified | Emitted when information is classified or reclassified |

---

## Stage 5: Use

**Purpose:** Information is accessed, queried, retrieved, and consumed by authorized services and users.

### Usage Patterns

| Pattern       | Description                                            | Example                      |
| ------------- | ------------------------------------------------------ | ---------------------------- |
| **Read**      | Information is retrieved without modification          | Querying user skills         |
| **Reference** | Information is cited in a decision or recommendation   | Using DNA for recommendation |
| **Transform** | Information is used as input to create new information | Goals → Plans                |
| **Aggregate** | Multiple information points are combined               | HPI computation              |
| **Present**   | Information is displayed to user                       | Dashboard                    |

### Usage Governance

Every use of information must respect:

1. **Access Control** — Only authorized consumers can access based on sensitivity
2. **Purpose Limitation** — Information is used only for its intended purpose
3. **Minimum Necessary** — Only the minimum information needed for the task is accessed
4. **Usage Audit** — Significant information access is audited (especially for sensitive types)

### Usage Events

| Event               | Description                                                  |
| ------------------- | ------------------------------------------------------------ |
| InformationAccessed | Emitted when sensitive information is accessed (audit-level) |

---

## Stage 6: Share

**Purpose:** Information is shared with authorized consumers — other services, users, or external systems.

### Sharing Patterns

| Pattern                   | Description                                              | Governance               |
| ------------------------- | -------------------------------------------------------- | ------------------------ |
| **Service-to-Service**    | Information shared via service contracts (ENG-002)       | Contract-based, audited  |
| **User-Consented**        | User explicitly shares information (portfolio, coaching) | Consent-based, revocable |
| **Aggregated/Anonymized** | De-identified information shared for analytics           | No personal data         |
| **External Integration**  | Information shared with third-party APIs (with consent)  | Consent-based, audited   |

### Sharing Rules

1. **Consent Required** — User information is never shared without explicit consent (except service-to-service operational sharing)
2. **Minimum Information** — Only the minimum information necessary is shared
3. **Audit Trail** — All sharing events are audited
4. **Revocable** — Users can revoke sharing consent at any time
5. **Time-Bound** — Sharing can be limited to a specific duration

### Sharing Events

| Event                 | Description                                        |
| --------------------- | -------------------------------------------------- |
| InformationShared     | Emitted when information is shared with a consumer |
| SharingConsentGranted | Emitted when user grants sharing consent           |
| SharingConsentRevoked | Emitted when user revokes sharing consent          |

---

## Stage 7: Evolution

**Purpose:** Information changes over time — updated, refined, corrected, or enriched.

### Evolution Types

| Type            | Description                                | Example                                 |
| --------------- | ------------------------------------------ | --------------------------------------- |
| **Update**      | Information value changes                  | Skill level increases                   |
| **Correction**  | Error is fixed                             | Incorrect income amount corrected       |
| **Enrichment**  | Additional information is added            | Knowledge entity gets new relationships |
| **Refinement**  | Quality improves through validation        | Confidence score increases              |
| **Deprecation** | Information is marked as no longer current | Old skill taxonomy deprecated           |
| **Versioning**  | New version supersedes old version         | Plan version updated                    |

### Evolution Governance

1. **Version History** — All significant changes are versioned (previous state retained)
2. **Change Reason** — Every change records why it was made
3. **Author Attribution** — Every change records who made it
4. **Quality Recalculation** — Quality scores are recalculated after significant changes
5. **Consumer Notification** — Consumers are notified of significant changes through events

### Evolution Events

| Event                 | Description                               |
| --------------------- | ----------------------------------------- |
| InformationUpdated    | Emitted when information is updated       |
| InformationCorrected  | Emitted when information is corrected     |
| InformationDeprecated | Emitted when information is deprecated    |
| InformationVersioned  | Emitted when a new version supersedes old |

---

## Stage 8: Archive

**Purpose:** Information is moved from active storage to long-term archival when it is no longer actively needed but must be retained.

### Archive Triggers

| Trigger          | Description                                 | Example Types                            |
| ---------------- | ------------------------------------------- | ---------------------------------------- |
| **Completion**   | Goal or project is complete                 | Goal, Plan, Execution                    |
| **Obsolescence** | Information is no longer current            | Knowledge (deprecated), Skill (outdated) |
| **Age**          | Information exceeds active retention period | Memory (decayed), Context (expired)      |
| **User Request** | User archives information                   | All user-owned types                     |

### Archive Requirements

1. **Compressed Storage** — Archived information may be compressed for efficiency
2. **Reduced Availability** — Archived information may have higher retrieval latency
3. **Immutable** — Archived information cannot be modified (only deleted per policy)
4. **Retrievable** — Archived information can be retrieved if needed
5. **Metadata Preserved** — All provenance, quality, and governance metadata is preserved

### Archive Events

| Event               | Description                                             |
| ------------------- | ------------------------------------------------------- |
| InformationArchived | Emitted when information is moved to archive            |
| InformationRestored | Emitted when archived information is restored to active |

---

## Stage 9: Retention

**Purpose:** Information is retained for the required period based on regulatory, business, and user requirements.

### Retention Periods by Information Type

| Type          | Active Retention                 | Archived Retention      | Total Retention            |
| ------------- | -------------------------------- | ----------------------- | -------------------------- |
| Identity      | Account lifetime                 | 3 years after deletion  | Account + 3 years          |
| Knowledge     | Indefinite                       | Indefinite              | Permanent                  |
| Goal          | Until completed + 1 year         | 3 years                 | Until completed + 4 years  |
| Skill         | Account lifetime                 | 3 years after deletion  | Account + 3 years          |
| Progress      | Account lifetime                 | 3 years after deletion  | Account + 3 years          |
| Memory        | 90 days (active)                 | 2 years                 | ~2 years                   |
| Decision      | 3 years                          | 7 years                 | 7 years                    |
| Plan          | Until superseded + 90 days       | 3 years                 | Until superseded + 3 years |
| Execution     | 1 year                           | 5 years                 | 5 years                    |
| Finance       | Account lifetime                 | 7 years after deletion  | Account + 7 years          |
| Career        | Account lifetime                 | 3 years after deletion  | Account + 3 years          |
| Health        | 1 year                           | 3 years                 | 3 years                    |
| Business      | Account lifetime                 | 5 years after deletion  | Account + 5 years          |
| Marketplace   | Indefinite (transaction records) | 7 years                 | 7+ years                   |
| Analytics     | 90 days (raw)                    | 3 years (aggregated)    | 3 years                    |
| Audit         | 7 years                          | 7 years                 | 7 years                    |
| Configuration | Active lifetime                  | 1 year after superseded | Active + 1 year            |
| Context       | Not retained                     | Not retained            | None                       |

### Retention Principles

1. **Minimum Necessary** — Retain information only as long as needed
2. **Regulatory Compliance** — Retention periods meet legal requirements (GDPR, financial regulations, etc.)
3. **User Right to Deletion** — Users can request early deletion of their information (with legal hold exceptions)
4. **Automated Enforcement** — Retention policies are enforced automatically, not manually
5. **Audit of Deletion** — Deletion of information covered by retention policies is audited

### Retention Events

| Event                   | Description                                  |
| ----------------------- | -------------------------------------------- |
| RetentionPolicyApplied  | Emitted when retention policy is enforced    |
| RetentionPeriodExpiring | Warning emitted before retention period ends |

---

## Stage 10: Deletion

**Purpose:** Information is permanently and irrecoverably removed from all storage.

### Deletion Triggers

| Trigger                 | Description                      |
| ----------------------- | -------------------------------- |
| **Retention Expiry**    | Retention period has ended       |
| **User Request**        | User exercises right to deletion |
| **Account Deletion**    | User account is deleted          |
| **Legal Hold Released** | Legal hold period has ended      |

### Deletion Types

| Type                 | Description                                   | When Used                        |
| -------------------- | --------------------------------------------- | -------------------------------- |
| **Soft Delete**      | Information marked as deleted but recoverable | User mistake, short retention    |
| **Hard Delete**      | Information permanently removed               | Retention expiry, user request   |
| **Anonymization**    | Personal identifiers removed, data retained   | Analytics, aggregated statistics |
| **Pseudonymization** | Direct identifiers replaced with pseudonyms   | Research, long-term analysis     |

### Deletion Requirements

1. **Irreversible** — Hard deletion is permanent and irreversible
2. **Cascading** — Related information is deleted according to dependency rules
3. **Verified** — Deletion is verified (data is confirmed unrecoverable)
4. **Audited** — Deletion events are recorded in audit trail
5. **Exceptions** — Legal holds override deletion requests

### Deletion Events

| Event              | Description                                         |
| ------------------ | --------------------------------------------------- |
| InformationDeleted | Emitted when information is permanently deleted     |
| DeletionRequested  | Emitted when deletion is requested (user or policy) |
| DeletionHeld       | Emitted when deletion is prevented by legal hold    |

---

## Lifecycle Stage Transitions

```text
                    ┌─────────────────────────────────────────────┐
                    │              CREATION                        │
                    │  (Declared / Captured / Inferred /           │
                    │   Generated / Ingested)                     │
                    └────────────────────┬────────────────────────┘
                                         │
                                         ▼
                    ┌─────────────────────────────────────────────┐
                    │              CAPTURE                         │
                    │  (Structure / Index / Store / Provenance)   │
                    └────────────────────┬────────────────────────┘
                                         │
                    ┌────────────────────┴────────────────────┐
                    │                                         │
                    ▼                                         ▼
        ┌──────────────────────────┐           ┌──────────────────────────┐
        │       VALIDATE           │           │      REJECT (FAIL)       │
        │  (Format / Semantic /     │           │   Return to creation     │
        │   Source / Cross)        │           │   or discard             │
        └──────────┬───────────────┘           └──────────────────────────┘
                   │
                   ▼
        ┌──────────────────────────┐
        │      CLASSIFY            │
        │  (Sensitivity / Handling  │
        │   / Retention / Audit)   │
        └──────────┬───────────────┘
                   │
                   ▼
        ┌──────────────────────────┐
        │          USE             │◀──────────────┐
        │  (Read / Transform /      │               │
        │   Aggregate / Present)   │               │
        └──────────┬───────────────┘               │
                   │                               │
                   ▼                               │
        ┌──────────────────────────┐               │
        │         SHARE            │               │
        │  (Service / User /        │               │
        │   External / Aggregate)  │               │
        └──────────┬───────────────┘               │
                   │                               │
                   ▼                               │
        ┌──────────────────────────┐               │
        │        EVOLVE            │───────────────┘
        │  (Update / Correct /      │  (Updated info
        │   Enrich / Deprecate)   │   re-enters use)
        └──────────┬───────────────┘
                   │
                   ▼
        ┌──────────────────────────┐
        │       ARCHIVE            │
        │  (Compress / Immutable /  │
        │   Retrievable)          │
        └──────────┬───────────────┘
                   │
                   ▼
        ┌──────────────────────────┐
        │      RETENTION           │
        │  (Regulatory / Business / │
        │   User requirements)    │
        └──────────┬───────────────┘
                   │
                   ▼
        ┌──────────────────────────┐
        │       DELETION           │
        │  (Soft / Hard /           │
        │   Anonymize /            │
        │   Pseudonymize)          │
        └──────────────────────────┘
```

---

## Lifecycle Stage Characteristics by Information Type

| Type          | Critical Stage | Most Governance            | Highest Quality Need |
| ------------- | -------------- | -------------------------- | -------------------- |
| Identity      | Capture        | Classification (Sensitive) | Validation           |
| Knowledge     | Validation     | Evolution                  | Quality Scoring      |
| Goal          | Evolution      | Use                        | Consistency          |
| Skill         | Validation     | Classification             | Accuracy             |
| Progress      | Use            | Retention                  | Freshness            |
| Memory        | Capture        | Deletion                   | Relevance            |
| Decision      | Validation     | Audit                      | Confidence           |
| Plan          | Evolution      | Use                        | Freshness            |
| Execution     | Capture        | Audit                      | Completeness         |
| Finance       | Capture        | Retention                  | Accuracy             |
| Career        | Evolution      | Classification             | Consistency          |
| Health        | Validation     | Deletion                   | Accuracy             |
| Business      | Evolution      | Classification             | Completeness         |
| Marketplace   | Capture        | Retention                  | Accuracy             |
| Analytics     | Use            | Retention                  | Completeness         |
| Audit         | Capture        | Deletion (never)           | Immutability         |
| Configuration | Evolution      | Classification             | Consistency          |
| Context       | Use            | Deletion (immediate)       | Freshness            |

---

## Cross-References

| Reference | Relationship                                                                                       |
| --------- | -------------------------------------------------------------------------------------------------- |
| ARC-003   | Knowledge lifecycle (ARC-003, 11-stage) is a specialization of this general information lifecycle  |
| ARC-004   | Execution lifecycle (ARC-004, 11-stage) produces execution information that follows this lifecycle |
| PRD-002   | User DNA dimensions follow this lifecycle for capture, validation, evolution, and deletion         |
| ENG-001   | Domain entities and value objects have lifecycle stages defined here                               |
| ENG-002   | Service contracts enable lifecycle transitions (commands create, events notify, queries read)      |
| CMP-001   | "Systems before shortcuts" — lifecycle is systematic, not ad-hoc                                   |
