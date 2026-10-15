// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Provider Experience Service
// EPIC-012A — AI Provider Intelligence & Premium UX (Phases 4–6 / 12–17)
//
// Composes the AI Providers experience view model for ONE authenticated
// user:
//   - the registry (every provider is an asset, disabled ones included),
//   - the user's OWNER-SCOPED preferences (enabled set, preferred model,
//     budget policy),
//   - the DURABLE owner-scoped AI usage ledger (aggregate token/cost usage,
//     per-provider); the EPIC-012 trace cost ledger is only a fallback for
//     embedders without a ledger, and `usageSource` says which one answered.
//
// The gateway's session middleware guarantees userId === session user, so
// every read/write here is owner-scoped (IDOR refused at the boundary).
// The service NEVER touches provider credentials and NEVER invents usage
// numbers — absent accounting attributes contribute zero (honest zeros).
// ─────────────────────────────────────────────────────────────────────────────

import type { ProviderApplicationService } from '@vedmoulya/providers';
import { classifyResource, describeProviderSwitch } from '@vedmoulya/providers';
import type { ProviderPreferencesService } from '@vedmoulya/providers';
import type { ProviderPreferences } from '@vedmoulya/providers';
import type { ProviderHealthSource, ProviderQuotaSource } from '@vedmoulya/providers';
import type { ProviderAccountMetric, ProviderAccountUsageMetric } from '@vedmoulya/providers';
import type { ProviderDTO, ProviderModelDTO } from '@vedmoulya/providers';
import { defaultProviderPreferences } from '@vedmoulya/providers';
import type { ProviderStatus } from '@vedmoulya/ai';
import { ModelSelectionIntelligence } from '@vedmoulya/services';
import type { CostLedger, CostLedgerSnapshot } from '../observability/CostLedger.js';
import type { TraceStore } from '@vedmoulya/core';
import type { AiUsageRecorder } from '../observability/AiUsageRecorder.js';
import { aggregateAiUsage } from '../observability/AiUsageBoard.js';
import {
  resolveRemainingCapacity,
  resolveUserBudgetView,
  type BudgetSource,
} from '../observability/AiBudgetSemantics.js';
import { openaiOrgUsageProbe, openaiOrgWindow } from './ProviderUsageIngestor.js';
import type { OpenAIOrgModelUsage, OpenAIOrgPeriod } from './ProviderUsageIngestor.js';

// F-2: the canonical health vocabulary, single-sourced from the `@vedmoulya/ai`
// `ProviderStatus` union so `deriveAvailability` (and any future reader of the
// row's `health.status`) validates against the contract instead of inline strings.
// Typed as a readonly `ProviderStatus[]` so a divergence from the canonical union
// is a compile error here rather than a silent drift.
export const CANONICAL_PROVIDER_HEALTH_VALUES: readonly ProviderStatus[] = [
  'healthy',
  'degraded',
  'unstable',
  'down',
] as const;

export interface ProviderModelExperience {
  id: string;
  name: string;
  /** Short capability labels for the model dropdown (e.g. Reasoning · Coding). */
  capabilities: string[];
}

export interface ProviderExperienceRow {
  providerId: string;
  name: string;
  family: string;
  /**
   * PROVIDER-01 — WHICH credential can authenticate this provider for THIS
   * user: their OWN stored (verified) credential ('USER'), this deployment's
   * ('PLATFORM'), or none ('NONE'). Never the secret itself. The overview uses
   * it so a user-supplied key that the runtime registry cannot see still reads
   * as connected once the user has enabled the AI.
   */
  credentialSource: 'USER' | 'PLATFORM' | 'NONE';
  /** Selected/default model for this user (preferred model or best fit). */
  selectedModel: { id: string; name: string } | null;
  /** Every model the registry knows for this provider (never hardcoded). */
  models: ProviderModelExperience[];
  availability: ProviderAvailability;
}

// ── View model types ────────────────────────────────────────────────────────
export type ProviderAvailability = 'AVAILABLE' | 'LIMITED' | 'UNAVAILABLE' | 'LOCAL' | 'UNKNOWN';

export interface ProviderModelExperience {
  id: string;
  name: string;
  /** Short capability labels for the model dropdown (e.g. Reasoning · Coding). */
  capabilities: string[];
}

export interface ProviderExperienceRow {
  providerId: string;
  name: string;
  family: string;
  /**
   * PROVIDER-01 — WHICH credential can authenticate this provider for THIS
   * user: their OWN stored (verified) credential ('USER'), this deployment's
   * ('PLATFORM'), or none ('NONE'). Never the secret itself. The overview uses
   * it so a user-supplied key that the runtime registry cannot see still reads
   * as connected once the user has enabled the AI.
   */
  credentialSource: 'USER' | 'PLATFORM' | 'NONE';
  /** Selected/default model for this user (preferred model or best fit). */
  selectedModel: { id: string; name: string } | null;
  /** Every model the registry knows for this provider (never hardcoded). */
  models: ProviderModelExperience[];
  availability: ProviderAvailability;
  enabled: boolean;
  /**
   * Mandatory-provider invariant (server-enforced): when the enable switch
   * is disabled in the UI, the truthful reason ("VedMoulya requires at
   * least one active AI provider." for the last enabled provider's switch).
   */
  switchDisabledReason?: string;
  resourceType: string;
  freeToUse: boolean;
  health: {
    status: string;
    score: number;
    latencyMs: number;
    quotaUsedPercent: number;
    /**
     * Provenance of `quotaUsedPercent` (absent ⇒ 'SEED'). Registry seed figures
     * are NOT measurements: the screen must never render one as the provider's
     * account usage, remaining balance or "% remaining".
     */
    quotaSource?: ProviderQuotaSource;
    /**
     * Provenance of the health RECORD (absent ⇒ 'SEED'). A 'SEED' record is
     * catalog data — status/score/latency were never measured for this
     * deployment and `lastCheckedAt` is the catalog's build time — so a seeded
     * 'healthy' must never be rendered as a live check.
     */
    healthSource?: ProviderHealthSource;
    /**
     * GENUINE provider-reported account metrics (account tokens / cost / credits
     * / bounded-quota-used), keyed by metric. Absent key ⇒ never retrieved.
     * Kept DISTINCT from VedMoulya's runtime tokens and estimated cost.
     */
    accountUsage?: Partial<Record<ProviderAccountMetric, ProviderAccountUsageMetric>>;
  };
  lifecycleStatus: string;
}

export interface UsageSummary {
  tokensUsed: number;
  /**
   * The USER's configured monthly token limit. UNDEFINED when none is
   * configured: the historical platform default (1,000,000) is NEVER
   * substituted, because presenting it as a budget fabricated a 1M-token
   * allowance that nobody set. `budgetSource` says what the number is.
   */
  tokenBudget?: number;
  /** Provenance of `tokenBudget` — 'NONE' means "not configured". */
  budgetSource: BudgetSource;
  /** ISO timestamp the user configured the budget (absent = never). */
  budgetConfiguredAt?: string;
  /** Authoritative remaining tokens — present ONLY when a real limit exists. */
  remainingTokens?: number;
  /** Basis of the remaining figure; 'UNKNOWN' means no limit is known. */
  budgetBasis: 'USER_BUDGET' | 'PLATFORM_ALLOWANCE' | 'PROVIDER_QUOTA' | 'UNKNOWN';
  costUsd: number;
  aiCalls: number;
  cacheHits: number;
  /** True while any recorded execution had no provider-reported price. */
  costUnknown: boolean;
  /** Percentage of usage attributed to free resources (honest, 0 when unknown). */
  freePercent: number;
  /**
   * WHERE these figures came from — never implied:
   *   'DURABLE_USAGE_LEDGER' → the owner-scoped durable ledger (survives
   *                            restarts; the same authority the AI Control
   *                            Center reads).
   *   'TRACE_LEDGER'         → the in-process execution trace store only. Its
   *                            accounting attributes are absent for plain Ask
   *                            calls, so it can report 0 for usage that really
   *                            happened.
   */
  usageSource: 'DURABLE_USAGE_LEDGER' | 'TRACE_LEDGER';
  /** True only when the durable, owner-scoped usage store was actually read. */
  durableChecked: boolean;
  budgetPolicy: ProviderPreferences['budgetPolicy'];
  budgets: ProviderPreferences['budgets'];
}

export interface ProviderExperienceView {
  providers: ProviderExperienceRow[];
  usage: UsageSummary;
  preferences: ProviderPreferences;
}

/** Per-model economics derived from trace ai.* spans (provider + model attrs). */
export interface ModelUsageRow {
  providerId: string;
  modelId: string;
  calls: number;
  latencyMs: number;
  tokensTotal: number;
  costUsd: number;
}

export interface ProviderUsageDetail {
  totals: CostLedgerSnapshot['totals'];
  byProvider: CostLedgerSnapshot['byProvider'];
  byModel: ModelUsageRow[];
  executions: CostLedgerSnapshot['executions'];
  preferences: ProviderPreferences;
  /**
   * WHERE these numbers came from. The screen must say so, because the two
   * sources are not equivalent:
   *   'DURABLE_USAGE_LEDGER' → the owner-scoped durable AI usage ledger
   *                            (`ai_usage_events`) — survives restarts and is
   *                            the SAME authority the AI Control Center reads.
   *   'TRACE_LEDGER'         → the in-process execution trace store only. Its
   *                            accounting attributes are absent for plain Ask
   *                            calls, so it can report 0 tokens/0 cost for
   *                            usage that REALLY happened.
   */
  usageSource: 'DURABLE_USAGE_LEDGER' | 'TRACE_LEDGER';
  /** True only when a durable, owner-scoped usage store was actually read. */
  durableChecked: boolean;
  /**
   * True when at least one recorded execution carried no provider-reported
   * price — the cost figures below are then a lower bound, never a total.
   */
  costUnknown: boolean;
  /** The window the figures cover ('ALL_RECORDED' = every stored execution). */
  window: 'ALL_RECORDED';
}

export interface ProviderExperienceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ── Model capability labels (Phase 4 — real data from the registry) ────────
// The registry already carries per-model capability metadata (the capability
// taxonomy + boolean flags). We project it into short human-readable labels
// for the model selector — NEVER hardcoded in the UI.

const MODEL_CAPABILITY_LABELS: Record<string, string> = {
  reasoning: 'Reasoning',
  coding: 'Coding',
  vision: 'Vision',
  embeddings: 'Embeddings',
  summarization: 'Summarization',
  classification: 'Classification',
  translation: 'Translation',
  speech: 'Audio',
  image_understanding: 'Vision',
  general_conversation: 'Chat',
  content_generation: 'Generation',
};

/**
 * Project a registry model into short, premium capability labels.
 * Combines the declared capability taxonomy with the boolean feature flags,
 * deduplicates, and bounds the list (the dropdown shows a small hint, not a
 * spec sheet). Empty when the registry carries no capability data.
 */
export function modelCapabilityLabels(model: ProviderModelDTO): string[] {
  const labels: string[] = [];
  const add = (label: string): void => {
    if (!labels.includes(label)) labels.push(label);
  };
  for (const cap of model.capabilities) {
    const label = MODEL_CAPABILITY_LABELS[cap] ?? cap;
    if (label) add(label);
  }
  if (model.reasoning) add('Reasoning');
  if (model.coding) add('Coding');
  if (model.vision) add('Vision');
  if (model.audio) add('Audio');
  if (model.embeddings) add('Embeddings');
  if (model.functionCalling) add('Tools');
  return labels.slice(0, 4);
}

// ── Availability derivation (Phase 5 — never depends on colour alone) ──────

function deriveAvailability(
  provider: ProviderDTO,
  prefs: ProviderPreferences,
): ProviderAvailability {
  const localFamilies = new Set(['ollama', 'lm-studio', 'local', 'custom']);
  if (localFamilies.has(provider.family)) return 'LOCAL';

  const lifecycle = provider.lifecycleStatus;
  const health = provider.health.status;
  if (lifecycle === 'deprecated' || lifecycle === 'archived') return 'UNAVAILABLE';

  // Fail-closed (F-2): the registry reports the canonical `@vedmoulya/ai`
  // `ProviderStatus` vocabulary (`healthy` | `degraded` | `unstable` | `down`).
  // Any other value — a future vocabulary member, a cross-vocabulary literal
  // such as `\`unhealthy\`` (the same value that F-U1 blocks from reaching READY),
  // or a typo — must never fall through to `AVAILABLE`/`LIMITED`. An unrecognized
  // status is the absence of a trustworthy health signal and is treated as
  // `UNKNOWN` (honest), never as `AVAILABLE`.
  if (!CANONICAL_PROVIDER_HEALTH_VALUES.includes(health)) {
    return 'UNKNOWN';
  }

  if (health === 'down' || health === 'unstable') return 'UNAVAILABLE';
  // A registry SEED quota must not move availability either: only a
  // provider-reported percentage may.
  if (
    health === 'degraded' ||
    (provider.health.quotaSource === 'PROVIDER_REPORTED' && provider.health.quotaUsedPercent >= 80)
  )
    return 'LIMITED';
  if (prefs.disabledProviderIds.includes(provider.id)) return 'UNAVAILABLE';
  // Honest absence of evidence: a provider that has never produced a health
  // sample is not known to be usable — keep the pre-F-2 UNKNOWN rule.
  if (provider.health.healthScore <= 0 && provider.health.lastCheckedAt === '') return 'UNKNOWN';
  return 'AVAILABLE';
}

// F-2: `CANONICAL_PROVIDER_HEALTH_VALUES` above is the single place the
// provider-screen health-vocabulary contract lives. When the upstream
// `@vedmoulya/ai` `ProviderStatus` union changes, update it first so the
// provider screen cannot silently diverge from the canonical union.

/** OpenAI org usage view (surfaced in the usage details view). */
export interface OpenAIOrgUsageViewPayload {
  /** True when real OpenAI-reported usage was retrieved for this period. */
  available: boolean;
  period: OpenAIOrgPeriod;
  /** Human-readable explanation when `available` is false (never fabricated). */
  message: string;
  rows: OpenAIOrgModelUsage[];
  totals: { inputTokens: number; cachedInputTokens: number; outputTokens: number };
  /** True when the endpoint signalled more pages than this single read. */
  hasMore?: boolean;
}

const EMPTY_ORG_TOTALS = {
  inputTokens: 0,
  cachedInputTokens: 0,
  outputTokens: 0,
} as const;

/** Injectable seams for the OpenAI org usage read (tests inject these). */
export interface ProviderExperienceServiceOptions {
  openaiOrgEnv?: Record<string, string | undefined>;
  openaiOrgFetch?: (input: string, init?: RequestInit) => Promise<Response>;
  openaiOrgNow?: () => Date;
  /**
   * PROVIDER-01 — resolve WHICH credential source can authenticate a family
   * for a user (user → platform → none), WITHOUT any secret material. Absent
   * in tests/embedders that do not model credentials: every row then reports
   * 'NONE' and the overview falls back to the deployment runtime truth alone.
   */
  resolveCredentialSource?: (
    userId: string,
    family: string,
  ) => Promise<'USER' | 'PLATFORM' | 'NONE'>;
  /**
   * The DURABLE AI usage ledger (same authority the AI Control Center reads).
   * When supplied, usage detail is read from it — only a produced figure is
   * ever shown, and "no recorded usage" is only claimed after the store was
   * actually queried. Absent (tests/embedders): the trace ledger is used and
   * the payload says so.
   */
  usageRecorder?: Pick<AiUsageRecorder, 'getStore'>;
}

export class ProviderExperienceService {
  private readonly options: ProviderExperienceServiceOptions;

  constructor(
    private readonly providers: ProviderApplicationService,
    private readonly preferences: ProviderPreferencesService,
    private readonly modelSelection: ModelSelectionIntelligence,
    private readonly ledger: CostLedger,
    private readonly traceStore: TraceStore,
    options: ProviderExperienceServiceOptions = {},
  ) {
    this.options = options;
  }

  /** The AI Providers screen view model (Phase 4). */
  async getOverview(userId: string): Promise<ProviderExperienceResult<ProviderExperienceView>> {
    if (!userId) return { success: false, error: 'userId is required' };
    const [marketplace, prefsResult] = await Promise.all([
      this.providers.getMarketplace(),
      this.preferences.getPreferences(userId),
    ]);
    if (!marketplace.data || !prefsResult.data) {
      return {
        success: false,
        error: marketplace.error ?? prefsResult.error ?? 'Unable to load providers',
      };
    }
    const prefs = prefsResult.data;
    const disabled = new Set(prefs.disabledProviderIds);
    // The SINGLE platform catalog (EI-002) — also the universe the
    // mandatory-provider invariant is evaluated against.
    const catalogIds = marketplace.data.providers.map((provider) => provider.id);

    // Resolve each family's credential source ONCE (user → platform → none),
    // in parallel, and never any secret material.
    const credentialSources = new Map<string, 'USER' | 'PLATFORM' | 'NONE'>();
    if (this.options.resolveCredentialSource) {
      const resolve = this.options.resolveCredentialSource;
      await Promise.all(
        marketplace.data.providers.map(async (provider) => {
          try {
            credentialSources.set(provider.family, await resolve(userId, provider.family));
          } catch {
            credentialSources.set(provider.family, 'NONE');
          }
        }),
      );
    }

    const providers: ProviderExperienceRow[] = marketplace.data.providers.map((provider) => {
      const models: ProviderModelExperience[] = provider.models.map((m) => ({
        id: m.id,
        name: m.name,
        capabilities: modelCapabilityLabels(m),
      }));
      const preferred =
        prefs.preferredProviderId === provider.id && prefs.preferredModelId
          ? (models.find((m) => m.id === prefs.preferredModelId) ?? null)
          : null;
      const selectedModel = preferred ?? models[0] ?? null;
      const classification = classifyResource({
        family: provider.family,
        inputPerMillionTokens: provider.inputPerMillionTokens,
        outputPerMillionTokens: provider.outputPerMillionTokens,
        tags: [...provider.tags],
        costTier: provider.costTier,
      });
      return {
        providerId: provider.id,
        name: provider.name,
        family: provider.family,
        credentialSource: credentialSources.get(provider.family) ?? 'NONE',
        selectedModel,
        models,
        availability: deriveAvailability(provider, prefs), // canonical `@vedmoulya/ai` `ProviderStatus` (F-2)
        enabled: !disabled.has(provider.id),
        switchDisabledReason: describeProviderSwitch(prefs, catalogIds, provider.id),
        resourceType: classification.resourceType,
        freeToUse: classification.freeToUse,
        health: {
          status: provider.health.status,
          score: provider.health.healthScore,
          latencyMs: provider.health.latencyMs,
          quotaUsedPercent: provider.health.quotaUsedPercent,
          quotaSource: provider.health.quotaSource,
          healthSource: provider.health.healthSource,
          // Genuine provider-reported account metrics, carried verbatim so the
          // screen can show them separately from runtime tokens / estimated cost.
          ...(provider.health.accountUsage !== undefined
            ? { accountUsage: provider.health.accountUsage }
            : {}),
        },
        lifecycleStatus: provider.lifecycleStatus,
      };
    });

    const usage = await this.buildUsageSummary(userId, providers, prefs);

    return { success: true, data: { providers, usage, preferences: prefs } };
  }

  /** Detailed usage & economics (Phase 17 — behind the usage view). */
  async getUsage(userId: string): Promise<ProviderExperienceResult<ProviderUsageDetail>> {
    return this.getUsageDetail(userId);
  }

  /** Owner-scoped usage detail (async preferences resolved). */
  async getUsageDetail(userId: string): Promise<ProviderExperienceResult<ProviderUsageDetail>> {
    if (!userId) return { success: false, error: 'userId is required' };
    const prefsResult = await this.preferences.getPreferences(userId);
    const preferences = prefsResult.data ?? defaultPrefs();

    // DURABLE FIRST. The in-process trace store is NOT the usage authority: it
    // holds no accounting attributes for plain Ask calls, so reading it alone
    // reported 0 tokens / 0 cost for usage that really happened. The durable
    // owner-scoped ledger is the SAME evidence the AI Control Center reads, so
    // both surfaces now agree.
    const durable = this.options.usageRecorder;
    if (durable) {
      return {
        success: true,
        data: {
          ...(await this.durableUsageDetail(userId, durable)),
          preferences,
        },
      };
    }

    // Fallback for embedders/tests without a ledger: reported as the weaker
    // source it is, never as the durable ledger.
    const snapshot = this.ledger.compute(this.traceStore, { userId, limit: 1000 });
    return {
      success: true,
      data: {
        totals: snapshot.totals,
        byProvider: snapshot.byProvider,
        byModel: this.modelUsage(userId),
        executions: snapshot.executions,
        preferences,
        usageSource: 'TRACE_LEDGER',
        durableChecked: false,
        costUnknown: snapshot.byProvider.some((row) => row.costUsd === 0 && row.calls > 0),
        window: 'ALL_RECORDED',
      },
    };
  }

  /**
   * Owner-scoped usage from the DURABLE ledger, projected into the existing
   * detail shape. Purely a read of recorded executions: no estimate, no
   * back-fill, and `costUnknown` stays true while any recorded execution had no
   * provider-reported price.
   */
  private async durableUsageDetail(
    userId: string,
    recorder: Pick<AiUsageRecorder, 'getStore'>,
  ): Promise<Omit<ProviderUsageDetail, 'preferences'>> {
    const events = await recorder.getStore().list({ userId, limit: 20_000 });
    const board = aggregateAiUsage(events);
    const all = {
      executions: board.cloud.executions + board.local.executions,
      inputTokens: board.cloud.inputTokens + board.local.inputTokens,
      outputTokens: board.cloud.outputTokens + board.local.outputTokens,
      totalTokens: board.cloud.totalTokens + board.local.totalTokens,
      costUsd: board.cloud.costUsd + board.local.costUsd,
      cachedExecutions: board.cloud.cachedExecutions + board.local.cachedExecutions,
      costUnknown: board.cloud.costUnknown || board.local.costUnknown,
    };
    return {
      totals: {
        aiCalls: all.executions,
        tokensInput: all.inputTokens,
        tokensOutput: all.outputTokens,
        tokensTotal: all.totalTokens,
        costUsd: all.costUsd,
        cacheHits: all.cachedExecutions,
        // Not tracked by the durable ledger (and never displayed as if they
        // were) — the trace ledger is the only source for these two.
        retries: 0,
        latencyMs: 0,
      },
      byProvider: board.byProvider.map((row) => ({
        provider: row.provider,
        calls: row.executions,
        latencyMs: 0,
        tokensInput: row.inputTokens,
        tokensOutput: row.outputTokens,
        tokensTotal: row.totalTokens,
        costUsd: row.costUsd,
      })),
      byModel: board.byModel.map((row) => ({
        providerId: row.provider,
        modelId: row.model,
        calls: row.executions,
        latencyMs: 0,
        tokensTotal: row.totalTokens,
        costUsd: row.costUsd,
      })),
      // The durable ledger records SUCCESSFUL executions only (the recorder
      // skips failures with no billable usage), so every row here is 'OK' — a
      // real recorded execution, correlated by its execution id.
      executions: board.recent.map((event) => ({
        executionId: event.executionId,
        traceId: event.executionId,
        userId: event.userId,
        name: `${event.provider} · ${event.model}`,
        status: 'OK' as const,
        tokensTotal: event.totalTokens,
        costUsd: event.costUsd,
        aiCalls: 1,
        cacheHits: event.cached ? 1 : 0,
        startedAt: event.timestamp,
        ...(event.latencyMs !== undefined ? { durationMs: event.latencyMs } : {}),
      })),
      usageSource: 'DURABLE_USAGE_LEDGER',
      durableChecked: true,
      costUnknown: all.costUnknown,
      window: 'ALL_RECORDED',
    };
  }

  /**
   * OpenAI ORGANIZATION account usage per model for a REAL period (Today /
   * This week / This month). This is OpenAI-reported usage of the platform's
   * own organization key — distinct from VedMoulya's measured per-user
   * ledger. It requires an Organization admin-scope API key; without one the
   * payload is available:false with an honest message. Never fabricated.
   */
  async getOpenAIOrgUsage(
    period: OpenAIOrgPeriod,
  ): Promise<ProviderExperienceResult<OpenAIOrgUsageViewPayload>> {
    const env = this.options.openaiOrgEnv ?? process.env;
    // Key NAMES must stay in sync with PROVIDER_RUNTIME_DESCRIPTORS (openai).
    const key =
      ['AI_OPENAI_API_KEY', 'OPENAI_API_KEY'].find((name) => {
        const value = env[name];
        return value !== undefined && value.trim() !== '';
      }) ?? null;
    const unavailable = (message: string): ProviderExperienceResult<OpenAIOrgUsageViewPayload> => ({
      success: true,
      data: {
        available: false,
        period,
        message,
        rows: [],
        totals: { ...EMPTY_ORG_TOTALS },
      },
    });
    if (!key) {
      return unavailable('No OpenAI API key is configured — organization usage is unavailable.');
    }
    const apiKey = (env[key] ?? '').trim();
    const now = this.options.openaiOrgNow ? this.options.openaiOrgNow() : new Date();
    const fetchImpl =
      this.options.openaiOrgFetch ??
      ((input: string, init?: RequestInit): Promise<Response> => fetch(input, init));
    try {
      const result = await openaiOrgUsageProbe(apiKey, fetchImpl, openaiOrgWindow(period, now));
      if (!result.ok) {
        return unavailable(result.error ?? 'OpenAI organization usage is unavailable.');
      }
      return {
        success: true,
        data: {
          available: true,
          period,
          message: 'Reported by OpenAI for your organization account.',
          rows: result.rows,
          totals: result.totals,
          hasMore: result.hasMore,
        },
      };
    } catch (error) {
      return unavailable(
        error instanceof Error ? error.message : 'OpenAI organization usage is unavailable.',
      );
    }
  }

  /** User preferences (owner-scoped). */
  async getPreferences(userId: string): Promise<ProviderExperienceResult<ProviderPreferences>> {
    return this.preferences.getPreferences(userId);
  }

  async setPreferences(
    userId: string,
    patch: Parameters<ProviderPreferencesService['updatePreferences']>[1],
  ): Promise<ProviderExperienceResult<ProviderPreferences>> {
    return this.preferences.updatePreferences(userId, patch);
  }

  async setProviderEnabled(
    userId: string,
    providerId: string,
    enabled: boolean,
  ): Promise<ProviderExperienceResult<ProviderPreferences>> {
    return this.preferences.setProviderEnabled(userId, providerId, enabled);
  }

  /**
   * Phase 16 — "Why this model?" Uses the EXISTING ModelSelectionIntelligence
   * (a thin layer over the frozen ProviderRoutingAdvisor) enriched with THIS
   * user's preferences: budget policy + preferred provider/model. The frozen
   * routing intelligence is never duplicated — only its inputs are scoped.
   */
  async explainModelSelection(
    userId: string,
    input: {
      capability: string;
      /** Authoritative task capability requirements (CapabilityType taxonomy). */
      requiredCapabilities?: string[];
      estimatedInputTokens?: number;
      requestedOutputTokens?: number;
      precision?: 'standard' | 'high';
      evidenceRequired?: boolean;
      freePreferred?: boolean;
      taskComplexity?: 'simple' | 'moderate' | 'complex';
    },
  ): Promise<ProviderExperienceResult<Awaited<ReturnType<ModelSelectionIntelligence['decide']>>>> {
    if (!userId) return { success: false, error: 'userId is required' };
    const prefsResult = await this.preferences.getPreferences(userId);
    const prefs = prefsResult.data ?? defaultPrefs();
    try {
      const result = await this.modelSelection.decide({
        capability: input.capability,
        requiredCapabilities: input.requiredCapabilities,
        estimatedInputTokens: input.estimatedInputTokens ?? 4000,
        requestedOutputTokens: input.requestedOutputTokens,
        precision: input.precision,
        evidenceRequired: input.evidenceRequired,
        freePreferred: input.freePreferred,
        taskComplexity: input.taskComplexity,
        budgetPolicy: prefs.budgetPolicy,
        userPreference:
          prefs.preferredProviderId && prefs.preferredModelId
            ? { providerId: prefs.preferredProviderId, modelId: prefs.preferredModelId }
            : undefined,
      });
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Model selection failed',
      };
    }
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  /**
   * The usage summary for the AI Providers screen AND the Brain dashboard.
   *
   * DURABLE FIRST: the owner-scoped durable ledger is the usage authority. The
   * in-process trace store is only a fallback for embedders/tests that have no
   * ledger, and the payload says so (`usageSource`) instead of letting a weaker
   * source masquerade as measured usage.
   *
   * The budget is READ, never invented: `budgetSource` distinguishes the user's
   * own limit from a platform allowance and from "not configured".
   */
  private async buildUsageSummary(
    userId: string,
    providers: ProviderExperienceRow[],
    prefs: ProviderPreferences,
  ): Promise<UsageSummary> {
    const budget = resolveUserBudgetView({
      ...(prefs.budgets.monthlyTokenBudget !== undefined
        ? { monthlyTokenBudget: prefs.budgets.monthlyTokenBudget }
        : {}),
      ...(prefs.budgets.monthlyTokenBudgetSource !== undefined
        ? { monthlyTokenBudgetSource: prefs.budgets.monthlyTokenBudgetSource }
        : {}),
      ...(prefs.budgets.monthlyTokenBudgetConfiguredAt !== undefined
        ? { budgetConfiguredAt: prefs.budgets.monthlyTokenBudgetConfiguredAt }
        : {}),
    });

    // Free percentage: tokens attributed to free providers / total tokens.
    // Same rule for both sources — only the provider classification decides.
    const freePercentOf = (rows: Array<{ provider: string; tokensTotal: number }>): number => {
      let freeTokens = 0;
      let totalTokens = 0;
      for (const row of rows) {
        const provider = providers.find((p) => p.providerId === row.provider);
        if (provider?.freeToUse ?? false) freeTokens += row.tokensTotal;
        totalTokens += row.tokensTotal;
      }
      return totalTokens > 0 ? Math.round((freeTokens / totalTokens) * 100) : 0;
    };

    let totals: {
      tokensUsed: number;
      costUsd: number;
      aiCalls: number;
      cacheHits: number;
      costUnknown: boolean;
    };
    let usageRows: Array<{ provider: string; tokensTotal: number }>;
    let usageSource: UsageSummary['usageSource'];
    let durableChecked: boolean;

    const durable = this.options.usageRecorder;
    if (durable) {
      const events = await durable.getStore().list({ userId, limit: 20_000 });
      const board = aggregateAiUsage(events);
      totals = {
        tokensUsed: board.cloud.totalTokens + board.local.totalTokens,
        costUsd: board.cloud.costUsd + board.local.costUsd,
        aiCalls: board.cloud.executions + board.local.executions,
        cacheHits: board.cloud.cachedExecutions + board.local.cachedExecutions,
        costUnknown: board.cloud.costUnknown || board.local.costUnknown,
      };
      usageRows = board.byProvider.map((row) => ({
        provider: row.provider,
        tokensTotal: row.totalTokens,
      }));
      usageSource = 'DURABLE_USAGE_LEDGER';
      durableChecked = true;
    } else {
      const snapshot = this.ledger.compute(this.traceStore, { userId, limit: 1000 });
      totals = {
        tokensUsed: snapshot.totals.tokensTotal,
        costUsd: snapshot.totals.costUsd,
        aiCalls: snapshot.totals.aiCalls,
        cacheHits: snapshot.totals.cacheHits,
        costUnknown: snapshot.byProvider.some((row) => row.costUsd === 0 && row.calls > 0),
      };
      usageRows = snapshot.byProvider.map((row) => ({
        provider: row.provider,
        tokensTotal: row.tokensTotal,
      }));
      usageSource = 'TRACE_LEDGER';
      durableChecked = false;
    }

    const remaining = resolveRemainingCapacity(totals.tokensUsed, budget);

    return {
      tokensUsed: totals.tokensUsed,
      ...(budget.amountTokens !== undefined ? { tokenBudget: budget.amountTokens } : {}),
      budgetSource: budget.source,
      ...(budget.configuredAt !== undefined ? { budgetConfiguredAt: budget.configuredAt } : {}),
      ...(remaining.remainingTokens !== undefined
        ? { remainingTokens: remaining.remainingTokens }
        : {}),
      budgetBasis: remaining.basis,
      costUsd: totals.costUsd,
      aiCalls: totals.aiCalls,
      cacheHits: totals.cacheHits,
      costUnknown: totals.costUnknown,
      freePercent: freePercentOf(usageRows),
      usageSource,
      durableChecked,
      budgetPolicy: prefs.budgetPolicy,
      budgets: prefs.budgets,
    };
  }

  /** Per-model usage from ai.* trace spans (provider + model attributes). */
  private modelUsage(userId: string): ModelUsageRow[] {
    const traces = this.traceStore.list({ userId, limit: 1000 });
    const map = new Map<string, ModelUsageRow>();
    for (const trace of traces) {
      for (const span of trace.spans) {
        // One row per successful provider execution. Including ai.run,
        // ai.stream_run, selection and validation spans double-counted usage
        // and sometimes grouped the request under a stale/unknown model.
        if (
          span.kind !== 'ai' ||
          span.name !== 'ai.provider_execution' ||
          span.attributes.status !== 'success'
        )
          continue;
        const provider = span.attributes.provider;
        // Only executed-model attributes are authoritative. `requested_model`
        // is intent and must not be presented as proof that the provider ran it.
        // Keep the legacy `ai.model` alias for traces created before this span contract.
        const model = span.attributes.model ?? span.attributes['ai.model'];
        if (typeof provider !== 'string') continue;
        const modelId = typeof model === 'string' && model.trim().length > 0 ? model : 'unknown';
        const key = `${provider}|${modelId}`;
        const row = map.get(key) ?? {
          providerId: provider,
          modelId,
          calls: 0,
          latencyMs: 0,
          tokensTotal: 0,
          costUsd: 0,
        };
        row.calls += 1;
        row.latencyMs += span.durationMs ?? 0;
        row.tokensTotal +=
          span.attributes.total_tokens === undefined
            ? numUsageAttr(span.attributes.input_tokens) +
              numUsageAttr(span.attributes.output_tokens)
            : numUsageAttr(span.attributes.total_tokens);
        // D2 — read the same `cost` attribute the ledger normalizes, with the
        // legacy `cost_usd` key accepted only when `cost` is absent.
        const cost = span.attributes.cost ?? span.attributes.cost_usd;
        if (typeof cost === 'number') row.costUsd += cost;
        map.set(key, row);
      }
    }
    return [...map.values()].sort((a, b) => b.calls - a.calls);
  }
}

function numUsageAttr(value: string | number | boolean | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }
  return 0;
}

function defaultPrefs(): ProviderPreferences {
  return defaultProviderPreferences('');
}
