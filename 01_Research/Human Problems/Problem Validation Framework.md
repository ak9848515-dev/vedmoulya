# Problem Validation Framework

**Version:** 1.0
**Status:** Active
**Owner:** Principal Product Research Architect
**Created:** 2026-07-24
**Updated:** 2026-07-24
**Dependencies:** Human Problems/Problem Template.md, Human Problems/Research Methodology.md

## Description

Defines the validation methods and criteria used to confirm that documented problems are real, significant, and worth solving. Every problem in the repository must be validated through at least one method before it can influence product decisions.

---

## Validation Methods

### 1. User Interviews

**Description:** One-on-one qualitative interviews with people who experience the problem.

**When to use:** Early exploration, understanding context, discovering nuances.

**Validation criteria:**

- Minimum 5 interviews showing consistent patterns
- At least 3 direct quotes articulating the problem
- Interview notes documented and linked from problem entry

**Confidence level:** Medium (qualitative depth but limited scale)

---

### 2. Surveys

**Description:** Quantitative surveys distributed to a representative sample of the target population.

**When to use:** Validating prevalence, measuring severity and frequency at scale.

**Validation criteria:**

- Minimum 100 responses for statistical significance
- Clear question design with validated scales
- Results showing >40% of respondents experiencing the problem

**Confidence level:** High (scale + statistics)

---

### 3. Community Research

**Description:** Observing and analyzing discussions in online communities, forums, social media, and support channels.

**When to use:** Understanding how people talk about the problem, discovering language and framing.

**Validation criteria:**

- Minimum 50 unique mentions across platforms
- Consistent framing across independent sources
- Evidence of active seeking for solutions

**Confidence level:** Medium (observational, potential selection bias)

---

### 4. Industry Reports

**Description:** Published research from credible industry analysts, research firms, academic institutions, and government agencies.

**When to use:** Market sizing, trend validation, establishing external credibility.

**Validation criteria:**

- Source is credible and cited
- Data is less than 3 years old
- Findings directly support the problem hypothesis

**Confidence level:** High (expert source, but may not capture nuance)

---

### 5. Market Data

**Description:** Quantitative data from market sizing, competitor analysis, keyword research, and economic indicators.

**When to use:** Validating market opportunity, quantifying demand.

**Validation criteria:**

- Total Addressable Market (TAM) > $100M or significant for target segment
- Search volume trends showing growth
- Competitor presence validating demand

**Confidence level:** High (quantitative, but indirect)

---

### 6. Founder Experience

**Description:** Internal validation based on the founding team's direct experience with the problem.

**When to use:** Early-stage hypothesis generation, when other data is unavailable.

**Validation criteria:**

- Minimum 2 founders/founding team members have experienced the problem
- Documented personal narratives
- Cross-referenced with at least one other validation method

**Confidence level:** Low to Medium (biased but authentic)

---

### 7. Expert Interviews

**Description:** Interviews with domain experts, industry practitioners, academics, or thought leaders.

**When to use:** Validating problem from an expert perspective, understanding systemic factors.

**Validation criteria:**

- Minimum 3 expert interviews
- Experts have 5+ years of domain experience
- Consistent agreement on problem existence and significance

**Confidence level:** Medium to High (expertise but potential echo chamber)

---

## Validation Requirements by Stage

| Research Stage | Required Validation                  | Minimum Confidence |
| -------------- | ------------------------------------ | ------------------ |
| Hypothesis     | Founder experience or 1 source       | Low                |
| Exploring      | 2+ sources (at least 1 qualitative)  | Medium             |
| Validated      | 3+ sources (at least 1 quantitative) | High               |
| Prioritized    | Must be Validated                    | High               |
| Active         | Annual re-validation required        | High               |

---

## Validation Evidence Format

Every validation must produce a linked evidence artifact. Artifacts should be stored in:

`01_Research/Human Problems/Evidence/[Problem ID]/`

Accepted formats:

- Interview transcripts and notes
- Survey results (raw data + summary)
- Community research summaries
- Industry report excerpts (with citations)
- Market data analyses
- Founder experience narratives
- Expert interview notes

---

_Validation standards may be adjusted per problem based on severity and business impact. All exceptions require Principal Research Architect approval._
