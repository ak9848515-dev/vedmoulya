// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Gateway · WorldBridgePorts
// SPRINT-032 — the ONLY seams between the World Model & Business Operating
// System and the frozen estate. Implemented over the real Brain, the real
// proactive service, the real Intelligence Fabric, the real control plane and
// the real persistence stores. Nothing duplicated, nothing fabricated — the
// world model only indexes what the estate already knows.
// ─────────────────────────────────────────────────────────────────────────────

import type { BrainApplicationService } from '@vedmoulya/brain';
import type { ActiveIntelligenceControlPlane } from '@vedmoulya/control-plane';
import type { IntelligenceFabricService } from '@vedmoulya/intelligence-fabric';
import { ActionClassPolicy } from '@vedmoulya/proactive';
import type { ProactiveIntelligenceService } from '@vedmoulya/proactive';
import { LiveSignalAdapter } from '@vedmoulya/world-model';
import type {
  WorldActionPort,
  WorldApprovalPort,
  WorldBrainPort,
  WorldControlPort,
  WorldCostPort,
  WorldFabricPort,
  WorldProactivePort,
  WorldSignalSourcePort,
  WorldStores,
} from '@vedmoulya/world-model';
import type { WorldModelService } from '@vedmoulya/world-model';
import type { CommandCenterPresentationPort } from '@vedmoulya/voice';
import type { CostLedger } from '../observability/CostLedger.js';
import type { TraceStore } from '@vedmoulya/core';

/** WorldBrainPort over the real Brain. Opportunities + tasks are owner-scoped
 *  by the Brain itself — the world model can never reach another owner. */
export function createWorldBrainPort(brain: BrainApplicationService): WorldBrainPort {
  return {
    listOpportunities: (userId: string): ReturnType<WorldBrainPort['listOpportunities']> => {
      const result = brain.listOpportunities(userId);
      if (!result.success) return { success: false, error: result.error };
      return {
        success: true,
        data: (result.data ?? []).map((o) => ({
          id: o.id,
          category: o.category,
          title: o.title,
          description: o.description,
          evidence: o.evidence,
          uncertainty: o.uncertainty,
          status: o.status,
          estimatedValue: o.estimatedValue,
          cost: o.cost,
          risk: o.risk,
          requiredCapabilities: o.requiredCapabilities,
          recommendedNextAction: o.recommendedNextAction,
        })),
      };
    },
    listTasks: (userId: string): ReturnType<WorldBrainPort['listTasks']> => {
      const result = brain.listTasks(userId);
      if (!result.success) return { success: false, error: result.error };
      return {
        success: true,
        data: (result.data ?? []).map((t) => ({
          id: t.id,
          objective: t.objective,
          status: t.status,
          createdAt: t.createdAt,
        })),
      };
    },
  };
}

/** WorldProactivePort over the real assessor. The assessor is research/score
 *  only and NEVER spends, registers or commits — the world layer inherits
 *  that boundary. A failure surfaces honestly (thrown → mapped upstream). */
export function createWorldProactivePort(
  proactive: ProactiveIntelligenceService,
): WorldProactivePort {
  return {
    assessBusiness: (userId, input): ReturnType<WorldProactivePort['assessBusiness']> => {
      const result = proactive.assessBusiness(userId, input);
      if (!result.success) {
        throw new Error(result.error || 'Opportunity assessment unavailable.');
      }
      return result.data;
    },
  };
}

/** WorldFabricPort over the real Intelligence Fabric: advisory selection,
 *  bounded workflow validation and measured cost — never fabricated. */
export function createWorldFabricPort(fabric: IntelligenceFabricService): WorldFabricPort {
  return {
    selectStrategy: (input): ReturnType<WorldFabricPort['selectStrategy']> =>
      fabric.select({
        strategy: input.strategy,
        taskPrivacy: input.taskPrivacy,
        capability: input.capability,
      }),
    validateWorkflow: (plan): ReturnType<WorldFabricPort['validateWorkflow']> =>
      fabric.validateWorkflow(plan),
    costSnapshot: (ownerId: string): { dailyUsd?: number; providerUsd?: number } => {
      const snapshot = fabric.costPort?.snapshot({ ownerId }) ?? {};
      return { dailyUsd: snapshot.dailyUsd, providerUsd: snapshot.providerUsd };
    },
  };
}

/** WorldActionPort over the EXISTING ActionClassPolicy (the frozen
 *  SENSITIVE_ACTIONS authority) — the boundary labels classes, never
 *  grants anything. */
export function createWorldActionPort(): WorldActionPort {
  const policy = new ActionClassPolicy();
  return {
    classify: (action, opts): ReturnType<WorldActionPort['classify']> =>
      policy.classify(action, opts),
  };
}

/** WorldApprovalPort over the EXISTING Brain approval authority (SPRINT-034).
 *  The world model NEVER approves anything itself — a blueprint approval
 *  request becomes APPROVED only when the Brain's frozen approve/reject path
 *  says so. The Brain task created for the sensitive action is returned so
 *  later decisions route through the SAME authority task (never forged). */
export function createWorldApprovalPort(brain: BrainApplicationService): WorldApprovalPort {
  return {
    requestApproval: (input): ReturnType<WorldApprovalPort['requestApproval']> => {
      // Create the task through the Brain (the only way a sensitive action is
      // registered) — the action is the objective, then registered for approval.
      const task = brain.createTask(input.userId, input.action);
      if (!task.success || !task.data) {
        return { success: false, error: task.error ?? 'Could not create the approval task.' };
      }
      const registered = brain.requestApproval(input.userId, task.data.id, input.action);
      if (!registered.success) {
        return { success: false, error: registered.error ?? 'Could not register the approval.' };
      }
      return { success: true, data: { taskId: task.data.id } };
    },
    approve: (input): ReturnType<WorldApprovalPort['approve']> => {
      const result = brain.approve(input.userId, input.taskId, input.action);
      if (!result.success || !result.data) {
        return { success: false, error: result.error ?? 'Approval refused by the authority.' };
      }
      return {
        success: true,
        data: {
          grantedBy: input.userId,
          grantedAt: result.data.updatedAt,
          scope: input.action,
        },
      };
    },
    reject: (input): ReturnType<WorldApprovalPort['reject']> => {
      const result = brain.reject(input.userId, input.taskId, input.action);
      if (!result.success) {
        return { success: false, error: result.error ?? 'Rejection refused by the authority.' };
      }
      return { success: true };
    },
  };
}

/** WorldCostPort over the EXISTING CostLedger (SPRINT-034) — measure-only.
 *  The world model READS measured cost; it never writes accounting. Absent
 *  evidence → undefined (never zero).
 *
 *  Honesty: the CostLedger aggregates over the trace spine by owner — it has
 *  NO per-revenue-stream ledger key. A stream-scoped cost figure would be
 *  FABRICATED, so stream-scoped queries return undefined (the stream's own
 *  evidence-carrying figures remain the only cost basis, and UNKNOWN stays
 *  UNKNOWN). Owner-level queries return the true measured aggregate. */
export function createWorldCostPort(ledger: CostLedger, traceStore: TraceStore): WorldCostPort {
  return {
    measuredCostUsd: (ownerId, scope): ReturnType<WorldCostPort['measuredCostUsd']> => {
      // A per-stream ledger key does not exist — never attribute the owner
      // aggregate to one stream (that would overstate it). Honest undefined.
      if (scope?.streamId) return undefined;
      const snapshot = ledger.compute(traceStore, { userId: ownerId, limit: 500 });
      return snapshot.totals.costUsd > 0
        ? { value: snapshot.totals.costUsd, evidence: ['cost-ledger:owner-aggregate'] }
        : undefined;
    },
  };
}

/** SPRINT-035 — Command Center PRESENTATION port for voice. Read-only
 *  answers composed from the EXISTING world read models (founder briefing,
 *  opportunity pipeline, blueprint approvals, revenue ranking, measured cost).
 *  VOICE ≠ AUTHORIZATION is preserved: this port has no side effects — it
 *  cannot authorize, approve, spend or execute. It is wired into the voice
 *  assistant lazily (the world service is constructed after the assistant). */
export function createCommandCenterPresentationPort(
  getWorld: () => WorldModelService | undefined,
): CommandCenterPresentationPort {
  return {
    ask: async (input): Promise<{ ok: boolean; content?: string; error?: string }> => {
      const world = getWorld();
      if (!world) return { ok: false, error: 'World model not ready.' };
      const briefing = await world.founderBriefing(input.userId);
      const pipeline = world.opportunityPipeline(input.userId, { limit: 5 });
      const approvals = world.listBlueprintApprovals(input.userId);
      const ranking = world.revenueRanking(input.userId);
      const briefingData = briefing.success ? briefing.data : undefined;

      switch (input.question) {
        case 'FOCUS_TODAY': {
          if (briefingData?.hasContent) {
            const lines = [
              ...briefingData.today.pendingApprovals.map(
                (p) => `${p.title} (${p.category}) needs your approval`,
              ),
              ...briefingData.attention.map((a) => `${a.title} — ${a.reason}`),
            ];
            return {
              ok: true,
              content:
                lines.length > 0
                  ? `Today you have ${lines.length} item${lines.length === 1 ? '' : 's'} to focus on: ${lines.slice(0, 3).join('; ')}.`
                  : 'Nothing urgent needs attention today — no spam by design.',
            };
          }
          return {
            ok: true,
            content: 'Nothing urgent needs attention today — no spam by design.',
          };
        }
        case 'OPPORTUNITIES': {
          if (pipeline.success && pipeline.data.length > 0) {
            const top = pipeline.data
              .slice(0, 3)
              .map((o) => `${o.title} (advisory score ${o.score.toFixed(2)}, ${o.capitalMode})`)
              .join('; ');
            return {
              ok: true,
              content: `${pipeline.data.length} opportunity${pipeline.data.length === 1 ? '' : 'ies'} in your pipeline. Top ones: ${top}. Scores are advisory — never a promise.`,
            };
          }
          return { ok: true, content: 'Your opportunity pipeline is empty right now.' };
        }
        case 'PENDING_APPROVALS': {
          const waiting = approvals.success
            ? approvals.data.filter((a) => a.status === 'WAITING_FOR_APPROVAL')
            : [];
          if (waiting.length === 0) {
            return { ok: true, content: 'Nothing is waiting for your approval right now.' };
          }
          return {
            ok: true,
            content: `${waiting.length} action${waiting.length === 1 ? '' : 's'} waiting for your approval: ${waiting
              .slice(0, 3)
              .map((a) => a.action)
              .join('; ')}. You can approve them in the command center — voice cannot approve.`,
          };
        }
        case 'BEST_MARGIN': {
          const withMargin = ranking.entries
            .filter((e) => e.estimatedMargin !== undefined || e.roiUsd !== undefined)
            .sort((a, b) => (b.rankScore ?? 0) - (a.rankScore ?? 0));
          if (withMargin.length === 0) {
            return {
              ok: true,
              content:
                'There is no verified margin evidence yet — unknown margin is never treated as zero.',
            };
          }
          const best = withMargin[0];
          if (!best) {
            return {
              ok: true,
              content:
                'There is no verified margin evidence yet — unknown margin is never treated as zero.',
            };
          }
          return {
            ok: true,
            content: `${best.streamName} has the best margin evidence (${best.estimatedMargin !== undefined ? `${Math.round(best.estimatedMargin * 100)}% estimated margin` : 'ROI-backed'}). Advisory only — never a promise.`,
          };
        }
        case 'WHAT_CHANGED': {
          const changes = briefingData?.whatChanged ?? [];
          if (changes.length === 0) {
            return { ok: true, content: 'Nothing significant changed today.' };
          }
          return {
            ok: true,
            content: `Today: ${changes
              .slice(0, 3)
              .map((c) => c.label)
              .join('; ')}.`,
          };
        }
        case 'WORKFLOW_COST': {
          const command = await world.commandCenter(input.userId);
          const daily = command.portfolio.costDailyUsd;
          return {
            ok: true,
            content:
              daily !== undefined
                ? `Measured cost is ${daily.toFixed(3)} USD per day from the cost ledger. Per-workflow attribution needs execution tracking — I will not estimate it.`
                : 'No measured cost evidence exists yet — unknown cost is never treated as zero.',
          };
        }
        // ── SPRINT-039 — founder evidence loop presentation (read-only) ─────
        case 'STRONGEST_OPPORTUNITIES': {
          const comparison = world.compareOpportunities(input.userId, { limit: 5 });
          const strong = comparison.entries.filter(
            (e) => e.state === 'STRONG_EVIDENCE' || e.state === 'PROMISING',
          );
          if (strong.length === 0) {
            return {
              ok: true,
              content:
                'No opportunities currently meet the evidence bar. Confidence stays honest — nothing is promoted without evidence.',
            };
          }
          const top = strong
            .slice(0, 3)
            .map(
              (e) =>
                `${e.problemStatement.slice(0, 60)} (${e.state.replace(/_/g, ' ').toLowerCase()}, ${e.verifiedPayments} verified payment${e.verifiedPayments === 1 ? '' : 's'})`,
            )
            .join('; ');
          return {
            ok: true,
            content: `Your strongest opportunities: ${top}. Advisory ranking only — evidence, never a promise.`,
          };
        }
        case 'EVIDENCE': {
          const comparison = world.compareOpportunities(input.userId, { limit: 3 });
          if (comparison.entries.length === 0) {
            return {
              ok: true,
              content:
                'No recorded evidence yet — enter real observations and they will be kept distinct from guesses.',
            };
          }
          const lines = comparison.entries
            .slice(0, 3)
            .map(
              (e) =>
                `${e.problemStatement.slice(0, 50)} — evidence ${e.evidenceStrength.toLowerCase()}, ${e.verifiedPayments} verified payment${e.verifiedPayments === 1 ? '' : 's'}, ${e.opportunityScore.toFixed(2)} advisory score`,
            )
            .join('; ');
          return {
            ok: true,
            content: `Evidence summary: ${lines}. Every item keeps its provenance — nothing is fabricated.`,
          };
        }
        case 'NEXT_TEST': {
          const comparison = world.compareOpportunities(input.userId, { limit: 5 });
          const actionable = comparison.entries.filter(
            (e) => e.nextBestAction !== 'STOP' && e.nextBestAction !== 'WAIT_FOR_MORE_EVIDENCE',
          );
          if (actionable.length === 0) {
            return {
              ok: true,
              content:
                'No test is recommended right now — either everything needs more evidence or it should stop. That is the honest answer.',
            };
          }
          const next = actionable[0];
          if (!next) {
            return {
              ok: true,
              content:
                'No test is recommended right now — either everything needs more evidence or it should stop. That is the honest answer.',
            };
          }
          return {
            ok: true,
            content: `Next test for "${next.problemStatement.slice(0, 50)}": ${next.nextBestAction.replace(/_/g, ' ').toLowerCase()}. This maximizes learning per unit of founder time or capital — advisory only.`,
          };
        }
        case 'WHY_RECOMMENDATION': {
          const comparison = world.compareOpportunities(input.userId, { limit: 1 });
          const first = comparison.entries[0];
          if (!first || first.reasons.length === 0) {
            return {
              ok: true,
              content:
                'There is no recommendation with reasons yet — nothing is recommended without an evidence trail.',
            };
          }
          return {
            ok: true,
            content: `Because: ${first.reasons.slice(0, 3).join('; ')}. The score stays explainable — every factor and its evidence is visible in the command center.`,
          };
        }
        case 'STRONGEST_PAYMENT': {
          const comparison = world.compareOpportunities(input.userId, { limit: 5 });
          const paid = comparison.entries
            .filter((e) => e.verifiedPayments > 0)
            .sort((a, b) => b.verifiedPayments - a.verifiedPayments);
          if (paid.length === 0) {
            return {
              ok: true,
              content:
                'No verified payment evidence exists yet. Interest is not revenue — only a verified payment becomes revenue evidence.',
            };
          }
          const best = paid[0];
          if (!best) {
            return {
              ok: true,
              content:
                'No verified payment evidence exists yet. Interest is not revenue — only a verified payment becomes revenue evidence.',
            };
          }
          return {
            ok: true,
            content: `"${best.problemStatement.slice(0, 50)}" has the strongest payment evidence: ${best.verifiedPayments} verified payment${best.verifiedPayments === 1 ? '' : 's'}. Revenue state comes only from verified payments.`,
          };
        }
        case 'STOP_OPPORTUNITIES': {
          const comparison = world.compareOpportunities(input.userId, { limit: 50 });
          const stops = comparison.entries.filter((e) => e.state === 'STOP');
          if (stops.length === 0) {
            return {
              ok: true,
              content:
                'Nothing is currently flagged to stop. The system is allowed to say STOP when evidence says so — today it does not.',
            };
          }
          return {
            ok: true,
            content: `Consider stopping: ${stops
              .slice(0, 3)
              .map((e) => e.problemStatement.slice(0, 60))
              .join(
                '; ',
              )}. Killing a bad idea early protects your time and capital — advisory only.`,
          };
        }
        default:
          return { ok: false, error: 'Unknown question.' };
      }
    },
  };
}

/** Resolve the operator-configured live world signal sources (SPRINT-034).
 *  Server-side env only — credentials NEVER reach the browser. With no
 *  configuration the adapter reports UNAVAILABLE honestly (never fabricated
 *  live world data). */
export function resolveWorldSignalSources(): WorldSignalSourcePort[] {
  const baseUrl = process.env.WORLD_SIGNAL_BASE_URL;
  if (!baseUrl || baseUrl.trim().length === 0) return [];
  return [
    new LiveSignalAdapter({
      baseUrl: baseUrl.trim(),
      // Server-side credential — never exposed to the browser bundle.
      token: process.env.WORLD_SIGNAL_TOKEN?.trim() || undefined,
    }),
  ];
}

/** WorldControlPort over the real control plane: opportunity lifecycle
 *  records + autonomy posture (read-only — the world model never changes
 *  settings or stop state). */
export function createWorldControlPort(
  controlPlane: ActiveIntelligenceControlPlane,
): WorldControlPort {
  return {
    listOpportunities: (userId: string): ReturnType<WorldControlPort['listOpportunities']> =>
      controlPlane.listOpportunities(userId).map((o) => ({
        id: o.id,
        title: o.title,
        category: o.category,
        status: o.status,
        riskLevel: o.riskLevel,
        estimatedCost: o.estimatedCost,
        estimatedValue: o.estimatedValue,
        evidence: o.evidence,
        recommendedWorkflow: o.recommendedWorkflow,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      })),
    autonomyPosture: (ownerId: string): ReturnType<WorldControlPort['autonomyPosture']> => {
      const settings = controlPlane.getSettings(ownerId);
      const stop = controlPlane.stopStatus(ownerId);
      return {
        emergencyStopEngaged: stop.engaged,
        autonomyLevel: settings?.autonomyLevel ?? 0,
        settingsConfirmed: settings?.userConfirmed ?? false,
      };
    },
  };
}

/** The owner-scoped stores bundle for the world model (in-memory or Postgres
 *  write-through — resolved by the persistence bundle). */
export function createWorldStores(stores: WorldStores): WorldStores {
  return stores;
}
