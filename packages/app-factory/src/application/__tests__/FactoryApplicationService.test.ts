import { describe, expect, it } from 'vitest';
import { FactoryApplicationService } from '../FactoryApplicationService.js';
import { makePorts } from '../../domain/__tests__/fixtures.js';

function makeService() {
  const ports = makePorts();
  const service = new FactoryApplicationService(ports);
  return { service, ports };
}

describe('FactoryApplicationService — Phase 20 contract', () => {
  it('create returns the typed spec/architecture/task graph + unresolved', async () => {
    const { service } = makeService();
    const created = await service.create({
      goal: 'Build a modern restaurant ordering application.',
      userId: 'u1',
    });
    expect(created.applicationId).toMatch(/^app-/);
    expect(created.archetype).toBe('restaurant-app');
    expect(created.specification.features).toContain('Menu browsing');
    expect(created.architecture.layers.length).toBeGreaterThan(0);
    expect(created.taskGraph.tasks).toHaveLength(11);
    expect(created.unresolved.length).toBeGreaterThan(0);
  });

  it('approve → PLANNED, build → READY with validation/economics', async () => {
    const { service } = makeService();
    const created = await service.create({ goal: 'Build an ABAP debugger.', userId: 'u1' });
    const approved = await service.approve(created.applicationId, 'u1');
    expect(approved.status).toBe('PLANNED');
    const built = await service.build({
      applicationId: created.applicationId,
      userId: 'u1',
      approved: true,
    });
    expect(built.status).toBe('READY');
    expect(built.validation?.overall).toBe('PASS');
    expect(built.security).toBeDefined();
    expect(built.uiQuality).toBeDefined();
    expect(built.economics?.totalTokens).toBeGreaterThan(0);
  });

  it('status / getDetail expose the project without internals', async () => {
    const { service } = makeService();
    const created = await service.create({ goal: 'Build a restaurant app.', userId: 'u1' });
    const status = await service.status(created.applicationId, 'u1');
    expect(status.status).toBe('DRAFT');
    expect(status.fileCount).toBe(0);
    const detail = await service.getDetail(created.applicationId, 'u1');
    expect(detail.specification.applicationId).toBe(created.applicationId);
    expect(detail.files).toEqual([]);
  });

  it('list is owner-scoped', async () => {
    const { service } = makeService();
    await service.create({ goal: 'Build a restaurant app.', userId: 'u1' });
    await service.create({ goal: 'Build a restaurant app.', userId: 'u2' });
    expect(await service.list('u1')).toHaveLength(1);
  });

  it('deploy requires explicit authorization (never silent)', async () => {
    const { service } = makeService();
    const created = await service.create({ goal: 'Build a restaurant app.', userId: 'u1' });
    await service.approve(created.applicationId, 'u1');
    await service.build({ applicationId: created.applicationId, userId: 'u1', approved: true });
    const blocked = await service.deploy(created.applicationId, 'u1', {
      target: 'local',
      authorized: false,
    });
    expect(blocked.status).toBe('blocked');
    const deployed = await service.deploy(created.applicationId, 'u1', {
      target: 'local',
      authorized: true,
    });
    expect(deployed.status).toBe('deployed');
  });

  it('version control ops are exposed through the service and never pushed', async () => {
    const { service } = makeService();
    const created = await service.create({ goal: 'Build a restaurant app.', userId: 'u1' });
    const vc = await service.versionControl(created.applicationId, 'u1');
    expect(vc.init().ok).toBe(true);
    vc.branch('feature/x');
    vc.commit('add menu', ['src/api/menu.ts']);
    const pr = vc.preparePullRequest('feat: menu');
    expect(pr.pullRequestDraft?.title).toBe('feat: menu');
    expect(vc.history().every((op) => op.pushed === false)).toBe(true);
  });

  it('throws NotFoundError for unknown/foreign applications', async () => {
    const { service } = makeService();
    await expect(service.status('app-nope', 'u1')).rejects.toThrow();
    const created = await service.create({ goal: 'Build a restaurant app.', userId: 'u1' });
    await expect(service.status(created.applicationId, 'u2')).rejects.toThrow();
  });
});
