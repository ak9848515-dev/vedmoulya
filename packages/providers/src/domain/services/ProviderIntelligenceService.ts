// ──────────────────────────────────────────────────────────────────
// VedMoulya — Provider Intelligence Service
// EPIC-012A — AI Provider Intelligence (Phases 7/9)
//
// Auto-derives a Provider Intelligence Profile whenever a provider is
// added or connected. Every property carries a provenance state:
//   - PROVIDER_DECLARED — straight from the registry/catalog metadata.
//   - MEASURED         — from live health/telemetry.
//   - INFERRED         — deterministically derived from declared facts.
//   - UNKNOWN          — absent; never guessed.
// No property is ever invented; the profile is a faithful projection
// of what the registry actually knows.
// ──────────────────────────────────────────────────────────────────

import type { Provider } from '../entities/Provider.js';
import { classifyResource, resolveResourceType } from './ModelResourceClassifier.js';
import type {
  ModelIntelligence,
  ModelLifecycleStatus,
  ProviderIntelligenceProfile,
  Provenanced,
} from '../../types/intelligence-types.js';

const CAPABILITY_LABELS: Record<string, string> = {
  reasoning: 'reasoning',
  coding: 'coding',
  vision: 'vision',
  embeddings: 'embeddings',
  summarization: 'summarization',
  classification: 'classification',
  translation: 'translation',
  speech: 'audio',
  image_understanding: 'vision',
  general_conversation: 'chat',
  content_generation: 'generation',
};

export interface ProviderIntelligenceOptions {
  /** Clock for generatedAt (injectable for tests). */
  now?: () => Date;
  localFamilies?: string[];
  aggregatorFamilies?: string[];
}

export class ProviderIntelligenceService {
  private readonly now: () => Date;
  private readonly localFamilies: string[];
  private readonly aggregatorFamilies: string[];

  constructor(options: ProviderIntelligenceOptions = {}) {
    this.now = options.now ?? ((): Date => new Date());
    this.localFamilies = options.localFamilies ?? ['ollama', 'lm-studio', 'local', 'custom'];
    this.aggregatorFamilies = options.aggregatorFamilies ?? ['openrouter'];
  }

  /**
   * Build the intelligence profile for one provider. Every value flows
   * from the provider's persisted model metadata, cost profile, tags and
   * health — with honest provenance.
   */
  buildProfile(provider: Provider): ProviderIntelligenceProfile {
    const generatedAt = this.now().toISOString();
    const models: ModelIntelligence[] = provider.models.map((model) =>
      this.modelIntelligence(provider, model.id, model.name),
    );

    let known = 0;
    let unknown = 0;
    for (const model of models) {
      for (const entry of Object.values(model)) {
        if (entry === null || typeof entry !== 'object' || !('provenance' in (entry as object))) {
          continue;
        }
        const prov = (entry as Provenanced<unknown>).provenance;
        if (prov === 'UNKNOWN') unknown += 1;
        else known += 1;
      }
    }

    return {
      providerId: provider.id,
      providerName: provider.name,
      generatedAt,
      derivedFrom: `registry provider "${provider.name}" (v${String(provider.version)})`,
      models,
      coverage: {
        modelCount: models.length,
        knownPropertyCount: known,
        unknownPropertyCount: unknown,
      },
    };
  }

  private modelIntelligence(provider: Provider, modelId: string, name: string): ModelIntelligence {
    const model = provider.models.find((m) => m.id === modelId);
    // Typed projection helper: the declared metadata carries PROVIDER_DECLARED
    // provenance; absent models project UNKNOWN nulls — never guessed.
    const declared = <T>(value: T | null, _source: string): Provenanced<T> =>
      model !== undefined
        ? { value, provenance: 'PROVIDER_DECLARED', source: 'catalog' }
        : { value: null, provenance: 'UNKNOWN', source: 'catalog' };

    const capabilities: string[] = [];
    if (model !== undefined) {
      for (const cap of model.capabilities) {
        const label = CAPABILITY_LABELS[cap] ?? cap;
        if (!capabilities.includes(label)) capabilities.push(label);
      }
      if (model.vision && !capabilities.includes('vision')) capabilities.push('vision');
      if (model.audio && !capabilities.includes('audio')) capabilities.push('audio');
      if (model.embeddings && !capabilities.includes('embeddings')) capabilities.push('embeddings');
    }

    const classification = classifyResource({
      family: provider.family,
      inputPerMillionTokens: provider.cost.inputPerMillionTokens,
      outputPerMillionTokens: provider.cost.outputPerMillionTokens,
      tags: [...provider.tags],
      costTier: provider.cost.tier,
      localFamilies: this.localFamilies,
      aggregatorFamilies: this.aggregatorFamilies,
    });
    const resourceType = resolveResourceType(classification, [...provider.tags]);

    // Lifecycle (EPIC-012B): a model present in the current registry is
    // usable — 'active' is INFERRED from catalog presence, never claimed as
    // a provider-verified lifecycle. Absent models are NOT silently
    // invented here; the refresh service marks removed models
    // unavailable/deprecated from the previous profile's delta.
    const lifecycleStatus: Provenanced<ModelLifecycleStatus> =
      model !== undefined
        ? { value: 'active', provenance: 'INFERRED', source: 'catalog-presence' }
        : { value: 'unknown', provenance: 'UNKNOWN' };

    // Free availability: derived from resource classification (INFERRED),
    // not claimed as a verified live quota.
    const freeAvailability: Provenanced<'free' | 'limited' | 'paid' | 'unknown'> =
      model === undefined
        ? { value: 'unknown', provenance: 'UNKNOWN' }
        : resourceType === 'LOCAL' || resourceType === 'FREE_HOSTED'
          ? { value: 'free', provenance: 'INFERRED', source: 'resource-classification' }
          : resourceType === 'FREE_API_QUOTA'
            ? { value: 'limited', provenance: 'INFERRED', source: 'resource-classification' }
            : resourceType === 'USER_PAID_API' || resourceType === 'ENTERPRISE'
              ? { value: 'paid', provenance: 'INFERRED', source: 'resource-classification' }
              : { value: 'unknown', provenance: 'UNKNOWN' };

    return {
      modelId,
      name,
      capabilities: {
        value: capabilities,
        provenance: model !== undefined ? 'PROVIDER_DECLARED' : 'UNKNOWN',
        source: 'catalog',
      },
      contextWindow: declared(model?.contextLength ?? null, 'catalog'),
      maxOutputTokens: declared(model?.maxOutputTokens ?? null, 'catalog'),
      reasoning: declared(model?.reasoning ?? null, 'catalog'),
      coding: declared(model?.coding ?? null, 'catalog'),
      vision: declared(model?.vision ?? null, 'catalog'),
      audio: declared(model?.audio ?? null, 'catalog'),
      toolCalling: declared(model?.functionCalling ?? null, 'catalog'),
      structuredOutput: declared(
        model !== undefined ? model.functionCalling || model.reasoning : null,
        'catalog',
      ),
      embeddings: declared(model?.embeddings ?? null, 'catalog'),
      streaming: declared(model?.streaming ?? null, 'catalog'),
      latencyMs: {
        value: provider.health.latencyMs > 0 ? provider.health.latencyMs : null,
        provenance: provider.health.latencyMs > 0 ? 'MEASURED' : 'UNKNOWN',
        source: 'health',
      },
      priceInputPer1M: declared(provider.cost.inputPerMillionTokens, 'catalog'),
      priceOutputPer1M: declared(provider.cost.outputPerMillionTokens, 'catalog'),
      freeAvailability,
      lifecycleStatus,
      resourceType,
      resourceReasons: classification.reasons,
    };
  }
}
