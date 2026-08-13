import { describe, it, expect } from 'vitest';
import { SecurityAssessor, type RepositoryFacts } from '../domain/SecurityAssessor.js';
import { FIXED_NOW } from './fixtures.js';

const clock = { now: () => FIXED_NOW };
const assessor = new SecurityAssessor(clock);

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

describe('SecurityAssessor — classifications', () => {
  it('clean repository → TRUSTED with honest language (never "safe")', () => {
    const result = assessor.assess(facts());
    expect(result.classification).toBe('TRUSTED');
    for (const check of result.checks) {
      if (check.passed)
        expect(check.detail).toContain('No blocking indicators found in the checks performed.');
    }
    expect(result.blockingIndicators).toEqual([]);
  });

  it('credential collection → BLOCKED with blocking indicator attached', () => {
    const result = assessor.assess(facts({ credentialCollection: true }));
    expect(result.classification).toBe('BLOCKED');
    expect(result.blockingIndicators).toContain('credential_collection');
  });

  it('secret exposure → BLOCKED', () => {
    const result = assessor.assess(facts({ secretExposure: true }));
    expect(result.classification).toBe('BLOCKED');
  });

  it('suspicious install script alone → TRUSTED_WITH_REVIEW (not blocked, not auto-executed)', () => {
    const result = assessor.assess(facts({ installScripts: ['preinstall: curl | sh'] }));
    expect(result.classification).toBe('TRUSTED_WITH_REVIEW');
    expect(result.blockingIndicators).toEqual([]);
    expect(result.sandboxRequired).toBe(true);
  });

  it('malicious dependency indicator → downgraded, never auto-approved', () => {
    const result = assessor.assess(facts({ suspiciousDependencies: ['typosquat:lodash-is-ok'] }));
    expect(result.classification).toBe('TRUSTED_WITH_REVIEW');
    expect(result.checks.some((c) => c.name === 'suspicious_dependencies' && !c.passed)).toBe(true);
  });

  it('remote code execution path → BLOCKED (never executed automatically)', () => {
    const result = assessor.assess(facts({ remoteCodeExecutionPaths: true }));
    expect(result.classification).toBe('BLOCKED');
  });

  it('many review signals → SECURITY_REVIEW_REQUIRED', () => {
    const result = assessor.assess(
      facts({
        shellUsage: true,
        subprocessUsage: true,
        dynamicDownloads: true,
        networkCalls: true,
        encodedOrObfuscatedScripts: true,
      }),
    );
    expect(result.classification).toBe('SECURITY_REVIEW_REQUIRED');
  });

  it('sandbox unavailable + executable content → SECURITY_REVIEW_REQUIRED, never auto-execute', () => {
    const result = assessor.assess(
      facts({ installScripts: ['postinstall'], sandboxAvailable: false }),
    );
    expect(result.classification).toBe('SECURITY_REVIEW_REQUIRED');
    expect(result.sandboxAvailable).toBe(false);
  });

  it('SSH key access and outbound transfer are blocking', () => {
    const ssh = assessor.assess(facts({ sshKeyAccess: true }));
    expect(ssh.classification).toBe('BLOCKED');
    const transfer = assessor.assess(facts({ outboundDataTransfer: true }));
    expect(transfer.classification).toBe('BLOCKED');
  });

  it('never claims safety from absence alone — the strongest statement is the honest language', () => {
    const result = assessor.assess(facts());
    expect(JSON.stringify(result)).not.toContain('is completely safe');
    expect(JSON.stringify(result)).not.toContain('no risk');
  });
});
