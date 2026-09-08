// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Runtime: Git Safety Runtime Boundary (BLD-022)
//
// GitSafetyPort is a POLICY/RUNTIME boundary — never an AI permission
// mechanism. Classification is reused from the frozen GitSafetyPolicy
// (no duplicate risk map). This adapter adds the runtime behavior:
// safe READ operations run through a bounded read-only .git file reader
// (no shell, no process, no ToolRuntime bypass); HIGH-RISK operations
// are refused without an explicit auditable human approval AND an
// operator-bound executor (no executor → explicit refusal, never faked);
// safe WRITE operations execute only via an operator-bound executor.
// The model can neither call this adapter directly nor widen it.
// ──────────────────────────────────────────────────────────────────

import * as fs from 'node:fs';
import * as path from 'node:path';
import { GitSafetyPolicy } from '@vedmoulya/mission-controller';
import type {
  GitOperation,
  GitSafetyClassification,
  GitSafetyPort,
} from '@vedmoulya/mission-controller';

export interface GitOperationDecision {
  /** Explicit human decision — required (true) for approval-gated ops. */
  approved: boolean;
  approvedBy?: string;
  rationale?: string;
}

export interface GitOperationOutcome {
  operation: GitOperation;
  allowed: boolean;
  requiresApproval: boolean;
  executed: boolean;
  reason?: string;
  detail?: string;
}

export interface GitSafetyAuditEvent {
  at: string;
  operation: GitOperation;
  allowed: boolean;
  requiresApproval: boolean;
  executed: boolean;
  approvedBy?: string;
  reason?: string;
}

export interface RuntimeGitSafetyAdapterOptions {
  /** Policy override (defaults to the frozen GitSafetyPolicy). */
  policy?: GitSafetyPort;
  /**
   * Operator-bound executor for APPROVED high-risk operations. The
   * composition never binds one automatically — binding it is an explicit
   * operator integration decision (audited).
   */
  approvedExecutor?: (
    operation: GitOperation,
    args: Record<string, unknown>,
    decision: GitOperationDecision,
  ) => Promise<{ detail: string }>;
  /** Authorized workspace root for the bounded read-only git reader. */
  workspaceRoot?: string;
  auditSink?: (event: GitSafetyAuditEvent) => void;
}

const MAX_AUDIT_EVENTS = 100;

export class RuntimeGitSafetyAdapter implements GitSafetyPort {
  private readonly policy: GitSafetyPort;
  private readonly audit: GitSafetyAuditEvent[] = [];

  constructor(private readonly options: RuntimeGitSafetyAdapterOptions = {}) {
    this.policy = options.policy ?? new GitSafetyPolicy();
  }

  classifyOperation(operation: GitOperation): GitSafetyClassification {
    return this.policy.classifyOperation(operation);
  }

  isSafe(operation: GitOperation): boolean {
    return this.policy.isSafe(operation);
  }

  requiresApproval(operation: GitOperation): boolean {
    return this.policy.requiresApproval(operation);
  }

  /** Bounded audit trail (latest last, capped). */
  getAuditTrail(): readonly GitSafetyAuditEvent[] {
    return this.audit;
  }

  //Internals used by recordGitOutcome (module-scope helper below).
  pushAudit(event: GitSafetyAuditEvent): void {
    this.audit.push(event);
    if (this.audit.length > MAX_AUDIT_EVENTS) this.audit.shift();
    this.options.auditSink?.(event);
  }

  boundApprovedExecutor(): RuntimeGitSafetyAdapterOptions['approvedExecutor'] {
    return this.options.approvedExecutor;
  }

  boundWorkspaceRoot(): string | undefined {
    return this.options.workspaceRoot;
  }

  /**
   * Request one git operation through the policy/runtime boundary.
   * Every path is explicit; nothing executes without passing the
   * classification gate, and outcomes are always honest.
   */
  async requestOperation(
    operation: GitOperation,
    args: Record<string, unknown> = {},
    decision: GitOperationDecision = { approved: false },
  ): Promise<GitOperationOutcome> {
    const classification = this.policy.classifyOperation(operation);
    return recordGitOutcome(this, operation, classification, decision, args);
  }
}

/** Gate + audit logic (module-scope to keep the class surface narrow). */
async function recordGitOutcome(
  adapter: RuntimeGitSafetyAdapter,
  operation: GitOperation,
  classification: GitSafetyClassification,
  decision: GitOperationDecision,
  args: Record<string, unknown>,
): Promise<GitOperationOutcome> {
  const push = (outcome: GitOperationOutcome): GitOperationOutcome => {
    adapter.pushAudit({
      at: new Date().toISOString(),
      operation,
      allowed: outcome.allowed,
      requiresApproval: outcome.requiresApproval,
      executed: outcome.executed,
      approvedBy: decision.approvedBy,
      reason: outcome.reason,
    });
    return outcome;
  };

  // Approval gate — policy decides, never the caller's optimism.
  if (classification.requiresApproval && !decision.approved) {
    const riskDetail = classification.riskReason ?? 'high-risk git operation';
    return push({
      operation,
      allowed: false,
      requiresApproval: true,
      executed: false,
      reason: `${riskDetail} — explicit approval required before this operation may execute`,
    });
  }

  if (classification.requiresApproval && decision.approved) {
    const executor = adapter.boundApprovedExecutor();
    if (!executor) {
      return push({
        operation,
        allowed: true,
        requiresApproval: true,
        executed: false,
        reason:
          'approval recorded but no operator executor is bound for high-risk git operations — nothing was executed',
      });
    }
    const result = await executor(operation, args, decision);
    return push({
      operation,
      allowed: true,
      requiresApproval: true,
      executed: true,
      detail: result.detail,
    });
  }

  // Safe read operations — bounded, read-only, workspace-scoped.
  if (classification.permissionClass === 'READ') {
    return push(boundedGitRead(adapter, operation));
  }

  // Safe write/execute operations (commit, branch, tests): policy allows
  // them, but this runtime binds no git executor of its own — execution
  // stays with operator tooling or the frozen verification surface.
  // Never faked, never silently skipped.
  return push({
    operation,
    allowed: true,
    requiresApproval: false,
    executed: false,
    reason: `policy permits ${operation}; no git executor is bound in this runtime — nothing was executed`,
  });
}

/**
 * Bounded read-only git inspection: parses .git/HEAD + refs inside the
 * authorized workspace. No shell, no process spawn, no index mutation —
 * and an honest result when a repository is not present.
 */
function boundedGitRead(
  adapter: RuntimeGitSafetyAdapter,
  operation: GitOperation,
): GitOperationOutcome {
  const root = adapter.boundWorkspaceRoot();
  if (!root) {
    return {
      operation,
      allowed: true,
      requiresApproval: false,
      executed: false,
      reason: 'no workspace root bound — git read unavailable',
    };
  }
  const gitDir = path.join(path.resolve(root), '.git');
  const headPath = path.join(gitDir, 'HEAD');
  if (!fs.existsSync(headPath)) {
    return {
      operation,
      allowed: true,
      requiresApproval: false,
      executed: true,
      detail: 'no git repository present in the authorized workspace',
    };
  }
  const head = fs.readFileSync(headPath, 'utf8').trim();
  const match = /^ref: (refs\/heads\/(.+))$/.exec(head);
  const branch = match?.[2];
  let revision: string | undefined;
  if (match?.[1]) {
    const refPath = path.join(gitDir, match[1]);
    if (fs.existsSync(refPath)) {
      revision = fs.readFileSync(refPath, 'utf8').trim();
    } else {
      const packedPath = path.join(gitDir, 'packed-refs');
      if (fs.existsSync(packedPath)) {
        const line = fs
          .readFileSync(packedPath, 'utf8')
          .split('\n')
          .find((candidate) => candidate.endsWith(` ${match[1]}`));
        revision = line?.split(' ')[0];
      }
    }
  }
  return {
    operation,
    allowed: true,
    requiresApproval: false,
    executed: true,
    detail: JSON.stringify({
      branch: branch ?? 'unknown',
      revision: revision ?? 'unknown',
      reader: 'bounded .git file reader (read-only)',
    }),
  };
}
