// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/knowledge
// Knowledge Graph Service — Domain, Infrastructure, Application, Presentation
// Implements BLD-006 Knowledge Graph Platform
// ARC-003 — Knowledge Graph Bounded Context
// ──────────────────────────────────────────────────────────────────

export const serviceName = 'knowledge' as const;

// ── Schema ─────────────────────────────────────────────────────────────────
export {
  knowledgeNodes,
  knowledgeEdges,
  knowledgeGraphs,
  knowledgeLineage,
} from './schema/knowledge.js';
export type {
  KnowledgeNodeRow,
  NewKnowledgeNodeRow,
  KnowledgeEdgeRow,
  NewKnowledgeEdgeRow,
  KnowledgeGraphRow,
  NewKnowledgeGraphRow,
} from './schema/knowledge.js';

// ── Infrastructure — Persistence ───────────────────────────────────────────
export { PostgresKnowledgeRepository } from './infrastructure/persistence/PostgresKnowledgeRepository.js';
export {
  initializeDatabase,
  closeDatabase,
  getDatabase,
} from './infrastructure/persistence/DatabaseConnection.js';

// ── Infrastructure — Cache ─────────────────────────────────────────────────
export { KnowledgeCache } from './infrastructure/cache/KnowledgeCache.js';

// ── Infrastructure — Events ────────────────────────────────────────────────
export { KnowledgeEventPublisher } from './infrastructure/events/KnowledgeEventPublisher.js';

// ── Infrastructure — DI ────────────────────────────────────────────────────
export { registerKnowledgeServices, knowledgeModule } from './infrastructure/di/KnowledgeModule.js';

// ── Observability — Metrics ────────────────────────────────────────────────
export { KnowledgeMetrics, MetricNames } from './observability/KnowledgeMetrics.js';

// ── Observability — Audit ──────────────────────────────────────────────────
export { KnowledgeAuditor } from './observability/KnowledgeAudit.js';
export type { KnowledgeAuditAction, AuditEntry } from './observability/KnowledgeAudit.js';

// ── Observability — Tracing ────────────────────────────────────────────────
export { KnowledgeTracer } from './observability/KnowledgeTracing.js';

// ── Presentation — Routes ──────────────────────────────────────────────────
export {
  createKnowledgeRouter,
  knowledgeRouteConfig,
} from './presentation/routes/KnowledgeRoutes.js';
export { KnowledgeController } from './presentation/controllers/KnowledgeController.js';

// ── Presentation — tRPC ────────────────────────────────────────────────────
export { createKnowledgeTrpcRouter } from './presentation/trpc/KnowledgeRouter.js';

// ── Presentation — OpenAPI ─────────────────────────────────────────────────
export { knowledgeOpenApiSchema } from './presentation/openapi/KnowledgeOpenAPI.js';
