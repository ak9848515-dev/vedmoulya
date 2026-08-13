// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Application Factory: In-Memory Application Repository
// EPIC-008 — Phase 1 persistence double. Covers the branch paths of
// the in-memory repository (get-missing, owner-scoped list, delete)
// that the engine-level tests exercise indirectly.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { InMemoryApplicationRepository } from '../InMemoryApplicationRepository.js';
import type { AppProject } from '../../types/app-types.js';

function makeProject(overrides: Partial<AppProject> = {}): AppProject {
  return {
    applicationId: 'app-test-1',
    owner: 'u1',
    name: 'ABAP Debugger',
    archetype: 'abap-debugger',
    status: 'DRAFT',
    goal: 'Build an ABAP debugger.',
    specification: {
      applicationId: 'app-test-1',
      name: 'ABAP Debugger',
      purpose: 'Debug ABAP programs',
      targetUsers: ['developers'],
      userJourneys: [],
      features: [],
      requirements: [],
      acceptanceCriteria: [],
      budget: { maxIterations: 3 },
      constraints: [],
      archetype: 'abap-debugger',
      derivationReasons: [],
      unresolved: [],
    },
    architecture: {
      applicationId: 'app-test-1',
      layers: [],
      dataModel: [],
      apiContract: [],
      aiCapabilities: [],
      integrations: [],
      securityControls: [],
      performanceTargets: [],
      deploymentTarget: 'local',
      validationReasons: [],
    },
    taskGraph: {
      applicationId: 'app-test-1',
      tasks: [],
      entryTaskIds: [],
      terminalTaskIds: [],
      validated: true,
      validationReasons: [],
    },
    version: '1.0.0',
    technologies: [],
    aiCapabilities: [],
    repositoryPath: 'workspace/app-test-1',
    deploymentStatus: 'not_deployed',
    health: 'unknown',
    fileOperations: [],
    files: [],
    vcOperations: [],
    createdAt: '2026-08-09T00:00:00.000Z',
    updatedAt: '2026-08-09T00:00:00.000Z',
    ...overrides,
  };
}

describe('InMemoryApplicationRepository', () => {
  it('round-trips a saved project (deep clone — no aliasing)', async () => {
    const repo = new InMemoryApplicationRepository();
    const project = makeProject();
    await repo.save(project);

    const found = await repo.get(project.applicationId);
    expect(found?.name).toBe('ABAP Debugger');

    // Mutating the returned document must not alias internal state.
    if (found) {
      found.name = 'mutated';
    }
    const again = await repo.get(project.applicationId);
    expect(again?.name).toBe('ABAP Debugger');
  });

  it('returns undefined for a missing project', async () => {
    const repo = new InMemoryApplicationRepository();
    expect(await repo.get('app-missing')).toBeUndefined();
  });

  it('lists all projects or only the owner, newest first', async () => {
    const repo = new InMemoryApplicationRepository();
    await repo.save(
      makeProject({ applicationId: 'app-a', owner: 'u1', updatedAt: '2026-08-09T02:00:00.000Z' }),
    );
    await repo.save(
      makeProject({ applicationId: 'app-b', owner: 'u2', updatedAt: '2026-08-09T01:00:00.000Z' }),
    );
    await repo.save(
      makeProject({ applicationId: 'app-c', owner: 'u1', updatedAt: '2026-08-09T00:00:00.000Z' }),
    );

    const all = await repo.list();
    expect(all.map((p) => p.applicationId)).toEqual(['app-a', 'app-b', 'app-c']);

    const mine = await repo.list('u1');
    expect(mine.map((p) => p.applicationId)).toEqual(['app-a', 'app-c']);
  });

  it('deletes a project and reports whether it existed', async () => {
    const repo = new InMemoryApplicationRepository();
    await repo.save(makeProject());
    expect(await repo.delete('app-test-1')).toBe(true);
    expect(await repo.get('app-test-1')).toBeUndefined();
    expect(await repo.delete('app-test-1')).toBe(false);
  });
});
