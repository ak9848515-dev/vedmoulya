# Sprint Structure

**IMP-001 — Document 05/10 — Implementation Master Plan**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Program Architect
**Created:** 2026-07-27
**Cross-references:** CMP-001, CMP-002, ARC-001, ENG-002, ENG-004

---

## Purpose

This document defines the **sprint structure** for VedMoulya implementation — the weekly cadence, roles, ceremonies, and Definition of Done that govern every sprint from Alpha through GA.

---

## Sprint Model

### Weekly Sprint Model

VedMoulya uses a **1-week sprint model** optimized for AI-assisted development. Weekly sprints provide fast feedback cycles while maintaining enough time for meaningful work.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         WEEKLY SPRINT MODEL                                   │
│                                                                               │
│  MONDAY           TUESDAY          WEDNESDAY        THURSDAY         FRIDAY │
│                                                                               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────┐ │
│  │ Sprint       │ │ Execution    │ │ Execution     │ │ Execution    │ │Sprint│ │
│  │ Planning     │ │ Phase        │ │ Phase         │ │ Phase        │ │Review│ │
│  │              │ │              │ │               │ │              │ │     │ │
│  │ 9:00 - 10:00 │ │ 9:00 - 17:00 │ │ 9:00 - 17:00  │ │ 9:00 - 15:00 │ │Demo │ │
│  │              │ │              │ │               │ │              │ │     │ │
│  │ Spec Review  │ │ AI Coding    │ │ AI Coding     │ │ Testing      │ │15:00│ │
│  │ 10:00 - 12:00│ │ Human Review │ │ Human Review  │ │ Debugging    │ │     │ │
│  │              │ │              │ │               │ │              │ │Retro│ │
│  │ AI Coding    │ │ Code Review  │ │ Code Review   │ │ Final Review │ │     │ │
│  │ 13:00 - 17:00│ │              │ │               │ │              │ │16:00│ │
│  │              │ │              │ │               │ │ 15:00 - 17:00│ │     │ │
│  │              │ │              │ │               │ │ Deployment   │ │Rel. │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ └────┘ │
│                                                                               │
│  DAILY STANDUP: 9:00-9:15 (15 min) — What was done, what's next, blockers    │
│  PAIRING: AI handles first pass, human reviews and refines                    │
│  CODE REVIEW: Asynchronous, PR-based, target turnaround < 4 hours             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Sprint Calendar

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SPRINT CALENDAR                                       │
│                                                                               │
│  Sprint  │ Phase    │ Start     │ End       │ Focus                           │
│  ────────┼──────────┼───────────┼───────────┼─────────────────────────────── │
│  S1      │ Phase 1  │ Week 1    │ Week 1    │ Dev environment, CI/CD         │
│  S2      │ Phase 1  │ Week 2    │ Week 2    │ Engineering standards          │
│  S3      │ Phase 1  │ Week 3    │ Week 3    │ Security service foundation    │
│  S4      │ Phase 1  │ Week 4    │ Week 4    │ Audit service foundation       │
│  S5      │ Phase 1  │ Week 5    │ Week 5    │ Identity service foundation    │
│  S6      │ Phase 1  │ Week 6    │ Week 6    │ AI Orchestrator abstraction    │
│  S7      │ Phase 1  │ Week 7    │ Week 7    │ Foundation integration         │
│  S8      │ Phase 1  │ Week 8    │ Week 8    │ Foundation hardening           │
│  S9-S12  │ Phase 2  │ Week 9-12 │           │ Knowledge Graph                │
│  S13-S16 │ Phase 2  │ Week 13-16│           │ Decision Engine + Alpha        │
│  S17-S20 │ Phase 2  │ Week 17-20│           │ Execution Engine               │
│  S21-S28 │ Phase 3  │ Week 21-28│           │ Career Journey                 │
│  S29-S36 │ Phase 4  │ Week 29-36│           │ Learning Journey + Beta        │
│  S37-S44 │ Phase 5  │ Week 37-44│           │ Business Journey               │
│  S45-S52 │ Phase 6  │ Week 45-52│           │ Marketplace + RC               │
│  S53-S64 │ Phase 7  │ Week 53-64│           │ Enterprise + GA                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Sprint Ceremonies

### 1. Sprint Planning (Monday, 9:00-10:00)

| Activity           | Duration | Participants        | Output                   |
| ------------------ | -------- | ------------------- | ------------------------ |
| Sprint goal review | 15 min   | Full team           | Agreed sprint goal       |
| Task breakdown     | 30 min   | Implementation team | Task list with estimates |
| Capacity check     | 10 min   | Tech Lead           | Committed sprint backlog |
| Risk review        | 5 min    | Full team           | Identified risks         |

**AI Role in Planning:** AI analyzes historical velocity, surfaces task dependencies, suggests task breakdown, estimates effort.

### 2. Daily Standup (9:00-9:15)

| Activity                | Duration | Focus                         |
| ----------------------- | -------- | ----------------------------- |
| What was done yesterday | 5 min    | Completed tasks, PRs merged   |
| What will be done today | 5 min    | Next tasks, pairing plan      |
| Blockers                | 5 min    | What's blocking, who can help |

**Format:** Async text standup for remote days. Voice standup for co-located days.

**AI Role:** AI reads standup messages, identifies coordination needs, surfaces blockers to Tech Lead.

### 3. Sprint Review (Friday, 13:00-15:00)

| Activity               | Duration | Participants             |
| ---------------------- | -------- | ------------------------ |
| Demo of completed work | 45 min   | Full team + stakeholders |
| What went wrong        | 15 min   | Full team                |
| Metrics review         | 15 min   | Full team                |
| Stakeholder feedback   | 30 min   | Stakeholders             |
| Backlog refinement     | 15 min   | Product + Tech Lead      |

**Demo Requirements:**

- Working software (not slides)
- Tested in production-like environment
- Demonstrates vertical slice through all layers
- Shows error handling and edge cases

**AI Role:** AI generates sprint review summary, captures demo notes, tracks feedback items.

### 4. Sprint Retrospective (Friday, 15:00-16:00)

| Activity        | Duration | Focus                 |
| --------------- | -------- | --------------------- |
| What went well  | 15 min   | Continue doing        |
| What went wrong | 15 min   | Stop doing            |
| What to improve | 15 min   | Start doing           |
| Action items    | 15 min   | Concrete improvements |

**Format:** Rotating facilitator. Focus on process improvement, not blame.

**AI Role:** AI analyzes sprint data, surfaces patterns, suggests improvements based on historical sprint data.

---

## Definition of Done (DoD)

### Individual Task DoD

| #   | Criteria                                                | Verification     |
| --- | ------------------------------------------------------- | ---------------- |
| 1   | Code compiles/builds successfully                       | CI build passes  |
| 2   | All new code has unit tests (≥80% coverage on new code) | Coverage report  |
| 3   | All existing tests still pass                           | Test suite green |
| 4   | Code follows engineering standards                      | Linting passes   |
| 5   | Code reviewed and approved by at least one human        | PR approved      |
| 6   | AI-generated code reviewed for quality and security     | Review completed |
| 7   | No security vulnerabilities introduced                  | SAST scan passes |
| 8   | Documentation updated (if applicable)                   | Doc review       |
| 9   | No TODO/FIXME comments in production code               | Code search      |
| 10  | Logging added for observability                         | Log review       |

### Sprint DoD

| #   | Criteria                                              | Verification           |
| --- | ----------------------------------------------------- | ---------------------- |
| 1   | All committed tasks meet Individual Task DoD          | Backlog audit          |
| 2   | Sprint demo prepared and delivered                    | Demo completed         |
| 3   | All integration tests pass for new features           | Integration test suite |
| 4   | Performance regression checked                        | Performance baseline   |
| 5   | No new P0-P1 bugs introduced                          | Bug tracker            |
| 6   | Technical debt documented and < 5% of sprint capacity | Debt log               |
| 7   | Architecture alignment verified                       | Architecture review    |
| 8   | Sprint retrospective held                             | Retro notes            |
| 9   | Known issues documented                               | Issues log             |
| 10  | Deployment to staging completed                       | Staging green          |

### Release DoD

| #   | Criteria                                   | Verification      |
| --- | ------------------------------------------ | ----------------- |
| 1   | All Sprint DoD criteria met                | Sprint audit      |
| 2   | Full regression test suite passes          | Regression suite  |
| 3   | Performance targets met                    | Performance test  |
| 4   | Security scan passed                       | Security report   |
| 5   | Compliance checklist complete              | Compliance review |
| 6   | Release notes written and reviewed         | Release notes     |
| 7   | Rollback plan confirmed                    | Operations review |
| 8   | Monitoring dashboards operational          | Monitoring review |
| 9   | On-call rotation confirmed (if applicable) | Ops schedule      |
| 10  | Stakeholders notified                      | Communication log |

---

## Sprint Artifacts

| Artifact             | Created         | Updated       | Owner                |
| -------------------- | --------------- | ------------- | -------------------- |
| Sprint backlog       | Sprint planning | Daily         | Tech Lead            |
| Task board           | Sprint planning | Daily         | All engineers        |
| Sprint goal          | Sprint planning | Sprint start  | Tech Lead            |
| Sprint metrics       | Sprint review   | Sprint review | Tech Lead            |
| Sprint retrospective | Retro           | Retro         | Rotating facilitator |
| Known issues log     | Sprint start    | Daily         | QA Lead              |
| Technical debt log   | When discovered | Sprint review | Tech Lead            |
| Risk register        | Sprint planning | Sprint review | Tech Lead            |

---

## Sprint Capacity Planning

### Capacity Model

| Role              | Weekly Capacity | Utilization Target | Notes                                        |
| ----------------- | --------------- | ------------------ | -------------------------------------------- |
| Backend Engineer  | 40 hours        | 80% (32h)          | 20% overhead for meetings, reviews, learning |
| Frontend Engineer | 40 hours        | 80% (32h)          | Same overhead                                |
| AI Engineer       | 40 hours        | 85% (34h)          | Less meeting overhead                        |
| DevOps Engineer   | 40 hours        | 75% (30h)          | On-call rotation, incidents                  |
| QA Engineer       | 40 hours        | 85% (34h)          | Focused on testing                           |
| Tech Lead         | 40 hours        | 50% (20h)          | Meetings, reviews, coordination              |

### AI Capacity

AI-assisted coding capacity is tracked separately and considered **force multiplier**:

| AI Activity     | Estimated Productivity Gain | Notes                            |
| --------------- | --------------------------- | -------------------------------- |
| Code generation | 2-3x on routine code        | Human review still required      |
| Test generation | 3-5x                        | Human review of edge cases       |
| Documentation   | 5-10x                       | Human accuracy review            |
| Refactoring     | 2-3x                        | Human verification of behavior   |
| Code review     | 1.5x (AI pre-review)        | Human still makes final decision |

### Sprint Commitment Formula

```
Available Hours = Σ(Engineer Capacity × Utilization Target)
AI Multiplier   = 1 + (AI Tasks / Total Tasks) × AI Efficiency Factor
Effective Capacity = Available Hours × AI Multiplier

Example (Phase 2, 8 engineers):
  Available Hours = (4 × 32) + (2 × 34) + (1 × 30) + (1 × 34) = 240 hours
  AI Tasks = 40% of tasks, AI Efficiency Factor = 2.5
  AI Multiplier = 1 + (0.4 × 2.5) = 2.0
  Effective Capacity = 240 × 2.0 = 480 hours-equivalent
```

---

## Task Estimation

### Estimation Scale

| Size | Hours       | Complexity   | Description                                    |
| ---- | ----------- | ------------ | ---------------------------------------------- |
| XS   | 1-2 hours   | Trivial      | Simple change, well-understood                 |
| S    | 3-5 hours   | Low          | Straightforward implementation, few edge cases |
| M    | 6-10 hours  | Moderate     | Multiple components, some unknowns             |
| L    | 11-20 hours | High         | Cross-component, significant unknowns          |
| XL   | 21-40 hours | Complex      | System-level change, multiple dependencies     |
| XXL  | >40 hours   | Very Complex | Must be decomposed into smaller tasks          |

### Estimation Guidelines

| Task Type                | Typical Estimate | AI Factor                                    |
| ------------------------ | ---------------- | -------------------------------------------- |
| New service endpoint     | M (6-10h)        | AI can generate 70% in <1h                   |
| New entity/table         | S (3-5h)         | AI can generate 80% in <30min                |
| Integration test         | S (3-5h)         | AI can generate 60% in <30min                |
| UI component             | M (6-10h)        | AI can generate 50% in <1h                   |
| Documentation            | S (3-5h)         | AI can generate 90% in <15min                |
| Bug fix                  | S (3-5h)         | AI can identify root cause in <30min         |
| Performance optimization | L (11-20h)       | AI can profile and suggest, human implements |
| Architecture decision    | M (6-10h)        | AI can research options, human decides       |
| Security review          | M (6-10h)        | AI can scan, human interprets findings       |

---

## Sprint Rules

### Rules for Effective Sprints

| #   | Rule                                                                                      | Rationale                                  |
| --- | ----------------------------------------------------------------------------------------- | ------------------------------------------ |
| 1   | **One sprint goal** — Every sprint has a single measurable goal                           | Focus, clear success criteria              |
| 2   | **Vertical slices** — Every task delivers value through all layers                        | Working software, not half-done components |
| 3   | **AI first, human final** — AI generates, human validates                                 | Speed of AI + judgment of human            |
| 4   | **Done means deployed** — Done = code is in staging, tested, and observable               | No "done but not released"                 |
| 5   | **No multi-sprint tasks** — Any task >1 sprint must be decomposed                         | Visibility, accountability                 |
| 6   | **Test debt is sprint debt** — Untested code is not done                                  | Quality is non-negotiable                  |
| 7   | **5% maximum tech debt** — At most 5% of sprint capacity can be deferred debt             | Debt accumulates but stays bounded         |
| 8   | **Architecture review weekly** — Architecture alignment checked every sprint              | Prevent drift before it compounds          |
| 9   | **Security review monthly** — Automated security scan every sprint, manual review monthly | Security is continuous                     |
| 10  | **Retro actions tracked** — Every retro produces tracked action items                     | Continuous improvement                     |

---

## Cross-References

| Reference | Relationship                                                                                                          |
| --------- | --------------------------------------------------------------------------------------------------------------------- |
| CMP-001   | Sprint Rule #7 (tech debt) respects "Governance and maintainability" — architecture debt is as important as code debt |
| CMP-002   | Compliance controls are verified in every sprint's Definition of Done — not deferred to a compliance phase            |
| ARC-001   | Architecture Principles #2 (Provider Agnostic) and #6 (Secure) are verified in weekly architecture reviews            |
| ENG-002   | Service contracts are validated as part of Sprint DoD — every endpoint is checked against its contract                |
| ENG-004   | Module dependencies (ENG-004/D06) govern task dependencies in sprint planning                                         |
