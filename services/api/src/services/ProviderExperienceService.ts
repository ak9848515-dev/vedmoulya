// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Provider Experience Service
// EPIC-012A — AI Provider Intelligence & Premium UX (Phases 4–6 / 12–17)
//
// Composes the AI Providers experience view model for ONE authenticated
// user:
//   - the registry (every provider is an asset, disabled ones included),
//   - the user's OWNER-SCOPED preferences (enabled set, preferred model,
//     budget policy),
//   - the EPIC-012 cost ledger (aggregate token/cost usage, per-provider).
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
import type { ProviderDTO, ProviderModelDTO } from '@vedmoulya/providers';
import { defaultProviderPreferences } from '@vedmoulya/providers';
import { ModelSelectionIntelligence } from '@vedmoulya/services';
import type { CostLedger, CostLedgerSnapshot } from '../observability/CostLedger.js';
import type { TraceStore } from '@vedmoulya/core';

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
  health: { status: string; score: number; latencyMs: number; quotaUsedPercent: number };
  lifecycleStatus: string;
}

export interface UsageSummary {
  tokensUsed: number;
  tokenBudget: number;
  costUsd: number;
  aiCalls: number;
  cacheHits: number;
  /** Percentage of usage attributed to free resources (honest, 0 when unknown). */
  freePercent: number;
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
  costUsd: number;
}

export interface ProviderUsageDetail {
  totals: CostLedgerSnapshot['totals'];
  byProvider: CostLedgerSnapshot['byProvider'];
  byModel: ModelUsageRow[];
  executions: CostLedgerSnapshot['executions'];
  preferences: ProviderPreferences;
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
  if (health === 'down' || health === 'unstable') return 'UNAVAILABLE';
  if (health === 'degraded' || provider.health.quotaUsedPercent >= 80) return 'LIMITED';
  if (prefs.disabledProviderIds.includes(provider.id)) return 'UNAVAILABLE';
  if (provider.health.healthScore <= 0 && provider.health.lastCheckedAt === '') return 'UNKNOWN';
  return 'AVAILABLE';
}

export class ProviderExperienceService {
  constructor(
    private readonly providers: ProviderApplicationService,
    private readonly preferences: ProviderPreferencesService,
    private readonly modelSelection: ModelSelectionIntelligence,
    private readonly ledger: CostLedger,
    private readonly traceStore: TraceStore,
  ) {}

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
        selectedModel,
        models,
        availability: deriveAvailability(provider, prefs),
        enabled: !disabled.has(provider.id),
        switchDisabledReason: describeProviderSwitch(prefs, catalogIds, provider.id),
        resourceType: classification.resourceType,
        freeToUse: classification.freeToUse,
        health: {
          status: provider.health.status,
          score: provider.health.healthScore,
          latencyMs: provider.health.latencyMs,
          quotaUsedPercent: provider.health.quotaUsedPercent,
        },
        lifecycleStatus: provider.lifecycleStatus,
      };
    });

    const usage = this.buildUsageSummary(userId, providers, prefs);

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
    const snapshot = this.ledger.compute(this.traceStore, { userId, limit: 1000 });
    return {
      success: true,
      data: {
        totals: snapshot.totals,
        byProvider: snapshot.byProvider,
        byModel: this.modelUsage(userId),
        executions: snapshot.executions,
        preferences: prefsResult.data ?? defaultPrefs(),
      },
    };
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

  private buildUsageSummary(
    userId: string,
    providers: ProviderExperienceRow[],
    prefs: ProviderPreferences,
  ): UsageSummary {
    const snapshot = this.ledger.compute(this.traceStore, { userId, limit: 1000 });
    const tokenBudget = prefs.budgets.monthlyTokenBudget ?? 1_000_000;
    const byProvider = snapshot.byProvider;

    // Free percentage: tokens attributed to free providers / total tokens.
    let freeTokens = 0;
    let totalTokens = 0;
    for (const row of byProvider) {
      const provider = providers.find((p) => p.providerId === row.provider);
      const isFree = provider?.freeToUse ?? false;
      if (isFree) freeTokens += row.tokensTotal;
      totalTokens += row.tokensTotal;
    }
    const freePercent = totalTokens > 0 ? Math.round((freeTokens / totalTokens) * 100) : 0;

    return {
      tokensUsed: snapshot.totals.tokensTotal,
      tokenBudget,
      costUsd: snapshot.totals.costUsd,
      aiCalls: snapshot.totals.aiCalls,
      cacheHits: snapshot.totals.cacheHits,
      freePercent,
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
        if (span.kind !== 'ai') continue;
        const provider = span.attributes.provider;
        const model = span.attributes.model;
        if (typeof provider !== 'string') continue;
        const modelId = typeof model === 'string' ? model : 'unknown';
        const key = `${provider}|${modelId}`;
        const row = map.get(key) ?? {
          providerId: provider,
          modelId,
          calls: 0,
          latencyMs: 0,
          costUsd: 0,
        };
        row.calls += 1;
        row.latencyMs += span.durationMs ?? 0;
        const cost = span.attributes.cost_usd;
        if (typeof cost === 'number') row.costUsd += cost;
        map.set(key, row);
      }
    }
    return [...map.values()].sort((a, b) => b.calls - a.calls);
  }
}

function defaultPrefs(): ProviderPreferences {
  return defaultProviderPreferences('');
}
