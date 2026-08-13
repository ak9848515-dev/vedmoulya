// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Application Factory: Version Control Service
// EPIC-007 — Phase 15. Where GitHub integration already exists, the
// factory supports: initialize repository, branch, commit, diff and
// pull-request preparation — with validation before commit. It NEVER
// pushes or deploys without explicit authorization. Complete change
// history is preserved in the project record.
// ──────────────────────────────────────────────────────────────────

import type { VersionControlPort } from '../contracts/factory-ports.js';
import type { VersionControlOperation } from '../types/app-types.js';

export class VersionControlService {
  private readonly operations: VersionControlOperation[] = [];

  constructor(private readonly port: VersionControlPort) {}

  init(repositoryPath: string): { ok: boolean; message: string } {
    const result = this.port.init(repositoryPath);
    this.record('init', result.message);
    return result;
  }

  branch(repositoryPath: string, name: string): { ok: boolean; message: string } {
    const result = this.port.branch(repositoryPath, name);
    this.record('branch', result.message);
    return result;
  }

  commit(
    repositoryPath: string,
    message: string,
    files: string[],
  ): { ok: boolean; message: string } {
    const result = this.port.commit(repositoryPath, message, files);
    this.record('commit', `${message} (${files.length} files)`);
    return result;
  }

  diff(repositoryPath: string): { ok: boolean; message: string; hunks: string[] } {
    const result = this.port.diff(repositoryPath);
    this.record('diff', result.message);
    return result;
  }

  /**
   * Prepare a pull request (title + body). NEVER pushes — the draft is
   * returned for explicit user authorization before any external action.
   */
  preparePullRequest(
    repositoryPath: string,
    title: string,
  ): { ok: boolean; message: string; pullRequestDraft?: { title: string; body: string } } {
    const result = this.port.preparePullRequest(repositoryPath, title);
    this.record('prepare_pr', result.message);
    return result;
  }

  history(): VersionControlOperation[] {
    return [...this.operations];
  }

  private record(type: VersionControlOperation['type'], detail: string): void {
    this.operations.push({
      opId: `vc-${this.operations.length + 1}`,
      type,
      detail,
      timestamp: new Date().toISOString(),
      pushed: false,
    });
  }
}
