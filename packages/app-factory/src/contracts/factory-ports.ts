// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Application Factory: Ports
// EPIC-007. Narrow seams over the frozen platform:
//   - SpecialistExecutionPort: the SAME port the loop engine uses —
//     adapters flow through the AI runtime (AIOrchestratorSpecialistPort).
//   - ToolExecutionPort: the frozen ToolRuntime seam.
//   - ClockPort: deterministic time.
//   - WorkspacePort: isolated, policy-checked file operations (new).
//   - DeploymentPort: vendor-neutral deployment abstraction (new).
//   - VersionControlPort: git-like journaling (new).
// The factory never imports a provider SDK and never executes shell /
// filesystem / network operations outside these ports.
// ──────────────────────────────────────────────────────────────────

import type {
  SpecialistExecutionInput,
  SpecialistExecutionResult,
  SpecialistExecutionPort,
  ToolExecutionPort,
  ClockPort,
} from '@vedmoulya/loop-engine';
import type {
  ExecutionActionClass,
  ExecutionPolicy,
  FileOperation,
  FileOperationKind,
} from '../types/app-types.js';
import type { ApplicationProjectRepository } from './application-repository.js';

export type {
  SpecialistExecutionInput,
  SpecialistExecutionResult,
  SpecialistExecutionPort,
  ToolExecutionPort,
  ClockPort,
};
export type { ApplicationProjectRepository } from './application-repository.js';

// ── Workspace (Phase 5/6/14) ────────────────────────────────────────────────

export interface WorkspaceFileEntry {
  path: string;
  content: string;
  kind: 'source' | 'config' | 'test' | 'schema' | 'docs' | 'asset';
}

export interface WorkspaceOperationInput {
  kind: FileOperationKind;
  path: string;
  toPath?: string;
  content?: string;
  /** Reason supplied by the originating task (explainability). */
  reason: string;
  originatingTask: string;
}

export interface WorkspaceOperationResult {
  ok: boolean;
  op: FileOperation;
  error?: string;
}

export interface WorkspacePort {
  /** List every file in the isolated workspace (root-relative paths). */
  listFiles(): WorkspaceFileEntry[];
  readFile(path: string): string | undefined;
  /**
   * Apply ONE controlled file operation. The workspace enforces:
   *   - root containment (no `..` escapes, no absolute host paths)
   *   - policy classification (via the injected ExecutionPolicy)
   *   - rollback capture before destructive ops
   * Returns the recorded FileOperation (status applied/rejected).
   */
  apply(input: WorkspaceOperationInput): WorkspaceOperationResult;
  /** Roll back the last applied operation (Phase 6 — preserve rollback). */
  rollbackLast(): WorkspaceOperationResult | undefined;
  /** Path of the isolated workspace (e.g. Applications/app-001-name). */
  workspacePath(): string;
}

// ── Deployment (Phase 16) ───────────────────────────────────────────────────

export interface DeploymentAdapterPort {
  /** Target this adapter can deploy to. */
  readonly target: 'local' | 'vercel' | 'firebase' | 'cloud_run' | 'self_hosted';
  /** Deploy ONLY when explicitly authorized — never silently. */
  deploy(input: { applicationId: string; workspacePath: string; authorized: boolean }): Promise<{
    status: 'deployed' | 'blocked' | 'failed';
    message: string;
    artifactPath?: string;
  }>;
}

// ── Version control (Phase 15) ──────────────────────────────────────────────

export interface VersionControlPort {
  init(repositoryPath: string): { ok: boolean; message: string };
  branch(repositoryPath: string, name: string): { ok: boolean; message: string };
  commit(
    repositoryPath: string,
    message: string,
    files: string[],
  ): { ok: boolean; message: string };
  diff(repositoryPath: string): { ok: boolean; message: string; hunks: string[] };
  /**
   * Prepare a pull request (a PR description + change summary). NEVER pushes.
   */
  preparePullRequest(
    repositoryPath: string,
    title: string,
  ): {
    ok: boolean;
    message: string;
    pullRequestDraft?: { title: string; body: string };
  };
}

// ── Factory engine ports ────────────────────────────────────────────────────

export interface FactoryEnginePorts {
  specialist: SpecialistExecutionPort;
  tools?: ToolExecutionPort;
  clock: ClockPort;
  /** Isolated workspace for the generated application. */
  workspace: WorkspacePort;
  /** Execution policy for every file operation (Phase 9). */
  policy: ExecutionPolicy;
  /** Vendor-neutral deployment adapters keyed by target. */
  deployments: Record<string, DeploymentAdapterPort>;
  /** Version-control journal (Phase 15). */
  versionControl: VersionControlPort;
  /**
   * EPIC-008 — persistent application project repository. When provided,
   * every mutation is written through and projects survive restart;
   * `list`/`get` read from it (owner-scoped). Absent = in-memory only
   * (EPIC-007 backward-compatible behavior).
   */
  registry?: ApplicationProjectRepository;
}

// ── Helper: classify a file operation (Phase 9) ─────────────────────────────

export function classifyFileOperation(
  kind: FileOperationKind,
  path: string,
  policy: ExecutionPolicy,
): { actionClass: ExecutionActionClass; allowed: boolean; requiresApproval: boolean } {
  let actionClass: ExecutionActionClass;
  switch (kind) {
    case 'create':
    case 'modify':
      actionClass = 'SAFE_WRITE';
      break;
    case 'delete':
    case 'rename':
      actionClass = 'DESTRUCTIVE_WRITE';
      break;
    default:
      actionClass = 'SAFE_WRITE';
  }
  // Secret-bearing files (e.g. *.env with keys) always classify higher.
  if (/\.env(\.|$)/i.test(path) || /secret|credential/i.test(path)) {
    actionClass = 'SECRET_ACCESS';
  }
  const rule = policy.rules.find((r) => r.actionClass === actionClass);
  if (!rule) return { actionClass, allowed: false, requiresApproval: true };
  const requiresApproval = rule.requiresApproval === true || rule.default === 'controlled';
  const explicitlyGranted = policy.grants[actionClass] === true;
  const allowed = rule.default === 'allowed' || (requiresApproval && explicitlyGranted);
  return { actionClass, allowed, requiresApproval };
}
