# Information Validation

**ENG-003 — Document 07/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Information Architect
**Created:** 2026-07-27
**Cross-references:** ARC-003, ARC-005, PRD-002, ENG-001, ENG-002, ENG-003/D01, ENG-003/D03, ENG-003/D09

---

## Purpose

This document defines the **information validation framework** — how VedMoulya ensures that information is accurate, complete, consistent, fresh, and trustworthy. Validation is a continuous process, not a one-time gate, and applies throughout the information lifecycle.

---

## Validation Philosophy

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                   VALIDATION PHILOSOPHY                                  │
│                                                                         │
│  Information validation is:                                             │
│                                                                         │
│  1. CONTINUOUS — Information is validated at creation, on change,       │
│     and periodically throughout its lifecycle                           │
│                                                                         │
│  2. MULTI-DIMENSIONAL — No single validation metric captures all        │
│     aspects of quality. Accuracy, completeness, consistency,            │
│     freshness, and confidence are all evaluated.                        │
│                                                                         │
│  3. SOURCE-AWARE — Validation rigor depends on the source.             │
│     User-declared, system-captured, AI-inferred, and externally-        │
│     ingested information each require different validation approaches.  │
│                                                                         │
│  4. CONFIDENCE-SCORED — Every piece of information carries a            │
│     confidence score that reflects the validation results.              │
│                                                                         │
│  5. CORRECTABLE — Information can be corrected at any point,            │
│     triggering re-validation and confidence update.                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Validation Dimensions

### Dimension 1: Accuracy

**Definition:** The information correctly reflects reality.

**What It Validates:**

- The factual correctness of the information
- The degree of error or偏差 from ground truth
- The reliability of the measurement or observation

**Validation Methods:**

| Method                     | Description                           | Use Case                         |
| -------------------------- | ------------------------------------- | -------------------------------- |
| **Direct Verification**    | Compare against known correct value   | Identity data, financial amounts |
| **Cross-Reference**        | Compare against related information   | Skills against assessment scores |
| **Human Confirmation**     | User validates the information        | Goals, career aspirations        |
| **Expert Review**          | Domain expert reviews the information | Knowledge entities               |
| **Statistical Validation** | Compare against population patterns   | Inferred personality traits      |

**Thresholds:**

| Level  | Accuracy Threshold | Action                                             |
| ------ | ------------------ | -------------------------------------------------- |
| High   | > 95%              | Trust for all purposes                             |
| Medium | 80-95%             | Trust for recommendations, verify for decisions    |
| Low    | < 80%              | Flag for review, do not use for critical decisions |

---

### Dimension 2: Completeness

**Definition:** All required information is present and no critical fields are missing.

**What It Validates:**

- Required fields are populated
- Mandatory relationships are established
- Information meets minimum schema requirements

**Validation Methods:**

| Method                 | Description                                                         |
| ---------------------- | ------------------------------------------------------------------- |
| **Schema Validation**  | Check that all required fields are present                          |
| **Relationship Check** | Verify required relationships exist (e.g., goal must have an owner) |
| **Coverage Analysis**  | Check that information covers the expected scope                    |
| **Gap Detection**      | Identify missing information that should exist                      |

**Thresholds:**

| Level    | Completeness | Action                           |
| -------- | ------------ | -------------------------------- |
| Complete | 100%         | All required information present |
| Partial  | 70-99%       | Usable with known gaps           |
| Minimal  | < 70%        | Insufficient for reliable use    |

---

### Dimension 3: Consistency

**Definition:** The information is internally consistent and consistent with related information.

**What It Validates:**

- No contradictions within the information itself
- Agreement with related information in the system
- Compliance with business rules and constraints

**Validation Methods:**

| Method                       | Description                     | Example                                   |
| ---------------------------- | ------------------------------- | ----------------------------------------- |
| **Internal Consistency**     | Check for self-contradictions   | Goal deadline > creation date             |
| **Cross-Entity Consistency** | Check agreement across entities | Skill level consistent across assessments |
| **Temporal Consistency**     | Check timeline consistency      | Task completion date < task creation date |
| **Business Rule Compliance** | Check against domain rules      | Income cannot be negative                 |
| **Constraint Validation**    | Check against constraints       | Goal priority is within valid range       |

**Inconsistency Resolution:**

| Resolution Method           | When Used                                       |
| --------------------------- | ----------------------------------------------- |
| **Last-Writer-Wins**        | Non-critical inconsistencies                    |
| **Source Priority**         | One source is known to be more reliable         |
| **Human Resolution**        | Critical inconsistencies require human judgment |
| **Automatic Recalculation** | Derived information recalculated from sources   |

---

### Dimension 4: Freshness

**Definition:** The information is current enough for its intended use.

**What It Validates:**

- Time since last update vs. expected update frequency
- Relevance of information given its age
- Decay rate for time-sensitive information

**Freshness Tiers:**

| Tier               | Maximum Age      | Information Types                    |
| ------------------ | ---------------- | ------------------------------------ |
| **Real-Time**      | < 1 second       | Context, AI responses                |
| **Near Real-Time** | < 1 minute       | Execution events, notifications      |
| **Fresh**          | < 1 hour         | Active plans, task states            |
| **Daily**          | < 1 day          | Progress metrics, recommendations    |
| **Recent**         | < 1 week         | Skill assessments, learning progress |
| **Current**        | < 1 month        | Career data, goal status             |
| **Stable**         | < 6 months       | Knowledge entities, skill taxonomies |
| **Historical**     | Any age accepted | Audit records, archived plans        |

**Freshness Scoring:**

| Score | Meaning                        | Action If Stale                       |
| ----- | ------------------------------ | ------------------------------------- |
| 1.0   | Recent enough for all purposes | Use as-is                             |
| 0.7   | Acceptable for most purposes   | Use but flag age                      |
| 0.4   | Stale — use with caution       | Trigger refresh if used for decisions |
| 0.1   | Outdated — do not use          | Require re-validation before use      |
| 0.0   | Expired — invalid              | Block use, force re-capture           |

---

### Dimension 5: Confidence

**Definition:** The overall trustworthiness of the information, combining all other dimensions.

**Confidence Components:**

| Component          | Contribution | Description                       |
| ------------------ | ------------ | --------------------------------- |
| Accuracy Score     | 35%          | How correct is the information    |
| Completeness Score | 20%          | How complete is the information   |
| Consistency Score  | 20%          | How consistent is the information |
| Freshness Score    | 15%          | How current is the information    |
| Source Reliability | 10%          | How trustworthy is the source     |

**Confidence Formula:**

```
Confidence = (Accuracy × 0.35) + (Completeness × 0.20) +
             (Consistency × 0.20) + (Freshness × 0.15) +
             (Source_Reliability × 0.10)
```

**Confidence Levels:**

| Level         | Score Range | Meaning                                                     |
| ------------- | ----------- | ----------------------------------------------------------- |
| **Very High** | 0.90 - 1.00 | Verified, cross-validated, recent, reliable source          |
| **High**      | 0.75 - 0.89 | Validated, consistent, reasonably fresh                     |
| **Medium**    | 0.50 - 0.74 | Some validation, may have gaps or age                       |
| **Low**       | 0.25 - 0.49 | Limited validation, potentially unreliable                  |
| **Very Low**  | 0.00 - 0.24 | Unvalidated, AI-generated without verification, speculative |

---

## Validation Methods

### 1. Source Validation

**Purpose:** Verify that the information source is trusted and reliable.

| Source Type       | Validation Method                                        | Initial Confidence     |
| ----------------- | -------------------------------------------------------- | ---------------------- |
| User-Declared     | Identity verification, consistency with past data        | 0.80                   |
| System-Captured   | Data integrity check, timestamp verification             | 0.95                   |
| AI-Generated      | Output validation, confidence score from AI              | 0.40 (varies by model) |
| AI-Inferred       | Cross-validation with known data                         | 0.50                   |
| External-Ingested | Source reputation, data integrity check                  | Variable               |
| Derived           | Validation of source data and transformation correctness | Derived from sources   |

### 2. Cross-Validation

**Purpose:** Validate information by comparing it against related or independent data.

| Technique                    | Description                                     | Example                                            |
| ---------------------------- | ----------------------------------------------- | -------------------------------------------------- |
| **Multi-Source Comparison**  | Compare same information from different sources | Skill level: declared vs. assessed vs. inferred    |
| **Historical Pattern Check** | Compare against historical patterns             | Income: consistent with past trends                |
| **Logical Consistency**      | Check against logical rules                     | Cannot have completed a course without starting it |
| **Peer Comparison**          | Compare against anonymized peer group           | Learning pace: within normal range                 |

### 3. Human Validation

**Purpose:** Humans validate information that is critical, ambiguous, or where automated validation is insufficient.

| Level                      | Triggers Human Validation                                  | Who Validates    |
| -------------------------- | ---------------------------------------------------------- | ---------------- |
| **Always**                 | Identity changes, financial transactions, account deletion | Security team    |
| **High Confidence Needed** | AI-generated decisions, significant goal changes           | User or coach    |
| **Anomaly Detected**       | Inconsistent data, unexpected changes                      | User or coach    |
| **User-Initiated**         | User flags information as incorrect                        | Appropriate team |
| **Periodic Audit**         | Scheduled review of critical information                   | Business Owner   |

---

## Validation by Information Type

| Type          | Primary Validation Method                | Secondary               | Validation Frequency |
| ------------- | ---------------------------------------- | ----------------------- | -------------------- |
| Identity      | Source (identity verification)           | Human review            | On change            |
| Knowledge     | Cross-validation (multi-source)          | Source verification     | Continuous           |
| Goal          | Human confirmation (user)                | Consistency             | On change            |
| Skill         | Cross-validation (assessed vs. declared) | Source verification     | On assessment        |
| Progress      | Source (system-captured)                 | Historical pattern      | On event             |
| Memory        | Source (system-captured)                 | Consistency             | On creation          |
| Decision      | Cross-validation (outcome tracking)      | Human review (critical) | On outcome           |
| Plan          | Consistency (with goals and constraints) | Human confirmation      | On creation          |
| Execution     | Source (system-captured)                 | Cross-validation        | On event             |
| Finance       | Source (user-declared, verified)         | Human review            | On entry             |
| Career        | Human confirmation (user)                | Consistency             | On change            |
| Health        | Cross-validation (patterns)              | Human confirmation      | Continuous           |
| Business      | Human confirmation (user)                | Source verification     | On change            |
| Marketplace   | Cross-validation (ratings, history)      | Source verification     | On transaction       |
| Analytics     | Source (system-captured)                 | Statistical validation  | Continuous           |
| Audit         | Source (system-captured, immutable)      | Integrity check         | On creation          |
| Configuration | Source (system-managed)                  | Consistency             | On change            |
| Context       | Source (system-captured)                 | Freshness               | Real-time            |

---

## Validation Lifecycle

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       VALIDATION LIFECYCLE                                    │
│                                                                              │
│  INITIAL VALIDATION (at creation)                                            │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  Information Created → Format Check → Semantic Check → Source       │     │
│  │  Verification → Initial Confidence Assigned                         │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  CONTINUOUS VALIDATION (during lifecycle)                                    │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  Periodic → Freshness Check → Consistency Check → Confidence        │     │
│  │  Recalculation → (Trigger re-validation if below threshold)         │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  EVENT-DRIVEN VALIDATION (on related changes)                               │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  Related Information Changed → Dependency Check → Cross-Validation  │     │
│  │  → Confidence Recalculation                                          │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  FEEDBACK-DRIVEN VALIDATION (on consumer feedback)                          │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  Consumer Feedback → Validate Feedback → Apply Correction →         │     │
│  │  Re-validate → Confidence Update                                     │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Validation Governance

| Rule                                         | Description                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| **No Unvalidated Information for Decisions** | Information with confidence < 0.50 cannot be used for automated decisions |
| **Continuous Re-validation**                 | Information quality is checked periodically, not just at creation         |
| **Confidence Decay**                         | Confidence decreases over time if information is not refreshed            |
| **Human Override**                           | Humans can override automated validation results (logged and audited)     |
| **Validation Audit Trail**                   | All validation results and changes are recorded for audit                 |
| **Transparency**                             | Information consumers can see validation history and confidence scores    |
| **Correction Path**                          | Every piece of information can be corrected through a defined process     |

---

## Cross-References

| Reference   | Relationship                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------------- |
| ARC-003     | Knowledge Quality (ARC-003/D05) defines 8 quality dimensions that align with validation dimensions |
| ARC-005     | Response Validation (ARC-005/D08) — AI response validation is a specialization of this framework   |
| PRD-002     | User DNA quality assessment follows the validation dimensions defined here                         |
| ENG-001     | Domain validation rules are implemented through this validation framework                          |
| ENG-002     | Service contracts specify validation requirements for information exchanges                        |
| ENG-003/D09 | Information quality scoring uses validation results as input                                       |
