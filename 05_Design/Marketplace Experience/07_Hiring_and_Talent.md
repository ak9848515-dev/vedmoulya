# Hiring & Talent

> **Document:** DES-009-D07 — Marketplace & Opportunity Ecosystem  
> **Status:** 🔒 **LOCKED** — Part of DES-009 Marketplace Constitution v1.1

---

## Purpose

The Hiring & Talent experience enables companies and individuals to discover talent, verify skills through evidence, and make informed hiring decisions — without becoming another LinkedIn.

---

## Vision

Create an evidence-first hiring marketplace where skills, portfolios, and project outcomes matter more than resumes, connections, or self-promotion.

---

## Design Constitution Compliance

| Property        | Standard                                | Source       |
| --------------- | --------------------------------------- | ------------ |
| Page Background | `#F5F7FA` (Warm Matte Light)            | DES-001 v1.0 |
| Cards           | `#FFFFFF` with border `#E8EDF5`         | DES-001 v1.0 |
| Primary Color   | `#2B5FD9` (Deep Calm Blue)              | DES-001 v1.0 |
| AI Color        | `#7C3AED`                               | DES-001 v1.0 |
| Premium Gold    | `#C89B3C` (limited — hiring milestones) | DES-001 v1.0 |
| Headings        | Satoshi                                 | DES-001 v1.0 |
| Body            | Inter (never below 16px)                | DES-001 v1.0 |
| Card Radius     | 24px                                    | DES-001 v1.0 |
| Button Radius   | 14px                                    | DES-001 v1.0 |
| Motion          | 200-300ms, ease-out                     | DES-001 v1.0 |
| AI Persona      | Wise Mentor (Marketplace Coach mode)    | DES-005 v1.0 |

---

## Architecture References

| Reference | Relationship                                                  |
| --------- | ------------------------------------------------------------- |
| ARC-003   | Knowledge Graph — skill verification, candidate matching      |
| ARC-005   | AI Orchestration — candidate recommendations, hiring insights |
| ENG-001   | Domain Model — Job, Candidate, Application entities           |
| PRD-002   | User DNA — career goals, hiring preferences                   |

---

## Information Hierarchy

```
P0 — ALWAYS VISIBLE:
  • Active job postings (for employers)
  • Recommended positions (for candidates)
  • Application status summary

P1 — SHOWN BY DEFAULT:
  • Talent discovery feed
  • Candidate profiles with evidence
  • Skill verification badges
  • AI Hiring Coach presence

P2 — CONTEXTUAL:
  • Detailed candidate portfolio
  • Interview preparation materials
  • Hiring workflow (stages)
  • Company insights

P3 — ON DEMAND:
  • Full hiring history
  • Hiring analytics
  • Hiring settings
```

---

## Specification Consistency

| Standard               | Reference             | Application                                       |
| ---------------------- | --------------------- | ------------------------------------------------- |
| Typography             | DES-001/D04           | Headings: Satoshi, Body: Inter (never below 16px) |
| Spacing                | DES-001/D06           | 4px base unit, space-4 (16px) standard gap        |
| Motion                 | DES-001/D09           | 200-300ms, ease-out, purposeful animations        |
| Accessibility          | DES-001/D10           | WCAG 2.1 AA, 4.5:1 contrast, 44×44px targets      |
| Color Hierarchy        | DES-001/D03           | Primary #2B5FD9, AI #7C3AED                       |
| Component Language     | DES-001/D07           | Cards at 24px radius, buttons at 14px radius      |
| AI Personality         | DES-001/D11 + DES-005 | Wise Mentor (Marketplace Coach mode)              |
| Interaction Principles | DES-001/D11           | Purposeful, performant, calm, consistent          |

---

## 1. Talent Discovery (Major Experience Section)

Employers and hiring managers discover candidates through evidence-based profiles featuring verified skills, portfolios, and project outcomes — never self-promotion.

```
┌────────────────────────────────────────────────────────┐
│  Talent Discovery                        [Filters ▼]   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  👤 Alex Rivera — Full-Stack Engineer            │   │
│  │  Skills: React (Expert) · Node (Advanced)        │   │
│  │  Verified: 8 projects · 92% completion rate      │   │
│  │  Trust Score: 88 · Available in 2 weeks          │   │
│  │  [View Portfolio]  [Message]  [Shortlist]        │   │
│  └─────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### Quality Review

| Dimension                     | Assessment                                                                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Why**                       | Talent discovery is the core hiring function — quality matching determines hiring success                                                    |
| **Marketplace Reasoning**     | Evidence-first discovery differentiates from LinkedIn's self-reported profiles; quality attracts serious employers                           |
| **Psychological Reasoning**   | Confirmation bias — employers trust evidence more than claims; availability heuristic — visible project outcomes anchor perceived competence |
| **Accessibility Impact**      | Candidate cards use clear heading hierarchy with text-based skill levels; screen reader accessible                                           |
| **Trust Impact**              | Verified skills and project outcomes replace resume inflation — trust is earned through evidence                                             |
| **Implementation Complexity** | Medium-High — requires skill verification, portfolio integration, and trust score aggregation                                                |
| **Future Scalability**        | ML-powered candidate ranking, passive candidate discovery, skill gap analysis for career development                                         |

---

## 2. Candidate Profiles — Evidence-First (Major Experience Section)

Candidate profiles show verified skills, project portfolios, learning achievements, and trust signals — never just employment history.

### Quality Review

| Dimension                     | Assessment                                                                                                             |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Why**                       | Candidates need to present themselves credibly; employers need to evaluate fit without bias                            |
| **Marketplace Reasoning**     | Evidence-first profiles prevent race-to-bottom on credentials; focus on demonstrated capability                        |
| **Psychological Reasoning**   | Signaling theory — verified evidence is a costly signal that honest candidates can provide; reduces adverse selection  |
| **Accessibility Impact**      | Profile is fully semantic HTML with structured data; portfolio items include alt text and descriptions                 |
| **Trust Impact**              | This is the primary trust mechanism — every claim should have supporting evidence from learning, projects, or feedback |
| **Implementation Complexity** | Medium — requires portfolio integration, skill assessment data, project history, and feedback aggregation              |
| **Future Scalability**        | Can add AI-generated skill summaries, predictive role fit scores, peer endorsements with evidence                      |

---

## 3. Hiring Workflow (Major Experience Section)

Structured hiring pipeline from discovery through application, screening, interview, offer, and onboarding.

### Quality Review

| Dimension                     | Assessment                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Why**                       | A clear hiring workflow reduces friction for both employers and candidates                                                                  |
| **Marketplace Reasoning**     | Structured pipeline increases completion rates; transparency about stages builds trust                                                      |
| **Psychological Reasoning**   | Progress principle — seeing advancement in pipeline motivates continued engagement; closure drive — incomplete stages create follow-through |
| **Accessibility Impact**      | Pipeline stages are labeled with text (not color-only); status updates use polite live regions                                              |
| **Trust Impact**              | Transparency about hiring stage ensures candidates aren't left in uncertainty; AI rejection feedback provides value                         |
| **Implementation Complexity** | Medium — requires application management, status tracking, communication, and notification integration                                      |
| **Future Scalability**        | Can add AI-assisted screening, interview scheduling automation, offer letter generation                                                     |

---

## 4. Portfolio Discovery (Previously Uncovered Item)

Browse and discover user portfolios by skill, industry, project type, and trust level.

### Quality Review

| Dimension                     | Assessment                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Why**                       | Portfolio discovery enables employers to find talent based on demonstrated work, not self-promotion                            |
| **Marketplace Reasoning**     | Portfolio browsing is the highest-signal discovery method — real work speaks louder than profiles                              |
| **Psychological Reasoning**   | Show, don't tell — visual evidence is more persuasive than textual claims; authenticity is perceived through concrete examples |
| **Accessibility Impact**      | Portfolio items include text descriptions, alt text for images, and structured metadata for screen readers                     |
| **Trust Impact**              | Real project evidence with outcomes and feedback replaces inflated claims; verifiable work builds ecosystem trust              |
| **Implementation Complexity** | Medium — requires portfolio upload, categorization, search indexing, and trust verification                                    |
| **Future Scalability**        | AI-curated portfolio highlights, skill-based portfolio suggestions, collaborative portfolio building                           |

---

## 5. AI Hiring Assistant (Major Experience Section)

AI assists with role matching, candidate recommendations, interview preparation, and hiring analytics.

### Quality Review

| Dimension                     | Assessment                                                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Why**                       | AI reduces hiring friction for both sides — better matches, faster screening, fairer evaluation                            |
| **Marketplace Reasoning**     | AI-powered matching increases marketplace liquidity; better matches drive retention and repeat usage                       |
| **Psychological Reasoning**   | Automation bias — users trust AI screening when transparent; fair process effect — perceived fairness increases acceptance |
| **Accessibility Impact**      | AI recommendations include text explanations; interview prep materials are screen reader accessible                        |
| **Trust Impact**              | AI must be transparent about how matches are made; never fabricate candidate quality; show confidence scores               |
| **Implementation Complexity** | High — requires AI orchestration, skill matching, bias detection, and response validation                                  |
| **Future Scalability**        | Can add predictive hiring success models, compensation benchmarking, diversity analysis                                    |

---

## Personalization

| Dimension            | Application to Hiring & Talent                   |
| -------------------- | ------------------------------------------------ |
| Career Goals         | Job recommendations align with career trajectory |
| Skills               | Candidate-role matching based on verified skills |
| Industry             | Industry-specific role discovery                 |
| Experience           | Role level matches candidate experience          |
| Location Preferences | Remote/hybrid/onsite filtering                   |
| Risk Tolerance       | Startup vs. established company matching         |
| Availability         | Active/passive candidate status                  |
| Past Collaborations  | Repeat hiring relationships                      |

---

## Accessibility

| Requirement         | Standard                     | Application                              |
| ------------------- | ---------------------------- | ---------------------------------------- |
| WCAG 2.1 AA         | Minimum for all screens      | Talent discovery, applications, profiles |
| Body text minimum   | 16px (never below)           | All hiring content                       |
| Touch targets       | 44×44px minimum              | Apply, shortlist, message actions        |
| Keyboard navigation | 100% of interactions         | Candidate search, pipeline management    |
| Screen reader       | All hiring content announced | Profiles, job descriptions, applications |
| Reduced motion      | All animations disabled      | Respect prefers-reduced-motion           |
| Color alone         | Never solely conveys meaning | Application status includes text         |

---

## Motion

| Animation                 | Duration | Easing   | Notes                            |
| ------------------------- | -------- | -------- | -------------------------------- |
| Candidate card entry      | 300ms    | ease-out | translateY(24px→0), stagger 50ms |
| Pipeline stage transition | 400ms    | ease-out | Card moves between stages        |
| Profile expand            | 250ms    | ease-out | Height transition, content fade  |
| Application submission    | 300ms    | ease-out | Success confirmation animation   |
| Reduced motion            | All 0ms  | —        | prefers-reduced-motion respected |

---

## Cross-References

| Reference     | Relationship                                         |
| ------------- | ---------------------------------------------------- |
| DES-001 v1.0  | Design Constitution — visual foundation              |
| DES-001A v1.0 | Design System Consistency — component patterns       |
| DES-002 v1.0  | Onboarding — career goals, hiring preferences        |
| DES-002A v1.0 | Onboarding Refinement — hiring introduction          |
| DES-003 v1.0  | Dashboard — active hiring on dashboard               |
| DES-003A v1.1 | Dashboard Refinement — hiring module                 |
| DES-004 v1.0  | Memory & Knowledge — candidate portfolio evidence    |
| DES-005 v1.0  | AI Mentor — hiring assistance mode                   |
| DES-006 v1.0  | Career — job matching, career progression            |
| DES-007 v1.0  | Learning — skill verification for candidates         |
| DES-009/D00   | Marketplace Constitution — hiring rules, trust model |
| DES-009/D02   | Marketplace Dashboard — hiring status display        |
| DES-009/D08   | Freelancing — contract-to-hire pathways              |
| DES-009/D10   | AI Marketplace Coach — hiring recommendations        |
| DES-009/D11   | Trust and Reputation — candidate trust signals       |
| PRD-001       | Product Vision — hiring in opportunity ecosystem     |
| PRD-002       | User DNA — career goals, hiring preferences          |
| ARC-003       | Knowledge Graph — skill matching for hiring          |
| ARC-005       | AI Orchestration — hiring assistant pipeline         |
| ENG-001       | Domain Model — Job, Candidate, Application entities  |
| RSH-001       | Research — evidence-first hiring effectiveness       |

### Relationship Summary

| Reference   | How D07 Depends On It                                  |
| ----------- | ------------------------------------------------------ |
| DES-001     | All visual properties applied to hiring screens        |
| DES-004     | Portfolio evidence from Memory & Knowledge             |
| DES-005     | AI Mentor persona used for hiring assistance           |
| DES-006     | Career data informs job matching                       |
| DES-007     | Learning achievements verify candidate skills          |
| DES-009/D00 | Constitution governs hiring rules and trust            |
| DES-009/D11 | Candidate trust verification uses reputation system    |
| ARC-003     | Knowledge Graph enables skill-based candidate matching |
| ARC-005     | AI pipeline powers hiring recommendations              |

---

## Future Scalability

| Capability                       | Horizon   | Impact                           |
| -------------------------------- | --------- | -------------------------------- |
| AI-assisted resume parsing       | 3 months  | Reduces manual screening effort  |
| Predictive hiring success models | 6 months  | Data-driven candidate evaluation |
| Diversity hiring analytics       | 6 months  | Fair hiring metrics and insights |
| Automated skill assessments      | 3 months  | In-platform skill verification   |
| Video interview integration      | 6 months  | End-to-end hiring workflow       |
| Enterprise hiring dashboard      | 12 months | B2B hiring solutions             |

---

## Implementation Complexity

| Component               | Complexity  | Key Dependencies                     |
| ----------------------- | ----------- | ------------------------------------ |
| Talent Discovery        | Medium-High | ARC-003, ARC-005, Trust Score        |
| Evidence-First Profiles | Medium      | DES-004, Skill Verification          |
| Hiring Workflow         | Medium      | Application service, notifications   |
| Portfolio Discovery     | Medium      | Portfolio service, search index      |
| AI Hiring Assistant     | High        | ARC-005, Bias Detection              |
| Interview Readiness     | Medium      | Learning service, prep materials     |
| Hiring Analytics        | Medium      | Analytics pipeline, data aggregation |
| Company Insights        | Medium      | Company data service, market data    |
| Role Matching           | Medium      | ARC-003, skill matching service      |

---

## 6. Interview Readiness (Major Experience Section)

Candidates prepare for interviews through AI-powered practice, skill gap analysis, and personalized preparation plans.

### Quality Review

| Dimension                     | Assessment                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Why**                       | Interview preparation is the highest-leverage hiring activity — preparation directly improves outcomes |
| **Marketplace Reasoning**     | Prepared candidates have higher placement rates; interview readiness reduces time-to-hire              |
| **Psychological Reasoning**   | Preparation reduces anxiety and improves performance; practice builds self-efficacy                    |
| **Accessibility Impact**      | Interview prep materials are text-based and screen reader accessible; no time pressure                 |
| **Trust Impact**              | Honest skill assessment (identifying gaps, not just strengths) builds trust                            |
| **Implementation Complexity** | Medium — requires learning service integration, question bank, and practice modes                      |
| **Future Scalability**        | Can add AI mock interviews, industry-specific question banks, behavioral analysis                      |

---

## 7. Hiring Analytics & Recommendations (Major Experience Section)

Employers and candidates receive data-driven insights on hiring trends, role demand, salary benchmarks, and personalized recommendations.

| Analytics Type             | Data Sources                                                              | Visualization                 | Update Cadence |
| -------------------------- | ------------------------------------------------------------------------- | ----------------------------- | -------------- |
| **Hiring Analytics**       | Application volume, time-to-hire, source quality, offer acceptance rate   | Trend charts, funnel analysis | Weekly         |
| **Hiring Recommendations** | Role fit scores, candidate pipeline suggestions, market demand signals    | Card-based recommendations    | Daily          |
| **Company Insights**       | Company trust score, hiring history, role demand, compensation benchmarks | Profile dashboard             | Real-time      |
| **Role Matching**          | Skill alignment, experience fit, cultural indicators, availability        | Match percentage + breakdown  | Per search     |

### Quality Review

| Dimension                     | Assessment                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| **Why**                       | Data-driven hiring decisions improve outcomes for both employers and candidates               |
| **Marketplace Reasoning**     | Analytics increase platform value; recommendations improve match quality                      |
| **Psychological Reasoning**   | Data-backed decisions feel more objective and fair; insights reduce uncertainty               |
| **Accessibility Impact**      | Analytics are available as text summaries and accessible data tables                          |
| **Trust Impact**              | Transparent, unbiased analytics build trust; manipulated data would destroy credibility       |
| **Implementation Complexity** | Medium-High — requires analytics pipeline, market data integration, and recommendation engine |
| **Future Scalability**        | Can add predictive hiring trends, diversity analytics, salary benchmarking                    |

---

## Future Scalability Status

**DES-009-D07: Hiring & Talent — LOCKED effective July 27, 2026.**

All hiring and talent design decisions are finalized. No further changes without formal Design Review.
