// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Router Registry
// Registers all module routers into a unified tRPC app router
// Applies rate-limit middleware per endpoint tier
// BLD-016A — API Gateway & Platform Services
// ─────────────────────────────────────────────────────────────────────────────

import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';
import type { ApiApplicationService } from './ApiApplicationService.js';
import { createLifeOSRouter } from '../routers/LifeOSRouter.js';
import { createDashboardRouter } from '../routers/DashboardRouter.js';
import { createCareerRouter } from '../routers/CareerRouter.js';
import { createLearningRouter } from '../routers/LearningRouter.js';
import { createBusinessRouter } from '../routers/BusinessRouter.js';
import { createMarketplaceRouter } from '../routers/MarketplaceRouter.js';
import { createHealthRouter } from '../routers/HealthRouter.js';
import { createIdentityRouter } from '../routers/IdentityRouter.js';
import { createSearchRouter } from '../routers/SearchRouter.js';
import { createNotificationRouter } from '../routers/NotificationRouter.js';
import { createConfigurationRouter } from '../routers/ConfigurationRouter.js';
import { createMetricsRouter } from '../routers/MetricsRouter.js';
import { checkRateLimitInternal, RateLimitTiers } from '../middleware/rate-limit.js';
import type { RateLimitConfig } from '../middleware/rate-limit.js';
import { isAuthenticated, assertUserIdMatchesSession } from '../middleware/auth.js';

// ── tRPC Context ────────────────────────────────────────────────────────────

export interface TRPCContext {
  userId: string;
  email: string;
  role: string;
}

export const t = initTRPC.context<TRPCContext>().create();

// ── Rate Limit Middleware Factory (uses t.middleware() for proper types) ─────

function createRateLimitMiddleware(tier: RateLimitConfig): ReturnType<typeof t.middleware> {
  return t.middleware(async ({ ctx, next }) => {
    const userId = ctx.userId;
    if (!checkRateLimitInternal(userId, tier)) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Rate limit exceeded. Please try again later.',
      });
    }
    return next();
  });
}

// ── Auth Middleware ─────────────────────────────────────────────────────────
// Real JWT enforcement: rejects requests without a verified session.
// Health procedures use `healthProcedure` (public) below; everything else
// is protected in all environments (strict enforcement).

function createAuthMiddleware(): ReturnType<typeof t.middleware> {
  return t.middleware(async ({ ctx, next, getRawInput }) => {
    isAuthenticated(ctx);
    // IDOR guard: any procedure scoped by userId must target the session user.
    // In tRPC v11, middleware registered BEFORE .input() receives input:
    // undefined, so read the raw input instead (verified empirically).
    const rawInput = await getRawInput();
    assertUserIdMatchesSession(ctx, rawInput);
    return next();
  });
}

const authMiddleware = createAuthMiddleware();

// ── Procedure Variants (auth + rate limit middleware) ───────────────────────

export const publicProcedure = t.procedure;
export const standardProcedure = t.procedure
  .use(authMiddleware)
  .use(createRateLimitMiddleware(RateLimitTiers.standard));
export const heavyProcedure = t.procedure
  .use(authMiddleware)
  .use(createRateLimitMiddleware(RateLimitTiers.heavy));
export const searchProcedure = t.procedure
  .use(authMiddleware)
  .use(createRateLimitMiddleware(RateLimitTiers.search));
export const healthProcedure = t.procedure.use(createRateLimitMiddleware(RateLimitTiers.health));
export const authProcedure = t.procedure
  .use(authMiddleware)
  .use(createRateLimitMiddleware(RateLimitTiers.auth));

export const router = t.router;

// ── Zod Enums matching LifeOSDTO types ──────────────────────────────────────

const searchCategoryEnum = z.enum([
  'profile',
  'skill',
  'goal',
  'project',
  'kpi',
  'learning_path',
  'assessment',
  'certification',
  'job',
  'marketplace_asset',
  'provider',
  'template',
  'memory',
  'decision',
  'knowledge',
  'insight',
  'recommendation',
]);

const moduleEnum = z.enum(['dashboard', 'career', 'learning', 'business', 'marketplace']);

// ── Common Input Schemas ────────────────────────────────────────────────────

const userId = z.object({ userId: z.string().min(1) });

const searchInput = z.object({
  query: z.string().min(1).max(500),
  categories: z.array(searchCategoryEnum).optional(),
  sources: z.array(moduleEnum).optional(),
  maxResults: z.number().int().min(1).max(100).optional().default(20),
});

const configUpdate = z.object({
  userId: z.string().min(1),
  updates: z.record(z.unknown()),
});

const sectionRefresh = z.object({
  userId: z.string().min(1),
  sectionId: z.string().min(1),
});

// ── Router Registry ─────────────────────────────────────────────────────────

/**
 * Creates the unified app router from all module routers.
 * Each handler delegates to the appropriate router factory.
 * Rate limiting is applied via the procedure variant used for each endpoint.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function createAppRouter(services: ApiApplicationService) {
  return router({
    // ── Platform Health (health tier: 200 req/min) ──────────────────────────
    health: router({
      check: healthProcedure
        .input(z.void())
        .query(({ ctx }) =>
          createHealthRouter(services.lifeOS, services.infrastructureHealth).check(
            undefined as unknown,
            ctx,
          ),
        ),
      live: healthProcedure
        .input(z.void())
        .query(({ ctx }) => createHealthRouter(services.lifeOS).live(undefined as unknown, ctx)),
      ready: healthProcedure
        .input(z.void())
        .query(({ ctx }) => createHealthRouter(services.lifeOS).ready(undefined as unknown, ctx)),
      version: healthProcedure
        .input(z.void())
        .query(({ ctx }) => createHealthRouter(services.lifeOS).version(undefined as unknown, ctx)),
    }),

    // ── Identity (auth tier: 10 req/min) ────────────────────────────────────
    identity: router({
      getProfile: authProcedure
        .input(userId)
        .query(({ input }) => createIdentityRouter(services.identity).getProfile(input.userId)),
      updateProfile: authProcedure
        .input(z.object({ userId: z.string(), updates: z.record(z.unknown()) }))
        .mutation(({ input }) =>
          createIdentityRouter(services.identity).updateProfile(input.userId, input.updates),
        ),
    }),

    // ── Life OS (heavy tier: 20 req/min for snapshot; standard for others) ──
    lifeOS: router({
      getSnapshot: heavyProcedure
        .input(userId)
        .query(({ input, ctx }) => createLifeOSRouter(services.lifeOS).getSnapshot(input, ctx)),
      getViewModel: heavyProcedure
        .input(userId)
        .query(({ input, ctx }) => createLifeOSRouter(services.lifeOS).getViewModel(input, ctx)),
      globalSearch: searchProcedure
        .input(searchInput)
        .query(({ input, ctx }) => createLifeOSRouter(services.lifeOS).globalSearch(input, ctx)),
      invalidateCache: standardProcedure
        .input(userId)
        .mutation(({ input, ctx }) =>
          createLifeOSRouter(services.lifeOS).invalidateCache(input, ctx),
        ),
      getNavigation: standardProcedure
        .input(z.void())
        .query(({ ctx }) =>
          createLifeOSRouter(services.lifeOS).getNavigation(undefined as unknown, ctx),
        ),
      updateConfig: standardProcedure
        .input(configUpdate)
        .mutation(({ input, ctx }) => createLifeOSRouter(services.lifeOS).updateConfig(input, ctx)),
      getConfig: standardProcedure
        .input(userId)
        .query(({ input, ctx }) => createLifeOSRouter(services.lifeOS).getConfig(input, ctx)),
      getCacheMetrics: standardProcedure
        .input(z.void())
        .query(({ ctx }) =>
          createLifeOSRouter(services.lifeOS).getCacheMetrics(undefined as unknown, ctx),
        ),
    }),

    // ── Dashboard (heavy tier: 20 req/min) ──────────────────────────────────
    dashboard: router({
      getDashboard: heavyProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createDashboardRouter(services.dashboard).getDashboard(input, ctx),
        ),
      getViewModel: heavyProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createDashboardRouter(services.dashboard).getViewModel(input, ctx),
        ),
      getIdentity: heavyProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createDashboardRouter(services.dashboard).getIdentity(input, ctx),
        ),
      getFocus: heavyProcedure
        .input(userId)
        .query(({ input, ctx }) => createDashboardRouter(services.dashboard).getFocus(input, ctx)),
      getExecution: heavyProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createDashboardRouter(services.dashboard).getExecution(input, ctx),
        ),
      getDecisions: heavyProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createDashboardRouter(services.dashboard).getDecisions(input, ctx),
        ),
      getInsights: heavyProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createDashboardRouter(services.dashboard).getInsights(input, ctx),
        ),
      refreshSection: heavyProcedure
        .input(sectionRefresh)
        .mutation(({ input, ctx }) =>
          createDashboardRouter(services.dashboard).refreshSection(input, ctx),
        ),
      invalidateCache: standardProcedure
        .input(userId)
        .mutation(({ input, ctx }) =>
          createDashboardRouter(services.dashboard).invalidateCache(input, ctx),
        ),
    }),

    // ── Career (standard tier: 100 req/min) ─────────────────────────────────
    career: router({
      getCareer: standardProcedure
        .input(userId)
        .query(({ input, ctx }) => createCareerRouter(services.career).getCareer(input, ctx)),
      getViewModel: standardProcedure
        .input(userId)
        .query(({ input, ctx }) => createCareerRouter(services.career).getViewModel(input, ctx)),
      getConfig: standardProcedure
        .input(userId)
        .query(({ input, ctx }) => createCareerRouter(services.career).getConfig(input, ctx)),
      invalidateCache: standardProcedure
        .input(userId)
        .mutation(({ input, ctx }) =>
          createCareerRouter(services.career).invalidateCache(input, ctx),
        ),
    }),

    // ── Learning (standard tier: 100 req/min) ───────────────────────────────
    learning: router({
      getLearning: standardProcedure
        .input(userId)
        .query(({ input, ctx }) => createLearningRouter(services.learning).getLearning(input, ctx)),
      getViewModel: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createLearningRouter(services.learning).getViewModel(input, ctx),
        ),
      getConfig: standardProcedure
        .input(userId)
        .query(({ input, ctx }) => createLearningRouter(services.learning).getConfig(input, ctx)),
      invalidateCache: standardProcedure
        .input(userId)
        .mutation(({ input, ctx }) =>
          createLearningRouter(services.learning).invalidateCache(input, ctx),
        ),
    }),

    // ── Business (standard tier: 100 req/min) ───────────────────────────────
    business: router({
      getBusiness: standardProcedure
        .input(userId)
        .query(({ input, ctx }) => createBusinessRouter(services.business).getBusiness(input, ctx)),
      getViewModel: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createBusinessRouter(services.business).getViewModel(input, ctx),
        ),
      getConfig: standardProcedure
        .input(userId)
        .query(({ input, ctx }) => createBusinessRouter(services.business).getConfig(input, ctx)),
      invalidateCache: standardProcedure
        .input(userId)
        .mutation(({ input, ctx }) =>
          createBusinessRouter(services.business).invalidateCache(input, ctx),
        ),
    }),

    // ── Marketplace (standard tier: 100 req/min) ────────────────────────────
    marketplace: router({
      getMarketplace: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createMarketplaceRouter(services.marketplace).getMarketplace(input, ctx),
        ),
      getViewModel: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createMarketplaceRouter(services.marketplace).getViewModel(input, ctx),
        ),
      getConfig: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createMarketplaceRouter(services.marketplace).getConfig(input, ctx),
        ),
      invalidateCache: standardProcedure
        .input(userId)
        .mutation(({ input, ctx }) =>
          createMarketplaceRouter(services.marketplace).invalidateCache(input, ctx),
        ),
    }),

    // ── Search (search tier: 30 req/min) ────────────────────────────────────
    search: router({
      global: searchProcedure
        .input(searchInput)
        .query(({ input, ctx }) => createSearchRouter(services.lifeOS).global(input, ctx)),
      recent: searchProcedure
        .input(userId)
        .query(({ input, ctx }) => createSearchRouter(services.lifeOS).recent(input, ctx)),
    }),

    // ── Notifications (standard tier: 100 req/min) ──────────────────────────
    notifications: router({
      list: standardProcedure
        .input(userId)
        .query(({ input, ctx }) => createNotificationRouter(services.dashboard).list(input, ctx)),
      dismiss: standardProcedure
        .input(z.object({ userId: z.string(), notificationId: z.string() }))
        .mutation(({ input, ctx }) =>
          createNotificationRouter(services.dashboard).dismiss(input, ctx),
        ),
    }),

    // ── Configuration (standard tier: 100 req/min) ──────────────────────────
    config: router({
      get: standardProcedure
        .input(userId)
        .query(({ input, ctx }) => createConfigurationRouter(services.dashboard).get(input, ctx)),
      update: standardProcedure
        .input(configUpdate)
        .mutation(({ input, ctx }) =>
          createConfigurationRouter(services.dashboard).update(input, ctx),
        ),
    }),

    // ── Metrics (standard tier: 100 req/min) ────────────────────────────────
    metrics: router({
      dashboard: standardProcedure
        .input(userId)
        .query(({ input, ctx }) => createMetricsRouter(services.dashboard).dashboard(input, ctx)),
      lifecycle: standardProcedure
        .input(userId)
        .query(({ input, ctx }) => createMetricsRouter(services.dashboard).lifecycle(input, ctx)),
      snapshot: standardProcedure
        .input(z.void())
        .query(() => createMetricsRouter(services.dashboard).snapshot()),
    }),
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
