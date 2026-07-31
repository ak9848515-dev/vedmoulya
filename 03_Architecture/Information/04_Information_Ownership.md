# Information Ownership

**ENG-003 — Document 04/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Information Architect
**Created:** 2026-07-27
**Cross-references:** CMP-001, PRD-002, ARC-001, ARC-003, ENG-001, ENG-002, ENG-003/D01, ENG-003/D02

---

## Purpose

This document defines the **information ownership model** — who is accountable for each piece of information at every stage of its lifecycle. Ownership is not just about control; it includes accountability for quality, privacy, lifecycle management, and governance compliance.

---

## Ownership Philosophy

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                   OWNERSHIP PHILOSOPHY                                   │
│                                                                         │
│  Every piece of information has MULTIPLE stakeholders, but ONE          │
│  accountable owner at each lifecycle stage.                             │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Business Owner — Accountable for the information's meaning,    │   │
│  │                   quality, and business value                    │   │
│  │                                                                  │   │
│  │  Technical Owner — Accountable for the information's storage,    │   │
│  │                     retrieval, and technical integrity            │   │
│  │                                                                  │   │
│  │  User Owner — The user whose information it is (for personal     │   │
│  │               information types)                                 │   │
│  │                                                                  │   │
│  │  AI Owner — The AI system that generated or inferred the         │   │
│  │              information (accountable for its quality)            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Ownership Types

### 1. Business Owner

**Role:** The person or team accountable for the information's business meaning, quality, and value.

**Responsibilities:**

- Define what the information means and its business context
- Set quality standards and acceptable confidence thresholds
- Determine retention requirements and disposal rules
- Approve changes to information structure or semantics
- Resolve disputes about information meaning or quality
- Ensure information meets its intended business purpose

**Accountability:** The Business Owner is the **ultimate decision-maker** for the information's business semantics. All changes to what the information means require their approval.

### 2. Technical Owner

**Role:** The person or team accountable for the information's technical integrity, storage, and accessibility.

**Responsibilities:**

- Ensure information is stored reliably and durably
- Maintain information availability and retrieval performance
- Implement and enforce access controls
- Ensure information integrity (no corruption, no unauthorized modification)
- Manage information lifecycle transitions (archive, delete)
- Implement and monitor information quality metrics

**Accountability:** The Technical Owner is accountable for the information's **technical fidelity** — that it is stored, retrieved, and transmitted correctly.

### 3. User Owner

**Role:** The user whose personal information it is. For personal information types, the user has rights that override business and technical ownership.

**Rights:**

- **Right to Access** — View their information at any time
- **Right to Rectification** — Correct inaccurate information
- **Right to Deletion** — Request deletion of their information
- **Right to Portability** — Export their information in a usable format
- **Right to Restrict Processing** — Limit how their information is used
- **Right to Object** — Object to certain uses of their information

**Limitations:**

- User ownership does not extend to non-personal information (knowledge graph entities, aggregated analytics)
- User ownership may be limited by legal holds or regulatory requirements
- User ownership does not override platform integrity or security requirements

### 4. AI Owner

**Role:** The AI system or service that generated or inferred the information. AI-owned information requires special handling because it may have lower confidence and different quality characteristics.

**Responsibilities:**

- Label information as AI-generated or AI-inferred
- Provide confidence scores for AI-generated information
- Enable human validation of AI-generated information
- Support correction or override by Business Owner or User Owner
- Track AI generation provenance (which model, which version, which prompt)

**Accountability:** The AI Owner is accountable for the **quality and transparency** of AI-generated information, not for its ultimate correctness (which requires validation).

### 5. Shared Ownership

**Role:** When multiple stakeholders have ownership interests in the same information, shared ownership defines how decisions are made.

**Principles:**

- **Primary Owner** — One owner has final decision authority for each ownership dimension
- **Consulted** — Other owners must be consulted before significant changes
- **Informed** — Other owners are informed of changes after they occur
- **Veto Power** — Some owners have veto power over specific dimensions (e.g., User Owner veto on sharing)

**Shared Ownership Matrix:**

| Decision Type        | Business Owner | Technical Owner | User Owner             | AI Owner  |
| -------------------- | -------------- | --------------- | ---------------------- | --------- |
| Meaning/Semantics    | **Decides**    | Informed        | Consulted              | Informed  |
| Quality Standards    | **Decides**    | Consulted       | Informed               | Consulted |
| Storage & Retrieval  | Consulted      | **Decides**     | Informed               | Informed  |
| Access Control       | Consulted      | **Decides**     | Veto                   | Informed  |
| Sharing/Consent      | Consulted      | Informed        | **Decides**            | Informed  |
| Retention & Deletion | Consulted      | **Decides**     | Veto (own data)        | Informed  |
| Correction           | Consulted      | Informed        | **Decides** (own data) | Consulted |

---

## Ownership by Information Type

### 1. Identity Information

| Ownership Dimension | Owner                      | Rationale                      |
| ------------------- | -------------------------- | ------------------------------ |
| Business Owner      | Identity Service (ENG-002) | Service owns identity concepts |
| Technical Owner     | Security Service           | Highest security requirements  |
| User Owner          | The user                   | Personal identity data         |
| AI Owner            | N/A                        | Identity is user-declared      |

### 2. Knowledge Information

| Ownership Dimension | Owner                       | Rationale                          |
| ------------------- | --------------------------- | ---------------------------------- |
| Business Owner      | Knowledge Service (ENG-002) | Service owns knowledge concepts    |
| Technical Owner     | Knowledge Graph (ARC-003)   | Technical storage and retrieval    |
| User Owner          | N/A (general knowledge)     | Not personal data                  |
| AI Owner            | AI Orchestration (ARC-005)  | AI may generate or infer knowledge |

### 3. Goal Information

| Ownership Dimension | Owner                            | Rationale                     |
| ------------------- | -------------------------------- | ----------------------------- |
| Business Owner      | Planning Service (ENG-002)       | Service owns goal concepts    |
| Technical Owner     | Execution Intelligence (ARC-004) | Technical management          |
| User Owner          | The user                         | Personal goals                |
| AI Owner            | AI Orchestration (ARC-005)       | AI may infer or suggest goals |

### 4. Skill Information

| Ownership Dimension | Owner                      | Rationale                         |
| ------------------- | -------------------------- | --------------------------------- |
| Business Owner      | DNA Service (ENG-002)      | Part of User DNA (PRD-002)        |
| Technical Owner     | Knowledge Service          | Stored in knowledge graph         |
| User Owner          | The user                   | Personal skill data               |
| AI Owner            | Decision Service (ARC-002) | AI may infer skills from activity |

### 5. Progress Information

| Ownership Dimension | Owner                      | Rationale                 |
| ------------------- | -------------------------- | ------------------------- |
| Business Owner      | Progress Service (ENG-002) | Service owns HPI concepts |
| Technical Owner     | Analytics Service          | Computed from events      |
| User Owner          | The user                   | Personal progress data    |
| AI Owner            | N/A                        | Derived from user actions |

### 6. Memory Information

| Ownership Dimension | Owner                      | Rationale                    |
| ------------------- | -------------------------- | ---------------------------- |
| Business Owner      | Memory Service (ENG-002)   | Service owns memory concepts |
| Technical Owner     | Memory Service             | Technical storage            |
| User Owner          | The user                   | Personal memories            |
| AI Owner            | AI Orchestration (ARC-005) | AI may generate summaries    |

### 7. Decision Information

| Ownership Dimension | Owner                           | Rationale                      |
| ------------------- | ------------------------------- | ------------------------------ |
| Business Owner      | Decision Service (ENG-002)      | Service owns decision concepts |
| Technical Owner     | Decision Intelligence (ARC-002) | Technical management           |
| User Owner          | The user                        | Personal decisions             |
| AI Owner            | Decision Service                | AI generates decision options  |

### 8. Plan Information

| Ownership Dimension | Owner                            | Rationale                  |
| ------------------- | -------------------------------- | -------------------------- |
| Business Owner      | Planning Service (ENG-002)       | Service owns plan concepts |
| Technical Owner     | Execution Intelligence (ARC-004) | Technical management       |
| User Owner          | The user                         | Personal plans             |
| AI Owner            | Planning Service                 | AI generates plans         |

### 9. Execution Information

| Ownership Dimension | Owner                            | Rationale                       |
| ------------------- | -------------------------------- | ------------------------------- |
| Business Owner      | Execution Service (ENG-002)      | Service owns execution concepts |
| Technical Owner     | Execution Intelligence (ARC-004) | Technical management            |
| User Owner          | The user                         | Personal execution data         |
| AI Owner            | N/A                              | User-driven execution           |

### 10. Finance Information

| Ownership Dimension | Owner                     | Rationale                        |
| ------------------- | ------------------------- | -------------------------------- |
| Business Owner      | Finance Service (ENG-002) | Service owns finance concepts    |
| Technical Owner     | Finance Service           | Sensitive financial data         |
| User Owner          | The user                  | Personal financial data          |
| AI Owner            | N/A                       | User-declared or system-captured |

### 11. Career Information

| Ownership Dimension | Owner                    | Rationale                             |
| ------------------- | ------------------------ | ------------------------------------- |
| Business Owner      | Career Service (ENG-002) | Service owns career concepts          |
| Technical Owner     | Knowledge Service        | Career data stored in knowledge graph |
| User Owner          | The user                 | Personal career data                  |
| AI Owner            | Decision Service         | AI may suggest career paths           |

### 12. Health Information

| Ownership Dimension | Owner                      | Rationale                    |
| ------------------- | -------------------------- | ---------------------------- |
| Business Owner      | Health Service (ENG-002)   | Service owns health concepts |
| Technical Owner     | Health Service             | Sensitive health data        |
| User Owner          | The user                   | Personal health data         |
| AI Owner            | AI Orchestration (ARC-005) | AI may infer patterns        |

### 13. Business Information

| Ownership Dimension | Owner                      | Rationale                        |
| ------------------- | -------------------------- | -------------------------------- |
| Business Owner      | Business Service (ENG-002) | Service owns business concepts   |
| Technical Owner     | Business Service           | Business operations              |
| User Owner          | The user                   | Personal business data           |
| AI Owner            | Decision Service           | AI may provide business guidance |

### 14. Marketplace Information

| Ownership Dimension | Owner                         | Rationale                          |
| ------------------- | ----------------------------- | ---------------------------------- |
| Business Owner      | Marketplace Service (ENG-002) | Service owns marketplace concepts  |
| Technical Owner     | Marketplace Service           | Transaction integrity              |
| User Owner          | The user                      | Personal listings and transactions |
| AI Owner            | Recommendation Service        | AI may match opportunities         |

### 15. Analytics Information

| Ownership Dimension | Owner                       | Rationale                       |
| ------------------- | --------------------------- | ------------------------------- |
| Business Owner      | Analytics Service (ENG-002) | Service owns analytics concepts |
| Technical Owner     | Analytics Service           | Event processing                |
| User Owner          | N/A (anonymized)            | Not personal                    |
| AI Owner            | Analytics Service           | AI may detect anomalies         |

### 16. Audit Information

| Ownership Dimension | Owner                   | Rationale                   |
| ------------------- | ----------------------- | --------------------------- |
| Business Owner      | Audit Service (ENG-002) | Service owns audit concepts |
| Technical Owner     | Security Service        | Immutable storage           |
| User Owner          | N/A                     | System-generated            |
| AI Owner            | N/A                     | System-captured             |

### 17. Configuration Information

| Ownership Dimension | Owner                    | Rationale                    |
| ------------------- | ------------------------ | ---------------------------- |
| Business Owner      | Respective service owner | Each service owns its config |
| Technical Owner     | Infrastructure team      | Technical management         |
| User Owner          | N/A                      | Operational                  |
| AI Owner            | N/A                      | System-managed               |

### 18. Context Information

| Ownership Dimension | Owner                     | Rationale                     |
| ------------------- | ------------------------- | ----------------------------- |
| Business Owner      | Context Service (ENG-002) | Service owns context concepts |
| Technical Owner     | Context Service           | Real-time management          |
| User Owner          | The user                  | Personal context              |
| AI Owner            | N/A                       | Captured from signals         |

---

## Ownership Transfer

### Transfer Events

Information ownership may transfer between stakeholders in certain circumstances:

| Transfer                  | When It Happens                                          | Governance                               |
| ------------------------- | -------------------------------------------------------- | ---------------------------------------- |
| **User → Platform**       | User publishes information publicly (portfolio, reviews) | Explicit consent required                |
| **Platform → User**       | User exports their information                           | Right to portability                     |
| **Business → Business**   | Service ownership changes (reorganization)               | Architecture Review Board approval       |
| **Technical → Technical** | Technical ownership moves between teams                  | CTO approval                             |
| **AI → Human**            | AI-generated information validated by human              | Confidence score updated, source updated |

### Transfer Requirements

1. **Documented** — All ownership transfers are documented with reason and approval
2. **Consented** — User ownership transfers require user consent
3. **Audited** — All ownership transfers are audited
4. **Informed** — All affected stakeholders are notified

---

## Ownership Delegation

### Delegation Model

An owner may delegate specific responsibilities to another party without transferring ownership:

| Delegation               | From            | To               | Scope                           |
| ------------------------ | --------------- | ---------------- | ------------------------------- |
| **Quality Monitoring**   | Business Owner  | Technical Owner  | Ongoing quality assessment      |
| **Access Management**    | Technical Owner | Security Service | Day-to-day access control       |
| **Lifecycle Management** | Business Owner  | Technical Owner  | Routine lifecycle operations    |
| **User Support**         | Business Owner  | Customer Support | User inquiries about their data |

### Delegation Rules

1. **Ownership is Not Transferable by Delegation** — The owner remains accountable
2. **Delegation is Revocable** — The owner can revoke delegation at any time
3. **Delegation is Documented** — All delegations are documented
4. **Delegation Does Not Remove Accountability** — The owner is still accountable for delegated responsibilities

---

## Ownership Responsibilities Matrix

| Responsibility        | Business Owner | Technical Owner | User Owner         | AI Owner   |
| --------------------- | -------------- | --------------- | ------------------ | ---------- |
| Define meaning        | ✅ Primary     | —               | —                  | —          |
| Set quality standards | ✅ Primary     | Consulted       | Consulted          | Consulted  |
| Ensure accuracy       | ✅ Primary     | —               | ✅ Can correct     | Consulted  |
| Ensure availability   | —              | ✅ Primary      | —                  | —          |
| Ensure integrity      | —              | ✅ Primary      | —                  | —          |
| Manage access         | —              | ✅ Primary      | ✅ Veto            | —          |
| Manage retention      | ✅ Primary     | ✅ Executes     | ✅ Veto (own data) | —          |
| Manage deletion       | ✅ Primary     | ✅ Executes     | ✅ Can request     | —          |
| Manage lifecycle      | ✅ Primary     | ✅ Executes     | Consulted          | —          |
| Provide consent       | —              | —               | ✅ Primary         | —          |
| Handle complaints     | ✅ Primary     | Consulted       | —                  | —          |
| Label AI generation   | —              | —               | —                  | ✅ Primary |
| Validate AI output    | ✅ Primary     | —               | ✅ Can validate    | Consulted  |

---

## Cross-References

| Reference | Relationship                                                                                  |
| --------- | --------------------------------------------------------------------------------------------- |
| ENG-001   | Domain entities define business concepts that Business Owners are accountable for             |
| ENG-002   | Service catalog identifies the service that is the Business Owner for each information type   |
| ARC-001   | Architecture Principle #6 (Privacy First) — User Owner rights are paramount for personal data |
| ARC-003   | Knowledge Graph — Business Owner is Knowledge Service, AI Owner applies to inferred knowledge |
| PRD-002   | User DNA — User Owner has the right to view, correct, and control all DNA dimensions          |
| CMP-001   | "Human-first technology" — User Owner rights are protected at the architectural level         |
