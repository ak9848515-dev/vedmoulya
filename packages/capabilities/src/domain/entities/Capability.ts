// ──────────────────────────────────────────────────────────────────
// VedMoulya — Capability Domain: Capability (Aggregate Root)
// EI-001 — Enterprise Capability Registry & Marketplace
// A capability is the reusable unit every business module consumes.
// It knows nothing about providers, workflows, or orchestration.
// ──────────────────────────────────────────────────────────────────

import type {
  BusinessModule,
  CapabilityCategory,
  CapabilityStatus as CapabilityStatusValue,
  CostProfile,
  LatencyProfile,
  QualityProfile,
  RequiredAIFeature,
  TokenProfile,
} from '../../types/capability-types.js';
import type { CapabilityId as CapabilityIdType } from '../value-objects/CapabilityId.js';
import { CapabilityStatus } from '../value-objects/CapabilityStatus.js';
import { CapabilityVersion } from '../value-objects/CapabilityVersion.js';

// ── Supporting Types ──────────────────────────────────────────────────────

export interface CapabilityCompositionRef {
  /** Id of the composed (child) capability. */
  id: CapabilityIdType;
  /** Optional slot name, e.g. 'research' | 'writing' | 'review'. */
  slot?: string;
}

// ── Entity ────────────────────────────────────────────────────────────────

/**
 * Capability — the aggregate root of the Enterprise Capability Registry.
 *
 * Capabilities are:
 * - Reusable (one capability → many business modules)
 * - Composable (nested capabilities, e.g. Research + Writing + Review = Content Generation)
 * - Versioned (semver-ish lifecycle)
 * - Provider-agnostic (only RequiredAIFeature names; never provider ids)
 */
export class Capability {
  private readonly _id: CapabilityIdType;
  private _name: string;
  private _category: CapabilityCategory;
  private _description: string;
  private _owner: string;
  private _inputs: string[];
  private _outputs: string[];
  private _dependencies: CapabilityIdType[];
  private readonly _requiredAIFeatures: RequiredAIFeature[];
  private _cost: CostProfile;
  private _tokens: TokenProfile;
  private _latency: LatencyProfile;
  private _quality: QualityProfile;
  private _confidence: number;
  private _version: CapabilityVersion;
  private _status: CapabilityStatus;
  private _tags: string[];
  private _businessModules: BusinessModule[];
  private _documentationUrl?: string;
  /** Composition children (a capability may contain nested capabilities). */
  private _composition: CapabilityCompositionRef[];
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor(params: {
    id: CapabilityIdType;
    name: string;
    category: CapabilityCategory;
    description: string;
    owner: string;
    inputs?: string[];
    outputs?: string[];
    dependencies?: CapabilityIdType[];
    requiredAIFeatures?: RequiredAIFeature[];
    cost?: CostProfile;
    tokens?: TokenProfile;
    latency?: LatencyProfile;
    quality?: QualityProfile;
    confidence?: number;
    version?: CapabilityVersion;
    status?: CapabilityStatus;
    tags?: string[];
    businessModules?: BusinessModule[];
    documentationUrl?: string;
    composition?: CapabilityCompositionRef[];
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this._id = params.id;
    this._name = params.name;
    this._category = params.category;
    this._description = params.description;
    this._owner = params.owner;
    this._inputs = params.inputs ?? [];
    this._outputs = params.outputs ?? [];
    this._dependencies = params.dependencies ?? [];
    this._requiredAIFeatures = params.requiredAIFeatures ?? [];
    this._cost = params.cost ?? { estimatedCostUsd: 0, tier: 'free' };
    this._tokens = params.tokens ?? { estimatedInputTokens: 0, estimatedOutputTokens: 0 };
    this._latency = params.latency ?? { p50Ms: 0, p95Ms: 0 };
    this._quality = params.quality ?? { target: 0.9, minimum: 0.7 };
    this._confidence = params.confidence ?? 0.5;
    this._version = params.version ?? CapabilityVersion.initial();
    this._status = params.status ?? CapabilityStatus.design();
    this._tags = params.tags ?? [];
    this._businessModules = params.businessModules ?? [];
    this._documentationUrl = params.documentationUrl;
    this._composition = params.composition ?? [];
    this._createdAt = params.createdAt ?? new Date();
    this._updatedAt = params.updatedAt ?? new Date();
  }

  // ── Getters ─────────────────────────────────────────────────────────────

  get id(): CapabilityIdType {
    return this._id;
  }
  get name(): string {
    return this._name;
  }
  get category(): CapabilityCategory {
    return this._category;
  }
  get description(): string {
    return this._description;
  }
  get owner(): string {
    return this._owner;
  }
  get inputs(): readonly string[] {
    return Object.freeze([...this._inputs]);
  }
  get outputs(): readonly string[] {
    return Object.freeze([...this._outputs]);
  }
  get dependencies(): readonly CapabilityIdType[] {
    return Object.freeze([...this._dependencies]);
  }
  get requiredAIFeatures(): readonly RequiredAIFeature[] {
    return Object.freeze([...this._requiredAIFeatures]);
  }
  get cost(): CostProfile {
    return { ...this._cost };
  }
  get tokens(): TokenProfile {
    return { ...this._tokens };
  }
  get latency(): LatencyProfile {
    return { ...this._latency };
  }
  get quality(): QualityProfile {
    return { ...this._quality };
  }
  get confidence(): number {
    return this._confidence;
  }
  get version(): CapabilityVersion {
    return this._version;
  }
  get status(): CapabilityStatus {
    return this._status;
  }
  get tags(): readonly string[] {
    return Object.freeze([...this._tags]);
  }
  get businessModules(): readonly BusinessModule[] {
    return Object.freeze([...this._businessModules]);
  }
  get documentationUrl(): string | undefined {
    return this._documentationUrl;
  }
  get composition(): readonly CapabilityCompositionRef[] {
    return Object.freeze(this._composition.map((c) => ({ id: c.id, slot: c.slot })));
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  /** True when this capability is a composition (has children). */
  get isComposition(): boolean {
    return this._composition.length > 0;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  transitionTo(next: CapabilityStatusValue): void {
    if (!this._status.canTransitionTo(next)) {
      throw new Error(
        `Cannot transition capability ${this._name} from ${this._status.toString()} to ${next}`,
      );
    }
    this._status = CapabilityStatus.fromStatus(next);
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

  // ── Composition ─────────────────────────────────────────────────────────

  /** Set the composition children (replaces prior children). */
  setComposition(children: CapabilityCompositionRef[]): void {
    this._composition = children.map((c) => ({ id: c.id, slot: c.slot }));
    this._version = this._version.bumpMinor();
    this._updatedAt = new Date();
  }

  // ── Metadata updates ────────────────────────────────────────────────────

  updateDetails(params: {
    name?: string;
    category?: CapabilityCategory;
    description?: string;
    owner?: string;
    inputs?: string[];
    outputs?: string[];
    tags?: string[];
    documentationUrl?: string;
  }): void {
    if (params.name !== undefined) this._name = params.name;
    if (params.category !== undefined) this._category = params.category;
    if (params.description !== undefined) this._description = params.description;
    if (params.owner !== undefined) this._owner = params.owner;
    if (params.inputs !== undefined) this._inputs = [...params.inputs];
    if (params.outputs !== undefined) this._outputs = [...params.outputs];
    if (params.tags !== undefined) this._tags = [...params.tags];
    if (params.documentationUrl !== undefined) this._documentationUrl = params.documentationUrl;
    this._version = this._version.bumpPatch();
    this._updatedAt = new Date();
  }

  updateProfiles(params: {
    cost?: CostProfile;
    tokens?: TokenProfile;
    latency?: LatencyProfile;
    quality?: QualityProfile;
    confidence?: number;
  }): void {
    if (params.cost !== undefined) this._cost = { ...params.cost };
    if (params.tokens !== undefined) this._tokens = { ...params.tokens };
    if (params.latency !== undefined) this._latency = { ...params.latency };
    if (params.quality !== undefined) this._quality = { ...params.quality };
    if (params.confidence !== undefined) this._confidence = params.confidence;
    this._version = this._version.bumpPatch();
    this._updatedAt = new Date();
  }

  addDependency(depId: CapabilityIdType): void {
    if (depId === this._id) {
      throw new Error('A capability cannot depend on itself');
    }
    if (!this._dependencies.includes(depId)) {
      this._dependencies = [...this._dependencies, depId];
      this._version = this._version.bumpMinor();
      this._updatedAt = new Date();
    }
  }

  removeDependency(depId: CapabilityIdType): void {
    this._dependencies = this._dependencies.filter((d) => d !== depId);
    this._version = this._version.bumpMinor();
    this._updatedAt = new Date();
  }

  addBusinessModule(module: BusinessModule): void {
    if (!this._businessModules.includes(module)) {
      this._businessModules = [...this._businessModules, module];
      this._updatedAt = new Date();
    }
  }

  // ── Factory ─────────────────────────────────────────────────────────────

  static create(params: {
    id: CapabilityIdType;
    name: string;
    category: CapabilityCategory;
    description: string;
    owner: string;
    inputs?: string[];
    outputs?: string[];
    dependencies?: CapabilityIdType[];
    requiredAIFeatures?: RequiredAIFeature[];
    cost?: CostProfile;
    tokens?: TokenProfile;
    latency?: LatencyProfile;
    quality?: QualityProfile;
    confidence?: number;
    tags?: string[];
    businessModules?: BusinessModule[];
    documentationUrl?: string;
    composition?: CapabilityCompositionRef[];
    version?: CapabilityVersion;
    status?: CapabilityStatus;
    createdAt?: Date;
    updatedAt?: Date;
  }): Capability {
    return new Capability({
      id: params.id,
      name: params.name,
      category: params.category,
      description: params.description,
      owner: params.owner,
      inputs: params.inputs,
      outputs: params.outputs,
      dependencies: params.dependencies,
      requiredAIFeatures: params.requiredAIFeatures,
      cost: params.cost,
      tokens: params.tokens,
      latency: params.latency,
      quality: params.quality,
      confidence: params.confidence,
      tags: params.tags,
      businessModules: params.businessModules,
      documentationUrl: params.documentationUrl,
      composition: params.composition,
      version: params.version,
      status: params.status,
      createdAt: params.createdAt,
      updatedAt: params.updatedAt,
    });
  }
}
