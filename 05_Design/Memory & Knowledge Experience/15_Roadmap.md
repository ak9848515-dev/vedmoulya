# Roadmap

> **Document:** DES-004-D15 — Memory & Knowledge Experience  
> **Status:** 🔒 **LOCKED** — Part of DES-004 Memory Constitution v1.0  
> **Design Constitution:** DES-001 v1.0 · DES-002A v1.0 · DES-003A v1.1

---

## Purpose

This roadmap defines the phased evolution of the Memory & Knowledge Experience from MVP launch to long-term maturity. Each phase delivers meaningful value while laying the foundation for future capabilities.

**Why it exists:** Without a roadmap, scope creep dilutes quality. Phased delivery ensures the experience is world-class at every stage.

**How it connects:** This roadmap aligns with the VedMoulya Product Roadmap and Implementation Master Plan.

**What it changed:** The roadmap ensures Memory & Knowledge matures alongside the overall platform without rework.

**How it influenced later decisions:** Phase boundaries protect design quality and implementation focus.

---

## Maturity Levels

```
Phase 1 ──── Core Capture + Timeline (MVP)
Phase 2 ──── Garden + Search + AI (Discovery)
Phase 3 ──── Connections + Chapters + Reflection (Meaning)
Phase 4 ──── AI Enhancement + Full Integration (Intelligence)
```

---

## Phase 1: Core Capture + Timeline (MVP)

### Goal

Users can capture memories, view them chronologically, and see basic growth indicators.

### What's Delivered

| Feature                                    | Document Reference         |
| ------------------------------------------ | -------------------------- |
| Text memory capture                        | D09 — Capture Experience   |
| Voice memory capture (transcription basic) | D09 — Capture Experience   |
| Image memory capture                       | D09 — Capture Experience   |
| Memory Timeline (chronological)            | D02 — Memory Timeline      |
| Memory Card (compact view)                 | D06 — Details (basic)      |
| Memory Detail View (read-only)             | D06 — Details (basic read) |
| Basic Timeline scroll                      | D02 — Memory Timeline      |
| Loading, empty, error states               | D12 — States               |
| Capture from Dashboard Quick Actions       | DES-003A — D09             |

### Not in Phase 1

- Knowledge Garden
- Connections View
- Life Chapters
- AI enhancement
- Search
- Reflection
- Growth Visualization
- Bookmarks
- Document capture

### Dependencies

- DES-003A Dashboard (Quick Actions entry point)
- ARC-003 Knowledge Graph (basic node creation)
- ENG-001 Domain Model (Memory entity)

### Timeline Target

Launch + 4 weeks

---

## Phase 2: Garden + Search + AI (Discovery)

### Goal

Users can browse their knowledge, search across memories, and get basic AI assistance.

### What's Delivered

| Feature                                 | Document Reference           |
| --------------------------------------- | ---------------------------- |
| Knowledge Garden (topic-based browsing) | D03 — Knowledge Garden       |
| Topic cards with expandable detail      | D03 — Knowledge Garden       |
| Full-text search across all memories    | D07 — Search & Discovery     |
| Search filters (date, type, tags)       | D07 — Search & Discovery     |
| AI Knowledge Assistant (basic)          | D08 — AI Knowledge Assistant |
| AI summary for memories                 | D08 — AI Knowledge Assistant |
| AI enhancement for captures             | D09 — Capture Experience     |
| AI unavailable state                    | D12 — States                 |
| Document capture (PDF, DOCX)            | D09 — Capture Experience     |
| Bookmark / link capture                 | D09 — Capture Experience     |

### Not in Phase 2

- Connections View
- Life Chapters
- Reflection
- Growth Visualization
- Memory anniversaries
- Voice deep processing

### Dependencies

- ARC-005 AI Orchestration (basic query + summarization)
- PRD-002 User DNA (topic extraction for knowledge organization)

### Timeline Target

Phase 1 + 6 weeks

---

## Phase 3: Connections + Chapters + Reflection (Meaning)

### Goal

Users see how their memories connect, understand life chapters, and engage in regular reflection.

### What's Delivered

| Feature                                       | Document Reference          |
| --------------------------------------------- | --------------------------- |
| Connections View (relationship visualization) | D04 — Connections View      |
| Connection discovery (AI-suggested)           | D04 — Connections View      |
| Life Chapters (auto-organized)                | D05 — Life Chapters         |
| Chapter transitions                           | D05 — Life Chapters         |
| Chapter reflection                            | D10 — Reflection Experience |
| Daily reflection prompts                      | D10 — Reflection Experience |
| Weekly review                                 | D10 — Reflection Experience |
| Memory anniversaries                          | D10 — Reflection Experience |
| AI explains "why this connection?"            | D04, D08                    |

### Not in Phase 3

- Growth Visualization (charts)
- Monthly reflection
- Voice advanced processing
- Full graph visualization

### Dependencies

- ARC-004 Execution Intelligence (decision tracking for connections)
- ARC-003 Knowledge Graph (relationship edges between nodes)

### Timeline Target

Phase 2 + 8 weeks

---

## Phase 4: AI Enhancement + Full Integration (Intelligence)

### Goal

The Memory & Knowledge Experience becomes intelligent, proactive, and deeply integrated with the entire VedMoulya platform.

### What's Delivered

| Feature                                           | Document Reference           |
| ------------------------------------------------- | ---------------------------- |
| Growth Visualization (full charts)                | D11 — Growth Visualization   |
| Monthly reflection                                | D10 — Reflection Experience  |
| Chapter reflection                                | D10 — Reflection Experience  |
| Growth Radar (6 dimensions)                       | D11 — Growth Visualization   |
| Decision quality visualization                    | D11 — Growth Visualization   |
| Consistency pattern heatmap                       | D11 — Growth Visualization   |
| Spontaneous reflection                            | D10 — Reflection Experience  |
| AI proactive connection discovery                 | D08 — AI Knowledge Assistant |
| Image deep processing (scene, people, OCR)        | D09 — Capture Experience     |
| Voice deep processing (sentiment, key points)     | D09 — Capture Experience     |
| Growth insights on Dashboard                      | DES-003A — D07               |
| Integration with Career, Learning, Health modules | All modules                  |

### Dependencies

- All VedMoulya modules (Career, Learning, Health, etc.)
- Full AI Orchestration pipeline
- Execution Engine integration

### Timeline Target

Phase 3 + 12 weeks

---

## Future Considerations (Beyond Phase 4)

| Capability                 | Description                                             | Priority |
| -------------------------- | ------------------------------------------------------- | -------- |
| **Collaborative memories** | Share memories with trusted connections                 | P2       |
| **Knowledge export**       | Full knowledge graph export (Obsidian, Roam compatible) | P2       |
| **Memory journal print**   | Generate beautiful printed memory book                  | P3       |
| **Legacy mode**            | Designated memory inheritors                            | P3       |
| **AI life story**          | AI-generated life narrative from memories               | P3       |
| **Therapy integration**    | Optional export for therapy/coaching (with consent)     | P4       |
| **Multi-language**         | Full Unicode support, RTL, localized capture            | P4       |

---

## Risk Register

| Risk                                               | Impact | Mitigation                                                                    |
| -------------------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| AI enhancement latency frustrates users            | High   | Progressive enhancement: show raw content immediately, enhance asynchronously |
| Knowledge Graph performance degrades with scale    | High   | Pagination, lazy loading, indexed queries                                     |
| Voice capture quality varies on device             | Medium | Client-side pre-processing, quality indicators                                |
| Offline sync conflicts                             | Medium | Last-write-wins with conflict UI for critical cases                           |
| Users overwhelmed by connection density            | Medium | Progressive disclosure: show top connections first, "show more" option        |
| Growth visualization misunderstood as gamification | Low    | Education in Experience Philosophy, no scores/ranks                           |

---

## Cross-References

| Document        | Relationship                                             |
| --------------- | -------------------------------------------------------- |
| DES-001 v1.0    | Design Constitution — all phases must follow             |
| DES-002A v1.0   | Onboarding — Memory & Knowledge introduced in onboarding |
| DES-003A v1.1   | Dashboard — growth and memory are dashboard components   |
| ARC-003         | Knowledge Graph — Phase 1-4 dependency                   |
| ARC-004         | Execution Intelligence — Phase 3-4 dependency            |
| ARC-005         | AI Orchestration — Phase 2-4 dependency                  |
| PRD-002         | User DNA — Phase 2-4 dependency                          |
| ENG-001         | Domain Model — Phase 1 dependency                        |
| All D01-D14     | Each feature's phase is defined in this roadmap          |
| 00 Constitution | Memory Constitution v1.0 governance                      |
