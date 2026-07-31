# Information Classification

**ENG-003 — Document 05/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Information Architect
**Created:** 2026-07-27
**Cross-references:** CMP-001, CMP-002, ARC-001, PRD-002, ENG-002, ENG-003/D01, ENG-003/D02

---

## Purpose

This document defines the **information classification model** — a conceptual framework for labeling every piece of information by its sensitivity, access requirements, handling rules, and retention needs. Classification is the foundation for access control, privacy enforcement, and compliance.

---

## Classification Philosophy

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                   CLASSIFICATION PHILOSOPHY                              │
│                                                                         │
│  Every piece of information has a classification label that determines: │
│                                                                         │
│  1. Who can access it (ACCESS)                                         │
│  2. How it must be handled (HANDLING)                                   │
│  3. How long it must be kept (RETENTION)                                │
│  4. What audit is required (AUDIT)                                      │
│                                                                         │
│  Classification is:                                                      │
│  - Assigned at creation or capture                                      │
│  - Reviewed periodically and on reclassification events                 │
│  - Enforced automatically by the platform                               │
│  - Auditable and traceable                                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Classification Dimensions

### Dimension 1: Sensitivity

| Level | Label            | Description                                             | Examples                                                             |
| ----- | ---------------- | ------------------------------------------------------- | -------------------------------------------------------------------- |
| L0    | **Public**       | Information that anyone can access                      | Platform documentation, published listings, general knowledge        |
| L1    | **Private**      | Information accessible within the platform ecosystem    | Analytics aggregates, service health metrics, configuration defaults |
| L2    | **Confidential** | Information restricted to authorized services and users | User goals, plans, execution history, career aspirations             |
| L3    | **Sensitive**    | Information that could cause harm if exposed            | Conversation memory, health patterns, business client data           |
| L4    | **Personal**     | Personally identifiable information                     | Identity attributes, DNA dimensions, financial records               |
| L5    | **Regulated**    | Information subject to specific regulatory requirements | Authentication credentials, financial transactions, audit records    |

### Dimension 2: Visibility

| Level | Label              | Access Scope                                          |
| ----- | ------------------ | ----------------------------------------------------- |
| V0    | **Global**         | Anyone, including unauthenticated users               |
| V1    | **Platform**       | Any authenticated service or user within the platform |
| V2    | **Service**        | Only specific services authorized to access           |
| V3    | **User-Only**      | Only the owning user                                  |
| V4    | **User + Consent** | Owning user plus explicitly consented parties         |
| V5    | **System-Only**    | Only automated system processes, not user-facing      |

### Dimension 3: Handling

| Label             | Requirements                                  |
| ----------------- | --------------------------------------------- |
| **Normal**        | Standard encryption at rest and in transit    |
| **Encrypted**     | Field-level encryption, restricted key access |
| **Anonymized**    | All direct and indirect identifiers removed   |
| **Pseudonymized** | Direct identifiers replaced with pseudonyms   |
| **Ephemeral**     | No persistent storage, in-memory only         |

### Dimension 4: Audit

| Level        | Requirements                                                                            |
| ------------ | --------------------------------------------------------------------------------------- |
| **None**     | No audit required                                                                       |
| **Basic**    | Record who accessed what and when (logs)                                                |
| **Detailed** | Record who accessed what, when, and for what purpose                                    |
| **Full**     | Record all access, modifications, sharing, and deletion with cryptographic verification |

---

## Classification Categories

### 1. Public Information

**Label:** `PUBLIC`

**Definition:** Information that anyone can access without authentication. No harm results from disclosure.

**Access:** Anyone, including unauthenticated users
**Handling:** Normal (standard encryption in transit)
**Audit:** None

**Examples:**

- General knowledge entities (non-proprietary)
- Published marketplace listings
- Platform documentation
- Aggregated and anonymized statistics
- Public user profiles (user-opted-in)

**Retention:** Indefinite (unless removed for quality or legal reasons)
**User Control:** None (public by nature)

---

### 2. Private Information

**Label:** `PRIVATE`

**Definition:** Information that is private to the platform ecosystem and not accessible to external parties. Disclosure would not cause serious harm but should be avoided.

**Access:** Authenticated services and users within the platform
**Handling:** Normal (encryption at rest and in transit)
**Audit:** Basic

**Examples:**

- Service health metrics
- Non-personal analytics aggregates
- Platform configuration defaults
- Service-to-service operational data
- Non-sensitive knowledge graph metadata

**Retention:** Per information type policy
**User Control:** Not user-controlled (operational)

---

### 3. Confidential Information

**Label:** `CONFIDENTIAL`

**Definition:** Information that is private to the user or service. Disclosure could cause inconvenience but not serious harm.

**Access:** Authorized services only (on a need-to-know basis), plus the owning user
**Handling:** Encrypted at rest and in transit
**Audit:** Basic to Detailed

**Examples:**

- User goals and plans
- Execution history
- Career aspirations and path explorations
- Learning progress and paths
- Business operations data
- Non-sensitive context data

**Retention:** Per information type policy (typically account lifetime + retention period)
**User Control:** Users can view and request correction

---

### 4. Sensitive Information

**Label:** `SENSITIVE`

**Definition:** Information that could cause significant harm if disclosed. Requires strict access control and handling.

**Access:** Strictly authorized services only, plus the owning user. Access is logged and reviewed.
**Handling:** Encrypted at rest and in transit. Field-level encryption for sensitive fields.
**Audit:** Detailed (every access is recorded with purpose)

**Examples:**

- Conversation memory (may contain personal disclosures)
- Health and energy patterns
- Client data within business records
- Detailed personal context (location history, activity patterns)
- Assessment responses

**Retention:** Shorter retention than confidential (to limit exposure)
**User Control:** Users can view, export, and request deletion

---

### 5. Personal Information

**Label:** `PERSONAL`

**Definition:** Personally identifiable information that directly identifies an individual. Subject to privacy regulations (GDPR, CCPA, etc.).

**Access:** Strictly limited. Only the owning user and specifically authorized services.
**Handling:** Encrypted at rest and in transit. Field-level encryption. Strict key management.
**Audit:** Full (cryptographically verified audit trail)

**Examples:**

- Identity attributes (name, email, phone, date of birth)
- Government IDs and identity documents
- Financial records (income, expenses, bank details)
- User DNA dimension values (Skills, Knowledge, etc.)
- Contact information

**Retention:** Account lifetime + regulatory retention period
**User Control:** Users have full rights under applicable privacy regulations (access, rectification, deletion, portability)

**Privacy Regulation Alignment:**

| Right                        | How It Is Enabled                                            |
| ---------------------------- | ------------------------------------------------------------ |
| Right to Access              | User can view all personal information through their profile |
| Right to Rectification       | User can correct inaccurate personal information             |
| Right to Deletion            | User can request deletion of personal information            |
| Right to Portability         | User can export personal information in a usable format      |
| Right to Restrict Processing | User can limit how personal information is used              |
| Right to Object              | User can object to specific uses (e.g., AI processing)       |

---

### 6. Derived Information

**Label:** `DERIVED`

**Definition:** Information that is computed, inferred, or generated from other information. Not directly provided by the user.

**Access:** Depends on the sensitivity of the source information
**Handling:** Depends on sensitivity of source
**Audit:** Basic to Detailed (depending on sensitivity of derivation)

**Examples:**

- Inferred skills (from activity analysis)
- Computed HPI scores (from multiple inputs)
- AI-generated recommendations
- Progress trends and momentum scores
- Knowledge graph relationships (inferred)
- Personality traits (inferred from behavior)

**Labeling Requirements:**
Every derived information must be labeled with:

- **Source Information** — What information was used to derive it
- **Method** — How it was derived (computed, inferred, AI-generated)
- **Confidence** — Confidence score for the derivation
- **Timestamp** — When it was derived
- **Human-Reviewable** — Whether a human can review and override it

**User Control:** Users can view derived information, understand its source, and request correction or override of incorrect derivations.

---

### 7. Temporary Information

**Label:** `TEMPORARY`

**Definition:** Information that has a short, defined lifetime and is automatically deleted after its purpose is served.

**Access:** Only the service processing it, for the duration needed
**Handling:** Ephemeral — in-memory storage preferred, no long-term persistence
**Audit:** None or Basic (logging of processing only)

**Examples:**

- Real-time context snapshots (time, location, activity)
- Processing intermediates (transient computation results)
- Session tokens and temporary credentials
- AI request context (assembled, sent, discarded)
- In-flight transaction data

**Characteristics:**

- **Short TTL** — Lifetime measured in seconds to hours
- **Automatic Deletion** — Deleted when TTL expires or purpose is complete
- **No Backup** — Not included in backups or disaster recovery
- **No Sharing** — Not shared with other services or users
- **Minimal Audit** — Only creation and deletion are logged

---

### 8. Historical Information

**Label:** `HISTORICAL`

**Definition:** Information that is no longer current but is retained for analysis, learning, auditing, or compliance.

**Access:** Restricted. Historical data access is for analysis and compliance purposes only.
**Handling:** Encrypted, immutable (cannot be modified)
**Audit:** Full (all access and modifications are audited)

**Examples:**

- Archived goals and plans
- Execution history (after plan completion)
- Financial history (previous fiscal years)
- Audit trail (immutable records)
- Decision history (for learning)
- Knowledge graph versions (old relationships)

**Characteristics:**

- **Immutable** — Cannot be modified (only deleted per retention policy)
- **Compressed** — May be compressed or moved to lower-cost storage
- **Analyzable** — Available for analysis and reporting
- **Not Used for Active Decisions** — Historical data is not used for real-time personalization (unless specifically relevant)

---

## Classification Assignment Rules

### Automatic Classification

The platform automatically assigns classification based on:

| Rule                                          | Classification | Example                                       |
| --------------------------------------------- | -------------- | --------------------------------------------- |
| Information type is Identity                  | PERSONAL       | User email address                            |
| Information type is Knowledge                 | INTERNAL       | Knowledge entity (may be PUBLIC if confirmed) |
| Information type is Goal                      | CONFIDENTIAL   | User's goal to start a business               |
| Information type is Memory                    | SENSITIVE      | Conversation with AI coach                    |
| Information type is Audit                     | REGULATED      | Audit trail record                            |
| Information contains PII                      | PERSONAL       | Any field with personal data                  |
| Information is AI-generated                   | DERIVED        | AI recommendation                             |
| Information is real-time context              | TEMPORARY      | Current location                              |
| Information is older than retention threshold | HISTORICAL     | Last year's progress data                     |

### Classification Override

Classification can be overridden through an documented process:

| Override Type              | Who Can Override | Approval Required            |
| -------------------------- | ---------------- | ---------------------------- |
| Downgrade (less sensitive) | Business Owner   | Information Governance Board |
| Upgrade (more sensitive)   | Business Owner   | None (upgrade is safer)      |
| Temporary reclassification | Technical Owner  | Business Owner (notified)    |

---

## Classification Handling Matrix

| Classification | Storage               | Transit        | Backup                        | Sharing           | Deletion                |
| -------------- | --------------------- | -------------- | ----------------------------- | ----------------- | ----------------------- |
| PUBLIC         | Standard encryption   | TLS            | Included                      | Unlimited         | Standard                |
| INTERNAL       | Standard encryption   | TLS            | Included                      | Platform-internal | Standard                |
| CONFIDENTIAL   | Encrypted             | TLS + mTLS     | Encrypted                     | Need-to-know      | Verified                |
| SENSITIVE      | Field-level encrypted | TLS + mTLS     | Encrypted + access-controlled | Strictly limited  | Verified + shred        |
| PERSONAL       | Field-level encrypted | TLS + mTLS     | Encrypted + access-controlled | Consent-only      | Verified + shred + cert |
| DERIVED        | Same as source        | Same as source | Same as source                | Same as source    | Same as source          |
| TEMPORARY      | In-memory preferred   | TLS            | Not backed up                 | Not shared        | Automatic               |
| HISTORICAL     | Encrypted + immutable | TLS            | Included                      | Analysis-only     | Per retention policy    |

---

## Cross-References

| Reference   | Relationship                                                                                          |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| CMP-001     | "Privacy first" — classification ensures personal information is protected at the architectural level |
| CMP-002     | Regulatory compliance requirements map to PERSONAL and REGULATED classification levels                |
| PRD-002     | User DNA dimensions are classified as PERSONAL with full user rights                                  |
| ARC-001     | Architecture Principle #6 (Privacy First) and #11 (Secure by Design) inform classification rules      |
| ENG-002     | Service contracts must enforce classification-based access control and handling                       |
| ENG-003/D02 | Each information type has a default classification as defined in the information types catalog        |
