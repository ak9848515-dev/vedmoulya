# Marketplace Insights

> **Document:** DES-009-D12 — Marketplace & Opportunity Ecosystem  
> **Status:** 🔒 **LOCKED** — Part of DES-009 Marketplace Constitution v1.1

---

## Purpose

Marketplace Insights provides users with regular reviews and analytics across weekly, monthly, and quarterly horizons — covering opportunity trends, career growth, business development, learning progress, collaboration outcomes, income, and overall growth — powered by AI summaries and guided reflection.

---

## Vision

Create the most insightful marketplace analytics experience — one that transforms raw marketplace activity into actionable understanding, celebrates genuine progress, and guides strategic decisions.

---

## Design Constitution Compliance

| Property        | Standard                                 | Source       |
| --------------- | ---------------------------------------- | ------------ |
| Page Background | `#F5F7FA` (Warm Matte Light)             | DES-001 v1.0 |
| Cards           | `#FFFFFF` with border `#E8EDF5`          | DES-001 v1.0 |
| Primary Color   | `#2B5FD9` (Deep Calm Blue)               | DES-001 v1.0 |
| AI Color        | `#7C3AED`                                | DES-001 v1.0 |
| Success         | `#22C55E`                                | DES-001 v1.0 |
| Premium Gold    | `#C89B3C` (limited — insight milestones) | DES-001 v1.0 |
| Headings        | Satoshi                                  | DES-001 v1.0 |
| Body            | Inter (never below 16px)                 | DES-001 v1.0 |
| Card Radius     | 24px                                     | DES-001 v1.0 |
| Motion          | 200-300ms, ease-out                      | DES-001 v1.0 |
| AI Persona      | Wise Mentor (Marketplace Coach mode)     | DES-005 v1.0 |

---

## Architecture References

| Reference | Relationship                                                    |
| --------- | --------------------------------------------------------------- |
| ARC-004   | Execution Intelligence — activity tracking, outcome measurement |
| ARC-005   | AI Orchestration — insight generation, summary creation         |
| ENG-001   | Domain Model — Analytics, Insight, Trend entities               |
| PRD-002   | User DNA — insight preference personalization                   |

---

## Information Hierarchy

```
P0 — ALWAYS VISIBLE:
  • Latest review summary
  • Key trend indicators
  • Notable changes since last review

P1 — SHOWN BY DEFAULT:
  • Weekly review (current)
  • Monthly review overview
  • AI insight summary
  • Opportunity trends

P2 — CONTEXTUAL:
  • Detailed trend analysis
  • Career/business/learning trends
  • Collaboration and income analytics
  • Growth metrics

P3 — ON DEMAND:
  • Full historical insights
  • Custom report builder
  • Insight settings
```

---

## Specification Consistency

| Standard               | Reference             | Application                                                    |
| ---------------------- | --------------------- | -------------------------------------------------------------- |
| Typography             | DES-001/D04           | Headings: Satoshi, Body: Inter (never below 16px)              |
| Spacing                | DES-001/D06           | 4px base unit, space-4 (16px) standard gap                     |
| Motion                 | DES-001/D09           | 200-300ms, ease-out, chart transitions                         |
| Accessibility          | DES-001/D10           | WCAG 2.1 AA, chart data available as text tables               |
| Color Hierarchy        | DES-001/D03           | Charts use approved palette (Blue, Green, Amber, Purple, Gray) |
| Component Language     | DES-001/D07           | Insight cards at 24px radius, charts at 24px radius            |
| AI Personality         | DES-001/D11 + DES-005 | Wise Mentor — provides reflective, honest summaries            |
| Interaction Principles | DES-001/D11           | Purposeful, calm, consistent                                   |

---

## 1. Weekly Review (Major Experience Section)

A weekly summary of marketplace activity — new opportunities, collaboration updates, trust changes, and AI-curated insights.

```
┌────────────────────────────────────────────────────────┐
│  📊 Your Weekly Marketplace Review                     │
│  July 20–26, 2026                                      │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Activity Summary                                │   │
│  │  • 12 new opportunities matched                  │   │
│  │  • 3 proposals sent                              │   │
│  │  • 1 collaboration started                       │   │
│  │  • Trust score +2 points                          │   │
│  │                                                   │   │
│  │  AI Insight: "Your focus on ML consulting is      │   │
│  │  paying off — 8 of 12 matches were ML-related.   │   │
│  │  Consider expanding to data engineering for       │   │
│  │  more opportunities."                             │   │
│  └─────────────────────────────────────────────────┘   │
│  [Full Report]  [Coach Analysis]  [Share]              │
└──────────────────────────────────────────────────────────┘
```

### Quality Review

| Dimension                     | Assessment                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Why**                       | Weekly reviews build engagement habits and provide regular value through actionable insights                                    |
| **Marketplace Reasoning**     | Regular touchpoints increase retention; curated insights reduce user effort and increase perceived value                        |
| **Psychological Reasoning**   | Feedback loop — weekly summary reinforces positive behaviors; Zeigarnik effect — incomplete goals motivate continued engagement |
| **Accessibility Impact**      | Weekly review content is available in-app and via notification; AI summary provides quick overview for screen reader users      |
| **Trust Impact**              | Honest summaries (including slow weeks) build more trust than always-positive framing                                           |
| **Implementation Complexity** | Medium — requires weekly aggregation, insight generation, and multi-channel delivery                                            |
| **Future Scalability**        | Can add predictive weekly forecasts, personalized action items, peer benchmark comparisons                                      |

---

## 2. Monthly Review (Major Experience Section)

A comprehensive monthly report covering all marketplace dimensions with deeper trend analysis and AI-recommended actions.

### Quality Review

| Dimension                     | Assessment                                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Why**                       | Monthly reviews provide strategic depth that weekly reviews cannot — patterns emerge over longer periods                              |
| **Marketplace Reasoning**     | Monthly reporting increases platform stickiness; data-driven insights drive goal-directed behavior                                    |
| **Psychological Reasoning**   | Big picture thinking — monthly view helps users connect micro-actions to macro-progress; pattern recognition improves decision-making |
| **Accessibility Impact**      | Monthly reports available as text summary, structured data, and accessible charts with text alternatives                              |
| **Trust Impact**              | Transparent, accurate reporting builds long-term trust; honest acknowledgment of challenges over promotional framing                  |
| **Implementation Complexity** | Medium-High — requires multi-dimensional aggregation, trend analysis, and personalized report generation                              |
| **Future Scalability**        | Can add predictive trends, benchmark comparisons, AI-suggested goals for next month                                                   |

---

## 3. Quarterly Review (Major Experience Section)

A deep quarterly analysis of marketplace trajectory, goal progress, skill development, and ecosystem contribution.

### Quality Review

| Dimension                     | Assessment                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Why**                       | Quarterly reviews enable strategic course-correction and celebrate meaningful milestones                                        |
| **Marketplace Reasoning**     | Quarterly cadence aligns with natural business and career planning cycles                                                       |
| **Psychological Reasoning**   | Temporal landmarks — quarterly reviews create natural reflection points; fresh start effect — quarters feel like new beginnings |
| **Accessibility Impact**      | Long-form quarterly reports include executive summary, section navigation, and screen reader optimized structure                |
| **Trust Impact**              | Long-term trend transparency builds deeper trust than short-term metrics; honest reflection on unmet goals                      |
| **Implementation Complexity** | Medium-High — requires long-term aggregation, goal progress tracking, and comprehensive report generation                       |
| **Future Scalability**        | Can add annual reviews, multi-year trajectory analysis, life chapter integration                                                |

---

## 4. Trend Analysis (Major Experience Section)

Visual and analytical trend tracking across opportunity types, career growth, business development, learning, collaborations, income, and personal growth.

| Trend Category           | Metrics                                                               | Update Cadence | Visualization                  |
| ------------------------ | --------------------------------------------------------------------- | -------------- | ------------------------------ |
| **Opportunity Trends**   | Match quality, opportunity volume by type, industry demand shifts     | Weekly         | Line chart (7d/30d/90d)        |
| **Career Trends**        | Skill development, role progression, career readiness score           | Monthly        | Area chart + milestone markers |
| **Business Trends**      | Client acquisition, revenue trajectory, business stage progression    | Monthly        | Bar chart + stage indicators   |
| **Learning Trends**      | Skill acquisition rate, knowledge connections, certification progress | Weekly         | Growth chart + knowledge map   |
| **Collaboration Trends** | Collaboration frequency, completion rate, satisfaction trend          | Monthly        | Composite trend chart          |
| **Income Trends**        | Earnings by source, rate changes, income stability                    | Monthly        | Stacked area chart             |
| **Growth Trends**        | Trust score trajectory, portfolio growth, ecosystem engagement        | Quarterly      | Multi-metric dashboard         |

### Quality Review

| Dimension                     | Assessment                                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Why**                       | Trend visibility enables data-driven decision-making and motivates continued engagement                                   |
| **Marketplace Reasoning**     | Analytics increase platform value; visible progress motivates goal-directed behavior                                      |
| **Psychological Reasoning**   | Progress principle — visible growth motivates continued effort; loss aversion — declining trends prompt corrective action |
| **Accessibility Impact**      | All charts include text alternatives, data tables, and trend descriptions; color palette is color-blind safe              |
| **Trust Impact**              | Honest trend display (including declines) builds trust; manipulated scales would destroy credibility                      |
| **Implementation Complexity** | Medium-High — requires analytics pipeline, multiple visualization types, and accessible chart components                  |
| **Future Scalability**        | Can add predictive trendlines, anomaly detection, AI-generated trend narratives                                           |

---

## 5. AI-Generated Summaries & Reflection (Major Experience Section)

The AI Coach generates personalized summaries for each review period, highlighting what went well, what to improve, and suggested next steps.

### Quality Review

| Dimension                     | Assessment                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Why**                       | AI summaries transform raw data into actionable understanding — reducing cognitive load and highlighting what matters           |
| **Marketplace Reasoning**     | Personalized summaries increase perceived value; reflective guidance drives goal-directed behavior                              |
| **Psychological Reasoning**   | Sense-making — narratives help users understand complex data; growth framing — constructive feedback motivates improvement      |
| **Accessibility Impact**      | AI summaries are text-based, screen reader friendly, and available in multiple detail levels                                    |
| **Trust Impact**              | Coach must distinguish between factual observations and suggestions; never fabricate positive trends when data shows stagnation |
| **Implementation Complexity** | Medium — requires ARC-005 insight generation, personalization, and reflection prompt design                                     |
| **Future Scalability**        | Can add voice summaries, multi-language insights, collaborative reflection (team/group reports)                                 |

---

## Personalization

| Dimension         | Application to Marketplace Insights                     |
| ----------------- | ------------------------------------------------------- |
| Career Goals      | Insight emphasis on career-relevant metrics             |
| Learning Progress | Learning trend visibility aligned with development plan |
| Skills            | Skill trend analysis for gap identification             |
| Risk Tolerance    | Risk trend communication adjusted to comfort level      |
| Availability      | Insight timing respects user's schedule preferences     |

---

## Accessibility

| Requirement         | Standard                     | Application                                |
| ------------------- | ---------------------------- | ------------------------------------------ |
| WCAG 2.1 AA         | Minimum for all screens      | All review and analytics screens           |
| Body text minimum   | 16px (never below)           | All insight content                        |
| Touch targets       | 44×44px minimum              | Chart interaction, report navigation       |
| Keyboard navigation | 100% of interactions         | Report browsing, chart data exploration    |
| Screen reader       | All data available as text   | Charts include data tables                 |
| Reduced motion      | All animations disabled      | Respect prefers-reduced-motion             |
| Color alone         | Never solely conveys meaning | Chart categories include labels + patterns |

---

## Motion

| Animation               | Duration | Easing   | Notes                            |
| ----------------------- | -------- | -------- | -------------------------------- |
| Weekly review entry     | 300ms    | ease-out | Slide in from top                |
| Chart data update       | 400ms    | ease-out | Data points transition           |
| Trend line drawing      | 500ms    | ease-out | Line chart animation             |
| Quarterly report expand | 400ms    | ease-out | Section reveal                   |
| Reduced motion          | All 0ms  | —        | prefers-reduced-motion respected |

---

## Cross-References

| Reference     | Relationship                                                    |
| ------------- | --------------------------------------------------------------- |
| DES-001 v1.0  | Design Constitution — visual foundation                         |
| DES-001A v1.0 | Design System Consistency — chart patterns                      |
| DES-003A v1.1 | Dashboard Refinement — insight snapshot                         |
| DES-004 v1.0  | Memory & Knowledge — historical data                            |
| DES-005 v1.0  | AI Mentor — insight summaries                                   |
| DES-009/D00   | Marketplace Constitution — success metrics                      |
| DES-009/D02   | Marketplace Dashboard — insight access                          |
| DES-009/D03   | Opportunity Discovery — opportunity trends                      |
| DES-009/D06   | Mentorship — mentorship analytics                               |
| DES-009/D07   | Hiring — hiring analytics                                       |
| DES-009/D08   | Freelancing — freelancing analytics                             |
| DES-009/D10   | AI Marketplace Coach — insight generation                       |
| DES-009/D11   | Trust and Reputation — trust trend data                         |
| PRD-001       | Product Vision — data-driven marketplace                        |
| ARC-001       | System Architecture — insights module                           |
| ARC-002       | Information Architecture — analytics data flow                  |
| ARC-003       | Knowledge Graph — trend connections, pattern detection          |
| ARC-004       | Execution Intelligence — activity tracking, outcome measurement |
| ARC-005       | AI Orchestration — insight generation, summary creation         |
| ENG-001       | Domain Model — Analytics, Insight, Trend, Report entities       |
| ENG-002       | Implementation Standards — analytics patterns, chart components |
| ENG-003       | AI Development Guidelines — insight generation ethics           |
| ENG-004       | Testing Standards — insight accuracy validation                 |
| RSH-001       | Research — user analytics consumption behavior                  |
| CMP-001       | Competition — marketplace analytics differentiation             |

### Relationship Summary

| Reference   | How D12 Depends On It                                                |
| ----------- | -------------------------------------------------------------------- |
| DES-001     | All visual properties applied to insights screens and charts         |
| DES-001A    | Component patterns for charts, cards, and report layouts             |
| DES-002     | Onboarding establishes baseline for insight comparison               |
| DES-003     | Dashboard displays insight snapshot                                  |
| DES-003A    | Refined dashboard surfaces insight access                            |
| DES-004     | Historical data from Memory & Knowledge for trend analysis           |
| DES-005     | AI Mentor generates insight summaries and reflection prompts         |
| DES-009/D00 | Constitution defines success metrics that insights track             |
| DES-009/D02 | Dashboard provides entry point to insights                           |
| DES-009/D03 | Opportunity trends derived from discovery feed data                  |
| DES-009/D06 | Mentorship analytics integrated into insights                        |
| DES-009/D07 | Hiring analytics integrated into insights                            |
| DES-009/D08 | Freelancing analytics integrated into insights                       |
| DES-009/D10 | Coach generates weekly/monthly reports                               |
| DES-009/D11 | Trust trend data used in growth insights                             |
| PRD-001     | Product vision defines data-driven marketplace                       |
| PRD-002     | User DNA personalizes insight presentation                           |
| ARC-001     | Architecture enables insights module and data aggregation            |
| ARC-002     | Data flow design supports multi-source analytics                     |
| ARC-003     | Knowledge Graph enables trend connections and pattern detection      |
| ARC-004     | Execution intelligence provides activity and outcome data            |
| ARC-005     | AI pipeline powers insight generation and summaries                  |
| ENG-001     | Domain entities define Analytics, Insight, Trend, Report data models |
| ENG-002     | Implementation patterns define analytics and chart standards         |
| ENG-003     | AI ethics govern insight generation honesty and transparency         |
| ENG-004     | Testing validates insight accuracy and meaningfulness                |
| RSH-001     | Research informs effective insight presentation patterns             |
| CMP-001     | Competitive analysis differentiates marketplace analytics            |

---

## Future Scalability

| Capability                           | Horizon   | Impact                                   |
| ------------------------------------ | --------- | ---------------------------------------- |
| Predictive trend analysis            | 6 months  | "Based on trends, next month you may..." |
| Custom report builder                | 6 months  | User-defined insight views               |
| Peer benchmark comparisons           | 6 months  | Anonymous percentile rankings            |
| Automated goal setting from insights | 9 months  | AI-suggested quarterly goals             |
| Collaborative team insights          | 12 months | Group marketplace analytics              |

---

## Implementation Complexity

| Component        | Complexity  | Key Dependencies                  |
| ---------------- | ----------- | --------------------------------- |
| Weekly Review    | Medium      | Aggregation, ARC-005              |
| Monthly Review   | Medium-High | Multi-dimensional aggregation     |
| Quarterly Review | Medium-High | Long-term data, goal tracking     |
| Trend Analysis   | Medium-High | Analytics pipeline, visualization |
| AI Summaries     | Medium      | ARC-005, reflection prompts       |

---

## Design Freeze Status

**DES-009-D12: Marketplace Insights — LOCKED effective July 27, 2026.**

All marketplace insights design decisions are finalized. No further changes without formal Design Review.
