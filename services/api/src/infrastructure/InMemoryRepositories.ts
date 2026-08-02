// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: In-Memory Repositories
// Functional Map-backed implementations of four of the five domain repository
// interfaces (memory, decision, execution, knowledge). They replace the
// previous `{} as never` dev stubs, which crashed with
// `repository.findById is not a function` on the first protected procedure
// call (the auth 500 found by the PR-002 load test).
//
// NOTE (SPRINT PR-002A/B): the gateway no longer wires any engine through
// these in-memory repos — all five production repositories are resolved via
// each service module's existing DI registration (see
// services/api/src/infrastructure/ProductionRepositories.ts). These Map-backed
// implementations remain as a fast, hermetic test double (injected via
// `ApiApplicationServiceOptions`) and as reference implementations.
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/require-await -- In-memory repositories
   implement the Promise-returning domain interfaces with synchronous
   Map-backed bodies (no I/O); the `async` markers are required for interface
   conformance. */
/* eslint-disable security/detect-object-injection -- Heuristic false-positive:
   dynamic member access here uses typed/closed-union keys from the domain
   value objects or freshly-created counts records — never attacker-controlled
   property names (Execution.countByStatus indexes by a domain status string). */

import type {
  IdentityRepository,
  MemoryRepository,
  DecisionRepository,
  ExecutionRepository,
  KnowledgeRepository,
  User,
  UserId,
  Email,
  Memory,
  MemoryId,
  MemoryCategoryValue,
  MemoryStateValue,
  Decision,
  DecisionId,
  DecisionCategory,
  DecisionStatusValue,
  ExecutionPlan,
  ExecutionSearchParams,
  PlanningLevel,
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeGraph,
  KnowledgeNodeId,
  KnowledgeEdgeId,
  GraphId,
  KnowledgeCategoryValue,
  RelationshipCategory,
  DecisionSearchParams,
  MemorySearchParams,
  TimelineEntry,
  TimelineOrder,
} from '@vedmoulya/domain';
import type { PaginationParams, PaginatedResult } from '@vedmoulya/core';

// ── Shared helpers ───────────────────────────────────────────────────────────

function emptyPage<T>(params: PaginationParams): PaginatedResult<T> {
  return { data: [], total: 0, page: params.page, limit: params.limit, totalPages: 0 };
}

function pageFrom<T>(items: T[], params: PaginationParams): PaginatedResult<T> {
  const total = items.length;
  const start = (params.page - 1) * params.limit;
  const data = items.slice(start, start + params.limit);
  return {
    data,
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.ceil(total / params.limit),
  };
}

/** Extract a comparable string from an entity or value object defensively. */
function valueOf(x: unknown): string {
  if (x && typeof x === 'object' && 'value' in (x as Record<string, unknown>)) {
    return String((x as { value: unknown }).value);
  }
  return String(x);
}

function dateOf(x: unknown): Date | undefined {
  const d = (x as { createdAt?: Date } | null)?.createdAt;
  return d instanceof Date ? d : undefined;
}

function entityId(x: unknown): string {
  return String((x as { id: unknown }).id);
}

// ── Identity ────────────────────────────────────────────────────────────────

export class InMemoryIdentityRepository implements IdentityRepository {
  private readonly users = new Map<string, User>();

  async findById(id: UserId): Promise<User | null> {
    return this.users.get(String(id)) ?? null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    const target = email.toString();
    for (const user of this.users.values()) {
      const candidate = (user as unknown as { email?: Email }).email;
      if (candidate && candidate.toString() === target) return user;
    }
    return null;
  }

  async save(user: User): Promise<void> {
    this.users.set(entityId(user), user);
  }

  async update(user: User): Promise<void> {
    this.users.set(entityId(user), user);
  }

  async delete(id: UserId): Promise<void> {
    this.users.delete(String(id));
  }

  async exists(email: Email): Promise<boolean> {
    return (await this.findByEmail(email)) !== null;
  }

  async list(params: PaginationParams): Promise<PaginatedResult<User>> {
    return pageFrom([...this.users.values()], params);
  }

  async findByCreatedAtRange(
    start: Date,
    end: Date,
    params: PaginationParams,
  ): Promise<PaginatedResult<User>> {
    const filtered = [...this.users.values()].filter((user) => {
      const createdAt = dateOf(user);
      return createdAt !== undefined && createdAt >= start && createdAt <= end;
    });
    return pageFrom(filtered, params);
  }

  async count(): Promise<number> {
    return this.users.size;
  }

  async countActive(): Promise<number> {
    let active = 0;
    for (const user of this.users.values()) {
      const status = valueOf((user as unknown as { entityStatus?: unknown }).entityStatus);
      if (status === 'active') active += 1;
    }
    return active;
  }
}

// ── Memory ──────────────────────────────────────────────────────────────────

export class InMemoryMemoryRepository implements MemoryRepository {
  private readonly memories = new Map<string, Memory>();

  async findById(id: MemoryId): Promise<Memory | null> {
    return this.memories.get(String(id)) ?? null;
  }

  async findByCategory(
    category: MemoryCategoryValue,
    params: PaginationParams,
  ): Promise<PaginatedResult<Memory>> {
    const filtered = [...this.memories.values()].filter(
      (memory) => valueOf(memory.category) === category,
    );
    return pageFrom(filtered, params);
  }

  async findByState(
    state: MemoryStateValue,
    params: PaginationParams,
  ): Promise<PaginatedResult<Memory>> {
    const filtered = [...this.memories.values()].filter(
      (memory) => valueOf(memory.state) === state,
    );
    return pageFrom(filtered, params);
  }

  async save(memory: Memory): Promise<void> {
    this.memories.set(entityId(memory), memory);
  }

  async update(memory: Memory): Promise<void> {
    this.memories.set(entityId(memory), memory);
  }

  async delete(id: MemoryId): Promise<void> {
    this.memories.delete(String(id));
  }

  async exists(id: MemoryId): Promise<boolean> {
    return this.memories.has(String(id));
  }

  async search(
    params: MemorySearchParams,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Memory>> {
    const query = params.query.toLowerCase();
    const filtered = [...this.memories.values()].filter((memory) => {
      const title = ((memory as unknown as { title?: string }).title ?? '').toLowerCase();
      const content = ((memory as unknown as { content?: string }).content ?? '').toLowerCase();
      return title.includes(query) || content.includes(query);
    });
    return pageFrom(filtered, pagination);
  }

  // Dev simplification: every timeline entry is typed 'created' and dated by
  // createdAt — the in-memory repo does not track recall/update/archive events.
  async getTimeline(order: TimelineOrder, pagination: PaginationParams): Promise<TimelineEntry[]> {
    const entries = [...this.memories.values()].map((memory) => ({
      memory,
      date: dateOf(memory) ?? new Date(0),
      type: 'created' as const,
    }));
    entries.sort((a, b) =>
      order === 'asc' ? a.date.getTime() - b.date.getTime() : b.date.getTime() - a.date.getTime(),
    );
    return entries.slice(0, pagination.limit);
  }

  async findByKnowledgeNodeId(_knowledgeNodeId: string): Promise<Memory[]> {
    return [];
  }

  async findDecayingMemories(params: PaginationParams): Promise<PaginatedResult<Memory>> {
    return emptyPage(params);
  }

  async findMemoriesNeedingReinforcement(
    params: PaginationParams,
  ): Promise<PaginatedResult<Memory>> {
    return emptyPage(params);
  }

  async findRelatedMemories(
    _category: MemoryCategoryValue,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Memory>> {
    return emptyPage(pagination);
  }

  async count(): Promise<number> {
    return this.memories.size;
  }

  async countByCategory(): Promise<Record<MemoryCategoryValue, number>> {
    const counts: Partial<Record<MemoryCategoryValue, number>> = {};
    for (const memory of this.memories.values()) {
      const key = valueOf(memory.category) as MemoryCategoryValue;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts as Record<MemoryCategoryValue, number>;
  }

  async countByState(): Promise<Record<MemoryStateValue, number>> {
    const counts: Partial<Record<MemoryStateValue, number>> = {};
    for (const memory of this.memories.values()) {
      const key = valueOf(memory.state) as MemoryStateValue;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts as Record<MemoryStateValue, number>;
  }

  async countLinked(): Promise<number> {
    return [...this.memories.values()].filter(
      (memory) => (memory as unknown as { knowledgeNodeId?: string }).knowledgeNodeId !== undefined,
    ).length;
  }
}

// ── Decision ────────────────────────────────────────────────────────────────

export class InMemoryDecisionRepository implements DecisionRepository {
  private readonly decisions = new Map<string, Decision>();

  async findById(id: DecisionId): Promise<Decision | null> {
    return this.decisions.get(String(id)) ?? null;
  }

  async findByCategory(
    category: DecisionCategory,
    params: PaginationParams,
  ): Promise<PaginatedResult<Decision>> {
    const filtered = [...this.decisions.values()].filter(
      (decision) => valueOf(decision.category) === valueOf(category),
    );
    return pageFrom(filtered, params);
  }

  async findByStatus(
    status: DecisionStatusValue,
    params: PaginationParams,
  ): Promise<PaginatedResult<Decision>> {
    const filtered = [...this.decisions.values()].filter(
      (decision) => valueOf(decision.status) === status,
    );
    return pageFrom(filtered, params);
  }

  async save(decision: Decision): Promise<void> {
    this.decisions.set(entityId(decision), decision);
  }

  async update(decision: Decision): Promise<void> {
    this.decisions.set(entityId(decision), decision);
  }

  async delete(id: DecisionId): Promise<void> {
    this.decisions.delete(String(id));
  }

  async exists(id: DecisionId): Promise<boolean> {
    return this.decisions.has(String(id));
  }

  async search(
    params: DecisionSearchParams,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Decision>> {
    const query = params.query.toLowerCase();
    const filtered = [...this.decisions.values()].filter((decision) => {
      const title = ((decision as unknown as { title?: string }).title ?? '').toLowerCase();
      const description = (
        (decision as unknown as { description?: string }).description ?? ''
      ).toLowerCase();
      if (query && !title.includes(query) && !description.includes(query)) return false;
      if (
        params.categories &&
        !params.categories.includes(valueOf(decision.category) as DecisionCategory)
      ) {
        return false;
      }
      if (
        params.statuses &&
        !params.statuses.includes(valueOf(decision.status) as DecisionStatusValue)
      ) {
        return false;
      }
      return true;
    });
    return pageFrom(filtered, pagination);
  }

  async findByKnowledgeNodeId(_knowledgeNodeId: string): Promise<Decision[]> {
    return [];
  }

  async findByMemoryId(_memoryId: string): Promise<Decision[]> {
    return [];
  }

  async findPendingDecisions(params: PaginationParams): Promise<PaginatedResult<Decision>> {
    const pending = [...this.decisions.values()].filter(
      (decision) => valueOf(decision.status) === 'pending',
    );
    return pageFrom(pending, params);
  }

  async findRecentlyCompleted(limit: number): Promise<Decision[]> {
    return [...this.decisions.values()]
      .filter((decision) => valueOf(decision.status) === 'completed')
      .slice(0, limit);
  }

  async count(): Promise<number> {
    return this.decisions.size;
  }

  async countByCategory(): Promise<Record<DecisionCategory, number>> {
    const counts: Partial<Record<DecisionCategory, number>> = {};
    for (const decision of this.decisions.values()) {
      const key = valueOf(decision.category) as DecisionCategory;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts as Record<DecisionCategory, number>;
  }

  async countByStatus(): Promise<Record<DecisionStatusValue, number>> {
    const counts: Partial<Record<DecisionStatusValue, number>> = {};
    for (const decision of this.decisions.values()) {
      const key = valueOf(decision.status) as DecisionStatusValue;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts as Record<DecisionStatusValue, number>;
  }

  async countLinked(): Promise<number> {
    return [...this.decisions.values()].filter((decision) => {
      const d = decision as unknown as { knowledgeNodeId?: string; memoryId?: string };
      return d.knowledgeNodeId !== undefined || d.memoryId !== undefined;
    }).length;
  }
}

// ── Execution ───────────────────────────────────────────────────────────────

export class InMemoryExecutionRepository implements ExecutionRepository {
  private readonly plans = new Map<string, ExecutionPlan>();

  async findById(id: string): Promise<ExecutionPlan | null> {
    return this.plans.get(id) ?? null;
  }

  async findByPlanningLevel(
    level: PlanningLevel,
    params: PaginationParams,
  ): Promise<PaginatedResult<ExecutionPlan>> {
    const filtered = [...this.plans.values()].filter(
      (plan) => valueOf(plan.planningLevel) === level,
    );
    return pageFrom(filtered, params);
  }

  async findByStatus(
    status: string,
    params: PaginationParams,
  ): Promise<PaginatedResult<ExecutionPlan>> {
    const filtered = [...this.plans.values()].filter((plan) => valueOf(plan.status) === status);
    return pageFrom(filtered, params);
  }

  async save(plan: ExecutionPlan): Promise<void> {
    this.plans.set(entityId(plan), plan);
  }

  async update(plan: ExecutionPlan): Promise<void> {
    this.plans.set(entityId(plan), plan);
  }

  async delete(id: string): Promise<void> {
    this.plans.delete(id);
  }

  async exists(id: string): Promise<boolean> {
    return this.plans.has(id);
  }

  async search(
    params: ExecutionSearchParams,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<ExecutionPlan>> {
    const query = params.query.toLowerCase();
    const filtered = [...this.plans.values()].filter((plan) => {
      const title = ((plan as unknown as { title?: string }).title ?? '').toLowerCase();
      const description = (
        (plan as unknown as { description?: string }).description ?? ''
      ).toLowerCase();
      if (query && !title.includes(query) && !description.includes(query)) return false;
      if (params.statuses && !params.statuses.includes(valueOf(plan.status))) return false;
      if (
        params.planningLevels &&
        !params.planningLevels.includes(valueOf(plan.planningLevel) as PlanningLevel)
      ) {
        return false;
      }
      return true;
    });
    return pageFrom(filtered, pagination);
  }

  async findByGoalId(_goalId: string): Promise<ExecutionPlan[]> {
    return [];
  }

  async findByDecisionId(_decisionId: string): Promise<ExecutionPlan[]> {
    return [];
  }

  async findActivePlans(params: PaginationParams): Promise<PaginatedResult<ExecutionPlan>> {
    const active = [...this.plans.values()].filter((plan) => valueOf(plan.status) === 'active');
    return pageFrom(active, params);
  }

  async findRecentlyCompleted(limit: number): Promise<ExecutionPlan[]> {
    return [...this.plans.values()]
      .filter((plan) => valueOf(plan.status) === 'completed')
      .slice(0, limit);
  }

  async count(): Promise<number> {
    return this.plans.size;
  }

  async countByPlanningLevel(): Promise<Record<PlanningLevel, number>> {
    const counts: Partial<Record<PlanningLevel, number>> = {};
    for (const plan of this.plans.values()) {
      const key = valueOf(plan.planningLevel) as PlanningLevel;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts as Record<PlanningLevel, number>;
  }

  async countByStatus(): Promise<Record<string, number>> {
    const counts: Partial<Record<string, number>> = {};
    for (const plan of this.plans.values()) {
      const key = valueOf(plan.status);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts as Record<string, number>;
  }

  async countActive(): Promise<number> {
    return [...this.plans.values()].filter((plan) => valueOf(plan.status) === 'active').length;
  }

  async countOverdue(): Promise<number> {
    const now = Date.now();
    return [...this.plans.values()].filter((plan) => {
      const due = (plan as unknown as { dueDate?: Date }).dueDate;
      return due instanceof Date && due.getTime() < now;
    }).length;
  }
}

// ── Knowledge Graph ─────────────────────────────────────────────────────────

export class InMemoryKnowledgeRepository implements KnowledgeRepository {
  private readonly nodes = new Map<string, KnowledgeNode>();
  private readonly edges = new Map<string, KnowledgeEdge>();
  private readonly graphs = new Map<string, KnowledgeGraph>();

  // ── Nodes ────────────────────────────────────────────────────────────────

  async findNodeById(id: KnowledgeNodeId): Promise<KnowledgeNode | null> {
    return this.nodes.get(String(id)) ?? null;
  }

  async findNodesByCategory(
    category: KnowledgeCategoryValue,
    params: PaginationParams,
  ): Promise<PaginatedResult<KnowledgeNode>> {
    const filtered = [...this.nodes.values()].filter((node) => valueOf(node.category) === category);
    return pageFrom(filtered, params);
  }

  async findNodesByLabel(
    label: string,
    params: PaginationParams,
  ): Promise<PaginatedResult<KnowledgeNode>> {
    const filtered = [...this.nodes.values()].filter((node) =>
      ((node as unknown as { label?: string }).label ?? '').includes(label),
    );
    return pageFrom(filtered, params);
  }

  async findNodesByGraph(
    graphId: GraphId,
    params: PaginationParams,
  ): Promise<PaginatedResult<KnowledgeNode>> {
    const filtered = [...this.nodes.values()].filter(
      (node) => String(node.graphId) === String(graphId),
    );
    return pageFrom(filtered, params);
  }

  async saveNode(node: KnowledgeNode): Promise<void> {
    this.nodes.set(entityId(node), node);
  }

  async updateNode(node: KnowledgeNode): Promise<void> {
    this.nodes.set(entityId(node), node);
  }

  async deleteNode(id: KnowledgeNodeId): Promise<void> {
    this.nodes.delete(String(id));
  }

  async nodeExists(id: KnowledgeNodeId): Promise<boolean> {
    return this.nodes.has(String(id));
  }

  // ── Edges ────────────────────────────────────────────────────────────────

  async findEdgeById(id: KnowledgeEdgeId): Promise<KnowledgeEdge | null> {
    return this.edges.get(String(id)) ?? null;
  }

  async findEdgesBetween(
    sourceId: KnowledgeNodeId,
    targetId: KnowledgeNodeId,
  ): Promise<KnowledgeEdge[]> {
    return [...this.edges.values()].filter(
      (edge) =>
        String(edge.sourceId) === String(sourceId) && String(edge.targetId) === String(targetId),
    );
  }

  async findEdgesForNode(nodeId: KnowledgeNodeId): Promise<KnowledgeEdge[]> {
    return [...this.edges.values()].filter(
      (edge) =>
        String(edge.sourceId) === String(nodeId) || String(edge.targetId) === String(nodeId),
    );
  }

  async findEdgesByType(
    type: string,
    params: PaginationParams,
  ): Promise<PaginatedResult<KnowledgeEdge>> {
    const filtered = [...this.edges.values()].filter((edge) => valueOf(edge.type) === type);
    return pageFrom(filtered, params);
  }

  async findEdgesByCategory(
    category: RelationshipCategory,
    params: PaginationParams,
  ): Promise<PaginatedResult<KnowledgeEdge>> {
    const filtered = [...this.edges.values()].filter(
      (edge) =>
        valueOf((edge as unknown as { relationshipCategory?: unknown }).relationshipCategory) ===
        valueOf(category),
    );
    return pageFrom(filtered, params);
  }

  async saveEdge(edge: KnowledgeEdge): Promise<void> {
    this.edges.set(entityId(edge), edge);
  }

  async updateEdge(edge: KnowledgeEdge): Promise<void> {
    this.edges.set(entityId(edge), edge);
  }

  async deleteEdge(id: KnowledgeEdgeId): Promise<void> {
    this.edges.delete(String(id));
  }

  async edgeExists(id: KnowledgeEdgeId): Promise<boolean> {
    return this.edges.has(String(id));
  }

  // ── Graphs ───────────────────────────────────────────────────────────────

  async findGraphById(id: GraphId): Promise<KnowledgeGraph | null> {
    return this.graphs.get(String(id)) ?? null;
  }

  async findAllGraphs(params: PaginationParams): Promise<PaginatedResult<KnowledgeGraph>> {
    return pageFrom([...this.graphs.values()], params);
  }

  async saveGraph(graph: KnowledgeGraph): Promise<void> {
    this.graphs.set(entityId(graph), graph);
  }

  async updateGraph(graph: KnowledgeGraph): Promise<void> {
    this.graphs.set(entityId(graph), graph);
  }

  async deleteGraph(id: GraphId): Promise<void> {
    this.graphs.delete(String(id));
  }

  // ── Search & Statistics ──────────────────────────────────────────────────

  async searchNodes(
    query: string,
    params: PaginationParams,
  ): Promise<PaginatedResult<KnowledgeNode>> {
    const q = query.toLowerCase();
    const filtered = [...this.nodes.values()].filter((node) => {
      const label = ((node as unknown as { label?: string }).label ?? '').toLowerCase();
      const description = (
        (node as unknown as { description?: string }).description ?? ''
      ).toLowerCase();
      return label.includes(q) || description.includes(q);
    });
    return pageFrom(filtered, params);
  }

  async searchNodesByTags(
    tags: string[],
    params: PaginationParams,
  ): Promise<PaginatedResult<KnowledgeNode>> {
    const filtered = [...this.nodes.values()].filter((node) => {
      const nodeTags = (node as unknown as { tags?: readonly string[] }).tags ?? [];
      return tags.some((tag) => nodeTags.includes(tag));
    });
    return pageFrom(filtered, params);
  }

  async countNodes(graphId: GraphId): Promise<number> {
    return [...this.nodes.values()].filter((node) => String(node.graphId) === String(graphId))
      .length;
  }

  async countEdges(graphId: GraphId): Promise<number> {
    return [...this.edges.values()].filter((edge) => String(edge.graphId) === String(graphId))
      .length;
  }

  async countNodesByCategory(graphId: GraphId): Promise<Record<KnowledgeCategoryValue, number>> {
    const counts: Partial<Record<KnowledgeCategoryValue, number>> = {};
    for (const node of this.nodes.values()) {
      if (String(node.graphId) !== String(graphId)) continue;
      const key = valueOf(node.category) as KnowledgeCategoryValue;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts as Record<KnowledgeCategoryValue, number>;
  }

  async countGraphs(): Promise<number> {
    return this.graphs.size;
  }
}

// ── Aggregate factory ────────────────────────────────────────────────────────

export interface InMemoryRepositories {
  identity: InMemoryIdentityRepository;
  memory: InMemoryMemoryRepository;
  decision: InMemoryDecisionRepository;
  execution: InMemoryExecutionRepository;
  knowledge: InMemoryKnowledgeRepository;
}

export function createInMemoryRepositories(): InMemoryRepositories {
  return {
    identity: new InMemoryIdentityRepository(),
    memory: new InMemoryMemoryRepository(),
    decision: new InMemoryDecisionRepository(),
    execution: new InMemoryExecutionRepository(),
    knowledge: new InMemoryKnowledgeRepository(),
  };
}
