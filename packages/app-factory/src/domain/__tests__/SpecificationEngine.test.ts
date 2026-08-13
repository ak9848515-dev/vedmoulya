import { describe, expect, it } from 'vitest';
import { SpecificationEngine } from '../SpecificationEngine.js';

describe('SpecificationEngine — Phase 1', () => {
  const engine = new SpecificationEngine();

  it('derives a typed specification for the ABAP debugger', () => {
    const spec = engine.derive({
      applicationId: 'app-1',
      owner: 'u1',
      goal: 'Build an ABAP debugger.',
    });
    expect(spec.archetype).toBe('abap-debugger');
    expect(spec.features).toContain('ABAP source analysis & error diagnosis');
    expect(spec.requirements.some((r) => r.description.toLowerCase().includes('abap'))).toBe(true);
    expect(spec.acceptanceCriteria.some((c) => c.toLowerCase().includes('diagnosis'))).toBe(true);
    expect(spec.derivationReasons.length).toBeGreaterThan(0);
  });

  it('derives the restaurant archetype with menu + cart + order features', () => {
    const spec = engine.derive({
      applicationId: 'app-2',
      owner: 'u1',
      goal: 'Build a modern restaurant ordering application.',
    });
    expect(spec.archetype).toBe('restaurant-app');
    expect(spec.features).toContain('Menu browsing');
    expect(spec.features).toContain('Cart management');
    expect(spec.features).toContain('Order placement');
  });

  it('derives the AI app builder archetype (meta-test)', () => {
    const spec = engine.derive({
      applicationId: 'app-3',
      owner: 'u1',
      goal: 'Build an AI application for customer support.',
    });
    expect(spec.archetype).toBe('ai-app-builder');
    expect(spec.features.some((f) => f.toLowerCase().includes('ai'))).toBe(true);
  });

  it('marks unresolved requirements instead of silently assuming them', () => {
    const spec = engine.derive({
      applicationId: 'app-4',
      owner: 'u1',
      goal: 'Build a restaurant app.',
    });
    expect(spec.unresolved.length).toBeGreaterThan(0);
    const dataUnresolved = spec.unresolved.find((u) => u.label.toLowerCase().includes('data'));
    expect(dataUnresolved).toBeDefined();
    // the requirement itself is flagged, not invented
    expect(spec.requirements.filter((r) => r.status === 'unresolved').length).toBe(
      spec.unresolved.length,
    );
  });

  it('inferring is explained — no uncontrolled interpretation', () => {
    const spec = engine.derive({
      applicationId: 'app-5',
      owner: 'u1',
      goal: 'Build an ABAP debugger.',
    });
    const reason = spec.derivationReasons.find((r) => r.includes('ABAP'));
    expect(reason).toBeDefined();
  });

  it('throws on an empty goal', () => {
    expect(() => engine.derive({ applicationId: 'app-6', owner: 'u1', goal: '   ' })).toThrow(
      'goal is required',
    );
  });

  it('applies a budget override', () => {
    const spec = engine.derive({
      applicationId: 'app-7',
      owner: 'u1',
      goal: 'Build a restaurant app.',
      budget: { maxIterations: 3 },
    });
    expect(spec.budget.maxIterations).toBe(3);
  });
});
