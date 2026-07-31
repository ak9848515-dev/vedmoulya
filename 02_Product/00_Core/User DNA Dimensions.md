# User DNA Dimensions

**Version:** 1.0
**Status:** Draft
**Author:** Principal Product Architect
**Created:** 2026-07-24
**Updated:** 2026-07-24
**Dependencies:** User DNA.md, Human Journey.md (PRD-001), User Goals.md

## Description

Defines the eight dimensions that compose a user's DNA on the VedMoulya platform. Each dimension captures a distinct aspect of who the user is, what they can do, what they want, and what context they operate within. Together, these dimensions form a complete model that drives every personalized experience.

---

## Dimension Overview

| #   | Dimension        | Category       | Description                     | Data Source         |
| --- | ---------------- | -------------- | ------------------------------- | ------------------- |
| 1   | Identity         | Static Profile | Who the user fundamentally is   | Declared            |
| 2   | Skills           | Capability     | What the user can do            | Assessed + Inferred |
| 3   | Knowledge        | Capability     | What the user knows             | Assessed + Inferred |
| 4   | Goals            | Motivation     | What the user wants to achieve  | Declared + Inferred |
| 5   | Learning Profile | Style          | How the user learns best        | Assessed + Inferred |
| 6   | Personality      | Psychology     | How the user thinks and behaves | Assessed            |
| 7   | Context          | Environment    | The user's situational factors  | Declared + Inferred |
| 8   | Progress         | Journey        | Where the user is on their path | Computed            |

---

## Dimension 1: Identity

**Purpose:** Establish who the user is — their demographics, background, and fundamental characteristics.

**Attributes:**

| Attribute            | Type   | Examples             | Source   | Update Frequency |
| -------------------- | ------ | -------------------- | -------- | ---------------- |
| Name                 | String | —                    | Declared | Rarely           |
| Age range            | Range  | 25-34                | Declared | Annually         |
| Location             | String | Mumbai, India        | Declared | As needed        |
| Education level      | Enum   | Bachelor's, Master's | Declared | Rarely           |
| Occupation           | String | Software Engineer    | Declared | As needed        |
| Industry             | String | Technology           | Declared | As needed        |
| Languages            | List   | English, Hindi       | Declared | Rarely           |
| Background narrative | Text   | User's story         | Declared | Rarely           |

**Privacy:** All identity attributes are visible to the user and can be edited at any time. Some attributes (age, location) may be used for anonymized aggregate analysis.

---

## Dimension 2: Skills

**Purpose:** Capture the complete inventory of skills the user possesses, along with proficiency levels.

**Attributes:**

| Attribute           | Type       | Examples                   | Source   | Update Frequency |
| ------------------- | ---------- | -------------------------- | -------- | ---------------- |
| Skill name          | String     | Python, Project Management | Assessed | Continuous       |
| Proficiency level   | Scale 1-10 | 7                          | Assessed | Per assessment   |
| Years of experience | Number     | 5                          | Declared | Annually         |
| Last used           | Date       | 2026-06-15                 | Inferred | Continuous       |
| Certifications      | List       | AWS Certified              | Declared | As earned        |
| Skill category      | Enum       | Technical, Soft Skill      | Tagged   | Initial          |
| Confidence score    | 0-1        | 0.85                       | Computed | Per assessment   |

**Assessment methods:** Skill assessments, project evaluations, peer endorsements, AI inference from activity.

---

## Dimension 3: Knowledge

**Purpose:** Track what the user knows across domains, subjects, and topics.

**Attributes:**

| Attribute        | Type       | Examples                   | Source   | Update Frequency |
| ---------------- | ---------- | -------------------------- | -------- | ---------------- |
| Knowledge domain | String     | Machine Learning           | Assessed | Continuous       |
| Mastery level    | Scale 1-10 | 6                          | Assessed | Per assessment   |
| Topics covered   | List       | Regression, Classification | Inferred | Continuous       |
| Learning history | Links      | Course IDs completed       | Computed | Continuous       |
| Knowledge gaps   | List       | [Identified gaps]          | Inferred | Continuous       |
| Last verified    | Date       | 2026-07-01                 | Computed | Per assessment   |

**Relationship to skills:** Knowledge represents theoretical understanding; Skills represent practical application. A user may have knowledge of a topic but not yet have the corresponding skill.

---

## Dimension 4: Goals

**Purpose:** Capture the user's short-term and long-term objectives across career, learning, financial, and personal domains.

**Attributes:**

| Attribute             | Type        | Examples                              | Source   | Update Frequency |
| --------------------- | ----------- | ------------------------------------- | -------- | ---------------- |
| Goal statement        | Text        | "Become a senior data scientist"      | Declared | As goals change  |
| Goal category         | Enum        | Career, Learning, Financial           | Tagged   | Initial          |
| Time horizon          | Enum        | Short (3mo), Medium (1yr), Long (5yr) | Declared | Per goal         |
| Priority              | 1-5         | 4                                     | Declared | Per goal         |
| Progress              | Percentage  | 35%                                   | Computed | Continuous       |
| Aligned journey stage | Stage       | 03_Build                              | Mapped   | Initial          |
| Related problems      | Problem IDs | [PROB-XXX]                            | Mapped   | Initial          |

**Goal types:**

- **Aspirational goals** — Long-term visions ("build a company")
- **Milestone goals** — Medium-term targets ("launch MVP in 6 months")
- **Action goals** — Short-term actions ("complete React course this month")
- **Maintenance goals** — Ongoing habits ("exercise 3x per week")

Goals are mapped to journey stages via the Human Journey framework (PRD-001) and to validated human problems via RSH-001.

---

## Dimension 5: Learning Profile

**Purpose:** Understand how the user learns most effectively — their preferred modalities, pace, and engagement patterns.

**Attributes:**

| Attribute              | Type    | Examples                            | Source   | Update Frequency |
| ---------------------- | ------- | ----------------------------------- | -------- | ---------------- |
| Primary modality       | Enum    | Visual, Reading, Hands-on           | Assessed | Initial + review |
| Secondary modality     | Enum    | Auditory                            | Assessed | Initial + review |
| Preferred pace         | Enum    | Self-paced, Structured, Accelerated | Inferred | Continuous       |
| Optimal session length | Minutes | 25                                  | Inferred | Continuous       |
| Engagement pattern     | Enum    | Deep focus, Spaced, Micro-learning  | Inferred | Continuous       |
| Motivation driver      | Enum    | Curiosity, Career, Competition      | Assessed | Quarterly        |
| Peer preference        | Enum    | Solo, Group, Mixed                  | Assessed | Quarterly        |
| Feedback style         | Enum    | Immediate, Periodic, Summary        | Assessed | Initial          |

**Usage:** Learning profile influences content format recommendations, session scheduling, group vs. solo learning, and assessment timing.

---

## Dimension 6: Personality

**Purpose:** Capture stable personality traits that influence how the user approaches challenges, learning, collaboration, and decision-making.

**Attributes:**

| Attribute            | Type  | Scale                                | Examples                   | Source   |
| -------------------- | ----- | ------------------------------------ | -------------------------- | -------- |
| Openness             | Scale | 1-10                                 | 7 (Curious, exploratory)   | Assessed |
| Conscientiousness    | Scale | 1-10                                 | 8 (Organized, disciplined) | Assessed |
| Extraversion         | Scale | 1-10                                 | 5 (Balanced)               | Assessed |
| Agreeableness        | Scale | 1-10                                 | 6 (Cooperative)            | Assessed |
| Neuroticism          | Scale | 1-10                                 | 3 (Emotionally stable)     | Assessed |
| Risk tolerance       | Scale | 1-10                                 | 6 (Moderate risk taker)    | Assessed |
| Learning orientation | Enum  | Mastery, Performance, Avoidance      | Assessed                   | Assessed |
| Decision style       | Enum  | Analytical, Intuitive, Collaborative | Assessed                   | Assessed |

**Ethical note:** Personality assessment is optional and requires explicit opt-in. Results are never shared without consent. Personality data is used only to improve personalization, never for discrimination or exclusion.

---

## Dimension 7: Context

**Purpose:** Capture the user's real-world circumstances that affect their ability to pursue goals.

**Attributes:**

| Attribute           | Type       | Examples                               | Source              | Update Frequency |
| ------------------- | ---------- | -------------------------------------- | ------------------- | ---------------- |
| Time availability   | Hours/week | 10                                     | Declared            | Monthly          |
| Financial situation | Enum       | Stable, Stretched, Abundant            | Declared (optional) | Quarterly        |
| Career stage        | Enum       | Entry, Mid, Senior, Career Change      | Declared            | Annually         |
| Life stage          | Enum       | Student, Early Career, Parent, Retired | Declared            | As changes occur |
| Support system      | Enum       | Strong, Moderate, Limited              | Declared (optional) | Annually         |
| Primary constraints | List       | Time, Money, Access, Energy            | Declared            | Quarterly        |
| Device access       | Enum       | Desktop only, Mobile, Both             | Inferred            | Initial          |
| Internet quality    | Enum       | High, Medium, Low, Intermittent        | Inferred            | Continuous       |
| Time zone           | String     | UTC+5:30                               | Declared            | Initial          |

**Usage:** Context determines what recommendations are realistic. A user with 5 hours/week and limited budget should not receive recommendations designed for someone with 40 hours/week and enterprise resources.

---

## Dimension 8: Progress

**Purpose:** Track the user's current position on their journey across all dimensions of growth.

**Attributes:**

| Attribute             | Type    | Examples | Source   | Update Frequency |
| --------------------- | ------- | -------- | -------- | ---------------- |
| Current journey stage | Stage   | 02_Learn | Computed | Continuous       |
| HPI score             | 0-100   | 62       | Computed | Continuous       |
| Skills acquired       | Count   | 12       | Computed | Continuous       |
| Projects completed    | Count   | 3        | Computed | Continuous       |
| Income generated      | Amount  | ₹50,000  | Computed | Monthly          |
| Time on platform      | Days    | 45       | Computed | Continuous       |
| Engagement streak     | Days    | 7        | Computed | Continuous       |
| Growth rate           | %/month | 15%      | Computed | Monthly          |
| Momentum score        | 1-10    | 7        | Computed | Weekly           |

**Relationship to HPI:** The Human Progress Index (HPI) is the composite score derived from multiple progress attributes. See Human Progress Index.md for details.

---

## Dimension Relationships

```
                ┌─────────────┐
                │   Identity  │
                └──────┬──────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
   ┌─────▼─────┐ ┌────▼────┐ ┌─────▼─────┐
   │   Skills  │ │Knowledge│ │   Goals   │
   └─────┬─────┘ └────┬────┘ └─────┬─────┘
         │             │             │
         └─────────────┼─────────────┘
                       │
              ┌────────▼────────┐
              │ Learning Profile│
              └────────┬────────┘
                       │
              ┌────────▼────────┐
              │   Personality   │
              └────────┬────────┘
                       │
              ┌────────▼────────┐
              │    Context      │
              └────────┬────────┘
                       │
              ┌────────▼────────┐
              │    Progress     │
              └─────────────────┘
```

Identity grounds everything. Skills and knowledge feed into goals. Learning profile and personality determine how the user engages. Context constrains what's realistic. Progress tracks outcomes.

## Future Expansion

- **Interest DNA** — Evolving interests and passions over time
- **Health & Energy** — Physical and mental energy patterns
- **Social Graph DNA** — Network connections and influence patterns
- **Financial DNA** — Detailed financial profile for wealth-building recommendations
- **Cultural DNA** — Cultural context for globally relevant personalization
- **Temporal DNA** — How dimensions fluctuate with time of day, season, life events
- **Team DNA** — Aggregate profiles for team or organizational contexts
