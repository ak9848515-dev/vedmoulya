# Problem Prioritization Framework

**Version:** 1.0
**Status:** Active
**Owner:** Principal Product Research Architect
**Created:** 2026-07-24
**Updated:** 2026-07-24
**Dependencies:** Human Problems/Problem Template.md, Human Problems/Problem Validation Framework.md

## Description

Defines the scoring system used to prioritize which human problems VedMoulya should address first. Each validated problem is scored across six dimensions to produce a single Priority Score.

---

## Scoring Dimensions

### 1. Severity (Weight: 3x)

How intense or painful the problem is for those experiencing it.

| Score | Label       | Description                                   |
| ----- | ----------- | --------------------------------------------- |
| 1     | Annoyance   | Minor inconvenience, easy to work around      |
| 2     | Frustration | Noticeable friction, impacts experience       |
| 3     | Significant | Causes real stress or lost opportunity        |
| 4     | Severe      | Blocks progress, creates significant hardship |
| 5     | Crisis      | Threatens livelihood, health, or survival     |

---

### 2. Frequency (Weight: 2x)

How often the problem is encountered.

| Score | Label      | Description                     |
| ----- | ---------- | ------------------------------- |
| 1     | Rare       | A few times per year or less    |
| 2     | Occasional | Monthly                         |
| 3     | Regular    | Weekly                          |
| 4     | Frequent   | Multiple times per week         |
| 5     | Daily      | Every day or constantly present |

---

### 3. Market Size (Weight: 2x)

The number of people affected by the problem.

| Score | Label   | Description            |
| ----- | ------- | ---------------------- |
| 1     | Niche   | < 10,000 people        |
| 2     | Small   | 10,000 - 100,000       |
| 3     | Medium  | 100,000 - 1 million    |
| 4     | Large   | 1 million - 10 million |
| 5     | Massive | > 10 million           |

---

### 4. AI Suitability (Weight: 2x)

How well-suited AI is to solve or mitigate this problem.

| Score | Label          | Description                                  |
| ----- | -------------- | -------------------------------------------- |
| 1     | Poor           | AI adds no value or cannot address           |
| 2     | Low            | AI provides minimal improvement              |
| 3     | Moderate       | AI provides noticeable improvement           |
| 4     | High           | AI is significantly better than alternatives |
| 5     | Transformative | Problem is unsolvable without AI             |

---

### 5. Business Impact (Weight: 1.5x)

The potential revenue, retention, or strategic value of solving this problem.

| Score | Label    | Description                                |
| ----- | -------- | ------------------------------------------ |
| 1     | Minimal  | Negligible business impact                 |
| 2     | Low      | Marginal improvement                       |
| 3     | Moderate | Clear revenue or retention impact          |
| 4     | High     | Significant revenue or strategic advantage |
| 5     | Critical | Core to business model or mission          |

---

### 6. Implementation Difficulty (Weight: 1x)

How difficult, costly, or risky it is to implement a solution (inverted — lower is better).

| Score | Label    | Description                                       |
| ----- | -------- | ------------------------------------------------- |
| 1     | Trivial  | Can be solved in days with existing resources     |
| 2     | Easy     | Requires weeks, low complexity                    |
| 3     | Moderate | Requires months, moderate complexity              |
| 4     | Hard     | Requires significant engineering effort           |
| 5     | Complex  | Requires R&D, new infrastructure, or partnerships |

---

## Score Calculation

```
Priority Score = (Severity × 3) + (Frequency × 2) + (Market Size × 2) + (AI Suitability × 2) + (Business Impact × 1.5) + (Implementation Difficulty × 1)
```

**Maximum possible score:** 57.5
**Minimum possible score:** 11.5

## Priority Tiers

| Priority Score | Tier                 | Action                                 |
| -------------- | -------------------- | -------------------------------------- |
| 40 - 57.5      | P0 — Critical        | Must address in current planning cycle |
| 30 - 39        | P1 — High Priority   | Address in next planning cycle         |
| 20 - 29        | P2 — Medium Priority | Add to backlog, plan within 2 cycles   |
| 10 - 19        | P3 — Low Priority    | Monitor, re-evaluate quarterly         |

---

## Additional Factors (Qualitative)

These factors do not affect the numerical score but may influence prioritization decisions:

- **Strategic alignment** — Does this problem align with VedMoulya's mission and vision?
- **User demand** — Are users actively requesting a solution?
- **Competitive pressure** — Are competitors solving this problem?
- **Timeliness** — Is there a market timing advantage?
- **Platform synergy** — Does solving this unlock value across multiple modules?
- **Risk reduction** — Does solving this reduce churn, support burden, or negative sentiment?

---

## Prioritization Process

1. **Score** — Apply numerical scoring to all validated problems
2. **Tier** — Assign tier based on score
3. **Review** — Research team reviews qualitative factors
4. **Decide** — Product leadership makes final prioritization decisions
5. **Update** — Update problem status to **Prioritized** with priority tier
6. **Link** — Link to product roadmap items that address the problem

---

## Example Calculation

| Dimension                 | Score | Weight | Weighted Score |
| ------------------------- | ----- | ------ | -------------- |
| Severity                  | 4     | 3x     | 12             |
| Frequency                 | 3     | 2x     | 6              |
| Market Size               | 4     | 2x     | 8              |
| AI Suitability            | 5     | 2x     | 10             |
| Business Impact           | 4     | 1.5x   | 6              |
| Implementation Difficulty | 2     | 1x     | 2              |
| **Total**                 |       |        | **44**         |

**Tier:** P0 — Critical

---

_Prioritization is reviewed monthly during product planning. Scores may be adjusted as new evidence emerges._
