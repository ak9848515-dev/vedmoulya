import { describe, it, expect } from 'vitest';
import { AcquisitionPlanner, type AcquisitionInput } from '../domain/AcquisitionPlanner.js';
import { SecurityAssessor, type RepositoryFacts } from '../domain/SecurityAssessor.js';
import { LicenseEngine } from '../domain/LicenseEngine.js';
import { FIXED_NOW } from './fixtures.js';

const clock = { now: () => FIXED_NOW };
const planner = new AcquisitionPlanner(clock);
const assessor = new SecurityAssessor(clock);
const licenses = new LicenseEngine(clock);

function facts(overrides: Partial<RepositoryFacts> = {}): RepositoryFacts {
  return {
    fullName: 'org/repo',
    installScripts: [],
    shellUsage: false,
    subprocessUsage: false,
    arbitraryCommandExecution: false,
    credentialCollection: false,
    environmentAccess: false,
    filesystemAccess: false,
    sshKeyAccess: false,
    browserCredentialAccess: false,
    networkCalls: false,
    unknownBinaries: false,
    encodedOrObfuscatedScripts: false,
    suspiciousDependencies: [],
    dependencyVulnerabilities: [],
    abandonedDependencies: false,
    unsignedBinaries: false,
    suspiciousReleaseArtifacts: false,
    dockerPrivileges: false,
    hostFilesystemMounts: false,
    excessivePermissions: false,
    secretExposure: false,
    outboundDataTransfer: false,
    dynamicDownloads: false,
    remoteCodeExecutionPaths: false,
    sandboxAvailable: true,
    ...overrides,
  };
}

function input(overrides: Partial<AcquisitionInput> = {}): AcquisitionInput {
  const securityFacts = facts();
  return {
    repository: 'org/repo',
    visibility: 'public',
    security: assessor.assess(securityFacts),
    license: licenses.assess({ softwareLicense: 'MIT' }),
    relevance: ['Provides the video assembly capability the factory needs.'],
    repoReadAuthorized: true,
    ...overrides,
  };
}

describe('AcquisitionPlanner — controlled pipeline', () => {
  it('clean public repo flows through security + relevance to APPROVAL_REQUIRED', () => {
    const plan = planner.plan(input());
    expect(plan.state).toBe('APPROVAL_REQUIRED');
    expect(plan.requiresApprovalFor).toContain('acquire');
    expect(plan.requiresApprovalFor).toContain('use_in_factory');
    expect(plan.requiresApprovalFor).toContain('install');
  });

  it('BLOCKED security stops the pipeline — never executed or installed', () => {
    const plan = planner.plan(
      input({
        security: assessor.assess(facts({ credentialCollection: true })),
      }),
    );
    expect(plan.state).toBe('BLOCKED');
    expect(plan.requiresApprovalFor).toEqual([]);
    expect(plan.fallback).toContain('blocked');
    expect(planner.mayExecute(plan)).toBe(false);
  });

  it('approve only advances when every gated action is granted', () => {
    let plan = planner.plan(input());
    const partial = planner.approve(plan, ['acquire']);
    expect(partial.state).toBe('APPROVAL_REQUIRED');
    expect(partial.requiresApprovalFor).not.toContain('acquire');
    plan = planner.approve(plan, ['acquire', 'execute', 'install', 'configure', 'use_in_factory']);
    expect(plan.state).toBe('APPROVED');
  });

  it('reject → REJECTED with an explicit fallback (never silent execution)', () => {
    const plan = planner.reject(planner.plan(input()));
    expect(plan.state).toBe('REJECTED');
    expect(planner.mayExecute(plan)).toBe(false);
  });

  it('advance walks the pipeline deterministically; mayExecute only after sandbox', () => {
    let plan = planner.approve(planner.plan(input()), [
      'acquire',
      'execute',
      'install',
      'configure',
      'use_in_factory',
    ]);
    expect(planner.mayExecute(plan)).toBe(false);
    plan = planner.advance(plan); // ACQUIRED
    plan = planner.advance(plan); // SANDBOXED
    expect(plan.state).toBe('SANDBOXED');
    expect(planner.mayExecute(plan)).toBe(true);
  });

  it('advance never moves a BLOCKED or REJECTED plan', () => {
    const blocked = planner.plan(
      input({ security: assessor.assess(facts({ secretExposure: true })) }),
    );
    expect(planner.advance(blocked).state).toBe('BLOCKED');
    const rejected = planner.reject(planner.plan(input()));
    expect(planner.advance(rejected).state).toBe('REJECTED');
  });

  it('review-required security means execution stays gated even after approval of other actions', () => {
    const plan = planner.plan(
      input({
        security: assessor.assess(
          facts({ installScripts: ['postinstall: node setup.js'], sandboxAvailable: false }),
        ),
      }),
    );
    expect(plan.requiresApprovalFor).toContain('execute');
    expect(planner.mayExecute(plan)).toBe(false);
  });

  it('unknown license adds a non-auto-approval relevance note', () => {
    const plan = planner.plan(
      input({
        license: licenses.assess({}),
      }),
    );
    expect(plan.relevance.some((r) => r.includes('License could not be established'))).toBe(true);
  });

  it('read ≠ execute: repoReadAuthorized never implies run permission', () => {
    const plan = planner.plan(input());
    expect(plan.requiresApprovalFor).not.toEqual([]);
    // The GitHub grant covers reading — execution remains gated.
    expect(planner.mayExecute(plan)).toBe(false);
  });
});
