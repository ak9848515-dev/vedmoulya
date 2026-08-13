// ──────────────────────────────────────────────────────────────────
// VedMoulya — Capability Entity Unit Tests
// Covers lifecycle, versioning, composition, dependency, and metadata
// mutation paths that the application-service tests do not reach.
// EI-001 — Enterprise Capability Registry & Marketplace
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { Capability } from '../entities/Capability.js';
import { CapabilityStatus } from '../value-objects/CapabilityStatus.js';
import { CapabilityVersion } from '../value-objects/CapabilityVersion.js';
import { createCapabilityId } from '../value-objects/CapabilityId.js';
import { CapabilityGraphService } from '../services/CapabilityGraphService.js';
import { CapabilityCompositionService } from '../services/CapabilityCompositionService.js';

function baseParams(overrides: Partial<Parameters<typeof Capability.create>[0]> = {}) {
  return {
    id: createCapabilityId('cap_entity'),
    name: 'Entity Capability',
    category: 'content' as const,
    description: 'test',
    owner: 'tester',
    ...overrides,
  };
}

describe('Capability entity', () => {
  it('applies constructor defaults for optional profiles', () => {
    const cap = Capability.create(baseParams());
    expect(cap.inputs).toEqual([]);
    expect(cap.outputs).toEqual([]);
    expect(cap.dependencies).toEqual([]);
    expect(cap.requiredAIFeatures).toEqual([]);
    expect(cap.cost).toEqual({ estimatedCostUsd: 0, tier: 'free' });
    expect(cap.tokens).toEqual({ estimatedInputTokens: 0, estimatedOutputTokens: 0 });
    expect(cap.latency).toEqual({ p50Ms: 0, p95Ms: 0 });
    expect(cap.quality).toEqual({ target: 0.9, minimum: 0.7 });
    expect(cap.confidence).toBe(0.5);
    expect(cap.version.toString()).toBe('1.0.0');
    expect(cap.status.value).toBe('design');
    expect(cap.isComposition).toBe(false);
  });

  it('exposes frozen read-only collections', () => {
    const cap = Capability.create(
      baseParams({
        inputs: ['text'],
        outputs: ['summary'],
        dependencies: [createCapabilityId('research')],
        requiredAIFeatures: ['content_generation'],
        tags: ['x'],
        businessModules: ['content-agency'],
      }),
    );
    expect(Object.isFrozen(cap.inputs)).toBe(true);
    expect(Object.isFrozen(cap.outputs)).toBe(true);
    expect(Object.isFrozen(cap.dependencies)).toBe(true);
    expect(Object.isFrozen(cap.requiredAIFeatures)).toBe(true);
    expect(cap.businessModules).toEqual(['content-agency']);
  });

  it('transitions through lifecycle and rejects invalid transitions', () => {
    const cap = Capability.create(baseParams());
    cap.transitionTo('draft');
    expect(cap.status.value).toBe('draft');
    cap.transitionTo('testing');
    cap.transitionTo('active');
    expect(cap.status.isActive()).toBe(true);
    expect(() => cap.transitionTo('archived')).toThrow(/Cannot transition/);
  });

  it('bumps major, minor, and patch versions', () => {
    const cap = Capability.create(baseParams());
    cap.bumpPatch();
    expect(cap.version.toString()).toBe('1.0.1');
    cap.bumpMinor();
    expect(cap.version.toString()).toBe('1.1.0');
    cap.bumpMajor();
    expect(cap.version.toString()).toBe('2.0.0');
  });

  it('setComposition replaces children and bumps minor', () => {
    const cap = Capability.create(baseParams());
    cap.setComposition([
      { id: createCapabilityId('research'), slot: 'research' },
      { id: createCapabilityId('writing'), slot: 'writing' },
    ]);
    expect(cap.isComposition).toBe(true);
    expect(cap.composition.map((c) => c.slot)).toEqual(['research', 'writing']);
    expect(cap.version.toString()).toBe('1.1.0');
  });

  it('updateDetails applies every field', () => {
    const cap = Capability.create(baseParams());
    cap.updateDetails({
      name: 'Renamed',
      category: 'analysis',
      description: 'new desc',
      owner: 'new owner',
      inputs: ['in'],
      outputs: ['out'],
      tags: ['t1'],
      documentationUrl: 'https://docs.example.com',
    });
    expect(cap.name).toBe('Renamed');
    expect(cap.category).toBe('analysis');
    expect(cap.description).toBe('new desc');
    expect(cap.owner).toBe('new owner');
    expect(cap.inputs).toEqual(['in']);
    expect(cap.outputs).toEqual(['out']);
    expect(cap.tags).toEqual(['t1']);
    expect(cap.documentationUrl).toBe('https://docs.example.com');
    expect(cap.version.toString()).toBe('1.0.1');
  });

  it('updateProfiles applies every profile', () => {
    const cap = Capability.create(baseParams());
    cap.updateProfiles({
      cost: { estimatedCostUsd: 5, tier: 'premium' },
      tokens: { estimatedInputTokens: 100, estimatedOutputTokens: 50 },
      latency: { p50Ms: 100, p95Ms: 500 },
      quality: { target: 0.95, minimum: 0.8 },
      confidence: 0.9,
    });
    expect(cap.cost.tier).toBe('premium');
    expect(cap.tokens.estimatedInputTokens).toBe(100);
    expect(cap.latency.p95Ms).toBe(500);
    expect(cap.quality.target).toBe(0.95);
    expect(cap.confidence).toBe(0.9);
  });

  it('addDependency rejects self-reference and duplicates', () => {
    const cap = Capability.create(baseParams());
    expect(() => cap.addDependency(cap.id)).toThrow(/cannot depend on itself/);
    cap.addDependency(createCapabilityId('research'));
    expect(cap.dependencies).toEqual([createCapabilityId('research')]);
    // Duplicate is a no-op (no version bump).
    cap.addDependency(createCapabilityId('research'));
    expect(cap.dependencies).toHaveLength(1);
    expect(cap.version.toString()).toBe('1.1.0');
  });

  it('removeDependency filters and bumps minor', () => {
    const cap = Capability.create(
      baseParams({ dependencies: [createCapabilityId('research'), createCapabilityId('writing')] }),
    );
    cap.removeDependency(createCapabilityId('research'));
    expect(cap.dependencies).toEqual([createCapabilityId('writing')]);
    expect(cap.version.toString()).toBe('1.1.0');
  });

  it('addBusinessModule deduplicates', () => {
    const cap = Capability.create(baseParams({ businessModules: ['learning'] }));
    cap.addBusinessModule('content-agency');
    expect(cap.businessModules).toEqual(['learning', 'content-agency']);
    cap.addBusinessModule('learning');
    expect(cap.businessModules).toHaveLength(2);
  });
});

describe('CapabilityStatus value object', () => {
  it('equals compares the underlying value', () => {
    expect(CapabilityStatus.design().equals(CapabilityStatus.fromStatus('design'))).toBe(true);
    expect(CapabilityStatus.design().equals(CapabilityStatus.create('draft'))).toBe(false);
    expect(CapabilityStatus.create('archived').isArchived()).toBe(true);
    expect(CapabilityStatus.design().progression).toBe(0);
    expect(CapabilityStatus.design().toString()).toBe('design');
  });

  it('allowedTransitions and canTransitionTo agree', () => {
    const active = CapabilityStatus.fromStatus('active');
    expect(active.allowedTransitions).toEqual(['deprecated', 'draft']);
    expect(active.canTransitionTo('deprecated')).toBe(true);
    expect(active.canTransitionTo('testing')).toBe(false);
  });
});

describe('CapabilityVersion value object', () => {
  it('fromString tolerates partial and non-numeric parts', () => {
    expect(CapabilityVersion.fromString('2.3.4').toString()).toBe('2.3.4');
    expect(CapabilityVersion.fromString('2').toString()).toBe('2.0.0');
    expect(CapabilityVersion.fromString('abc.def').toString()).toBe('1.0.0');
    expect(CapabilityVersion.initial().equals(CapabilityVersion.initial())).toBe(true);
  });
});

describe('Capability graph and composition services', () => {
  it('detects dependency cycles', () => {
    const a = Capability.create(
      baseParams({ id: createCapabilityId('cyc_a'), dependencies: [createCapabilityId('cyc_b')] }),
    );
    const b = Capability.create(
      baseParams({ id: createCapabilityId('cyc_b'), dependencies: [createCapabilityId('cyc_a')] }),
    );
    const result = new CapabilityGraphService().detectCycles([a, b]);
    expect(result.hasCycle).toBe(true);
    expect(result.cycles.length).toBeGreaterThan(0);
  });

  it('getTransitiveDependencies skips self and dedupes', () => {
    const research = Capability.create(baseParams({ id: createCapabilityId('research') }));
    const writing = Capability.create(
      baseParams({
        id: createCapabilityId('writing'),
        dependencies: [createCapabilityId('research')],
      }),
    );
    const gen = Capability.create(
      baseParams({
        id: createCapabilityId('gen'),
        dependencies: [createCapabilityId('writing'), createCapabilityId('research')],
      }),
    );
    const svc = new CapabilityGraphService();
    const deps = svc.getTransitiveDependencies([gen, writing, research], createCapabilityId('gen'));
    expect(deps).toContain(createCapabilityId('writing'));
    expect(deps).toContain(createCapabilityId('research'));
  });

  it('composition service detects cycles', () => {
    const a = Capability.create(
      baseParams({
        id: createCapabilityId('comp_a'),
        composition: [{ id: createCapabilityId('comp_b') }],
      }),
    );
    const b = Capability.create(
      baseParams({
        id: createCapabilityId('comp_b'),
        composition: [{ id: createCapabilityId('comp_a') }],
      }),
    );
    const check = new CapabilityCompositionService().validate(a, [a, b]);
    expect(check.valid).toBe(false);
  });
});
