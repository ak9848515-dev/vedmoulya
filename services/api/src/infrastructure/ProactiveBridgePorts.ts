// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Gateway · ProactiveBridgePorts
// SPRINT-029 — the ONLY seams between the proactive layer and the frozen
// estate. Implemented over the real BrainApplicationService and the real
// capability marketplace surface — nothing duplicated.
// ─────────────────────────────────────────────────────────────────────────────

import type { BrainApplicationService } from '@vedmoulya/brain';
import type { ProactiveBrainPort, ProactiveCapabilityPort } from '@vedmoulya/proactive';

/** Derive a deterministic urgency label from the Brain's transparent 0..1
 *  priority score — LOW when evidence is weak, never a fabricated label. */
function urgencyFromScore(score: number | undefined): string {
  if (score === undefined) return 'UNKNOWN';
  if (score >= 0.66) return 'HIGH';
  if (score >= 0.33) return 'MEDIUM';
  return 'LOW';
}

type BrainPortMethod<K extends keyof ProactiveBrainPort> = ProactiveBrainPort[K];

/**
 * ProactiveBrainPort over the real VedMoulya Brain. Every method is
 * owner-scoped by the Brain itself (tasks/opportunities/events are keyed by
 * owner) — the proactive layer can never reach another owner's records.
 */
export function createProactiveBrainPort(brain: BrainApplicationService): ProactiveBrainPort {
  const port: ProactiveBrainPort = {
    dailyPriorities: (
      userId: string,
      limit = 5,
    ): ReturnType<BrainPortMethod<'dailyPriorities'>> => {
      const result = brain.dailyPriorities(userId, limit);
      return result.success
        ? {
            success: true,
            data: (result.data ?? []).map((p) => ({
              id: p.id,
              title: p.title,
              // RankedAction carries a transparent priorityScore 0..1 — derive
              // the urgency label deterministically from it (no fabricated
              // labels; LOW when evidence is weak).
              urgency: urgencyFromScore(p.priorityScore),
              priorityScore: p.priorityScore,
              reason: p.reason,
            })),
          }
        : { success: false, error: result.error, code: result.code };
    },
    listOpportunities: (userId: string): ReturnType<BrainPortMethod<'listOpportunities'>> => {
      const result = brain.listOpportunities(userId);
      return result.success
        ? {
            success: true,
            data: (result.data ?? []).map((o) => ({
              id: o.id,
              userId: o.userId,
              category: o.category,
              title: o.title,
              description: o.description,
              evidence: o.evidence,
              uncertainty: o.uncertainty,
              estimatedValue: o.estimatedValue,
              requiredCapabilities: o.requiredCapabilities,
              risk: o.risk,
              status: o.status,
              createdAt: o.createdAt,
            })),
          }
        : { success: false, error: result.error, code: result.code };
    },
    listTasks: (userId: string): ReturnType<BrainPortMethod<'listTasks'>> => {
      const result = brain.listTasks(userId);
      return result.success
        ? {
            success: true,
            data: (result.data ?? []).map((t) => ({
              id: t.id,
              userId: t.userId,
              objective: t.objective,
              status: t.status,
              stage: t.stage,
              createdAt: t.createdAt,
            })),
          }
        : { success: false, error: result.error, code: result.code };
    },
    listIntelligenceEvents: (
      userId: string,
    ): ReturnType<BrainPortMethod<'listIntelligenceEvents'>> => {
      const result = brain.listIntelligenceEvents(userId);
      return result.success
        ? {
            success: true,
            data: (result.data ?? []).map((e) => ({
              id: e.id,
              userId: e.userId,
              kind: e.kind,
              title: e.title,
              description: e.description,
              relevance: e.relevance,
              createdAt: e.createdAt,
            })),
          }
        : { success: false, error: result.error, code: result.code };
    },
    listOutcomeMemory: (_userId: string): ReturnType<BrainPortMethod<'listOutcomeMemory'>> => {
      // The Brain does not expose outcome memory directly on the application
      // service — the proactive layer treats absence as "no evidence yet"
      // (never fabricates learning recommendations from nothing).
      return { success: true, data: [] };
    },
    discoverIntelligence: async (
      userId: string,
    ): Promise<Awaited<ReturnType<BrainPortMethod<'discoverIntelligence'>>>> => {
      const result = await brain.discoverIntelligence(userId);
      return { success: result.success, data: result.data, error: result.error };
    },
  };
  return port;
}

/** ProactiveCapabilityPort over the real capability marketplace. The async
 *  capability view is snapshotted per call — the proactive layer only needs
 *  the set of capability ids the marketplace currently marks READY. */
export function createProactiveCapabilityPort(
  automationBoundary: {
    assess(candidates: unknown[], irreversible: boolean): { automation: string; reasons: string[] };
  },
  availableCapabilities: (userId: string) => Promise<string[]>,
): ProactiveCapabilityPort {
  let cache: { at: number; byOwner: Map<string, string[]> } = {
    at: 0,
    byOwner: new Map(),
  };
  const port: ProactiveCapabilityPort = {
    availableCapabilities: (
      userId: string,
    ): ReturnType<ProactiveCapabilityPort['availableCapabilities']> => {
      const cached = cache.byOwner.get(userId);
      if (cached) return { success: true, data: cached };
      void availableCapabilities(userId).then((ids) => {
        if (Date.now() - cache.at > 60_000) {
          cache = { at: Date.now(), byOwner: new Map() };
        }
        cache.byOwner.set(userId, ids);
      });
      return { success: true, data: [] };
    },
    assessAutomation: (
      candidates: unknown[],
      irreversible: boolean,
    ): ReturnType<ProactiveCapabilityPort['assessAutomation']> =>
      automationBoundary.assess(candidates, irreversible),
  };
  return port;
}
