import { describe, expect, it } from 'vitest';
import { FactoryEngine } from '../FactoryEngine.js';
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

describe('FactoryEngine — the full application factory pipeline', () => {
  it('create: understands → specifies → architects → plans (Phase 1-3, 7-8)', async () => {
    const { engine } = makeEngine();
    const project = await engine.create({
      goal: 'Build a modern restaurant ordering application.',
      owner: 'u1',
    });
    expect(project.archetype).toBe('restaurant-app');
    expect(project.specification.features).toContain('Menu browsing');
    expect(project.architecture.layers.some((l) => l.layer === 'frontend')).toBe(true);
    expect(project.taskGraph.tasks).toHaveLength(11);
    // DRAFT — no files generated yet (preview before build)
    expect((await engine.get(project.applicationId, 'u1')).status).toBe('DRAFT');
    expect((await engine.get(project.applicationId, 'u1')).files).toHaveLength(0);
  });

  it('approve: user approves the plan → PLANNED (Phase 8)', async () => {
    const { engine } = makeEngine();
    const project = await engine.create({ goal: 'Build an ABAP debugger.', owner: 'u1' });
    const approved = await engine.approve(project.applicationId, 'u1');
    expect(approved.status).toBe('PLANNED');
    expect(approved.planPreview?.approvedAt).toBeDefined();
  });

  it('build: rejects building without approval (Phase 8 gate)', async () => {
    const { engine } = makeEngine();
    const project = await engine.create({ goal: 'Build a restaurant app.', owner: 'u1' });
    await expect(
      engine.build({ applicationId: project.applicationId, owner: 'u1', approved: false }),
    ).rejects.toThrow('approved');
  });

  it('build: generates files, validates, and reaches READY (Phase 5-12)', async () => {
    const { engine } = makeEngine();
    const project = await engine.create({
      goal: 'Build a modern restaurant ordering application.',
      owner: 'u1',
    });
    await engine.approve(project.applicationId, 'u1');
    const built = await engine.build({
      applicationId: project.applicationId,
      owner: 'u1',
      approved: true,
    });
    expect(built.status).toBe('READY');
    expect(built.files.length).toBeGreaterThan(3);
    expect(built.files.some((f) => f.path === 'package.json')).toBe(true);
    expect(built.files.some((f) => f.path.endsWith('.test.ts'))).toBe(true);
    expect(built.lastValidation?.overall).toBe('PASS');
    expect(built.securityReport?.blocked).toBe(false);
    expect(built.economics?.aiCalls).toBeGreaterThan(0);
    expect(built.health).toBe('healthy');
    // every file change was recorded with reason + originating task
    for (const op of built.fileOperations) {
      expect(op.reason.length).toBeGreaterThan(0);
      expect(op.originatingTask.length).toBeGreaterThan(0);
      expect(op.validationStatus).toBeDefined();
    }
  });

  it('build: the three validation projects all reach READY (Phase 18)', async () => {
    const goals = [
      'Build an ABAP debugger for short dumps.',
      'Build a modern restaurant ordering application.',
      'Build an AI application builder for customer support.',
    ];
    for (const goal of goals) {
      const { engine } = makeEngine();
      const project = await engine.create({ goal, owner: 'u1' });
      await engine.approve(project.applicationId, 'u1');
      const built = await engine.build({
        applicationId: project.applicationId,
        owner: 'u1',
        approved: true,
      });
      expect(built.status, `${goal} should build to READY`).toBe('READY');
      expect(built.lastValidation?.overall).toBe('PASS');
      expect(built.securityReport?.blocked).toBe(false);
    }
  });

  it('deploy: blocked without authorization, succeeds with it (Phase 16)', async () => {
    const { engine } = makeEngine();
    const project = await engine.create({ goal: 'Build a restaurant app.', owner: 'u1' });
    await engine.approve(project.applicationId, 'u1');
    await engine.build({ applicationId: project.applicationId, owner: 'u1', approved: true });
    const blocked = await engine.deploy(project.applicationId, 'u1', {
      target: 'local',
      authorized: false,
    });
    expect(blocked.status).toBe('blocked');
    const deployed = await engine.deploy(project.applicationId, 'u1', {
      target: 'local',
      authorized: true,
    });
    expect(deployed.status).toBe('deployed');
    expect((await engine.get(project.applicationId, 'u1')).status).toBe('DEPLOYED');
  });

  it('IDOR: another owner cannot read the project', async () => {
    const { engine } = makeEngine();
    const project = await engine.create({ goal: 'Build a restaurant app.', owner: 'u1' });
    await expect(engine.get(project.applicationId, 'u2')).rejects.toThrow('not found');
  });

  it('version control: init/branch/commit/prepare-PR — never pushed (Phase 15)', async () => {
    const { engine } = makeEngine();
    const project = await engine.create({ goal: 'Build a restaurant app.', owner: 'u1' });
    const vc = await engine.versionControl(project.applicationId, 'u1');
    vc.init(project.repositoryPath);
    vc.branch(project.repositoryPath, 'feature/menu');
    vc.commit(project.repositoryPath, 'generate menu module', ['src/api/menu.ts']);
    const pr = vc.preparePullRequest(project.repositoryPath, 'feat: menu module');
    expect(pr.pullRequestDraft?.title).toBe('feat: menu module');
    expect(vc.history().every((op) => op.pushed === false)).toBe(true);
  });

  it('economics: estimates before, actual after (Phase 17)', async () => {
    const { engine } = makeEngine();
    const project = await engine.create({ goal: 'Build a restaurant app.', owner: 'u1' });
    await engine.approve(project.applicationId, 'u1');
    const built = await engine.build({
      applicationId: project.applicationId,
      owner: 'u1',
      approved: true,
    });
    expect(built.economics?.estimatedBefore.estimatedTokens).toBeGreaterThan(0);
    expect(built.economics?.totalTokens).toBeGreaterThan(0);
    expect(built.economics?.aiCalls).toBeGreaterThan(0);
    expect(built.economics?.providerUsage['mock']).toBeGreaterThan(0);
  });

  it('list returns only the owner projects', async () => {
    const { engine } = makeEngine();
    await engine.create({ goal: 'Build a restaurant app.', owner: 'u1' });
    await engine.create({ goal: 'Build a restaurant app.', owner: 'u2' });
    expect(await engine.list('u1')).toHaveLength(1);
  });
});
