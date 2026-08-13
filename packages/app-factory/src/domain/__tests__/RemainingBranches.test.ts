import { describe, expect, it } from 'vitest';
import { FileOperationLayer } from '../FileOperationLayer.js';
import { InMemoryWorkspace } from '../../infrastructure/InMemoryWorkspace.js';
import { DEFAULT_EXECUTION_POLICY } from '../ExecutionPolicy.js';
import { generateProject } from '../../catalog/generator.js';
import { SecurityReviewer } from '../SecurityReviewer.js';
import { SpecificationEngine } from '../SpecificationEngine.js';
import { ArchitectureEngine } from '../ArchitectureEngine.js';
import { FactoryMapper } from '../../application/FactoryMapper.js';
import { FactoryEngine } from '../FactoryEngine.js';
import { makePorts } from './fixtures.js';

describe('FileOperationLayer — remaining branches', () => {
  const policy = DEFAULT_EXECUTION_POLICY;

  it('rejects unknown operation kinds and duplicate creates', () => {
    const ws = new InMemoryWorkspace('app-1', policy, [{ path: 'src/a.ts', content: 'x' }]);
    const layer = new FileOperationLayer(ws, policy);
    // duplicate create rejected
    expect(() =>
      layer.apply(
        layer.plan({
          kind: 'create',
          path: 'src/a.ts',
          content: 'y',
          reason: 'dup',
          originatingTask: 't',
        }),
      ),
    ).toThrow('already exists');
    // modify of a missing file rejected
    expect(() =>
      layer.apply(
        layer.plan({
          kind: 'modify',
          path: 'src/missing.ts',
          content: 'y',
          reason: 'mod',
          originatingTask: 't',
        }),
      ),
    ).toThrow('does not exist');
    // rename without destination rejected (grant destructive so it reaches the check)
    const grantedPolicy = { ...policy, grants: { ...policy.grants, DESTRUCTIVE_WRITE: true } };
    const grantedWs = new InMemoryWorkspace('app-1', grantedPolicy, [
      { path: 'src/a.ts', content: 'x' },
    ]);
    const grantedLayer = new FileOperationLayer(grantedWs, grantedPolicy);
    expect(() =>
      grantedLayer.apply(
        grantedLayer.plan({ kind: 'rename', path: 'src/a.ts', reason: 'r', originatingTask: 't' }),
      ),
    ).toThrow('destination');
  });

  it('markValidation updates the operation record', () => {
    const ws = new InMemoryWorkspace('app-1', policy);
    const layer = new FileOperationLayer(ws, policy);
    const applied = layer.apply(
      layer.plan({
        kind: 'create',
        path: 'src/a.ts',
        content: 'x',
        reason: 'r',
        originatingTask: 't',
      }),
    );
    layer.markValidation(applied.operationId, 'passed');
    expect(layer.history()[0].validationStatus).toBe('passed');
    expect(() => layer.markValidation('op-missing', 'passed')).toThrow();
  });

  it('applyAuthorized throws when a non-approval-requiring op is blocked', () => {
    // SAFE_WRITE default is allowed, so a blocked non-approval op only occurs
    // when the policy explicitly blocks SAFE_WRITE.
    const blockingPolicy = {
      ...DEFAULT_EXECUTION_POLICY,
      rules: DEFAULT_EXECUTION_POLICY.rules.map((r) =>
        r.actionClass === 'SAFE_WRITE' ? { ...r, default: 'blocked' as const } : r,
      ),
    };
    const ws = new InMemoryWorkspace('app-1', blockingPolicy);
    const layer = new FileOperationLayer(ws, blockingPolicy);
    const planned = layer.plan({
      kind: 'create',
      path: 'src/a.ts',
      content: 'x',
      reason: 'r',
      originatingTask: 't',
    });
    expect(() => layer.applyAuthorized(planned)).toThrow('policy');
  });
});

describe('generator — Phase 18 templates', () => {
  it('generates all four archetypes with valid structure', () => {
    for (const archetype of [
      'abap-debugger',
      'restaurant-app',
      'ai-app-builder',
      'generic-web',
    ] as const) {
      const files = generateProject(archetype, { applicationId: 'app-1', name: 'demo' });
      expect(files.some((f) => f.path === 'package.json')).toBe(true);
      expect(files.some((f) => f.path === 'src/index.ts')).toBe(true);
      expect(files.some((f) => f.path.endsWith('.test.ts'))).toBe(true);
      expect(files.some((f) => f.path === 'db/schema.sql')).toBe(true);
    }
  });

  it('injectSecret adds a detectable secret; injectDefects drops tests', () => {
    const files = generateProject('restaurant-app', {
      applicationId: 'app-1',
      name: 'demo',
      injectSecret: true,
      injectDefects: true,
    });
    expect(files.some((f) => f.content.includes('sk-live-'))).toBe(true);
    expect(files.every((f) => !f.path.includes('.test.'))).toBe(true);
    // the security reviewer catches the injected secret
    const reviewer = new SecurityReviewer();
    const report = reviewer.review('app-1', { files, apiContract: [], dependencies: [] });
    expect(report.blocked).toBe(true);
  });
});

describe('SpecificationEngine — remaining branches', () => {
  it('derives admin + payment + notification features from keywords', () => {
    const engine = new SpecificationEngine();
    const spec = engine.derive({
      applicationId: 'app-1',
      owner: 'u1',
      goal: 'Build a restaurant admin dashboard with payments and email notifications and login.',
    });
    expect(spec.features).toContain('Admin dashboard');
    expect(spec.features).toContain('User authentication');
    expect(spec.features).toContain('Shopping cart & checkout');
    expect(spec.features).toContain('Notifications');
    // low-cost constraint
    const budget = engine.derive({
      applicationId: 'app-2',
      owner: 'u1',
      goal: 'Build a cheap app on a budget.',
    });
    expect(budget.constraints.some((c) => c.toLowerCase().includes('cost'))).toBe(true);
  });

  it('ABAP goal requires RAG knowledge and produces an ABAP journey', () => {
    const engine = new SpecificationEngine();
    const spec = engine.derive({
      applicationId: 'app-3',
      owner: 'u1',
      goal: 'Build an ABAP debugger with SAP short dump analysis.',
    });
    expect(spec.userJourneys[0].actor).toBe('SAP developer');
    const arch = new ArchitectureEngine().derive({ specification: spec });
    expect(arch.aiCapabilities.some((c) => c.evidence?.collection === 'sap-abap')).toBe(true);
  });
});

describe('FactoryMapper — remaining branches', () => {
  it('maps create result from both project shapes', async () => {
    const { engine } = makePorts();
    const appEngine = new FactoryEngine({
      ...makePorts(),
      versionControl: makePorts().versionControl,
      deployments: makePorts().deployments,
    });
    const created = await appEngine.create({ goal: 'Build a restaurant app.', owner: 'u1' });
    const dto = FactoryMapper.toCreateResult(created);
    expect(dto.status).toBe('DRAFT');
    const detail = FactoryMapper.toDetailDTO(await appEngine.get(created.applicationId, 'u1'));
    expect(detail.applicationId).toBe(created.applicationId);
  });
});
