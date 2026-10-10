# 05_Design — Design System & Experience Architecture

**Version:** 1.0  
**Status:** Approved & Enterprise Certified  
**Owner:** Head of Design & User Experience  
**Created:** 2026-07-24  
**Updated:** 2026-08-16

---

## Overview

The `05_Design` directory constitutes the master UX/UI design blueprint, experience philosophy, design token definitions, and interaction guidelines for the entire VedMoulya platform. With over 190 design documents, it covers every interaction domain from onboarding and dashboard ergonomics to AI companion modalities.

```
05_Design/
├── AI Mentor Experience/            # AI voice and chat interaction flows, tones, and safeguards
├── Business Experience/             # Business OS, company management, and commercial dashboards
├── Career Experience/               # Career trajectory planning, resume reviews, skill mapping
├── Dashboard Experience/            # Life OS command center, widgets, timeline, and daily briefs
├── Design System/                   # Design tokens, typography, component library specs, a11y standards
├── Experience Bible/                # Comprehensive UX manifesto and human-centered design laws
├── Learning Experience/             # Knowledge-to-execution modules, practice labs, certifications
├── Life Operating System/           # Holisitic life balance, energy tracking, personal goals
├── Marketplace Experience/          # Capability discovery, service listings, provider vetting
├── Memory & Knowledge Experience/   # Brain explorer, knowledge graph visualization, recall UI
├── Onboarding Experience/           # Day 1 user activation, User DNA extraction, stage profiling
└── README.md                        # Master design index and navigation hub
```

---

## Core Design Principles

1. **Clarity Over Novelty:** Clean, accessible layouts that reduce cognitive load for users under stress.
2. **Deterministic UI State:** Interfaces always show whether data is `OBSERVED`, `VERIFIED`, `HYPOTHESIS`, or `UNKNOWN`.
3. **Progressive Disclosure:** Tailor complexity to the user's active Journey Stage—never overwhelm a beginner with enterprise tooling.
4. **Accessible by Default:** Full WCAG 2.1 AA compliance, high contrast palettes, semantic HTML, and complete keyboard navigation.
5. **Human-Centric AI UX:** AI is visually and behaviorally differentiated from human actors. AI outputs feature explainability drill-downs (WHAT / WHY / EVIDENCE / COST).

---

## The Design System (`packages/ui`)

The design specifications in this folder are implemented in code within the `@vedmoulya/ui` package and Next.js web application (`apps/web`):

- **Base Components:** Radix UI primitives with Tailwind styling.
- **Design Tokens:** Strict semantic color tokens (surface, border, text, accent, destructive, warning, success).
- **Responsive Ergonomics:** Desktop-first command center layouts with fluid mobile adaptations.
