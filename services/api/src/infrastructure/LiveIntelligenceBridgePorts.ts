// ──────────────────────────────────────────────────────────────────
// VedMoulya — services/api · Live Intelligence Bridge gateway ports
// EPIC-017
//
// The ONLY seams the bridge uses to reach the frozen estate from the
// gateway. Every port is a thin facade over an EXISTING application
// service — zero duplication:
//   • brain   → BrainApplicationService (EPIC-016) with the same
//               deterministic candidate seam the Brain already reuses.
//   • intelligence → EcosystemIntelligenceApplicationService (EPIC-015).
//   • marketplace  → CapabilityMarketplaceApplicationService (EPIC-013).
//   • execution    → ExecutionRunService (EPIC-014).
//   • aiWorld      → existing AI World notification surface (EPIC-012C
//                    + EPIC-015 relevance-gated notifications).
// Secrets never cross these ports; ownership stays owner-scoped.
// ──────────────────────────────────────────────────────────────────

import type {
  BridgeAiWorldPort,
  BridgeBrainPort,
  BridgeClockPort,
  BridgeExecutionPort,
  BridgeIntelligencePort,
  BridgeMarketplacePort,
} from '@vedmoulya/live-intelligence-bridge';
import type { BrainCandidatePort, BrainPreferencePort } from '@vedmoulya/live-intelligence-bridge';
import type { BrainApplicationService } from '@vedmoulya/brain';
import type { EcosystemIntelligenceApplicationService } from '@vedmoulya/ecosystem-intelligence';
import type { CapabilityMarketplaceApplicationService } from '@vedmoulya/capability-marketplace';
import type { ExecutionRunService } from '@vedmoulya/execution-bridge';
import type { BridgeNotificationEvent } from '@vedmoulya/live-intelligence-bridge';
import type { IntelligenceNotificationKind } from '@vedmoulya/ecosystem-intelligence';
import { SystemClock } from '@vedmoulya/loop-engine';

export interface LiveIntelligenceBridgeDeps {
  brain: BrainApplicationService;
  intelligence: EcosystemIntelligenceApplicationService;
  capability: CapabilityMarketplaceApplicationService;
  execution: ExecutionRunService;
  candidates: BrainCandidatePort;
  preference: BrainPreferencePort;
}

/** Deterministic clock — same frozen SystemClock the gateway uses. */
export function createBridgeClockPort(): BridgeClockPort {
  return new SystemClock();
}

/** Brain port — thin facade over the real EPIC-016 service. */
export function createBridgeBrainPort(brain: BrainApplicationService): BridgeBrainPort {
  return {
    createTask: (userId, objective) => brain.createTask(userId, objective),
    plan: (userId, taskId) => brain.plan(userId, taskId),
    selectResources: (userId, taskId) => brain.selectResources(userId, taskId),
    requestApproval: (userId, taskId, action) => brain.requestApproval(userId, taskId, action),
    approve: (userId, taskId, action) => brain.approve(userId, taskId, action),
    reject: (userId, taskId, action) => brain.reject(userId, taskId, action),
    execute: (userId, taskId) => brain.execute(userId, taskId),
    verify: (userId, taskId) => brain.verify(userId, taskId),
    evaluateOutcome: (userId, taskId, accepted) => brain.evaluateOutcome(userId, taskId, accepted),
    getStatus: (userId, taskId) => brain.getStatus(userId, taskId),
    listTasks: (userId) => brain.listTasks(userId),
  };
}

/** Intelligence port — thin facade over the real EPIC-015 service. */
export function createBridgeIntelligencePort(
  intelligence: EcosystemIntelligenceApplicationService,
): BridgeIntelligencePort {
  return {
    findBetterOption: (userId, capability, ctx) =>
      intelligence.findBetterOption(userId, capability, ctx),
    findFreeAlternative: (userId, capability) =>
      intelligence.findFreeAlternative(userId, capability),
    findLocalAlternative: (userId, capability) =>
      intelligence.findLocalAlternative(userId, capability),
    findGitHubCapability: (userId, capability) =>
      intelligence.findGitHubCapability(userId, capability),
    findBetterProvider: (userId, capability) => intelligence.findBetterProvider(userId, capability),
    evaluateSecurity: (userId, resourceId) => intelligence.evaluateSecurity(userId, resourceId),
    evaluateLicense: (userId, facts) => intelligence.evaluateLicense(userId, facts),
    respondToRecommendation: (userId, recommendationId, action) =>
      intelligence.respondToRecommendation(userId, recommendationId, action),
    notify: (userId, opts) => intelligence.notify(userId, opts),
  };
}

/** Marketplace port — thin facade over the real EPIC-013 service. */
export function createBridgeMarketplacePort(
  capability: CapabilityMarketplaceApplicationService,
): BridgeMarketplacePort {
  return {
    plan: (userId, request) => capability.plan(userId, request),
    getPlan: (userId, planId) => capability.getPlan(userId, planId),
  };
}

/** Execution port — thin facade over the real EPIC-014 service. */
export function createBridgeExecutionPort(execution: ExecutionRunService): BridgeExecutionPort {
  return {
    start: (ownerId, planId) => execution.start(ownerId, planId),
    approve: (ownerId, executionId, stepId, note) =>
      execution.approve(ownerId, executionId, stepId, note),
    reject: (ownerId, executionId, stepId, note) =>
      execution.reject(ownerId, executionId, stepId, note),
    completeHandoff: (ownerId, executionId, stepId, note) =>
      execution.completeHandoff(ownerId, executionId, stepId, note),
    get: (ownerId, executionId) => execution.get(ownerId, executionId),
    list: (ownerId) => execution.list(ownerId),
  };
}

/**
 * AI World emission port — surfaces bridge events through the EXISTING
 * relevance-gated notification surface (EPIC-012C bell + EPIC-015
 * notifications). No new notification system.
 */
export function createBridgeAiWorldPort(
  intelligence: EcosystemIntelligenceApplicationService,
): BridgeAiWorldPort {
  return {
    emit: (userId, event): { emitted: boolean; reason?: string } => {
      const mapped = mapKind(event);
      const result = intelligence.notify(userId, {
        kind: mapped,
        title: event.title,
        body: event.body,
        relevance: event.relevance,
        itemId: event.id,
      });
      if ('dropped' in result) {
        return { emitted: false, reason: result.reason };
      }
      return { emitted: true };
    },
    unreadCount: (userId): number => intelligence.listNotifications(userId).length,
  };
}

/** Map the bridge event kinds onto the EXISTING notification vocabulary. */
function mapKind(event: BridgeNotificationEvent): IntelligenceNotificationKind {
  switch (event.kind) {
    case 'NEW_MODEL':
    case 'BETTER_MODEL':
      return 'BETTER_PROVIDER_DISCOVERED';
    case 'FREE_QUOTA_AVAILABLE':
    case 'FREE_QUOTA_CHANGED':
      return 'FREE_QUOTA_INCREASED';
    case 'PROVIDER_DEGRADED':
      return 'PROVIDER_UNAVAILABLE';
    case 'NEW_GITHUB_PROJECT':
      return 'USEFUL_GITHUB_PROJECT';
    case 'GITHUB_PROJECT_ABANDONED':
      return 'PROVIDER_RETIRED';
    case 'SECURITY_CHANGE':
      return 'SECURITY_WARNING';
    case 'NEW_LOCAL_MODEL':
      return 'LOCAL_MODEL_SUITABLE';
    case 'BETTER_CAPABILITY':
      return 'PAID_TOOL_MATERIALLY_BETTER';
    case 'PRICE_CHANGE':
      return 'FREE_QUOTA_INCREASED';
    case 'MODEL_DEPRECATED':
      return 'PROVIDER_RETIRED';
    default:
      return 'BETTER_PROVIDER_DISCOVERED';
  }
}
