// ──────────────────────────────────────────────────────────────────
// VedMoulya — Provider Domain: Provider (Aggregate Root)
// EI-002 — Enterprise Provider Registry & Intelligence Platform
// A provider is an enterprise asset: discoverable, health-monitored,
// capability-mapped, and costed. It knows nothing about routing,
// selection, or economy — that comes in later sprints.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType, ModalityType, ProviderFamily } from '@vedmoulya/ai';
import type {
  ProviderCapabilityMatrixEntry,
  ProviderCostProfile,
  ProviderHealthSnapshot,
  ProviderLatencyProfile,
  ProviderLifecycleStatus as ProviderLifecycleStatusValue,
  ProviderHealthSource,
  ProviderModel,
  ProviderQuotaSource,
  ProviderRateLimits,
  ProviderAccountMetric,
  ProviderAccountUsageMetric,
  CustomProviderConfig,
} from '../../types/provider-types.js';
import type { ProviderId } from '../value-objects/ProviderId.js';
import { ProviderLifecycleStatus } from '../value-objects/ProviderLifecycleStatus.js';
import { ProviderVersion } from '../value-objects/ProviderVersion.js';

// ── Capability matrix entry — canonical definition lives in types ──────────
// (provider-types.ts); re-exported here so catalog/consumers keep a single
// import surface from the domain entity.
export type { ProviderCapabilityMatrixEntry } from '../../types/provider-types.js';
/** Provenance of a provider health quota percentage (see ProviderHealth). */
export type { ProviderQuotaSource } from '../../types/provider-types.js';
/** Provenance of the health record itself (see ProviderHealth). */
export type { ProviderHealthSource } from '../../types/provider-types.js';

// ── Health (mutable inside the entity) ─────────────────────────────────────

export interface ProviderHealth {
  status: ProviderHealthSnapshot['status'];
  healthScore: number;
  latencyMs: number;
  successCount: number;
  failureCount: number;
  quotaUsedPercent: number;
  /**
   * WHERE `quotaUsedPercent` came from — the provenance flag consumers MUST
   * read before presenting a quota:
   *   'SEED'              → a registry/catalog constant. It is NOT a
   *                         measurement, is never refreshed by a runtime
   *                         request, and must never be shown as the
   *                         provider's account usage or remaining balance.
   *   'PROVIDER_REPORTED' → the provider itself reported usage that was
   *                         ingested through `recordHealthSample`.
   * ABSENT (undefined) means 'SEED'. It defaults to SEED deliberately: a quota
   * is only ever promoted to provider-reported by an explicit ingested sample,
   * never by time passing, and every legacy/persisted record stays unproven.
   */
  quotaSource?: ProviderQuotaSource;
  /**
   * WHERE this health record came from — the provenance flag consumers MUST
   * read before presenting status/score/latency as a check:
   *   'SEED'     → catalog data. NOT a measurement of this deployment, and the
   *                catalog stamps `lastCheckedAt` with its own build time, so
   *                neither the status nor that timestamp may be shown as
   *                evidence that the provider was just checked.
   *   'MEASURED' → a runtime sample was written through `recordHealthSample`.
   * ABSENT (undefined) means 'SEED'. It is only promoted by a real runtime
   * write, never by time passing — so a legacy/persisted record stays unproven.
   */
  healthSource?: ProviderHealthSource;
  rateLimitRemaining: number;
  rateLimitResetAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastCheckedAt: string;
  /**
   * The most recent GENUINE provider-reported account metrics, keyed by metric
   * (account tokens / account cost / account credits / bounded-quota-used).
   * Distinct from runtime tokens and estimated cost; absent key ⇒ never
   * retrieved (the UI says "Unavailable from provider", never zero).
   */
  accountUsage?: Partial<Record<ProviderAccountMetric, ProviderAccountUsageMetric>>;
}

// ── Entity ────────────────────────────────────────────────────────────────

export class Provider {
  private readonly _id: ProviderId;
  private readonly _family: ProviderFamily;
  private _name: string;
  private _description: string;
  private _owner: string;
  private _models: ProviderModel[];
  private _capabilities: CapabilityType[];
  private _supportedModalities: ModalityType[];
  private _cost: ProviderCostProfile;
  private _latency: ProviderLatencyProfile;
  private _rateLimits: ProviderRateLimits;
  private _availability: number;
  private readonly _health: ProviderHealth;
  private _lifecycleStatus: ProviderLifecycleStatus;
  private _version: ProviderVersion;
  private _tags: string[];
  private _documentationUrl?: string;
  private _matrix: ProviderCapabilityMatrixEntry[];
  private _customConfig?: CustomProviderConfig;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor(params: {
    id: ProviderId;
    family: ProviderFamily;
    name: string;
    description: string;
    owner: string;
    models?: ProviderModel[];
    capabilities?: CapabilityType[];
    supportedModalities?: ModalityType[];
    cost?: ProviderCostProfile;
    latency?: ProviderLatencyProfile;
    rateLimits?: ProviderRateLimits;
    availability?: number;
    health?: ProviderHealth;
    lifecycleStatus?: ProviderLifecycleStatus;
    version?: ProviderVersion;
    tags?: string[];
    documentationUrl?: string;
    matrix?: ProviderCapabilityMatrixEntry[];
    customConfig?: CustomProviderConfig;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this._id = params.id;
    this._family = params.family;
    this._name = params.name;
    this._description = params.description;
    this._owner = params.owner;
    this._models = params.models ?? [];
    this._capabilities = params.capabilities ?? [];
    this._supportedModalities = params.supportedModalities ?? [];
    this._cost = params.cost ?? {
      inputPerMillionTokens: 0,
      outputPerMillionTokens: 0,
      currency: 'USD',
      tier: 'free',
    };
    this._latency = params.latency ?? { p50Ms: 0, p95Ms: 0 };
    this._rateLimits = params.rateLimits ?? {
      requestsPerMinute: 0,
      tokensPerMinute: 0,
      requestsPerDay: 0,
      maxConcurrentRequests: 0,
    };
    this._availability = params.availability ?? 0;
    this._health = params.health ?? {
      status: 'healthy',
      healthScore: 0,
      latencyMs: 0,
      successCount: 0,
      failureCount: 0,
      quotaUsedPercent: 0,
      rateLimitRemaining: 0,
      rateLimitResetAt: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastCheckedAt: new Date().toISOString(),
    };
    this._lifecycleStatus = params.lifecycleStatus ?? ProviderLifecycleStatus.draft();
    this._version = params.version ?? ProviderVersion.initial();
    this._tags = params.tags ?? [];
    this._documentationUrl = params.documentationUrl;
    this._matrix = params.matrix ?? [];
    this._customConfig = params.customConfig;
    this._createdAt = params.createdAt ?? new Date();
    this._updatedAt = params.updatedAt ?? new Date();
  }

  // ── Getters ─────────────────────────────────────────────────────────────

  get id(): ProviderId {
    return this._id;
  }
  get family(): ProviderFamily {
    return this._family;
  }
  get name(): string {
    return this._name;
  }
  get description(): string {
    return this._description;
  }
  get owner(): string {
    return this._owner;
  }
  get models(): readonly ProviderModel[] {
    return Object.freeze(this._models.map((m) => ({ ...m })));
  }
  get capabilities(): readonly CapabilityType[] {
    return Object.freeze([...this._capabilities]);
  }
  get supportedModalities(): readonly ModalityType[] {
    return Object.freeze([...this._supportedModalities]);
  }
  get cost(): ProviderCostProfile {
    return { ...this._cost };
  }
  get latency(): ProviderLatencyProfile {
    return { ...this._latency };
  }
  get rateLimits(): ProviderRateLimits {
    return { ...this._rateLimits };
  }
  get availability(): number {
    return this._availability;
  }
  get health(): ProviderHealth {
    return { ...this._health };
  }
  get lifecycleStatus(): ProviderLifecycleStatus {
    return this._lifecycleStatus;
  }
  get version(): ProviderVersion {
    return this._version;
  }
  get tags(): readonly string[] {
    return Object.freeze([...this._tags]);
  }
  get documentationUrl(): string | undefined {
    return this._documentationUrl;
  }
  get matrix(): readonly ProviderCapabilityMatrixEntry[] {
    return Object.freeze(this._matrix.map((m) => ({ ...m })));
  }
  get customConfig(): CustomProviderConfig | undefined {
    return this._customConfig ? { ...this._customConfig } : undefined;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  /** Highest quality score across the capability matrix. */
  get bestQuality(): number {
    return this._matrix.reduce((best, entry) => Math.max(best, entry.quality), 0);
  }

  /** Lowest expected cost across the matrix (per invocation); 0 when unmapped. */
  get bestCostUsd(): number {
    if (this._matrix.length === 0) return 0;
    return this._matrix.reduce(
      (lowest, entry) => Math.min(lowest, entry.expectedCostUsd),
      Number.POSITIVE_INFINITY,
    );
  }

  get maxContextLength(): number {
    return this._models.reduce((max, model) => Math.max(max, model.contextLength), 0);
  }

  hasFeature(feature: 'streaming' | 'vision' | 'function_calling' | 'embeddings'): boolean {
    return this._models.some((model) => {
      switch (feature) {
        case 'streaming':
          return model.streaming;
        case 'vision':
          return model.vision;
        case 'function_calling':
          return model.functionCalling;
        case 'embeddings':
          return model.embeddings;
      }
    });
  }

  supportsCapability(capability: CapabilityType): boolean {
    return this._capabilities.includes(capability);
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  transitionTo(next: ProviderLifecycleStatusValue): void {
    if (!this._lifecycleStatus.canTransitionTo(next)) {
      throw new Error(
        `Cannot transition provider ${this._name} from ${this._lifecycleStatus.toString()} to ${next}`,
      );
    }
    this._lifecycleStatus = ProviderLifecycleStatus.fromStatus(next);
    this._updatedAt = new Date();
  }

  // ── Versioning ───────────────────────────────────────────────────────────

  bumpMajor(): void {
    this._version = this._version.bumpMajor();
    this._updatedAt = new Date();
  }

  bumpMinor(): void {
    this._version = this._version.bumpMinor();
    this._updatedAt = new Date();
  }

  bumpPatch(): void {
    this._version = this._version.bumpPatch();
    this._updatedAt = new Date();
  }

  // ── Capability matrix ────────────────────────────────────────────────────

  setMatrix(entries: ProviderCapabilityMatrixEntry[]): void {
    this._matrix = entries.map((e) => ({ ...e }));
    this._version = this._version.bumpMinor();
    this._updatedAt = new Date();
  }

  upsertMatrixEntry(entry: ProviderCapabilityMatrixEntry): void {
    // Rebuild without computed-index assignment (avoids object-injection
    // false positives and keeps the array immutable by construction).
    const rest = this._matrix.filter((e) => e.capability !== entry.capability);
    this._matrix = [...rest, { ...entry }];
    this._version = this._version.bumpPatch();
    this._updatedAt = new Date();
  }

  // ── Health ───────────────────────────────────────────────────────────────

  /**
   * Record a health sample (success or failure) and recompute the composite
   * health score. Mirrors the Provider Health Engine (EI-002) model: status
   * is derived from error rate + latency; score blends availability,
   * latency, failures, and quota.
   */
  recordHealthSample(sample: {
    ok: boolean;
    latencyMs?: number;
    quotaUsedPercent?: number;
    rateLimitRemaining?: number;
    rateLimitResetAt?: string | null;
    checkedAt?: string;
    /**
     * GENUINE provider-reported account metrics to persist verbatim (account
     * tokens / account cost / account credits / bounded-quota-used). Each is
     * keyed by its metric and stored on the health snapshot — never conflated
     * with quotaUsedPercent or with runtime tokens.
     */
    accountUsage?: ProviderAccountUsageMetric[];
  }): void {
    const now = sample.checkedAt ?? new Date().toISOString();
    // A runtime sample IS the measurement: from here on the record is no longer
    // catalog seed data, so status/score/latency may be presented as checked.
    this._health.healthSource = 'MEASURED';
    if (sample.ok) {
      this._health.successCount += 1;
      this._health.lastSuccessAt = now;
    } else {
      this._health.failureCount += 1;
      this._health.lastFailureAt = now;
    }
    if (sample.latencyMs !== undefined) {
      // Exponential moving average (70% new / 30% old) — smooths spikes.
      this._health.latencyMs =
        this._health.latencyMs === 0
          ? sample.latencyMs
          : 0.7 * sample.latencyMs + 0.3 * this._health.latencyMs;
    }
    if (sample.quotaUsedPercent !== undefined) {
      // ONLY an ingested, provider-reported sample promotes the quota. A seed
      // constant keeps `quotaSource: 'SEED'` forever, so nothing downstream can
      // mistake catalog data for account usage.
      this._health.quotaUsedPercent = sample.quotaUsedPercent;
      this._health.quotaSource = 'PROVIDER_REPORTED';
    }
    if (sample.rateLimitRemaining !== undefined)
      this._health.rateLimitRemaining = sample.rateLimitRemaining;
    if (sample.rateLimitResetAt !== undefined)
      this._health.rateLimitResetAt = sample.rateLimitResetAt;
    if (sample.accountUsage !== undefined && sample.accountUsage.length > 0) {
      // IDEMPOTENT, per-metric persistence. A metric is replaced only when the
      // incoming sample is at least as fresh as the stored one, so a replayed or
      // out-of-order ingest pass cannot overwrite a newer reading with an older
      // one and cannot create duplicate entries (one slot per metric).
      const next: Partial<Record<ProviderAccountMetric, ProviderAccountUsageMetric>> = {
        ...(this._health.accountUsage ?? {}),
      };
      for (const metric of sample.accountUsage) {
        if (metric.provider !== this._family) continue;
        const existing = next[metric.metric];
        if (
          existing !== undefined &&
          Date.parse(existing.retrievedAt) > Date.parse(metric.retrievedAt)
        ) {
          continue;
        }
        next[metric.metric] = { ...metric };
      }
      // Never create an empty `accountUsage` map: absence means "never
      // retrieved" and must stay distinguishable from a stored (even empty) map.
      if (Object.keys(next).length > 0) {
        this._health.accountUsage = next;
      }
    }
    this._health.lastCheckedAt = now;

    const total = this._health.successCount + this._health.failureCount;
    const successRate = total === 0 ? 1 : this._health.successCount / total;
    const latencyFactor = Math.max(0, 1 - this._health.latencyMs / 10000);
    const quotaFactor = Math.max(0, 1 - this._health.quotaUsedPercent / 100);
    const rateLimitFactor = this._health.rateLimitRemaining > 0 ? 1 : 0.5;
    this._health.healthScore = Math.max(
      0,
      Math.min(
        1,
        0.5 * successRate + 0.25 * latencyFactor + 0.15 * quotaFactor + 0.1 * rateLimitFactor,
      ),
    );

    // Status derived from health score + failure RATIO (window-aware, so a
    // long-lived provider with a handful of historical failures is not
    // permanently 'degraded' — only recent elevated failure rates are).
    const failureRatio = total === 0 ? 0 : this._health.failureCount / total;
    if (total >= 5 && failureRatio > 0.5) {
      this._health.status = 'down';
    } else if (this._health.healthScore < 0.4) {
      this._health.status = 'unstable';
    } else if (this._health.healthScore < 0.7 || (total >= 5 && failureRatio > 0.2)) {
      this._health.status = 'degraded';
    } else {
      this._health.status = 'healthy';
    }
    this._updatedAt = new Date();
  }

  // ── Metadata updates ─────────────────────────────────────────────────────

  updateDetails(params: {
    name?: string;
    description?: string;
    owner?: string;
    tags?: string[];
    documentationUrl?: string;
  }): void {
    if (params.name !== undefined) this._name = params.name;
    if (params.description !== undefined) this._description = params.description;
    if (params.owner !== undefined) this._owner = params.owner;
    if (params.tags !== undefined) this._tags = [...params.tags];
    if (params.documentationUrl !== undefined) this._documentationUrl = params.documentationUrl;
    this._version = this._version.bumpPatch();
    this._updatedAt = new Date();
  }

  updateProfiles(params: {
    cost?: ProviderCostProfile;
    latency?: ProviderLatencyProfile;
    rateLimits?: ProviderRateLimits;
    availability?: number;
  }): void {
    if (params.cost !== undefined) this._cost = { ...params.cost };
    if (params.latency !== undefined) this._latency = { ...params.latency };
    if (params.rateLimits !== undefined) this._rateLimits = { ...params.rateLimits };
    if (params.availability !== undefined) this._availability = params.availability;
    this._version = this._version.bumpPatch();
    this._updatedAt = new Date();
  }

  setModels(models: ProviderModel[]): void {
    this._models = models.map((m) => ({ ...m }));
    this._capabilities = [...new Set(models.flatMap((m) => m.capabilities))];
    this._supportedModalities = [...new Set(models.flatMap((m) => m.modalities))];
    this._version = this._version.bumpMinor();
    this._updatedAt = new Date();
  }

  // ── Factory ─────────────────────────────────────────────────────────────

  static create(params: {
    id: ProviderId;
    family: ProviderFamily;
    name: string;
    description: string;
    owner: string;
    models?: ProviderModel[];
    capabilities?: CapabilityType[];
    supportedModalities?: ModalityType[];
    cost?: ProviderCostProfile;
    latency?: ProviderLatencyProfile;
    rateLimits?: ProviderRateLimits;
    availability?: number;
    health?: ProviderHealth;
    lifecycleStatus?: ProviderLifecycleStatus;
    version?: ProviderVersion;
    tags?: string[];
    documentationUrl?: string;
    matrix?: ProviderCapabilityMatrixEntry[];
    customConfig?: CustomProviderConfig;
    createdAt?: Date;
    updatedAt?: Date;
  }): Provider {
    return new Provider({
      id: params.id,
      family: params.family,
      name: params.name,
      description: params.description,
      owner: params.owner,
      models: params.models,
      capabilities: params.capabilities,
      supportedModalities: params.supportedModalities,
      cost: params.cost,
      latency: params.latency,
      rateLimits: params.rateLimits,
      availability: params.availability,
      health: params.health,
      lifecycleStatus: params.lifecycleStatus,
      version: params.version,
      tags: params.tags,
      documentationUrl: params.documentationUrl,
      matrix: params.matrix,
      customConfig: params.customConfig,
      createdAt: params.createdAt,
      updatedAt: params.updatedAt,
    });
  }

  // ── Custom Provider Config ──────────────────────────────────────────────

  /** Update custom provider configuration (only for family === 'custom'). */
  updateCustomConfig(config: CustomProviderConfig): void {
    this._customConfig = { ...config };
    this._version = this._version.bumpMinor();
    this._updatedAt = new Date();
  }
}
