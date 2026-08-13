import { describe, it, expect, beforeEach } from 'vitest';
import { EcosystemIntelligenceApplicationService } from '../application/EcosystemIntelligenceApplicationService.js';
import type { EcosystemIntelligenceServiceOptions } from '../application/EcosystemIntelligenceApplicationService.js';
import {
  InMemoryGitHubConnectionStore,
  InMemoryLifecycleStore,
  InMemoryRecommendationStore,
  InMemoryNotificationStore,
  InMemoryAcquisitionStore,
} from '../infrastructure/InMemoryIntelligenceStores.js';
import type {
  BrainCandidatePort,
  BrainPreferencePort,
  GitHubAuthPort,
  GitHubRepoSourcePort,
} from '../contracts/intelligence-ports.js';
import type { GitHubConnection } from '../types/intelligence-types.js';
import type { CapabilityId } from '@vedmoulya/capability-marketplace';
import {
  provider,
  discovery,
  localModel,
  evidence,
  TEXT_GENERATION,
  VIDEO_GENERATION,
  FIXED_NOW,
  STALE_NOW,
} from './fixtures.js';

class FakeCandidatePort implements BrainCandidatePort {
  async providerCandidates(capability: CapabilityId) {
    if (capability === VIDEO_GENERATION) {
      return [
        provider({
          providerId: 'free-video',
          name: 'Free Video Provider',
          quality: 72,
          costTier: 'free',
          configured: true,
          capabilities: [VIDEO_GENERATION],
        }),
        provider({
          providerId: 'premium-video',
          name: 'Premium Video Provider',
          quality: 94,
          costTier: 'high',
          estimatedCostUsd: 0.08,
          capabilities: [VIDEO_GENERATION],
          evidence: [evidence('Best-in-class motion consistency', 'official benchmark')],
        }),
      ];
    }
    return [
      provider({
        providerId: 'cfg',
        name: 'Configured',
        quality: 70,
        configured: true,
        capabilities: [capability],
      }),
    ];
  }

  async discoveryCandidates(capability: CapabilityId) {
    return [
      discovery({
        itemId: 'gh-1',
        category: 'github',
        title: 'oss-video-tool',
        capabilities: [capability],
        configurable: false,
      }),
    ];
  }

  async localModelCandidates(capability: CapabilityId) {
    return [
      localModel({
        id: 'local-1',
        name: 'Local Model',
        available: true,
        capabilities: [capability],
      }),
    ];
  }
}

class FakePreferencePort implements BrainPreferencePort {
  events: Array<{ fact: string; source: string; confidence: number; reason?: string }> = [];
  async record(event: {
    fact: string;
    source: string;
    confidence: number;
    reason?: string;
  }): Promise<void> {
    this.events.push({
      fact: event.fact,
      source: event.source,
      confidence: event.confidence,
      reason: event.reason,
    });
  }
}

class FakeGitHubAuth implements GitHubAuthPort {
  private pendingScopes = new Map<string, GitHubPermissionScope[]>();
  async beginAuthorization(userId: string, requestedScopes: GitHubPermissionScope[]) {
    this.pendingScopes.set(userId, [...requestedScopes]);
    return {
      authorizationUrl: `https://github.com/login/oauth/authorize?scope=${requestedScopes.join('+')}`,
      state: 'csrf-state-abc',
    };
  }
  async completeAuthorization(userId: string, code: string, _state: string) {
    if (code === 'bad-code') throw new Error('Invalid authorization code');
    // The provider grants exactly the scopes the user reviewed.
    const scopes = this.pendingScopes.get(userId) ?? ['public_metadata'];
    return {
      accountLogin: 'moulya-dev',
      grantedScopes: scopes as GitHubConnection['grantedScopes'],
    };
  }
  async verify(_userId: string) {
    return { valid: true, login: 'moulya-dev', lastVerifiedAt: FIXED_NOW };
  }
  async revoke(_userId: string): Promise<void> {
    // no-op
  }
}

class EmptyCandidatePort implements BrainCandidatePort {
  async providerCandidates(_capability: CapabilityId) {
    return [];
  }
  async discoveryCandidates(_capability: CapabilityId) {
    return [];
  }
  async localModelCandidates(_capability: CapabilityId) {
    return [];
  }
}

class FakeGitHubRepos implements GitHubRepoSourcePort {
  async list(_userId: string, connection: GitHubConnection) {
    const repos = [
      {
        fullName: 'moulya-dev/public-tool',
        visibility: 'public' as const,
        archived: false,
        allowedActions: ['read', 'clone'] as const,
        license: 'MIT',
      },
      {
        fullName: 'moulya-dev/private-project',
        visibility: 'private' as const,
        archived: false,
        allowedActions: ['read'] as const,
      },
    ];
    if (connection.grantedScopes.includes('private_repos_read')) return repos;
    return repos.filter((r) => r.visibility === 'public');
  }
}

function makeService(overrides: Partial<EcosystemIntelligenceServiceOptions> = {}) {
  const candidatePort = new FakeCandidatePort();
  const preferencePort = new FakePreferencePort();
  const options: EcosystemIntelligenceServiceOptions = {
    clock: { now: () => FIXED_NOW },
    candidatePort,
    preferencePort,
    githubAuth: new FakeGitHubAuth(),
    githubRepos: new FakeGitHubRepos(),
    connectionStore: new InMemoryGitHubConnectionStore(),
    lifecycleStore: new InMemoryLifecycleStore(),
    recommendationStore: new InMemoryRecommendationStore(),
    notificationStore: new InMemoryNotificationStore(),
    acquisitionStore: new InMemoryAcquisitionStore(),
    ...overrides,
  };
  return { service: new EcosystemIntelligenceApplicationService(options), preferencePort, options };
}

const VIDEO_CONTEXT = {
  objective: 'Create a professional AI video.',
  domain: 'content',
  qualityTarget: 'HIGH',
  privacyRequirement: 'STANDARD',
  constraints: [],
  authorizedActions: [],
};

describe('EcosystemIntelligenceApplicationService', () => {
  beforeEach(() => {
    // fresh instances per test
  });

  it('GitHub connect flow: DISCONNECTED → AUTHORIZING → CONNECTED with reviewed permissions', async () => {
    const { service } = makeService();
    expect(service.getGitHubConnection('user-1').state).toBe('DISCONNECTED');

    const started = await service.beginGitHubConnect(
      'user-1',
      ['public_metadata', 'private_repos_read'],
      {
        repoAccessExplicit: true,
        writeConsent: false,
      },
    );
    expect(started.authorizationUrl).toContain('github.com/login/oauth/authorize');
    expect(started.grantedScopes).toEqual(['public_metadata', 'private_repos_read']);

    const connected = await service.completeGitHubAuthorization(
      'user-1',
      'good-code',
      started.state,
    );
    expect(connected.state).toBe('CONNECTED');
    expect(connected.accountLogin).toBe('moulya-dev');
    // The provider granted exactly the scopes the user reviewed — no more, no less.
    expect(connected.canReadPrivateRepos).toBe(true);
    expect(connected.canWriteRepos).toBe(false);
  });

  it('write scope is never obtained without separate consent', async () => {
    const { service } = makeService();
    const started = await service.beginGitHubConnect('user-1', ['repos_write'], {
      repoAccessExplicit: false,
      writeConsent: false,
    });
    expect(started.grantedScopes).not.toContain('repos_write');
    expect(started.rejectedScopes).toContain('repos_write');
  });

  it('public discovery works; private repos are invisible without private authorization', async () => {
    const { service } = makeService();
    const publicRepos = await service.listGitHubRepositories('user-1');
    expect(publicRepos.error).toBe('GitHub is not connected.');

    await service.beginGitHubConnect('user-1', ['public_metadata'], {
      repoAccessExplicit: false,
      writeConsent: false,
    });
    await service.completeGitHubAuthorization('user-1', 'good-code', 'state');
    const afterConnect = await service.listGitHubRepositories('user-1');
    expect(afterConnect.repos.map((r) => r.fullName)).toEqual(['moulya-dev/public-tool']);

    // Private access granted explicitly → private repos visible.
    await service.beginGitHubConnect('user-1', ['public_metadata', 'private_repos_read'], {
      repoAccessExplicit: true,
      writeConsent: false,
    });
    await service.completeGitHubAuthorization('user-1', 'good-code', 'state');
    const withPrivate = await service.listGitHubRepositories('user-1');
    expect(withPrivate.repos.map((r) => r.fullName)).toEqual([
      'moulya-dev/public-tool',
      'moulya-dev/private-project',
    ]);
  });

  it('revoke clears access; verify does not resurrect a revoked connection', async () => {
    const { service } = makeService();
    await service.beginGitHubConnect('user-1', ['public_metadata'], {
      repoAccessExplicit: false,
      writeConsent: false,
    });
    await service.completeGitHubAuthorization('user-1', 'good-code', 'state');
    expect(service.getGitHubConnection('user-1').state).toBe('CONNECTED');
    const revoked = await service.revokeGitHub('user-1');
    expect(revoked.state).toBe('REVOKED');
    const verified = await service.verifyGitHub('user-1');
    expect(verified.state).toBe('REVOKED');
    expect(verified.valid).toBe(false);
  });

  it('secrets never appear in any output object', async () => {
    const { service } = makeService();
    await service.beginGitHubConnect('user-1', ['public_metadata', 'private_repos_read'], {
      repoAccessExplicit: true,
      writeConsent: false,
    });
    await service.completeGitHubAuthorization('user-1', 'good-code', 'state');
    const connection = service.getGitHubConnection('user-1');
    const repos = await service.listGitHubRepositories('user-1');
    const serialized = JSON.stringify({ connection, repos });
    expect(serialized).not.toContain('token');
    expect(serialized).not.toContain('good-code');
    expect(serialized).not.toContain('sk-');
    expect(serialized).not.toContain('csrf-state');
  });

  it('IDOR: user-2 can never see or act on user-1 records', async () => {
    const { service } = makeService();
    await service.beginGitHubConnect('user-1', ['public_metadata'], {
      repoAccessExplicit: false,
      writeConsent: false,
    });
    await service.completeGitHubAuthorization('user-1', 'good-code', 'state');
    expect(service.getGitHubConnection('user-2').state).toBe('DISCONNECTED');

    service.assessRepository('user-1', {
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
    });
    const otherUserLifecycle = service.evaluateSecurity('user-2', 'repo:org/repo');
    expect(otherUserLifecycle.state).toBe('UNKNOWN');
    expect(service.listLifecycle('user-2')).toEqual([]);
  });

  it('security BLOCKED prevents execution via the acquisition plan', () => {
    const { service } = makeService();
    const plan = service.getAcquisitionPlan('user-1', {
      repository: 'org/evil',
      visibility: 'public',
      security: {
        fullName: 'org/evil',
        installScripts: [],
        shellUsage: false,
        subprocessUsage: false,
        arbitraryCommandExecution: false,
        credentialCollection: true,
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
      },
      license: 'MIT',
      relevance: ['Video assembly'],
      repoReadAuthorized: true,
    });
    expect(plan.state).toBe('BLOCKED');
  });

  it('approve/reject acquisition records explicit user preference, never inferred', async () => {
    const { service, preferencePort } = makeService();
    const plan = service.getAcquisitionPlan('user-1', {
      repository: 'org/tool',
      visibility: 'public',
      security: {
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
      },
      license: 'MIT',
      relevance: ['Useful'],
      repoReadAuthorized: true,
    });
    expect(plan.state).toBe('APPROVAL_REQUIRED');

    const rejected = await service.rejectAcquisition('user-1', 'org/tool');
    expect(rejected.state).toBe('REJECTED');
    expect(rejected.fallback).toContain('best available configured capability');
    // One decline is explicit evidence, never a permanent inferred preference.
    expect(preferencePort.events.some((e) => e.source === 'explicit_user_rejection')).toBe(true);

    const approved = service.approveAcquisition('user-1', 'org/tool');
    expect(approved.state).toBe('APPROVED');
  });

  it('findBetterOption detects a materially better paid option and creates a recommendation', async () => {
    const { service } = makeService();
    const result = await service.findBetterOption('user-1', VIDEO_GENERATION, VIDEO_CONTEXT);
    expect(result.betterOptionAvailable).toBe(true);
    expect(result.recommendation?.kind).toBe('BETTER_CAPABILITY_FOUND');
    expect(result.recommendation?.current?.name).toBe('Free Video Provider');
    expect(result.recommendation?.recommended.name).toBe('Premium Video Provider');
    expect(result.recommendation?.cost?.amountUsd).toBe(0.08);
  });

  it('user accepts → USER_APPROVED lifecycle; user declines → not treated as failure', async () => {
    const { service } = makeService();
    const result = await service.findBetterOption('user-1', VIDEO_GENERATION, VIDEO_CONTEXT);
    const recommendationId = result.recommendation?.id;
    expect(recommendationId).toBeDefined();

    const accepted = await service.respondToRecommendation(
      'user-1',
      recommendationId!,
      'use_recommended',
    );
    expect(accepted.state).toBe('ACCEPTED');
    const lifecycle = service.listLifecycle('user-1');
    expect(lifecycle.some((l) => l.state === 'USER_APPROVED')).toBe(true);

    const result2 = await service.findBetterOption('user-2', VIDEO_GENERATION, VIDEO_CONTEXT);
    const declined = await service.respondToRecommendation(
      'user-2',
      result2.recommendation!.id,
      'continue_with_current',
    );
    expect(declined.state).toBe('DECLINED');
    // fallback continues with the best available option — no failure state.
    expect(result2.fallback?.bestAchievable).toBeDefined();
  });

  it('dont_suggest_again suppresses the recommendation explicitly', async () => {
    const { service } = makeService();
    const result = await service.findBetterOption('user-1', VIDEO_GENERATION, VIDEO_CONTEXT);
    const suppressed = await service.respondToRecommendation(
      'user-1',
      result.recommendation!.id,
      'dont_suggest_again',
    );
    expect(suppressed.state).toBe('SUPPRESSED');
  });

  it('Brain integration questions work over the candidate port', async () => {
    const { service } = makeService();
    const free = await service.findFreeAlternative('user-1', VIDEO_GENERATION);
    expect(free.free).toBe(true);
    expect(free.name).toBe('Free Video Provider');

    const local = await service.findLocalAlternative('user-1', TEXT_GENERATION);
    expect(Array.isArray(local)).toBe(true);

    const github = await service.findGitHubCapability('user-1', VIDEO_GENERATION);
    expect(github.found).toBe(true);

    const better = await service.findBetterProvider('user-1', VIDEO_GENERATION);
    expect(better.better).toBe(true);
    expect(better.recommended?.name).toBe('Premium Video Provider');
    expect(better.recommended?.requiresActivation).toBe(true);

    const freshness = service.checkCapabilityFreshness('user-1', 'provider:free-video');
    expect(freshness.fresh).toBe('UNKNOWN');
  });

  it('evaluateLicense separates model license from software license', () => {
    const { service } = makeService();
    const license = service.evaluateLicense('user-1', {
      license: 'MIT',
      modelLicense: 'CC-BY-NC-4.0',
    });
    expect(license.software.verdict).toBe('PERMISSIVE');
    expect(license.model?.verdict).toBe('COMMERCIAL_RESTRICTED');
    expect(license.verdict).toBe('COMMERCIAL_RESTRICTED');
  });

  it('edge paths: disconnect when never connected, no-candidate questions stay honest', async () => {
    const { service } = makeService();
    expect(service.disconnectGitHub('user-9').state).toBe('DISCONNECTED');
    await expect(service.revokeGitHub('user-9')).resolves.toMatchObject({ state: 'DISCONNECTED' });
    const verify = await service.verifyGitHub('user-9');
    expect(verify.state).toBe('DISCONNECTED');

    const { service: empty } = makeService({ candidatePort: new EmptyCandidatePort() });
    const free = await empty.findFreeAlternative('user-1', TEXT_GENERATION);
    expect(free.free).toBe(false);
    const local = await empty.findLocalAlternative('user-1', TEXT_GENERATION);
    expect(local).toMatchObject({ available: false });
    const github = await empty.findGitHubCapability('user-1', TEXT_GENERATION);
    expect(github.found).toBe(false);
    const better = await empty.findBetterProvider('user-1', TEXT_GENERATION);
    expect(better.better).toBe(false);
    expect(better.note).toContain('No provider candidates');
    const taskResult = await empty.findBetterOption('user-1', TEXT_GENERATION, VIDEO_CONTEXT);
    expect(taskResult.betterOptionAvailable).toBe(false);
  });

  it('checkCapabilityFreshness: verified records age to STALE; unverified stay UNVERIFIED', () => {
    const verifiedRecord = {
      resourceId: 'provider:verified',
      resourceKind: 'provider' as const,
      state: 'VALIDATED' as const,
      evidence: ['Live validation passed.'],
      history: [{ state: 'VALIDATED' as const, at: FIXED_NOW, reason: 'Live validation passed.' }],
      verifiedAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    };
    const { service, options } = makeService();
    options.lifecycleStore.save('user-1', verifiedRecord);
    expect(service.checkCapabilityFreshness('user-1', 'provider:verified').fresh).toBe('FRESH');

    const { service: aged, options: agedOptions } = makeService({
      clock: { now: () => STALE_NOW },
    });
    agedOptions.lifecycleStore.save('user-1', verifiedRecord);
    expect(aged.checkCapabilityFreshness('user-1', 'provider:verified').fresh).toBe('STALE');

    // A record with no verification anchor is honestly UNVERIFIED / UNKNOWN when absent.
    expect(service.checkCapabilityFreshness('user-1', 'provider:never-verified').fresh).toBe(
      'UNKNOWN',
    );
    expect(service.getLifecycle('user-1', 'provider:verified').state).toBe('VALIDATED');
    expect(service.getLifecycle('user-1', 'provider:missing').state).toBe('UNKNOWN');
  });

  it('notifications are meaningful + relevance-gated and owner-scoped', () => {
    const { service } = makeService();
    const kept = service.notify('user-1', {
      kind: 'NEW_FREE_MODEL',
      title: 'New free model',
      body: 'Suitable for local hardware.',
      relevance: 85,
    });
    expect(kept).not.toBeUndefined();
    const dropped = service.notify('user-1', {
      kind: 'NEW_FREE_MODEL',
      title: 'Noise',
      body: 'Low relevance.',
      relevance: 10,
    });
    expect(dropped).toMatchObject({ dropped: true });
    expect(service.listNotifications('user-1')).toHaveLength(1);
    expect(service.listNotifications('user-2')).toHaveLength(0);
    service.markNotificationRead('user-1', (kept as { id: string }).id);
    expect(service.listNotifications('user-1')[0]?.read).toBe(true);
  });
});
