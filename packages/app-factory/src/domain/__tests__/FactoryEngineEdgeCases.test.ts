import { describe, expect, it } from 'vitest';
import { FactoryEngine } from '../FactoryEngine.js';
import { ValidationPipeline } from '../ValidationPipeline.js';
import { SpecificationEngine } from '../SpecificationEngine.js';
import { ArchitectureEngine } from '../ArchitectureEngine.js';
import { DEFAULT_EXECUTION_POLICY } from '../ExecutionPolicy.js';
import { makePorts } from './fixtures.js';

function makeEngine(overrides: Parameters<typeof makePorts>[0] = {}) {
  const ports = makePorts(overrides);
  const engine = new FactoryEngine({
    ...ports,
    versionControl: ports.versionControl,
    deployments: ports.deployments,
  });
  return { engine, ports };
}

describe('FactoryEngine — edge cases (bounded, never silent)', () => {
  it('create: generic web archetype + budget override work', async () => {
    const { engine } = makeEngine();
    const project = await engine.create({
      goal: 'Something entirely new for my team.',
      owner: 'u1',
      budgetOverride: { maxIterations: 4 },
    });
    expect(project.archetype).toBe('generic-web');
    expect(project.specification.budget.maxIterations).toBe(4);
  });

  it('create: throws on empty goal', async () => {
    const { engine } = makeEngine();
    await expect(engine.create({ goal: '   ', owner: 'u1' })).rejects.toThrow('goal is required');
  });

  it('approve: works even before a preview was persisted (builds it on demand)', async () => {
    const { engine } = makeEngine();
    const project = await engine.create({ goal: 'Build a restaurant app.', owner: 'u1' });
    const approved = await engine.approve(project.applicationId, 'u1', 'use Postgres');
    expect(approved.status).toBe('PLANNED');
    expect(approved.planPreview?.approvalChanges).toContain('Postgres');
  });

  it('build: generation loop failure marks the project FAILED with the reason', async () => {
    // A specialist that always throws → the generation loop fails bounded.
    const ports = makePorts();
    const failingSpecialist = {
      execute: async () => {
        throw new Error('provider unavailable (deterministic test)');
      },
      explain: async () => ({
        providerId: 'mock',
        modelId: 'mock-v1',
        reasons: ['x'],
        strategy: 'balanced',
      }),
    };
    const engine = new FactoryEngine({
      ...ports,
      specialist: failingSpecialist as unknown as typeof ports.specialist,
      versionControl: ports.versionControl,
      deployments: ports.deployments,
    });
    const project = await engine.create({ goal: 'Build a restaurant app.', owner: 'u1' });
    await engine.approve(project.applicationId, 'u1');
    const built = await engine.build({
      applicationId: project.applicationId,
      owner: 'u1',
      approved: true,
    });
    expect(built.status).toBe('FAILED');
    expect(built.error).toBeDefined();
    expect(built.economics?.aiCalls).toBeGreaterThanOrEqual(0);
  });

  it('build: unapproved is rejected, grants are honored', async () => {
    const { engine } = makeEngine();
    const project = await engine.create({ goal: 'Build a restaurant app.', owner: 'u1' });
    await expect(
      engine.build({ applicationId: project.applicationId, owner: 'u1', approved: false }),
    ).rejects.toThrow('approved');
    // grants flow into the workspace policy without breaking generation
    await engine.approve(project.applicationId, 'u1');
    const built = await engine.build({
      applicationId: project.applicationId,
      owner: 'u1',
      approved: true,
      grants: { SAFE_WRITE: true },
    });
    expect(built.status).toBe('READY');
  });

  it('deploy: failure is recorded on the project', async () => {
    const ports = makePorts();
    const failingAdapter = {
      target: 'local' as const,
      deploy: async () => ({ status: 'failed' as const, message: 'disk full' }),
    };
    const engine = new FactoryEngine({
      ...ports,
      deployments: { local: failingAdapter as typeof ports.deployments.local },
      versionControl: ports.versionControl,
    });
    const project = await engine.create({ goal: 'Build a restaurant app.', owner: 'u1' });
    await engine.approve(project.applicationId, 'u1');
    await engine.build({ applicationId: project.applicationId, owner: 'u1', approved: true });
    const result = await engine.deploy(project.applicationId, 'u1', {
      target: 'local',
      authorized: true,
    });
    expect(result.status).toBe('failed');
    expect((await engine.get(project.applicationId, 'u1')).deploymentStatus).toBe('failed');
  });

  it('validation: auto-fix adds a missing package.json manifest', () => {
    const specEngine = new SpecificationEngine();
    const archEngine = new ArchitectureEngine();
    const pipeline = new ValidationPipeline();
    const spec = specEngine.derive({
      applicationId: 'app-x',
      owner: 'u1',
      goal: 'Build a restaurant app.',
    });
    const arch = archEngine.derive({ specification: spec });
    const files = [{ path: 'src/index.ts', content: 'export const x = 1;' }];
    const { report, fixes } = pipeline.run({
      applicationId: 'app-x',
      files,
      architecture: arch,
      specification: spec,
      fileOperations: [],
      policy: DEFAULT_EXECUTION_POLICY,
    });
    expect(fixes.some((f) => f.path === 'package.json')).toBe(true);
    expect(report.automaticFixesApplied).toBeGreaterThan(0);
  });

  it('validation: an empty file tree cannot pass (safely partial/fail, never PASS)', () => {
    const specEngine = new SpecificationEngine();
    const archEngine = new ArchitectureEngine();
    const pipeline = new ValidationPipeline();
    const spec = specEngine.derive({
      applicationId: 'app-y',
      owner: 'u1',
      goal: 'Build a restaurant app.',
    });
    const arch = archEngine.derive({ specification: spec });
    const { report } = pipeline.run({
      applicationId: 'app-y',
      files: [],
      architecture: arch,
      specification: spec,
      fileOperations: [],
      policy: DEFAULT_EXECUTION_POLICY,
    });
    expect(report.overall).not.toBe('PASS');
    // build + integration gates fail on an empty tree
    expect(report.gates.find((g) => g.gate === 'build')?.passed).toBe(false);
  });
});
