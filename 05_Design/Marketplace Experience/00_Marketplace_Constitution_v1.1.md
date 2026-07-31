# VedMoulya Marketplace Constitution v1.1

> **Document:** The Final, Locked Specification for the Marketplace Experience  
> **Mission:** DES-009 — Marketplace & Opportunity Ecosystem Experience  
> **Status:** 🔒 **LOCKED**  
> **Version:** 1.1.0  
> **Date:** July 27, 2026  
> **Owner:** Chief Product Officer (CPO)  
> **Approval:** CPO + CDO

---

## Preamble

This Constitution establishes the Marketplace Experience for VedMoulya — a trusted opportunity ecosystem where users discover, create, exchange, and grow opportunities throughout their personal and professional journey.

---

## 1. Design Constitution Compliance

| Property        | Standard                                 | Source       |
| --------------- | ---------------------------------------- | ------------ |
| Page Background | `#F5F7FA` (Warm Matte Light)             | DES-001 v1.0 |
| Cards           | `#FFFFFF` with border `#E8EDF5`          | DES-001 v1.0 |
| Primary Color   | `#2B5FD9` (Deep Calm Blue)               | DES-001 v1.0 |
| Premium Gold    | `#C89B3C` (limited — trusted milestones) | DES-001 v1.0 |
| Headings        | Satoshi                                  | DES-001 v1.0 |
| Body            | Inter (never below 16px)                 | DES-001 v1.0 |
| Card Radius     | 24px                                     | DES-001 v1.0 |
| Motion          | 200-300ms, ease-out                      | DES-001 v1.0 |
| AI Persona      | Wise Mentor (Marketplace Coach mode)     | DES-005 v1.0 |

---

## 2. Architecture References

| Reference     | Relationship                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| DES-001 v1.0  | Design Constitution — visual foundation, colors, typography, spacing, motion, accessibility, components, interaction principles |
| DES-001A v1.0 | Design System Consistency — all design standards                                                                                |
| DES-002 v1.0  | Onboarding — marketplace introduction during purpose selection                                                                  |
| DES-002A v1.0 | Onboarding Refinement — marketplace introduction, Explore First                                                                 |
| DES-003 v1.0  | Dashboard — Marketplace section on main dashboard                                                                               |
| DES-003A v1.1 | Dashboard Refinement — Marketplace section, module cards                                                                        |
| DES-004 v1.0  | Memory & Knowledge — reputation, portfolio evidence, Knowledge Garden                                                           |
| DES-005 v1.0  | AI Mentor — Marketplace Coach mode, AI persona                                                                                  |
| DES-006 v1.0  | Career — freelance, hiring, talent opportunities                                                                                |
| DES-007 v1.0  | Learning — knowledge exchange, skill verification                                                                               |
| DES-008 v1.0  | Business — service offerings, collaborations                                                                                    |
| PRD-001       | Product Vision — Marketplace as opportunity ecosystem                                                                           |
| PRD-002       | User DNA — marketplace preferences, risk tolerance                                                                              |
| ARC-001       | System Architecture — Marketplace module                                                                                        |
| ARC-002       | Information Architecture — opportunity data flow                                                                                |
| ARC-003       | Knowledge Graph — skill connections, opportunity matching                                                                       |
| ARC-004       | Execution Intelligence — collaboration execution                                                                                |
| ARC-005       | AI Orchestration — Marketplace Coach pipeline                                                                                   |
| ENG-001       | Domain Model — Marketplace entities                                                                                             |
| ENG-002       | Implementation Standards — Marketplace patterns                                                                                 |
| ENG-003       | AI Development Guidelines — Marketplace AI ethics                                                                               |
| ENG-004       | Testing Standards — Marketplace validation                                                                                      |
| RSH-001       | Research — marketplace trust models                                                                                             |
| CMP-001       | Competition — marketplace landscape analysis                                                                                    |

### Relationship Summary

| Reference | How DES-009 Depends On It                                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| DES-001   | All visual properties (colors, typography, spacing, motion, accessibility, components) are sourced from the Design Constitution |
| DES-001A  | Design system patterns and component library used by all marketplace screens                                                    |
| DES-002   | Onboarding introduces marketplace purpose; user selects marketplace-related goals                                               |
| DES-002A  | "Explore First" mode includes marketplace preview; refined onboarding flows                                                     |
| DES-003   | Dashboard contains Marketplace module card showing active engagements                                                           |
| DES-003A  | Refined dashboard displays "Today's Best Opportunity", trust snapshot, marketplace section                                      |
| DES-004   | Reputation and portfolio evidence from Memory & Knowledge feed marketplace trust                                                |
| DES-005   | AI Mentor provides the Marketplace Coach persona and conversation framework                                                     |
| DES-006   | Career opportunities (freelance, hiring) appear in marketplace discovery                                                        |
| DES-007   | Learning achievements verify skills shown in marketplace profiles                                                               |
| DES-008   | Business service offerings and collaborations extend marketplace capabilities                                                   |
| PRD-001   | Product vision defines marketplace as opportunity ecosystem                                                                     |
| PRD-002   | User DNA provides marketplace preferences, risk tolerance, career goals                                                         |
| ARC-001   | System architecture provides marketplace module structure                                                                       |
| ARC-002   | Information architecture defines opportunity data flow and categorization                                                       |
| ARC-003   | Knowledge Graph enables skill-opportunity matching and trust verification                                                       |
| ARC-004   | Execution intelligence tracks collaboration progress and outcomes                                                               |
| ARC-005   | AI Orchestration powers the Marketplace Coach pipeline and response validation                                                  |
| ENG-001   | Domain model defines Marketplace entities (Opportunity, Service, Collaboration)                                                 |
| ENG-002   | Implementation standards define marketplace interaction patterns                                                                |
| ENG-003   | AI development guidelines govern marketplace coach ethics and boundaries                                                        |
| ENG-004   | Testing standards validate marketplace functionality, trust model, and UX                                                       |
| RSH-001   | Research findings inform trust model, reputation system, and marketplace dynamics                                               |
| CMP-001   | Competitive analysis differentiates marketplace from Fiverr, Upwork, LinkedIn                                                   |

---

## 3. Personalization Framework (LOCKED — v1.1)

Marketplace personalization tailors every opportunity, recommendation, and collaboration match to the individual user. Personalization never overrides user control — the user always has final authority over their choices.

### 13 Personalization Dimensions

#### 1. Career Goals

| Aspect                         | Detail                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| **Purpose**                    | Align opportunity recommendations with the user's career trajectory and aspirations                                |
| **Influence**                  | Filters opportunities by career stage (student, fresher, professional, switcher, leader, freelancer, entrepreneur) |
| **Affected Marketplace Areas** | Opportunity Feed, Service Discovery, Collaboration Matching, AI Coach Recommendations                              |
| **Priority**                   | P0 — Critical (highest influence on match quality)                                                                 |
| **Update Source**              | Career Constitution (DES-006), User Career Profile, Goal Tracking                                                  |
| **Privacy Notes**              | Career goals are PERSONAL data; shared only within marketplace matching context                                    |

#### 2. Business Goals

| Aspect                         | Detail                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| **Purpose**                    | Surface opportunities that support the user's business-building journey             |
| **Influence**                  | Prioritizes business collaboration, service requests, and partnership opportunities |
| **Affected Marketplace Areas** | Opportunity Feed, Service Marketplace, Project Collaboration, Coach Recommendations |
| **Priority**                   | P0 — Critical                                                                       |
| **Update Source**              | Business Constitution (DES-008), Business Stage, Active Ventures                    |
| **Privacy Notes**              | Business goals are PERSONAL; visible only to collaborators after match              |

#### 3. Learning Progress

| Aspect                         | Detail                                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| **Purpose**                    | Match opportunities that validate and apply recently acquired skills                                 |
| **Influence**                  | Prioritizes opportunities requiring skills the user is currently developing or has recently mastered |
| **Affected Marketplace Areas** | Opportunity Feed, Skill Matching, Trust Score Enhancement                                            |
| **Priority**                   | P1 — High                                                                                            |
| **Update Source**              | Learning Constitution (DES-007), Knowledge Graph skill levels, Course completions                    |
| **Privacy Notes**              | Learning progress is PERSONAL; only verified skills are shared in marketplace profiles               |

#### 4. User DNA

| Aspect                         | Detail                                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| **Purpose**                    | Align marketplace experience with user's innate preferences, working style, and personality           |
| **Influence**                  | Adjusts communication style, collaboration preferences, risk presentation, and recommendation density |
| **Affected Marketplace Areas** | AI Coach Tone, Opportunity Presentation, Collaboration Recommendations, Trust Display                 |
| **Priority**                   | P1 — High                                                                                             |
| **Update Source**              | User DNA Assessment (PRD-002), Onboarding Discovery                                                   |
| **Privacy Notes**              | DNA is SENSITIVE data; never shared with other marketplace participants                               |

#### 5. Knowledge Graph

| Aspect                         | Detail                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| **Purpose**                    | Leverage the user's knowledge connections to find opportunities that match demonstrated expertise |
| **Influence**                  | Matches opportunities based on verified knowledge nodes, not just self-reported skills            |
| **Affected Marketplace Areas** | Opportunity Matching, Trust Verification, Skill Endorsements, Portfolio Evidence                  |
| **Priority**                   | P1 — High                                                                                         |
| **Update Source**              | Knowledge Graph (ARC-003), Memory & Knowledge (DES-004), Knowledge Garden                         |
| **Privacy Notes**              | Knowledge Graph connections are PERSONAL; only verified expertise nodes are shared                |

#### 6. Portfolio

| Aspect                         | Detail                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------- |
| **Purpose**                    | Showcase completed work as evidence of capability for opportunity matching      |
| **Influence**                  | Determines eligibility for opportunities requiring demonstrated past work       |
| **Affected Marketplace Areas** | Service Profiles, Collaboration Applications, Trust Score, Opportunity Matching |
| **Priority**                   | P1 — High                                                                       |
| **Update Source**              | Memory & Knowledge (DES-004), Project Completions, User Uploads                 |
| **Privacy Notes**              | Portfolio items are shared by default but can be individually restricted        |

#### 7. Skills

| Aspect                         | Detail                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| **Purpose**                    | Match opportunities to the user's verified skill set and identify skill gaps         |
| **Influence**                  | Primary matching signal for freelance, collaboration, and service opportunities      |
| **Affected Marketplace Areas** | Opportunity Feed, Match Score Calculation, Skill Gap Analysis, Coach Recommendations |
| **Priority**                   | P0 — Critical                                                                        |
| **Update Source**              | Learning (DES-007), Career (DES-006), Skill Assessments, Project Outcomes            |
| **Privacy Notes**              | Verified skills are PUBLIC in marketplace profiles; unverified skills are private    |

#### 8. Industry

| Aspect                         | Detail                                                                            |
| ------------------------------ | --------------------------------------------------------------------------------- |
| **Purpose**                    | Filter and prioritize opportunities within the user's industry or target industry |
| **Influence**                  | Narrows discovery to relevant industry verticals, adjusts market insights         |
| **Affected Marketplace Areas** | Opportunity Feed, Market Insights, Rate Recommendations, Coach Advice             |
| **Priority**                   | P1 — High                                                                         |
| **Update Source**              | Career Profile, User DNA, Business Stage                                          |
| **Privacy Notes**              | Industry is PUBLIC in marketplace profile; target industries can be private       |

#### 9. Experience

| Aspect                         | Detail                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| **Purpose**                    | Ensure opportunities match the user's experience level (junior, mid, senior, lead) |
| **Influence**                  | Filters opportunities by required experience; adjusts coach advice depth           |
| **Affected Marketplace Areas** | Opportunity Matching, Trust Score Calibration, Coach Recommendations               |
| **Priority**                   | P1 — High                                                                          |
| **Update Source**              | Career Profile, Project History, Portfolio                                         |
| **Privacy Notes**              | Experience level is PUBLIC; detailed experience history is PERSONAL                |

#### 10. Location Preferences

| Aspect                         | Detail                                                                                  |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| **Purpose**                    | Match opportunities by geographic preference (remote, hybrid, onsite, specific regions) |
| **Influence**                  | Filters all opportunities by location; timezone awareness for collaboration             |
| **Affected Marketplace Areas** | Opportunity Feed, Service Search, Collaboration Matching, Notification Timing           |
| **Priority**                   | P2 — Medium                                                                             |
| **Update Source**              | User Profile, Active Preferences                                                        |
| **Privacy Notes**              | General location is shared; exact address is never shared                               |

#### 11. Risk Tolerance

| Aspect                         | Detail                                                                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Purpose**                    | Adjust opportunity presentation based on the user's comfort with uncertainty                                                                                        |
| **Influence**                  | Higher risk tolerance → more exploratory opportunities, equity-based collaborations, startup matches. Lower tolerance → established companies, fixed-price services |
| **Affected Marketplace Areas** | Opportunity Curation, Collaboration Types, Coach Risk Warnings, Market Insights                                                                                     |
| **Priority**                   | P2 — Medium                                                                                                                                                         |
| **Update Source**              | User DNA (PRD-002), Behavioral Signals                                                                                                                              |
| **Privacy Notes**              | Risk tolerance is SENSITIVE; never shared with other users                                                                                                          |

#### 12. Availability

| Aspect                         | Detail                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| **Purpose**                    | Only show opportunities that fit the user's time commitment capacity                |
| **Influence**                  | Filters by hours/week, project duration, urgency; prevents overcommitment           |
| **Affected Marketplace Areas** | Opportunity Feed, Application Eligibility, Collaboration Matching, Coach Scheduling |
| **Priority**                   | P1 — High                                                                           |
| **Update Source**              | User Settings, Calendar Integration, Active Commitments                             |
| **Privacy Notes**              | Availability is PERSONAL; only shared with matched collaborators                    |

#### 13. Past Collaborations

| Aspect                         | Detail                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| **Purpose**                    | Learn from past collaboration outcomes to improve future matches                                  |
| **Influence**                  | Prioritizes repeat collaboration opportunities; avoids mismatched patterns; adjusts trust signals |
| **Affected Marketplace Areas** | Trust Score, Opportunity Ranking, Coach Recommendations, Collaboration Match                      |
| **Priority**                   | P2 — Medium                                                                                       |
| **Update Source**              | Collaboration History, Project Outcomes, Feedback                                                 |
| **Privacy Notes**              | Collaboration history is PERSONAL; only aggregate trust signals are shared                        |

### Personalization Governance

| Principle           | Rule                                                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **User Control**    | Users can view, edit, or disable any personalization dimension in Marketplace Settings                                           |
| **Transparency**    | Every personalized recommendation includes "Why this?" explanation showing which dimensions influenced it                        |
| **Opt-Out**         | Users can disable personalization entirely — marketplace becomes a neutral, unfiltered browse experience                         |
| **Freshness**       | Personalization data is refreshed at most daily; real-time availability updates are user-initiated                               |
| **Bias Prevention** | Personalization must not create filter bubbles — at least 20% of recommendations should be outside the user's historical pattern |
| **Privacy**         | Personalization dimensions are classified PERSONAL or SENSITIVE per the data classification framework (ENG-003/D05)              |
| **No Manipulation** | Personalization serves user goals, not platform goals. Never uses dark patterns or addictive design                              |
| **Accessibility**   | Personalization must not reduce content discoverability for users who rely on broad exploration                                  |

---

## 4. Trust Model (LOCKED)

| Principle                   | Implementation                                                                    |
| --------------------------- | --------------------------------------------------------------------------------- |
| **Verified Skills**         | Skills validated through learning achievements, assessments, and project evidence |
| **Portfolio Evidence**      | Real projects, outcomes, and artifacts demonstrating capability                   |
| **Project Outcomes**        | Completed projects with measurable results and feedback                           |
| **Knowledge Contributions** | Contributions to Knowledge Garden boost expertise signals                         |
| **Learning Achievements**   | Courses completed, certifications earned, skills demonstrated                     |
| **Client Feedback**         | Direct feedback from past collaborations (not just anonymous ratings)             |
| **Mentor Endorsements**     | Verified mentors can endorse specific skills with evidence                        |
| **Consistency**             | Regular positive participation builds deeper trust than isolated high ratings     |

**Rules:**

- Evidence matters more than popularity
- Do NOT rely only on star ratings
- Reputation is earned through completed work, not profile optimization

---

## 5. Information Hierarchy (LOCKED)

```
P0 — ALWAYS VISIBLE:
  • Today's best opportunity
  • Active collaborations/engagements
  • Trust/reputation snapshot

P1 — SHOWN BY DEFAULT:
  • Opportunity feed (personalized)
  • Recommended opportunities
  • Service listings
  • AI Marketplace Coach presence

P2 — CONTEXTUAL:
  • Detailed opportunity view
  • Proposal/application interface
  • Trust & reputation details
  • Collaboration workspace

P3 — ON DEMAND:
  • Full marketplace history
  • Marketplace settings
  • Bookmarked opportunities
```

---

## 6. AI Marketplace Coach Rules (LOCKED)

| Capability                     | Description                                       |
| ------------------------------ | ------------------------------------------------- |
| **Evaluate opportunities**     | Analyze fit, potential value, and risks           |
| **Avoid scams**                | Flags suspicious listings with specific reasoning |
| **Prepare proposals**          | Help craft honest, compelling proposals           |
| **Improve profiles**           | Recommend portfolio gaps, skill emphasis          |
| **Prioritize opportunities**   | Rank by fit, value, and user goals                |
| **Review collaborations**      | Post-project reflection and learning              |
| **Reflect on outcomes**        | What worked? What to improve?                     |
| **Build long-term reputation** | Strategy for trust growth over time               |

**Rules:**

| Rule                           | Implementation                                                          |
| ------------------------------ | ----------------------------------------------------------------------- |
| Never fabricates opportunities | All opportunities are real or verified matches                          |
| No success promises            | Never guarantees collaboration outcomes                                 |
| Scam awareness                 | Flags suspicious opportunities with reasoning                           |
| Proposal honesty               | Helps prepare proposals without dishonesty                              |
| Source distinction             | Facts ≠ Verified evidence ≠ Assumptions ≠ Recommendations ≠ Uncertainty |

---

## 7. Success Metrics (LOCKED)

| Metric                    | Why                                   | How Measured                   |
| ------------------------- | ------------------------------------- | ------------------------------ |
| Meaningful collaborations | Value created between users           | Project completion + feedback  |
| Successful placements     | Right person found right opportunity  | Match success + retention      |
| Projects completed        | Tangible output of ecosystem          | Completed project count        |
| Clients retained          | Satisfaction leads to repeat work     | Repeat collaboration rate      |
| Mentorship outcomes       | Growth through guidance               | Mentee progress + feedback     |
| Portfolio growth          | Users building evidence of capability | Portfolio items added          |
| Verified reputation       | Trustworthy ecosystem                 | Verified skill endorsements    |
| Value created             | Economic and professional impact      | Revenue, skills, opportunities |
| Long-term relationships   | Sustainable ecosystem health          | Repeat collaboration rate      |

---

## 8. Document Ownership (LOCKED — v1.1)

The Marketplace Experience comprises the following documents:

| Document | Title                           | Status     |
| -------- | ------------------------------- | ---------- |
| D00      | Marketplace Constitution v1.1   | 🔒 LOCKED  |
| D01      | Marketplace Philosophy          | 🔒 LOCKED  |
| D02      | Marketplace Dashboard           | 🔒 LOCKED  |
| D03      | Opportunity Discovery           | 🔒 LOCKED  |
| D04      | Service Marketplace             | 🔒 LOCKED  |
| D05      | Project Collaboration           | 🔒 LOCKED  |
| D06      | Communities                     | 📝 Planned |
| D07      | Events                          | 📝 Planned |
| D08      | Portfolio Discovery             | 📝 Planned |
| D09      | Weekly Opportunity Review       | 📝 Planned |
| D10      | AI Marketplace Coach            | 📝 Planned |
| D11      | Trust and Reputation            | 📝 Planned |
| D12      | Monthly Opportunity Report      | 📝 Planned |
| D13      | Bookmarks & Saved Opportunities | 📝 Planned |
| D14      | Cross-device Continuity         | 📝 Planned |
| D15      | Marketplace Settings & Roadmap  | 📝 Planned |

---

## 9. Design Freeze

**DES-009 Version 1.1 is LOCKED effective July 27, 2026.**

**Next recommendation:** DES-010 — Health & Wellness Experience

---

## 10. Amendment History

| Version | Date       | Change                                                                                                                                           | Author | Approval  |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | --------- |
| 1.0.0   | 2026-07-27 | Initial Marketplace Constitution                                                                                                                 | CPO    | CPO + CDO |
| 1.1.0   | 2026-07-27 | Added Personalization Framework (13 dimensions), Document Ownership section, enhanced cross-references with Relationship Summary, bumped version | CPO    | CPO + CDO |
