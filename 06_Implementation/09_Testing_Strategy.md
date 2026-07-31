# Testing Strategy

**BLP-001 — Document 09/15 — Implementation Strategy & Delivery Blueprint**
**Version:** 1.0
**Status:** LOCKED
**Owner:** Quality Engineering Director
**Created:** 2026-07-27
**Design Freeze:** 2026-07-27

---

## Purpose

This document defines the **comprehensive testing strategy** for VedMoulya — covering all test types, tooling, coverage targets, and automation approach.

---

## Testing Pyramid

```text
                    ┌─────────────────────────────────────┐
                    │          E2E TESTS (5%)              │
                    │  Full system validation              │
                    │  Critical user journeys               │
                    └─────────────────────────────────────┘
                                      │
                    ┌─────────────────────────────────────┐
                    │       INTEGRATION TESTS (25%)        │
                    │  Service-to-service interactions     │
                    │  Cross-module flows                   │
                    │  API contract validation              │
                    └─────────────────────────────────────┘
                                      │
                    ┌─────────────────────────────────────┐
                    │        UNIT TESTS (60%)              │
                    │  Individual functions/classes        │
                    │  Business logic                       │
                    │  Pure logic validation                │
                    └─────────────────────────────────────┘
                                      │
                    ┌─────────────────────────────────────┐
                    │   AI EVALUATION (supplementary)      │
                    │  Response quality, accuracy, safety   │
                    │  Human evaluation + automated checks  │
                    └─────────────────────────────────────┘
                                      │
                    ┌─────────────────────────────────────┐
                    │   ACCESSIBILITY + PERF + SECURITY     │
                    │  Cross-cutting quality attributes     │
                    │  Validated in CI                      │
                    └─────────────────────────────────────┘
```

---

## Test Types

### Unit Tests

| Aspect              | Detail                                      |
| ------------------- | ------------------------------------------- |
| **Scope**           | Individual functions, classes, pure logic   |
| **Framework**       | Vitest                                      |
| **Location**        | Co-located with source files: `*.test.ts`   |
| **Coverage Target** | ≥80% on new code, ≥60% overall              |
| **Isolation**       | No network, database, or file system access |
| **Run Frequency**   | Every commit                                |

**What to Test:**

- Business logic and calculations
- State management
- Edge cases and error handling
- Input validation
- Data transformations

**What NOT to Test:**

- Framework behavior
- Third-party library internals
- Configuration
- Simple getters/setters

### Integration Tests

| Aspect              | Detail                                                     |
| ------------------- | ---------------------------------------------------------- |
| **Scope**           | Service-to-service interactions, cross-module flows        |
| **Framework**       | Vitest + supertest (HTTP), testcontainers (infrastructure) |
| **Location**        | `test/integration/` per service                            |
| **Coverage Target** | ≥70% of integration paths                                  |
| **Run Frequency**   | Every commit                                               |

**What to Test:**

- API endpoint responses
- Database read/write operations
- Event publishing and consumption
- Cross-service authentication
- Error propagation between services

### Contract Tests

| Aspect            | Detail                                            |
| ----------------- | ------------------------------------------------- |
| **Scope**         | Service contract compliance (provider + consumer) |
| **Framework**     | Pact (consumer-driven contracts) or OpenAPI-based |
| **Location**      | `test/contract/` per service                      |
| **Run Frequency** | Every commit                                      |

**What to Test:**

- Provider: API responses match contract
- Consumer: Interactions with provider match contract
- Breaking change detection

### End-to-End Tests

| Aspect            | Detail                                           |
| ----------------- | ------------------------------------------------ |
| **Scope**         | Full system validation, critical user journeys   |
| **Framework**     | Playwright (UI), custom (API)                    |
| **Location**      | `test/e2e/`                                      |
| **Run Frequency** | Every PR (critical subset), nightly (full suite) |

**Critical Journeys (run on every PR):**

1. User registration → login → dashboard
2. Create career goal → view recommendation → track progress
3. Create learning path → start learning → complete module
4. Knowledge Graph → Decision → Execution pipeline
5. AI Coach interaction → recommendation → user action

### Accessibility Tests

| Aspect            | Detail                                             |
| ----------------- | -------------------------------------------------- |
| **Scope**         | WCAG AA compliance for every UI screen             |
| **Framework**     | axe-core (automated), manual screen reader testing |
| **Location**      | Co-located with UI tests                           |
| **Run Frequency** | Every commit (automated), pre-release (manual)     |

**Automated Checks:**

- Color contrast
- ARIA label completeness
- Keyboard navigation paths
- Focus management
- Reduced motion detection

### Performance Tests

| Aspect            | Detail                                                        |
| ----------------- | ------------------------------------------------------------- |
| **Scope**         | API response times, AI response times, page load, bundle size |
| **Framework**     | k6 (API), Lighthouse (web), custom benchmarks                 |
| **Location**      | `test/performance/`                                           |
| **Run Frequency** | Every commit (Lighthouse), per release (load testing)         |

**Load Testing (per release):**

- 10x target concurrent users
- Sustained load for 30 minutes
- Peak load test (2x spikes)
- Endurance test (2 hours)

### Security Tests

| Aspect            | Detail                                                              |
| ----------------- | ------------------------------------------------------------------- |
| **Scope**         | SAST, dependency scanning, secrets detection, penetration testing   |
| **Framework**     | SAST tool, dependency scanner, secrets scanner, penetration testing |
| **Run Frequency** | Every commit (SAST/dependencies), pre-release (pen testing)         |

### AI Evaluation Tests

| Aspect            | Detail                                             |
| ----------------- | -------------------------------------------------- |
| **Scope**         | AI response quality, accuracy, safety, consistency |
| **Framework**     | Custom evaluation suite + human evaluation         |
| **Location**      | `test/ai/`                                         |
| **Run Frequency** | Per model change, per prompt change, per release   |

**AI Evaluation Dimensions:**

| Dimension     | Method                               | Target          |
| ------------- | ------------------------------------ | --------------- |
| Accuracy      | Ground truth comparison              | ≥80%            |
| Relevance     | Human rating                         | ≥4/5            |
| Safety        | Toxicity/offensive content detection | 0% violations   |
| Consistency   | Same input → similar output          | ≥90% similarity |
| Response time | Latency measurement                  | ≤5s p95         |

---

## Test Automation

### CI Pipeline Integration

```text
COMMIT → CI PIPELINE:
  ├── Compilation (TypeScript)
  ├── Linting (ESLint + Prettier)
  ├── SAST Security Scan
  ├── Unit Tests + Coverage
  ├── Integration Tests
  ├── Contract Tests
  ├── Accessibility (axe-core)
  ├── Lighthouse Performance
  ├── Bundle Size Analysis
  └── ── ALL PASS → Merge eligible

NIGHTLY PIPELINE:
  ├── Full E2E Test Suite
  ├── Performance Load Tests
  ├── AI Evaluation Suite
  └── Security Dependency Scan

PRE-RELEASE PIPELINE:
  ├── Full Nightly Suite
  ├── Manual Accessibility Audit
  ├── Manual Security Penetration Test
  ├── Visual Regression Audit
  └── AI Model Quality Review
```

### Test Data Management

| Data Type                  | Source                | Management           |
| -------------------------- | --------------------- | -------------------- |
| Test fixtures              | Static JSON files     | Version controlled   |
| Database seed data         | Migration scripts     | Auto-generated       |
| Mock AI responses          | Fixture files         | Version controlled   |
| User test accounts         | Test identity service | Auto-created/cleaned |
| Production anonymized data | ETL process           | Post-MVP only        |

---

## Test Coverage Strategy

### Coverage Targets by Phase

| Phase             | Unit Coverage               | Integration Coverage | E2E Coverage          |
| ----------------- | --------------------------- | -------------------- | --------------------- |
| Alpha (Phase 1-3) | ≥70% new code               | ≥50% critical paths  | Critical journeys     |
| Beta (Phase 4-5)  | ≥80% new code               | ≥70% critical paths  | All journeys          |
| RC (Phase 6-7)    | ≥80% new code, ≥60% overall | ≥70% all paths       | Full e2e              |
| GA (Phase 9)      | ≥80% new code, ≥60% overall | ≥80% all paths       | Full e2e + regression |

### Coverage Enforcement

| Rule                   | Action                  |
| ---------------------- | ----------------------- |
| New code <80% coverage | Block PR merge          |
| Overall <60% coverage  | Warn, track in debt log |
| Critical path untested | Block release           |
| AI evaluation fails    | Block model deployment  |

---

## Test Environment Strategy

| Environment    | Purpose                  | Data             | Access           |
| -------------- | ------------------------ | ---------------- | ---------------- |
| **Local**      | Developer testing        | Mock/fixtures    | Developer        |
| **CI**         | Automated test execution | Isolated per run | CI pipeline      |
| **Staging**    | Pre-release validation   | Anonymized copy  | Engineering team |
| **Production** | Live system              | Real user data   | Operations       |

---

## Architecture References

| Reference      | Relationship                                                                 |
| -------------- | ---------------------------------------------------------------------------- |
| ARC-001        | Principle #7 (Testable) — architecture designed for testability from day one |
| DES-010A / D13 | Accessibility strategy defines the requirements for accessibility testing    |

---

## Cross-References

| Reference      | Relationship                                                                         |
| -------------- | ------------------------------------------------------------------------------------ |
| BLP-001 / D01  | DoD includes testing criteria — no merge without passing tests                       |
| BLP-001 / D08  | Quality Gates validate testing completeness                                          |
| BLP-001 / D10  | Release Strategy defines test gates per release type                                 |
| ENG-001        | Domain model entities tested according to domain patterns                            |
| CMP-001        | Constitutional values require quality — testing is how quality is verified           |
| DES-010A / D13 | Accessibility Constitution defines accessibility testing requirements                |
| ARC-001        | Architecture Principle #7 (Testable) ensures testability is architected from day one |

---

## Quality Review

| Dimension                         | Assessment                                                                                   |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| **Why**                           | Without a testing strategy, quality is unknowable. Testing must be systematic and automated. |
| **Engineering Reasoning**         | Shift-left testing catches defects early. Automated tests provide rapid feedback.            |
| **Psychology Reasoning**          | Comprehensive testing builds confidence. Engineers deploy with less fear.                    |
| **Accessibility Impact**          | Accessibility testing is automated in CI — not deferred to manual audit.                     |
| **Trust Impact**                  | Tested software builds user trust. AI evaluation ensures responsible AI behavior.            |
| **Consistency with DES Missions** | Accessibility, security, and AI quality testing enforce design requirements.                 |
| **Implementation Complexity**     | MEDIUM-HIGH — Comprehensive test automation requires significant upfront investment.         |
| **Future Scalability**            | The test architecture scales with the system. New services follow the same patterns.         |

---

## Design Freeze Status

| Status    | Date       | Notes                                                                                |
| --------- | ---------- | ------------------------------------------------------------------------------------ |
| ✅ LOCKED | 2026-07-27 | Testing Strategy v1.0 frozen. Changes require Engineering Governance Board approval. |
