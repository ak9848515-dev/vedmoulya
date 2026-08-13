// ──────────────────────────────────────────────────────────────────
// VedMoulya — Provider Application Service
// Orchestrates the Enterprise Provider Registry: registry CRUD,
// lifecycle, health sampling, capability matrix, discovery/search,
// versioning, and the provider marketplace view model.
// EI-002 — Enterprise Provider Registry & Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { PaginationParams } from '@vedmoulya/core';
import type { CapabilityType } from '@vedmoulya/ai';
import { Provider } from '../domain/entities/Provider.js';
import { ProviderCapabilityMatrixService } from '../domain/services/ProviderCapabilityMatrixService.js';
import { ProviderHealthService } from '../domain/services/ProviderHealthService.js';
import { ProviderBenchmarkDatasetService } from '../domain/services/ProviderBenchmarkDatasetService.js';
import { ProviderIntelligenceService } from '../domain/services/ProviderIntelligenceService.js';
import { ProviderIntelligenceRefreshService } from '../domain/services/ProviderIntelligenceRefreshService.js';
import type {
  ProviderIntelligenceStore,
  ProviderIntelligenceRecord,
} from '../domain/intelligence/ProviderIntelligenceStore.js';
import {
  classifyResource,
  type ResourceFacts,
} from '../domain/services/ModelResourceClassifier.js';
import {
  HardwareCompatibilityService,
  type HardwareFitFacts,
} from '../domain/services/HardwareCompatibilityService.js';
import {
  InMemoryLocalModelDiscovery,
  OllamaLocalModelDiscovery,
  OpenAICompatibleModelDiscovery,
} from '../infrastructure/LocalModelDiscovery.js';
import type { ProviderRepository } from '../domain/repository/ProviderRepository.js';
import type { ProviderPreferencesStore } from '../domain/preferences/ProviderPreferencesStore.js';
import { currentProviderUser } from './request-context.js';
import { createProviderId } from '../domain/value-objects/ProviderId.js';
import {
  availabilityRule,
  modelsRule,
  providerFamilyRule,
  providerNameRule,
  validate,
} from '../domain/rules/ProviderRules.js';
import type {
  CreateProviderDTO,
  ProviderBenchmarkDatasetDTO,
  ProviderBenchmarkQueryDTO,
  ProviderCapabilityMatrixDTO,
  ProviderDTO,
  ProviderFleetHealthDTO,
  ProviderMarketplaceDTO,
  ProviderModelRegistryDTO,
  ProviderQueryDTO,
  UpdateProviderDTO,
} from './ProviderDTO.js';
import type {
  HardwareCompatibilityProfile,
  HardwareSpec,
  LocalModelDiscoveryResult,
  LocalModelInfo,
  ModelResourceType,
  ProfileStaleness,
  ProviderCatalogDiscoveryPort,
  ProviderIntelligenceProfile,
  ProviderIntelligenceRefreshResult,
} from '../types/intelligence-types.js';
import { ProviderMapper } from './ProviderMapper.js';

export interface ProviderIntelligenceClassificationDTO {
  resourceType: ModelResourceType;
  freeToUse: boolean;
  openWeights: boolean;
  reasons: string[];
}

export interface ProviderResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** EPIC-012B — cache-first intelligence read with staleness verdict. */
export interface ProviderIntelligenceStatusResult {
  providerId: string;
  providerName: string;
  /** Whether the response was served from cache (vs freshly derived). */
  cached: boolean;
  /** The full refresh record (profile + verification + delta). */
  record: ProviderIntelligenceRecord;
  staleness: ProfileStaleness;
}

/** EPIC-012B — optional intelligence infrastructure for the registry. */
export interface ProviderIntelligenceInfrastructure {
  /** Profile cache; defaults to an in-memory bounded store. */
  store?: ProviderIntelligenceStore;
  /** Hosted provider-metadata discovery; defaults to fail-safe (declared only). */
  discovery?: ProviderCatalogDiscoveryPort;
  /** Refresh policy for staleness verdicts (default 24h). */
  maxAgeMs?: number;
  /** Injectable clock (tests); defaults to the system clock. */
  now?: () => Date;
}

export class ProviderApplicationService {
  private readonly repository: ProviderRepository;
  private readonly matrixService: ProviderCapabilityMatrixService;
  private readonly healthService: ProviderHealthService;
  private readonly benchmarkService: ProviderBenchmarkDatasetService;
  /**
   * Optional owner-scoped preferences (EPIC-012A). When present, routing
   * discovery paths (listByCapability / listByFamily) exclude the current
   * request user's explicitly-disabled providers. The registry itself is
   * never mutated — the user switch only writes their own preference.
   */
  private readonly preferences?: ProviderPreferencesStore;
  /** EPIC-012B — cached intelligence + safe refresh (optional). */
  private readonly intelligenceStore?: ProviderIntelligenceStore;
  private readonly refreshService: ProviderIntelligenceRefreshService;

  constructor(
    repository: ProviderRepository,
    preferences?: ProviderPreferencesStore,
    intelligence?: ProviderIntelligenceInfrastructure,
  ) {
    this.repository = repository;
    this.preferences = preferences;
    this.matrixService = new ProviderCapabilityMatrixService();
    this.healthService = new ProviderHealthService();
    this.benchmarkService = new ProviderBenchmarkDatasetService();
    this.intelligenceStore = intelligence?.store;
    this.refreshService = new ProviderIntelligenceRefreshService({
      discovery: intelligence?.discovery,
      maxAgeMs: intelligence?.maxAgeMs,
      now: intelligence?.now,
    });
  }

  // ── Registry CRUD ───────────────────────────────────────────────────────

  async registerProvider(dto: CreateProviderDTO): Promise<ProviderResult<ProviderDTO>> {
    const rules = validate([
      providerNameRule(dto.name),
      providerFamilyRule(dto.family),
      modelsRule(dto.models?.length ?? 0),
      availabilityRule(dto.availability ?? 0),
    ]);
    if (!rules.passed) {
      return { success: false, error: rules.message ?? 'Validation failed' };
    }

    if (await this.repository.exists(createProviderId(dto.id))) {
      return { success: false, error: `Provider already exists: ${dto.id}` };
    }

    const provider = Provider.create({
      id: createProviderId(dto.id),
      family: dto.family,
      name: dto.name,
      description: dto.description,
      owner: dto.owner,
      models: dto.models?.map((m) => ({ ...m })),
      capabilities: dto.capabilities,
      supportedModalities: dto.supportedModalities,
      cost: {
        inputPerMillionTokens: dto.inputPerMillionTokens ?? 0,
        outputPerMillionTokens: dto.outputPerMillionTokens ?? 0,
        currency: dto.currency ?? 'USD',
        tier: dto.costTier ?? 'free',
      },
      latency: { p50Ms: dto.p50Ms ?? 0, p95Ms: dto.p95Ms ?? 0 },
      rateLimits: {
        requestsPerMinute: dto.requestsPerMinute ?? 0,
        tokensPerMinute: dto.tokensPerMinute ?? 0,
        requestsPerDay: dto.requestsPerDay ?? 0,
        maxConcurrentRequests: dto.maxConcurrentRequests ?? 0,
      },
      availability: dto.availability ?? 0,
      tags: dto.tags,
      documentationUrl: dto.documentationUrl,
      matrix: dto.matrix?.map((m) => ({ ...m })),
    });

    await this.repository.save(provider);
    return { success: true, data: ProviderMapper.toDTO(provider) };
  }

  async updateProvider(id: string, dto: UpdateProviderDTO): Promise<ProviderResult<ProviderDTO>> {
    const provider = await this.repository.findById(createProviderId(id));
    if (!provider) {
      return { success: false, error: `Provider not found: ${id}` };
    }

    if (dto.name !== undefined) {
      const nameRule = providerNameRule(dto.name);
      if (!nameRule.passed) return { success: false, error: nameRule.message };
    }
    if (dto.availability !== undefined) {
      const availRule = availabilityRule(dto.availability);
      if (!availRule.passed) return { success: false, error: availRule.message };
    }

    const hasDetailUpdates =
      dto.name !== undefined ||
      dto.description !== undefined ||
      dto.owner !== undefined ||
      dto.tags !== undefined ||
      dto.documentationUrl !== undefined;
    if (hasDetailUpdates) {
      provider.updateDetails({
        name: dto.name,
        description: dto.description,
        owner: dto.owner,
        tags: dto.tags,
        documentationUrl: dto.documentationUrl,
      });
    }

    const hasProfileUpdates =
      dto.inputPerMillionTokens !== undefined ||
      dto.outputPerMillionTokens !== undefined ||
      dto.currency !== undefined ||
      dto.costTier !== undefined ||
      dto.p50Ms !== undefined ||
      dto.p95Ms !== undefined ||
      dto.requestsPerMinute !== undefined ||
      dto.tokensPerMinute !== undefined ||
      dto.requestsPerDay !== undefined ||
      dto.maxConcurrentRequests !== undefined ||
      dto.availability !== undefined;
    if (hasProfileUpdates) {
      provider.updateProfiles({
        cost:
          dto.inputPerMillionTokens !== undefined ||
          dto.outputPerMillionTokens !== undefined ||
          dto.currency !== undefined ||
          dto.costTier !== undefined
            ? {
                inputPerMillionTokens:
                  dto.inputPerMillionTokens ?? provider.cost.inputPerMillionTokens,
                outputPerMillionTokens:
                  dto.outputPerMillionTokens ?? provider.cost.outputPerMillionTokens,
                currency: dto.currency ?? provider.cost.currency,
                tier: dto.costTier ?? provider.cost.tier,
              }
            : undefined,
        latency:
          dto.p50Ms !== undefined || dto.p95Ms !== undefined
            ? {
                p50Ms: dto.p50Ms ?? provider.latency.p50Ms,
                p95Ms: dto.p95Ms ?? provider.latency.p95Ms,
              }
            : undefined,
        rateLimits:
          dto.requestsPerMinute !== undefined ||
          dto.tokensPerMinute !== undefined ||
          dto.requestsPerDay !== undefined ||
          dto.maxConcurrentRequests !== undefined
            ? {
                requestsPerMinute: dto.requestsPerMinute ?? provider.rateLimits.requestsPerMinute,
                tokensPerMinute: dto.tokensPerMinute ?? provider.rateLimits.tokensPerMinute,
                requestsPerDay: dto.requestsPerDay ?? provider.rateLimits.requestsPerDay,
                maxConcurrentRequests:
                  dto.maxConcurrentRequests ?? provider.rateLimits.maxConcurrentRequests,
              }
            : undefined,
        availability: dto.availability,
      });
    }

    await this.repository.update(provider);
    return { success: true, data: ProviderMapper.toDTO(provider) };
  }

  async getProvider(id: string): Promise<ProviderResult<ProviderDTO>> {
    const provider = await this.repository.findById(createProviderId(id));
    if (!provider) {
      return { success: false, error: `Provider not found: ${id}` };
    }
    return { success: true, data: ProviderMapper.toDTO(provider) };
  }

  async deleteProvider(id: string): Promise<ProviderResult<{ deleted: boolean }>> {
    const provider = await this.repository.findById(createProviderId(id));
    if (!provider) {
      return { success: false, error: `Provider not found: ${id}` };
    }
    await this.repository.delete(provider.id);
    // EPIC-012B — drop the cached intelligence with the provider.
    if (this.intelligenceStore) await this.intelligenceStore.delete(provider.id);
    return { success: true, data: { deleted: true } };
  }

  // ── Lifecycle & Versioning ──────────────────────────────────────────────

  async transitionLifecycle(
    id: string,
    to: Provider['lifecycleStatus']['value'],
  ): Promise<ProviderResult<ProviderDTO>> {
    const provider = await this.repository.findById(createProviderId(id));
    if (!provider) {
      return { success: false, error: `Provider not found: ${id}` };
    }
    try {
      provider.transitionTo(to);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Invalid transition',
      };
    }
    await this.repository.update(provider);
    return { success: true, data: ProviderMapper.toDTO(provider) };
  }

  async createVersion(
    id: string,
    type: 'major' | 'minor' | 'patch',
  ): Promise<ProviderResult<ProviderDTO>> {
    const provider = await this.repository.findById(createProviderId(id));
    if (!provider) {
      return { success: false, error: `Provider not found: ${id}` };
    }
    if (type === 'major') provider.bumpMajor();
    else if (type === 'minor') provider.bumpMinor();
    else provider.bumpPatch();
    await this.repository.update(provider);
    return { success: true, data: ProviderMapper.toDTO(provider) };
  }

  // ── Health ──────────────────────────────────────────────────────────────

  /** Record a health sample (success/failure) against a provider. */
  async recordHealthSample(
    id: string,
    sample: {
      ok: boolean;
      latencyMs?: number;
      quotaUsedPercent?: number;
      rateLimitRemaining?: number;
      rateLimitResetAt?: string | null;
      checkedAt?: string;
    },
  ): Promise<ProviderResult<ProviderDTO>> {
    const provider = await this.repository.findById(createProviderId(id));
    if (!provider) {
      return { success: false, error: `Provider not found: ${id}` };
    }
    provider.recordHealthSample(sample);
    await this.repository.update(provider);
    return { success: true, data: ProviderMapper.toDTO(provider) };
  }

  /** Replace a provider's capability matrix (bumps minor; EI-002 matrix mgmt). */
  async setCapabilityMatrix(
    id: string,
    matrix: Provider['matrix'][number][],
  ): Promise<ProviderResult<ProviderDTO>> {
    const provider = await this.repository.findById(createProviderId(id));
    if (!provider) {
      return { success: false, error: `Provider not found: ${id}` };
    }
    if (matrix.length === 0) {
      return { success: false, error: 'Provider capability matrix must not be empty' };
    }
    provider.setMatrix(matrix.map((e) => ({ ...e })));
    await this.repository.update(provider);
    return { success: true, data: ProviderMapper.toDTO(provider) };
  }

  async getFleetHealth(): Promise<ProviderResult<ProviderFleetHealthDTO>> {
    const all = await this.repository.listAll();
    return {
      success: true,
      data: ProviderMapper.toFleetHealthDTO(this.healthService.fleetHealth(all)),
    };
  }

  async getAvailabilityTier(
    id: string,
  ): Promise<ProviderResult<{ tier: 'ready' | 'caution' | 'risk' }>> {
    const provider = await this.repository.findById(createProviderId(id));
    if (!provider) {
      return { success: false, error: `Provider not found: ${id}` };
    }
    return { success: true, data: { tier: this.healthService.availabilityTier(provider) } };
  }

  // ── Capability Matrix ───────────────────────────────────────────────────

  async getCapabilityMatrix(): Promise<ProviderResult<ProviderCapabilityMatrixDTO>> {
    const all = await this.repository.listAll();
    return {
      success: true,
      data: ProviderMapper.toCapabilityMatrixDTO(this.matrixService.buildMatrixView(all)),
    };
  }

  async getProvidersForCapability(
    capability: CapabilityType,
  ): Promise<ProviderResult<ProviderCapabilityMatrixDTO['rows'][number]['rankings']>> {
    const all = await this.repository.listAll();
    return {
      success: true,
      data: this.matrixService.findProvidersForCapability(all, capability),
    };
  }

  // ── Discovery & Search ──────────────────────────────────────────────────

  async searchProviders(
    query: ProviderQueryDTO,
  ): Promise<ProviderResult<{ items: ProviderDTO[]; total: number }>> {
    const pagination: PaginationParams = { page: query.page ?? 1, limit: query.limit ?? 50 };
    const result = await this.repository.search(
      {
        query: query.query,
        families: query.families,
        lifecycleStatuses: query.lifecycleStatuses,
        capabilities: query.capabilities,
        modalities: query.modalities,
        tags: query.tags,
        minHealthScore: query.minHealthScore,
        minContextLength: query.minContextLength,
        feature: query.feature,
      },
      pagination,
    );
    return {
      success: true,
      data: {
        items: result.data.map((p) => ProviderMapper.toDTO(p)),
        total: result.total,
      },
    };
  }

  async listByFamily(family: Provider['family']): Promise<ProviderResult<ProviderDTO[]>> {
    const result = await this.repository.findByFamily(family, { page: 1, limit: 100 });
    return {
      success: true,
      data: (await this.applyUserEnabledFilter(result.data)).map((p) => ProviderMapper.toDTO(p)),
    };
  }

  async listByCapability(capability: CapabilityType): Promise<ProviderResult<ProviderDTO[]>> {
    const result = await this.repository.findByCapability(capability, { page: 1, limit: 100 });
    return {
      success: true,
      data: (await this.applyUserEnabledFilter(result.data)).map((p) => ProviderMapper.toDTO(p)),
    };
  }

  /**
   * EPIC-012A Phase 5 — exclude the current request user's explicitly
   * disabled providers from ROUTING candidates. Falls back to the full
   * list when no request context is active (hermetic/offline paths) or
   * the user never customized anything.
   */
  private async applyUserEnabledFilter(providers: readonly Provider[]): Promise<Provider[]> {
    if (this.preferences === undefined) return [...providers];
    const userId = currentProviderUser();
    if (!userId) return [...providers];
    const disabled = await this.preferences.get(userId);
    if (!disabled || disabled.disabledProviderIds.length === 0) return [...providers];
    const disabledSet = new Set(disabled.disabledProviderIds);
    return providers.filter((p) => !disabledSet.has(p.id));
  }

  // ── Benchmark Datasets (definitions only — EI-002) ────────────────────

  /**
   * Return the benchmark dataset definitions (optionally filtered by
   * category, capability, and/or difficulty). Definitions describe HOW
   * providers are evaluated — no benchmark is run here (EI-003 executes
   * these datasets and writes measured scores back into the matrix).
   */
  getBenchmarkDatasets(
    query: ProviderBenchmarkQueryDTO = {},
  ): Promise<ProviderResult<ProviderBenchmarkDatasetDTO>> {
    const filtered = this.benchmarkService.filterBy(query);
    return Promise.resolve({
      success: true,
      data: {
        items: filtered.map((definition) => ({ ...definition })),
        total: filtered.length,
        summary: this.benchmarkService.summarize(filtered),
      },
    });
  }

  // ── Model Registry (every model across the fleet) ───────────────────────

  /**
   * Expose the Model Registry: every model of every provider with its
   * provider attribution. Read-only discovery view — no execution.
   */
  async getModelRegistry(): Promise<ProviderResult<ProviderModelRegistryDTO>> {
    const all = await this.repository.listAll();
    const models = all.flatMap((provider) =>
      provider.models.map((model) => ({
        providerId: provider.id,
        providerName: provider.name,
        model: { ...model },
      })),
    );
    return { success: true, data: { models, total: models.length } };
  }

  // ── Provider Intelligence (EPIC-012A — Phases 7–11) ────────────────────

  /**
   * EPIC-012B — cache-first intelligence read with a staleness verdict.
   * Serves cached intelligence when fresh (never re-queries metadata on
   * every render); re-derives + re-caches when missing or stale.
   */
  async getIntelligenceStatus(
    id: string,
    maxAgeMs?: number,
  ): Promise<ProviderResult<ProviderIntelligenceStatusResult>> {
    const provider = await this.repository.findById(createProviderId(id));
    if (!provider) {
      return { success: false, error: `Provider not found: ${id}` };
    }
    const cached = this.intelligenceStore ? await this.intelligenceStore.get(provider.id) : null;
    const staleness = this.refreshService.staleness(cached?.profile ?? null, { maxAgeMs });
    if (cached && !staleness.isStale) {
      return {
        success: true,
        data: {
          providerId: provider.id,
          providerName: provider.name,
          cached: true,
          record: cached,
          staleness,
        },
      };
    }
    // Miss or stale → refresh safely (never fails the provider on discovery
    // failure) and cache the result.
    const refreshed = await this.refreshService.refresh(provider, {
      profile: cached?.profile,
      knownModels: cached?.knownModels,
    });
    const record: ProviderIntelligenceRecord = {
      ...refreshed,
      cachedAt: refreshed.verifiedAt,
    };
    if (this.intelligenceStore) await this.intelligenceStore.save(record);
    return {
      success: true,
      data: {
        providerId: provider.id,
        providerName: provider.name,
        cached: false,
        record,
        staleness: this.refreshService.staleness(record.profile, { maxAgeMs }),
      },
    };
  }

  /**
   * EPIC-012B — explicit safe refresh. Re-derives the profile, computes
   * the delta against the cached profile, and re-caches. Removed models
   * are reported (never deleted); user preferences are untouched.
   */
  async refreshProviderIntelligence(
    id: string,
  ): Promise<ProviderResult<ProviderIntelligenceRefreshResult>> {
    const provider = await this.repository.findById(createProviderId(id));
    if (!provider) {
      return { success: false, error: `Provider not found: ${id}` };
    }
    const previous = this.intelligenceStore ? await this.intelligenceStore.get(provider.id) : null;
    const refreshed = await this.refreshService.refresh(provider, {
      profile: previous?.profile,
      knownModels: previous?.knownModels,
    });
    const record: ProviderIntelligenceRecord = {
      ...refreshed,
      cachedAt: refreshed.verifiedAt,
    };
    if (this.intelligenceStore) await this.intelligenceStore.save(record);
    return { success: true, data: refreshed };
  }

  /**
   * Derive the Provider Intelligence Profile for one provider. Every
   * property carries provenance (PROVIDER_DECLARED / MEASURED / INFERRED /
   * UNKNOWN) — nothing is fabricated. Operator-safe: reads only.
   */
  async getIntelligenceProfile(id: string): Promise<ProviderResult<ProviderIntelligenceProfile>> {
    const provider = await this.repository.findById(createProviderId(id));
    if (!provider) {
      return { success: false, error: `Provider not found: ${id}` };
    }
    const service = new ProviderIntelligenceService();
    return { success: true, data: service.buildProfile(provider) };
  }

  /**
   * Classify a model resource (LOCAL / FREE_HOSTED / FREE_API_QUOTA /
   * USER_PAID_API / AGGREGATOR / OPEN_MODEL / CUSTOM_ENDPOINT / ENTERPRISE).
   * Pure derivation from registry facts — never guessed.
   */
  classifyModelResource(
    facts: ResourceFacts,
  ): ProviderResult<ProviderIntelligenceClassificationDTO> {
    const classification = classifyResource(facts);
    return {
      success: true,
      data: {
        resourceType: classification.resourceType,
        freeToUse: classification.freeToUse,
        openWeights: classification.openWeights,
        reasons: classification.reasons,
      },
    };
  }

  /**
   * Assess local-model fit against an operator-provided hardware spec.
   * Deterministic; verdicts carry reasons. UNKNOWN when hardware or model
   * size is absent — never guessed.
   */
  assessHardwareFit(
    hardware: HardwareSpec,
    models: HardwareFitFacts[],
  ): ProviderResult<HardwareCompatibilityProfile> {
    const service = new HardwareCompatibilityService();
    return { success: true, data: service.assess(hardware, models) };
  }

  /**
   * Discover installed local models from a local runtime. Live discovery
   * is an operator step — adapters fail safe (discovered=false, honest
   * statusMessage) when the endpoint is unreachable.
   */
  async discoverLocalModels(
    runtime: 'ollama' | 'lm-studio' | 'openai-compatible',
    endpoint?: string,
  ): Promise<ProviderResult<LocalModelDiscoveryResult>> {
    const port =
      runtime === 'ollama'
        ? new OllamaLocalModelDiscovery(endpoint)
        : new OpenAICompatibleModelDiscovery(runtime, endpoint);
    return { success: true, data: await port.discover() };
  }

  /** Hermetic local discovery for tests / no-runtime case. */
  async discoverLocalModelsDeclared(
    runtime: 'ollama' | 'lm-studio' | 'openai-compatible',
    declared: LocalModelInfo[],
  ): Promise<ProviderResult<LocalModelDiscoveryResult>> {
    const port = new InMemoryLocalModelDiscovery(runtime, declared);
    return { success: true, data: await port.discover() };
  }

  // ── Marketplace ─────────────────────────────────────────────────────────

  async getMarketplace(): Promise<ProviderResult<ProviderMarketplaceDTO>> {
    const all = await this.repository.listAll();
    const [countByLifecycleStatus, countByFamily, countByCapability, healthyCount] =
      await Promise.all([
        this.repository.countByLifecycleStatus(),
        this.repository.countByFamily(),
        this.repository.countByCapability(),
        this.repository.countHealthy(),
      ]);
    return {
      success: true,
      data: ProviderMapper.toMarketplaceDTO(all, {
        activeCount: all.filter((p) => p.lifecycleStatus.isActive()).length,
        healthyCount,
        countByLifecycleStatus,
        countByFamily,
        countByCapability,
      }),
    };
  }
}
