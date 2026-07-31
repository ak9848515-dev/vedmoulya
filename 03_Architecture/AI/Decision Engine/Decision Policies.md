# Decision Policies

**Mission:** Define the policies that constrain, guide, and govern every decision made by the VedMoulya Decision Intelligence Engine.

**Version:** 1.0
**Status:** Draft
**Owner:** Chief Decision Intelligence Architect
**Dependencies:** Decision Intelligence.md, Decision Scoring.md, Decision Confidence.md, ARC-001 (Architecture Principles), PRD-002 (Personalization Rules)
**Created:** 2026-07-24
**Updated:** 2026-07-24

## Description

Policies are the guardrails that ensure every decision aligns with VedMoulya's principles, user preferences, ethical standards, and safety requirements. Policies can override scoring results — a high-scoring option that violates policy is demoted or blocked.

---

## Policy Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                    DECISION POLICY HIERARCHY                         │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    FOUNDATION POLICIES                        │   │
│  │  (Always enforced, cannot be overridden)                     │   │
│  │                                                              │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │   │
│  │  │  Human-First │  │  Privacy-    │  │    Safety        │   │   │
│  │  │              │  │  First       │  │    Constraints   │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    QUALITY POLICIES                           │   │
│  │  (Enforced for all decisions, adjustable)                    │   │
│  │                                                              │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │   │
│  │  │ Transparency │  │   Fairness   │  │    Ethical       │   │   │
│  │  │              │  │              │  │    Boundaries    │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                    │
│                    ALL DECISIONS PASS THROUGH POLICIES              │
│                    BEFORE REACHING THE USER                        │
│                                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Policy 1: Human-First

**Description:** Every decision must serve the human user's genuine interests, not platform metrics or business goals.

**Rules:**

| Rule                                                                | Enforcement              | Violation Consequence                        |
| ------------------------------------------------------------------- | ------------------------ | -------------------------------------------- |
| Decisions must prioritize user goals over platform goals            | Algorithmic check        | Decision blocked; logged for audit           |
| Recommendations must benefit the user, not just increase engagement | Engagement quality check | Decision demoted                             |
| No dark patterns — recommendations cannot exploit cognitive biases  | Pattern detection        | Decision blocked; escalated to ethics review |
| Users can always override or dismiss recommendations                | UI requirement           | Not a scoring factor — required by design    |
| User exhaustion avoidance — limit recommendation frequency          | Rate limiting            | Excessive recommendations suppressed         |

**Example violation:** Recommending a paid course when a free equivalent exists that better matches the user's financial context.

---

## Policy 2: Privacy-First

**Description:** Decisions must respect user privacy boundaries and data governance rules.

**Rules:**

| Rule                                                                | Enforcement           | Violation Consequence                             |
| ------------------------------------------------------------------- | --------------------- | ------------------------------------------------- |
| No decision can use data the user has not consented to share        | Consent check         | Decision blocked; data source excluded            |
| Sensitive dimensions (Personality, Context) require explicit opt-in | Consent check         | Decision degraded to lower confidence             |
| Decisions cannot reveal inferred data without explanation           | Transparency check    | Decision modified to explain source               |
| User can exclude specific DNA dimensions from decision-making       | User preference check | Decision recalculated without excluded dimensions |
| No decision can share user data with third parties                  | System boundary check | Decision blocked; security alert                  |

**Example violation:** Using personality assessment data for a recommendation when the user has not opted into personality-based personalization.

---

## Policy 3: Ethical Recommendations

**Description:** Decisions must adhere to ethical standards and avoid causing harm.

**Rules:**

| Rule                                                                                       | Enforcement             | Violation Consequence                            |
| ------------------------------------------------------------------------------------------ | ----------------------- | ------------------------------------------------ |
| No exploitation of user vulnerabilities (financial stress, health issues, emotional state) | Vulnerability detection | Decision blocked; escalated to ethics review     |
| No predatory recommendations (high-interest loans, risky investments)                      | Content safety check    | Decision blocked                                 |
| No discrimination — decisions cannot disadvantage protected groups                         | Fairness audit          | Decision blocked; algorithmic bias investigation |
| Age-appropriate recommendations for minors                                                 | Age verification        | Decision filtered to age-appropriate catalog     |
| Cultural sensitivity — recommendations respect cultural norms                              | Cultural context check  | Decision adapted or blocked                      |

**Example violation:** Recommending a high-risk business loan to a user with low financial stability and high stress levels.

---

## Policy 4: Safety Constraints

**Description:** Decisions must not expose users to physical, financial, or reputational harm.

**Rules:**

| Rule                                                       | Enforcement                | Violation Consequence                     |
| ---------------------------------------------------------- | -------------------------- | ----------------------------------------- |
| No unsafe physical activity recommendations                | Activity safety check      | Decision blocked                          |
| No financial recommendations that could lead to insolvency | Financial safety check     | Decision blocked; flagged for coach       |
| No recommendations that violate laws or regulations        | Legal compliance check     | Decision blocked; legal team notification |
| No recommendations based on unverified knowledge           | Knowledge confidence check | Decision demoted; low confidence flag     |
| Career recommendations must comply with labor laws         | Regulatory check           | Decision filtered                         |

**Example violation:** Recommending a freelance contract that violates minimum wage laws in the user's jurisdiction.

---

## Policy 5: Transparency

**Description:** Every decision must be explainable and accountable.

**Rules:**

| Rule                                                                                                                                        | Enforcement         | Violation Consequence                       |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------- |
| Every decision must produce a human-readable explanation                                                                                    | Generation required | Decision held until explanation generated   |
| Explanation must include: why, based on which DNA dimensions, which problems addressed, which journey stage, confidence level, alternatives | Completeness check  | Decision held until explanation is complete |
| AI-influenced decisions must be labeled as such                                                                                             | Labeling required   | Decision modified to include label          |
| Users can request deeper explanation of any decision                                                                                        | Always available    | Not a blocking rule, but must be supported  |
| Decision audit trail must be immutable                                                                                                      | Audit requirement   | Decision cannot be altered after logging    |

**Example violation:** Presenting a recommendation without explaining which goals or DNA attributes it was based on.

---

## Policy 6: Fairness

**Description:** Decisions must be fair across all user groups and not perpetuate bias.

**Rules:**

| Rule                                                                          | Enforcement         | Violation Consequence                        |
| ----------------------------------------------------------------------------- | ------------------- | -------------------------------------------- |
| Recommendation quality must be consistent across demographic groups           | Quality monitoring  | Algorithm adjustment triggered               |
| No stereotyping — recommendations cannot assume based on demographics         | Bias detection      | Decision blocked; bias review                |
| Equal access — all users receive the same quality of recommendations          | Quality monitoring  | Quality of service alerts                    |
| Diverse recommendations — avoid creating filter bubbles                       | Diversity check     | Decision adjusted to include diverse options |
| Accessibility — recommendations must be accessible to users with disabilities | Accessibility check | Decision reformatted or replaced             |

**Example violation:** Recommending technical courses to male users and soft-skill courses to female users with identical skill profiles.

---

## Policy Enforcement

### Enforcement Levels

| Level            | Description                                                   | Applied To                            |
| ---------------- | ------------------------------------------------------------- | ------------------------------------- |
| **Hard Block**   | Decision cannot proceed under any circumstances               | Safety, Legal, Human-First violations |
| **Soft Block**   | Decision blocked unless override conditions met               | Privacy, Ethical violations           |
| **Demotion**     | Decision scored lower; not recommended unless no alternatives | Transparency gaps, Low confidence     |
| **Modification** | Decision is adjusted to comply                                | Fairness, Cultural sensitivity        |

### Override Mechanism

Some policies (Soft Block level) can be overridden:

1. **User override** — User explicitly confirms they want the decision despite the policy flag
2. **Coach override** — Human coach reviews and approves the decision
3. **Admin override** — Platform admin authorizes for specific cases
4. **Temporal override** — Policy is time-bound (e.g., temporary exception for beta testing)

All overrides are logged in the Audit Layer with full context.

---

## Policy Application by Decision Type

| Decision Type       | Active Policies                            | Most Restrictive              |
| ------------------- | ------------------------------------------ | ----------------------------- |
| Career              | Human-First, Transparency, Fairness        | Fairness (no stereotyping)    |
| Learning            | Human-First, Transparency, Safety          | Safety (knowledge confidence) |
| Business            | Human-First, Ethical, Safety, Transparency | Safety (financial)            |
| Freelancing         | Human-First, Privacy, Safety, Fairness     | Safety (legal compliance)     |
| Financial           | Human-First, Ethical, Safety, Transparency | All (highest scrutiny)        |
| Health/Productivity | Human-First, Privacy, Ethical, Safety      | Privacy (health data)         |
| Daily Planning      | Human-First, Transparency                  | Human-First (user goals)      |
| Opportunity Match   | Fairness, Transparency, Safety             | Fairness (equal access)       |
| Risk Management     | Human-First, Ethical, Safety               | Safety (preventing harm)      |
| Goal Prioritization | Human-First, Transparency                  | Human-First (user goals)      |

## Cross-References

- **Decision Intelligence.md** — The philosophy these policies implement
- **Decision Scoring.md** — Policies can override scoring results
- **Decision Confidence.md** — Confidence determines escalation, policies determine permissibility
- **Decision Explainability.md** — Transparency policy requires explanations
- **Decision Learning.md** — Feedback may trigger policy refinement
- **ARC-001 (Architecture Principles)** — Policies operationalize the 12 architecture principles
- **ARC-001 (Security Layer)** — Policy enforcement infrastructure
- **PRD-002 (Personalization Rules)** — User-facing personalization preferences complement these policies
- **CMP-001** — Business strategy may influence policy priorities (but never override foundation policies)

### Future Expansion

- **Regulatory compliance policies** — GDPR, CCPA, SOC2, PCI-DSS specific rules
- **Regional policies** — Country-specific legal and cultural policy variations
- **User-customizable policies** — Users can set their own policy preferences
- **Dynamic policies** — Policies that adapt based on situation severity
- **Policy impact analytics** — Track how policies affect decision quality and user satisfaction

- **PRD-001 (Human Journey)** — Journey stage determines applicable policies
- **RSH-001 (Human Problems)** — Problem severity influences policy enforcement strictness
