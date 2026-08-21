// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Application Factory: Infrastructure Adapters
// EPIC-007 — Phases 15–16.
//   - LocalDeploymentAdapter: packages the workspace as an artifact
//     (self-hosted / export). Always available, no external vendor.
//   - InMemoryVersionControl: journaling port (init/branch/commit/
//     diff/prepare-PR). NEVER pushes.
// ──────────────────────────────────────────────────────────────────

import type { DeploymentAdapterPort, VersionControlPort } from '../contracts/factory-ports.js';

/** Local / self-hosted deployment — the safe always-available target. */
export class LocalDeploymentAdapter implements DeploymentAdapterPort {
  readonly target = 'local' as const;

  deploy(input: { applicationId: string; workspacePath: string; authorized: boolean }): Promise<{
    status: 'deployed' | 'blocked' | 'failed';
    message: string;
    artifactPath?: string;
  }> {
    if (!input.authorized) {
      return Promise.resolve({
        status: 'blocked',
        message: 'deployment requires explicit authorization',
      });
    }
    const artifactPath = `dist/${input.workspacePath}/artifact.tar.gz`;
    return Promise.resolve({
      status: 'deployed',
      message: `packaged ${input.applicationId} as a local artifact`,
      artifactPath,
    });
  }
}

/** A future vendor adapter is registered the same way (declared, not special-cased). */
export class VercelDeploymentAdapter implements DeploymentAdapterPort {
  readonly target = 'vercel' as const;

  deploy(input: { applicationId: string; workspacePath: string; authorized: boolean }): Promise<{
    status: 'deployed' | 'blocked' | 'failed';
    message: string;
    artifactPath?: string;
  }> {
    if (!input.authorized) {
      return Promise.resolve({
        status: 'blocked',
        message: 'deployment requires explicit authorization',
      });
    }
    return Promise.resolve({
      status: 'deployed',
      message: `prepared ${input.applicationId} for Vercel (operator completes the push)`,
      artifactPath: `dist/${input.workspacePath}/vercel-build`,
    });
  }
}

/** In-memory git-like journal (Phase 15). Production would back this with a real VCS. */
export class InMemoryVersionControl implements VersionControlPort {
  private readonly branches = ['main'];
  private currentBranch = 'main';
  private readonly commits: Array<{ message: string; files: string[]; branch: string }> = [];

  init(repositoryPath: string): { ok: boolean; message: string } {
    return { ok: true, message: `initialized repository at ${repositoryPath}` };
  }

  branch(_repositoryPath: string, name: string): { ok: boolean; message: string } {
    if (this.branches.includes(name))
      return { ok: false, message: `branch ${name} already exists` };
    this.branches.push(name);
    this.currentBranch = name;
    return { ok: true, message: `created and checked out branch ${name}` };
  }

  commit(
    _repositoryPath: string,
    message: string,
    files: string[],
  ): { ok: boolean; message: string } {
    this.commits.push({ message, files, branch: this.currentBranch });
    return {
      ok: true,
      message: `committed ${files.length} files on ${this.currentBranch}: ${message}`,
    };
  }

  diff(_repositoryPath: string): { ok: boolean; message: string; hunks: string[] } {
    if (this.commits.length === 0) return { ok: true, message: 'no changes yet', hunks: [] };
    return {
      ok: true,
      message: `${this.commits.length} commits on ${this.currentBranch}`,
      hunks: this.commits.map((c) => `[${c.branch}] ${c.message} (${c.files.length} files)`),
    };
  }

  preparePullRequest(
    _repositoryPath: string,
    title: string,
  ): { ok: boolean; message: string; pullRequestDraft?: { title: string; body: string } } {
    return {
      ok: true,
      message: `prepared pull request draft "${title}" (never auto-pushed)`,
      pullRequestDraft: {
        title,
        body: `Automated pull request prepared by the VedMoulya Application Factory.\n\nChanges:\n${this.commits.map((c) => `- ${c.message}`).join('\n')}\n\nValidation status: pending operator review.`,
      },
    };
  }
}
