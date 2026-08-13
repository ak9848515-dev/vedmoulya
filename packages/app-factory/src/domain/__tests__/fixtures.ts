// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Application Factory: Deterministic Test Fixtures
// EPIC-007 — Phase 19/22. Fake ports make every factory test hermetic,
// deterministic and fast (no network, no secrets, instant clock).
// ──────────────────────────────────────────────────────────────────

import type {
  SpecialistExecutionInput,
  SpecialistExecutionResult,
  SpecialistExecutionPort,
  ToolExecutionPort,
  ClockPort,
  WorkspacePort,
  VersionControlPort,
  DeploymentAdapterPort,
} from '../../contracts/factory-ports.js';
import { InMemoryWorkspace } from '../../infrastructure/InMemoryWorkspace.js';
import { DEFAULT_EXECUTION_POLICY } from '../ExecutionPolicy.js';
import type { ExecutionPolicy } from '../../types/app-types.js';

export class FakeClock implements ClockPort {
  private ms = 0;
  now(): string {
    return new Date(this.ms).toISOString();
  }
  timestampMs(): number {
    return this.ms;
  }
  sleep(ms: number): Promise<void> {
    this.ms += ms;
    return Promise.resolve();
  }
  advance(ms: number): void {
    this.ms += ms;
  }
}

/** Specialist that produces deterministic per-task content (like the loop tests). */
export class FakeSpecialistPort implements SpecialistExecutionPort {
  calls: SpecialistExecutionInput[] = [];
  private callCount = 0;

  constructor(
    private readonly contentBuilder?: (
      input: SpecialistExecutionInput,
      callIndex: number,
    ) => string,
  ) {}

  async execute(input: SpecialistExecutionInput): Promise<SpecialistExecutionResult> {
    this.calls.push(input);
    const index = this.callCount;
    this.callCount += 1;
    const content =
      this.contentBuilder?.(input, index) ??
      `Deliverable for ${input.taskId}: ${input.userInput.slice(0, 80)}`;
    return {
      content,
      provider: 'mock',
      model: 'mock-v1',
      tokens: { input: 150, output: 100, total: 250 },
      costUsd: 0.0003,
      latencyMs: 5,
      abstained: false,
      selectionExplanation: `Selected mock/mock-v1 (balanced) — deterministic test fixture.`,
      validationDecision: 'pass',
    };
  }
}

export class FakeToolPort implements ToolExecutionPort {
  async execute(input: {
    toolName: string;
    arguments: Record<string, unknown>;
    userId: string;
  }): Promise<{
    ok: boolean;
    denied: boolean;
    outcome: string;
    error?: string;
    latencyMs: number;
  }> {
    return { ok: true, denied: false, outcome: 'success', latencyMs: 1 };
  }

  listAllowed(): string[] {
    return ['echo', 'calculator', 'current_time'];
  }
}

export class FakeWorkspacePort implements WorkspacePort {
  private readonly inner: InMemoryWorkspace;

  constructor(applicationId = 'app-test', policy: ExecutionPolicy = DEFAULT_EXECUTION_POLICY) {
    this.inner = new InMemoryWorkspace(applicationId, policy);
  }

  listFiles() {
    return this.inner.listFiles();
  }
  readFile(path: string) {
    return this.inner.readFile(path);
  }
  apply(input: Parameters<WorkspacePort['apply']>[0]) {
    return this.inner.apply(input);
  }
  rollbackLast() {
    return this.inner.rollbackLast();
  }
  workspacePath() {
    return this.inner.workspacePath();
  }
}

export class FakeVersionControl implements VersionControlPort {
  init() {
    return { ok: true, message: 'initialized' };
  }
  branch() {
    return { ok: true, message: 'branch created' };
  }
  commit() {
    return { ok: true, message: 'committed' };
  }
  diff() {
    return { ok: true, message: 'diff ready', hunks: [] };
  }
  preparePullRequest(_repositoryPath: string, title: string) {
    return { ok: true, message: 'PR prepared', pullRequestDraft: { title, body: 'draft body' } };
  }
}

export class FakeDeploymentAdapter implements DeploymentAdapterPort {
  readonly target = 'local' as const;
  deployCalls = 0;

  async deploy(input: { applicationId: string; workspacePath: string; authorized: boolean }) {
    this.deployCalls += 1;
    if (!input.authorized) return { status: 'blocked' as const, message: 'requires authorization' };
    return {
      status: 'deployed' as const,
      message: 'deployed locally',
      artifactPath: `dist/${input.workspacePath}/artifact.tar.gz`,
    };
  }
}

export function makePorts(overrides: { policy?: ExecutionPolicy } = {}) {
  const clock = new FakeClock();
  const specialist = new FakeSpecialistPort();
  const tools = new FakeToolPort();
  const workspace = new FakeWorkspacePort('app-test', overrides.policy);
  const versionControl = new FakeVersionControl();
  const localAdapter = new FakeDeploymentAdapter();
  return {
    clock,
    specialist,
    tools,
    workspace,
    versionControl,
    deployments: { local: localAdapter },
    localAdapter,
  };
}
