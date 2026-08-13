import { describe, expect, it } from 'vitest';
import { SpecificationEngine } from '../SpecificationEngine.js';
import { ArchitectureEngine } from '../ArchitectureEngine.js';

describe('ArchitectureEngine — Phase 2', () => {
  const specEngine = new SpecificationEngine();
  const archEngine = new ArchitectureEngine();

  it('derives a technology-aware architecture for the restaurant app', () => {
    const spec = specEngine.derive({
      applicationId: 'app-1',
      owner: 'u1',
      goal: 'Build a modern restaurant ordering application.',
    });
    const arch = archEngine.derive({ specification: spec });
    expect(arch.applicationId).toBe('app-1');
    expect(
      arch.layers.some((l) => l.layer === 'frontend' && l.technology.includes('Next.js')),
    ).toBe(true);
    expect(arch.layers.every((l) => l.rationale.length > 0)).toBe(true);
    expect(arch.dataModel.some((e) => e.entity === 'MenuItem')).toBe(true);
    expect(arch.apiContract.some((e) => e.endpoint === '/api/orders' && e.method === 'POST')).toBe(
      true,
    );
  });

  it('biases toward reusing the platform (no vendor lock-in)', () => {
    const spec = specEngine.derive({
      applicationId: 'app-2',
      owner: 'u1',
      goal: 'Build an ABAP debugger.',
    });
    const arch = archEngine.derive({ specification: spec });
    const platformLayers = arch.layers.filter((l) => l.reusesPlatform).length;
    expect(platformLayers).toBeGreaterThanOrEqual(8);
    expect(arch.aiCapabilities.some((c) => c.capability === 'coding')).toBe(true);
  });

  it('includes security controls and performance targets', () => {
    const spec = specEngine.derive({
      applicationId: 'app-3',
      owner: 'u1',
      goal: 'Build a restaurant app.',
    });
    const arch = archEngine.derive({ specification: spec });
    expect(arch.securityControls.some((c) => c.toLowerCase().includes('authentication'))).toBe(
      true,
    );
    expect(arch.performanceTargets.length).toBeGreaterThan(0);
  });

  it('honors a deployment target override', () => {
    const spec = specEngine.derive({
      applicationId: 'app-4',
      owner: 'u1',
      goal: 'Build a restaurant app.',
    });
    const arch = archEngine.derive({ specification: spec, deploymentTarget: 'vercel' });
    expect(arch.deploymentTarget).toBe('vercel');
  });
});
