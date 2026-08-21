// ──────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Ecosystem Intelligence Routers
// EPIC-015 — VedMoulya Intelligence
//
// github.* namespace — Connect GitHub (separate from Google auth, GitHub
// App architecture, least-privilege): getConnection / beginConnect /
// completeAuth / verify / revoke / disconnect / listRepositories /
// getPermissions.
//
// ecosystemIntelligence.* namespace — task-specific intelligence
// (findBetterOption / findFreeAlternative / findLocalAlternative /
// findGitHubCapability / findBetterProvider / evaluateSecurity /
// evaluateLicense / checkCapabilityFreshness / getAcquisitionPlan /
// approveAcquisition / rejectAcquisition / respondToRecommendation /
// listLifecycle / getLifecycle / listNotifications / markNotificationRead)
// — the Brain's intelligence questions over the frozen candidate/preference
// seams. (The `intelligence.*` name is the frozen EPIC-004 platform router.)
//
// Every procedure is authenticated + rate-limited; ownership is enforced at
// the service boundary (IDOR refused there) AND by the auth middleware
// (input.userId must match the session user). Secrets never cross this layer.
// ──────────────────────────────────────────────────────────────────

import type { EcosystemIntelligenceApplicationService } from '@vedmoulya/ecosystem-intelligence';
import type { TRPCContext } from '../services/RouterRegistry.js';
import { assertRateLimit, RateLimitTiers } from '../middleware/rate-limit.js';
import type { ApiResponse } from '../services/ResponseMapper.js';
import { fromServiceResult } from '../services/ResponseMapper.js';

export interface EcosystemIntelligenceHandlers {
  // ── github.* ──────────────────────────────────────────────────────
  getGitHubConnection: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  beginGitHubConnect: (
    input: {
      userId: string;
      scopes: string[];
      repoAccessExplicit: boolean;
      writeConsent: boolean;
    },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  completeGitHubAuthorization: (
    input: { userId: string; code: string; state: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  verifyGitHub: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  revokeGitHub: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  disconnectGitHub: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  listGitHubRepositories: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  getGitHubPermissions: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;

  // ── ecosystemIntelligence.* ───────────────────────────────────────
  findBetterOption: (
    input: {
      userId: string;
      capability: string;
      objective: string;
      domain: string;
      qualityTarget: 'LOW' | 'MEDIUM' | 'HIGH';
      privacyRequirement: 'PRIVATE' | 'STANDARD';
    },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  findFreeAlternative: (
    input: { userId: string; capability: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  findLocalAlternative: (
    input: { userId: string; capability: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  findGitHubCapability: (
    input: { userId: string; capability: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  findBetterProvider: (
    input: { userId: string; capability: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  evaluateSecurity: (
    input: { userId: string; resourceId: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  evaluateLicense: (
    input: { userId: string; license?: string; modelLicense?: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  checkCapabilityFreshness: (
    input: { userId: string; resourceId: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  getAcquisitionPlan: (
    input: {
      userId: string;
      repository: string;
      visibility: 'public' | 'private';
      license?: string;
      relevance: string[];
      repoReadAuthorized: boolean;
      repositoryFacts: {
        installScripts: string[];
        credentialCollection: boolean;
        secretExposure: boolean;
        arbitraryCommandExecution: boolean;
        remoteCodeExecutionPaths: boolean;
        sandboxAvailable: boolean;
      };
    },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  approveAcquisition: (
    input: { userId: string; repository: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  rejectAcquisition: (
    input: { userId: string; repository: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  respondToRecommendation: (
    input: {
      userId: string;
      recommendationId: string;
      action:
        | 'use_recommended'
        | 'continue_with_current'
        | 'review_details'
        | 'dont_suggest_again'
        | 'review_and_configure'
        | 'ignore'
        | 'download'
        | 'open_repository';
    },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  listLifecycle: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  getLifecycle: (
    input: { userId: string; resourceId: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  listNotifications: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  markNotificationRead: (
    input: { userId: string; id: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
}

export function createEcosystemIntelligenceRouter(
  service: EcosystemIntelligenceApplicationService,
): EcosystemIntelligenceHandlers {
  return {
    // ── github.* ──────────────────────────────────────────────────────
    getGitHubConnection: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult({ success: true, data: service.getGitHubConnection(input.userId) });
    },

    beginGitHubConnect: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.heavy);
      return fromServiceResult({
        success: true,
        data: await service.beginGitHubConnect(input.userId, input.scopes as never, {
          repoAccessExplicit: input.repoAccessExplicit,
          writeConsent: input.writeConsent,
        }),
      });
    },

    completeGitHubAuthorization: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.heavy);
      return fromServiceResult({
        success: true,
        data: await service.completeGitHubAuthorization(input.userId, input.code, input.state),
      });
    },

    verifyGitHub: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult({ success: true, data: await service.verifyGitHub(input.userId) });
    },

    revokeGitHub: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.heavy);
      return fromServiceResult({ success: true, data: await service.revokeGitHub(input.userId) });
    },

    disconnectGitHub: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.heavy);
      return fromServiceResult({ success: true, data: service.disconnectGitHub(input.userId) });
    },

    listGitHubRepositories: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult({
        success: true,
        data: await service.listGitHubRepositories(input.userId),
      });
    },

    getGitHubPermissions: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult({ success: true, data: service.getGitHubConnection(input.userId) });
    },

    // ── ecosystemIntelligence.* ───────────────────────────────────────
    findBetterOption: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.heavy);
      return fromServiceResult({
        success: true,
        data: await service.findBetterOption(input.userId, input.capability as never, {
          objective: input.objective,
          domain: input.domain,
          qualityTarget: input.qualityTarget,
          privacyRequirement: input.privacyRequirement,
          constraints: [],
          authorizedActions: [],
        }),
      });
    },

    findFreeAlternative: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult({
        success: true,
        data: await service.findFreeAlternative(input.userId, input.capability as never),
      });
    },

    findLocalAlternative: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult({
        success: true,
        data: await service.findLocalAlternative(input.userId, input.capability as never),
      });
    },

    findGitHubCapability: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult({
        success: true,
        data: await service.findGitHubCapability(input.userId, input.capability as never),
      });
    },

    findBetterProvider: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult({
        success: true,
        data: await service.findBetterProvider(input.userId, input.capability as never),
      });
    },

    evaluateSecurity: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult({
        success: true,
        data: service.evaluateSecurity(input.userId, input.resourceId),
      });
    },

    evaluateLicense: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult({
        success: true,
        data: service.evaluateLicense(input.userId, {
          license: input.license,
          modelLicense: input.modelLicense,
        }),
      });
    },

    checkCapabilityFreshness: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult({
        success: true,
        data: service.checkCapabilityFreshness(input.userId, input.resourceId),
      });
    },

    getAcquisitionPlan: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.heavy);
      return fromServiceResult({
        success: true,
        data: service.getAcquisitionPlan(input.userId, {
          repository: input.repository,
          visibility: input.visibility,
          license: input.license,
          relevance: input.relevance,
          repoReadAuthorized: input.repoReadAuthorized,
          security: {
            fullName: input.repository,
            installScripts: input.repositoryFacts.installScripts,
            shellUsage: false,
            subprocessUsage: false,
            arbitraryCommandExecution: input.repositoryFacts.arbitraryCommandExecution,
            credentialCollection: input.repositoryFacts.credentialCollection,
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
            secretExposure: input.repositoryFacts.secretExposure,
            outboundDataTransfer: false,
            dynamicDownloads: false,
            remoteCodeExecutionPaths: input.repositoryFacts.remoteCodeExecutionPaths,
            sandboxAvailable: input.repositoryFacts.sandboxAvailable,
          },
        }),
      });
    },

    approveAcquisition: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.heavy);
      return fromServiceResult({
        success: true,
        data: service.approveAcquisition(input.userId, input.repository),
      });
    },

    rejectAcquisition: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.heavy);
      return fromServiceResult({
        success: true,
        data: await service.rejectAcquisition(input.userId, input.repository),
      });
    },

    respondToRecommendation: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult({
        success: true,
        data: await service.respondToRecommendation(
          input.userId,
          input.recommendationId,
          input.action,
        ),
      });
    },

    listLifecycle: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult({ success: true, data: service.listLifecycle(input.userId) });
    },

    getLifecycle: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult({
        success: true,
        data: service.getLifecycle(input.userId, input.resourceId),
      });
    },

    listNotifications: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult({ success: true, data: service.listNotifications(input.userId) });
    },

    markNotificationRead: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult({
        success: true,
        data: service.markNotificationRead(input.userId, input.id),
      });
    },
  };
}
