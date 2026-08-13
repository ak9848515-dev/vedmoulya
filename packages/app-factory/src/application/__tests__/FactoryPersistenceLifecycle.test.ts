// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Application Factory: Persistence & Lifecycle (EPIC-008)
// Phase 1 (persistent lifecycle + ownership), Phase 14 (version history),
// Phase 17 (resume). Deterministic, hermetic — in-memory repository
// double, no network, no secrets.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { FactoryEngine } from '../../domain/FactoryEngine.js';
import { FactoryApplicationService } from '../FactoryApplicationService.js';
import { InMemoryApplicationRepository } from '../../infrastructure/InMemoryApplicationRepository.js';
import { makePorts } from '../../domain/__tests__/fixtures.js';

function makeServiceWithRegistry() {
  const ports = makePorts();
  const registry = new InMemoryApplicationRepository();
  const service = new FactoryApplicationService({ ...ports, registry });
  return { service, ports, registry };
}

describe('EPIC-008 Phase 1 — persistence across engine instances', () => {
  it('a project created on one engine instance survives on a fresh engine with the same repository', async () => {
    const { service, registry } = makeServiceWithRegistry();
    const created = await service.create({
      goal: 'Build a modern restaurant ordering application.',
      userId: 'u1',
    });
    await service.approve(created.applicationId, 'u1');

    // A brand-new engine (and service) sharing the same repository — as after
    // a server restart.
    const fresh = new FactoryApplicationService({ ...makePorts(), registry });
    const listed = await fresh.list('u1');
    expect(listed).toHaveLength(1);
    expect(listed[0]!.applicationId).toBe(created.applicationId);
    expect(listed[0]!.status).toBe('PLANNED');

    const status = await fresh.status(created.applicationId, 'u1');
    expect(status.name).toBe(created.name);
    expect(status.status).toBe('PLANNED');
  });

  it('ownership: a foreign user cannot read, list or manage the project', async () => {
    const { service } = makeServiceWithRegistry();
    const created = await service.create({ goal: 'Build a restaurant app.', userId: 'u1' });
    expect(await service.list('u2')).toHaveLength(0);
    await expect(service.status(created.applicationId, 'u2')).rejects.toThrow();
    await expect(service.rename(created.applicationId, 'u2', 'hijacked')).rejects.toThrow();
    await expect(service.archive(created.applicationId, 'u2')).rejects.toThrow();
    await expect(service.deleteApplication(created.applicationId, 'u2', true)).rejects.toThrow();
  });

  it('full-document round-trip preserves files, validation and economics after rebuild of the engine', async () => {
    const { service, registry } = makeServiceWithRegistry();
    const created = await service.create({ goal: 'Build an ABAP debugger.', userId: 'u1' });
    await service.approve(created.applicationId, 'u1');
    const built = await service.build({
      applicationId: created.applicationId,
      userId: 'u1',
      approved: true,
    });
    expect(built.status).toBe('READY');

    const fresh = new FactoryApplicationService({ ...makePorts(), registry });
    const detail = await fresh.getDetail(created.applicationId, 'u1');
    expect(detail.files.length).toBeGreaterThan(0);
    expect(detail.lastValidation?.overall).toBe('PASS');
    expect(detail.economics?.totalTokens).toBeGreaterThan(0);
  });
});

describe('EPIC-008 Phase 1 — lifecycle operations', () => {
  it('rename updates the name and records a version entry', async () => {
    const { service } = makeServiceWithRegistry();
    const created = await service.create({ goal: 'Build a restaurant app.', userId: 'u1' });
    const renamed = await service.rename(created.applicationId, 'u1', '  Orderly Bites  ');
    expect(renamed.name).toBe('Orderly Bites');
    expect((await service.status(created.applicationId, 'u1')).name).toBe('Orderly Bites');
    const history = await service.history(created.applicationId, 'u1');
    expect(history.some((v) => v.change.includes('renamed'))).toBe(true);
  });

  it('archive moves the project to ARCHIVED and records it', async () => {
    const { service } = makeServiceWithRegistry();
    const created = await service.create({ goal: 'Build a restaurant app.', userId: 'u1' });
    const archived = await service.archive(created.applicationId, 'u1');
    expect(archived.status).toBe('ARCHIVED');
    expect((await service.status(created.applicationId, 'u1')).status).toBe('ARCHIVED');
    const history = await service.history(created.applicationId, 'u1');
    expect(history.some((v) => v.change === 'archived')).toBe(true);
  });

  it('delete policy: explicit confirmation required; active builds must be archived first', async () => {
    const { service } = makeServiceWithRegistry();
    const draft = await service.create({ goal: 'Build a restaurant app.', userId: 'u1' });
    // No confirmation → refused.
    const refused = await service.deleteApplication(draft.applicationId, 'u1', false);
    expect(refused.deleted).toBe(false);
    // Confirmed DRAFT → deleted.
    const deleted = await service.deleteApplication(draft.applicationId, 'u1', true);
    expect(deleted.deleted).toBe(true);
    expect(await service.list('u1')).toHaveLength(0);

    // A READY application must be archived before deletion.
    const ready = await service.create({ goal: 'Build an ABAP debugger.', userId: 'u1' });
    await service.approve(ready.applicationId, 'u1');
    await service.build({ applicationId: ready.applicationId, userId: 'u1', approved: true });
    expect((await service.status(ready.applicationId, 'u1')).status).toBe('READY');
    const blocked = await service.deleteApplication(ready.applicationId, 'u1', true);
    expect(blocked.deleted).toBe(false);
    expect(blocked.message).toContain('archived');
    // Archive first, then delete.
    await service.archive(ready.applicationId, 'u1');
    const archivedDelete = await service.deleteApplication(ready.applicationId, 'u1', true);
    expect(archivedDelete.deleted).toBe(true);
  });

  it('resume: archived → DRAFT, failed → PLANNED (never restarts unnecessarily)', async () => {
    const { service, ports } = makeServiceWithRegistry();

    // Archived → resumed to DRAFT (plan kept).
    const archived = await service.create({ goal: 'Build a restaurant app.', userId: 'u1' });
    await service.archive(archived.applicationId, 'u1');
    const resumedArchive = await service.resume(archived.applicationId, 'u1');
    expect(resumedArchive.status).toBe('DRAFT');

    // Failed build → resumed to PLANNED (ready to rebuild).
    const failingSpecialist = {
      execute: async (): Promise<never> => {
        throw new Error('provider unavailable (deterministic test)');
      },
      explain: async () => ({
        providerId: 'mock',
        modelId: 'mock-v1',
        reasons: ['x'],
        strategy: 'balanced',
      }),
    };
    const failing = new FactoryApplicationService({
      ...ports,
      specialist: failingSpecialist as unknown as typeof ports.specialist,
    });
    const broken = await failing.create({ goal: 'Build an ABAP debugger.', userId: 'u1' });
    await failing.approve(broken.applicationId, 'u1');
    const failedBuild = await failing.build({
      applicationId: broken.applicationId,
      userId: 'u1',
      approved: true,
    });
    expect(failedBuild.status).toBe('FAILED');

    const resumedFailed = await failing.resume(broken.applicationId, 'u1');
    expect(resumedFailed.status).toBe('PLANNED');
    const history = await failing.history(broken.applicationId, 'u1');
    expect(history.some((v) => v.change.includes('resumed'))).toBe(true);
  });
});

describe('EPIC-008 Phase 14 — version history', () => {
  it('records created → plan approved → build → archived → deployed as versions', async () => {
    const { service } = makeServiceWithRegistry();
    const created = await service.create({ goal: 'Build a restaurant app.', userId: 'u1' });
    expect(await service.history(created.applicationId, 'u1')).toHaveLength(1);

    await service.approve(created.applicationId, 'u1');
    const built = await service.build({
      applicationId: created.applicationId,
      userId: 'u1',
      approved: true,
    });
    expect(built.status).toBe('READY');

    await service.deploy(created.applicationId, 'u1', { target: 'local', authorized: true });
    await service.archive(created.applicationId, 'u1');

    const history = await service.history(created.applicationId, 'u1');
    expect(history.map((v) => v.change)).toEqual([
      'created',
      'plan approved',
      'build READY',
      'deployed',
      'archived',
    ]);
    // versions are sequential and snapshot validation/security/economics
    const buildVersion = history.find((v) => v.change === 'build READY');
    expect(buildVersion?.validation?.overall).toBe('PASS');
    expect(buildVersion?.security?.blocked).toBe(false);
    expect(buildVersion?.economics?.aiCalls).toBeGreaterThan(0);
    expect(history.every((v, i) => v.version === i + 1)).toBe(true);
  });
});
