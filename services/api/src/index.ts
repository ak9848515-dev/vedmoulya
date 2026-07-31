// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/api
// API Gateway & Platform Services
// BLD-016A — API Gateway & Platform Services
// ─────────────────────────────────────────────────────────────────────────────

// ── Main Router ─────────────────────────────────────────────────────────────

export { appRouter } from './router.js';
export type { AppRouter } from './router.js';
export type { TRPCContext } from './router.js';

// ── Application Service ─────────────────────────────────────────────────────

export { ApiApplicationService } from './services/ApiApplicationService.js';

// ── Router Registry ─────────────────────────────────────────────────────────

export { createAppRouter, router, publicProcedure } from './services/RouterRegistry.js';
export type { TRPCContext as RTRPCContext } from './services/RouterRegistry.js';

// ── Module Routers ──────────────────────────────────────────────────────────

export { createLifeOSRouter } from './routers/LifeOSRouter.js';
export { createDashboardRouter } from './routers/DashboardRouter.js';
export { createCareerRouter } from './routers/CareerRouter.js';
export { createLearningRouter } from './routers/LearningRouter.js';
export { createBusinessRouter } from './routers/BusinessRouter.js';
export { createMarketplaceRouter } from './routers/MarketplaceRouter.js';
export { createHealthRouter, type PlatformHealth } from './routers/HealthRouter.js';

// ── Middleware ───────────────────────────────────────────────────────────────

export {
  authenticateRequest,
  createAuthContext,
  isAuthenticated,
  verifyAccessToken,
} from './middleware/auth.js';
export type { AuthSession } from './middleware/auth.js';
export { checkRateLimit, assertRateLimit, RateLimitTiers } from './middleware/rate-limit.js';
export {
  validateInput,
  validateOrThrow,
  userIdSchema,
  paginationSchema,
  searchQuerySchema,
} from './middleware/validation.js';
export { toGatewayError, notFound } from './middleware/error.js';
export type { ErrorCode, GatewayError } from './middleware/error.js';
export { logAuditEvent, getAuditLog, createRequestAudit } from './middleware/audit.js';
export type { AuditEntry, AuditEventType } from './middleware/audit.js';

// ── Response Mapper ─────────────────────────────────────────────────────────

export {
  successResponse,
  errorResponse,
  fromServiceResult,
  paginatedResponse,
} from './services/ResponseMapper.js';
export type { ApiResponse, ResponseMeta } from './services/ResponseMapper.js';
