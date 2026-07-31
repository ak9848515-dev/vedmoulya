# Marketplace Dashboard

> **Document:** DES-009-D02 — Marketplace & Opportunity Ecosystem  
> **Status:** 🔒 **LOCKED** — Part of DES-009 Marketplace Constitution v1.1

---

## Purpose

The Marketplace Dashboard shows the user's opportunity home — today's best opportunity, active collaborations, trust snapshot, and personalized recommendations.

---

## Layout

```
┌────────────────────────────────────────────────────────┐
│  Marketplace Dashboard                                  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  🎯 Today's Best Opportunity                    │   │
│  │  "ML Consultant for Startup — $5K project       │   │
│  │   Match: 92% · Your skills: Python, ML"        │   │
│  │  [View]  [Save]  [Why this?]                    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Active       │  │ Trust Score  │  │ Recommended  │  │
│  │ Collaborat.  │  │ ████████ 82% │  │ 3 new        │  │
│  │ 2 in progress│  │ [Details]    │  │ opportunities│  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  AI Marketplace Coach                           │   │
│  │  "This ML project aligns perfectly with your    │   │
│  │   career goals. Your rate is competitive."      │   │
│  │  [Talk to Coach]                                │   │
│  └─────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

## Specification Consistency

This document follows DES-001 v1.0 Design Constitution exactly:

| Standard               | Reference             | Application                                                             |
| ---------------------- | --------------------- | ----------------------------------------------------------------------- |
| Typography             | DES-001/D04           | Headings: Satoshi, Body: Inter (never below 16px)                       |
| Spacing                | DES-001/D06           | 4px base unit, space-4 (16px) standard gap, space-6 (24px) card padding |
| Motion                 | DES-001/D09           | 200-300ms, ease-out, purposeful card transitions                        |
| Accessibility          | DES-001/D10           | WCAG 2.1 AA, 4.5:1 contrast, 44×44px touch targets                      |
| Color Hierarchy        | DES-001/D03           | Primary #2B5FD9, AI #7C3AED, Success #22C55E                            |
| Component Language     | DES-001/D07           | Cards at 24px radius, buttons at 14px radius                            |
| AI Personality         | DES-001/D11 + DES-005 | Wise Mentor (Marketplace Coach mode)                                    |
| Interaction Principles | DES-001/D11           | Purposeful hover states, calm transitions, keyboard accessible          |

---

## Today's Best Opportunity (Major Experience Section)

The hero card showing the single best-matched opportunity for today, personalized by skill fit, goals, and availability.

### Quality Review

| Dimension                             | Assessment                                                                                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Why**                               | The most important information a user needs when entering marketplace — their best chance at meaningful engagement today                     |
| **Marketplace Reasoning**             | Reduces choice overload; builds habit of daily marketplace check-in; increases conversion on high-fit opportunities                          |
| **Psychological Reasoning**           | Hick's Law — fewer choices increase decision quality and satisfaction; Zeigarnik Effect — incomplete actions drive return visits             |
| **Accessibility Impact**              | Single hero card reduces cognitive load for all users, especially neurodivergent users; clear visual hierarchy aids screen reader navigation |
| **Trust Impact**                      | Shows user that marketplace understands their needs; "Why this?" transparency builds trust in matching algorithm                             |
| **Consistency with DES Constitution** | Aligns with calm, focused design philosophy; no dark patterns; user controls dismissal                                                       |
| **Implementation Complexity**         | Medium — requires real-time matching algorithm, personalization pipeline, and AI coach integration                                           |
| **Future Scalability**                | Can evolve to multi-opportunity carousel as user engagement grows; ML models improve match quality over time                                 |

---

## Active Collaborations Card (Major Experience Section)

Shows the user's current collaborations in progress, with quick status indicators.

### Quality Review

| Dimension                             | Assessment                                                                                                            |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Why**                               | Users need to track ongoing commitments and see progress at a glance                                                  |
| **Marketplace Reasoning**             | Active collaborations are the strongest retention signal; easy access reduces friction                                |
| **Psychological Reasoning**           | Progress principle — seeing progress motivates continued engagement; closure drive — open tasks create mental tension |
| **Accessibility Impact**              | Clear status labels (not color-only) ensure screen reader compatibility; compact design reduces scan burden           |
| **Trust Impact**                      | Transparency about collaboration status builds confidence in marketplace reliability                                  |
| **Consistency with DES Constitution** | Uses standard card pattern; no gamification elements                                                                  |
| **Implementation Complexity**         | Low — primarily data-driven from collaboration service                                                                |
| **Future Scalability**                | Can add mini-timeline, milestone previews, and quick-action buttons                                                   |

---

## Trust Score Snapshot (Major Experience Section)

A compact display of the user's current trust score with breakdown.

### Quality Review

| Dimension                             | Assessment                                                                                               |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Why**                               | Trust is the core currency of the marketplace — users need visibility into their reputation              |
| **Marketplace Reasoning**             | Trust score drives opportunity access; visible score motivates quality participation                     |
| **Psychological Reasoning**           | Social proof — visible reputation signals competence; endowment effect — users value what they've earned |
| **Accessibility Impact**              | Score shown as numeric percentage + visual bar + text breakdown (never color-only)                       |
| **Trust Impact**                      | This IS the trust feature — must be transparent, accurate, and actionable                                |
| **Consistency with DES Constitution** | Evidence-based scoring aligns with "evidence matters more than popularity" principle                     |
| **Implementation Complexity**         | Medium — requires reputation algorithm, feedback aggregation, and portfolio verification                 |
| **Future Scalability**                | Can add detailed breakdown by category, historical trend, and comparison to market benchmarks            |

---

## AI Marketplace Coach Card (Major Experience Section)

The coach presence that provides contextual advice and opportunity evaluation.

### Quality Review

| Dimension                             | Assessment                                                                                                              |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Why**                               | AI Coach is the user's guide through the marketplace — provides personalized advice, risk assessment, and strategy      |
| **Marketplace Reasoning**             | Coach increases user confidence, reduces support burden, improves match outcomes                                        |
| **Psychological Reasoning**           | Guidance reduces anxiety in unfamiliar territory; anchoring — coach provides reference point for decision-making        |
| **Accessibility Impact**              | Coach messages use AI purple border for visual distinction; screen reader announces coach presence; keyboard accessible |
| **Trust Impact**                      | Transparency about AI nature, confidence scores, and source distinction builds long-term trust                          |
| **Consistency with DES Constitution** | Coach persona is Wise Mentor; never commands, always recommends; respects user autonomy                                 |
| **Implementation Complexity**         | High — requires AI orchestration pipeline, context assembly, personalization, and response validation                   |
| **Future Scalability**                | Coach becomes more proactive and nuanced as user history grows; can propose opportunities before user searches          |

---

## Cross-References

| Reference     | Relationship                                                             |
| ------------- | ------------------------------------------------------------------------ |
| DES-001 v1.0  | Design Constitution — colors, typography, spacing, motion, accessibility |
| DES-001A v1.0 | Design System Consistency — component patterns for cards, buttons        |
| DES-002 v1.0  | Onboarding — marketplace introduction flow leads here                    |
| DES-002A v1.0 | Onboarding Refinement — Dashboard Reveal includes marketplace section    |
| DES-003 v1.0  | Dashboard — Marketplace module card on main dashboard                    |
| DES-003A v1.1 | Dashboard Refinement — Marketplace section design, module cards          |
| DES-004 v1.0  | Memory & Knowledge — trust evidence, portfolio data                      |
| DES-005 v1.0  | AI Mentor — Marketplace Coach mode for coach card                        |
| DES-006 v1.0  | Career — freelance opportunities appear in dashboard                     |
| DES-007 v1.0  | Learning — skill verification data for match quality                     |
| DES-008 v1.0  | Business — service collaboration status in dashboard                     |
| DES-009/D00   | Marketplace Constitution — hierarchy, trust model, personalization       |
| DES-009/D03   | Opportunity Discovery — feed source for "Today's Best Opportunity"       |
| DES-009/D10   | AI Marketplace Coach — coach presence details                            |
| DES-009/D11   | Trust and Reputation — trust score details                               |
| PRD-001       | Product Vision — Marketplace as opportunity ecosystem                    |
| PRD-002       | User DNA — personalization for opportunity matching                      |
| ARC-001       | System Architecture — Marketplace module                                 |
| ARC-002       | Information Architecture — opportunity data flow                         |
| ARC-003       | Knowledge Graph — skill matching for opportunity display                 |
| ARC-004       | Execution Intelligence — collaboration tracking                          |
| ARC-005       | AI Orchestration — Marketplace Coach pipeline                            |
| ENG-001       | Domain Model — Marketplace entities                                      |
| ENG-002       | Implementation Standards — Marketplace patterns                          |
| ENG-003       | AI Development Guidelines — Coach ethics                                 |
| ENG-004       | Testing Standards — Marketplace validation                               |
| RSH-001       | Research — marketplace dashboard behavior patterns                       |
| CMP-001       | Competition — dashboard layout analysis                                  |

### Relationship Summary

| Reference   | How D02 Depends On It                                                      |
| ----------- | -------------------------------------------------------------------------- |
| DES-001     | All visual properties applied to dashboard layout                          |
| DES-001A    | Component patterns used for cards, buttons, and layout                     |
| DES-002     | Onboarding introduces marketplace; dashboard is first post-onboarding view |
| DES-002A    | Refined onboarding leads to dashboard reveal                               |
| DES-003     | Main dashboard hosts the Marketplace section card                          |
| DES-003A    | Refined dashboard defines module card patterns for marketplace             |
| DES-004     | Trust score uses reputation evidence from Memory & Knowledge               |
| DES-005     | Coach card uses AI Mentor persona and conversational framework             |
| DES-006     | Career opportunities appear as recommendations                             |
| DES-007     | Verified skills validate match quality shown in dashboard                  |
| DES-008     | Business collaboration status appears in active collaborations             |
| DES-009/D00 | Constitution governs all dashboard rules and hierarchy                     |
| DES-009/D03 | Opportunity feed powers Today's Best Opportunity selection                 |
| DES-009/D10 | Coach card links to full AI Marketplace Coach experience                   |
| DES-009/D11 | Trust Score card links to full trust and reputation system                 |
| PRD-001     | Product vision defines dashboard purpose                                   |
| PRD-002     | User DNA personalizes which opportunity appears as "Best"                  |
| ARC-001     | Architecture enables real-time data display                                |
| ARC-003     | Knowledge Graph powers skill-based match quality                           |
| ARC-005     | AI pipeline powers coach recommendations                                   |
| ENG-001     | Domain entities provide collaboration and opportunity data                 |
| RSH-001     | Research informs card layout and information hierarchy                     |
