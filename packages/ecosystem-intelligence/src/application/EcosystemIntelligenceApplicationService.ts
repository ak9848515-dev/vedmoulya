// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/ecosystem-intelligence
// EcosystemIntelligenceApplicationService — EPIC-015
//
// Owner-scoped facade over the intelligence domain. Every method takes
// the session userId — foreign records are unreachable by construction
// (IDOR-safe). Secrets never pass through this layer: GitHub tokens and
// codes live only in the server-side auth adapter; provider keys never
// appear in any returned object.
//
// Answers the Brain's intelligence questions (findBestCapability /
// findFreeAlternative / findLocalAlternative / findGitHubCapability /
// findBetterProvider / checkCapabilityFreshness / evaluateSecurity /
// evaluateLicense / getAcquisitionPlan / getFallbackPlan) through
// narrow ports.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityId } from '@vedmoulya/capability-marketplace';
import type {
  ProviderCandidateFact,
  DiscoveryCandidateFact,
  LocalModelCandidateFact,
} from '@vedmoulya/capability-marketplace';
import type { BrainCandidatePort, BrainPreferencePort } from '../contracts/intelligence-ports.js';
import type {
  GitHubAuthPort,
  GitHubConnectionStore,
  GitHubRepoFacts,
  GitHubRepoSourcePort,
  LifecycleStore,
  NotificationStore,
  RecommendationStore,
  AcquisitionStore,
  ClockPort,
} from '../contracts/intelligence-ports.js';
import type {
  GitHubConnectionState,
  GitHubPermissionScope,
  IntelligenceTaskContext,
  TaskIntelligenceResult,
  LicenseIntelligence,
  LifecycleRecord,
  RepositorySecurityAssessment,
  AcquisitionPlan,
  IntelligenceNotification,
} from '../types/intelligence-types.js';
import { GitHubConnectionManager } from '../domain/GitHubConnectionManager.js';
import type { GitHubPermissionView } from '../domain/GitHubConnectionManager.js';
import { SecurityAssessor, type RepositoryFacts } from '../domain/SecurityAssessor.js';
import { LicenseEngine } from '../domain/LicenseEngine.js';
import { FreeResourceIntelligence } from '../domain/FreeResourceIntelligence.js';
import { AcquisitionPlanner } from '../domain/AcquisitionPlanner.js';
import { TaskIntelligenceEngine } from '../domain/TaskIntelligenceEngine.js';
import { RecommendationAssembler } from '../domain/RecommendationAssembler.js';
import { LifecycleLedger } from '../domain/LifecycleLedger.js';
import { NotificationGate } from '../domain/NotificationGate.js';

export interface EcosystemIntelligenceServiceOptions {
  clock: ClockPort;
  candidatePort: BrainCandidatePort;
  preferencePort: BrainPreferencePort;
  githubAuth: GitHubAuthPort;
  githubRepos: GitHubRepoSourcePort;
  connectionStore: GitHubConnectionStore;
  lifecycleStore: LifecycleStore;
  recommendationStore: RecommendationStore;
  notificationStore: NotificationStore;
  acquisitionStore: AcquisitionStore;
}

export interface GitHubBeginResult {
  authorizationUrl: string;
  /** CSRF state — never rendered in the UI. */
  state: string;
  grantedScopes: GitHubPermissionScope[];
  rejectedScopes: GitHubPermissionScope[];
}

export interface GitHubVerifyResult {
  valid: boolean;
  state: GitHubConnectionState;
  requiresVerification: boolean;
}

export interface RepositoryAssessmentResult {
  security: RepositorySecurityAssessment;
  license: LicenseIntelligence;
  lifecycle: LifecycleRecord;
}

export class EcosystemIntelligenceApplicationService {
  private readonly connections: GitHubConnectionManager;
  private readonly security: SecurityAssessor;
  private readonly licenses: LicenseEngine;
  private readonly free: FreeResourceIntelligence;
  private readonly acquisition: AcquisitionPlanner;
  private readonly engine: TaskIntelligenceEngine;
  private readonly assembler: RecommendationAssembler;
  private readonly ledger: LifecycleLedger;
  private readonly gate: NotificationGate;

  constructor(private readonly options: EcosystemIntelligenceServiceOptions) {
    this.connections = new GitHubConnectionManager(options.clock);
    this.security = new SecurityAssessor(options.clock);
    this.licenses = new LicenseEngine(options.clock);
    this.free = new FreeResourceIntelligence(() => new Date(options.clock.now()).getTime());
    this.acquisition = new AcquisitionPlanner(options.clock);
    this.engine = new TaskIntelligenceEngine({ free: 60, configured: 70 });
    this.assembler = new RecommendationAssembler(options.clock);
    this.ledger = new LifecycleLedger(options.clock);
    this.gate = new NotificationGate(options.clock);
  }

  // ── GitHub connection (separate from Google auth) ────────────────
  getGitHubConnection(userId: string): GitHubPermissionView {
    const connection = this.options.connectionStore.get(userId);
    return this.connections.permissionView(connection ?? this.connections.disconnected(userId));
  }

  async beginGitHubConnect(
    userId: string,
    requestedScopes: GitHubPermissionScope[],
    consent: { repoAccessExplicit: boolean; writeConsent: boolean },
  ): Promise<GitHubBeginResult> {
    const { accepted, rejected } = this.connections.validateScopeRequest(requestedScopes, consent);
    const { connection, requested } = this.connections.beginAuthorization(
      this.options.connectionStore.get(userId),
      userId,
      accepted,
    );
    this.options.connectionStore.save(connection);
    const { authorizationUrl, state } = await this.options.githubAuth.beginAuthorization(
      userId,
      requested,
    );
    return { authorizationUrl, state, grantedScopes: requested, rejectedScopes: rejected };
  }

  async completeGitHubAuthorization(
    userId: string,
    code: string,
    state: string,
  ): Promise<GitHubPermissionView> {
    const result = await this.options.githubAuth.completeAuthorization(userId, code, state);
    const pending = this.options.connectionStore.get(userId);
    const connection = this.connections.completeAuthorization(
      pending,
      userId,
      result.accountLogin,
      result.grantedScopes,
    );
    this.options.connectionStore.save(connection);
    const record = this.ledger.create(
      userId,
      `github:${result.accountLogin}`,
      'external_tool',
      'USER_APPROVED',
      [
        'GitHub authorization completed by the user.',
        `Granted scopes: ${result.grantedScopes.join(', ')}.`,
      ],
    );
    this.options.lifecycleStore.save(userId, record);
    return this.connections.permissionView(connection);
  }

  async verifyGitHub(userId: string): Promise<GitHubVerifyResult> {
    const current = this.options.connectionStore.get(userId);
    if (!current || current.state === 'DISCONNECTED' || current.state === 'REVOKED') {
      return { valid: false, state: current?.state ?? 'DISCONNECTED', requiresVerification: false };
    }
    const result = await this.options.githubAuth.verify(userId);
    const updated = this.connections.verify(current, result.valid, result.login);
    this.options.connectionStore.save(updated);
    return {
      valid: result.valid,
      state: updated.state,
      requiresVerification: updated.state === 'EXPIRED',
    };
  }

  async revokeGitHub(userId: string): Promise<GitHubPermissionView> {
    const current = this.options.connectionStore.get(userId);
    if (!current) return this.connections.permissionView(this.connections.disconnected(userId));
    // Revoke at the provider FIRST (the token must not stay valid at GitHub),
    // then record the local state. A provider failure fails the revoke
    // honestly rather than silently leaving the token active.
    await this.options.githubAuth.revoke(userId);
    const revoked = this.connections.revoke(current);
    this.options.connectionStore.save(revoked);
    return this.connections.permissionView(revoked);
  }

  disconnectGitHub(userId: string): GitHubPermissionView {
    const current = this.options.connectionStore.get(userId);
    if (!current) return this.connections.permissionView(this.connections.disconnected(userId));
    const disconnected = this.connections.disconnect(current);
    this.options.connectionStore.save(disconnected);
    return this.connections.permissionView(disconnected);
  }

  async listGitHubRepositories(
    userId: string,
  ): Promise<{ repos: GitHubRepoFacts[]; error?: string }> {
    const connection = this.options.connectionStore.get(userId);
    if (!connection || connection.state !== 'CONNECTED') {
      return { repos: [], error: 'GitHub is not connected.' };
    }
    const repos = await this.options.githubRepos.list(userId, connection);
    const visible = repos.filter(
      (r) => r.visibility === 'public' || connection.grantedScopes.includes('private_repos_read'),
    );
    return { repos: visible };
  }

  // ── Security + license gates ─────────────────────────────────────
  assessRepository(userId: string, facts: RepositoryFacts): RepositoryAssessmentResult {
    const security = this.security.assess(facts);
    const license = this.licenses.assess({
      softwareLicense: facts.license,
      verifiedAt: this.options.clock.now(),
    });
    const record = this.ledger.create(
      userId,
      `repo:${facts.fullName}`,
      'github',
      security.classification === 'BLOCKED' ? 'BLOCKED' : 'SECURITY_REVIEWED',
      [
        `Security: ${security.classification}.`,
        `License: ${license.verdict}${license.license ? ` (${license.license})` : ''}.`,
      ],
    );
    this.options.lifecycleStore.save(userId, record);
    return { security, license, lifecycle: record };
  }

  getAcquisitionPlan(
    userId: string,
    input: {
      repository: string;
      visibility: 'public' | 'private';
      security: RepositoryFacts;
      license?: string;
      relevance: string[];
      repoReadAuthorized: boolean;
    },
  ): AcquisitionPlan {
    const securityAssessment = this.security.assess(input.security);
    const license = this.licenses.assess({
      softwareLicense: input.license,
      verifiedAt: this.options.clock.now(),
    });
    const plan = this.acquisition.plan({
      repository: input.repository,
      visibility: input.visibility,
      security: securityAssessment,
      license,
      relevance: input.relevance,
      repoReadAuthorized: input.repoReadAuthorized,
    });
    this.options.acquisitionStore.save(userId, {
      repository: input.repository,
      state: plan.state,
      updatedAt: plan.updatedAt,
    });
    return plan;
  }

  approveAcquisition(userId: string, repository: string): { state: string; error?: string } {
    const stored = this.options.acquisitionStore.get(userId, repository);
    if (!stored) return { state: 'UNKNOWN', error: 'No acquisition plan for this repository.' };
    this.options.acquisitionStore.mark(userId, repository, 'APPROVED');
    const record = this.ledger.create(userId, `repo:${repository}`, 'github', 'USER_APPROVED', [
      'User explicitly approved acquisition.',
    ]);
    this.options.lifecycleStore.save(userId, record);
    return { state: 'APPROVED' };
  }

  async rejectAcquisition(
    userId: string,
    repository: string,
  ): Promise<{ state: string; fallback?: string; error?: string }> {
    const stored = this.options.acquisitionStore.get(userId, repository);
    if (!stored) return { state: 'UNKNOWN', error: 'No acquisition plan for this repository.' };
    this.options.acquisitionStore.mark(userId, repository, 'REJECTED');
    // Declining is recorded as evidence — never treated as a permanent preference.
    await this.options.preferencePort.record({
      executionId: `acquisition:${userId}:${repository}`,
      source: 'explicit_user_rejection',
      fact: 'User declined repository acquisition.',
      reason: `Repository ${repository} was declined.`,
      confidence: 1,
    });
    return {
      state: 'REJECTED',
      fallback: 'Continuing with the best available configured capability.',
    };
  }

  // ── Task intelligence (Brain integration questions) ──────────────
  async findBetterOption(
    userId: string,
    capability: CapabilityId,
    ctx: IntelligenceTaskContext,
  ): Promise<TaskIntelligenceResult> {
    const candidates = await this.candidatesFor(capability);
    const result = this.engine.evaluate(capability, ctx, candidates);
    if (result.betterOptionAvailable && result.options.length > 0) {
      const best = result.options.find((o) => o.kind === 'BEST_PAID') ?? result.options[0];
      // "Current" = what the user actually has configured today — never the
      // hypothetical best-available-now (which may be filtered by the floor).
      const currentOption = result.options.find((o) => o.kind === 'BEST_CONFIGURED');
      if (best) {
        // A pending recommendation for the SAME recommended option is reused
        // (same id) so refetches never accumulate duplicate PENDING records
        // and a dismissed/suppressed suggestion is not silently re-offered.
        const existing = this.options.recommendationStore
          .list(userId)
          .find((r) => r.title.includes(best.name) && r.state === 'PENDING');
        const recommendation = this.assembler.betterCapability({
          current: currentOption
            ? { name: currentOption.name, quality: currentOption.quality }
            : undefined,
          recommended: {
            name: best.name,
            quality: best.quality,
            costUsd: best.costUsd,
          },
          why: [best.reason],
          requires: best.requires,
          risks: ['Activation requires explicit user approval.'],
          ...(existing ? { id: existing.id } : {}),
        });
        this.options.recommendationStore.save(userId, {
          id: recommendation.id,
          kind: recommendation.kind,
          title: recommendation.title,
          state: 'PENDING',
          createdAt: recommendation.createdAt,
        });
        result.recommendation = recommendation;
        const record = this.ledger.create(
          userId,
          `provider:${best.name}`,
          'provider',
          'RECOMMENDED',
          best.evidence,
        );
        this.options.lifecycleStore.save(userId, record);
      }
    }
    return result;
  }

  async findFreeAlternative(
    userId: string,
    capability: CapabilityId,
  ): Promise<{
    free: boolean;
    name?: string;
    providerId?: string;
    quality?: number;
    note?: string;
  }> {
    const candidates = await this.candidatesFor(capability);
    const free = candidates.providers.filter((p) => p.costTier === 'free');
    const bestFree =
      free.length > 0
        ? [...free].sort((a, b) => (b.quality ?? 0) - (a.quality ?? 0))[0]
        : undefined;
    return bestFree
      ? {
          free: true,
          name: bestFree.name,
          providerId: bestFree.providerId,
          quality: bestFree.quality,
        }
      : { free: false, note: 'No evidence-backed free alternative found for this capability.' };
  }

  async findLocalAlternative(
    userId: string,
    capability: CapabilityId,
  ): Promise<Array<{ name: string; available: boolean }> | { available: false; note: string }> {
    const candidates = await this.candidatesFor(capability);
    const available = candidates.localModels.filter((m) => m.available);
    return available.length > 0
      ? available.map((m) => ({ name: m.name, available: true }))
      : {
          available: false,
          note: 'No local model available for this capability on current hardware.',
        };
  }

  async findGitHubCapability(
    userId: string,
    capability: CapabilityId,
  ): Promise<{
    found: boolean;
    items: Array<{ title: string; configurable: boolean; securityFlags: string[] }>;
    note?: string;
  }> {
    const candidates = await this.candidatesFor(capability);
    const github = candidates.discoveries.filter(
      (d) => d.category === 'github' || d.category === 'application',
    );
    if (github.length === 0) {
      return {
        found: false,
        items: [],
        note: 'No open-source candidate discovered for this capability yet.',
      };
    }
    return {
      found: true,
      items: github.map((g) => ({
        title: g.title,
        configurable: g.configurable,
        securityFlags: g.securityFlags,
      })),
    };
  }

  async findBetterProvider(
    userId: string,
    capability: CapabilityId,
  ): Promise<{
    better: boolean;
    current?: { name: string; quality?: number };
    recommended?: { name: string; quality?: number; requiresActivation: boolean };
    note?: string;
  }> {
    const candidates = await this.candidatesFor(capability);
    const configured = candidates.providers.filter((p) => p.configured);
    const all = candidates.providers;
    if (all.length === 0) return { better: false, note: 'No provider candidates available.' };
    const bestOverall = [...all].sort((a, b) => (b.quality ?? 0) - (a.quality ?? 0))[0];
    const bestConfigured =
      configured.length > 0
        ? [...configured].sort((a, b) => (b.quality ?? 0) - (a.quality ?? 0))[0]
        : undefined;
    const better =
      bestConfigured !== undefined &&
      bestOverall !== undefined &&
      (bestOverall.quality ?? 0) > (bestConfigured.quality ?? 0) + 8;
    return {
      better,
      current: bestConfigured
        ? { name: bestConfigured.name, quality: bestConfigured.quality }
        : undefined,
      // `better` already implies bestOverall is defined (see above).
      recommended: better
        ? { name: bestOverall.name, quality: bestOverall.quality, requiresActivation: true }
        : undefined,
    };
  }

  checkCapabilityFreshness(
    userId: string,
    resourceId: string,
  ): {
    fresh: 'FRESH' | 'STALE' | 'UNVERIFIED' | 'UNKNOWN';
    state?: LifecycleRecord['state'];
    verifiedAt?: string;
    note?: string;
  } {
    const record = this.options.lifecycleStore.get(userId, resourceId);
    if (!record) return { fresh: 'UNKNOWN', note: 'No lifecycle record for this resource.' };
    const staleness = this.ledger.stalenessOf(record, this.freeMaxAge());
    if (staleness === 'STALE') {
      const updated = this.ledger.markStale(record, 'Verification evidence has aged.');
      this.options.lifecycleStore.save(userId, updated);
    }
    return { fresh: staleness, state: record.state, verifiedAt: record.verifiedAt };
  }

  evaluateSecurity(userId: string, resourceId: string): { state: string; evidence: string[] } {
    const record = this.options.lifecycleStore.get(userId, resourceId);
    return record
      ? { state: record.state, evidence: record.evidence }
      : { state: 'UNKNOWN', evidence: [] };
  }

  evaluateLicense(
    userId: string,
    facts: { license?: string; modelLicense?: string },
  ): LicenseIntelligence {
    return this.licenses.assess({
      softwareLicense: facts.license,
      modelLicense: facts.modelLicense,
      verifiedAt: this.options.clock.now(),
    });
  }

  // ── Recommendation responses (explicit preferences only) ─────────
  async respondToRecommendation(
    userId: string,
    recommendationId: string,
    action:
      | 'use_recommended'
      | 'continue_with_current'
      | 'review_details'
      | 'dont_suggest_again'
      | 'review_and_configure'
      | 'ignore'
      | 'download'
      | 'open_repository',
  ): Promise<{ state: string; recommendationId?: string; error?: string }> {
    const record = this.options.recommendationStore.get(userId, recommendationId);
    if (!record) return { state: 'UNKNOWN', error: 'Unknown recommendation.' };
    let state: 'ACCEPTED' | 'DECLINED' | 'DISMISSED' | 'SUPPRESSED' = 'DISMISSED';
    if (action === 'use_recommended' || action === 'review_and_configure' || action === 'download')
      state = 'ACCEPTED';
    if (action === 'continue_with_current' || action === 'ignore') state = 'DECLINED';
    if (action === 'dont_suggest_again') state = 'SUPPRESSED';
    this.options.recommendationStore.mark(userId, recommendationId, state);
    // Explicit signals only, honestly attributed. A decline is recorded as a
    // decision about THIS recommendation — never inferred as a permanent
    // financial preference. Viewing details or opening a repository is NOT a
    // rejection and is never written to the preference ledger.
    const source = ['use_recommended', 'review_and_configure', 'download'].includes(action)
      ? 'explicit_user_approval'
      : ['continue_with_current', 'ignore'].includes(action)
        ? 'explicit_user_rejection'
        : null;
    if (source) {
      await this.options.preferencePort.record({
        executionId: `recommendation:${userId}:${recommendationId}`,
        source,
        fact: `User responded to "${record.title}" with ${action}.`,
        reason: `Recommendation ${recommendationId} → ${action}.`,
        confidence: 1,
      });
    }
    if (state === 'ACCEPTED') {
      const lifecycle = this.ledger.create(
        userId,
        `rec:${recommendationId}`,
        'external_tool',
        'USER_APPROVED',
        [`User approved: ${record.title}.`],
      );
      this.options.lifecycleStore.save(userId, lifecycle);
    }
    return { state, recommendationId };
  }

  // ── Lifecycle + notifications ────────────────────────────────────
  listLifecycle(userId: string): LifecycleRecord[] {
    return this.options.lifecycleStore.list(userId);
  }

  getLifecycle(
    userId: string,
    resourceId: string,
  ): LifecycleRecord | { state: 'UNKNOWN'; evidence: string[] } {
    return (
      this.options.lifecycleStore.get(userId, resourceId) ?? { state: 'UNKNOWN', evidence: [] }
    );
  }

  listNotifications(userId: string): IntelligenceNotification[] {
    return this.options.notificationStore.list(userId);
  }

  markNotificationRead(userId: string, id: string): { ok: boolean } {
    this.options.notificationStore.markRead(userId, id);
    return { ok: true };
  }

  /** Notification surfaced only when the event is meaningful + relevant. */
  notify(
    userId: string,
    opts: {
      kind: IntelligenceNotification['kind'];
      title: string;
      body: string;
      relevance: number;
      itemId?: string;
    },
  ): IntelligenceNotification | { dropped: true; reason: string } {
    const notification = this.gate.maybeNotify({ ...opts, kind: opts.kind });
    if (notification) this.options.notificationStore.save(userId, notification);
    return (
      notification ?? {
        dropped: true,
        reason: 'Below relevance threshold or not a meaningful event.',
      }
    );
  }

  private async candidatesFor(capability: CapabilityId): Promise<{
    providers: ProviderCandidateFact[];
    discoveries: DiscoveryCandidateFact[];
    localModels: LocalModelCandidateFact[];
  }> {
    const [providers, discoveries, localModels] = await Promise.all([
      this.options.candidatePort.providerCandidates(capability),
      this.options.candidatePort.discoveryCandidates(capability),
      this.options.candidatePort.localModelCandidates(capability),
    ]);
    return { providers, discoveries, localModels };
  }

  private freeMaxAge(): number {
    return 30 * 24 * 60 * 60 * 1000;
  }
}
