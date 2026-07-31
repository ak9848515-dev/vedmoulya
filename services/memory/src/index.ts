// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/memory
// Memory Engine Service — Domain, Infrastructure, Application, Presentation
// Implements BLD-007 Memory Engine
// ARC-003/ARC-004 — Memory Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

export const serviceName = 'memory' as const;

// ── Schema ─────────────────────────────────────────────────────────────────
export { memories, memoryTimeline, memorySnapshots } from './schema/memory.js';
export type {
  MemoryRow,
  NewMemoryRow,
  MemoryTimelineRow,
  NewMemoryTimelineRow,
  MemorySnapshotRow,
  NewMemorySnapshotRow,
} from './schema/memory.js';

// ── Infrastructure — Persistence ───────────────────────────────────────────
export { PostgresMemoryRepository } from './infrastructure/persistence/PostgresMemoryRepository.js';
export {
  initializeDatabase,
  closeDatabase,
  getDatabase,
} from './infrastructure/persistence/DatabaseConnection.js';

// ── Infrastructure — Cache ─────────────────────────────────────────────────
export { MemoryCache } from './infrastructure/cache/MemoryCache.js';

// ── Infrastructure — Events ────────────────────────────────────────────────
export { MemoryEventPublisher } from './infrastructure/events/MemoryEventPublisher.js';

// ── Infrastructure — DI ────────────────────────────────────────────────────
export { registerMemoryServices, memoryModule } from './infrastructure/di/MemoryModule.js';

// ── Observability — Metrics ────────────────────────────────────────────────
export { MemoryMetrics, MetricNames } from './observability/MemoryMetrics.js';

// ── Observability — Audit ──────────────────────────────────────────────────
export { MemoryAuditor } from './observability/MemoryAudit.js';
export type { MemoryAuditAction, AuditEntry } from './observability/MemoryAudit.js';

// ── Observability — Tracing ────────────────────────────────────────────────
export { MemoryTracer } from './observability/MemoryTracing.js';

// ── Presentation — Routes ──────────────────────────────────────────────────
export { createMemoryRouter, memoryRouteConfig } from './presentation/routes/MemoryRoutes.js';
export { MemoryController } from './presentation/controllers/MemoryController.js';

// ── Presentation — tRPC ────────────────────────────────────────────────────
export { createMemoryTrpcRouter } from './presentation/trpc/MemoryRouter.js';

// ── Presentation — OpenAPI ─────────────────────────────────────────────────
export { memoryOpenApiSchema } from './presentation/openapi/MemoryOpenAPI.js';
