# Testing Standards

**TECH-002 — Document 06/10 — Engineering Standards Manual**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Engineering Officer (CEngO)
**Created:** 2026-07-27
**Cross-references:** CMP-001, CMP-002, ARC-001, ARC-005, ENG-001, ENG-002, TECH-001/D09, TECH-002/D04, TECH-002/D09, IMP-001/D08

---

## Purpose

This document defines the **mandatory testing standards** for all VedMoulya code. Testing is not optional — it is an integral part of engineering. These standards supersede and formalize the testing strategy defined in TECH-001/D09.

---

## Testing Philosophy

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    VEDMOULYA TESTING PHILOSOPHY                           │
│                                                                           │
│  1. TESTS ARE EXECUTABLE SPECIFICATIONS                                   │
│     A passing test suite is the most reliable documentation.              │
│                                                                           │
│  2. TEST THE BEHAVIOR, NOT THE IMPLEMENTATION                             │
│     Tests verify what the system does, not how it does it.                │
│     Implementation changes should not break tests unless behavior changes.│
│                                                                           │
│  3. WRITE TESTS ALONGSIDE CODE, NOT AFTER                                 │
│     Tests are not a phase. They are written in parallel with code.        │
│     For contract-first development, tests come before implementation.     │
│                                                                           │
│  4. AI GENERATES, HUMANS VALIDATE                                         │
│     AI creates comprehensive test suites. Humans validate that the        │
│     tests actually verify the right behavior — not just that they pass.   │
│                                                                           │
│  5. CONFIDENCE, NOT COVERAGE                                              │
│     The goal is confidence that the system works correctly.               │
│     Coverage is a means, not an end.                                      │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Testing Pyramid

```text
                    /\
                   /  \
                  /    \
                 /  E2E  \          ← Few: Full user journeys through all layers
                /  Tests   \
               /────────────\
              /              \
             /  AI Quality   \      ← Critical: AI output validation
            /    Tests        \        Accuracy, safety, consistency
           /────────────────────\
          /                      \
         /   Integration Tests   \    ← Some: Service interactions, cross-module flows
        /     (API-level)          \
       /────────────────────────────\
      /                              \
     /     Contract Tests             \ ← Many: Contract compliance, schema validation
    /       (Service API)              \
   /────────────────────────────────────\
  /                                      \
 /         Unit Tests                    \  ← Most: Isolated function/class/component tests
/          (Function-level)              \
/──────────────────────────────────────────\
```

## Test Type Standards

### Unit Tests

| Aspect               | Standard                                                          |
| -------------------- | ----------------------------------------------------------------- |
| **What to test**     | Individual functions, classes, components in isolation            |
| **What NOT to test** | Framework behavior, external integrations, implementation details |
| **Framework**        | Vitest (backend), Vitest + Testing Library (frontend)             |
| **Coverage target**  | ≥90% business logic, ≥80% overall new code                        |
| **Execution time**   | < 100ms per test, < 30s for full suite                            |
| **Isolation**        | No network calls, no file system access, no database              |
| **Structure**        | Arrange → Act → Assert (AAA)                                      |

```typescript
// ✅ GOOD: Unit test — Arrange → Act → Assert
describe('ScoreCalculator', () => {
  describe('calculate', () => {
    it('should return weighted score when valid achievements provided', () => {
      // Arrange
      const achievements = [
        { value: 10, weight: 2 },
        { value: 5, weight: 1 },
      ];
      const calculator = new ScoreCalculator();

      // Act
      const result = calculator.calculate(achievements);

      // Assert
      expect(result).toBe(25); // (10*2) + (5*1)
    });

    it('should return 0 when no achievements provided', () => {
      const calculator = new ScoreCalculator();
      expect(calculator.calculate([])).toBe(0);
    });

    it('should throw error when achievements array is null', () => {
      const calculator = new ScoreCalculator();
      expect(() => calculator.calculate(null as unknown as Achievement[])).toThrow(
        'Achievements array is required',
      );
    });
  });
});
```

### Contract Tests

| Aspect              | Standard                                             |
| ------------------- | ---------------------------------------------------- |
| **What to test**    | Service API matches contract specification           |
| **When to write**   | Before implementation (contract-first)               |
| **Coverage target** | 100% of contract fields                              |
| **Tools**           | OpenAPI validation, Pact (consumer-driven contracts) |

```typescript
// ✅ GOOD: Contract test (OpenAPI validation)
describe('POST /api/v1/users', () => {
  it('should accept valid create user request', async () => {
    const response = await request(app)
      .post('/api/v1/users')
      .send({
        email: 'alice@example.com',
        name: 'Alice',
        role: 'user',
      })
      .expect(201);

    // Validate response matches OpenAPI schema
    expect(response.body).toMatchSchema(createUserResponseSchema);
  });

  it('should reject request without required email field', async () => {
    await request(app).post('/api/v1/users').send({ name: 'Alice' }).expect(400);
  });
});
```

### Integration Tests

| Aspect                    | Standard                                           |
| ------------------------- | -------------------------------------------------- |
| **What to test**          | Service interactions through API boundaries        |
| **When to write**         | After unit tests, before E2E                       |
| **Coverage target**       | ≥80% of interaction paths (MVP), ≥90% (enterprise) |
| **Test data**             | Use test fixtures, never production data           |
| **External dependencies** | Use test containers or mocks                       |

```typescript
// ✅ GOOD: Integration test with database
describe('UserService Integration', () => {
  let userService: UserService;
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await TestDatabase.create();
    userService = new UserService(new UserRepository(testDb.connection));
  });

  afterAll(async () => {
    await testDb.destroy();
  });

  beforeEach(async () => {
    await testDb.clear();
  });

  it('should persist and retrieve user', async () => {
    const user = await userService.createUser({
      email: 'alice@example.com',
      name: 'Alice',
    });
    const retrieved = await userService.getUserById(user.id);
    expect(retrieved).toEqual(user);
  });
});
```

### E2E Tests

| Aspect              | Standard                                     |
| ------------------- | -------------------------------------------- |
| **What to test**    | Full user journeys through all system layers |
| **Coverage target** | ≥30% of critical user journeys               |
| **Tools**           | Playwright (web)                             |
| **CI execution**    | Smoke tests only; full suite runs nightly    |

### AI Quality Tests

| Aspect                 | Standard                                            |
| ---------------------- | --------------------------------------------------- |
| **What to test**       | AI output accuracy, safety, consistency, formatting |
| **Framework**          | Custom evaluation framework                         |
| **Coverage**           | All AI response types                               |
| **Accuracy threshold** | ≥90% (structured output), ≥80% (unstructured)       |
| **Safety threshold**   | 100% pass                                           |

```typescript
// ✅ GOOD: AI quality test
describe('AI Response Validation', () => {
  it('should detect hallucination in generated content', async () => {
    const response = await orchestrator.generate({
      task: 'Explain VedMoulya',
      context: { user: { name: 'Alice' } },
    });
    const validation = await validateResponse(response);
    expect(validation.hallucinationDetected).toBe(false);
    expect(validation.safetyPassed).toBe(true);
    expect(validation.formatValid).toBe(true);
  });
});
```

---

## Coverage Requirements

### By Phase

| Metric          | Phase 1-2 (Prototype/Alpha) | Phase 3-4 (Beta/MVP) | Phase 5+ (Growth/Enterprise) |
| --------------- | --------------------------- | -------------------- | ---------------------------- |
| Unit (new code) | ≥70%                        | ≥80%                 | ≥90%                         |
| Unit (overall)  | ≥50%                        | ≥70%                 | ≥85%                         |
| Contract        | 100% of contracts           | 100%                 | 100%                         |
| Integration     | ≥50% of paths               | ≥70%                 | ≥80%                         |
| E2E             | Manual (critical journeys)  | ≥30% automated       | ≥50% automated               |
| AI accuracy     | ≥70%                        | ≥80%                 | ≥90%                         |
| AI safety       | 100%                        | 100%                 | 100%                         |

### Quality Gates

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    TEST QUALITY GATES                                     │
│                                                                           │
│  PRE-COMMIT (Local)                                                      │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  • Changed files unit tests pass                                  │    │
│  │  • TypeScript type check passes                                   │    │
│  │  • Lint passes                                                    │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  PR CHECK (CI)                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  • All unit tests pass (full suite)                              │    │
│  │  • Affected contract tests pass                                  │    │
│  │  • Affected integration tests pass                               │    │
│  │  • Coverage meets thresholds (gate: ≥80% new code)               │    │
│  │  • AI quality tests pass (if AI code changed)                    │    │
│  │  • Security scan passes (no critical/high vulns)                 │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  STAGING (Pre-release)                                                  │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  • Full test suite passes                                        │    │
│  │  • E2E smoke tests pass (critical journeys)                     │    │
│  │  • Performance baseline validated                                 │    │
│  │  • DAST security scan passes                                     │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  PRODUCTION (Post-release)                                              │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  • Smoke tests pass                                              │    │
│  │  • Performance regression check passes                            │    │
│  │  • Error rate within threshold                                    │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Test Naming and Structure

### Test Organization

```text
co-located (preferred for simple components):
  src/
    components/
      button/
        button.tsx
        button.test.tsx          ← Co-located test
        button.stories.tsx       ← Storybook story

separate directory (for services/complex modules):
  src/
    services/
      user/
        user.service.ts
        __tests__/
          user.service.test.ts   ← Separate test directory
          user.service.int.test.ts ← Integration test (suffix: .int.test.ts)
  __tests__/                      ← Package-level tests
    e2e/
      user-journey.test.ts        ← E2E tests
    fixtures/
      users.fixture.ts            ← Test fixtures
```

### Test Naming Conventions

| Element          | Convention              | Example                         |
| ---------------- | ----------------------- | ------------------------------- |
| Unit test file   | `{source}.test.ts`      | `user.service.test.ts`          |
| Integration test | `{source}.int.test.ts`  | `user.service.int.test.ts`      |
| E2E test         | `{journey}.e2e.test.ts` | `user-registration.e2e.test.ts` |
| Test fixture     | `{name}.fixture.ts`     | `test-users.fixture.ts`         |
| Test mock        | `{name}.mock.ts`        | `user-repository.mock.ts`       |
| Test helper      | `{purpose}.helper.ts`   | `test-db.helper.ts`             |

### Test Description Conventions

```typescript
describe('{Module}/{Component}/{Function}', () => {
  describe('{method name}', () => {
    it('should {expected behavior} when {condition}', () => {
      // ...
    });

    it('should {expected behavior} when {edge case}', () => {
      // ...
    });

    it('should throw {error} when {invalid condition}', () => {
      // ...
    });
  });
});
```

---

## AI-Generated Tests

### AI Testing Responsibilities

| Task                 | AI Role                               | Human Role                        |
| -------------------- | ------------------------------------- | --------------------------------- |
| Test case generation | Generate comprehensive test scenarios | Validate coverage; add edge cases |
| Test data generation | Generate fixtures and mocks           | Ensure data privacy (no PII)      |
| Test execution       | Run test suites                       | Investigate failures              |
| Test maintenance     | Update tests on refactoring           | Verify test correctness           |
| Test analysis        | Identify gaps and flaky tests         | Prioritize fixes                  |

### AI Test Validation Checklist

Before accepting AI-generated tests, humans must verify:

- [ ] Tests actually test the behavior, not just run without errors
- [ ] Edge cases are covered (null, empty, invalid input, boundary values)
- [ ] Test names are descriptive and follow conventions
- [ ] No PII or secrets in test data
- [ ] Tests are deterministic (no flakiness from randomness or timing)
- [ ] Mock expectations are correct (not overly permissive or restrictive)
- [ ] Tests run in CI without external dependencies

---

## Test Data Management

| Data Type             | Source                              | Rules                                             |
| --------------------- | ----------------------------------- | ------------------------------------------------- |
| **Fixtures**          | Defined in `__tests__/fixtures/`    | No PII. Use deterministic data.                   |
| **Mocks**             | Defined in `__tests__/mocks/`       | Mock external interfaces, not internal functions. |
| **Generated**         | AI-generated test data              | Must be reviewed for correctness and privacy.     |
| **Production shadow** | Anonymized production data (opt-in) | Never use raw production data. Always anonymize.  |
| **Seeds**             | Database seed scripts               | Only for development and CI environments.         |

---

## Flaky Test Management

| Rule           | Standard                                                  |
| -------------- | --------------------------------------------------------- |
| **Detection**  | A test that fails intermittently is a flaky test          |
| **Quarantine** | Flaky tests are moved to a quarantined test suite         |
| **Priority**   | Fix flaky tests within 1 sprint                           |
| **Escalation** | Repeated flaky test → escalate to CEngO                   |
| **Retry**      | Never retry tests to "fix" flakiness — fix the root cause |

---

## Performance Testing

| Test Type          | When                           | Tool | Threshold                          |
| ------------------ | ------------------------------ | ---- | ---------------------------------- |
| **Load test**      | Pre-release for critical paths | k6   | P95 latency < 500ms                |
| **Stress test**    | Quarterly                      | k6   | Graceful degradation under 3x load |
| **Endurance test** | Nightly (critical paths)       | k6   | No memory leak over 24h            |
| **Spike test**     | Quarterly                      | k6   | Recovery within 5 minutes          |

---

## Security Testing

| Test Type                   | Tool             | Frequency         |
| --------------------------- | ---------------- | ----------------- |
| **SAST** (Static Analysis)  | Semgrep          | Every PR          |
| **Dependency scan**         | Snyk / npm audit | Every PR          |
| **Secret detection**        | gitleaks         | Every commit      |
| **DAST** (Dynamic Analysis) | OWASP ZAP        | Weekly on staging |
| **Penetration test**        | External firm    | Annual            |

---

## Definition of Done (Testing)

A user story or feature is "done" only when:

```markdown
- [ ] Unit tests written and passing (≥80% coverage for new code)
- [ ] Integration tests written for API endpoints
- [ ] Contract tests passing (if API contract changed)
- [ ] E2E tests passing (if user journey changed)
- [ ] AI quality tests passing (if AI behavior changed)
- [ ] Security scan passes (no critical/high vulnerabilities)
- [ ] Performance baseline validated (if performance-critical path)
- [ ] All tests pass in CI
- [ ] Test coverage report reviewed
```

---

## Cross-Reference Summary

| Reference        | Relationship to Testing Standards                             |
| ---------------- | ------------------------------------------------------------- |
| **TECH-001/D09** | Testing Strategy — superseded by this operational document    |
| **TECH-002/D04** | Coding Standards — test code must follow coding standards too |
| **TECH-002/D09** | Code Review Standards — tests are reviewed alongside code     |
| **IMP-001/D08**  | Quality Assurance — quality gates include test requirements   |
| **CMP-002**      | Security testing aligns with compliance requirements          |
| **ARC-005**      | AI Quality Tests validate AI Orchestrator output              |
| **ENG-002**      | Contract Tests validate service contract compliance           |

---

## Document Governance

| Aspect                     | Standard                                                             |
| -------------------------- | -------------------------------------------------------------------- |
| **Version**                | 1.0                                                                  |
| **Status**                 | Final                                                                |
| **Owner**                  | Chief Engineering Officer (CEngO)                                    |
| **Review Cadence**         | Quarterly                                                            |
| **Approval Required**      | CEngO + QA Lead                                                      |
| **Violation Consequences** | PR blocked if coverage thresholds not met; flaky tests block release |
