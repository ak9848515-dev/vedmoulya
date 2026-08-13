// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric: Application
// APP-001 — Post-V1 Application Platform Layer
// Facade over the fabric domain services. Exposes the API surface:
// personal graph, business graph, hybrid search, entity + relationship
// lookups, context package assembly, explanations, provenance,
// permissions and health. Consumes the frozen EI engines exclusively
// through the narrow FabricEngines port bundle — it owns none,
// duplicates no logic, and never requires an LLM for basic retrieval.
// ──────────────────────────────────────────────────────────────────

import type { FabricEngines } from '../contracts/fabric-engines.js';
import type {
  BusinessGraph,
  ContextEntity,
  ContextExplanation,
  ContextFabricPackage,
  ContextRelationship,
  ContextRetrievalQuery,
  ContextRetrievalResult,
  FabricHealth,
  PersonalGraph,
  PermissionEvaluation,
} from '../types/fabric-types.js';
import type { GraphRepository } from '../domain/repository/GraphRepository.js';
import { PersonalGraphService } from '../domain/services/PersonalGraphService.js';
import { BusinessGraphService } from '../domain/services/BusinessGraphService.js';
import { ContextSearchService } from '../domain/services/ContextSearchService.js';
import { ContextAssemblyService } from '../domain/services/ContextAssemblyService.js';
import { FabricHealthService } from '../domain/services/FabricHealthService.js';
import {
  evaluatePermission,
  type AccessRequest,
} from '../domain/services/PermissionEvaluationService.js';
import { provenanceStatement } from '../domain/services/ProvenanceService.js';

export interface FabricResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  latency?: number;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Default search weights mirroring the hybrid strategy blend. */
const SEARCH_WEIGHTS = {
  keyword: 0.5,
  metadata: 0.2,
  recency: 0.15,
  confidence: 0.15,
  graph_proximity: 0.1,
};

export interface ContextFabricOptions {
  /** Capabilities the fabric may advertise in packages. */
  relevantCapabilities?: string[];
  /** Token budget for assembled packages. */
  tokenBudget?: number;
}

export class ContextFabricApplicationService {
  private readonly personal: PersonalGraphService;
  private readonly business: BusinessGraphService;
  private readonly searchService: ContextSearchService;
  private readonly assembly: ContextAssemblyService;
  private readonly health: FabricHealthService;
  private readonly options: ContextFabricOptions;

  constructor(
    private readonly repository: GraphRepository,
    private readonly engines: FabricEngines,
    options: ContextFabricOptions = {},
  ) {
    this.personal = new PersonalGraphService(repository);
    this.business = new BusinessGraphService(repository);
    this.searchService = new ContextSearchService(repository);
    this.assembly = new ContextAssemblyService();
    this.health = new FabricHealthService(repository);
    this.options = options;
  }

  // ── Personal graph ──────────────────────────────────────────────

  async getPersonalGraph(userId: string): Promise<FabricResult<PersonalGraph>> {
    try {
      const startedAt = performance.now();
      const data = await this.personal.getPersonalGraph(userId);
      return { success: true, data, latency: performance.now() - startedAt };
    } catch (error) {
      return { success: false, error: messageOf(error) };
    }
  }

  // ── Business graph ──────────────────────────────────────────────

  async getBusinessGraph(organizationId: string): Promise<FabricResult<BusinessGraph>> {
    try {
      const startedAt = performance.now();
      const data = await this.business.getBusinessGraph(organizationId);
      return { success: true, data, latency: performance.now() - startedAt };
    } catch (error) {
      return { success: false, error: messageOf(error) };
    }
  }

  // ── Entity + relationships ──────────────────────────────────────

  async getEntity(
    userId: string,
    entityId: string,
  ): Promise<FabricResult<{ entity: ContextEntity; permission: PermissionEvaluation }>> {
    try {
      const startedAt = performance.now();
      const entity = await this.repository.getEntity(entityId);
      if (!entity) return { success: false, error: `entity not found: ${entityId}` };
      const permission = evaluatePermission(
        entity,
        this.accessRequest(userId, entity.organizationId),
      );
      return {
        success: true,
        data: { entity, permission },
        latency: performance.now() - startedAt,
      };
    } catch (error) {
      return { success: false, error: messageOf(error) };
    }
  }

  async getRelationships(
    userId: string,
    entityId: string,
    maxDepth = 1,
  ): Promise<FabricResult<{ entity: ContextEntity; relationships: ContextRelationship[] }>> {
    try {
      const startedAt = performance.now();
      const entity = await this.repository.getEntity(entityId);
      if (!entity) return { success: false, error: `entity not found: ${entityId}` };
      const all = await this.repository.listRelationships();
      const seen = new Set<string>([entityId]);
      const frontier = [entityId];
      const result: ContextRelationship[] = [];
      for (let depth = 0; depth < maxDepth && frontier.length > 0; depth += 1) {
        const current = frontier.shift() as string;
        for (const rel of all) {
          if (rel.fromId !== current && rel.toId !== current) continue;
          result.push(rel);
          const next = rel.fromId === current ? rel.toId : rel.fromId;
          if (!seen.has(next)) {
            seen.add(next);
            frontier.push(next);
          }
        }
      }
      return {
        success: true,
        data: { entity, relationships: result },
        latency: performance.now() - startedAt,
      };
    } catch (error) {
      return { success: false, error: messageOf(error) };
    }
  }

  // ── Hybrid search (permission-gated) ────────────────────────────

  async search(dto: {
    userId: string;
    organizationId?: string;
    query: string;
    goalId?: string;
    projectId?: string;
    taskId?: string;
    sources?: string[];
    types?: string[];
    tags?: string[];
    minConfidence?: number;
    limit?: number;
  }): Promise<FabricResult<ContextRetrievalResult>> {
    try {
      const startedAt = performance.now();
      const request = this.accessRequest(dto.userId, dto.organizationId);

      // 1. Candidate pool from the fabric graph (entities the user may
      //    even see are filtered AFTER retrieval — the permission gate
      //    below is the hard filter before anything is returned).
      const all = await this.repository.listEntities();
      const query: ContextRetrievalQuery = {
        userId: dto.userId,
        organizationId: dto.organizationId,
        query: dto.query,
        goalId: dto.goalId,
        projectId: dto.projectId,
        taskId: dto.taskId,
        limit: dto.limit,
        filters: {
          sources: dto.sources as ContextEntity['source'][],
          types: dto.types as ContextEntity['type'][],
          tags: dto.tags,
          minConfidence: dto.minConfidence,
        },
      };

      // 2. Hybrid retrieval + ranking.
      const result = await this.searchService.search(all, query, SEARCH_WEIGHTS);

      // 3. Mandatory permission gate — never return unauthorized context.
      result.entities = result.entities.filter(
        (entity) => evaluatePermission(entity, request).allowed,
      );
      result.ranking = result.ranking.filter((rank) =>
        result.entities.some((entity) => entity.entityId === rank.entityId),
      );
      result.total = result.entities.length;

      return { success: true, data: result, latency: performance.now() - startedAt };
    } catch (error) {
      return { success: false, error: messageOf(error) };
    }
  }

  // ── Context package assembly (minimum useful context) ───────────

  async buildContextPackage(dto: {
    userId: string;
    organizationId?: string;
    goalId?: string;
    taskId?: string;
    query: string;
    tokenBudget?: number;
  }): Promise<FabricResult<ContextFabricPackage>> {
    try {
      const startedAt = performance.now();
      const request = this.accessRequest(dto.userId, dto.organizationId);

      const all = await this.repository.listEntities();
      const query: ContextRetrievalQuery = {
        userId: dto.userId,
        organizationId: dto.organizationId,
        goalId: dto.goalId,
        taskId: dto.taskId,
        query: dto.query,
        limit: 50,
      };
      const result = await this.searchService.search(all, query, SEARCH_WEIGHTS);

      // Permission-gated candidates for assembly.
      const candidates = result.ranking
        .map((rank) => {
          const entity = result.entities.find((e) => e.entityId === rank.entityId);
          if (!entity) return undefined;
          const permission = evaluatePermission(entity, request);
          return { entity, ranking: rank, permission };
        })
        .filter(
          (
            c,
          ): c is {
            entity: ContextEntity;
            ranking: ContextRetrievalResult['ranking'][number];
            permission: PermissionEvaluation;
          } => c !== undefined,
        )
        .filter((c) => c.permission.allowed);

      const relevantCapabilities = await this.loadRelevantCapabilities(dto.query);
      const package_ = this.assembly.assemble(query, candidates, [], {
        tokenBudget: dto.tokenBudget ?? this.options.tokenBudget,
        relevantCapabilities,
        contextVersion: `fabric-${new Date().toISOString().slice(0, 10)}`,
      });

      return { success: true, data: package_, latency: performance.now() - startedAt };
    } catch (error) {
      return { success: false, error: messageOf(error) };
    }
  }

  // ── Explanation ─────────────────────────────────────────────────

  async explainContextSelection(dto: {
    userId: string;
    entityId: string;
    goalId?: string;
    projectId?: string;
    taskId?: string;
    query?: string;
  }): Promise<FabricResult<ContextExplanation[]>> {
    try {
      const startedAt = performance.now();
      const entity = await this.repository.getEntity(dto.entityId);
      if (!entity) return { success: false, error: `entity not found: ${dto.entityId}` };
      const permission = evaluatePermission(
        entity,
        this.accessRequest(dto.userId, entity.organizationId),
      );
      const query: ContextRetrievalQuery = {
        userId: dto.userId,
        goalId: dto.goalId,
        projectId: dto.projectId,
        taskId: dto.taskId,
        query: dto.query ?? entity.label,
      };
      const result = await this.searchService.search([entity], query, SEARCH_WEIGHTS);
      const rank = result.ranking[0];
      const reasons = [...(rank?.reasons ?? [])];
      if (permission.allowed) {
        reasons.push('you have permission to access this context');
      } else {
        reasons.push('you do NOT have permission to access this context');
      }
      const explanation: ContextExplanation = {
        entityId: entity.entityId,
        entityLabel: entity.label,
        selected: permission.allowed && Boolean(rank),
        score: rank?.score ?? 0,
        reasons,
      };
      return { success: true, data: [explanation], latency: performance.now() - startedAt };
    } catch (error) {
      return { success: false, error: messageOf(error) };
    }
  }

  // ── Provenance ──────────────────────────────────────────────────

  async getProvenance(
    userId: string,
    entityId: string,
  ): Promise<FabricResult<{ provenance: string; facts: string[] }>> {
    try {
      const startedAt = performance.now();
      const entity = await this.repository.getEntity(entityId);
      if (!entity) return { success: false, error: `entity not found: ${entityId}` };
      const permission = evaluatePermission(
        entity,
        this.accessRequest(userId, entity.organizationId),
      );
      return {
        success: true,
        data: {
          provenance: provenanceStatement(entity),
          facts: [
            `source: ${entity.source}`,
            `source id: ${entity.provenance.sourceId}`,
            `created: ${entity.provenance.createdAt}`,
            `updated: ${entity.provenance.updatedAt}`,
            `produced by: ${entity.provenance.producedBy}`,
            `confidence: ${Math.round(entity.provenance.confidence * 100)}%`,
            permission.allowed ? 'access: granted' : 'access: denied',
          ],
        },
        latency: performance.now() - startedAt,
      };
    } catch (error) {
      return { success: false, error: messageOf(error) };
    }
  }

  // ── Permissions ─────────────────────────────────────────────────

  async getPermissions(
    userId: string,
    entityId: string,
    organizationId?: string,
  ): Promise<FabricResult<{ permission: PermissionEvaluation; label: string }>> {
    try {
      const startedAt = performance.now();
      const entity = await this.repository.getEntity(entityId);
      if (!entity) return { success: false, error: `entity not found: ${entityId}` };
      const evaluation = evaluatePermission(
        entity,
        this.accessRequest(userId, organizationId ?? entity.organizationId),
      );
      const label = `${entity.permissions.scope} · owner:${entity.permissions.owner} · roles:${entity.permissions.allowedRoles.join(',') || 'none'}`;
      return {
        success: true,
        data: { permission: evaluation, label },
        latency: performance.now() - startedAt,
      };
    } catch (error) {
      return { success: false, error: messageOf(error) };
    }
  }

  // ── Sources ─────────────────────────────────────────────────────

  async getSources(): Promise<FabricResult<{ source: string; entityCount: number }[]>> {
    try {
      const startedAt = performance.now();
      const entities = await this.repository.listEntities();
      const countBySource: Record<string, number> = {};
      for (const entity of entities) {
        countBySource[entity.source] = (countBySource[entity.source] ?? 0) + 1;
      }
      const data = Object.entries(countBySource)
        .map(([source, entityCount]) => ({ source, entityCount }))
        .sort((a, b) => b.entityCount - a.entityCount);
      return { success: true, data, latency: performance.now() - startedAt };
    } catch (error) {
      return { success: false, error: messageOf(error) };
    }
  }

  // ── Health ──────────────────────────────────────────────────────

  async getHealth(): Promise<FabricResult<FabricHealth>> {
    try {
      const startedAt = performance.now();
      const data = await this.health.getHealth();
      return { success: true, data, latency: performance.now() - startedAt };
    } catch (error) {
      return { success: false, error: messageOf(error) };
    }
  }

  // ── Internal helpers ────────────────────────────────────────────

  private accessRequest(userId: string, organizationId?: string): AccessRequest {
    return { userId, organizationId, roles: ['member'] };
  }

  private async loadRelevantCapabilities(_query: string): Promise<string[]> {
    try {
      const marketplace = await this.engines.capabilities.getMarketplace();
      if (!marketplace.success || !marketplace.data) return [];
      const items = Array.isArray(marketplace.data)
        ? marketplace.data
        : ((marketplace.data as { capabilities?: unknown[] }).capabilities ?? []);
      const labels = items
        .map(
          (item) =>
            (item as { name?: string; id?: string }).name ?? (item as { id?: string }).id ?? '',
        )
        .filter(Boolean)
        .slice(0, 5);
      return labels;
    } catch {
      return [];
    }
  }
}
