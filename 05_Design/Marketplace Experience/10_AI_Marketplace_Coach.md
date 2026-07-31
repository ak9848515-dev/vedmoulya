# AI Marketplace Coach

> **Document:** DES-009-D10 — Marketplace & Opportunity Ecosystem  
> **Status:** 🔒 **LOCKED** — Part of DES-009 Marketplace Constitution v1.1

---

## Purpose

The AI Marketplace Coach is the user's trusted guide through the entire marketplace — evaluating opportunities, reviewing proposals, detecting risks, preparing negotiations, and providing strategic recommendations across mentorship, hiring, freelancing, and partnerships.

---

## Vision

Create the most trusted AI coach in any marketplace — one that never fabricates opportunity quality, always distinguishes between facts and suggestions, and empowers users to make informed decisions with confidence.

---

## Design Constitution Compliance

| Property        | Standard                             | Source       |
| --------------- | ------------------------------------ | ------------ |
| Page Background | `#F5F7FA` (Warm Matte Light)         | DES-001 v1.0 |
| Cards           | `#FFFFFF` with border `#E8EDF5`      | DES-001 v1.0 |
| AI Color        | `#7C3AED` (Violet-purple)            | DES-001 v1.0 |
| Headings        | Satoshi                              | DES-001 v1.0 |
| Body            | Inter (never below 16px)             | DES-001 v1.0 |
| Card Radius     | 24px                                 | DES-001 v1.0 |
| Motion          | 200-300ms, ease-out                  | DES-001 v1.0 |
| AI Persona      | Wise Mentor (Marketplace Coach mode) | DES-005 v1.0 |

---

## Architecture References

| Reference | Relationship                                                               |
| --------- | -------------------------------------------------------------------------- |
| ARC-005   | AI Orchestration — coach pipeline, context assembly, response validation   |
| ARC-003   | Knowledge Graph — opportunity context, skill matching data                 |
| ARC-004   | Execution Intelligence — collaboration history, outcome data               |
| ENG-003   | AI Development Guidelines — coach ethics, source distinction, transparency |

---

## Information Hierarchy

```
P0 — ALWAYS VISIBLE:
  • Coach avatar (idle/available state)
  • Active suggestion (if applicable)
  • Confidence indicator

P1 — SHOWN BY DEFAULT:
  • Opportunity evaluation summary
  • Risk flags (if any)
  • Coach recommendation

P2 — CONTEXTUAL:
  • Detailed opportunity analysis
  • Proposal review with feedback
  • Negotiation preparation
  • Strategy session

P3 — ON DEMAND:
  • Full coach conversation history
  • Market insights and trends
  • Coach settings
```

---

## Specification Consistency

| Standard               | Reference             | Application                                                |
| ---------------------- | --------------------- | ---------------------------------------------------------- |
| Typography             | DES-001/D04           | Headings: Satoshi, Body: Inter (never below 16px)          |
| Spacing                | DES-001/D06           | 4px base unit, space-4 (16px) standard gap                 |
| Motion                 | DES-001/D09           | 200-300ms, ease-out, AI thinking dots at 300ms cycle       |
| Accessibility          | DES-001/D10           | WCAG 2.1 AA, AI content labeled with aria-live regions     |
| Color Hierarchy        | DES-001/D03           | AI purple #7C3AED for all coach output                     |
| Component Language     | DES-001/D07           | Coach card at 24px radius, chat input at 16px radius       |
| AI Personality         | DES-001/D11 + DES-005 | Wise Mentor — calm, transparent, never robotic             |
| Interaction Principles | DES-001/D11           | Purposeful, calm, consistent across all coach interactions |

---

## 1. Opportunity Evaluation (Major Experience Section)

The Coach analyzes opportunities for fit, value, risks, and alignment with user goals — with clear confidence levels and source distinction.

```
┌────────────────────────────────────────────────────────┐
│  🤖 AI Marketplace Coach                               │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  📊 Opportunity Evaluation                      │   │
│  │  "ML Consultant for HealthTech Startup"         │   │
│  │                                                  │   │
│  │  Fit: 92% (High confidence)                     │   │
│  │  ✅ Skills match (Python, ML — verified)        │   │
│  │  ✅ Rate aligns with market ($120-150/hr)       │   │
│  │  ⚠️ Timeline may be tight (3 weeks to MVP)      │   │
│  │                                                  │   │
│  │  Sources:                                        │   │
│  │  • Facts: Skills from verified assessments      │   │
│  │  • Evidence: Past projects in ML consulting     │   │
│  │  • Inference: Timeline based on scope           │   │
│  │  • Suggestion: Start with discovery phase       │   │
│  └─────────────────────────────────────────────────┘   │
│  [Talk to Coach]  [Why this?]  [Confidence: ●●●●○]    │
└──────────────────────────────────────────────────────────┘
```

### Quality Review

| Dimension                     | Assessment                                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Why**                       | Users need unbiased, transparent evaluation of opportunities to make informed decisions                                   |
| **Marketplace Reasoning**     | Quality evaluations increase user confidence and conversion; risk detection prevents bad experiences                      |
| **Psychological Reasoning**   | Anchoring — coach evaluation provides reference point; uncertainty reduction — clear analysis reduces decision anxiety    |
| **Accessibility Impact**      | Evaluations are text-based with structured formatting; confidence indicators include text labels, not just visual         |
| **Trust Impact**              | This is the highest-trust interaction — source distinction (facts vs. evidence vs. inference vs. suggestion) is mandatory |
| **Implementation Complexity** | High — requires ARC-005 pipeline, context assembly, and rigorous response validation                                      |
| **Future Scalability**        | Coach becomes more nuanced as user history grows; can predict opportunity outcomes                                        |

---

## 2. Proposal Review & Enhancement (Major Experience Section)

The Coach reviews user proposals for clarity, honesty, completeness, and competitiveness — without fabricating content.

### Quality Review

| Dimension                     | Assessment                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Why**                       | Proposal quality directly determines match success; AI assistance should improve proposals without dishonesty                  |
| **Marketplace Reasoning**     | Better proposals = higher conversion = healthier marketplace; coaching levels the playing field                                |
| **Psychological Reasoning**   | Writing apprehension — AI reduces anxiety about expressing value; objective feedback improves self-assessment                  |
| **Accessibility Impact**      | Review feedback is text-based with clear issue indicators; no time pressure                                                    |
| **Trust Impact**              | Coach enforces honesty — flags exaggerations, never suggests fabricating experience; proposal transparency builds client trust |
| **Implementation Complexity** | Medium — requires ARC-005, natural language processing, and ethics guardrails                                                  |
| **Future Scalability**        | Can add competitive analysis, pricing optimization, client-specific customization                                              |

---

## 3. Risk Detection & Scam Protection (Major Experience Section)

The Coach proactively flags suspicious opportunities, unrealistic expectations, and potential scams with specific reasoning.

### Quality Review

| Dimension                     | Assessment                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Why**                       | Trust and safety are marketplace prerequisites; proactive risk detection protects both sides                       |
| **Marketplace Reasoning**     | Fewer scams = higher trust = more transactions; risk detection differentiates from competitor platforms            |
| **Psychological Reasoning**   | Risk aversion — users avoid platforms with known scams; safety signaling — visible protection increases engagement |
| **Accessibility Impact**      | Risk flags include clear text warnings, never rely on color alone; explanations provided for each flag             |
| **Trust Impact**              | This feature directly builds ecosystem trust — must be accurate, never false-flag legitimate opportunities         |
| **Implementation Complexity** | High — requires scam detection models, pattern recognition, and human review escalation                            |
| **Future Scalability**        | ML models continuously improve; network-wide scam pattern detection; user-reported flagging integration            |

---

## 4. Weekly Opportunity Review (Previously Uncovered Item)

The Coach curates a weekly review of the best-matched opportunities, collaboration updates, and marketplace insights.

### Quality Review

| Dimension                     | Assessment                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Why**                       | Weekly reviews build habit, reduce missed opportunities, and provide regular value touchpoints                |
| **Marketplace Reasoning**     | Regular engagement touchpoints increase retention; curated reviews reduce user effort                         |
| **Psychological Reasoning**   | Habit formation — weekly cadence builds routine; anticipation — scheduled reviews create positive expectation |
| **Accessibility Impact**      | Weekly review content is available in-app and via email; screen reader friendly format                        |
| **Trust Impact**              | Honest curation (including when no good matches exist) builds trust over promotional curation                 |
| **Implementation Complexity** | Medium — requires weekly aggregation, personalization, and multi-channel delivery (in-app + notification)     |
| **Future Scalability**        | Can add AI-generated summaries, trend insights, personalized action items                                     |

---

## 5. Monthly Marketplace Report (Previously Uncovered Item)

The Coach provides a comprehensive monthly report covering marketplace activity, earnings, skills growth, and trends.

### Quality Review

| Dimension                     | Assessment                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Why**                       | Monthly reporting provides strategic value, tracks progress, and identifies growth opportunities                   |
| **Marketplace Reasoning**     | Data-driven insights increase perceived value; progress visibility motivates continued engagement                  |
| **Psychological Reasoning**   | Feedback loop — seeing progress reinforces behavior; planning effect — insights drive future actions               |
| **Accessibility Impact**      | Report data is available in multiple formats (text summary, structured data, visual charts with text alternatives) |
| **Trust Impact**              | Transparent, accurate reporting builds long-term trust; honest trend analysis over promotional framing             |
| **Implementation Complexity** | Medium — requires analytics aggregation, insight generation, and personalized reporting                            |
| **Future Scalability**        | Can add predictive trends, benchmark comparisons, AI-suggested growth strategies                                   |

---

## 6. Negotiation Preparation (Major Experience Section)

The Coach helps users prepare for negotiations — rate discussions, scope adjustments, timeline expectations.

### Quality Review

| Dimension                     | Assessment                                                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Why**                       | Negotiation is one of the most anxiety-inducing marketplace interactions; preparation reduces stress and improves outcomes |
| **Marketplace Reasoning**     | Better negotiation outcomes = higher satisfaction = repeat engagement                                                      |
| **Psychological Reasoning**   | Preparation reduces anxiety; anchoring — entering with data-backed positions improves outcomes                             |
| **Accessibility Impact**      | Preparation materials are text-based with no time pressure; multiple practice formats                                      |
| **Trust Impact**              | Coach recommends fair, honest negotiations — never manipulative tactics; transparency about market rates                   |
| **Implementation Complexity** | Medium — requires market data, negotiation patterns, and communication coaching                                            |
| **Future Scalability**        | Can add role-play practice, AI-simulated negotiation, outcome prediction                                                   |

---

## Source Distinction Rules (LOCKED)

The Coach must ALWAYS distinguish the following when making any recommendation or analysis:

| Source          | Description                                    | Label          | Example                                                              |
| --------------- | ---------------------------------------------- | -------------- | -------------------------------------------------------------------- |
| **Facts**       | Verified, objective information about the user | ✅ Fact        | "Your skills include Python (Expert) — verified by assessment"       |
| **Evidence**    | Past data that supports a conclusion           | 📊 Evidence    | "You completed 3 similar projects with 95% satisfaction"             |
| **Inference**   | Reasonable deduction from available data       | 🔍 Inference   | "Based on your rate history, you typically charge $100-150/hr"       |
| **Suggestion**  | Coach's recommendation                         | 💡 Suggestion  | "I suggest highlighting your healthcare ML experience for this role" |
| **Uncertainty** | Low confidence or unknown information          | ❓ Uncertainty | "I'm not certain this timeline is realistic — let's discuss further" |

---

## Personalization

| Dimension           | Application to AI Marketplace Coach                  |
| ------------------- | ---------------------------------------------------- |
| Career Goals        | Coach advice tailored to career stage                |
| User DNA            | Coach tone adapts to user's communication style      |
| Learning Progress   | Coach references recent learning achievements        |
| Skills              | Opportunity recommendations based on verified skills |
| Risk Tolerance      | Risk communication adjusted to tolerance level       |
| Past Collaborations | Coach references past outcomes in recommendations    |

---

## Accessibility

| Requirement         | Standard                       | Application                                      |
| ------------------- | ------------------------------ | ------------------------------------------------ |
| WCAG 2.1 AA         | Minimum for all screens        | Coach conversations, evaluations                 |
| Body text minimum   | 16px (never below)             | All coach messages                               |
| Touch targets       | 44×44px minimum                | Coach interaction buttons                        |
| Keyboard navigation | 100% of interactions           | Coaching interface                               |
| Screen reader       | Live region for streaming text | Coach responses announced                        |
| Reduced motion      | All animations disabled        | Respect prefers-reduced-motion                   |
| AI labeling         | Always identify AI content     | Coach messages use purple border + "Coach" label |

---

## Motion

| Animation            | Duration    | Easing   | Notes                            |
| -------------------- | ----------- | -------- | -------------------------------- |
| Coach thinking       | 300ms cycle | ease-out | Three dots, purple glow          |
| Message streaming    | ~50ms/word  | linear   | Text appears naturally           |
| Evaluation reveal    | 400ms       | ease-out | Staggered section appearance     |
| Risk flag appearance | 250ms       | ease-out | Warning animation                |
| Report generation    | 600ms       | ease-out | Data visualization builds        |
| Reduced motion       | All 0ms     | —        | prefers-reduced-motion respected |

---

## Cross-References

| Reference     | Relationship                                                         |
| ------------- | -------------------------------------------------------------------- |
| DES-001 v1.0  | Design Constitution — visual foundation                              |
| DES-001A v1.0 | Design System Consistency — coach component patterns                 |
| DES-002A v1.0 | Onboarding Refinement — AI Mentor introduction                       |
| DES-003A v1.1 | Dashboard Refinement — Coach card on dashboard                       |
| DES-004 v1.0  | Memory & Knowledge — coach memory context                            |
| DES-005 v1.0  | AI Mentor — coach persona, conversation framework                    |
| DES-009/D00   | Marketplace Constitution — coach rules, source distinction           |
| DES-009/D02   | Marketplace Dashboard — Coach card display                           |
| DES-009/D03   | Opportunity Discovery — coach evaluation of opportunities            |
| DES-009/D05   | Project Collaboration — coach collaboration advice                   |
| DES-009/D06   | Mentorship — coach mentorship recommendations                        |
| DES-009/D07   | Hiring — coach hiring advice                                         |
| DES-009/D08   | Freelancing — coach freelancing strategy                             |
| DES-009/D09   | Partner Ecosystem — coach partnership evaluation                     |
| DES-009/D11   | Trust and Reputation — coach trust signals                           |
| DES-009/D12   | Marketplace Insights — coach weekly/monthly reports                  |
| PRD-001       | Product Vision — AI-powered marketplace                              |
| PRD-002       | User DNA — personalization for coach                                 |
| ARC-001       | System Architecture — coach module integration                       |
| ARC-002       | Information Architecture — coach data flow                           |
| ARC-003       | Knowledge Graph — opportunity context, skill matching data           |
| ARC-004       | Execution Intelligence — collaboration history, outcome data         |
| ARC-005       | AI Orchestration — coach pipeline, context assembly                  |
| ENG-001       | Domain Model — Coach, Evaluation, Recommendation entities            |
| ENG-002       | Implementation Standards — coach interaction patterns                |
| ENG-003       | AI Development Guidelines — ethics, transparency, source distinction |
| ENG-004       | Testing Standards — coach response validation                        |
| RSH-001       | Research — AI coaching effectiveness, user trust                     |
| CMP-001       | Competition — AI marketplace coach differentiation                   |

### Relationship Summary

| Reference   | How D10 Depends On It                                                   |
| ----------- | ----------------------------------------------------------------------- |
| DES-001     | All visual properties applied to coach interface                        |
| DES-001A    | Component patterns for coach cards, chat, and evaluations               |
| DES-002     | Onboarding introduces AI Mentor to users                                |
| DES-002A    | Refined onboarding includes AI Mentor introduction                      |
| DES-003     | Dashboard hosts Coach card presence                                     |
| DES-003A    | Refined dashboard surfaces Coach in right rail                          |
| DES-004     | Coach memory context from Memory & Knowledge                            |
| DES-005     | Coach persona, conversation framework, and ethical rules from AI Mentor |
| DES-006     | Career data informs coach career advice                                 |
| DES-007     | Learning data informs coach skill recommendations                       |
| DES-008     | Business data informs coach business advice                             |
| DES-009/D00 | Constitution governs coach rules, source distinction, personalization   |
| DES-009/D02 | Coach card presence on marketplace dashboard                            |
| DES-009/D03 | Coach evaluates opportunities from discovery feed                       |
| DES-009/D04 | Coach reviews service proposals                                         |
| DES-009/D05 | Coach provides collaboration advice                                     |
| DES-009/D06 | Coach makes mentorship recommendations                                  |
| DES-009/D07 | Coach provides hiring advice and candidate evaluation                   |
| DES-009/D08 | Coach provides freelancing strategy and pricing guidance                |
| DES-009/D09 | Coach evaluates partnership opportunities                               |
| DES-009/D11 | Coach references trust signals in recommendations                       |
| DES-009/D12 | Coach generates weekly/monthly insight reports                          |
| PRD-001     | Product vision defines AI-powered marketplace                           |
| PRD-002     | User DNA personalizes coach tone and recommendations                    |
| ARC-001     | Architecture enables coach module integration                           |
| ARC-002     | Data flow design supports coach context assembly                        |
| ARC-003     | Knowledge Graph provides opportunity matching context                   |
| ARC-004     | Execution intelligence provides collaboration history                   |
| ARC-005     | AI Orchestration powers coach pipeline and response validation          |
| ENG-001     | Domain entities define coach data model                                 |
| ENG-002     | Implementation patterns define coach interaction standards              |
| ENG-003     | AI ethics govern coach behavior, transparency, and safety               |
| ENG-004     | Testing validates coach response accuracy and safety                    |
| RSH-001     | Research informs coach effectiveness and user trust                     |
| CMP-001     | Competitive analysis differentiates coach from alternatives             |

---

## 7. Mentorship & Hiring Coach Modes (Major Experience Section)

The Coach provides mode-specific advice for mentorship recommendations, hiring strategy, freelancing guidance, partnership evaluation, and relationship health monitoring.

| Coach Mode                    | Purpose                                                      | Context Used                                         | Output                                      |
| ----------------------------- | ------------------------------------------------------------ | ---------------------------------------------------- | ------------------------------------------- |
| **Mentorship Coach**          | Recommends mentors based on goals and learning style         | Career goals, skill gaps, learning preferences       | Mentor fit score, session suggestions       |
| **Hiring Coach**              | Helps employers evaluate candidates and candidates prepare   | Job requirements, candidate skills, market data      | Candidate fit analysis, interview prep tips |
| **Freelancing Coach**         | Advises on project selection, pricing, and client management | Skill profile, rate history, past projects           | Project fit score, pricing benchmarks       |
| **Partnership Coach**         | Evaluates potential partners and recommends collaborations   | Business stage, complementary capabilities           | Partner fit score, collaboration models     |
| **Relationship Health Coach** | Monitors active collaborations and flags risks               | Communication patterns, milestone progress, feedback | Health score, intervention recommendations  |

### Quality Review

| Dimension                     | Assessment                                                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Why**                       | Different marketplace activities require specialized coaching — one-size-fits-all advice undermines trust            |
| **Marketplace Reasoning**     | Specialized coach modes increase relevance and engagement across all marketplace areas                               |
| **Psychological Reasoning**   | Framing — mode-specific advice is perceived as more credible; specificity increases trust in recommendations         |
| **Accessibility Impact**      | Each coach mode is clearly labeled and accessible via keyboard navigation; mode switch announced by screen reader    |
| **Trust Impact**              | Mode-specific transparency ("As your hiring coach...") builds role-specific trust; AI never exceeds its mode's scope |
| **Implementation Complexity** | High — requires multiple coach mode pipelines, context assembly per mode, and mode-specific response validation      |
| **Future Scalability**        | Can add new modes (Wellness Coach, Finance Coach) as new marketplace areas emerge                                    |

---

## Future Scalability

| Capability                       | Horizon   | Impact                                         |
| -------------------------------- | --------- | ---------------------------------------------- |
| Proactive opportunity suggestion | 3 months  | Coach finds opportunities before user searches |
| Multi-language coaching          | 6 months  | Global marketplace accessibility               |
| Voice interaction                | 6 months  | Hands-free coaching                            |
| Predictive outcome modeling      | 6 months  | "If you apply, you have X% chance"             |
| Coach collaboration (team coach) | 12 months | Multi-party negotiation mediation              |

---

## Implementation Complexity

| Component               | Complexity | Key Dependencies                       |
| ----------------------- | ---------- | -------------------------------------- |
| Opportunity Evaluation  | High       | ARC-005, ARC-003, PRD-002              |
| Proposal Review         | Medium     | ARC-005, Ethics Guardrails             |
| Risk Detection          | High       | Scam detection ML models               |
| Weekly Review           | Medium     | Aggregation service, notifications     |
| Monthly Report          | Medium     | Analytics pipeline, insight generation |
| Negotiation Preparation | Medium     | Market data, communication models      |

---

## Design Freeze Status

**DES-009-D10: AI Marketplace Coach — LOCKED effective July 27, 2026.**

All AI Marketplace Coach design decisions are finalized. No further changes without formal Design Review.
