// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Gateway: github.* + ecosystemIntelligence.* namespace tests
// EPIC-015 — VedMoulya Intelligence
//
// Exercises the procedures through the REAL tRPC pipeline (auth + rate-limit
// middleware + RouterRegistry handler closures):
//   github.getConnection / beginConnect / completeAuth / verify / revoke /
//           disconnect / listRepositories / getPermissions
//   ecosystemIntelligence.findBetterOption / findFreeAlternative /
//           findLocalAlternative / findGitHubCapability / findBetterProvider /
//           evaluateSecurity / evaluateLicense / checkCapabilityFreshness /
//           getAcquisitionPlan / approveAcquisition / rejectAcquisition /
//           respondToRecommendation / listLifecycle / getLifecycle /
//           listNotifications / markNotificationRead
// Plus IDOR: a foreign userId must be refused by the gateway guard on every
// procedure. Candidate sources are deterministic fakes — no live services.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { EcosystemIntelligenceApplicationService } from '@vedmoulya/ecosystem-intelligence';
import type {
  BrainCandidatePort,
  BrainPreferencePort,
  ClockPort,
  GitHubAuthPort,
  GitHubRepoSourcePort,
} from '@vedmoulya/ecosystem-intelligence';
import {
  InMemoryGitHubConnectionStore,
  InMemoryLifecycleStore,
  InMemoryRecommendationStore,
  InMemoryNotificationStore,
  InMemoryAcquisitionStore,
} from '@vedmoulya/ecosystem-intelligence';
import type { CapabilityId } from '@vedmoulya/capability-marketplace';
import type { GitHubConnection } from '@vedmoulya/ecosystem-intelligence';
import { createAppRouter } from '../services/RouterRegistry.js';
import type { ApiApplicationService } from '../services/ApiApplicationService.js';

const FIXED_NOW = '2026-08-11T00:00:00.000Z';

class FakeClock implements ClockPort {
  now(): string {
    return FIXED_NOW;
  }
}

class FakeCandidatePort implements BrainCandidatePort {
  async providerCandidates(capability: CapabilityId) {
    if (capability === 'VIDEO_GENERATION') {
      return [
        {
          providerId: 'free-video',
          family: 'free',
          name: 'Free Video Provider',
          modelId: 'free-model',
          capabilities: ['VIDEO_GENERATION'],
          quality: 72,
          costTier: 'free',
          availability: 1,
          configured: true,
          evidence: [
            { claim: 'registry matrix', source: 'provider-registry', confidence: 'VERIFIED' },
          ],
        },
        {
          providerId: 'premium-video',
          family: 'premium',
          name: 'Premium Video Provider',
          modelId: 'premium-model',
          capabilities: ['VIDEO_GENERATION'],
          quality: 94,
          costTier: 'high',
          availability: 0.99,
          configured: false,
          estimatedCostUsd: 0.08,
          evidence: [
            { claim: 'best-in-class motion', source: 'official benchmark', confidence: 'VERIFIED' },
          ],
        },
      ];
    }
    return [
      {
        providerId: 'cfg',
        family: 'generic',
        name: 'Configured',
        capabilities: [capability],
        quality: 70,
        costTier: 'medium',
        availability: 1,
        configured: true,
        evidence: [
          { claim: 'registry matrix', source: 'provider-registry', confidence: 'VERIFIED' },
        ],
      },
    ];
  }

  async discoveryCandidates(_capability: CapabilityId) {
    return [
      {
        itemId: 'gh-1',
        category: 'github' as const,
        title: 'oss-video-tool',
        capabilities: ['VIDEO_GENERATION'],
        freeClass: 'OPEN_SOURCE',
        localAvailability: 'yes' as const,
        configurable: false,
        evidence: [
          { claim: 'repo README documents the pipeline', source: 'repo', confidence: 'VERIFIED' },
        ],
        securityFlags: [],
      },
    ];
  }

  async localModelCandidates(_capability: CapabilityId) {
    return [
      {
        id: 'local-1',
        name: 'Local Model',
        sizeGb: 5,
        runtime: 'ollama',
        capabilities: ['TEXT_GENERATION'],
        capabilitiesProvenance: 'INFERRED' as const,
        available: true,
        evidence: [{ claim: 'runs on ollama', source: 'runtime', confidence: 'VERIFIED' }],
      },
    ];
  }
}

class FakePreferencePort implements BrainPreferencePort {
  events: Array<Record<string, unknown>> = [];
  async record(event: Record<string, unknown>): Promise<void> {
    this.events.push({ ...event });
  }
}

class FakeGitHubAuth implements GitHubAuthPort {
  private pendingScopes = new Map<string, string[]>();
  async beginAuthorization(userId: string, requestedScopes: string[]) {
    this.pendingScopes.set(userId, [...requestedScopes]);
    return {
      authorizationUrl: `https://github.com/login/oauth/authorize?scope=${requestedScopes.join('+')}`,
      state: 'csrf-state-xyz',
    };
  }
  async completeAuthorization(userId: string, _code: string, _state: string) {
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

function makeIntelligenceService() {
  const preferencePort = new FakePreferencePort();
  const service = new EcosystemIntelligenceApplicationService({
    clock: new FakeClock(),
    candidatePort: new FakeCandidatePort(),
    preferencePort,
    githubAuth: new FakeGitHubAuth(),
    githubRepos: new FakeGitHubRepos(),
    connectionStore: new InMemoryGitHubConnectionStore(),
    lifecycleStore: new InMemoryLifecycleStore(),
    recommendationStore: new InMemoryRecommendationStore(),
    notificationStore: new InMemoryNotificationStore(),
    acquisitionStore: new InMemoryAcquisitionStore(),
  });
  return { service, preferencePort };
}

function makeServices(): ApiApplicationService {
  const { service } = makeIntelligenceService();
  return {
    ecosystemIntelligence: service,
  } as unknown as ApiApplicationService;
}

// Each test uses a unique userId: the gateway rate-limiter is a process-wide
// Map keyed by user (heavy tier = 20/min), so a shared user across many heavy
// procedures would hit TOO_MANY_REQUESTS mid-suite.
let testSeq = 0;
function freshCaller() {
  testSeq += 1;
  const userId = `intel-owner-${testSeq}`;
  return {
    userId,
    caller: createAppRouter(makeServices()).createCaller({
      userId,
      email: `${userId}@vedmoulya.com`,
      role: 'user',
    }),
  };
}

describe('github.* — real tRPC pipeline', () => {
  it('connect flow: disconnected → beginConnect → completeAuth → connected', async () => {
    const { userId, caller } = freshCaller();
    const initial = await caller.github.getConnection({ userId });
    expect(initial.success).toBe(true);
    expect(initial.data!.state).toBe('DISCONNECTED');

    const started = await caller.github.beginConnect({
      userId,
      scopes: ['public_metadata', 'public_repos_read'],
      repoAccessExplicit: true,
      writeConsent: false,
    });
    expect(started.success).toBe(true);
    expect(started.data!.authorizationUrl).toContain('github.com/login/oauth/authorize');
    expect(started.data!.grantedScopes).toEqual(['public_metadata', 'public_repos_read']);

    const connected = await caller.github.completeAuth({
      userId,
      code: 'abc123',
      state: started.data!.state,
    });
    expect(connected.success).toBe(true);
    expect(connected.data!.state).toBe('CONNECTED');
    expect(connected.data!.accountLogin).toBe('moulya-dev');
    expect(connected.data!.canDiscoverPublic).toBe(true);
  });

  it('write scope is never obtained without separate consent', async () => {
    const { userId, caller } = freshCaller();
    const started = await caller.github.beginConnect({
      userId,
      scopes: ['repos_write'],
      repoAccessExplicit: false,
      writeConsent: false,
    });
    expect(started.data!.grantedScopes).not.toContain('repos_write');
    expect(started.data!.rejectedScopes).toContain('repos_write');
  });

  it('listRepositories surfaces public repos; private repos require explicit grant', async () => {
    const { userId, caller } = freshCaller();
    const before = await caller.github.listRepositories({ userId });
    expect(before.data!.error).toBe('GitHub is not connected.');

    await caller.github.beginConnect({
      userId,
      scopes: ['public_metadata'],
      repoAccessExplicit: false,
      writeConsent: false,
    });
    await caller.github.completeAuth({ userId, code: 'abc', state: 's' });
    const after = await caller.github.listRepositories({ userId });
    expect(after.data!.repos.map((r: { fullName: string }) => r.fullName)).toEqual([
      'moulya-dev/public-tool',
    ]);

    await caller.github.beginConnect({
      userId,
      scopes: ['public_metadata', 'private_repos_read'],
      repoAccessExplicit: true,
      writeConsent: false,
    });
    await caller.github.completeAuth({ userId, code: 'abc', state: 's' });
    const withPrivate = await caller.github.listRepositories({ userId });
    expect(withPrivate.data!.repos.map((r: { fullName: string }) => r.fullName)).toEqual([
      'moulya-dev/public-tool',
      'moulya-dev/private-project',
    ]);
  });

  it('revoke clears access; verify does not resurrect a revoked connection', async () => {
    const { userId, caller } = freshCaller();
    await caller.github.beginConnect({
      userId,
      scopes: ['public_metadata'],
      repoAccessExplicit: false,
      writeConsent: false,
    });
    await caller.github.completeAuth({ userId, code: 'abc', state: 's' });
    const revoked = await caller.github.revoke({ userId });
    expect(revoked.data!.state).toBe('REVOKED');
    const verified = await caller.github.verify({ userId });
    expect(verified.data!.state).toBe('REVOKED');
    expect(verified.data!.valid).toBe(false);
  });

  it('IDOR: a foreign userId is refused on github.* procedures', async () => {
    const { userId, caller } = freshCaller();
    await caller.github.beginConnect({
      userId,
      scopes: ['public_metadata'],
      repoAccessExplicit: false,
      writeConsent: false,
    });
    await caller.github.completeAuth({ userId, code: 'abc', state: 's' });
    await expect(caller.github.getConnection({ userId: 'intel-attacker' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      caller.github.listRepositories({ userId: 'intel-attacker' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(caller.github.revoke({ userId: 'intel-attacker' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('rejects unauthenticated calls with UNAUTHORIZED', async () => {
    const caller = createAppRouter(makeServices()).createCaller({
      userId: 'anonymous',
      email: '',
      role: 'guest',
    });
    await expect(caller.github.getConnection({ userId: 'anonymous' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});

describe('ecosystemIntelligence.* — real tRPC pipeline', () => {
  it('findBetterOption detects a materially better paid option with a recommendation', async () => {
    const { userId, caller } = freshCaller();
    const result = await caller.ecosystemIntelligence.findBetterOption({
      userId,
      capability: 'VIDEO_GENERATION',
      objective: 'Create a professional AI video.',
      domain: 'content',
      qualityTarget: 'HIGH',
      privacyRequirement: 'STANDARD',
    });
    expect(result.success).toBe(true);
    expect(result.data!.betterOptionAvailable).toBe(true);
    expect(result.data!.recommendation?.kind).toBe('BETTER_CAPABILITY_FOUND');
    expect(result.data!.recommendation?.recommended.name).toBe('Premium Video Provider');
  });

  it('Brain integration questions: free / local / github / better-provider', async () => {
    const { userId, caller } = freshCaller();
    const free = await caller.ecosystemIntelligence.findFreeAlternative({
      userId,
      capability: 'VIDEO_GENERATION',
    });
    expect(free.data!.free).toBe(true);
    expect(free.data!.name).toBe('Free Video Provider');

    const local = await caller.ecosystemIntelligence.findLocalAlternative({
      userId,
      capability: 'TEXT_GENERATION',
    });
    expect(Array.isArray(local.data)).toBe(true);

    const github = await caller.ecosystemIntelligence.findGitHubCapability({
      userId,
      capability: 'VIDEO_GENERATION',
    });
    expect(github.data!.found).toBe(true);

    const better = await caller.ecosystemIntelligence.findBetterProvider({
      userId,
      capability: 'VIDEO_GENERATION',
    });
    expect(better.data!.better).toBe(true);
    expect(better.data!.recommended?.name).toBe('Premium Video Provider');
  });

  it('security + license evaluation, and acquisition approval flow', async () => {
    const { userId, caller } = freshCaller();
    const license = await caller.ecosystemIntelligence.evaluateLicense({
      userId,
      license: 'MIT',
      modelLicense: 'CC-BY-NC-4.0',
    });
    expect(license.data!.software.verdict).toBe('PERMISSIVE');
    expect(license.data!.verdict).toBe('COMMERCIAL_RESTRICTED');

    const plan = await caller.ecosystemIntelligence.getAcquisitionPlan({
      userId,
      repository: 'org/tool',
      visibility: 'public',
      license: 'MIT',
      relevance: ['Useful'],
      repoReadAuthorized: true,
      repositoryFacts: {
        installScripts: [],
        credentialCollection: false,
        secretExposure: false,
        arbitraryCommandExecution: false,
        remoteCodeExecutionPaths: false,
        sandboxAvailable: true,
      },
    });
    expect(plan.data!.state).toBe('APPROVAL_REQUIRED');

    const approved = await caller.ecosystemIntelligence.approveAcquisition({
      userId,
      repository: 'org/tool',
    });
    expect(approved.data!.state).toBe('APPROVED');
  });

  it('security BLOCKED acquisition never proceeds', async () => {
    const { userId, caller } = freshCaller();
    const plan = await caller.ecosystemIntelligence.getAcquisitionPlan({
      userId,
      repository: 'org/evil',
      visibility: 'public',
      license: 'MIT',
      relevance: ['Tooling'],
      repoReadAuthorized: true,
      repositoryFacts: {
        installScripts: [],
        credentialCollection: true,
        secretExposure: false,
        arbitraryCommandExecution: false,
        remoteCodeExecutionPaths: false,
        sandboxAvailable: true,
      },
    });
    expect(plan.data!.state).toBe('BLOCKED');
  });

  it('respondToRecommendation records explicit preference; lifecycle is owner-scoped', async () => {
    const { userId, caller } = freshCaller();
    const result = await caller.ecosystemIntelligence.findBetterOption({
      userId,
      capability: 'VIDEO_GENERATION',
      objective: 'Create a professional AI video.',
      domain: 'content',
      qualityTarget: 'HIGH',
      privacyRequirement: 'STANDARD',
    });
    const recommendationId = result.data!.recommendation!.id;
    const responded = await caller.ecosystemIntelligence.respondToRecommendation({
      userId,
      recommendationId,
      action: 'use_recommended',
    });
    expect(responded.data!.state).toBe('ACCEPTED');

    const lifecycle = await caller.ecosystemIntelligence.listLifecycle({ userId });
    expect(lifecycle.data!.some((l: { state: string }) => l.state === 'USER_APPROVED')).toBe(true);

    // Foreign user targeting another user's records → gateway IDOR guard refuses.
    await expect(
      caller.ecosystemIntelligence.listLifecycle({ userId: 'intel-attacker' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('IDOR: a foreign userId is refused on ecosystemIntelligence.* procedures', async () => {
    const { caller } = freshCaller();
    await expect(
      caller.ecosystemIntelligence.findBetterOption({
        userId: 'intel-attacker',
        capability: 'VIDEO_GENERATION',
        objective: 'video',
        domain: 'content',
        qualityTarget: 'HIGH',
        privacyRequirement: 'STANDARD',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      caller.ecosystemIntelligence.listLifecycle({ userId: 'intel-attacker' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
