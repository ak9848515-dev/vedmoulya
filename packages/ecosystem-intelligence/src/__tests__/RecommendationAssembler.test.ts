import { describe, it, expect } from 'vitest';
import { RecommendationAssembler } from '../domain/RecommendationAssembler.js';
import { SecurityAssessor } from '../domain/SecurityAssessor.js';
import { LicenseEngine } from '../domain/LicenseEngine.js';
import { provider, FIXED_NOW } from './fixtures.js';

const clock = { now: () => FIXED_NOW };
const assembler = new RecommendationAssembler(clock);

describe('RecommendationAssembler', () => {
  it('better-capability recommendation shows current vs recommended, why, requires, actions', () => {
    const recommendation = assembler.betterCapability({
      current: { name: 'Free Provider', quality: 76 },
      recommended: { name: 'Provider X', quality: 91, costUsd: 0.05 },
      why: ['Better motion consistency', 'Higher visual quality', 'Better character consistency'],
      requires: ['Provider connection / subscription'],
      risks: ['Activation requires explicit approval.'],
    });
    expect(recommendation.kind).toBe('BETTER_CAPABILITY_FOUND');
    expect(recommendation.title).toBe('Better capability found');
    expect(recommendation.current?.quality).toBe(76);
    expect(recommendation.recommended.why).toHaveLength(3);
    expect(recommendation.actions).toEqual([
      'use_recommended',
      'continue_with_current',
      'review_details',
      'dont_suggest_again',
    ]);
    expect(recommendation.cost?.amountUsd).toBe(0.05);
  });

  it('cost stays UNKNOWN unless evidenced', () => {
    const recommendation = assembler.betterCapability({
      recommended: { name: 'Provider X', quality: 91 },
      why: ['Higher quality'],
      requires: ['subscription'],
      risks: [],
    });
    expect(recommendation.cost?.cadence).toBe('UNKNOWN');
    expect(recommendation.cost?.amountUsd).toBeUndefined();
  });

  it('open-source recommendation attaches license + security status honestly', () => {
    const security = new SecurityAssessor(clock).assess({
      fullName: 'org/tool',
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
    });
    const license = new LicenseEngine(clock).assess({ softwareLicense: 'MIT' });
    const recommendation = assembler.openSource({
      repository: 'org/tool',
      purpose: 'Local video assembly with GPU acceleration.',
      license,
      security,
      capabilities: ['VIDEO_GENERATION'],
      evidence: ['README documents the pipeline'],
      risks: ['Untrusted third-party code.'],
    });
    expect(recommendation.kind).toBe('USEFUL_OPEN_SOURCE_FOUND');
    expect(recommendation.recommended.why.join(' ')).toContain('no blocking indicators');
    expect(recommendation.recommended.why.join(' ')).toContain('License: MIT');
    expect(recommendation.actions).toContain('review_and_configure');
  });

  it('blocked repository → ignore-only actions, never configure', () => {
    const security = new SecurityAssessor(clock).assess({
      fullName: 'org/bad',
      installScripts: [],
      shellUsage: false,
      subprocessUsage: false,
      arbitraryCommandExecution: false,
      credentialCollection: true, // blocking
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
    });
    const recommendation = assembler.openSource({
      repository: 'org/bad',
      purpose: 'Whatever it claims.',
      security,
      capabilities: [],
      evidence: [],
      risks: [],
    });
    expect(recommendation.actions).toEqual(['ignore']);
    expect(recommendation.recommended.why.join(' ')).toContain('BLOCKED');
  });

  it('open-source recommendation reports SECURITY_REVIEW_REQUIRED honestly when unsandboxable', () => {
    const security = new SecurityAssessor(clock).assess({
      fullName: 'org/needs-review',
      installScripts: ['postinstall: node setup.js'],
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
      sandboxAvailable: false,
    });
    const recommendation = assembler.openSource({
      repository: 'org/needs-review',
      purpose: 'Local tooling.',
      security,
      capabilities: [],
      evidence: [],
      risks: [],
    });
    expect(recommendation.recommended.why.join(' ')).toContain('review required');
    expect(recommendation.actions).toContain('review_and_configure');
  });

  it('open-source recommendation with non-blocking review signals stays honest (never "safe")', () => {
    const security = new SecurityAssessor(clock).assess({
      fullName: 'org/reviewable',
      installScripts: ['preinstall: echo hi'],
      shellUsage: true,
      subprocessUsage: false,
      arbitraryCommandExecution: false,
      credentialCollection: false,
      environmentAccess: true,
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
    });
    const recommendation = assembler.openSource({
      repository: 'org/reviewable',
      purpose: 'Tooling.',
      security,
      capabilities: [],
      evidence: [],
      risks: [],
    });
    expect(JSON.stringify(recommendation)).not.toContain('safe');
  });

  it('local model with unknown size/hardware reports UNKNOWN honestly', () => {
    const recommendation = assembler.localModel({
      name: 'Mystery Local',
      capabilities: ['TEXT_GENERATION'],
      qualityEvidence: [],
      privacyBenefit: 'Offline.',
    });
    expect(recommendation.recommended.why.join(' ')).toContain('size UNKNOWN');
    expect(recommendation.recommended.why.join(' ')).toContain('hardware UNKNOWN');
  });

  it('local model with only VRAM reported uses VRAM line', () => {
    const recommendation = assembler.localModel({
      name: 'VRAM Model',
      vramGb: 12,
      capabilities: ['TEXT_GENERATION'],
      qualityEvidence: [],
      privacyBenefit: 'Offline.',
    });
    expect(recommendation.recommended.why.join(' ')).toContain('12 GB VRAM');
  });

  it('fromProvider with a configured provider requires nothing extra', () => {
    const current = provider({ providerId: 'a', name: 'Current', quality: 70, configured: true });
    const better = provider({ providerId: 'b', name: 'Better', quality: 92, configured: true });
    const recommendation = assembler.fromProvider(current, better);
    expect(recommendation.requires).toEqual([]);
  });

  it('free local model recommendation shows size + hardware + privacy + actions', () => {
    const recommendation = assembler.localModel({
      name: 'Llama 3.2 8B',
      sizeGb: 5,
      ramGb: 16,
      capabilities: ['TEXT_GENERATION'],
      qualityEvidence: ['Official benchmarks on 4-bit quantized runs'],
      privacyBenefit: 'Runs fully offline — no data leaves the machine.',
    });
    expect(recommendation.kind).toBe('FREE_LOCAL_MODEL_AVAILABLE');
    expect(recommendation.title).toBe('Free local model available');
    expect(recommendation.recommended.why.join(' ')).toContain('5 GB');
    expect(recommendation.recommended.why.join(' ')).toContain('16 GB RAM');
    expect(recommendation.actions).toEqual(['download', 'review_details', 'continue_with_current']);
    expect(recommendation.cost?.amountUsd).toBe(0);
  });

  it('fromProvider maps a candidate pair deterministically', () => {
    const current = provider({ providerId: 'a', name: 'Current', quality: 70, configured: true });
    const better = provider({
      providerId: 'b',
      name: 'Better',
      quality: 92,
      estimatedCostUsd: 0.02,
    });
    const recommendation = assembler.fromProvider(current, better);
    expect(recommendation.current?.name).toBe('Current');
    expect(recommendation.recommended.name).toBe('Better');
    expect(recommendation.cost?.amountUsd).toBe(0.02);
  });
});
