/* eslint-disable security/detect-object-injection */
// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Controller: Git & Development Safety Policy
// BLD-021A PHASE 14 & PHASE 24 — Governed Git Development Safety
//
// Normal development operations are classified into the frozen
// ToolPermissionClass taxonomy:
//   READ:     git status, git diff, git log
//   WRITE:    branch creation, checkout, commits
//   EXECUTE:  tests, builds, lint, typecheck
//
// High-risk operations remain governed and ALWAYS require human approval:
//   DELETE:     branch deletion, history rewrite
//   DEPLOYMENT: force push, production deployment
//   SECRETS:    credential changes, secret changes
//
// Never bypasses ToolRuntime.
// ──────────────────────────────────────────────────────────────────

import type { GitOperation, GitSafetyClassification } from '../types/mission-types.js';
import type { GitSafetyPort } from '../contracts/mission-ports.js';

const GIT_SAFETY_MAP: Record<
  GitOperation,
  {
    isSafe: boolean;
    requiresApproval: boolean;
    permissionClass: 'READ' | 'WRITE' | 'EXECUTE' | 'DELETE' | 'SECRETS' | 'DEPLOYMENT';
    riskReason?: string;
  }
> = {
  status: {
    isSafe: true,
    requiresApproval: false,
    permissionClass: 'READ',
  },
  diff: {
    isSafe: true,
    requiresApproval: false,
    permissionClass: 'READ',
  },
  log: {
    isSafe: true,
    requiresApproval: false,
    permissionClass: 'READ',
  },
  create_branch: {
    isSafe: true,
    requiresApproval: false,
    permissionClass: 'WRITE',
  },
  checkout: {
    isSafe: true,
    requiresApproval: false,
    permissionClass: 'WRITE',
  },
  commit: {
    isSafe: true,
    requiresApproval: false,
    permissionClass: 'WRITE',
  },
  test: {
    isSafe: true,
    requiresApproval: false,
    permissionClass: 'EXECUTE',
  },
  build: {
    isSafe: true,
    requiresApproval: false,
    permissionClass: 'EXECUTE',
  },
  lint: {
    isSafe: true,
    requiresApproval: false,
    permissionClass: 'EXECUTE',
  },
  typecheck: {
    isSafe: true,
    requiresApproval: false,
    permissionClass: 'EXECUTE',
  },
  // High-risk operations — ALWAYS require human approval
  force_push: {
    isSafe: false,
    requiresApproval: true,
    permissionClass: 'DEPLOYMENT',
    riskReason: 'Force push can overwrite remote git history and disrupt team collaboration',
  },
  history_rewrite: {
    isSafe: false,
    requiresApproval: true,
    permissionClass: 'DELETE',
    riskReason: 'Git history rewriting is irreversible and can result in data loss',
  },
  delete_branch: {
    isSafe: false,
    requiresApproval: true,
    permissionClass: 'DELETE',
    riskReason: 'Branch deletion destroys commits not merged to the main trunk',
  },
  production_deploy: {
    isSafe: false,
    requiresApproval: true,
    permissionClass: 'DEPLOYMENT',
    riskReason: 'Production deployment directly impacts customer-facing systems',
  },
  change_credentials: {
    isSafe: false,
    requiresApproval: true,
    permissionClass: 'SECRETS',
    riskReason: 'Credential modification accesses and mutates secure platform identity tokens',
  },
  change_secrets: {
    isSafe: false,
    requiresApproval: true,
    permissionClass: 'SECRETS',
    riskReason: 'Secret modification exposes and mutates production encryption and API secrets',
  },
};

export function classifyGitOperation(operation: GitOperation): GitSafetyClassification {
  const entry = (
    GIT_SAFETY_MAP as Partial<Record<GitOperation, (typeof GIT_SAFETY_MAP)[GitOperation]>>
  )[operation];
  if (!entry) {
    return {
      operation,
      isSafe: false,
      requiresApproval: true,
      permissionClass: 'EXECUTE',
      riskReason: `Unrecognized git operation "${operation}" requires governance review`,
    };
  }
  return {
    operation,
    ...entry,
  };
}

export class GitSafetyPolicy implements GitSafetyPort {
  classifyOperation(operation: GitOperation): GitSafetyClassification {
    return classifyGitOperation(operation);
  }

  isSafe(operation: GitOperation): boolean {
    return classifyGitOperation(operation).isSafe;
  }

  requiresApproval(operation: GitOperation): boolean {
    return classifyGitOperation(operation).requiresApproval;
  }
}
