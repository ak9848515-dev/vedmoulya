# BLD-009A — Extension Guide

## Execution Intelligence Engine — Quality Hardening

### Extending the Execution Engine

This guide documents how to extend the Execution Intelligence Engine while maintaining quality standards.

---

## Adding a New Service Method

1. Add the method to the appropriate service class (e.g., `PlanningService`, `SchedulingService`)
2. If the method uses a new DTO field, add validation to `ExecutionSchemas.ts`
3. Create a test file following the existing patterns:
   - Mock the repository dependency
   - Test success path, error path, and edge cases
   - Cover validation failures if applicable

### Example Pattern

```typescript
// In __tests__/PlanningService.test.ts
it('handles new edge case', async () => {
  const repo = createMockRepo();
  const svc = new PlanningService(repo as any, mockKnowledge, mockDecision);

  const result = await svc.newMethod({ ... });

  expect(result.success).toBe(true);
  expect(result.data!.someField).toBe(expected);
});
```

---

## Adding a New Integration Client

1. Create the client class in `services/execution/src/integration/`
2. Follow the existing pattern: constructor reads `BASE_URL` and `ENABLED` from env vars
3. Each method should gracefully handle: service disabled, HTTP errors, network errors
4. Export from `index.ts`
5. Create tests in `services/execution/src/integration/__tests__/`

### Required Test Coverage

- ✅ Disabled state returns default value
- ✅ Successful response returns correct data
- ✅ HTTP error returns fallback
- ✅ Network error returns fallback
- ✅ Malformed response returns fallback

---

## Adding a New Observability Metric

1. Add the metric name constant to `MetricNames` in `ExecutionMetrics.ts`
2. Add a `record*()` method to `ExecutionMetrics`
3. Create test cases in `services/execution/src/observability/__tests__/`

---

## API Contract Changes

If modifying request/response schemas:

1. Update the Zod schema in `presentation/validation/ExecutionSchemas.ts`
2. Update `services/execution/src/presentation/__tests__/ExecutionSchemas.test.ts`
3. Update the `ExecutionMapper` mapping functions
4. Add round-trip test (DTO → Domain → DTO)

---

## Architecture Compliance Checklist

When extending the Execution Engine, verify:

- [ ] Decision Engine is consumed, not modified
- [ ] Knowledge Graph is read-only
- [ ] Memory Engine is consumed via contracts
- [ ] AI Orchestrator is used for AI capabilities only
- [ ] All new features have explainability support
- [ ] All new features emit domain events
- [ ] All new features have audit logging
- [ ] Tests cover ≥95% of new code
