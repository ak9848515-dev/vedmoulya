import { describe, expect, it } from 'vitest';
import { GoalUnderstandingService } from '../GoalUnderstandingService.js';

describe('GoalUnderstandingService', () => {
  const service = new GoalUnderstandingService();

  it('derives an ABAP debugger specification with the expected capabilities', () => {
    const spec = service.derive('Build an ABAP debugger for short dumps in production SAP code.');
    expect(spec.pattern).toBe('abap-debugger');
    expect(spec.requiredCapabilities).toContain('coding');
    expect(spec.requiredCapabilities).toContain('reasoning');
    expect(spec.evidenceRequirements).toHaveLength(1);
    expect(spec.evidenceRequirements[0]?.groundingRequired).toBe(true);
    expect(spec.evidenceRequirements[0]?.collection).toContain('loop:abap-debugger');
    expect(spec.successCriteria[0]?.requiredSections).toEqual([
      'Diagnosis',
      'Explanation',
      'Corrected Code',
      'Validation',
    ]);
    expect(spec.maxIterations).toBeGreaterThanOrEqual(8);
    expect(spec.derivationReasons.length).toBeGreaterThan(0);
  });

  it('derives an app-builder specification for a restaurant app', () => {
    const spec = service.derive(
      'Build a modern restaurant application with reservations and menus.',
    );
    expect(spec.pattern).toBe('app-builder');
    expect(spec.successCriteria[0]?.requiredSections).toContain('UI Plan');
    expect(spec.constraints).toContain('modern, contemporary UX');
  });

  it('derives an ai-app-builder specification', () => {
    const spec = service.derive('Build an AI application for customer support automation.');
    expect(spec.pattern).toBe('ai-app-builder');
    expect(spec.successCriteria[0]?.requiredSections).toEqual([
      'Requirements',
      'Architecture',
      'Capabilities',
      'Implementation',
    ]);
  });

  it('falls back to the generic pattern for unknown goals', () => {
    const spec = service.derive('Help me understand quantum entanglement for my physics thesis.');
    expect(spec.pattern).toBe('generic');
  });

  it('rejects goals that are too short', () => {
    expect(() => service.derive('hi')).toThrow();
  });

  it('applies a budget override', () => {
    const spec = service.derive('Build an ABAP debugger for short dumps in production SAP code.', {
      budget: { maxIterations: 3, maxTokens: 1_000 },
    });
    expect(spec.budget.maxIterations).toBe(3);
    expect(spec.budget.maxTokens).toBe(1_000);
    expect(spec.maxIterations).toBe(3);
  });

  it('detects placeholder phrasing as clarification-needed', () => {
    const spec = service.derive('Build an app, you decide what it does.');
    expect(spec.clarificationNeeded).toBeDefined();
    expect(spec.clarificationNeeded?.reason).toContain('placeholder');
  });

  it('detects underspecified goals as clarification-needed', () => {
    const spec = service.derive('Do the thing please.');
    expect(spec.clarificationNeeded).toBeDefined();
  });

  it('does not require clarification for the controlled demos', () => {
    expect(
      service.derive('Build a modern restaurant application.').clarificationNeeded,
    ).toBeUndefined();
    expect(
      service.derive('Build an ABAP debugger for production short dumps.').clarificationNeeded,
    ).toBeUndefined();
  });

  it('derives high risk for critical domains', () => {
    const spec = service.derive('Build a secure payment integration for production billing.');
    expect(spec.riskLevel).toBe('high');
    expect(spec.qualityTier).toBe('premium');
  });
});
