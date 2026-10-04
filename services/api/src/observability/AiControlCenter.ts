// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI Control Center (the honest provider-usage view model)
// THE UI never derives a balance/quota itself. This service composes ONLY real
// runtime evidence from the durable usage ledger + the provider registry:
//
//   usage (real executions, calendar-day/month in the user's timezone)
//   → per-provider usage (CLOUD and LOCAL shown separately)
//   → per-provider quota (UNKNOWN stays UNKNOWN)
//   → user budget vs platform allowance (never conflated)
//
// Nothing here fabricates: an absent provider quota produces `quotaKnown:false`
// and no remaining-token number; an absent cost produces `costUnknown:true`.
// ─────────────────────────────────────────────────────────────────────────────

import { aggregateAiUsage } from '../observability/AiUsageBoard.js';
import type { AiUsageBoard } from '../observability/AiUsageBoard.js';
import type { AiUsageRecorder } from '../observability/AiUsageRecorder.js';
import {
  resolveProviderQuotaView,
  resolveRemainingCapacity,
  resolveUserBudgetView,
  type ProviderQuotaView,
  type RemainingCapacity,
  type UserBudgetView,
} from '../observability/AiBudgetSemantics.js';
import {
  deriveProviderReadiness,
  buildReadinessOverrides,
  type ProviderReadinessView,
  type ReadinessInput,
} from '../observability/ProviderReadinessModel.js';
import type { RuntimeExecutionHealth } from '@vedmoulya/services';
import type { ProviderExperienceRow } from '../services/ProviderExperienceService.js';

const LOCAL_FAMILIES = new Set(['ollama', 'lm-studio', 'local', 'custom']);

export interface ProviderBoardRow {
  providerId: string;
  name: string;
  family: string;
  local: boolean;
  enabled: boolean;
  /** Tokens used this calendar month by this provider (0 when never used). */
  monthTokens: number;
  monthExecutions: number;
  /** Provider-reported quota. `quotaKnown:false` ⇒ remaining is UNKNOWN. */
  quota: ProviderQuotaView;
  /** Cost semantics: real when known, explicitly UNKNOWN otherwise. */
  monthCostUsd: number;
  monthCostKnown: boolean;
  /** Honest runtime state — a configured provider can be NOT executable. */
  readiness: ProviderReadinessView;
}

export interface ConfiguredAiSummary {
  activeCloudAis: number;
  localAis: number;
  monthCloudTokens: number;
  monthCloudCostUsd: number;
  monthCloudCostKnown: boolean;
  todayCloudTokens: number;
  todayCloudCostUsd: number;
  todayCloudCostKnown: boolean;
  todayCloudExecutions: number;
  monthCloudExecutions: number;
  localMonthTokens: number;
  localTodayTokens: number;
}

export interface AiControlCenterView {
  timezone: string;
  todayStart: number;
  monthStart: number;
  summary: ConfiguredAiSummary;
  budget: UserBudgetView;
  /** Present ONLY when a real limit exists — otherwise the UI shows "Unknown". */
  remaining: RemainingCapacity;
  providers: ProviderBoardRow[];
  byModel: AiUsageBoard['byModel'];
  bySource: AiUsageBoard['bySource'];
  recent: AiUsageBoard['recent'];
  totalEvents: number;
}

function isLocalFamily(family: string): boolean {
  return LOCAL_FAMILIES.has(family.toLowerCase());
}

/**
 * SPRINT (Phase 1) — the narrow evidence surface the Control Center reads.
 * Structurally satisfied by the EXISTING `ExecutionHealthService`; declared
 * here so the Control Center does not depend on the health implementation.
 */
export interface ExecutionHealthEvidenceSource {
  getProviderHealth(providerId: string): RuntimeExecutionHealth | undefined;
}

/**
 * Per-provider readiness EVIDENCE. Only the facts that must come from outside
 * the registry row (real runtime outcomes) live here; `enabled`, the credential
 * source and the reported quota are always taken from the authoritative
 * provider row, so an override can never contradict the registry.
 */
export type ReadinessEvidenceOverrides = Record<string, Partial<ReadinessInput>>;

export class AiControlCenterService {
  constructor(
    private readonly usage: AiUsageRecorder,
    /**
     * SPRINT (Phase 1) — the EXISTING runtime execution-evidence store. When
     * supplied, provider readiness is derived from what actually happened at
     * runtime (real successes and classified failures) instead of from
     * `configured && enabled`. Omitting it keeps the previous behaviour, so
     * every existing construction site stays valid.
     */
    private readonly executionHealth?: ExecutionHealthEvidenceSource,
  ) {}

  /**
   * Build the AI Control Center for ONE owner. `timezone` is the user's
   * configured timezone; an invalid value falls back to UTC (never a crash,
   * never a silently shifted "today").
   */
  async getControlCenter(
    userId: string,
    providers: ProviderExperienceRow[],
    preferences: {
      monthlyTokenBudget?: number;
      monthlyTokenBudgetSource?: 'USER' | 'PLATFORM';
      monthlyTokenBudgetConfiguredAt?: string;
    },
    timezone?: string,
    /** Optional explicit readiness evidence (tests / operator overrides). */
    readinessOverrides?: ReadinessEvidenceOverrides,
  ): Promise<AiControlCenterView> {
    const events = await this.usage.getStore().list({ userId, limit: 20_000 });
    const board = aggregateAiUsage(events, { ...(timezone !== undefined ? { timezone } : {}) });
    const monthByProvider = new Map(
      board.monthByProvider.map((row) => [row.provider, row] as const),
    );

    // SPRINT (Phase 1) — read the REAL runtime execution evidence the AI runtime
    // already recorded. No probe, no new store: this is the same
    // ExecutionHealthService instance that feeds the routing advisor.
    const runtimeEvidence =
      this.executionHealth !== undefined
        ? buildReadinessOverrides(
            providers.map((p) => p.providerId),
            (id) => this.executionHealth?.getProviderHealth(id),
          )
        : {};
    const overrides: ReadinessEvidenceOverrides = { ...runtimeEvidence, ...readinessOverrides };

    const rows: ProviderBoardRow[] = providers.map((p) => {
      const local = isLocalFamily(p.family);
      const usageRow = monthByProvider.get(p.providerId);
      const quotaPercent = p.health.quotaUsedPercent;
      // Readiness is derived from REAL evidence (credential + health + reported
      // quota + last runtime outcome) — never from `enabled && configured`.
      const readiness = deriveProviderReadiness({
        ...(overrides[p.providerId] ?? {}),
        providerId: p.providerId,
        enabled: p.enabled,
        credentialSource: p.credentialSource,
        quotaUsedPercent: quotaPercent,
        healthStatus: p.health.status,
        local,
      });
      return {
        providerId: p.providerId,
        name: p.name,
        family: p.family,
        local,
        enabled: p.enabled,
        monthTokens: usageRow?.totalTokens ?? 0,
        monthExecutions: usageRow?.executions ?? 0,
        quota: resolveProviderQuotaView(p.providerId, quotaPercent, local),
        monthCostUsd: usageRow?.costUsd ?? 0,
        monthCostKnown: usageRow !== undefined ? !usageRow.costUnknown : false,
        readiness,
      };
    });

    const budget = resolveUserBudgetView({
      ...(preferences.monthlyTokenBudget !== undefined
        ? { monthlyTokenBudget: preferences.monthlyTokenBudget }
        : {}),
      ...(preferences.monthlyTokenBudgetSource !== undefined
        ? { monthlyTokenBudgetSource: preferences.monthlyTokenBudgetSource }
        : {}),
      ...(preferences.monthlyTokenBudgetConfiguredAt !== undefined
        ? { budgetConfiguredAt: preferences.monthlyTokenBudgetConfiguredAt }
        : {}),
    });

    return {
      timezone: board.timezone,
      todayStart: board.todayStart,
      monthStart: board.monthStart,
      summary: {
        activeCloudAis: rows.filter((r) => r.enabled && !r.local).length,
        localAis: rows.filter((r) => r.local).length,
        monthCloudTokens: board.monthCloud.totalTokens,
        monthCloudCostUsd: board.monthCloud.costUsd,
        monthCloudCostKnown: board.monthCloud.executions === 0 || !board.monthCloud.costUnknown,
        todayCloudTokens: board.todayCloud.totalTokens,
        todayCloudCostUsd: board.todayCloud.costUsd,
        todayCloudCostKnown: board.todayCloud.executions === 0 || !board.todayCloud.costUnknown,
        todayCloudExecutions: board.todayCloud.executions,
        monthCloudExecutions: board.monthCloud.executions,
        localMonthTokens: board.monthLocal.totalTokens,
        localTodayTokens: board.todayLocal.totalTokens,
      },
      budget,
      remaining: resolveRemainingCapacity(board.monthCloud.totalTokens, budget),
      providers: rows,
      byModel: board.byModel,
      bySource: board.bySource,
      recent: board.recent,
      totalEvents: board.totalEvents,
    };
  }
}
