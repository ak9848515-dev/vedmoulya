// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — services/api · AI World Scheduler gateway ports
// EPIC-018
//
// The ONLY seams the scheduler uses to reach the frozen estate — zero
// duplication:
//   • discovery → DiscoveryApplicationService (EPIC-012C) — the SAME
//     bounded orchestrator, store and sources (one discovery database).
//   • brain     → reuses the EXISTING relevance/recommendation verdicts the
//     EPIC-012C pipeline already computed (the same RelevanceScorer +
//     RecommendationEngine the Brain's candidate seam consumes) — the
//     scheduler never re-implements intelligence and never decides alone.
//   • notify    → the EXISTING relevance-gated notification surface
//     (EPIC-015 notify — the same adapter EPIC-017's BridgeAiWorldPort
//     uses). No second notification system.
// Secrets never cross these ports; ownership stays owner-scoped.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  DiscoveryResult,
  SchedulerBrainPort,
  SchedulerClockPort,
  SchedulerDiscoveryPort,
  SchedulerNotifyPort,
  SchedulerRelevanceVerdict,
} from '@vedmoulya/ai-world-scheduler';
import type { DiscoveryApplicationService } from '@vedmoulya/ai-world';
import type { EcosystemIntelligenceApplicationService } from '@vedmoulya/ecosystem-intelligence';
import type { IntelligenceNotificationKind } from '@vedmoulya/ecosystem-intelligence';
import { SystemClock } from '@vedmoulya/loop-engine';

/** Deterministic clock — the same frozen SystemClock the gateway uses. */
export function createSchedulerClockPort(): SchedulerClockPort {
  return new SystemClock();
}

/** Discovery port — thin facade over the EXISTING EPIC-012C pipeline. */
export function createSchedulerDiscoveryPort(
  aiWorld: DiscoveryApplicationService,
): SchedulerDiscoveryPort {
  return {
    discover: async ({ budget, sourceIds }): Promise<DiscoveryResult> => {
      const report = await aiWorld.runScheduledDiscovery({ sourceIds, budget });
      // Items land in the EXISTING store; change detection reads it back via
      // listStoredItems (one discovery database — never a second).
      return {
        items: [],
        reports: report.sources,
        budget: report.budget,
      };
    },
    listSourceIds: () => aiWorld.getSourceIds(),
    listStoredItems: () => aiWorld.listRawItems(),
  };
}

/**
 * Intelligence/relevance port — reuses the EXISTING evidence verdicts.
 * During EPIC-012C normalization every item was already scored by the
 * platform's RelevanceScorer and RecommendationEngine (the same engines the
 * Brain's candidate seam consumes). The scheduler reuses that verdict —
 * it asks the intelligence layer and never decides alone.
 */
export function createSchedulerBrainPort(): SchedulerBrainPort {
  return {
    evaluateRelevance: (_userId, item): SchedulerRelevanceVerdict => {
      const relevant = item.relevance >= 60 && item.recommendation !== 'IGNORE';
      return {
        relevant,
        score: item.relevance,
        reason: relevant
          ? 'Relevant per the existing relevance/recommendation evidence'
          : 'Low relevance or recommended IGNORE by the existing evidence engines',
      };
    },
  };
}

/** Notification port — the EXISTING relevance-gated surface (EPIC-015 notify). */
export function createSchedulerNotifyPort(
  intelligence: EcosystemIntelligenceApplicationService,
): SchedulerNotifyPort {
  return {
    notify: (userId, event): { emitted: boolean; reason?: string } => {
      const result = intelligence.notify(userId, {
        kind: mapSchedulerChange(event.item.category, event.change, event.item),
        title: event.item.title,
        body: event.item.summary.slice(0, 200),
        relevance: event.item.relevance,
        itemId: event.item.id,
      });
      if ('dropped' in result) {
        return { emitted: false, reason: result.reason };
      }
      return { emitted: true };
    },
  };
}

/** Map scheduler changes onto the EXISTING notification vocabulary. */
function mapSchedulerChange(
  category: string,
  change: 'NEW' | 'UPDATED' | 'REMOVED' | 'CRITICAL_CHANGE',
  item: { securityFlags: string[]; summary: string },
): IntelligenceNotificationKind {
  if (item.securityFlags.length > 0) return 'SECURITY_WARNING';
  switch (category) {
    case 'provider':
      return change === 'REMOVED' ? 'PROVIDER_RETIRED' : 'BETTER_PROVIDER_DISCOVERED';
    case 'model':
      return 'NEW_FREE_MODEL';
    case 'github':
      return 'USEFUL_GITHUB_PROJECT';
    case 'application':
      return 'LOCAL_MODEL_SUITABLE';
    case 'news':
    default:
      if (/deprecat|retir|discontinu/i.test(item.summary)) return 'PROVIDER_RETIRED';
      if (/free|quota|price/i.test(item.summary)) return 'FREE_QUOTA_INCREASED';
      return 'CONFIGURED_PROVIDER_CHANGED';
  }
}
