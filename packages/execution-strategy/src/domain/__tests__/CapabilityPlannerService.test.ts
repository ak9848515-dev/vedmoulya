// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Strategy Tests: CapabilityPlannerService
// EI-004 — Enterprise Execution Strategy Engine
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { CapabilityPlannerService } from '../services/CapabilityPlannerService.js';
import type { CapabilityPlanStep } from '../../types/strategy-types.js';

function makeStep(overrides: Partial<CapabilityPlanStep> = {}): CapabilityPlanStep {
  return {
    stepId: 'step_test',
    capability: 'reasoning',
    label: 'Test Step',
    description: 'A test step',
    flowType: 'sequential',
    support: 'required',
    skippable: false,
    weight: 0.5,
    eligibleFamilies: ['anthropic', 'openai'],
    children: [],
    ...overrides,
  };
}

describe('CapabilityPlannerService', () => {
  const service = new CapabilityPlannerService();

  it('selects the content-generation template for blog/goal goals', () => {
    const plan = service.plan('Generate a blog post about microservices');
    expect(plan.steps.map((s) => s.label)).toEqual([
      'Research',
      'Writing',
      'SEO',
      'Review',
      'Publishing',
    ]);
    expect(plan.requiredCapabilities).toContain('content_generation');
    expect(plan.requiredCapabilities).toContain('reasoning');
    expect(plan.feasible).toBe(true);
  });

  it('selects the summarization template for summarize goals', () => {
    const plan = service.plan('Summarize the quarterly report');
    expect(plan.steps[0]!.capability).toBe('summarization');
    expect(plan.requiredCapabilities).toContain('summarization');
  });

  it('selects the translation template for translate goals', () => {
    const plan = service.plan('Translate this document to French');
    expect(plan.steps[0]!.capability).toBe('translation');
  });

  it('selects the analysis template for analyze goals', () => {
    const plan = service.plan('Analyze the client engagement data');
    expect(plan.steps[0]!.capability).toBe('reasoning');
    expect(plan.steps.map((s) => s.label)).toContain('Analysis');
  });

  it('selects the classification template for classify goals', () => {
    const plan = service.plan('Classify the support tickets');
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]!.capability).toBe('classification');
  });

  it('selects the learning template for learning goals', () => {
    const plan = service.plan('Study TypeScript through a structured curriculum');
    expect(plan.steps.map((s) => s.label)).toContain('Assessment');
    expect(plan.requiredCapabilities).toContain('reasoning');
  });

  it('falls back to a generic pipeline for unmatched goals', () => {
    const plan = service.plan('Do something completely unusual');
    expect(plan.steps).toHaveLength(3);
    expect(plan.steps.map((s) => s.label)).toEqual(['Understanding', 'Planning', 'Execution']);
  });

  it('marks optional/conditional steps as skippable', () => {
    const plan = service.plan('Generate a blog post');
    const seo = plan.steps.find((s) => s.label === 'SEO');
    const research = plan.steps.find((s) => s.label === 'Research');
    expect(seo!.skippable).toBe(true);
    expect(research!.skippable).toBe(false);
  });

  it('collects required capabilities recursively with nested children', () => {
    const plan = service.planWithDecomposition('Complex goal', [
      makeStep({
        stepId: 'parent',
        label: 'Parent',
        children: [
          makeStep({ stepId: 'child_required', capability: 'coding', label: 'Child' }),
          makeStep({
            stepId: 'grandchild',
            label: 'Grandchild',
            support: 'optional',
            skippable: true,
            children: [makeStep({ stepId: 'deep', capability: 'vision', label: 'Deep' })],
          }),
        ],
      }),
    ]);
    expect(plan.requiredCapabilities).toContain('reasoning');
    expect(plan.requiredCapabilities).toContain('coding');
    expect(plan.requiredCapabilities).toContain('vision');
  });

  it('builds a human-readable plan summary', () => {
    const plan = service.plan('Generate a blog post');
    expect(plan.summary).toMatch(/5 step plan/);
    expect(plan.summary).toContain('Research');
    expect(plan.summary).toContain('Publishing');
  });

  it('is feasible when at least one required non-skippable step exists', () => {
    const onlyOptional = service.planWithDecomposition('Optional goal', [
      makeStep({ support: 'optional', skippable: true }),
    ]);
    expect(onlyOptional.feasible).toBe(false);
  });
});
