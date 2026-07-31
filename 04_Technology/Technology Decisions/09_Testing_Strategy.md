# Testing Strategy

**TECH-001 — Document 09/10 — Technology Decision Record**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Technology Officer (CTO)
**Created:** 2026-07-27
**Cross-references:** CMP-001, ARC-001, ENG-002, ENG-003, IMP-001/D05, IMP-001/D08

---

## Purpose

This TDR defines the **testing strategy** for VedMoulya — the types of tests, tools, coverage targets, and philosophy that ensure platform quality from MVP through enterprise.

---

## Testing Philosophy

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VEDMOULYA TESTING PHILOSOPHY                                │
│                                                                               │
│  1. TESTS ARE EXECUTABLE SPECIFICATIONS                                       │
│     A passing test suite is the most reliable documentation.                   │
│                                                                               │
│  2. AI GENERATES, HUMANS VALIDATE                                             │
│     AI creates comprehensive test suites. Humans validate what the             │
│     tests actually verify — not just that they pass.                          │
│                                                                               │
│  3. TEST THE BEHAVIOR, NOT THE IMPLEMENTATION                                 │
│     Tests verify that the system does the right thing.                         │
│     Implementation details are tested implicitly through behavior tests.       │
│                                                                               │
│  4. CONTRACT TESTS COME FIRST                                                 │
│     Service contracts (ENG-002) are validated by contract tests                │
│     written before any implementation code.                                   │
│                                                                               │
│  5. AI GETS SPECIAL TESTS                                                     │
│     AI-generated outputs are tested for accuracy, safety, and quality.         │
│     Standard software tests don't cover AI behavior.                          │
│                                                                               │
│  6. TEST PARALLEL WITH DEVELOPMENT                                            │
│     Testing is not a phase. Tests are written alongside code.                  │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Test Types

### Testing Pyramid (VedMoulya-Specific)

```text
                    /\
                   /  \
                  /    \
                 /  E2E  \          ← Few: Full user journeys
                /  Tests   \            through all layers
               /────────────\
              /              \
             /  AI Quality   \      ← Critical: AI output validation
            /    Tests        \        Accuracy, safety, consistency
           /────────────────────\
          /                      \
         /   Integration Tests   \  ← Some: Service interactions
        /     (API-level)         \      cross-module flows
       /────────────────────────────\
      /                              \
     /     Contract Tests             \ ← Many: Contract compliance
    /       (Service API)              \   Schema validation
   /────────────────────────────────────\
  /                                      \
 /         Unit Tests                    \  ← Most: Isolated function/
 /          (Function-level)              \      class/component tests
/──────────────────────────────────────────\
```

### Test Type Details

| Test Type       | What It Tests                                          | Tools                                                    | Coverage Target             | AI Role                                   |
| --------------- | ------------------------------------------------------ | -------------------------------------------------------- | --------------------------- | ----------------------------------------- |
| **Unit**        | Individual functions, classes, methods in isolation    | Vitest (backend), Vitest/Testing Library (frontend)      | ≥90%                        | Generate test cases, edge cases           |
| **Contract**    | Service API matches contract specification (ENG-002)   | Pact (consumer-driven contracts) or OpenAPI validation   | 100% of contract fields     | Generate contract tests from spec         |
| **Integration** | Service-to-service interactions through API boundaries | Vitest + supertest (backend), Playwright (frontend)      | ≥80% of interaction paths   | Generate stubs and mocks                  |
| **AI Quality**  | AI output accuracy, safety, consistency, hallucination | Custom evaluation framework + automated test suite       | All AI response types       | Generate test cases, cannot self-validate |
| **E2E**         | Full user journeys through all system layers           | Playwright (web)                                         | ≥30% of user journeys       | Generate test scenarios                   |
| **Performance** | System behavior under load, latency, throughput        | k6 or Artillery                                          | Critical paths only         | Generate load scripts                     |
| **Security**    | Vulnerability detection, compliance validation         | SAST (Semgrep), DAST (OWASP ZAP), dependency scan (Snyk) | Critical paths              | Automated scanning                        |
| **Regression**  | All existing functionality still works                 | Full test suite                                          | 100% of tests maintain pass | Pre-merge PR review                       |

---

## AI-Specific Testing

### AI Output Validation (Critical for VedMoulya)

| Validation                  | Method                                            | Automated?                          | Blocking? |
| --------------------------- | ------------------------------------------------- | ----------------------------------- | --------- |
| **Factual Accuracy**        | Compare AI output against known-correct data      | Partial (yes for structured output) | Yes       |
| **Safety Check**            | Toxicity, bias, harmful content detection         | Yes                                 | Yes       |
| **Format Compliance**       | Output matches expected schema                    | Yes                                 | Yes       |
| **Consistency**             | Same input → consistent output (within tolerance) | Yes                                 | Warn      |
| **Hallucination Detection** | Claims unsupported by provided context            | Partial                             | Yes       |
| **Confidence Scoring**      | AI's confidence in its own output                 | Partial                             | Warn      |

### AI Evaluation Framework

```text
For each AI task type T:
  1. Define evaluation dataset D — known-correct inputs and expected outputs
  2. For each provider P available for T:
     a. Run D through P
     b. Compare outputs against expected outputs
     c. Score: accuracy, safety, consistency, format compliance
     d. Record: latency, cost, token usage
  3. Update provider quality scores
  4. Alert if any metric drops below threshold

THRESHOLDS:
  Accuracy:       > 90% (structured), > 80% (unstructured)
  Safety:         100% pass
  Format:         100% compliant
  Consistency:    > 90%
  Confidence:     > 70% (reject outputs below threshold)
```

### AI Test Data Management

| Data Type                | Source                                  | Use                   |
| ------------------------ | --------------------------------------- | --------------------- |
| **Known-Correct Inputs** | Curated by domain experts               | Evaluation dataset    |
| **Edge Cases**           | AI-generated edge cases                 | Stress testing        |
| **Adversarial Inputs**   | Deliberately problematic inputs         | Safety testing        |
| **Production Shadows**   | Anonymized production requests (opt-in) | Real-world evaluation |

---

## Test Automation

### CI/CD Test Pipeline

```text
LOCAL (pre-commit):
  ┌──────────────┐
  │ Lint + Type  │  ← Fast (< 30 seconds)
  │ Check + Unit │
  └──────┬───────┘
         │
         ▼
PR (CI Pipeline — < 10 min):
  ┌──────────────────────────────┐
  │ Unit Tests (all)             │
  │ Contract Tests (affected)    │
  │ Integration Tests (affected) │
  │ AI Quality Tests (affected)  │
  │ Security Scan (SAST)         │
  │ Dependency Scan              │
  │ Coverage Check               │
  └──────┬───────────────────────┘
         │
         ▼
STAGING (Deployment — < 30 min):
  ┌──────────────────────────────┐
  │ E2E Tests (critical paths)   │
  │ Performance Baseline         │
  │ Security Scan (DAST)         │
  │ Compliance Scan              │
  └──────┬───────────────────────┘
         │
         ▼
PRODUCTION (Release):
  ┌──────────────────────────────┐
  │ Smoke Tests                  │
  │ Performance Regression Check │
  │ Security Audit               │
  └──────────────────────────────┘
```

### Coverage Targets

| Metric               | MVP (Phase 1-4)     | Growth (Phase 5-6)  | Enterprise (Phase 7+) |
| -------------------- | ------------------- | ------------------- | --------------------- |
| Unit test coverage   | ≥80% (new code)     | ≥85% (all)          | ≥90% (all)            |
| Contract coverage    | 100% (all services) | 100% (all services) | 100% (all services)   |
| Integration coverage | ≥60% of paths       | ≥70% of paths       | ≥80% of paths         |
| E2E coverage         | ≥30% of journeys    | ≥50% of journeys    | ≥70% of journeys      |
| AI accuracy          | ≥80%                | ≥85%                | ≥90%                  |
| Security scan pass   | 100% critical       | 100% all            | 100% all              |

---

## Testing Tools

| Test Type             | MVP Tool                       | Growth Tool                 | Enterprise Tool                      |
| --------------------- | ------------------------------ | --------------------------- | ------------------------------------ |
| **Unit (Backend)**    | Vitest                         | Vitest                      | Vitest                               |
| **Unit (Frontend)**   | Vitest + Testing Library       | Vitest + Testing Library    | Vitest + Testing Library             |
| **Contract**          | OpenAPI validation + Supertest | Pact (consumer-driven)      | Pact (consumer + provider)           |
| **Integration**       | Vitest + supertest             | Vitest + supertest          | Vitest + supertest + test containers |
| **E2E**               | Playwright                     | Playwright                  | Playwright (multi-browser)           |
| **AI Evaluation**     | Custom framework               | Custom + evaluation service | Custom + evaluation + human review   |
| **Performance**       | k6 (basic)                     | k6 (advanced)               | k6 + Gatling                         |
| **Security**          | Semgrep + Snyk                 | Semgrep + Snyk + ZAP        | Semgrep + Snyk + ZAP + pen testers   |
| **Visual Regression** | Storybook + Chromatic          | Storybook + Chromatic       | Storybook + Chromatic                |

---

## Testing Responsibilities

| Role                       | Responsibility                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| **AI Assistant**           | Generate test cases. Generate test data. Run test scans. Pre-review PRs.                               |
| **Developer**              | Review AI-generated tests. Write tests AI cannot generate (complex domain logic). Validate edge cases. |
| **QA Engineer** (Phase 2+) | Define testing strategy. Build test infrastructure. Write E2E tests. Track quality metrics.            |
| **Security Lead**          | Security test strategy. Penetration testing. Vulnerability triage.                                     |
| **Code Reviewer**          | Verify test coverage. Validate test correctness. Check for missing edge cases.                         |

---

## Pros & Cons

| Pros                                                    | Cons                                           |
| ------------------------------------------------------- | ---------------------------------------------- |
| AI generates comprehensive test suites rapidly          | AI-generated tests may test the wrong behavior |
| Contract-first testing catches integration issues early | Contract test maintenance adds overhead        |
| AI-specific testing validates what AI generates         | AI evaluation is never 100% accurate           |
| Test automation gives fast feedback                     | Test suite execution time grows with codebase  |
| Multiple test layers provide comprehensive coverage     | Multiple test layers take time to set up       |

### Migration Strategy

| Scenario                                   | Migration Path                                  | Cost   |
| ------------------------------------------ | ----------------------------------------------- | ------ |
| Vitest → Jest                              | Vitest is Jest-compatible. Minimal migration.   | Low    |
| Playwright → Cypress                       | Different API. Complete rewrite of E2E tests.   | High   |
| Pact → No contract tests                   | Remove pact verification. Lose contract safety. | Low    |
| k6 → Artillery                             | Both are script-based. Similar patterns.        | Medium |
| Custom AI evaluation → Evaluation platform | Migration depends on platform.                  | Medium |

---

## Cross-References

| Reference   | Relationship                                                                            |
| ----------- | --------------------------------------------------------------------------------------- |
| CMP-001     | "Quality is non-negotiable" — testing philosophy ensures quality is tested, not assumed |
| CMP-002     | Compliance validation — security testing and audit trail testing                        |
| ARC-001     | Principle #7 (Quality) — testing strategy operationalizes quality                       |
| ENG-002     | Contract tests validate that implementation matches service contracts                   |
| ENG-003     | AI test data respects information classification — no personal data in test datasets    |
| IMP-001/D05 | Sprint Definition of Done includes test coverage requirements                           |
| IMP-001/D08 | Quality Assurance document defines quality gates — testing strategy implements them     |
