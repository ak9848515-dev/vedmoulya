# Opportunity Discovery

> **Document:** DES-009-D03 — Marketplace & Opportunity Ecosystem  
> **Status:** 🔒 **LOCKED** — Part of DES-009 Marketplace Constitution v1.1

---

## Purpose

Opportunity Discovery helps users find relevant opportunities — freelance projects, collaborations, mentorship, hiring — through intelligent matching based on skills, goals, and reputation.

---

## Opportunity Feed (Major Experience Section)

```
┌────────────────────────────────────────────────────────┐
│  Recommended for You                    [Filters ▼]    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  💼 ML Consultant — Tech Startup               │   │
│  │  Match: 92%  │  Skills: 8/10  │  $5K project  │   │
│  │  Remote · 3 months · Posted 2 days ago         │   │
│  │  [Apply]  [Save]  [Why this match?]            │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  🧠 Mentor: Data Science — Senior Leader        │   │
│  │  Match: 88%  │  "Looking to mentor 2 people"   │   │
│  │  [Apply]  [Save]  [Why this match?]            │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Match explanations:                                   │
│  "Your Python (Expert), ML (Advanced), and             │
│   Communication (Advanced) align perfectly."           │
└──────────────────────────────────────────────────────────┘
```

### Quality Review

| Dimension                             | Assessment                                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Why**                               | The primary discovery surface — users need to efficiently browse, filter, and understand opportunities  |
| **Marketplace Reasoning**             | Feed is the highest-traffic marketplace surface; match quality directly determines conversion           |
| **Psychological Reasoning**           | Choice architecture — match scores reduce cognitive load; progressive disclosure prevents overwhelm     |
| **Accessibility Impact**              | Each item is a semantic list element with clear heading hierarchy; match scores include text labels     |
| **Trust Impact**                      | "Why this match?" transparency builds algorithmic trust; evidence-based matching prevents distrust      |
| **Consistency with DES Constitution** | Calm, content-first design with generous whitespace; no gamification elements                           |
| **Implementation Complexity**         | Medium-High — requires real-time matching, personalization, and AI coach integration                    |
| **Future Scalability**                | Feed can evolve with user history; ML models improve match quality; supports multiple opportunity types |

---

## Filters & Search (Major Experience Section)

Users can filter opportunities by type, skills, budget, duration, location, and trust level.

### Quality Review

| Dimension                             | Assessment                                                                                                            |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Why**                               | Users need to refine discovery beyond algorithmic recommendations for specific needs                                  |
| **Marketplace Reasoning**             | Filters give users control over discovery; reduces frustration from irrelevant matches                                |
| **Psychological Reasoning**           | Illusion of control — user satisfaction increases when they can influence outcomes; autonomy supports engagement      |
| **Accessibility Impact**              | Filters are fully keyboard navigable; clear labels, not color-only indicators; screen reader announces active filters |
| **Trust Impact**                      | Transparency about how filters affect results builds trust; showing filter-matched counts is honest                   |
| **Consistency with DES Constitution** | Standard form patterns (16px radius inputs, 14px labels); user controls experience                                    |
| **Implementation Complexity**         | Low-Medium — standard filter UI combined with real-time result updates                                                |
| **Future Scalability**                | Can add saved filter presets, smart filters based on user behavior, and AI-suggested refinements                      |

---

## Match Explanation System (Major Experience Section)

Each opportunity shows why it was matched to the user, with skill alignment breakdown.

### Quality Review

| Dimension                             | Assessment                                                                                                     |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Why**                               | Users must understand why an opportunity was recommended to trust the algorithm and make informed decisions    |
| **Marketplace Reasoning**             | Transparency increases conversion; users who understand matches are more likely to apply                       |
| **Psychological Reasoning**           | System justification — users trust recommendations they understand; explanatory depth signals competence       |
| **Accessibility Impact**              | Match explanations are text-based and screen reader friendly; always presented as structured lists             |
| **Trust Impact**                      | This is the primary trust-building mechanism for the algorithm — must be correct, honest, and actionable       |
| **Consistency with DES Constitution** | AI transparency principle — "Recommends, never commands"; shows reasoning and confidence                       |
| **Implementation Complexity**         | Medium — requires Knowledge Graph queries, skill comparison logic, and natural language explanation generation |
| **Future Scalability**                | Explanations become richer as Knowledge Graph grows; can include peer comparison, market context               |

---

## Specification Consistency

This document follows DES-001 v1.0 Design Constitution exactly:

| Standard               | Reference             | Application                                                            |
| ---------------------- | --------------------- | ---------------------------------------------------------------------- |
| Typography             | DES-001/D04           | Headings: Satoshi, Body: Inter (never below 16px)                      |
| Spacing                | DES-001/D06           | 4px base unit, space-4 (16px) card gap, space-6 (24px) section spacing |
| Motion                 | DES-001/D09           | 200-300ms, ease-out, list entry stagger at 30ms per item               |
| Accessibility          | DES-001/D10           | WCAG 2.1 AA, keyboard navigable feed, screen reader announcements      |
| Color Hierarchy        | DES-001/D03           | Match scores use semantic colors; AI explanations use purple           |
| Component Language     | DES-001/D07           | Opportunity cards at 24px radius, filter controls at 16px radius       |
| AI Personality         | DES-001/D11 + DES-005 | Wise Mentor — explains matches transparently                           |
| Interaction Principles | DES-001/D11           | Purposeful hover states on cards, calm feed transitions                |

---

## Cross-References

| Reference     | Relationship                                                                       |
| ------------- | ---------------------------------------------------------------------------------- |
| DES-001 v1.0  | Design Constitution — colors, typography, spacing, motion, accessibility           |
| DES-001A v1.0 | Design System Consistency — feed card components, filter UI patterns               |
| DES-002 v1.0  | Onboarding — marketplace discovery introduced during purpose selection             |
| DES-002A v1.0 | Onboarding Refinement — Explore First includes opportunity browsing                |
| DES-003 v1.0  | Dashboard — Marketplace module shows top opportunities                             |
| DES-003A v1.1 | Dashboard Refinement — Today's Best Opportunity links to full discovery            |
| DES-004 v1.0  | Memory & Knowledge — portfolio evidence, trust signals shown in feed               |
| DES-005 v1.0  | AI Mentor — match explanations, coach evaluation of opportunities                  |
| DES-006 v1.0  | Career — freelance and hiring opportunities in feed                                |
| DES-007 v1.0  | Learning — skill verification for match quality display                            |
| DES-008 v1.0  | Business — service and collaboration opportunities in feed                         |
| DES-009/D00   | Marketplace Constitution — discovery rules, information hierarchy, personalization |
| DES-009/D02   | Marketplace Dashboard — feed powers Today's Best Opportunity                       |
| DES-009/D10   | AI Marketplace Coach — opportunity evaluation and advice                           |
| DES-009/D11   | Trust and Reputation — trust signals displayed on each opportunity                 |
| PRD-001       | Product Vision — Marketplace as opportunity ecosystem                              |
| PRD-002       | User DNA — personalization for opportunity ranking                                 |
| ARC-001       | System Architecture — Marketplace module, discovery service                        |
| ARC-002       | Information Architecture — opportunity data flow and categorization                |
| ARC-003       | Knowledge Graph — skill matching, opportunity-entity connections                   |
| ARC-004       | Execution Intelligence — opportunity to execution pipeline                         |
| ARC-005       | AI Orchestration — match explanation generation                                    |
| ENG-001       | Domain Model — Opportunity, Service, Collaboration entities                        |
| ENG-002       | Implementation Standards — feed pagination, filtering patterns                     |
| ENG-003       | AI Development Guidelines — match transparency ethics                              |
| ENG-004       | Testing Standards — match quality validation                                       |
| RSH-001       | Research — opportunity discovery behavior, matching preferences                    |
| CMP-001       | Competition — feed design and matching UX analysis                                 |

### Relationship Summary

| Reference   | How D03 Depends On It                                          |
| ----------- | -------------------------------------------------------------- |
| DES-001     | All visual properties applied to feed layout and cards         |
| DES-001A    | Component patterns for feed items, filter controls             |
| DES-002     | Onboarding sets user expectations for opportunity discovery    |
| DES-002A    | Explore First mode includes discovery preview                  |
| DES-003     | Main dashboard shows feed highlights                           |
| DES-003A    | Refined dashboard drives traffic to full discovery view        |
| DES-004     | Trust signals and portfolio evidence displayed on feed items   |
| DES-005     | AI Mentor powers match explanations and opportunity evaluation |
| DES-006     | Career opportunities appear as feed items                      |
| DES-007     | Verified skills validate match percentages shown               |
| DES-008     | Business service listings appear in discovery feed             |
| DES-009/D00 | Constitution governs discovery rules and personalization       |
| DES-009/D02 | Dashboard surfaces top discovery results                       |
| DES-009/D10 | Coach evaluates and prioritizes discovery results              |
| DES-009/D11 | Trust scores influence opportunity ranking                     |
| PRD-002     | User DNA personalizes feed ranking                             |
| ARC-003     | Knowledge Graph enables skill-opportunity matching             |
| ARC-005     | AI pipeline generates match explanations                       |
| ENG-001     | Domain entities define opportunity data structure              |
| RSH-001     | Research informs feed layout, match display preferences        |
