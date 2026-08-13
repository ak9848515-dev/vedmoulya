import { describe, expect, it } from 'vitest';
import {
  LocalDeploymentAdapter,
  VercelDeploymentAdapter,
  InMemoryVersionControl,
} from '../adapters.js';

describe('LocalDeploymentAdapter — Phase 16', () => {
  const adapter = new LocalDeploymentAdapter();

  it('blocks without authorization', async () => {
    const result = await adapter.deploy({
      applicationId: 'app-1',
      workspacePath: 'Applications/app-1',
      authorized: false,
    });
    expect(result.status).toBe('blocked');
  });

  it('packages a local artifact when authorized', async () => {
    const result = await adapter.deploy({
      applicationId: 'app-1',
      workspacePath: 'Applications/app-1',
      authorized: true,
    });
    expect(result.status).toBe('deployed');
    expect(result.artifactPath).toContain('artifact.tar.gz');
  });
});

describe('VercelDeploymentAdapter — Phase 16', () => {
  const adapter = new VercelDeploymentAdapter();

  it('blocks without authorization and prepares a build when authorized', async () => {
    expect(
      (
        await adapter.deploy({
          applicationId: 'app-1',
          workspacePath: 'Applications/app-1',
          authorized: false,
        })
      ).status,
    ).toBe('blocked');
    const result = await adapter.deploy({
      applicationId: 'app-1',
      workspacePath: 'Applications/app-1',
      authorized: true,
    });
    expect(result.status).toBe('deployed');
    expect(result.message).toContain('Vercel');
  });
});

describe('InMemoryVersionControl — Phase 15', () => {
  const vc = new InMemoryVersionControl();

  it('init → branch → commit → diff → prepare-PR (never pushed)', () => {
    expect(vc.init('Applications/app-1').ok).toBe(true);
    expect(vc.branch('Applications/app-1', 'feature/menu').ok).toBe(true);
    // duplicate branch rejected
    expect(vc.branch('Applications/app-1', 'feature/menu').ok).toBe(false);
    expect(vc.commit('Applications/app-1', 'add menu', ['src/api/menu.ts']).ok).toBe(true);
    const diff = vc.diff('Applications/app-1');
    expect(diff.hunks.length).toBe(1);
    const pr = vc.preparePullRequest('Applications/app-1', 'feat: menu');
    expect(pr.pullRequestDraft?.title).toBe('feat: menu');
    expect(pr.pullRequestDraft?.body).toContain('Validation status');
  });

  it('diff is empty before any commit', () => {
    const empty = new InMemoryVersionControl();
    const diff = empty.diff('Applications/app-1');
    expect(diff.hunks).toHaveLength(0);
  });
});
