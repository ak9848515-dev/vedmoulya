// ──────────────────────────────────────────────────────────────────
// VedMoulya — Capability Application Service
// Orchestrates the Enterprise Capability Registry: registry CRUD,
// discovery/search, dependency graph, composition, versioning,
// lifecycle, and the marketplace view model.
// EI-001 — Enterprise Capability Registry & Marketplace
// ──────────────────────────────────────────────────────────────────

import type { PaginationParams } from '@vedmoulya/core';
import { Capability } from '../domain/entities/Capability.js';
import { CapabilityCompositionService } from '../domain/services/CapabilityCompositionService.js';
import { CapabilityGraphService } from '../domain/services/CapabilityGraphService.js';
import type { CapabilityRepository } from '../domain/repository/CapabilityRepository.js';
import { createCapabilityId } from '../domain/value-objects/CapabilityId.js';
import type { CapabilityId } from '../domain/value-objects/CapabilityId.js';
import { CapabilityVersion } from '../domain/value-objects/CapabilityVersion.js';
import {
  businessModulesRule,
  capabilityCategoryRule,
  capabilityNameRule,
  confidenceRule,
  qualityProfileRule,
  validate,
} from '../domain/rules/CapabilityRules.js';
import type { RequiredAIFeature } from '../types/capability-types.js';
import type {
  CapabilityQueryDTO,
  CapabilityDTO,
  CapabilityGraphDTO,
  CapabilityMarketplaceDTO,
  CreateCapabilityDTO,
  UpdateCapabilityDTO,
} from './CapabilityDTO.js';
import { CapabilityMapper } from './CapabilityMapper.js';

export interface CapabilityResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class CapabilityApplicationService {
  private readonly repository: CapabilityRepository;
  private readonly graphService: CapabilityGraphService;
  private readonly compositionService: CapabilityCompositionService;

  constructor(repository: CapabilityRepository) {
    this.repository = repository;
    this.graphService = new CapabilityGraphService();
    this.compositionService = new CapabilityCompositionService();
  }

  // ── Registry CRUD ───────────────────────────────────────────────────────

  async createCapability(dto: CreateCapabilityDTO): Promise<CapabilityResult<CapabilityDTO>> {
    const rules = validate([
      capabilityNameRule(dto.name),
      capabilityCategoryRule(dto.category),
      businessModulesRule(dto.businessModules ?? []),
      confidenceRule(dto.confidence ?? 0.5),
      qualityProfileRule(dto.qualityTarget ?? 0.9, dto.qualityMinimum ?? 0.7),
    ]);
    if (!rules.passed) {
      return { success: false, error: rules.message ?? 'Validation failed' };
    }

    if (await this.repository.exists(createCapabilityId(dto.id))) {
      return { success: false, error: `Capability already exists: ${dto.id}` };
    }

    const capability = Capability.create({
      id: createCapabilityId(dto.id),
      name: dto.name,
      category: dto.category,
      description: dto.description,
      owner: dto.owner,
      inputs: dto.inputs,
      outputs: dto.outputs,
      dependencies: (dto.dependencies ?? []).map((d) => createCapabilityId(d)),
      requiredAIFeatures: dto.requiredAIFeatures,
      cost: {
        estimatedCostUsd: dto.estimatedCostUsd ?? 0,
        tier: dto.costTier ?? 'free',
      },
      tokens: {
        estimatedInputTokens: dto.estimatedInputTokens ?? 0,
        estimatedOutputTokens: dto.estimatedOutputTokens ?? 0,
      },
      latency: {
        p50Ms: dto.p50Ms ?? 0,
        p95Ms: dto.p95Ms ?? 0,
      },
      quality: {
        target: dto.qualityTarget ?? 0.9,
        minimum: dto.qualityMinimum ?? 0.7,
      },
      confidence: dto.confidence ?? 0.5,
      tags: dto.tags,
      businessModules: dto.businessModules,
      documentationUrl: dto.documentationUrl,
      composition: (dto.composition ?? []).map((c) => ({
        id: createCapabilityId(c.id),
        slot: c.slot,
      })),
    });

    // Composition + dependency validation against existing registry.
    const all = await this.repository.listAll();
    const compositionCheck = this.compositionService.validate(capability, all);
    if (!compositionCheck.valid) {
      return {
        success: false,
        error: this.describeCompositionFailure(compositionCheck),
      };
    }
    const graph = this.graphService.buildGraph([...all, capability]);
    if (graph.cycles.length > 0) {
      return { success: false, error: 'Capability introduces a dependency cycle' };
    }
    if (graph.dangling.includes(capability.id)) {
      return { success: false, error: 'Capability depends on missing capabilities' };
    }

    await this.repository.save(capability);
    return { success: true, data: CapabilityMapper.toDTO(capability) };
  }

  async updateCapability(
    id: string,
    dto: UpdateCapabilityDTO,
  ): Promise<CapabilityResult<CapabilityDTO>> {
    const capability = await this.repository.findById(createCapabilityId(id));
    if (!capability) {
      return { success: false, error: `Capability not found: ${id}` };
    }

    if (dto.name !== undefined) {
      const nameRule = capabilityNameRule(dto.name);
      if (!nameRule.passed) return { success: false, error: nameRule.message };
    }
    if (dto.category !== undefined) {
      const catRule = capabilityCategoryRule(dto.category);
      if (!catRule.passed) return { success: false, error: catRule.message };
    }

    const hasDetailUpdates =
      dto.name !== undefined ||
      dto.category !== undefined ||
      dto.description !== undefined ||
      dto.owner !== undefined ||
      dto.inputs !== undefined ||
      dto.outputs !== undefined ||
      dto.tags !== undefined ||
      dto.documentationUrl !== undefined;
    if (hasDetailUpdates) {
      capability.updateDetails({
        name: dto.name,
        category: dto.category,
        description: dto.description,
        owner: dto.owner,
        inputs: dto.inputs,
        outputs: dto.outputs,
        tags: dto.tags,
        documentationUrl: dto.documentationUrl,
      });
    }

    const hasProfileUpdates =
      dto.estimatedCostUsd !== undefined ||
      dto.costTier !== undefined ||
      dto.estimatedInputTokens !== undefined ||
      dto.estimatedOutputTokens !== undefined ||
      dto.p50Ms !== undefined ||
      dto.p95Ms !== undefined ||
      dto.qualityTarget !== undefined ||
      dto.qualityMinimum !== undefined ||
      dto.confidence !== undefined;
    if (hasProfileUpdates) {
      capability.updateProfiles({
        cost:
          dto.estimatedCostUsd !== undefined || dto.costTier !== undefined
            ? {
                estimatedCostUsd: dto.estimatedCostUsd ?? capability.cost.estimatedCostUsd,
                tier: dto.costTier ?? capability.cost.tier,
              }
            : undefined,
        tokens:
          dto.estimatedInputTokens !== undefined || dto.estimatedOutputTokens !== undefined
            ? {
                estimatedInputTokens:
                  dto.estimatedInputTokens ?? capability.tokens.estimatedInputTokens,
                estimatedOutputTokens:
                  dto.estimatedOutputTokens ?? capability.tokens.estimatedOutputTokens,
              }
            : undefined,
        latency:
          dto.p50Ms !== undefined || dto.p95Ms !== undefined
            ? {
                p50Ms: dto.p50Ms ?? capability.latency.p50Ms,
                p95Ms: dto.p95Ms ?? capability.latency.p95Ms,
              }
            : undefined,
        quality:
          dto.qualityTarget !== undefined || dto.qualityMinimum !== undefined
            ? {
                target: dto.qualityTarget ?? capability.quality.target,
                minimum: dto.qualityMinimum ?? capability.quality.minimum,
              }
            : undefined,
        confidence: dto.confidence,
      });
    }

    if (dto.composition !== undefined) {
      const all = await this.repository.listAll();
      const nextComposition = dto.composition.map((c) => ({
        id: createCapabilityId(c.id),
        slot: c.slot,
      }));
      const next = Capability.create({
        id: capability.id,
        name: capability.name,
        category: capability.category,
        description: capability.description,
        owner: capability.owner,
        inputs: [...capability.inputs],
        outputs: [...capability.outputs],
        dependencies: [...capability.dependencies],
        requiredAIFeatures: [...capability.requiredAIFeatures],
        cost: capability.cost,
        tokens: capability.tokens,
        latency: capability.latency,
        quality: capability.quality,
        confidence: capability.confidence,
        tags: [...capability.tags],
        businessModules: [...capability.businessModules],
        documentationUrl: capability.documentationUrl,
        composition: nextComposition,
      });
      const check = this.compositionService.validate(next, all);
      if (!check.valid) {
        return { success: false, error: this.describeCompositionFailure(check) };
      }
      capability.setComposition(nextComposition);
    }

    await this.repository.update(capability);
    return { success: true, data: CapabilityMapper.toDTO(capability) };
  }

  async getCapability(id: string): Promise<CapabilityResult<CapabilityDTO>> {
    const capability = await this.repository.findById(createCapabilityId(id));
    if (!capability) {
      return { success: false, error: `Capability not found: ${id}` };
    }
    return { success: true, data: CapabilityMapper.toDTO(capability) };
  }

  /**
   * Resolve capabilities by required AI feature (CapabilityType).
   *
   * Bridges the goal engine's capability hints (AI-feature names such as
   * 'reasoning') to the registry's business capability ids (e.g. research,
   * review, seo_optimization, content_generation — all of which declare
   * 'reasoning' in their requiredAIFeatures). Consumed by the Enterprise
   * Intelligence Pipeline (INT-001) so every seed goal resolves a non-empty
   * capability set instead of failing when the feature name is not a
   * capability id.
   */
  async findByAIFeatures(
    features: RequiredAIFeature[],
  ): Promise<CapabilityResult<CapabilityDTO[]>> {
    const capabilities = await this.repository.findByAIFeatures(features);
    return { success: true, data: capabilities.map((c) => CapabilityMapper.toDTO(c)) };
  }

  async deleteCapability(id: string): Promise<CapabilityResult<{ deleted: boolean }>> {
    const capability = await this.repository.findById(createCapabilityId(id));
    if (!capability) {
      return { success: false, error: `Capability not found: ${id}` };
    }
    // Guard: capabilities with dependents or composition children cannot be
    // deleted while referenced.
    const all = await this.repository.listAll();
    const dependents = all.filter(
      (c) =>
        c.dependencies.includes(capability.id) ||
        c.composition.some((child) => child.id === capability.id),
    );
    if (dependents.length > 0) {
      return {
        success: false,
        error: `Capability is referenced by: ${dependents.map((d) => d.name).join(', ')}`,
      };
    }
    await this.repository.delete(capability.id);
    return { success: true, data: { deleted: true } };
  }

  // ── Lifecycle & Versioning ──────────────────────────────────────────────

  async transitionStatus(
    id: string,
    to: Capability['status']['value'],
  ): Promise<CapabilityResult<CapabilityDTO>> {
    const capability = await this.repository.findById(createCapabilityId(id));
    if (!capability) {
      return { success: false, error: `Capability not found: ${id}` };
    }
    try {
      capability.transitionTo(to);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Invalid transition',
      };
    }
    await this.repository.update(capability);
    return { success: true, data: CapabilityMapper.toDTO(capability) };
  }

  async createVersion(
    id: string,
    type: 'major' | 'minor' | 'patch',
  ): Promise<CapabilityResult<CapabilityDTO>> {
    const capability = await this.repository.findById(createCapabilityId(id));
    if (!capability) {
      return { success: false, error: `Capability not found: ${id}` };
    }
    if (type === 'major') capability.bumpMajor();
    else if (type === 'minor') capability.bumpMinor();
    else capability.bumpPatch();
    await this.repository.update(capability);
    return { success: true, data: CapabilityMapper.toDTO(capability) };
  }

  // ── Discovery & Search ──────────────────────────────────────────────────

  async searchCapabilities(
    query: CapabilityQueryDTO,
  ): Promise<CapabilityResult<{ items: CapabilityDTO[]; total: number }>> {
    const pagination: PaginationParams = { page: query.page ?? 1, limit: query.limit ?? 50 };
    const result = await this.repository.search(
      {
        query: query.query,
        categories: query.categories,
        statuses: query.statuses,
        businessModules: query.businessModules,
        tags: query.tags,
        dependsOn: query.dependsOn,
        onlyCompositions: query.onlyCompositions,
      },
      pagination,
    );
    return {
      success: true,
      data: {
        items: result.data.map((c) => CapabilityMapper.toDTO(c)),
        total: result.total,
      },
    };
  }

  async listByBusinessModule(
    module: Capability['businessModules'][number],
  ): Promise<CapabilityResult<CapabilityDTO[]>> {
    const result = await this.repository.findByBusinessModule(module, { page: 1, limit: 100 });
    return { success: true, data: result.data.map((c) => CapabilityMapper.toDTO(c)) };
  }

  async getDependencies(id: string): Promise<CapabilityResult<CapabilityDTO[]>> {
    const capability = await this.repository.findById(createCapabilityId(id));
    if (!capability) {
      return { success: false, error: `Capability not found: ${id}` };
    }
    const deps = await this.repository.findByIds([...capability.dependencies]);
    return { success: true, data: deps.map((c) => CapabilityMapper.toDTO(c)) };
  }

  async getTransitiveDependencies(id: string): Promise<CapabilityResult<CapabilityDTO[]>> {
    const capability = await this.repository.findById(createCapabilityId(id));
    if (!capability) {
      return { success: false, error: `Capability not found: ${id}` };
    }
    const all = await this.repository.listAll();
    const transitive = this.graphService.getTransitiveDependencies(all, capability.id);
    const caps = await this.repository.findByIds(transitive);
    return { success: true, data: caps.map((c) => CapabilityMapper.toDTO(c)) };
  }

  async getCompositionTree(
    id: string,
  ): Promise<
    CapabilityResult<{
      tree: import('./CapabilityDTO.js').CapabilityCompositionDTO;
      leaves: string[];
    }>
  > {
    const capability = await this.repository.findById(createCapabilityId(id));
    if (!capability) {
      return { success: false, error: `Capability not found: ${id}` };
    }
    const all = await this.repository.listAll();
    const tree = this.compositionService.buildTree(all, capability.id);
    return {
      success: true,
      data: {
        tree: CapabilityMapper.toCompositionDTO(tree),
        leaves: this.compositionService.flattenTree(tree),
      },
    };
  }

  // ── Graph ───────────────────────────────────────────────────────────────

  async getGraph(): Promise<CapabilityResult<CapabilityGraphDTO>> {
    const all = await this.repository.listAll();
    return { success: true, data: CapabilityMapper.toGraphDTO(this.graphService.buildGraph(all)) };
  }

  // ── Marketplace ─────────────────────────────────────────────────────────

  async getMarketplace(): Promise<CapabilityResult<CapabilityMarketplaceDTO>> {
    const all = await this.repository.listAll();
    const [countByStatus, countByCategory, countByBusinessModule] = await Promise.all([
      this.repository.countByStatus(),
      this.repository.countByCategory(),
      this.repository.countByBusinessModule(),
    ]);
    return {
      success: true,
      data: CapabilityMapper.toMarketplaceDTO(all, {
        countByStatus,
        countByCategory,
        countByBusinessModule,
      }),
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private describeCompositionFailure(check: {
    missing: CapabilityId[];
    selfReferences: CapabilityId[];
    cycles: CapabilityId[][];
  }): string {
    const parts: string[] = [];
    if (check.missing.length > 0) parts.push(`Missing children: ${check.missing.join(', ')}`);
    if (check.selfReferences.length > 0) parts.push('Self-reference detected');
    if (check.cycles.length > 0) parts.push('Composition cycle detected');
    return parts.join('; ') || 'Invalid composition';
  }
}

export { CapabilityVersion };
