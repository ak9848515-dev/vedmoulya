// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Router Registry
// Registers all module routers into a unified tRPC app router
// Applies rate-limit middleware per endpoint tier
// BLD-016A — API Gateway & Platform Services
// ─────────────────────────────────────────────────────────────────────────────

import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';
import { metrics } from '@vedmoulya/core';
import { runWithProviderUser } from '@vedmoulya/providers';
import type { ApiApplicationService } from './ApiApplicationService.js';
import { createLifeOSRouter } from '../routers/LifeOSRouter.js';
import { createDashboardRouter } from '../routers/DashboardRouter.js';
import { createCareerRouter } from '../routers/CareerRouter.js';
import { createLearningRouter } from '../routers/LearningRouter.js';
import { createBusinessRouter } from '../routers/BusinessRouter.js';
import { createMarketplaceRouter } from '../routers/MarketplaceRouter.js';
import { createContentAgencyRouter } from '../routers/ContentAgencyRouter.js';
import { createClientOpsRouter } from '../routers/ClientOpsRouter.js';
import { createCapabilitiesRouter } from '../routers/CapabilitiesRouter.js';
import { createProvidersRouter } from '../routers/ProvidersRouter.js';
import { createAIWorldRouter } from '../routers/AIWorldRouter.js';
import { createCapabilityMarketplaceRouter } from '../routers/CapabilityMarketplaceRouter.js';
import { createExecutionBridgeRouter } from '../routers/ExecutionBridgeRouter.js';
import { createContextRouter } from '../routers/ContextRouter.js';
import { createExecutionStrategyRouter } from '../routers/ExecutionStrategyRouter.js';
import { createOrchestratorRouter } from '../routers/OrchestratorRouter.js';
import { createFabricOrchestratorRouter } from '../routers/OrchestrationFabricRouter.js';
import { createGoalsRouter } from '../routers/GoalsRouter.js';
import { createIntelligenceRouter } from '../routers/IntelligenceRouter.js';
import { createLearningIntelligenceRouter } from '../routers/LearningIntelligenceRouter.js';
import { createEnterpriseBrainRouter, createBrainRouter } from '../routers/BrainRouter.js';
import { createKnowledgeRouter } from '../routers/KnowledgeRouter.js';
import { createMemoryIntelligenceRouter } from '../routers/MemoryIntelligenceRouter.js';
import { createOSRouter } from '../routers/OSRouter.js';
import { createAIRouter } from '../routers/AIRouter.js';
import { createRagRouter } from '../routers/RagRouter.js';
import { createLoopRouter } from '../routers/LoopRouter.js';
import { createFactoryRouter } from '../routers/FactoryRouter.js';
import { createRequirementsRouter } from '../routers/RequirementsRouter.js';
import { createExperienceRouter } from '../routers/ExperienceRouter.js';
import { createOpsRouter } from '../routers/OpsRouter.js';
import { PreviewService } from '../services/PreviewService.js';
import { createEcosystemIntelligenceRouter } from '../routers/EcosystemIntelligenceRouter.js';

import { createLiveIntelligenceBridgeRouter } from '../routers/LiveIntelligenceBridgeRouter.js';
import { createSchedulerRouter } from '../routers/SchedulerRouter.js';
import { createContextFabricRouter } from '../routers/ContextFabricRouter.js';
import { createPortalRouter } from '../routers/PortalRouter.js';
import { createHealthRouter } from '../routers/HealthRouter.js';
import { createIdentityRouter } from '../routers/IdentityRouter.js';
import { createSearchRouter } from '../routers/SearchRouter.js';
import { createNotificationRouter } from '../routers/NotificationRouter.js';
import { createConfigurationRouter } from '../routers/ConfigurationRouter.js';
import { createMetricsRouter } from '../routers/MetricsRouter.js';
import {
  createVoiceRouter,
  voiceAppendTurnInput,
  voiceAssessInput,
  voiceClearConversationInput,
  voiceCreateConversationInput,
  voiceHandleUtteranceInput,
  voiceListConversationsInput,
  voiceSensitiveDecisionInput,
  voiceStatusInput,
  voiceSynthesizeInput,
  voiceTranscribeInput,
} from '../routers/VoiceRouter.js';
import { createProactiveRouter, proactiveInputs } from '../routers/ProactiveRouter.js';
import { createFabricRouter, fabricInputs } from '../routers/FabricRouter.js';
import { createControlRouter, controlInputs } from '../routers/ControlRouter.js';
import { createWorldRouter, worldInputs } from '../routers/WorldRouter.js';
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

// ── Request Metrics Middleware (PH-002/T1 Observability) ─────────────────────
// Records per-request API latency, throughput, and error-rate metrics for the
// Prometheus exporter. Applied to every procedure via the variants below.

function createRequestMetricsMiddleware(): ReturnType<typeof t.middleware> {
  return t.middleware(async ({ next }) => {
    const start = performance.now();
    metrics.increment('api.requests.total');
    try {
      const result = await next();
      metrics.observe('api.requests.latency_ms', performance.now() - start);
      // In tRPC v11, downstream middleware/resolver errors surface as
      // `{ ok: false }` results (not thrown exceptions), so check the flag.
      if (!result.ok) {
        metrics.increment('api.requests.error');
      }
      return result;
    } catch (err) {
      metrics.increment('api.requests.error');
      metrics.observe('api.requests.latency_ms', performance.now() - start);
      throw err;
    }
  });
}

// ── Rate Limit Middleware Factory (uses t.middleware() for proper types) ─────

function createRateLimitMiddleware(tier: RateLimitConfig): ReturnType<typeof t.middleware> {
  return t.middleware(async ({ ctx, next }) => {
    // SPRINT-092A — Skip rate limiting in non-production environments. In
    // development/test, all E2E tests share a single userId (e2e-user).
    // Parallel Playwright workers exhaust the per-user heavy-tier limit
    // (20 req/min), causing spurious "Rate limit exceeded" errors on
    // dashboard and factory pages. Rate limiting is a production concern;
    // dev/test rely on the in-memory backend which has no distributed
    // safety anyway.
    if (process.env.NODE_ENV !== 'production') return next();
    const userId = ctx.userId;
    if (!(await checkRateLimitInternal(userId, tier))) {
      metrics.increment('api.ratelimit.hit');
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
    // EPIC-012A: set the provider request context so routing discovery
    // (listByCapability/listByFamily) immediately respects the user's
    // enabled-provider preference — without changing any frozen contract.
    return runWithProviderUser(ctx.userId, () => next());
  });
}

const authMiddleware = createAuthMiddleware();
const requestMetricsMiddleware = createRequestMetricsMiddleware();

// ── Procedure Variants (metrics + auth + rate limit middleware) ─────────────
// Every variant is built on the metrics-wrapped base so all gateway traffic
// contributes to api.requests.total / latency / error metrics (PH-002/T1).

const baseProcedure = t.procedure.use(requestMetricsMiddleware);

export const publicProcedure = baseProcedure;
export const standardProcedure = baseProcedure
  .use(authMiddleware)
  .use(createRateLimitMiddleware(RateLimitTiers.standard));
export const heavyProcedure = baseProcedure
  .use(authMiddleware)
  .use(createRateLimitMiddleware(RateLimitTiers.heavy));
export const searchProcedure = baseProcedure
  .use(authMiddleware)
  .use(createRateLimitMiddleware(RateLimitTiers.search));
export const healthProcedure = baseProcedure.use(createRateLimitMiddleware(RateLimitTiers.health));
export const authProcedure = baseProcedure
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

// ── Capability enums (EPIC-004 / EI-001) matching packages/capabilities ─────

const capabilityCategoryEnum = z.enum([
  'content',
  'research',
  'writing',
  'review',
  'seo',
  'publishing',
  'analytics',
  'memory',
  'knowledge',
  'context',
  'ocr',
  'vision',
  'translation',
  'validation',
  'speech',
  'platform',
]);

const capabilityStatusEnum = z.enum([
  'design',
  'draft',
  'testing',
  'active',
  'deprecated',
  'archived',
]);

const capabilityBusinessModuleEnum = z.enum([
  'content-agency',
  'learning',
  'career',
  'marketing',
  'business',
  'platform',
]);

const capabilityAIFeatureEnum = z.enum([
  'reasoning',
  'coding',
  'vision',
  'embeddings',
  'summarization',
  'classification',
  'translation',
  'speech',
  'image_understanding',
  'general_conversation',
  'content_generation',
]);

// ── Provider enums (EPIC-004 / EI-002) matching packages/providers ──────────

const providerFamilyEnum = z.enum([
  'openai',
  'anthropic',
  'google',
  'deepseek',
  'openrouter',
  'ollama',
  'mock',
  'custom',
]);

const providerLifecycleEnum = z.enum([
  'draft',
  'testing',
  'active',
  'maintenance',
  'deprecated',
  'archived',
]);

const providerModalityEnum = z.enum([
  'text-in',
  'text-out',
  'image-in',
  'image-out',
  'audio-in',
  'audio-out',
]);

const providerQualityTierEnum = z.enum(['premium', 'standard', 'economy', 'free']);
const providerCostTierEnum = z.enum(['free', 'low', 'medium', 'high']);
const providerFeatureEnum = z.enum(['streaming', 'vision', 'function_calling', 'embeddings']);

const providerBenchmarkCategoryEnum = z.enum([
  'general_knowledge',
  'reasoning',
  'coding',
  'mathematics',
  'long_context',
  'instruction_following',
  'multimodal',
  'translation',
  'summarization',
  'creative_writing',
  'tool_use',
]);

const providerBenchmarkDifficultyEnum = z.enum(['basic', 'intermediate', 'advanced', 'expert']);

const providerBenchmarkQueryInput = z.object({
  userId: z.string().min(1),
  category: providerBenchmarkCategoryEnum.optional(),
  capability: capabilityAIFeatureEnum.optional(),
  difficulty: providerBenchmarkDifficultyEnum.optional(),
});

const providerModelInput = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  contextLength: z.number().int().positive(),
  maxOutputTokens: z.number().int().min(0),
  streaming: z.boolean(),
  vision: z.boolean(),
  functionCalling: z.boolean(),
  embeddings: z.boolean(),
  reasoning: z.boolean(),
  coding: z.boolean(),
  creativeWriting: z.boolean(),
  translation: z.boolean(),
  image: z.boolean(),
  audio: z.boolean(),
  video: z.boolean(),
  modalities: z.array(providerModalityEnum),
  capabilities: z.array(capabilityAIFeatureEnum),
});

const providerMatrixInput = z.object({
  capability: capabilityAIFeatureEnum,
  quality: z.number().min(0).max(1),
  expectedCostUsd: z.number().min(0),
  expectedLatencyMs: z.number().min(0),
  expectedInputTokens: z.number().min(0),
  expectedOutputTokens: z.number().min(0),
  confidence: z.number().min(0).max(1),
  historicalSuccess: z.number().min(0).max(1),
  qualityTier: providerQualityTierEnum,
});

const providerRegisterInput = z.object({
  userId: z.string().min(1),
  id: z.string().min(1),
  family: providerFamilyEnum,
  name: z.string().min(1).max(80),
  description: z.string().min(1),
  owner: z.string().min(1),
  models: z.array(providerModelInput).min(1),
  capabilities: z.array(capabilityAIFeatureEnum).optional(),
  supportedModalities: z.array(providerModalityEnum).optional(),
  inputPerMillionTokens: z.number().min(0).optional(),
  outputPerMillionTokens: z.number().min(0).optional(),
  currency: z.string().optional(),
  costTier: providerCostTierEnum.optional(),
  p50Ms: z.number().min(0).optional(),
  p95Ms: z.number().min(0).optional(),
  requestsPerMinute: z.number().int().min(0).optional(),
  tokensPerMinute: z.number().int().min(0).optional(),
  requestsPerDay: z.number().int().min(0).optional(),
  maxConcurrentRequests: z.number().int().min(0).optional(),
  availability: z.number().min(0).max(1).optional(),
  tags: z.array(z.string()).optional(),
  documentationUrl: z.string().optional(),
  matrix: z.array(providerMatrixInput).optional(),
});

const providerUpdateInput = z.object({
  userId: z.string().min(1),
  id: z.string().min(1),
  name: z.string().min(1).max(80).optional(),
  description: z.string().optional(),
  owner: z.string().optional(),
  tags: z.array(z.string()).optional(),
  documentationUrl: z.string().optional(),
  inputPerMillionTokens: z.number().min(0).optional(),
  outputPerMillionTokens: z.number().min(0).optional(),
  currency: z.string().optional(),
  costTier: providerCostTierEnum.optional(),
  p50Ms: z.number().min(0).optional(),
  p95Ms: z.number().min(0).optional(),
  requestsPerMinute: z.number().int().min(0).optional(),
  tokensPerMinute: z.number().int().min(0).optional(),
  requestsPerDay: z.number().int().min(0).optional(),
  maxConcurrentRequests: z.number().int().min(0).optional(),
  availability: z.number().min(0).max(1).optional(),
});

const providerSearchInput = z.object({
  userId: z.string().min(1),
  query: z.string().max(200).optional(),
  families: z.array(providerFamilyEnum).optional(),
  lifecycleStatuses: z.array(providerLifecycleEnum).optional(),
  capabilities: z.array(capabilityAIFeatureEnum).optional(),
  modalities: z.array(providerModalityEnum).optional(),
  tags: z.array(z.string()).optional(),
  minHealthScore: z.number().min(0).max(1).optional(),
  minContextLength: z.number().int().positive().optional(),
  feature: providerFeatureEnum.optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const providerHealthSampleInput = z.object({
  userId: z.string().min(1),
  id: z.string().min(1),
  ok: z.boolean(),
  latencyMs: z.number().min(0).optional(),
  quotaUsedPercent: z.number().min(0).max(100).optional(),
  rateLimitRemaining: z.number().int().min(0).optional(),
  rateLimitResetAt: z.string().nullable().optional(),
});

// ── Provider Intelligence schemas (EPIC-012A — Phases 7–11) ──────────────
// Auto-derived intelligence profiles (provenance-carrying), resource
// classification, hardware-aware local fit, and local-runtime discovery.
// All are read-only operator-safe queries over registry facts — nothing is
// fabricated, and live local discovery fails safe when unreachable.

const providerIntelligenceProfileInput = z.object({
  userId: z.string().min(1),
  id: z.string().min(1),
});

// ── Provider Intelligence refresh schemas (EPIC-012B) ────────────────────
// getIntelligenceStatus is a cache-first read (stale-aware);
// refreshIntelligence is an explicit safe re-derivation (mutation). Both
// carry the session userId so the gateway IDOR guard applies.

const providerIntelligenceStatusInput = z.object({
  userId: z.string().min(1),
  id: z.string().min(1),
  maxAgeMs: z
    .number()
    .int()
    .min(1)
    .max(30 * 24 * 60 * 60 * 1000)
    .optional(),
});

const providerRefreshIntelligenceInput = z.object({
  userId: z.string().min(1),
  id: z.string().min(1),
});

const providerResourceFactsInput = z.object({
  userId: z.string().min(1),
  family: providerFamilyEnum,
  inputPerMillionTokens: z.number().min(0),
  outputPerMillionTokens: z.number().min(0),
  costTier: providerCostTierEnum,
  tags: z.array(z.string()).default([]),
  localFamilies: z.array(z.string()).optional(),
  aggregatorFamilies: z.array(z.string()).optional(),
});

const providerHardwareSpecInput = z.object({
  userId: z.string().min(1),
  hardware: z.object({
    ramGb: z.number().min(0).optional(),
    vramGb: z.number().min(0).optional(),
    hasGpu: z.boolean().optional(),
    cpuThreads: z.number().int().min(1).optional(),
    storageGb: z.number().min(0).optional(),
  }),
  models: z
    .array(
      z.object({
        modelId: z.string().min(1),
        name: z.string().min(1),
        estimatedSizeGb: z.number().min(0),
        quantizationFactor: z.number().min(0.1).max(3).optional(),
      }),
    )
    .min(1),
});

const providerLocalDiscoveryInput = z.object({
  userId: z.string().min(1),
  runtime: z.enum(['ollama', 'lm-studio', 'openai-compatible']),
  endpoint: z.string().max(500).optional(),
});

// ── EPIC-012A Provider Experience schemas (Phases 4–6 / 12–17) ─────────────
// Owner-scoped preferences (enabled set / preferred model / budget policy),
// the AI Providers overview view model, usage & economics, and the
// "Why this model?" model-selection explanation. Every input carries the
// session userId so the gateway IDOR guard applies.

const providerPreferencesInput = z.object({
  userId: z.string().min(1),
});

const providerSetPreferencesInput = z.object({
  userId: z.string().min(1),
  disabledProviderIds: z.array(z.string().min(1)).optional(),
  preferredProviderId: z.string().min(1).nullable().optional(),
  preferredModelId: z.string().min(1).nullable().optional(),
  budgetPolicy: z.enum(['never_paid', 'ask_before_paid', 'allow_within_budget']).optional(),
  budgets: z
    .object({
      perRequestUsd: z.number().min(0).optional(),
      dailyUsd: z.number().min(0).optional(),
      monthlyUsd: z.number().min(0).optional(),
      monthlyTokenBudget: z.number().int().min(0).optional(),
    })
    .optional(),
});

const providerSetEnabledInput = z.object({
  userId: z.string().min(1),
  providerId: z.string().min(1),
  enabled: z.boolean(),
});

const providerExplainSelectionInput = z.object({
  userId: z.string().min(1),
  capability: capabilityAIFeatureEnum,
  estimatedInputTokens: z.number().int().min(1).max(1000000).optional(),
  requestedOutputTokens: z.number().int().min(1).max(64000).optional(),
  precision: z.enum(['standard', 'high']).optional(),
  evidenceRequired: z.boolean().optional(),
  freePreferred: z.boolean().optional(),
  taskComplexity: z.enum(['simple', 'moderate', 'complex']).optional(),
});

// ── Context enums (EPIC-004 / EI-003) matching packages/context ─────────────

const contextSourceEnum = z.enum([
  'conversation_memory',
  'enterprise_memory',
  'knowledge_base',
  'business_rules',
  'client_data',
  'project_data',
  'capability_metadata',
  'documents',
  'prompt_templates',
  'historical_success',
  'benchmark_knowledge',
]);

const contextCategoryEnum = z.enum([
  'user_profile',
  'conversation',
  'memory',
  'knowledge',
  'business',
  'client',
  'project',
  'capability',
  'document',
  'prompt',
  'strategy',
  'brand',
  'market',
  'system',
]);

const contextPriorityEnum = z.enum(['critical', 'high', 'medium', 'low', 'background']);
const compressionStrategyEnum = z.enum([
  'extractive',
  'abstractive',
  'summary',
  'top_k',
  'threshold',
  'hybrid',
]);

const contextQueryInput = z.object({
  userId: z.string().min(1),
  query: z.string().max(500).optional(),
  sources: z.array(contextSourceEnum).optional(),
  categories: z.array(contextCategoryEnum).optional(),
  priorities: z.array(contextPriorityEnum).optional(),
  capabilities: z.array(capabilityAIFeatureEnum).optional(),
  tags: z.array(z.string()).optional(),
  confidence: z.object({ min: z.number().min(0).max(1), max: z.number().min(0).max(1) }).optional(),
  importance: z.object({ min: z.number().min(0).max(1), max: z.number().min(0).max(1) }).optional(),
  timeRange: z.object({ start: z.string(), end: z.string() }).optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const contextRegisterInput = z.object({
  userId: z.string().min(1),
  source: contextSourceEnum,
  category: contextCategoryEnum,
  priority: contextPriorityEnum,
  importance: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  content: z.string().min(1),
  language: z.string().optional(),
  tags: z.array(z.string()).optional(),
  business: z.array(z.string()).optional(),
  capability: z.array(capabilityAIFeatureEnum).optional(),
  metadata: z.record(z.unknown()).optional(),
  sourceId: z.string().min(1),
});

const contextBulkRegisterInput = z.object({
  userId: z.string().min(1),
  items: z.array(contextRegisterInput.omit({ userId: true })).min(1),
});

const contextRankInput = contextQueryInput.extend({
  capability: capabilityAIFeatureEnum,
  requestIntent: z.string().max(300).optional(),
  businessContext: z.array(z.string()).optional(),
  maxResults: z.number().int().min(1).max(100).optional(),
});

const contextCompressInput = contextQueryInput.extend({
  targetTokens: z.number().int().min(100).max(100000),
  strategy: compressionStrategyEnum.optional(),
  preserveCritical: z.boolean().optional(),
  minConfidence: z.number().min(0).max(1).optional(),
});

const contextAssembleInput = contextQueryInput.extend({
  goal: z.string().min(1).max(500),
  capability: capabilityAIFeatureEnum,
  prompt: z.string().min(1),
  requestIntent: z.string().max(300).optional(),
  businessContext: z.array(z.string()).optional(),
  targetTokens: z.number().int().min(100).max(100000).optional(),
  strategy: compressionStrategyEnum.optional(),
});

const contextExplainInput = z.object({
  userId: z.string().min(1),
  id: z.string().min(1),
  capability: capabilityAIFeatureEnum.optional(),
  originalTokens: z.number().int().min(0).optional(),
  compressedTokens: z.number().int().min(0).optional(),
});

// ── Execution Strategy enums (EPIC-004 / EI-004) matching packages/execution-strategy ──

const strategyPriorityEnum = z.enum(['critical', 'high', 'medium', 'low', 'background']);
const executionModeEnum = z.enum(['sequential', 'parallel', 'hybrid', 'pipeline']);

const strategyCreateInput = z.object({
  userId: z.string().min(1),
  goalId: z.string().min(1),
  goal: z.string().min(1).max(500),
  business: z.array(z.string()).default([]),
  priority: strategyPriorityEnum,
  qualityTier: providerQualityTierEnum,
  maxCostUsd: z.number().min(0).optional(),
  maxLatencyMs: z.number().int().min(0).optional(),
  maxTokens: z.number().int().min(0).optional(),
  availableProviders: z.array(providerFamilyEnum).optional(),
});

const strategySearchInput = z.object({
  userId: z.string().min(1),
  query: z.string().max(200).optional(),
  priority: strategyPriorityEnum.optional(),
  executionMode: executionModeEnum.optional(),
  capabilities: z.array(capabilityAIFeatureEnum).optional(),
  business: z.array(z.string()).optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const strategyEstimateInput = z.object({
  userId: z.string().min(1),
  goal: z.string().min(1).max(500),
  tier: providerQualityTierEnum,
  maxTokens: z.number().int().min(0).optional(),
  maxCostUsd: z.number().min(0).optional(),
  maxLatencyMs: z.number().int().min(0).optional(),
});

// ── Execution Orchestrator enums (EPIC-004 / EI-005) matching packages/orchestrator ──

const orchestratorFlowTypeEnum = z.enum(['sequential', 'parallel', 'optional', 'conditional']);

const orchestratorGraphStepInput = z.object({
  stepId: z.string().min(1),
  capability: capabilityAIFeatureEnum,
  label: z.string().min(1),
  flowType: orchestratorFlowTypeEnum,
  weight: z.number().min(0).max(1),
  eligibleFamilies: z.array(providerFamilyEnum).default([]),
});

const orchestratorBuildInput = z.object({
  userId: z.string().min(1),
  strategyId: z.string().min(1),
  goalId: z.string().min(1),
  goal: z.string().min(1).max(500),
  steps: z.array(orchestratorGraphStepInput).min(1),
  mode: executionModeEnum,
  priority: strategyPriorityEnum,
  maxRetries: z.number().int().min(0).optional(),
  retryDelayMs: z.number().int().min(0).optional(),
  maxLatencyMs: z.number().int().min(0).optional(),
  expectedTokens: z.number().int().min(0).optional(),
  maxCostUsd: z.number().min(0).optional(),
});

const orchestratorSessionIdInput = z.object({
  userId: z.string().min(1),
  sessionId: z.string().min(1),
});

const orchestratorGraphIdInput = z.object({
  userId: z.string().min(1),
  graphId: z.string().min(1),
});

// ── Goal & Task Intelligence enums (EPIC-004 / EI-006) matching packages/goals ──

const goalCategoryEnum = z.enum([
  'business',
  'personal',
  'learning',
  'career',
  'revenue',
  'project',
  'health',
  'custom',
]);

const goalStatusEnum = z.enum([
  'proposed',
  'scored',
  'accepted',
  'active',
  'blocked',
  'completed',
  'cancelled',
  'archived',
]);

const goalSuccessCriterionInput = z.object({
  definition: z.string().min(1),
  validation: z.string().optional(),
  completionCriteria: z.array(z.string()).optional(),
  expectedOutcome: z.string().optional(),
});

const goalCreateInput = z.object({
  userId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  category: goalCategoryEnum.optional(),
  business: z.array(z.string()).optional(),
  priority: strategyPriorityEnum.optional(),
  urgency: z.number().min(0).max(1).optional(),
  importance: z.number().min(0).max(1).optional(),
  estimatedEffort: z.number().min(0).optional(),
  tags: z.array(z.string()).optional(),
  parentGoalId: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  successCriteria: z.array(goalSuccessCriterionInput).optional(),
});

const goalSearchInput = z.object({
  userId: z.string().min(1),
  query: z.string().max(200).optional(),
  categories: z.array(goalCategoryEnum).optional(),
  statuses: z.array(goalStatusEnum).optional(),
  priorities: z.array(strategyPriorityEnum).optional(),
  business: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const goalIdInput = z.object({
  userId: z.string().min(1),
  goalId: z.string().min(1),
});

const goalProblemInput = z.object({
  userId: z.string().min(1),
  problem: z.string().min(5).max(4000),
});

const goalLifecycleInput = z.object({
  userId: z.string().min(1),
  goalId: z.string().min(1),
  command: z.discriminatedUnion('type', [
    z.object({ type: z.literal('score') }),
    z.object({ type: z.literal('accept') }),
    z.object({ type: z.literal('activate') }),
    z.object({ type: z.literal('block'), reason: z.string().min(1) }),
    z.object({ type: z.literal('unblock') }),
    z.object({ type: z.literal('complete') }),
    z.object({ type: z.literal('cancel'), reason: z.string().min(1) }),
    z.object({ type: z.literal('archive') }),
  ]),
});

// ── Learning Intelligence enums (EPIC-004 / EI-007) matching packages/learning-intelligence ──

const learningCategoryEnum = z.enum([
  'provider',
  'context',
  'capability',
  'prompt',
  'budget',
  'quality',
  'execution',
  'business',
  'user_preference',
  'failure',
]);

const learningOutcomeEnum = z.enum(['success', 'failure']);

const learningSourceRefInput = z.object({
  sourceType: z.enum(['goal', 'task', 'session', 'pipeline', 'manual']),
  sourceId: z.string().min(1),
});

const learningEventInput = z.object({
  userId: z.string().min(1),
  category: learningCategoryEnum,
  entityType: z.string().min(1).max(50),
  entityId: z.string().min(1).max(200),
  entityLabel: z.string().max(200).optional(),
  outcome: learningOutcomeEnum,
  confidence: z.number().min(0).max(1),
  costUsd: z.number().min(0),
  latencyMs: z.number().min(0),
  accuracy: z.number().min(0).max(1),
  retries: z.number().int().min(0),
  quality: z.number().min(0).max(1),
  feedback: z.number().min(0).max(1).optional(),
  businessOutcome: z.number().min(0).max(1).optional(),
  sourceRef: learningSourceRefInput.optional(),
  metadata: z.record(z.unknown()).optional(),
  occurredAt: z.string().optional(),
});

const learningEventQueryInput = z.object({
  userId: z.string().min(1),
  category: learningCategoryEnum.optional(),
  outcome: learningOutcomeEnum.optional(),
  entityId: z.string().optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const learningEventIdInput = z.object({
  userId: z.string().min(1),
  eventId: z.string().min(1),
});

const learningTimelineInput = z.object({
  userId: z.string().min(1),
  limit: z.number().int().min(1).max(200).optional(),
});

const learningCategoryQueryInput = z.object({
  userId: z.string().min(1),
  category: learningCategoryEnum.optional(),
});

const learningRecommendationIdInput = z.object({
  userId: z.string().min(1),
  recommendationId: z.string().min(1),
});

const learningDecisionInput = z.object({
  userId: z.string().min(1),
  recommendationId: z.string().min(1),
  actor: z.string().min(1).max(120),
  note: z.string().max(500).optional(),
});

// ── Enterprise Brain enums (EPIC-004 / EI-008) matching packages/enterprise-brain ──

const brainDecisionTypeEnum = z.enum([
  'goal_priority',
  'task_priority',
  'execution_order',
  'capability_selection',
  'provider_selection',
  'context_strategy',
  'execution_strategy',
  'budget_strategy',
  'quality_threshold',
  'risk_assessment',
  'retry_policy',
  'fallback_policy',
  'learning_feedback',
  'business_objectives',
]);

const brainDecisionStatusEnum = z.enum([
  'proposed',
  'approved',
  'rejected',
  'handed_off',
  'superseded',
]);

const brainDecideGoalInput = z.object({
  userId: z.string().min(1),
  goalId: z.string().min(1),
  budgetUsd: z.number().min(0).optional(),
  actor: z.string().max(120).optional(),
});

const brainPlanIdInput = z.object({
  userId: z.string().min(1),
  planId: z.string().min(1),
});

const brainListPlansInput = z.object({
  userId: z.string().min(1),
  goalId: z.string().optional(),
});

const brainListDecisionsInput = z.object({
  userId: z.string().min(1),
  type: brainDecisionTypeEnum.optional(),
  status: brainDecisionStatusEnum.optional(),
  goalId: z.string().optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const brainDecisionIdInput = z.object({
  userId: z.string().min(1),
  decisionId: z.string().min(1),
});

const brainTimelineInput = z.object({
  userId: z.string().min(1),
  limit: z.number().int().min(1).max(200).optional(),
});

const brainDecisionActionInput = z.object({
  userId: z.string().min(1),
  decisionId: z.string().min(1),
  actor: z.string().min(1).max(120),
  note: z.string().max(500).optional(),
});

const brainPlanActionInput = z.object({
  userId: z.string().min(1),
  planId: z.string().min(1),
  actor: z.string().min(1).max(120),
  note: z.string().max(500).optional(),
});

// ── EPIC-016 The VedMoulya Brain input schemas ──────────────────────────────

const brainCreateTaskInput = z.object({
  userId: z.string().min(1),
  input: z.string().min(3).max(4000),
});

const brainTaskIdInput = z.object({
  userId: z.string().min(1),
  taskId: z.string().min(1),
});

const brainApprovalInput = z.object({
  userId: z.string().min(1),
  taskId: z.string().min(1),
  action: z.string().min(1).max(120),
});

const brainOutcomeInput = z.object({
  userId: z.string().min(1),
  taskId: z.string().min(1),
  outputAccepted: z.boolean(),
  // EPIC-020 (Outcome & Revenue layer) — 3-value satisfaction §10.
  satisfaction: z.enum(['YES', 'PARTIALLY', 'NO', 'UNKNOWN']).optional(),
});

// SPRINT-025 — user correction loop. Bounded text (no sensitive data),
// explicit target, optional provider/capability/task scope. The correction
// enters the EXISTING preference + experience ledgers as EXPLICIT evidence.
const brainCorrectionInput = z.object({
  userId: z.string().min(1),
  statement: z.string().min(3).max(500),
  target: z.enum(['approach', 'provider', 'result', 'preference']),
  providerId: z.string().min(1).max(120).optional(),
  capability: z.string().min(1).max(80).optional(),
  taskId: z.string().min(1).max(120).optional(),
});

// ── EPIC-020 (Outcome & Revenue layer) — Daily Outcome Engine §8 ──
const brainDailyPrioritiesInput = z.object({
  userId: z.string().min(1),
  limit: z.number().int().min(1).max(10).optional(),
});

// ── EPIC-020 Continuous Intelligence input schemas (mission §3/§8/§12/§13) ──

const brainOpportunityStatusEnum = z.enum(['NEW', 'RECOMMENDED', 'ACCEPTED', 'DISMISSED']);
const brainIntelligenceEventStatusEnum = z.enum(['NEW', 'REVIEWED', 'RECOMMENDED', 'DISMISSED']);

const brainOpportunityInput = z.object({
  userId: z.string().min(1),
  opportunityId: z.string().min(1),
  status: brainOpportunityStatusEnum,
});

const brainIntelligenceEventInput = z.object({
  userId: z.string().min(1),
  eventId: z.string().min(1),
  status: brainIntelligenceEventStatusEnum,
});

const brainProviderScoresInput = z.object({
  userId: z.string().min(1),
  capability: z.string().min(1),
});

// ── EPIC-015 VedMoulya Intelligence input schemas ──────────────────────────

const githubPermissionScopeEnum = z.enum([
  'public_metadata',
  'public_repos_read',
  'private_repos_read',
  'repos_write',
  'orgs_read',
]);

const githubConnectInput = z.object({
  userId: z.string().min(1),
  scopes: z.array(githubPermissionScopeEnum).max(6),
  repoAccessExplicit: z.boolean(),
  writeConsent: z.boolean(),
});

const githubCompleteAuthInput = z.object({
  userId: z.string().min(1),
  code: z.string().min(1).max(200),
  state: z.string().min(1).max(200),
});

const capabilityIdEnum = z.enum([
  'TEXT_GENERATION',
  'REASONING',
  'CODING',
  'RESEARCH',
  'RAG',
  'VISION',
  'IMAGE_GENERATION',
  'VIDEO_GENERATION',
  'VIDEO_EDITING',
  'AUDIO_GENERATION',
  'TEXT_TO_SPEECH',
  'SPEECH_TO_TEXT',
  'MUSIC',
  'AVATAR',
  'TRANSLATION',
  'DOCUMENT_PROCESSING',
  'EMBEDDINGS',
  'WEB_RESEARCH',
  'BROWSER_AUTOMATION',
  'CODE_EXECUTION',
  'DEPLOYMENT',
]);

const intelligenceCapabilityInput = z.object({
  userId: z.string().min(1),
  capability: capabilityIdEnum,
});

const intelligenceBetterOptionInput = z.object({
  userId: z.string().min(1),
  capability: capabilityIdEnum,
  objective: z.string().min(1).max(2000),
  domain: z.string().min(1).max(120),
  qualityTarget: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  privacyRequirement: z.enum(['PRIVATE', 'STANDARD']),
});

const intelligenceResourceInput = z.object({
  userId: z.string().min(1),
  resourceId: z.string().min(1).max(200),
});

const intelligenceLicenseInput = z.object({
  userId: z.string().min(1),
  license: z.string().max(120).optional(),
  modelLicense: z.string().max(120).optional(),
});

const intelligenceAcquisitionInput = z.object({
  userId: z.string().min(1),
  repository: z.string().min(1).max(200),
  visibility: z.enum(['public', 'private']),
  license: z.string().max(120).optional(),
  relevance: z.array(z.string().min(1)).max(20),
  repoReadAuthorized: z.boolean(),
  repositoryFacts: z.object({
    installScripts: z.array(z.string()).max(20).default([]),
    credentialCollection: z.boolean().default(false),
    secretExposure: z.boolean().default(false),
    arbitraryCommandExecution: z.boolean().default(false),
    remoteCodeExecutionPaths: z.boolean().default(false),
    sandboxAvailable: z.boolean().default(true),
  }),
});

const intelligenceRepositoryInput = z.object({
  userId: z.string().min(1),
  repository: z.string().min(1).max(200),
});

const intelligenceRecommendationActionEnum = z.enum([
  'use_recommended',
  'continue_with_current',
  'review_details',
  'dont_suggest_again',
  'review_and_configure',
  'ignore',
  'download',
  'open_repository',
]);

const intelligenceRecommendationInput = z.object({
  userId: z.string().min(1),
  recommendationId: z.string().min(1).max(200),
  action: intelligenceRecommendationActionEnum,
});

const intelligenceNotificationReadInput = z.object({
  userId: z.string().min(1),
  id: z.string().min(1).max(200),
});

// ── Live Intelligence Bridge schemas (EPIC-017) ───────────────────────────

const bridgeLoopInput = z.object({
  userId: z.string().min(1),
  loopId: z.string().min(1).max(64),
});

// ── EPIC-018 — AI World Scheduler enums (matching scheduler-types) ──────────
const discoveryJobCategoryEnum = z.enum([
  'CRITICAL_PROVIDER_CHANGE',
  'PROVIDER_MODEL_DISCOVERY',
  'GITHUB_DISCOVERY',
  'FREE_AI_RESOURCE_DISCOVERY',
  'LOCAL_MODEL_DISCOVERY',
  'AI_NEWS_DISCOVERY',
  'ECOSYSTEM_DEEP_SCAN',
]);

const scheduleFrequencyEnum = z.enum(['EVERY_6_HOURS', 'DAILY', 'WEEKLY']);

const bridgeRecommendationInput = z.object({
  userId: z.string().min(1),
  loopId: z.string().min(1).max(64),
  recommendationId: z.string().min(1).max(200),
});

const bridgeNotificationKindEnum = z.enum([
  'NEW_MODEL',
  'BETTER_MODEL',
  'FREE_QUOTA_AVAILABLE',
  'FREE_QUOTA_CHANGED',
  'PROVIDER_DEGRADED',
  'NEW_GITHUB_PROJECT',
  'GITHUB_PROJECT_ABANDONED',
  'SECURITY_CHANGE',
  'NEW_LOCAL_MODEL',
  'BETTER_CAPABILITY',
  'PRICE_CHANGE',
  'MODEL_DEPRECATED',
]);

const bridgeNotificationInput = z.object({
  userId: z.string().min(1),
  loopId: z.string().min(1).max(64),
  kind: bridgeNotificationKindEnum,
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(1000),
  relevance: z.number().min(0).max(100),
});

// ── Enterprise Knowledge Intelligence enums (EPIC-004 / EI-009) matching packages/knowledge-intelligence ──

const knowledgeCategoryEnum = z.enum([
  'business',
  'technical',
  'user',
  'project',
  'ai',
  'sap',
  'client',
  'domain',
  'policy',
  'document',
  'api',
  'architecture',
  'learning',
  'execution',
]);

const knowledgeSourceTypeEnum = z.enum([
  'document',
  'api',
  'architecture',
  'conversation',
  'observation',
  'export',
  'manual',
  'generated',
  'system',
  'report',
  'repository',
  'database',
]);

const knowledgeLifecycleEnum = z.enum(['draft', 'review', 'active', 'deprecated', 'archived']);
const knowledgeValidationEnum = z.enum(['unvalidated', 'pending', 'validated', 'failed']);
const knowledgeConsumerTypeEnum = z.enum(['engine', 'module', 'user', 'system']);

const knowledgeRelationshipTypeEnum = z.enum([
  'parent',
  'child',
  'depends_on',
  'related_to',
  'implements',
  'consumes',
  'produces',
  'supersedes',
  'uses',
  'owned_by',
]);

const knowledgeConfidenceInput = z
  .object({
    score: z.number().min(0).max(1).optional(),
    factors: z.array(z.string().max(200)).max(20).optional(),
  })
  .optional();

const knowledgeCitationInput = z.object({
  sourceId: z.string().min(1).max(300),
  sourceTitle: z.string().min(1).max(300),
  reference: z.string().min(1).max(500),
  sourceType: knowledgeSourceTypeEnum.optional(),
});

const knowledgeCreateInput = z.object({
  userId: z.string().min(1),
  title: z.string().min(3).max(200),
  description: z.string().min(1).max(10000),
  source: z.string().min(1).max(300),
  sourceType: knowledgeSourceTypeEnum,
  owner: z.string().min(1).max(120),
  category: knowledgeCategoryEnum,
  tags: z.array(z.string().min(1).max(60)).max(50).optional(),
  confidence: knowledgeConfidenceInput,
  citations: z.array(knowledgeCitationInput).max(20).optional(),
  actor: z.string().max(120).optional(),
  enrich: z.boolean().optional(),
});

const knowledgeUpdateInput = z.object({
  userId: z.string().min(1),
  knowledgeId: z.string().min(1),
  title: z.string().min(3).max(200).optional(),
  description: z.string().min(1).max(10000).optional(),
  source: z.string().min(1).max(300).optional(),
  sourceType: knowledgeSourceTypeEnum.optional(),
  owner: z.string().min(1).max(120).optional(),
  category: knowledgeCategoryEnum.optional(),
  tags: z.array(z.string().min(1).max(60)).max(50).optional(),
  confidence: knowledgeConfidenceInput,
  actor: z.string().max(120).optional(),
  version: z.boolean().optional(),
});

const knowledgeIdInput = z.object({
  userId: z.string().min(1),
  knowledgeId: z.string().min(1),
});

const knowledgeListInput = z.object({
  userId: z.string().min(1),
  category: knowledgeCategoryEnum.optional(),
  sourceType: knowledgeSourceTypeEnum.optional(),
  lifecycleStatus: knowledgeLifecycleEnum.optional(),
  validationStatus: knowledgeValidationEnum.optional(),
  owner: z.string().optional(),
  tag: z.string().optional(),
  minTrust: z.number().min(0).max(1).optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const knowledgeSearchInput = z.object({
  userId: z.string().min(1),
  query: z.string().max(500).optional(),
  category: knowledgeCategoryEnum.optional(),
  sourceType: knowledgeSourceTypeEnum.optional(),
  lifecycleStatus: knowledgeLifecycleEnum.optional(),
  validationStatus: knowledgeValidationEnum.optional(),
  tags: z.array(z.string().min(1)).max(30).optional(),
  relationshipType: knowledgeRelationshipTypeEnum.optional(),
  relationshipTargetId: z.string().optional(),
  dependencyTargetId: z.string().optional(),
  consumerType: knowledgeConsumerTypeEnum.optional(),
  minTrust: z.number().min(0).max(1).optional(),
  versionNumber: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

const knowledgeValidateInput = z.object({
  userId: z.string().min(1),
  knowledgeId: z.string().min(1),
  actor: z.string().min(1).max(120),
});

const knowledgeVersionInput = z.object({
  userId: z.string().min(1),
  knowledgeId: z.string().min(1),
  changeSummary: z.string().min(1).max(500),
  actor: z.string().min(1).max(120),
});

const knowledgeDiffInput = z.object({
  userId: z.string().min(1),
  knowledgeId: z.string().min(1),
  fromVersion: z.number().int().min(1).optional(),
  toVersion: z.number().int().min(1).optional(),
});

const knowledgeVersionNumberInput = z.object({
  userId: z.string().min(1),
  knowledgeId: z.string().min(1),
  versionNumber: z.number().int().min(1),
});

const knowledgeRelateInput = z.object({
  userId: z.string().min(1),
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  type: knowledgeRelationshipTypeEnum,
  weight: z.number().min(0).max(1).optional(),
  actor: z.string().min(1).max(120),
  note: z.string().max(500).optional(),
});

const knowledgeRelationshipQueryInput = z.object({
  userId: z.string().min(1),
  type: knowledgeRelationshipTypeEnum.optional(),
});

const knowledgeGraphInput = z.object({
  userId: z.string().min(1),
  knowledgeId: z.string().min(1),
  maxDepth: z.number().int().min(1).max(10).optional(),
});

const knowledgeShortestPathInput = z.object({
  userId: z.string().min(1),
  fromId: z.string().min(1),
  toId: z.string().min(1),
});

const knowledgeConsumerUsageInput = z.object({
  userId: z.string().min(1),
  knowledgeId: z.string().min(1),
  consumerId: z.string().max(120).optional(),
  consumerType: knowledgeConsumerTypeEnum,
  consumerLabel: z.string().min(1).max(200),
  actor: z.string().max(120).optional(),
});

const knowledgeLifecycleInput = z.object({
  userId: z.string().min(1),
  knowledgeId: z.string().min(1),
  to: knowledgeLifecycleEnum,
  actor: z.string().min(1).max(120),
  note: z.string().max(500).optional(),
});

const knowledgeTimelineInput = z.object({
  userId: z.string().min(1),
  limit: z.number().int().min(1).max(200).optional(),
});

// ── Enterprise Memory Intelligence enums (EPIC-004 / EI-010) matching packages/memory-intelligence ──

const memoryTypeEnum = z.enum([
  'working',
  'session',
  'project',
  'business',
  'capability',
  'provider',
  'execution',
  'decision',
  'learning',
  'context',
  'user_preference',
  'failure',
  'success',
  'long_term',
]);

const memorySourceTypeEnum = z.enum([
  'event',
  'goal',
  'task',
  'capability',
  'provider',
  'project',
  'user',
  'decision',
  'execution',
  'learning',
  'context',
  'business',
  'system',
  'manual',
  'observation',
]);

const memoryLifecycleEnum = z.enum([
  'captured',
  'validated',
  'consolidated',
  'ranked',
  'compressed',
  'active',
  'archived',
  'expired',
]);

const memoryCompressionEnum = z.enum(['raw', 'compressed', 'summarized', 'collapsed']);

const memoryRetentionEnum = z.enum([
  'ephemeral',
  'short_term',
  'medium_term',
  'long_term',
  'permanent',
]);

const memoryRelationshipTypeEnum = z.enum([
  'recalls',
  'follows',
  'precedes',
  'supports',
  'contradicts',
  'supersedes',
  'depends_on',
  'similar_to',
  'refines',
  'produced_by',
]);

const memoryConsumerTypeEnum = z.enum(['engine', 'module', 'user', 'system']);

const memoryConfidenceInput = z
  .object({
    score: z.number().min(0).max(1).optional(),
    factors: z.array(z.string().max(200)).max(20).optional(),
  })
  .optional();

const memoryCitationInput = z.object({
  sourceId: z.string().min(1).max(300),
  sourceTitle: z.string().min(1).max(300),
  reference: z.string().min(1).max(500),
  sourceType: memorySourceTypeEnum.optional(),
});

const memoryCaptureInput = z.object({
  userId: z.string().min(1),
  type: memoryTypeEnum,
  title: z.string().min(3).max(200),
  content: z.string().min(1).max(20000),
  source: z.string().min(1).max(300),
  sourceType: memorySourceTypeEnum,
  owner: z.string().min(1).max(120),
  relatedGoal: z.string().optional(),
  relatedTask: z.string().optional(),
  relatedCapability: z.string().optional(),
  relatedProvider: z.string().optional(),
  relatedProject: z.string().optional(),
  relatedUser: z.string().optional(),
  relatedContext: z.string().optional(),
  relatedDecision: z.string().optional(),
  relatedExecution: z.string().optional(),
  tags: z.array(z.string().min(1).max(60)).max(50).optional(),
  importance: z.number().min(0).max(1).optional(),
  confidence: memoryConfidenceInput,
  retentionPolicy: memoryRetentionEnum.optional(),
  citations: z.array(memoryCitationInput).max(20).optional(),
  actor: z.string().max(120).optional(),
  pipeline: z.boolean().optional(),
});

const memoryIdInput = z.object({
  userId: z.string().min(1),
  memoryId: z.string().min(1),
});

const memoryUpdateInput = z.object({
  userId: z.string().min(1),
  memoryId: z.string().min(1),
  title: z.string().min(3).max(200).optional(),
  content: z.string().min(1).max(20000).optional(),
  source: z.string().min(1).max(300).optional(),
  sourceType: memorySourceTypeEnum.optional(),
  owner: z.string().min(1).max(120).optional(),
  relatedGoal: z.string().optional(),
  relatedTask: z.string().optional(),
  relatedCapability: z.string().optional(),
  relatedProvider: z.string().optional(),
  relatedProject: z.string().optional(),
  relatedUser: z.string().optional(),
  relatedContext: z.string().optional(),
  relatedDecision: z.string().optional(),
  relatedExecution: z.string().optional(),
  tags: z.array(z.string().min(1).max(60)).max(50).optional(),
  importance: z.number().min(0).max(1).optional(),
  confidence: memoryConfidenceInput,
  retentionPolicy: memoryRetentionEnum.optional(),
  actor: z.string().max(120).optional(),
});

const memoryListInput = z.object({
  userId: z.string().min(1),
  type: memoryTypeEnum.optional(),
  sourceType: memorySourceTypeEnum.optional(),
  lifecycleStatus: memoryLifecycleEnum.optional(),
  compressionState: memoryCompressionEnum.optional(),
  retentionPolicy: memoryRetentionEnum.optional(),
  owner: z.string().optional(),
  tag: z.string().optional(),
  relatedGoal: z.string().optional(),
  relatedTask: z.string().optional(),
  relatedCapability: z.string().optional(),
  relatedProvider: z.string().optional(),
  relatedProject: z.string().optional(),
  relatedUser: z.string().optional(),
  relatedContext: z.string().optional(),
  minImportance: z.number().min(0).max(1).optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const memoryRetrievalInput = z.object({
  userId: z.string().min(1),
  query: z.string().max(500).optional(),
  relatedGoal: z.string().optional(),
  relatedProject: z.string().optional(),
  relatedUser: z.string().optional(),
  relatedCapability: z.string().optional(),
  relatedProvider: z.string().optional(),
  relatedContext: z.string().optional(),
  relatedDecision: z.string().optional(),
  relatedExecution: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  minImportance: z.number().min(0).max(1).optional(),
  includeInactive: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const memorySummarizeInput = z.object({
  userId: z.string().min(1),
  memoryId: z.string().min(1),
  target: memoryCompressionEnum.optional(),
  ratio: z.number().min(0.1).max(1).optional(),
  actor: z.string().max(120).optional(),
});

const memoryValidateInput = z.object({
  userId: z.string().min(1),
  memoryId: z.string().min(1),
  actor: z.string().min(1).max(120),
});

const memoryConsolidateInput = z.object({
  userId: z.string().min(1),
  dryRun: z.boolean().optional(),
  actor: z.string().max(120).optional(),
});

const memoryCompressInput = z.object({
  userId: z.string().min(1),
  target: memoryCompressionEnum.optional(),
});

const memoryExpireInput = z.object({
  userId: z.string().min(1),
  purge: z.boolean().optional(),
  actor: z.string().max(120).optional(),
});

const memoryReinforceInput = z.object({
  userId: z.string().min(1),
  memoryId: z.string().min(1),
  actor: z.string().min(1).max(120),
});

const memoryLifecycleInput = z.object({
  userId: z.string().min(1),
  memoryId: z.string().min(1),
  to: memoryLifecycleEnum,
  actor: z.string().min(1).max(120),
  note: z.string().max(500).optional(),
});

const memoryRelateInput = z.object({
  userId: z.string().min(1),
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  type: memoryRelationshipTypeEnum,
  weight: z.number().min(0).max(1).optional(),
  actor: z.string().min(1).max(120),
  note: z.string().max(500).optional(),
});

const memoryRelationshipQueryInput = z.object({
  userId: z.string().min(1),
  type: memoryRelationshipTypeEnum.optional(),
});

const memoryGraphInput = z.object({
  userId: z.string().min(1),
  memoryId: z.string().min(1),
  maxDepth: z.number().int().min(1).max(10).optional(),
});

const memoryShortestPathInput = z.object({
  userId: z.string().min(1),
  fromId: z.string().min(1),
  toId: z.string().min(1),
});

const memoryConsumerUsageInput = z.object({
  userId: z.string().min(1),
  memoryId: z.string().min(1),
  consumerId: z.string().max(120).optional(),
  consumerType: memoryConsumerTypeEnum,
  consumerLabel: z.string().min(1).max(200),
  actor: z.string().max(120).optional(),
});

const memoryTimelineInput = z.object({
  userId: z.string().min(1),
  limit: z.number().int().min(1).max(200).optional(),
});

// ── Enterprise Operating System enums (EPIC-005 / OS-001) matching packages/os-intelligence ──

const osSnapshotsInput = z.object({
  userId: z.string().min(1),
  limit: z.number().int().min(1).max(100).optional(),
});

// ── Context & Personal Intelligence Fabric enums (APP-001) matching packages/context-fabric ──

const fabricSourceEnum = z.enum([
  'manual',
  'import',
  'inference',
  'system',
  'memory',
  'knowledge',
  'context',
  'identity',
  'goal',
  'task',
  'document',
  'application',
  'capabilities',
  'user_input',
]);

const fabricEntityTypeEnum = z.enum([
  'user',
  'goal',
  'project',
  'task',
  'skill',
  'knowledge',
  'memory',
  'document',
  'application',
  'preference',
  'work_history',
  'learning_history',
  'ai_interaction',
  'organization',
  'person',
  'team',
  'client',
  'process',
  'policy',
  'business_capability',
]);

const contextFabricSearchInput = z.object({
  userId: z.string().min(1),
  organizationId: z.string().optional(),
  query: z.string().min(1).max(500),
  goalId: z.string().optional(),
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  sources: z.array(fabricSourceEnum).optional(),
  types: z.array(fabricEntityTypeEnum).optional(),
  tags: z.array(z.string()).optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const contextFabricEntityInput = z.object({
  userId: z.string().min(1),
  entityId: z.string().min(1),
});

const contextFabricRelationshipsInput = z.object({
  userId: z.string().min(1),
  entityId: z.string().min(1),
  maxDepth: z.number().int().min(0).max(5).optional(),
});

const contextFabricPackageInput = z.object({
  userId: z.string().min(1),
  organizationId: z.string().optional(),
  goalId: z.string().optional(),
  taskId: z.string().optional(),
  query: z.string().min(1).max(500),
  tokenBudget: z.number().int().min(100).max(100000).optional(),
});

const contextFabricExplainInput = z.object({
  userId: z.string().min(1),
  entityId: z.string().min(1),
  goalId: z.string().optional(),
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  query: z.string().max(500).optional(),
});

const contextFabricOrgInput = z.object({
  userId: z.string().min(1),
  organizationId: z.string().optional(),
});

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

// ── AI Runtime schemas (ARC-005 / AI-RUNTIME-001) ───────────────────────────

const aiOrchestrateInput = z.object({
  userId: z.string().min(1),
  capability: capabilityAIFeatureEnum,
  userInput: z.string().min(1).max(8000),
  qualityTier: providerQualityTierEnum,
  conversationId: z.string().max(200).optional(),
  constraints: z
    .object({
      maxOutputTokens: z.number().int().min(1).max(64000).optional(),
      maxInputTokens: z.number().int().min(1).max(1000000).optional(),
      maxLatencyMs: z.number().int().min(0).optional(),
      maxCost: z.number().min(0).optional(),
      outputFormat: z.enum(['text', 'json', 'markdown', 'code']).optional(),
    })
    .optional(),
  context: z
    .object({
      systemPrompt: z.string().max(4000).optional(),
      identityContext: z.string().max(4000).optional(),
      knowledgeContext: z.string().max(20000).optional(),
      memoryContext: z.string().max(20000).optional(),
      decisionContext: z.string().max(10000).optional(),
      executionContext: z.string().max(10000).optional(),
      conversationHistory: z
        .array(
          z.object({
            role: z.enum(['user', 'assistant']),
            content: z.string().max(4000),
          }),
        )
        .max(50)
        .optional(),
    })
    .optional(),
  // AI-RUNTIME-002: production RAG retrieval + EI-003 optimization + schema-
  // validated structured output on the shared runtime input.
  ragQuery: z
    .object({
      collection: z.string().min(1).max(200),
      query: z.string().min(1).max(4000),
      topK: z.number().int().min(1).max(20).optional(),
    })
    .optional(),
  enableOptimization: z.boolean().optional(),
  structuredSchema: z.record(z.string(), z.unknown()).optional(),
  // AI-RUNTIME-002 Phase 8 (Evidence-First): when true, the runtime evaluates
  // groundedness of retrieved evidence and abstains if it is insufficient or
  // conflicting — it never fabricates a grounded answer.
  groundingRequired: z.boolean().optional(),
});

const aiProviderHealthInput = z.object({
  userId: z.string().min(1),
  providerId: z.string().min(1),
});

// ── AI Runtime schemas (AI-RUNTIME-002: streaming + selection explanation) ──

const aiStreamInput = aiOrchestrateInput;

const aiExplainSelectionInput = z.object({
  userId: z.string().min(1),
  capability: capabilityAIFeatureEnum,
  estimatedInputTokens: z.number().int().min(1).max(1000000).optional(),
  requestedOutputTokens: z.number().int().min(1).max(64000).optional(),
});

// ── Enterprise RAG schemas (EPIC-005 / AI-RUNTIME-002) ──────────────────────

const ragIngestInput = z.object({
  userId: z.string().min(1),
  collection: z.string().min(1).max(200),
  sourceId: z.string().min(1).max(200),
  title: z.string().min(1).max(500),
  content: z.string().min(1).max(200000),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const ragSearchInput = z.object({
  userId: z.string().min(1),
  collection: z.string().min(1).max(200),
  query: z.string().min(1).max(4000),
  topK: z.number().int().min(1).max(20).optional(),
  minScore: z.number().min(0).max(1).optional(),
  metadataFilter: z.record(z.string(), z.unknown()).optional(),
});

const ragDeleteInput = z.object({
  userId: z.string().min(1),
  collection: z.string().min(1).max(200),
  sourceId: z.string().min(1).max(200),
});

const ragStatsInput = z.object({
  userId: z.string().min(1),
  collection: z.string().max(200).optional(),
});

// ── Orchestrated AI Loop Engine schemas (EPIC-006) ──────────────────────────
// The loop.* contract: start (bounded orchestrated run), status, getTrace,
// cancel, resume (with user clarification), listRuns, listPatterns.

const loopBudgetOverrideInput = z.object({
  maxIterations: z.number().int().min(1).max(50).optional(),
  maxTokens: z.number().int().min(100).max(10000000).optional(),
  maxCostUsd: z.number().min(0).max(100).optional(),
  maxLatencyMs: z.number().int().min(1000).max(3600000).optional(),
  maxProviderCalls: z.number().int().min(1).max(1000).optional(),
  maxToolCalls: z.number().int().min(0).max(500).optional(),
});

const loopStartInput = z.object({
  userId: z.string().min(1),
  goal: z.string().min(1).max(2000),
  collection: z.string().min(1).max(200).optional(),
  budgetOverride: loopBudgetOverrideInput.optional(),
});

const loopRunIdInput = z.object({
  userId: z.string().min(1),
  runId: z.string().min(1).max(200),
});

const loopResumeInput = z.object({
  userId: z.string().min(1),
  runId: z.string().min(1).max(200),
  clarification: z.string().min(1).max(2000),
});

// ── AI Application Factory schemas (EPIC-007) ───────────────────────────────
// The factory.* contract: create (understand→specify→architect→plan),
// approve (Phase 8 plan approval), build (generate→validate→critique→
// refine, bounded by EPIC-006 budgets), status, getDetail, deploy (EXPLICIT
// authorization only), list, and version-control ops (never auto-pushed).

const deploymentTargetEnum = z.enum(['local', 'vercel', 'firebase', 'cloud_run', 'self_hosted']);

const factoryCreateInput = z.object({
  userId: z.string().min(1),
  goal: z.string().min(1).max(2000),
  budgetOverride: loopBudgetOverrideInput.optional(),
});

const factoryApplicationIdInput = z.object({
  userId: z.string().min(1),
  applicationId: z.string().min(1).max(200),
});

const factoryApproveInput = factoryApplicationIdInput.extend({
  changes: z.string().max(2000).optional(),
});

const factoryBuildInput = z.object({
  userId: z.string().min(1),
  applicationId: z.string().min(1).max(200),
  approved: z.boolean(),
  grants: z.record(z.boolean()).optional(),
});

const factoryDeployInput = z.object({
  userId: z.string().min(1),
  applicationId: z.string().min(1).max(200),
  request: z.object({
    target: deploymentTargetEnum,
    authorized: z.boolean(),
  }),
});

const factoryVcBranchInput = factoryApplicationIdInput.extend({
  name: z.string().min(1).max(200),
});

const factoryVcCommitInput = factoryApplicationIdInput.extend({
  message: z.string().min(1).max(500),
  files: z.array(z.string().min(1)).min(1),
});

const factoryVcPrInput = factoryApplicationIdInput.extend({
  title: z.string().min(1).max(300),
});

// EPIC-008 — application lifecycle (Phase 1) + version history (Phase 14):
// rename (with a new name), archive, delete (EXPLICIT confirmation required;
// active/released applications must be archived first), resume (archived or
// failed → active for rebuild), history (recorded application states).

const factoryRenameInput = factoryApplicationIdInput.extend({
  name: z.string().min(1).max(120),
});

const factoryDeleteInput = factoryApplicationIdInput.extend({
  confirm: z.boolean(),
});

// EPIC-008 Phase 13 — the preview bundler is stateless; a module-scoped
// instance avoids re-initializing esbuild per request.
const factoryPreviewService = new PreviewService();

// ── Product Intelligence & Requirements schemas (EPIC-009) ──────────────────
// The requirements.* contract: start (understand → extract → analyze →
// questions + defaults), answer (bundled user answers), acceptAllDefaults /
// decideDefault (Phase 9 safe defaults), resolveConflict (Phase 11), plan
// (Phases 12–25 product plan), approve (Phase 23 approval gate), reject,
// handoffGoal / handoffToFactory (APPROVED session → factory.create),
// changeImpact (Phase 24 mandatory analysis), and owner-scoped session
// management (get / list / delete).

const requirementsStartInput = z.object({
  userId: z.string().min(1),
  idea: z.string().min(1).max(4000),
});

const requirementsSessionIdInput = z.object({
  userId: z.string().min(1),
  sessionId: z.string().min(1).max(200),
});

const requirementsAnswerInput = requirementsSessionIdInput.extend({
  answers: z
    .array(z.object({ questionId: z.string().min(1), answer: z.string().min(1).max(2000) }))
    .max(50),
});

const requirementsDefaultDecisionInput = requirementsSessionIdInput.extend({
  defaultId: z.string().min(1),
  decision: z.enum(['proposed', 'accepted', 'edited', 'rejected']),
  editedValue: z.string().max(2000).optional(),
});

const requirementsConflictInput = requirementsSessionIdInput.extend({
  conflictId: z.string().min(1),
  choice: z.string().min(1).max(2000),
});

const requirementsRejectInput = requirementsSessionIdInput.extend({
  reason: z.string().max(2000).optional(),
});

const requirementsChangeImpactInput = requirementsSessionIdInput.extend({
  request: z.string().min(1).max(4000),
});

// ── Adaptive Application Experience schemas (EPIC-010) ──────────────────────
// The experience.* contract: evaluate (design system + blueprint + decisions +
// critic + multi-dimensional quality + traceability), findings (Phase 10
// evidence-classified critic findings), refine (Phase 12/13 targeted
// refinement with change impact — never regenerate-all). Every procedure
// resolves the persisted application through the factory engine, so IDOR is
// enforced at the same ownership boundary as factory.*.

const experienceEvaluateInput = z.object({
  userId: z.string().min(1),
  applicationId: z.string().min(1).max(200),
});

const experienceRefineInput = experienceEvaluateInput.extend({
  findingId: z.string().min(1).max(200),
});

// ── EPIC-012 Ops Control Plane schemas ──────────────────────────────────────
// The ops.* contract: inspect (traces/failures/diagnostics/cost/health/
// alerts/audit) + control (retry/cancel/revalidate/requality/disable-enable
// provider). Every input carries the session userId so the gateway IDOR
// guard applies; authorization (operator gate / owner scoping) is enforced
// inside the OpsApplicationService.

const traceStatusEnum = z.enum([
  'OK',
  'ERROR',
  'ABSTAINED',
  'BUDGET_EXCEEDED',
  'TIMEOUT',
  'PROVIDER_FAILURE',
  'VALIDATION_FAILURE',
  'SECURITY_BLOCK',
  'USER_CANCELLED',
  'FAILED',
]);

const opsTracesInput = z.object({
  userId: z.string().min(1),
  limit: z.number().int().min(1).max(500).optional(),
});

const opsTracesStatusInput = opsTracesInput.extend({
  status: traceStatusEnum.optional(),
});

const opsTraceInput = z.object({
  userId: z.string().min(1),
  traceId: z.string().min(1).max(200),
});

const opsUserIdInput = z.object({ userId: z.string().min(1) });

const opsRetryInput = z.object({
  userId: z.string().min(1),
  kind: z.enum(['application', 'loop', 'rag']),
  id: z.string().min(1).max(200),
});

const opsCancelInput = z.object({
  userId: z.string().min(1),
  kind: z.enum(['loop', 'application']),
  id: z.string().min(1).max(200),
});

const opsAppIdInput = z.object({
  userId: z.string().min(1),
  id: z.string().min(1).max(200),
});

const opsProviderInput = z.object({
  userId: z.string().min(1),
  providerId: z.string().min(1).max(200),
});

const opsThresholdsInput = z.object({ userId: z.string().min(1) }).passthrough();

// ── Content Agency schemas (EPIC-003 / AC-001) ──────────────────────────────

const contentTypeEnum = z.enum([
  'blog',
  'linkedin',
  'twitter',
  'instagram',
  'facebook',
  'email',
  'website_copy',
  'landing_page',
  'ad_copy',
  'product_description',
  'case_study',
  'script',
]);
const contentStatusEnum = z.enum(['draft', 'review', 'approved', 'scheduled', 'published']);
const workflowStageEnum = z.enum([
  'brief',
  'research',
  'outline',
  'draft',
  'review',
  'improve',
  'seo',
  'grammar',
  'brand_alignment',
  'approval',
  'delivery',
]);
const deliveryFormatEnum = z.enum(['markdown', 'html', 'pdf', 'docx']);
const qualityTierEnum = z.enum(['premium', 'standard', 'economy']);
const documentInput = z.object({ name: z.string(), type: z.string() });
const socialLinksInput = z.record(z.string());

const contentAgencyClientInput = z.object({
  userId: z.string().min(1),
  company: z.string().min(1),
  industry: z.string().optional(),
  brandVoice: z.string().optional(),
  targetAudience: z.string().optional(),
  products: z.array(z.string()).optional(),
  services: z.array(z.string()).optional(),
  goals: z.array(z.string()).optional(),
  website: z.string().optional(),
  socialLinks: socialLinksInput.optional(),
  aiMemory: z.string().optional(),
  documents: z.array(documentInput).optional(),
});

const contentAgencyBrandInput = z.object({
  userId: z.string().min(1),
  id: z.string().optional(),
  clientId: z.string().nullable().optional(),
  name: z.string().min(1),
  tone: z.string().optional(),
  writingStyle: z.string().optional(),
  vocabulary: z.array(z.string()).optional(),
  doRules: z.array(z.string()).optional(),
  dontRules: z.array(z.string()).optional(),
  ctaStyle: z.string().optional(),
  competitors: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  colorPalette: z.array(z.string()).optional(),
  mission: z.string().optional(),
  vision: z.string().optional(),
});

const contentAgencyProjectInput = z.object({
  userId: z.string().min(1),
  clientId: z.string().min(1),
  brandId: z.string().nullable().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['active', 'paused', 'completed', 'cancelled']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().nullable().optional(),
});

const contentAgencyGenerateInput = z.object({
  userId: z.string().min(1),
  clientId: z.string().min(1),
  brandId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  contentType: contentTypeEnum,
  title: z.string().min(1),
  brief: z.string().min(1),
  goals: z.array(z.string()).optional(),
  targetAudience: z.string().optional(),
  qualityTier: qualityTierEnum.optional(),
});

const contentAgencyDraftInput = contentAgencyGenerateInput.omit({ qualityTier: true }).extend({
  content: z.string().optional(),
});

const contentAgencyReviewInput = z.object({
  userId: z.string().min(1),
  contentId: z.string().min(1),
  stage: workflowStageEnum,
  reviewer: z.string().min(1),
  comment: z.string().min(1),
  decision: z.enum(['comment', 'accepted', 'rejected']),
  score: z.number().min(0).max(10).nullable().optional(),
});

const contentAgencyRegenerateInput = z.object({
  userId: z.string().min(1),
  contentId: z.string().min(1),
  feedback: z.string().min(1),
  qualityTier: qualityTierEnum.optional(),
});

const contentAgencyInvoiceInput = z.object({
  userId: z.string().min(1),
  clientId: z.string().min(1),
  projectId: z.string().nullable().optional(),
  description: z.string().optional(),
  amount: z.number().min(0),
  currency: z.string().optional(),
  status: z.enum(['draft', 'sent', 'paid']).optional(),
  issuedAt: z.string().optional(),
  dueDate: z.string().nullable().optional(),
});

// ── Client Operations schemas (EPIC-003 / AC-002) ───────────────────────────

const leadStatusEnum = z.enum(['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost']);
const interactionTypeEnum = z.enum(['call', 'email', 'meeting', 'note', 'proposal', 'other']);
const documentKindEnum = z.enum([
  'brand_guidelines',
  'logo',
  'reference',
  'research',
  'contract',
  'image',
  'other',
]);

const clientOpsLeadInput = z.object({
  userId: z.string().min(1),
  company: z.string().min(1),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  industry: z.string().optional(),
  source: z.string().optional(),
  status: leadStatusEnum.optional(),
  value: z.number().optional(),
  currency: z.string().optional(),
  nextFollowUp: z.string().nullable().optional(),
  notes: z.string().optional(),
});

const clientOpsInteractionInput = z.object({
  userId: z.string().min(1),
  leadId: z.string().min(1),
  type: interactionTypeEnum,
  summary: z.string().min(1),
});

const clientOpsTaskInput = z.object({
  userId: z.string().min(1),
  leadId: z.string().min(1),
  title: z.string().min(1),
  dueAt: z.string().nullable().optional(),
});

const clientOpsContactInput = z.object({
  userId: z.string().min(1),
  leadId: z.string().min(1),
  name: z.string().min(1),
  email: z.string().optional(),
  phone: z.string().optional(),
  role: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

const proposalPricingLineInput = z.object({
  label: z.string().min(1),
  description: z.string().optional(),
  amount: z.number(),
});

const proposalContentInput = z.object({
  company: z.string(),
  requirements: z.string(),
  scope: z.string(),
  timeline: z.string(),
  deliverables: z.array(z.string()),
  terms: z.string(),
  pricing: z.array(proposalPricingLineInput),
  notes: z.string().optional(),
  document: z.string().optional(),
});

const clientOpsProposalInput = z.object({
  userId: z.string().min(1),
  title: z.string().min(1),
  leadId: z.string().optional(),
  clientId: z.string().optional(),
  content: proposalContentInput,
});

const clientOpsProposalUpdateInput = z.object({
  userId: z.string().min(1),
  proposalId: z.string().min(1),
  title: z.string().optional(),
  content: proposalContentInput.partial(),
});

const clientOpsGenerateProposalInput = z.object({
  userId: z.string().min(1),
  title: z.string().min(1),
  leadId: z.string().optional(),
  clientId: z.string().optional(),
  company: z.string().min(1),
  industry: z.string().optional(),
  requirements: z.string().min(1),
  scope: z.string().optional(),
  timeline: z.string().optional(),
  deliverables: z.array(z.string()).optional(),
  goals: z.array(z.string()).optional(),
  brandVoice: z.string().optional(),
  pricing: z.array(proposalPricingLineInput).optional(),
});

const clientOpsContractInput = z.object({
  userId: z.string().min(1),
  clientId: z.string().min(1),
  title: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  value: z.number(),
  currency: z.string().optional(),
  renewal: z.boolean().optional(),
  autoRenew: z.boolean().optional(),
  content: z.string().optional(),
});

const clientOpsContractUpdateInput = z.object({
  userId: z.string().min(1),
  contractId: z.string().min(1),
  title: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  value: z.number().optional(),
  content: z.string().optional(),
  note: z.string().optional(),
});

const clientOpsContractApprovalInput = z.object({
  userId: z.string().min(1),
  contractId: z.string().min(1),
  approved: z.boolean(),
  comment: z.string().optional(),
  by: z.string().min(1),
});

const clientOpsRenewContractInput = z.object({
  userId: z.string().min(1),
  contractId: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  value: z.number().optional(),
  note: z.string().optional(),
});

const quotationPackageInput = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number(),
  qty: z.number().optional(),
});

const clientOpsQuotationInput = z.object({
  userId: z.string().min(1),
  title: z.string().min(1),
  leadId: z.string().optional(),
  clientId: z.string().optional(),
  packages: z.array(quotationPackageInput).min(1),
  discount: z.number().optional(),
  taxRate: z.number().optional(),
  recurring: z.boolean().optional(),
  currency: z.string().optional(),
});

const clientOpsPaymentInput = z.object({
  userId: z.string().min(1),
  invoiceId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().optional(),
  method: z.string().optional(),
  receivedAt: z.string().optional(),
  note: z.string().optional(),
});

const clientOpsUploadDocumentInput = z.object({
  userId: z.string().min(1),
  clientId: z.string().min(1),
  projectId: z.string().optional(),
  contractId: z.string().optional(),
  name: z.string().min(1),
  kind: documentKindEnum,
  mime: z.string().min(1),
  contentBase64: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

const clientOpsUpdateDocumentInput = z.object({
  userId: z.string().min(1),
  documentId: z.string().min(1),
  contentBase64: z.string().optional(),
  mime: z.string().optional(),
  note: z.string().optional(),
  name: z.string().optional(),
});

const clientOpsPortalAccessInput = z.object({
  userId: z.string().min(1),
  clientId: z.string().min(1),
  email: z.string().min(1),
});

const portalToken = z.object({ token: z.string().min(16) });
const portalTokenAndContent = z.object({ token: z.string().min(16), contentId: z.string().min(1) });
const portalTokenComment = z.object({
  token: z.string().min(16),
  contentId: z.string().min(1),
  comment: z.string().min(1),
});
const portalTokenInvoice = z.object({ token: z.string().min(16), invoiceId: z.string().min(1) });

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

    // ── Content Agency (EPIC-003 / AC-001) ──────────────────────────────────
    //    heavy tier for AI generation (20 req/min), standard elsewhere.
    contentAgency: router({
      getDashboard: heavyProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createContentAgencyRouter(services.contentAgency).getDashboard(input, ctx),
        ),
      getAnalytics: heavyProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createContentAgencyRouter(services.contentAgency).getAnalytics(input, ctx),
        ),
      // Clients
      listClients: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createContentAgencyRouter(services.contentAgency).listClients(input, ctx),
        ),
      getClient: standardProcedure
        .input(z.object({ userId: z.string(), clientId: z.string() }))
        .query(({ input, ctx }) =>
          createContentAgencyRouter(services.contentAgency).getClient(input, ctx),
        ),
      createClient: standardProcedure
        .input(contentAgencyClientInput)
        .mutation(({ input, ctx }) =>
          createContentAgencyRouter(services.contentAgency).createClient(input, ctx),
        ),
      updateClient: standardProcedure
        .input(
          contentAgencyClientInput
            .partial()
            .extend({ userId: z.string().min(1), clientId: z.string().min(1) }),
        )
        .mutation(({ input, ctx }) =>
          createContentAgencyRouter(services.contentAgency).updateClient(input, ctx),
        ),
      deleteClient: standardProcedure
        .input(z.object({ userId: z.string(), clientId: z.string() }))
        .mutation(({ input, ctx }) =>
          createContentAgencyRouter(services.contentAgency).deleteClient(input, ctx),
        ),
      // Brands
      listBrands: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createContentAgencyRouter(services.contentAgency).listBrands(input, ctx),
        ),
      getBrand: standardProcedure
        .input(z.object({ userId: z.string(), brandId: z.string() }))
        .query(({ input, ctx }) =>
          createContentAgencyRouter(services.contentAgency).getBrand(input, ctx),
        ),
      upsertBrand: standardProcedure
        .input(contentAgencyBrandInput)
        .mutation(({ input, ctx }) =>
          createContentAgencyRouter(services.contentAgency).upsertBrand(input, ctx),
        ),
      deleteBrand: standardProcedure
        .input(z.object({ userId: z.string(), brandId: z.string() }))
        .mutation(({ input, ctx }) =>
          createContentAgencyRouter(services.contentAgency).deleteBrand(input, ctx),
        ),
      // Projects
      listProjects: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createContentAgencyRouter(services.contentAgency).listProjects(input, ctx),
        ),
      getProject: standardProcedure
        .input(z.object({ userId: z.string(), projectId: z.string() }))
        .query(({ input, ctx }) =>
          createContentAgencyRouter(services.contentAgency).getProject(input, ctx),
        ),
      createProject: standardProcedure
        .input(contentAgencyProjectInput)
        .mutation(({ input, ctx }) =>
          createContentAgencyRouter(services.contentAgency).createProject(input, ctx),
        ),
      updateProject: standardProcedure
        .input(
          contentAgencyProjectInput
            .partial()
            .extend({ userId: z.string().min(1), projectId: z.string().min(1) }),
        )
        .mutation(({ input, ctx }) =>
          createContentAgencyRouter(services.contentAgency).updateProject(input, ctx),
        ),
      deleteProject: standardProcedure
        .input(z.object({ userId: z.string(), projectId: z.string() }))
        .mutation(({ input, ctx }) =>
          createContentAgencyRouter(services.contentAgency).deleteProject(input, ctx),
        ),
      // Content
      listContent: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createContentAgencyRouter(services.contentAgency).listContent(input, ctx),
        ),
      getContent: standardProcedure
        .input(z.object({ userId: z.string(), contentId: z.string() }))
        .query(({ input, ctx }) =>
          createContentAgencyRouter(services.contentAgency).getContent(input, ctx),
        ),
      generateContent: heavyProcedure
        .input(contentAgencyGenerateInput)
        .mutation(({ input, ctx }) =>
          createContentAgencyRouter(services.contentAgency).generateContent(input, ctx),
        ),
      createDraft: standardProcedure
        .input(contentAgencyDraftInput)
        .mutation(({ input, ctx }) =>
          createContentAgencyRouter(services.contentAgency).createDraft(input, ctx),
        ),
      transitionStatus: standardProcedure
        .input(z.object({ userId: z.string(), contentId: z.string(), to: contentStatusEnum }))
        .mutation(({ input, ctx }) =>
          createContentAgencyRouter(services.contentAgency).transitionStatus(input, ctx),
        ),
      scheduleContent: standardProcedure
        .input(z.object({ userId: z.string(), contentId: z.string(), scheduledFor: z.string() }))
        .mutation(({ input, ctx }) =>
          createContentAgencyRouter(services.contentAgency).scheduleContent(input, ctx),
        ),
      publishContent: standardProcedure
        .input(
          z.object({
            userId: z.string(),
            contentId: z.string(),
            publishedUrl: z.string().optional(),
          }),
        )
        .mutation(({ input, ctx }) =>
          createContentAgencyRouter(services.contentAgency).publishContent(input, ctx),
        ),
      addReview: standardProcedure
        .input(contentAgencyReviewInput)
        .mutation(({ input, ctx }) =>
          createContentAgencyRouter(services.contentAgency).addReview(input, ctx),
        ),
      regenerateContent: heavyProcedure
        .input(contentAgencyRegenerateInput)
        .mutation(({ input, ctx }) =>
          createContentAgencyRouter(services.contentAgency).regenerateContent(input, ctx),
        ),
      // Calendar
      getCalendar: standardProcedure
        .input(
          z.object({
            userId: z.string(),
            range: z.enum(['month', 'week', 'day']),
            anchor: z.string().optional(),
          }),
        )
        .query(({ input, ctx }) =>
          createContentAgencyRouter(services.contentAgency).getCalendar(input, ctx),
        ),
      // Invoices
      listInvoices: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createContentAgencyRouter(services.contentAgency).listInvoices(input, ctx),
        ),
      getInvoice: standardProcedure
        .input(z.object({ userId: z.string(), invoiceId: z.string() }))
        .query(({ input, ctx }) =>
          createContentAgencyRouter(services.contentAgency).getInvoice(input, ctx),
        ),
      createInvoice: standardProcedure
        .input(contentAgencyInvoiceInput)
        .mutation(({ input, ctx }) =>
          createContentAgencyRouter(services.contentAgency).createInvoice(input, ctx),
        ),
      updateInvoiceStatus: standardProcedure
        .input(
          z.object({
            userId: z.string(),
            invoiceId: z.string(),
            status: z.enum(['draft', 'sent', 'paid']),
          }),
        )
        .mutation(({ input, ctx }) =>
          createContentAgencyRouter(services.contentAgency).updateInvoiceStatus(input, ctx),
        ),
      deleteInvoice: standardProcedure
        .input(z.object({ userId: z.string(), invoiceId: z.string() }))
        .mutation(({ input, ctx }) =>
          createContentAgencyRouter(services.contentAgency).deleteInvoice(input, ctx),
        ),
      // Delivery
      exportContent: standardProcedure
        .input(
          z.object({
            userId: z.string(),
            contentId: z.string(),
            format: deliveryFormatEnum,
          }),
        )
        .query(({ input, ctx }) =>
          createContentAgencyRouter(services.contentAgency).exportContent(input, ctx),
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

    // ── Client Operations (EPIC-003 / AC-002) ───────────────────────────────
    clientOps: router({
      // CRM
      listLeads: standardProcedure
        .input(z.object({ userId: z.string(), status: z.string().optional() }))
        .query(({ input, ctx }) => createClientOpsRouter(services.clientOps).listLeads(input, ctx)),
      getLead: standardProcedure
        .input(z.object({ userId: z.string(), leadId: z.string() }))
        .query(({ input, ctx }) => createClientOpsRouter(services.clientOps).getLead(input, ctx)),
      createLead: standardProcedure
        .input(clientOpsLeadInput)
        .mutation(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).createLead(input, ctx),
        ),
      updateLead: standardProcedure
        .input(
          clientOpsLeadInput
            .partial()
            .extend({ userId: z.string().min(1), leadId: z.string().min(1) }),
        )
        .mutation(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).updateLead(input, ctx),
        ),
      moveLead: standardProcedure
        .input(z.object({ userId: z.string(), leadId: z.string(), to: leadStatusEnum }))
        .mutation(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).moveLead(input, ctx),
        ),
      archiveLead: standardProcedure
        .input(z.object({ userId: z.string(), leadId: z.string() }))
        .mutation(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).archiveLead(input, ctx),
        ),
      addInteraction: standardProcedure
        .input(clientOpsInteractionInput)
        .mutation(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).addInteraction(input, ctx),
        ),
      addTask: standardProcedure
        .input(clientOpsTaskInput)
        .mutation(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).addTask(input, ctx),
        ),
      completeTask: standardProcedure
        .input(z.object({ userId: z.string(), leadId: z.string(), taskId: z.string() }))
        .mutation(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).completeTask(input, ctx),
        ),
      addContact: standardProcedure
        .input(clientOpsContactInput)
        .mutation(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).addContact(input, ctx),
        ),
      deleteContact: standardProcedure
        .input(z.object({ userId: z.string(), leadId: z.string(), contactId: z.string() }))
        .mutation(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).deleteContact(input, ctx),
        ),
      // Proposals
      listProposals: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).listProposals(input, ctx),
        ),
      getProposal: standardProcedure
        .input(z.object({ userId: z.string(), proposalId: z.string() }))
        .query(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).getProposal(input, ctx),
        ),
      createProposal: standardProcedure
        .input(clientOpsProposalInput)
        .mutation(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).createProposal(input, ctx),
        ),
      updateProposal: standardProcedure
        .input(clientOpsProposalUpdateInput)
        .mutation(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).updateProposal(input, ctx),
        ),
      generateProposal: heavyProcedure
        .input(clientOpsGenerateProposalInput)
        .mutation(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).generateProposal(input, ctx),
        ),
      sendProposal: standardProcedure
        .input(z.object({ userId: z.string(), proposalId: z.string() }))
        .mutation(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).sendProposal(input, ctx),
        ),
      acceptProposal: standardProcedure
        .input(z.object({ userId: z.string(), proposalId: z.string() }))
        .mutation(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).acceptProposal(input, ctx),
        ),
      rejectProposal: standardProcedure
        .input(z.object({ userId: z.string(), proposalId: z.string() }))
        .mutation(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).rejectProposal(input, ctx),
        ),
      exportProposal: standardProcedure
        .input(z.object({ userId: z.string(), proposalId: z.string(), format: deliveryFormatEnum }))
        .query(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).exportProposal(input, ctx),
        ),
      // Contracts
      listContracts: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).listContracts(input, ctx),
        ),
      getContract: standardProcedure
        .input(z.object({ userId: z.string(), contractId: z.string() }))
        .query(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).getContract(input, ctx),
        ),
      createContract: standardProcedure
        .input(clientOpsContractInput)
        .mutation(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).createContract(input, ctx),
        ),
      updateContract: standardProcedure
        .input(clientOpsContractUpdateInput)
        .mutation(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).updateContract(input, ctx),
        ),
      approveContract: standardProcedure
        .input(clientOpsContractApprovalInput)
        .mutation(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).approveContract(input, ctx),
        ),
      terminateContract: standardProcedure
        .input(z.object({ userId: z.string(), contractId: z.string() }))
        .mutation(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).terminateContract(input, ctx),
        ),
      renewContract: standardProcedure
        .input(clientOpsRenewContractInput)
        .mutation(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).renewContract(input, ctx),
        ),
      listExpiringContracts: standardProcedure
        .input(z.object({ userId: z.string(), days: z.number().int().positive().optional() }))
        .query(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).listExpiringContracts(input, ctx),
        ),
      // Quotations
      listQuotations: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).listQuotations(input, ctx),
        ),
      getQuotation: standardProcedure
        .input(z.object({ userId: z.string(), quotationId: z.string() }))
        .query(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).getQuotation(input, ctx),
        ),
      createQuotation: standardProcedure
        .input(clientOpsQuotationInput)
        .mutation(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).createQuotation(input, ctx),
        ),
      updateQuotation: standardProcedure
        .input(
          clientOpsQuotationInput
            .partial()
            .extend({ userId: z.string().min(1), quotationId: z.string().min(1) }),
        )
        .mutation(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).updateQuotation(input, ctx),
        ),
      sendQuotation: standardProcedure
        .input(z.object({ userId: z.string(), quotationId: z.string() }))
        .mutation(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).sendQuotation(input, ctx),
        ),
      acceptQuotation: standardProcedure
        .input(z.object({ userId: z.string(), quotationId: z.string() }))
        .mutation(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).acceptQuotation(input, ctx),
        ),
      rejectQuotation: standardProcedure
        .input(z.object({ userId: z.string(), quotationId: z.string() }))
        .mutation(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).rejectQuotation(input, ctx),
        ),
      // Payments & revenue
      listPayments: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).listPayments(input, ctx),
        ),
      addPayment: standardProcedure
        .input(clientOpsPaymentInput)
        .mutation(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).addPayment(input, ctx),
        ),
      getRevenueOverview: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).getRevenueOverview(input, ctx),
        ),
      // Documents
      listDocuments: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).listDocuments(input, ctx),
        ),
      getDocument: standardProcedure
        .input(z.object({ userId: z.string(), documentId: z.string() }))
        .query(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).getDocument(input, ctx),
        ),
      uploadDocument: standardProcedure
        .input(clientOpsUploadDocumentInput)
        .mutation(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).uploadDocument(input, ctx),
        ),
      updateDocument: standardProcedure
        .input(clientOpsUpdateDocumentInput)
        .mutation(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).updateDocument(input, ctx),
        ),
      deleteDocument: standardProcedure
        .input(z.object({ userId: z.string(), documentId: z.string() }))
        .mutation(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).deleteDocument(input, ctx),
        ),
      searchDocuments: standardProcedure
        .input(z.object({ userId: z.string(), query: z.string() }))
        .query(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).searchDocuments(input, ctx),
        ),
      // Portal access management
      createPortalAccess: standardProcedure
        .input(clientOpsPortalAccessInput)
        .mutation(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).createPortalAccess(input, ctx),
        ),
      listPortalAccess: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).listPortalAccess(input, ctx),
        ),
      revokePortalAccess: standardProcedure
        .input(z.object({ userId: z.string(), accessId: z.string() }))
        .mutation(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).revokePortalAccess(input, ctx),
        ),
      // Notifications
      listNotifications: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).listNotifications(input, ctx),
        ),
      markNotificationRead: standardProcedure
        .input(z.object({ userId: z.string(), notificationId: z.string() }))
        .mutation(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).markNotificationRead(input, ctx),
        ),
      markAllNotificationsRead: standardProcedure
        .input(userId)
        .mutation(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).markAllNotificationsRead(input, ctx),
        ),
      // Analytics
      getBusinessAnalytics: heavyProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createClientOpsRouter(services.clientOps).getBusinessAnalytics(input, ctx),
        ),
    }),

    // ── Enterprise Capability Registry (EPIC-004 / EI-001) ─────────────────
    capabilities: router({
      // Marketplace
      getMarketplace: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createCapabilitiesRouter(services.capabilities).getMarketplace(input, ctx),
        ),
      search: standardProcedure
        .input(
          z.object({
            userId: z.string().min(1),
            query: z.string().max(200).optional(),
            categories: z.array(capabilityCategoryEnum).optional(),
            statuses: z.array(capabilityStatusEnum).optional(),
            businessModules: z.array(capabilityBusinessModuleEnum).optional(),
            tags: z.array(z.string()).optional(),
            dependsOn: z.string().optional(),
            onlyCompositions: z.boolean().optional(),
            page: z.number().int().min(1).optional(),
            limit: z.number().int().min(1).max(100).optional(),
          }),
        )
        .query(({ input, ctx }) =>
          createCapabilitiesRouter(services.capabilities).search(input, ctx),
        ),
      // Registry
      getCapability: standardProcedure
        .input(z.object({ userId: z.string().min(1), id: z.string().min(1) }))
        .query(({ input, ctx }) =>
          createCapabilitiesRouter(services.capabilities).getCapability(input, ctx),
        ),
      createCapability: standardProcedure
        .input(
          z.object({
            userId: z.string().min(1),
            id: z.string().min(1),
            name: z.string().min(1).max(80),
            category: capabilityCategoryEnum,
            description: z.string().min(1),
            owner: z.string().min(1),
            inputs: z.array(z.string()).optional(),
            outputs: z.array(z.string()).optional(),
            dependencies: z.array(z.string()).optional(),
            requiredAIFeatures: z.array(capabilityAIFeatureEnum).optional(),
            estimatedCostUsd: z.number().min(0).optional(),
            costTier: z.enum(['free', 'low', 'medium', 'high']).optional(),
            estimatedInputTokens: z.number().min(0).optional(),
            estimatedOutputTokens: z.number().min(0).optional(),
            p50Ms: z.number().min(0).optional(),
            p95Ms: z.number().min(0).optional(),
            qualityTarget: z.number().min(0).max(1).optional(),
            qualityMinimum: z.number().min(0).max(1).optional(),
            confidence: z.number().min(0).max(1).optional(),
            tags: z.array(z.string()).optional(),
            businessModules: z.array(capabilityBusinessModuleEnum).optional(),
            documentationUrl: z.string().optional(),
            composition: z
              .array(z.object({ id: z.string(), slot: z.string().optional() }))
              .optional(),
          }),
        )
        .mutation(({ input, ctx }) =>
          createCapabilitiesRouter(services.capabilities).createCapability(input, ctx),
        ),
      updateCapability: standardProcedure
        .input(
          z.object({
            userId: z.string().min(1),
            id: z.string().min(1),
            name: z.string().min(1).max(80).optional(),
            category: capabilityCategoryEnum.optional(),
            description: z.string().optional(),
            owner: z.string().optional(),
            inputs: z.array(z.string()).optional(),
            outputs: z.array(z.string()).optional(),
            tags: z.array(z.string()).optional(),
            documentationUrl: z.string().optional(),
            estimatedCostUsd: z.number().min(0).optional(),
            costTier: z.enum(['free', 'low', 'medium', 'high']).optional(),
            estimatedInputTokens: z.number().min(0).optional(),
            estimatedOutputTokens: z.number().min(0).optional(),
            p50Ms: z.number().min(0).optional(),
            p95Ms: z.number().min(0).optional(),
            qualityTarget: z.number().min(0).max(1).optional(),
            qualityMinimum: z.number().min(0).max(1).optional(),
            confidence: z.number().min(0).max(1).optional(),
            composition: z
              .array(z.object({ id: z.string(), slot: z.string().optional() }))
              .optional(),
          }),
        )
        .mutation(({ input, ctx }) =>
          createCapabilitiesRouter(services.capabilities).updateCapability(input, ctx),
        ),
      deleteCapability: standardProcedure
        .input(z.object({ userId: z.string().min(1), id: z.string().min(1) }))
        .mutation(({ input, ctx }) =>
          createCapabilitiesRouter(services.capabilities).deleteCapability(input, ctx),
        ),
      // Discovery
      listByBusinessModule: standardProcedure
        .input(z.object({ userId: z.string().min(1), module: capabilityBusinessModuleEnum }))
        .query(({ input, ctx }) =>
          createCapabilitiesRouter(services.capabilities).listByBusinessModule(input, ctx),
        ),
      getDependencies: standardProcedure
        .input(z.object({ userId: z.string().min(1), id: z.string().min(1) }))
        .query(({ input, ctx }) =>
          createCapabilitiesRouter(services.capabilities).getDependencies(input, ctx),
        ),
      getTransitiveDependencies: standardProcedure
        .input(z.object({ userId: z.string().min(1), id: z.string().min(1) }))
        .query(({ input, ctx }) =>
          createCapabilitiesRouter(services.capabilities).getTransitiveDependencies(input, ctx),
        ),
      getCompositionTree: standardProcedure
        .input(z.object({ userId: z.string().min(1), id: z.string().min(1) }))
        .query(({ input, ctx }) =>
          createCapabilitiesRouter(services.capabilities).getCompositionTree(input, ctx),
        ),
      // Graph
      getGraph: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createCapabilitiesRouter(services.capabilities).getGraph(input, ctx),
        ),
      // Lifecycle & Versioning
      transitionStatus: standardProcedure
        .input(
          z.object({
            userId: z.string().min(1),
            id: z.string().min(1),
            to: capabilityStatusEnum,
          }),
        )
        .mutation(({ input, ctx }) =>
          createCapabilitiesRouter(services.capabilities).transitionStatus(input, ctx),
        ),
      createVersion: standardProcedure
        .input(
          z.object({
            userId: z.string().min(1),
            id: z.string().min(1),
            type: z.enum(['major', 'minor', 'patch']),
          }),
        )
        .mutation(({ input, ctx }) =>
          createCapabilitiesRouter(services.capabilities).createVersion(input, ctx),
        ),
    }),

    // ── Enterprise Provider Registry (EPIC-004 / EI-002) ────────────────────
    providers: router({
      // Marketplace
      getMarketplace: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createProvidersRouter(services.providers).getMarketplace(input, ctx),
        ),
      search: standardProcedure
        .input(providerSearchInput)
        .query(({ input, ctx }) => createProvidersRouter(services.providers).search(input, ctx)),
      // Registry
      getProvider: standardProcedure
        .input(z.object({ userId: z.string().min(1), id: z.string().min(1) }))
        .query(({ input, ctx }) =>
          createProvidersRouter(services.providers).getProvider(input, ctx),
        ),
      registerProvider: standardProcedure
        .input(providerRegisterInput)
        .mutation(({ input, ctx }) =>
          createProvidersRouter(services.providers).registerProvider(input, ctx),
        ),
      updateProvider: standardProcedure
        .input(providerUpdateInput)
        .mutation(({ input, ctx }) =>
          createProvidersRouter(services.providers).updateProvider(input, ctx),
        ),
      deleteProvider: standardProcedure
        .input(z.object({ userId: z.string().min(1), id: z.string().min(1) }))
        .mutation(({ input, ctx }) =>
          createProvidersRouter(services.providers).deleteProvider(input, ctx),
        ),
      // Lifecycle & Versioning
      transitionLifecycle: standardProcedure
        .input(
          z.object({
            userId: z.string().min(1),
            id: z.string().min(1),
            to: providerLifecycleEnum,
          }),
        )
        .mutation(({ input, ctx }) =>
          createProvidersRouter(services.providers).transitionLifecycle(input, ctx),
        ),
      createVersion: standardProcedure
        .input(
          z.object({
            userId: z.string().min(1),
            id: z.string().min(1),
            type: z.enum(['major', 'minor', 'patch']),
          }),
        )
        .mutation(({ input, ctx }) =>
          createProvidersRouter(services.providers).createVersion(input, ctx),
        ),
      // Health
      recordHealthSample: standardProcedure
        .input(providerHealthSampleInput)
        .mutation(({ input, ctx }) =>
          createProvidersRouter(services.providers).recordHealthSample(input, ctx),
        ),
      getFleetHealth: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createProvidersRouter(services.providers).getFleetHealth(input, ctx),
        ),
      getAvailabilityTier: standardProcedure
        .input(z.object({ userId: z.string().min(1), id: z.string().min(1) }))
        .query(({ input, ctx }) =>
          createProvidersRouter(services.providers).getAvailabilityTier(input, ctx),
        ),
      // Capability matrix
      getCapabilityMatrix: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createProvidersRouter(services.providers).getCapabilityMatrix(input, ctx),
        ),
      setCapabilityMatrix: standardProcedure
        .input(
          z.object({
            userId: z.string().min(1),
            id: z.string().min(1),
            matrix: z.array(providerMatrixInput).min(1),
          }),
        )
        .mutation(({ input, ctx }) =>
          createProvidersRouter(services.providers).setCapabilityMatrix(input, ctx),
        ),
      getProvidersForCapability: standardProcedure
        .input(z.object({ userId: z.string().min(1), capability: capabilityAIFeatureEnum }))
        .query(({ input, ctx }) =>
          createProvidersRouter(services.providers).getProvidersForCapability(input, ctx),
        ),
      // Benchmark Datasets (definitions only — EI-002)
      getBenchmarkDatasets: standardProcedure
        .input(providerBenchmarkQueryInput)
        .query(({ input, ctx }) =>
          createProvidersRouter(services.providers).getBenchmarkDatasets(input, ctx),
        ),

      // Model Registry (every model across the fleet)
      getModelRegistry: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createProvidersRouter(services.providers).getModelRegistry(input, ctx),
        ),

      // Discovery
      listByFamily: standardProcedure
        .input(z.object({ userId: z.string().min(1), family: providerFamilyEnum }))
        .query(({ input, ctx }) =>
          createProvidersRouter(services.providers).listByFamily(input, ctx),
        ),
      listByCapability: standardProcedure
        .input(z.object({ userId: z.string().min(1), capability: capabilityAIFeatureEnum }))
        .query(({ input, ctx }) =>
          createProvidersRouter(services.providers).listByCapability(input, ctx),
        ),

      // Provider Intelligence (EPIC-012A — Phases 7–11): auto-derived
      // profiles with provenance, resource classification, hardware-aware
      // local fit, and fail-safe local runtime discovery.
      getIntelligenceProfile: standardProcedure
        .input(providerIntelligenceProfileInput)
        .query(({ input, ctx }) =>
          createProvidersRouter(services.providers).getIntelligenceProfile(input, ctx),
        ),
      // Provider Intelligence (EPIC-012B — refresh & staleness): cache-first
      // status with a staleness verdict, and an explicit safe refresh that
      // reports model deltas without ever deleting user configuration.
      getIntelligenceStatus: standardProcedure
        .input(providerIntelligenceStatusInput)
        .query(({ input, ctx }) =>
          createProvidersRouter(services.providers).getIntelligenceStatus(input, ctx),
        ),
      refreshIntelligence: standardProcedure
        .input(providerRefreshIntelligenceInput)
        .mutation(({ input, ctx }) =>
          createProvidersRouter(services.providers).refreshIntelligence(input, ctx),
        ),
      classifyModelResource: standardProcedure
        .input(providerResourceFactsInput)
        .query(({ input, ctx }) =>
          createProvidersRouter(services.providers).classifyModelResource(input, ctx),
        ),
      assessHardwareFit: standardProcedure
        .input(providerHardwareSpecInput)
        .query(({ input, ctx }) =>
          createProvidersRouter(services.providers).assessHardwareFit(input, ctx),
        ),
      discoverLocalModels: standardProcedure
        .input(providerLocalDiscoveryInput)
        .query(({ input, ctx }) =>
          createProvidersRouter(services.providers).discoverLocalModels(input, ctx),
        ),

      // EPIC-019 — runtime truth: per-family CONFIGURED / NOT_CONFIGURED /
      // UNSUPPORTED_RUNTIME / MOCK / DISABLED / ERROR from the same registry
      // the config layer, production validator and registration use. Key
      // names only — never secret values.
      getRuntimeStatus: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createProvidersRouter(services.providers).getRuntimeStatus(input, ctx),
        ),

      // SPRINT-049 — test connection for custom providers.
      testConnection: standardProcedure
        .input(
          z.object({
            userId: z.string().min(1),
            endpointUrl: z.string().min(1),
            apiKey: z.string().min(1),
            protocol: z.string().default('openai-compatible'),
          }),
        )
        .mutation(({ input, ctx }) =>
          createProvidersRouter(services.providers).testConnection(input, ctx),
        ),

      // EPIC-012A — Provider Experience (Phases 4–6 / 12–17): owner-scoped
      // AI Providers view model, preferences, usage & economics, and the
      // "Why this model?" selection explanation.
      getExperience: standardProcedure
        .input(providerPreferencesInput)
        .query(({ input, ctx }) =>
          createProvidersRouter(services.providers, services.providerExperience).getExperience(
            input,
            ctx,
          ),
        ),
      getPreferences: standardProcedure
        .input(providerPreferencesInput)
        .query(({ input, ctx }) =>
          createProvidersRouter(services.providers, services.providerExperience).getPreferences(
            input,
            ctx,
          ),
        ),
      setPreferences: standardProcedure
        .input(providerSetPreferencesInput)
        .mutation(({ input, ctx }) =>
          createProvidersRouter(services.providers, services.providerExperience).setPreferences(
            input,
            ctx,
          ),
        ),
      setProviderEnabled: standardProcedure
        .input(providerSetEnabledInput)
        .mutation(({ input, ctx }) =>
          createProvidersRouter(services.providers, services.providerExperience).setProviderEnabled(
            input,
            ctx,
          ),
        ),
      getUsageDetail: standardProcedure
        .input(providerPreferencesInput)
        .query(({ input, ctx }) =>
          createProvidersRouter(services.providers, services.providerExperience).getUsageDetail(
            input,
            ctx,
          ),
        ),
      explainModelSelection: standardProcedure
        .input(providerExplainSelectionInput)
        .mutation(({ input, ctx }) =>
          createProvidersRouter(
            services.providers,
            services.providerExperience,
          ).explainModelSelection(input, ctx),
        ),
    }),

    // ── AI World Discovery (EPIC-012C) ───────────────────────────────────
    // Continuous, bounded, evidence-first discovery of the AI ecosystem:
    // the bell panel (getWorld), the daily digest (getDigest), item list /
    // detail, owner-scoped attention actions (markRead / markAllRead /
    // setAction) and an explicit bounded refresh (runDiscovery — respects
    // the refresh interval, never an uncontrolled crawler). All procedures
    // are authenticated + rate-limited; per-user state is owner-scoped at
    // the service (IDOR refused by construction).
    aiWorld: router({
      getWorld: standardProcedure
        .input(userId)
        .query(({ input, ctx }) => createAIWorldRouter(services.aiWorld).getWorld(input, ctx)),
      getDigest: standardProcedure
        .input(userId)
        .query(({ input, ctx }) => createAIWorldRouter(services.aiWorld).getDigest(input, ctx)),
      list: standardProcedure
        .input(userId)
        .query(({ input, ctx }) => createAIWorldRouter(services.aiWorld).list(input, ctx)),
      getItem: standardProcedure
        .input(z.object({ userId: z.string().min(1), itemId: z.string().min(1).max(64) }))
        .query(({ input, ctx }) => createAIWorldRouter(services.aiWorld).getItem(input, ctx)),
      markRead: standardProcedure
        .input(z.object({ userId: z.string().min(1), itemId: z.string().min(1).max(64) }))
        .mutation(({ input, ctx }) => createAIWorldRouter(services.aiWorld).markRead(input, ctx)),
      markAllRead: standardProcedure
        .input(userId)
        .mutation(({ input, ctx }) =>
          createAIWorldRouter(services.aiWorld).markAllRead(input, ctx),
        ),
      setAction: standardProcedure
        .input(
          z.object({
            userId: z.string().min(1),
            itemId: z.string().min(1).max(64),
            action: z.enum(['none', 'watching', 'dismissed']),
          }),
        )
        .mutation(({ input, ctx }) => createAIWorldRouter(services.aiWorld).setAction(input, ctx)),
      runDiscovery: heavyProcedure
        .input(userId)
        .mutation(({ input, ctx }) =>
          createAIWorldRouter(services.aiWorld).runDiscovery(input, ctx),
        ),
    }),

    // ── AI Capability Marketplace & Factory Intelligence (EPIC-013) ────────
    // The capability.* namespace: plan (outcome → FactoryCapabilityPlan with
    // candidates, integration classes, automation boundaries, approvals and
    // evidence), getPlan / listPlans (owner-scoped, bounded history) and the
    // capabilities marketplace view. Consumes the existing provider registry,
    // AI World discovery and local-model discovery through narrow ports — no
    // duplicate intelligence, no fake automation. All procedures are
    // authenticated + rate-limited; plans are owner-scoped (IDOR refused).
    capability: router({
      plan: heavyProcedure
        .input(z.object({ userId: z.string().min(1), outcome: z.string().min(3).max(2000) }))
        .mutation(({ input, ctx }) =>
          createCapabilityMarketplaceRouter(services.capability).plan(input, ctx),
        ),
      getPlan: standardProcedure
        .input(z.object({ userId: z.string().min(1), planId: z.string().min(1).max(64) }))
        .query(({ input, ctx }) =>
          createCapabilityMarketplaceRouter(services.capability).getPlan(input, ctx),
        ),
      listPlans: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createCapabilityMarketplaceRouter(services.capability).listPlans(input, ctx),
        ),
      capabilities: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createCapabilityMarketplaceRouter(services.capability).capabilities(input, ctx),
        ),
    }),

    // ── Capability Execution Engine (EPIC-014) ──────────────────────────────
    // PLAN → EXECUTE → VERIFY. `start` turns an owner's real EPIC-013 plan
    // into a bounded run that executes every EXECUTABLE step through the
    // frozen AI runtime; `approve`/`reject` gate irreversible actions;
    // `completeHandoff` resumes after configure/manual/external steps;
    // `cancel` stops the run; `intelligence` and `preferenceLedger` expose
    // the Phase 4 run view and the Phase 5 provenance ledger. Ownership is
    // enforced at the service boundary AND by the auth IDOR guard.
    execution: router({
      start: heavyProcedure
        .input(z.object({ userId: z.string().min(1), planId: z.string().min(1).max(64) }))
        .mutation(({ input, ctx }) =>
          createExecutionBridgeRouter(services.executionRun).start(input, ctx),
        ),
      get: standardProcedure
        .input(z.object({ userId: z.string().min(1), executionId: z.string().min(1).max(64) }))
        .query(({ input, ctx }) =>
          createExecutionBridgeRouter(services.executionRun).get(input, ctx),
        ),
      list: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createExecutionBridgeRouter(services.executionRun).list(input, ctx),
        ),
      approve: standardProcedure
        .input(
          z.object({
            userId: z.string().min(1),
            executionId: z.string().min(1).max(64),
            stepId: z.string().min(1).max(64),
            note: z.string().max(500).optional(),
          }),
        )
        .mutation(({ input, ctx }) =>
          createExecutionBridgeRouter(services.executionRun).approve(input, ctx),
        ),
      reject: standardProcedure
        .input(
          z.object({
            userId: z.string().min(1),
            executionId: z.string().min(1).max(64),
            stepId: z.string().min(1).max(64),
            note: z.string().max(500).optional(),
          }),
        )
        .mutation(({ input, ctx }) =>
          createExecutionBridgeRouter(services.executionRun).reject(input, ctx),
        ),
      completeHandoff: standardProcedure
        .input(
          z.object({
            userId: z.string().min(1),
            executionId: z.string().min(1).max(64),
            stepId: z.string().min(1).max(64),
            note: z.string().max(500).optional(),
          }),
        )
        .mutation(({ input, ctx }) =>
          createExecutionBridgeRouter(services.executionRun).completeHandoff(input, ctx),
        ),
      cancel: standardProcedure
        .input(z.object({ userId: z.string().min(1), executionId: z.string().min(1).max(64) }))
        .mutation(({ input, ctx }) =>
          createExecutionBridgeRouter(services.executionRun).cancel(input, ctx),
        ),
      preferenceLedger: standardProcedure
        .input(
          z.object({
            userId: z.string().min(1),
            executionId: z.string().min(1).max(64).optional(),
          }),
        )
        .query(({ input, ctx }) =>
          createExecutionBridgeRouter(services.executionRun).preferenceLedger(input, ctx),
        ),
      intelligence: standardProcedure
        .input(z.object({ userId: z.string().min(1), executionId: z.string().min(1).max(64) }))
        .query(({ input, ctx }) =>
          createExecutionBridgeRouter(services.executionRun).intelligence(input, ctx),
        ),
    }),

    // ── Enterprise Context Registry (EPIC-004 / EI-003) ────────────────────
    context: router({
      // Registry
      getContext: standardProcedure
        .input(z.object({ userId: z.string().min(1), id: z.string().min(1) }))
        .query(({ input, ctx }) => createContextRouter(services.context).getContext(input, ctx)),
      registerContext: standardProcedure
        .input(contextRegisterInput)
        .mutation(({ input, ctx }) =>
          createContextRouter(services.context).registerContext(input, ctx),
        ),
      bulkRegisterContext: standardProcedure
        .input(contextBulkRegisterInput)
        .mutation(({ input, ctx }) =>
          createContextRouter(services.context).bulkRegisterContext(input, ctx),
        ),
      deleteContext: standardProcedure
        .input(z.object({ userId: z.string().min(1), id: z.string().min(1) }))
        .mutation(({ input, ctx }) =>
          createContextRouter(services.context).deleteContext(input, ctx),
        ),
      getSummary: standardProcedure
        .input(userId)
        .query(({ input, ctx }) => createContextRouter(services.context).getSummary(input, ctx)),
      getMetrics: standardProcedure
        .input(userId)
        .query(({ input, ctx }) => createContextRouter(services.context).getMetrics(input, ctx)),
      // Intelligence pipeline
      rank: heavyProcedure
        .input(contextRankInput)
        .query(({ input, ctx }) => createContextRouter(services.context).rank(input, ctx)),
      filter: heavyProcedure
        .input(contextQueryInput)
        .query(({ input, ctx }) => createContextRouter(services.context).filter(input, ctx)),
      compress: heavyProcedure
        .input(contextCompressInput)
        .query(({ input, ctx }) => createContextRouter(services.context).compress(input, ctx)),
      assemble: heavyProcedure
        .input(contextAssembleInput)
        .query(({ input, ctx }) => createContextRouter(services.context).assemble(input, ctx)),
      // Discovery
      discover: standardProcedure
        .input(
          contextQueryInput.extend({
            capability: capabilityAIFeatureEnum.optional(),
            businessContext: z.array(z.string()).optional(),
          }),
        )
        .query(({ input, ctx }) => createContextRouter(services.context).discover(input, ctx)),
      search: standardProcedure
        .input(contextQueryInput)
        .query(({ input, ctx }) => createContextRouter(services.context).search(input, ctx)),
      preview: standardProcedure
        .input(
          z.object({
            userId: z.string().min(1),
            id: z.string().min(1),
            capability: capabilityAIFeatureEnum.optional(),
          }),
        )
        .query(({ input, ctx }) => createContextRouter(services.context).preview(input, ctx)),
      explain: standardProcedure
        .input(contextExplainInput)
        .query(({ input, ctx }) => createContextRouter(services.context).explain(input, ctx)),
      // Lookups
      listBySource: standardProcedure
        .input(z.object({ userId: z.string().min(1), source: contextSourceEnum }))
        .query(({ input, ctx }) => createContextRouter(services.context).listBySource(input, ctx)),
      listByCategory: standardProcedure
        .input(z.object({ userId: z.string().min(1), category: contextCategoryEnum }))
        .query(({ input, ctx }) =>
          createContextRouter(services.context).listByCategory(input, ctx),
        ),
      listByPriority: standardProcedure
        .input(z.object({ userId: z.string().min(1), priority: contextPriorityEnum }))
        .query(({ input, ctx }) =>
          createContextRouter(services.context).listByPriority(input, ctx),
        ),
      listByCapability: standardProcedure
        .input(z.object({ userId: z.string().min(1), capability: capabilityAIFeatureEnum }))
        .query(({ input, ctx }) =>
          createContextRouter(services.context).listByCapability(input, ctx),
        ),
    }),

    // ── Enterprise Execution Strategy Engine (EPIC-004 / EI-004) ────────────
    executionStrategy: router({
      // Create & Validate
      createStrategy: heavyProcedure
        .input(strategyCreateInput)
        .mutation(({ input, ctx }) =>
          createExecutionStrategyRouter(services.executionStrategy).createStrategy(input, ctx),
        ),
      validateStrategy: standardProcedure
        .input(z.object({ userId: z.string().min(1), id: z.string().min(1) }))
        .mutation(({ input, ctx }) =>
          createExecutionStrategyRouter(services.executionStrategy).validateStrategy(input, ctx),
        ),
      // Retrieval
      getStrategy: standardProcedure
        .input(z.object({ userId: z.string().min(1), id: z.string().min(1) }))
        .query(({ input, ctx }) =>
          createExecutionStrategyRouter(services.executionStrategy).getStrategy(input, ctx),
        ),
      deleteStrategy: standardProcedure
        .input(z.object({ userId: z.string().min(1), id: z.string().min(1) }))
        .mutation(({ input, ctx }) =>
          createExecutionStrategyRouter(services.executionStrategy).deleteStrategy(input, ctx),
        ),
      // Search & List
      search: standardProcedure
        .input(strategySearchInput)
        .query(({ input, ctx }) =>
          createExecutionStrategyRouter(services.executionStrategy).search(input, ctx),
        ),
      list: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createExecutionStrategyRouter(services.executionStrategy).list(input, ctx),
        ),
      listByPriority: standardProcedure
        .input(z.object({ userId: z.string().min(1), priority: strategyPriorityEnum }))
        .query(({ input, ctx }) =>
          createExecutionStrategyRouter(services.executionStrategy).listByPriority(input, ctx),
        ),
      listByExecutionMode: standardProcedure
        .input(z.object({ userId: z.string().min(1), mode: executionModeEnum }))
        .query(({ input, ctx }) =>
          createExecutionStrategyRouter(services.executionStrategy).listByExecutionMode(input, ctx),
        ),
      listByCapability: standardProcedure
        .input(z.object({ userId: z.string().min(1), capability: capabilityAIFeatureEnum }))
        .query(({ input, ctx }) =>
          createExecutionStrategyRouter(services.executionStrategy).listByCapability(input, ctx),
        ),
      listByGoal: standardProcedure
        .input(z.object({ userId: z.string().min(1), goalId: z.string().min(1) }))
        .query(({ input, ctx }) =>
          createExecutionStrategyRouter(services.executionStrategy).listByGoal(input, ctx),
        ),
      // Explain
      explain: standardProcedure
        .input(z.object({ userId: z.string().min(1), id: z.string().min(1) }))
        .query(({ input, ctx }) =>
          createExecutionStrategyRouter(services.executionStrategy).explain(input, ctx),
        ),
      // Estimates
      estimateTokens: standardProcedure
        .input(strategyEstimateInput)
        .query(({ input, ctx }) =>
          createExecutionStrategyRouter(services.executionStrategy).estimateTokens(input, ctx),
        ),
      estimateCost: standardProcedure
        .input(strategyEstimateInput)
        .query(({ input, ctx }) =>
          createExecutionStrategyRouter(services.executionStrategy).estimateCost(input, ctx),
        ),
      estimateLatency: standardProcedure
        .input(strategyEstimateInput)
        .query(({ input, ctx }) =>
          createExecutionStrategyRouter(services.executionStrategy).estimateLatency(input, ctx),
        ),
      // Summary
      getSummary: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createExecutionStrategyRouter(services.executionStrategy).getSummary(input, ctx),
        ),
    }),

    // ── Execution Orchestrator (EPIC-004 / EI-005) ──────────────────────────
    executionOrchestrator: router({
      // Graph
      buildExecutionGraph: heavyProcedure
        .input(orchestratorBuildInput)
        .mutation(({ input, ctx }) =>
          createOrchestratorRouter(services.executionOrchestrator).buildExecutionGraph(input, ctx),
        ),
      validateExecutionGraph: standardProcedure
        .input(orchestratorGraphIdInput)
        .mutation(({ input, ctx }) =>
          createOrchestratorRouter(services.executionOrchestrator).validateExecutionGraph(
            input,
            ctx,
          ),
        ),
      optimizeExecutionGraph: standardProcedure
        .input(orchestratorGraphIdInput)
        .mutation(({ input, ctx }) =>
          createOrchestratorRouter(services.executionOrchestrator).optimizeExecutionGraph(
            input,
            ctx,
          ),
        ),
      getGraph: standardProcedure
        .input(orchestratorGraphIdInput)
        .query(({ input, ctx }) =>
          createOrchestratorRouter(services.executionOrchestrator).getGraph(input, ctx),
        ),
      explainExecutionGraph: standardProcedure
        .input(orchestratorGraphIdInput)
        .query(({ input, ctx }) =>
          createOrchestratorRouter(services.executionOrchestrator).explainExecutionGraph(
            input,
            ctx,
          ),
        ),
      // Sessions
      createExecutionSession: heavyProcedure
        .input(orchestratorBuildInput)
        .mutation(({ input, ctx }) =>
          createOrchestratorRouter(services.executionOrchestrator).createExecutionSession(
            input,
            ctx,
          ),
        ),
      pauseSession: standardProcedure
        .input(orchestratorSessionIdInput)
        .mutation(({ input, ctx }) =>
          createOrchestratorRouter(services.executionOrchestrator).pauseSession(input, ctx),
        ),
      resumeSession: standardProcedure
        .input(orchestratorSessionIdInput)
        .mutation(({ input, ctx }) =>
          createOrchestratorRouter(services.executionOrchestrator).resumeSession(input, ctx),
        ),
      cancelSession: standardProcedure
        .input(orchestratorSessionIdInput)
        .mutation(({ input, ctx }) =>
          createOrchestratorRouter(services.executionOrchestrator).cancelSession(input, ctx),
        ),
      listSessions: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createOrchestratorRouter(services.executionOrchestrator).listSessions(input, ctx),
        ),
      getSession: standardProcedure
        .input(orchestratorSessionIdInput)
        .query(({ input, ctx }) =>
          createOrchestratorRouter(services.executionOrchestrator).getSession(input, ctx),
        ),
      // Supporting views
      getMonitorSnapshot: standardProcedure
        .input(orchestratorSessionIdInput)
        .query(({ input, ctx }) =>
          createOrchestratorRouter(services.executionOrchestrator).getMonitorSnapshot(input, ctx),
        ),
      planRecovery: standardProcedure
        .input(
          z.object({
            userId: z.string().min(1),
            sessionId: z.string().min(1),
            failedNodeId: z.string().optional(),
          }),
        )
        .query(({ input, ctx }) =>
          createOrchestratorRouter(services.executionOrchestrator).planRecovery(input, ctx),
        ),
      getQueue: standardProcedure
        .input(orchestratorSessionIdInput)
        .query(({ input, ctx }) =>
          createOrchestratorRouter(services.executionOrchestrator).getQueue(input, ctx),
        ),
      listWorkers: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createOrchestratorRouter(services.executionOrchestrator).listWorkers(input, ctx),
        ),
      getSummary: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createOrchestratorRouter(services.executionOrchestrator).getSummary(input, ctx),
        ),
    }),

    // ── Goal & Task Intelligence (EPIC-004 / EI-006) ────────────────────────
    goals: router({
      // SPRINT-023 — typed problem understanding (the front door of the
      // problem→outcome flow). Deterministic (no AI calls) → standard tier.
      understandProblem: standardProcedure
        .input(goalProblemInput)
        .query(({ input, ctx }) => createGoalsRouter(services.goals).understandProblem(input, ctx)),
      createGoal: heavyProcedure
        .input(goalCreateInput)
        .mutation(({ input, ctx }) => createGoalsRouter(services.goals).createGoal(input, ctx)),
      analyzeGoal: standardProcedure
        .input(goalIdInput)
        .mutation(({ input, ctx }) => createGoalsRouter(services.goals).analyzeGoal(input, ctx)),
      generateTasks: standardProcedure
        .input(goalIdInput)
        .mutation(({ input, ctx }) => createGoalsRouter(services.goals).generateTasks(input, ctx)),
      validateGoal: standardProcedure
        .input(goalIdInput)
        .mutation(({ input, ctx }) => createGoalsRouter(services.goals).validateGoal(input, ctx)),
      explainGoal: standardProcedure
        .input(goalIdInput)
        .query(({ input, ctx }) => createGoalsRouter(services.goals).explainGoal(input, ctx)),
      getGoal: standardProcedure
        .input(goalIdInput)
        .query(({ input, ctx }) => createGoalsRouter(services.goals).getGoal(input, ctx)),
      listGoals: standardProcedure
        .input(userId)
        .query(({ input, ctx }) => createGoalsRouter(services.goals).listGoals(input, ctx)),
      searchGoals: standardProcedure
        .input(goalSearchInput)
        .query(({ input, ctx }) => createGoalsRouter(services.goals).searchGoals(input, ctx)),
      getTaskGraph: standardProcedure
        .input(goalIdInput)
        .query(({ input, ctx }) => createGoalsRouter(services.goals).getTaskGraph(input, ctx)),
      listTasks: standardProcedure
        .input(goalIdInput)
        .query(({ input, ctx }) => createGoalsRouter(services.goals).listTasks(input, ctx)),
      transitionGoal: standardProcedure
        .input(goalLifecycleInput)
        .mutation(({ input, ctx }) => createGoalsRouter(services.goals).transitionGoal(input, ctx)),
      buildStrategyHandoff: standardProcedure
        .input(goalIdInput)
        .query(({ input, ctx }) =>
          createGoalsRouter(services.goals).buildStrategyHandoff(input, ctx),
        ),
      getSummary: standardProcedure
        .input(userId)
        .query(({ input, ctx }) => createGoalsRouter(services.goals).getSummary(input, ctx)),
    }),

    // ── Enterprise Intelligence Integration (EPIC-004 / EI-006 / INT-001) ──
    intelligence: router({
      buildPipeline: heavyProcedure
        .input(z.object({ userId: z.string().min(1), goalId: z.string().min(1) }))
        .mutation(({ input, ctx }) =>
          createIntelligenceRouter(services.intelligence).buildPipeline(input, ctx),
        ),
      validatePipeline: standardProcedure
        .input(z.object({ userId: z.string().min(1), pipelineId: z.string().min(1) }))
        .query(({ input, ctx }) =>
          createIntelligenceRouter(services.intelligence).validatePipeline(input, ctx),
        ),
      explainPipeline: standardProcedure
        .input(z.object({ userId: z.string().min(1), pipelineId: z.string().min(1) }))
        .query(({ input, ctx }) =>
          createIntelligenceRouter(services.intelligence).explainPipeline(input, ctx),
        ),
      getPipeline: standardProcedure
        .input(z.object({ userId: z.string().min(1), pipelineId: z.string().min(1) }))
        .query(({ input, ctx }) =>
          createIntelligenceRouter(services.intelligence).getPipeline(input, ctx),
        ),
      listPipelines: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createIntelligenceRouter(services.intelligence).listPipelines(input, ctx),
        ),
      getDashboard: heavyProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createIntelligenceRouter(services.intelligence).getDashboard(input, ctx),
        ),
    }),

    // ── Enterprise Learning Intelligence (EPIC-004 / EI-007) ─────────────────
    learningIntelligence: router({
      recordEvent: heavyProcedure
        .input(learningEventInput)
        .mutation(({ input, ctx }) =>
          createLearningIntelligenceRouter(services.learningIntelligence).recordEvent(input, ctx),
        ),
      listEvents: standardProcedure
        .input(learningEventQueryInput)
        .query(({ input, ctx }) =>
          createLearningIntelligenceRouter(services.learningIntelligence).listEvents(input, ctx),
        ),
      getEvent: standardProcedure
        .input(learningEventIdInput)
        .query(({ input, ctx }) =>
          createLearningIntelligenceRouter(services.learningIntelligence).getEvent(input, ctx),
        ),
      getTimeline: standardProcedure
        .input(learningTimelineInput)
        .query(({ input, ctx }) =>
          createLearningIntelligenceRouter(services.learningIntelligence).getTimeline(input, ctx),
        ),
      getModels: standardProcedure
        .input(learningCategoryQueryInput)
        .query(({ input, ctx }) =>
          createLearningIntelligenceRouter(services.learningIntelligence).getModels(input, ctx),
        ),
      getInsights: standardProcedure
        .input(learningCategoryQueryInput)
        .query(({ input, ctx }) =>
          createLearningIntelligenceRouter(services.learningIntelligence).getInsights(input, ctx),
        ),
      getRecommendations: standardProcedure
        .input(learningCategoryQueryInput)
        .query(({ input, ctx }) =>
          createLearningIntelligenceRouter(services.learningIntelligence).getRecommendations(
            input,
            ctx,
          ),
        ),
      getRecommendation: standardProcedure
        .input(learningRecommendationIdInput)
        .query(({ input, ctx }) =>
          createLearningIntelligenceRouter(services.learningIntelligence).getRecommendation(
            input,
            ctx,
          ),
        ),
      approveRecommendation: heavyProcedure
        .input(learningDecisionInput)
        .mutation(({ input, ctx }) =>
          createLearningIntelligenceRouter(services.learningIntelligence).approveRecommendation(
            input,
            ctx,
          ),
        ),
      rejectRecommendation: heavyProcedure
        .input(learningDecisionInput)
        .mutation(({ input, ctx }) =>
          createLearningIntelligenceRouter(services.learningIntelligence).rejectRecommendation(
            input,
            ctx,
          ),
        ),
      rollbackRecommendation: heavyProcedure
        .input(learningDecisionInput)
        .mutation(({ input, ctx }) =>
          createLearningIntelligenceRouter(services.learningIntelligence).rollbackRecommendation(
            input,
            ctx,
          ),
        ),
      getAnalytics: standardProcedure
        .input(learningCategoryQueryInput)
        .query(({ input, ctx }) =>
          createLearningIntelligenceRouter(services.learningIntelligence).getAnalytics(input, ctx),
        ),
      getReports: standardProcedure
        .input(learningCategoryQueryInput)
        .query(({ input, ctx }) =>
          createLearningIntelligenceRouter(services.learningIntelligence).getReports(input, ctx),
        ),
      getDashboard: heavyProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createLearningIntelligenceRouter(services.learningIntelligence).getDashboard(input, ctx),
        ),
    }),

    // ── Enterprise Brain (EPIC-004 / EI-008) ───────────────────────────────
    //    The highest decision layer — decides, never executes. Plans and
    //    decisions require human approval before they are handed to the
    //    Execution Orchestrator.
    enterpriseBrain: router({
      decideGoal: heavyProcedure
        .input(brainDecideGoalInput)
        .mutation(({ input, ctx }) =>
          createEnterpriseBrainRouter(services.enterpriseBrain).decideGoal(input, ctx),
        ),
      getPlan: standardProcedure
        .input(brainPlanIdInput)
        .query(({ input, ctx }) =>
          createEnterpriseBrainRouter(services.enterpriseBrain).getPlan(input, ctx),
        ),
      listPlans: standardProcedure
        .input(brainListPlansInput)
        .query(({ input, ctx }) =>
          createEnterpriseBrainRouter(services.enterpriseBrain).listPlans(input, ctx),
        ),
      listDecisions: standardProcedure
        .input(brainListDecisionsInput)
        .query(({ input, ctx }) =>
          createEnterpriseBrainRouter(services.enterpriseBrain).listDecisions(input, ctx),
        ),
      getDecision: standardProcedure
        .input(brainDecisionIdInput)
        .query(({ input, ctx }) =>
          createEnterpriseBrainRouter(services.enterpriseBrain).getDecision(input, ctx),
        ),
      getTimeline: standardProcedure
        .input(brainTimelineInput)
        .query(({ input, ctx }) =>
          createEnterpriseBrainRouter(services.enterpriseBrain).getTimeline(input, ctx),
        ),
      getHistory: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createEnterpriseBrainRouter(services.enterpriseBrain).getHistory(input, ctx),
        ),
      approveDecision: heavyProcedure
        .input(brainDecisionActionInput)
        .mutation(({ input, ctx }) =>
          createEnterpriseBrainRouter(services.enterpriseBrain).approveDecision(input, ctx),
        ),
      rejectDecision: heavyProcedure
        .input(brainDecisionActionInput)
        .mutation(({ input, ctx }) =>
          createEnterpriseBrainRouter(services.enterpriseBrain).rejectDecision(input, ctx),
        ),
      approvePlan: heavyProcedure
        .input(brainPlanActionInput)
        .mutation(({ input, ctx }) =>
          createEnterpriseBrainRouter(services.enterpriseBrain).approvePlan(input, ctx),
        ),
      rejectPlan: heavyProcedure
        .input(brainPlanActionInput)
        .mutation(({ input, ctx }) =>
          createEnterpriseBrainRouter(services.enterpriseBrain).rejectPlan(input, ctx),
        ),
      handOffPlan: heavyProcedure
        .input(brainPlanActionInput)
        .mutation(({ input, ctx }) =>
          createEnterpriseBrainRouter(services.enterpriseBrain).handOffPlan(input, ctx),
        ),
      getMetrics: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createEnterpriseBrainRouter(services.enterpriseBrain).getMetrics(input, ctx),
        ),
      getDashboard: heavyProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createEnterpriseBrainRouter(services.enterpriseBrain).getDashboard(input, ctx),
        ),
    }),

    // ── The VedMoulya Brain (EPIC-016) ────────────────────────────────────
    //    The central intelligence & orchestration coordinator. brain.*
    //    procedures: createTask (understand) → plan (EPIC-013 capability
    //    plan) → selectResources (N-provider role assignment) → execute
    //    (bounded, through the frozen runtime) → verify → result; plus
    //    sensitive-action approval gates, owner-scoped reads, cancel and
    //    the outcome-learning feed. Every procedure is authenticated +
    //    rate-limited; ownership is enforced at the service (IDOR refused)
    //    and by the auth middleware.
    brain: router({
      createTask: standardProcedure
        .input(brainCreateTaskInput)
        .mutation(({ input, ctx }) =>
          createBrainRouter(services.brain, services.brainDashboard).createTask(input, ctx),
        ),
      plan: heavyProcedure
        .input(brainTaskIdInput)
        .mutation(({ input, ctx }) =>
          createBrainRouter(services.brain, services.brainDashboard).plan(input, ctx),
        ),
      selectResources: heavyProcedure
        .input(brainTaskIdInput)
        .mutation(({ input, ctx }) =>
          createBrainRouter(services.brain, services.brainDashboard).selectResources(input, ctx),
        ),
      execute: heavyProcedure
        .input(brainTaskIdInput)
        .mutation(({ input, ctx }) =>
          createBrainRouter(services.brain, services.brainDashboard).execute(input, ctx),
        ),
      verify: standardProcedure
        .input(brainTaskIdInput)
        .query(({ input, ctx }) =>
          createBrainRouter(services.brain, services.brainDashboard).verify(input, ctx),
        ),
      requestApproval: standardProcedure
        .input(brainApprovalInput)
        .mutation(({ input, ctx }) =>
          createBrainRouter(services.brain, services.brainDashboard).requestApproval(input, ctx),
        ),
      approve: standardProcedure
        .input(brainApprovalInput)
        .mutation(({ input, ctx }) =>
          createBrainRouter(services.brain, services.brainDashboard).approve(input, ctx),
        ),
      reject: standardProcedure
        .input(brainApprovalInput)
        .mutation(({ input, ctx }) =>
          createBrainRouter(services.brain, services.brainDashboard).reject(input, ctx),
        ),
      getStatus: standardProcedure
        .input(brainTaskIdInput)
        .query(({ input, ctx }) =>
          createBrainRouter(services.brain, services.brainDashboard).getStatus(input, ctx),
        ),
      listTasks: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createBrainRouter(services.brain, services.brainDashboard).listTasks(input, ctx),
        ),
      getDecisionRecords: standardProcedure
        .input(brainTaskIdInput)
        .query(({ input, ctx }) =>
          createBrainRouter(services.brain, services.brainDashboard).getDecisionRecords(input, ctx),
        ),
      cancel: standardProcedure
        .input(brainTaskIdInput)
        .mutation(({ input, ctx }) =>
          createBrainRouter(services.brain, services.brainDashboard).cancel(input, ctx),
        ),
      evaluateOutcome: standardProcedure
        .input(brainOutcomeInput)
        .mutation(({ input, ctx }) =>
          createBrainRouter(services.brain, services.brainDashboard).evaluateOutcome(input, ctx),
        ),
      // SPRINT-025 — user correction loop (EXPLICIT > INFERRED)
      correctLearning: standardProcedure
        .input(brainCorrectionInput)
        .mutation(({ input, ctx }) =>
          createBrainRouter(services.brain, services.brainDashboard).correctLearning(input, ctx),
        ),
      // ── EPIC-020 (Outcome & Revenue layer) — Today's Top 5 (§8) ──
      dailyPriorities: standardProcedure
        .input(brainDailyPrioritiesInput)
        .query(({ input, ctx }) =>
          createBrainRouter(services.brain, services.brainDashboard).dailyPriorities(input, ctx),
        ),
      // ── EPIC-020 — Continuous Intelligence & Adaptive Orchestration ──
      discoverIntelligence: heavyProcedure
        .input(userId)
        .mutation(({ input, ctx }) =>
          createBrainRouter(services.brain, services.brainDashboard).discoverIntelligence(
            input,
            ctx,
          ),
        ),
      listOpportunities: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createBrainRouter(services.brain, services.brainDashboard).listOpportunities(input, ctx),
        ),
      updateOpportunity: standardProcedure
        .input(brainOpportunityInput)
        .mutation(({ input, ctx }) =>
          createBrainRouter(services.brain, services.brainDashboard).updateOpportunity(input, ctx),
        ),
      listIntelligenceEvents: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createBrainRouter(services.brain, services.brainDashboard).listIntelligenceEvents(
            input,
            ctx,
          ),
        ),
      updateIntelligenceEvent: standardProcedure
        .input(brainIntelligenceEventInput)
        .mutation(({ input, ctx }) =>
          createBrainRouter(services.brain, services.brainDashboard).updateIntelligenceEvent(
            input,
            ctx,
          ),
        ),
      providerScores: standardProcedure
        .input(brainProviderScoresInput)
        .query(({ input, ctx }) =>
          createBrainRouter(services.brain, services.brainDashboard).providerScores(input, ctx),
        ),
      dashboard: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createBrainRouter(services.brain, services.brainDashboard).dashboard(input, ctx),
        ),
    }),

    // ── VedMoulya Intelligence — GitHub (EPIC-015) ────────────────────────
    //    Connect GitHub SEPARATELY from Google auth (GitHub App architecture,
    //    least privilege): the user reviews the requested permissions before
    //    anything is granted; private repo + write scopes are NEVER silent;
    //    public discovery needs no repo access at all. Tokens never cross the
    //    gateway (server-side adapter only).
    github: router({
      getConnection: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createEcosystemIntelligenceRouter(services.ecosystemIntelligence).getGitHubConnection(
            input,
            ctx,
          ),
        ),
      getPermissions: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createEcosystemIntelligenceRouter(services.ecosystemIntelligence).getGitHubPermissions(
            input,
            ctx,
          ),
        ),
      beginConnect: heavyProcedure
        .input(githubConnectInput)
        .mutation(({ input, ctx }) =>
          createEcosystemIntelligenceRouter(services.ecosystemIntelligence).beginGitHubConnect(
            input,
            ctx,
          ),
        ),
      completeAuth: heavyProcedure
        .input(githubCompleteAuthInput)
        .mutation(({ input, ctx }) =>
          createEcosystemIntelligenceRouter(
            services.ecosystemIntelligence,
          ).completeGitHubAuthorization(input, ctx),
        ),
      verify: standardProcedure
        .input(userId)
        .mutation(({ input, ctx }) =>
          createEcosystemIntelligenceRouter(services.ecosystemIntelligence).verifyGitHub(
            input,
            ctx,
          ),
        ),
      revoke: heavyProcedure
        .input(userId)
        .mutation(({ input, ctx }) =>
          createEcosystemIntelligenceRouter(services.ecosystemIntelligence).revokeGitHub(
            input,
            ctx,
          ),
        ),
      disconnect: heavyProcedure
        .input(userId)
        .mutation(({ input, ctx }) =>
          createEcosystemIntelligenceRouter(services.ecosystemIntelligence).disconnectGitHub(
            input,
            ctx,
          ),
        ),
      listRepositories: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createEcosystemIntelligenceRouter(services.ecosystemIntelligence).listGitHubRepositories(
            input,
            ctx,
          ),
        ),
    }),

    // ── VedMoulya Intelligence (EPIC-015) ──────────────────────────────────
    //    "For THIS task, is something significantly better available?" —
    //    quality-first across configured providers, free providers, local
    //    models, GitHub projects and paid providers. Every better option that
    //    needs activation becomes an APPROVAL recommendation (never auto-)
    //    with an honest fallback. Security/license gates and the acquisition
    //    pipeline run before anything is acquired — read ≠ execute ≠ install.
    //    Lifecycle memory preserves provenance; deprecated resources are never
    //    silently deleted. (Namespace is ecosystemIntelligence because
    //    `intelligence.*` is the frozen EPIC-004 platform router.)
    ecosystemIntelligence: router({
      findBetterOption: heavyProcedure
        .input(intelligenceBetterOptionInput)
        .query(({ input, ctx }) =>
          createEcosystemIntelligenceRouter(services.ecosystemIntelligence).findBetterOption(
            input,
            ctx,
          ),
        ),
      findFreeAlternative: standardProcedure
        .input(intelligenceCapabilityInput)
        .query(({ input, ctx }) =>
          createEcosystemIntelligenceRouter(services.ecosystemIntelligence).findFreeAlternative(
            input,
            ctx,
          ),
        ),
      findLocalAlternative: standardProcedure
        .input(intelligenceCapabilityInput)
        .query(({ input, ctx }) =>
          createEcosystemIntelligenceRouter(services.ecosystemIntelligence).findLocalAlternative(
            input,
            ctx,
          ),
        ),
      findGitHubCapability: standardProcedure
        .input(intelligenceCapabilityInput)
        .query(({ input, ctx }) =>
          createEcosystemIntelligenceRouter(services.ecosystemIntelligence).findGitHubCapability(
            input,
            ctx,
          ),
        ),
      findBetterProvider: standardProcedure
        .input(intelligenceCapabilityInput)
        .query(({ input, ctx }) =>
          createEcosystemIntelligenceRouter(services.ecosystemIntelligence).findBetterProvider(
            input,
            ctx,
          ),
        ),
      evaluateSecurity: standardProcedure
        .input(intelligenceResourceInput)
        .query(({ input, ctx }) =>
          createEcosystemIntelligenceRouter(services.ecosystemIntelligence).evaluateSecurity(
            input,
            ctx,
          ),
        ),
      evaluateLicense: standardProcedure
        .input(intelligenceLicenseInput)
        .query(({ input, ctx }) =>
          createEcosystemIntelligenceRouter(services.ecosystemIntelligence).evaluateLicense(
            input,
            ctx,
          ),
        ),
      checkCapabilityFreshness: standardProcedure
        .input(intelligenceResourceInput)
        .query(({ input, ctx }) =>
          createEcosystemIntelligenceRouter(
            services.ecosystemIntelligence,
          ).checkCapabilityFreshness(input, ctx),
        ),
      getAcquisitionPlan: heavyProcedure
        .input(intelligenceAcquisitionInput)
        .query(({ input, ctx }) =>
          createEcosystemIntelligenceRouter(services.ecosystemIntelligence).getAcquisitionPlan(
            input,
            ctx,
          ),
        ),
      approveAcquisition: heavyProcedure
        .input(intelligenceRepositoryInput)
        .mutation(({ input, ctx }) =>
          createEcosystemIntelligenceRouter(services.ecosystemIntelligence).approveAcquisition(
            input,
            ctx,
          ),
        ),
      rejectAcquisition: heavyProcedure
        .input(intelligenceRepositoryInput)
        .mutation(({ input, ctx }) =>
          createEcosystemIntelligenceRouter(services.ecosystemIntelligence).rejectAcquisition(
            input,
            ctx,
          ),
        ),
      respondToRecommendation: standardProcedure
        .input(intelligenceRecommendationInput)
        .mutation(({ input, ctx }) =>
          createEcosystemIntelligenceRouter(services.ecosystemIntelligence).respondToRecommendation(
            input,
            ctx,
          ),
        ),
      listLifecycle: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createEcosystemIntelligenceRouter(services.ecosystemIntelligence).listLifecycle(
            input,
            ctx,
          ),
        ),
      getLifecycle: standardProcedure
        .input(intelligenceResourceInput)
        .query(({ input, ctx }) =>
          createEcosystemIntelligenceRouter(services.ecosystemIntelligence).getLifecycle(
            input,
            ctx,
          ),
        ),
      listNotifications: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createEcosystemIntelligenceRouter(services.ecosystemIntelligence).listNotifications(
            input,
            ctx,
          ),
        ),
      markNotificationRead: standardProcedure
        .input(intelligenceNotificationReadInput)
        .mutation(({ input, ctx }) =>
          createEcosystemIntelligenceRouter(services.ecosystemIntelligence).markNotificationRead(
            input,
            ctx,
          ),
        ),
    }),

    // ── Ecosystem Workflow Execution (SPRINT-052) ─────────────────────────
    //    Controlled multi-step workflow execution with human approval.
    //    Owner-scoped, auth-enforced, rate-limited.
    ecosystemWorkflow: router({
      start: standardProcedure
        .input(z.object({ userId: z.string().min(1), workflowId: z.string().min(1) }))
        .mutation(({ input, ctx }) => {
          const svc = services.ecosystemWorkflow;
          return svc.start({ workflowId: input.workflowId, ownerId: ctx.userId });
        }),
      get: standardProcedure
        .input(z.object({ userId: z.string().min(1), executionId: z.string().min(1) }))
        .query(({ input, ctx }) => {
          const svc = services.ecosystemWorkflow;
          return svc.get(input.executionId, ctx.userId);
        }),
      list: standardProcedure.input(z.object({ userId: z.string().min(1) })).query(({ ctx }) => {
        const svc = services.ecosystemWorkflow;
        return svc.list(ctx.userId);
      }),
      approve: standardProcedure
        .input(
          z.object({
            userId: z.string().min(1),
            executionId: z.string().min(1),
            stepId: z.string().min(1),
            note: z.string().max(500).optional(),
          }),
        )
        .mutation(({ input, ctx }) => {
          const svc = services.ecosystemWorkflow;
          return svc.approve(input.executionId, ctx.userId, input.stepId, input.note);
        }),
      reject: standardProcedure
        .input(
          z.object({
            userId: z.string().min(1),
            executionId: z.string().min(1),
            stepId: z.string().min(1),
            note: z.string().max(500).optional(),
          }),
        )
        .mutation(({ input, ctx }) => {
          const svc = services.ecosystemWorkflow;
          return svc.reject(input.executionId, ctx.userId, input.stepId, input.note);
        }),
      pause: standardProcedure
        .input(z.object({ userId: z.string().min(1), executionId: z.string().min(1) }))
        .mutation(({ input, ctx }) => {
          const svc = services.ecosystemWorkflow;
          return svc.pause(input.executionId, ctx.userId);
        }),
      resume: standardProcedure
        .input(z.object({ userId: z.string().min(1), executionId: z.string().min(1) }))
        .mutation(({ input, ctx }) => {
          const svc = services.ecosystemWorkflow;
          return svc.resume(input.executionId, ctx.userId);
        }),
      cancel: standardProcedure
        .input(z.object({ userId: z.string().min(1), executionId: z.string().min(1) }))
        .mutation(({ input, ctx }) => {
          const svc = services.ecosystemWorkflow;
          return svc.cancel(input.executionId, ctx.userId);
        }),
      listWorkflows: standardProcedure.input(z.object({ userId: z.string().min(1) })).query(() => {
        return {
          success: true,
          data: [
            {
              id: 'certification-knowledge-summary',
              name: 'Personal Knowledge Summary',
              outcome: 'Produce a grounded summary from user-supplied text',
              steps: 4,
              approvalGates: 1,
              riskLevel: 'MEDIUM',
              status: 'ACTIVE',
              agents: ['certification-agent'],
              type: 'single-agent',
            },
            {
              id: 'multi-agent-research-summary',
              name: 'Opportunity Research & Summary',
              outcome: 'Multi-agent research, analysis, and summary of a topic',
              steps: 5,
              approvalGates: 1,
              riskLevel: 'MEDIUM',
              status: 'ACTIVE',
              agents: ['research-agent', 'analysis-agent', 'summary-agent', 'verification-agent'],
              type: 'multi-agent',
            },
          ],
        };
      }),
      getWorkflow: standardProcedure
        .input(z.object({ userId: z.string().min(1), workflowId: z.string().min(1) }))
        .query(({ input }) => {
          if (input.workflowId === 'certification-knowledge-summary') {
            return {
              success: true,
              data: {
                id: 'certification-knowledge-summary',
                name: 'Personal Knowledge Summary',
                outcome: 'Produce a grounded summary from user-supplied text',
                steps: [
                  {
                    id: 'step-collect',
                    title: 'Collect Content',
                    purpose: 'Read and validate the supplied text content',
                    riskLevel: 'LOW',
                    approvalPolicy: 'AUTO',
                    agent: 'certification-agent',
                  },
                  {
                    id: 'step-analyze',
                    title: 'AI Analysis',
                    purpose: 'Analyze the content and produce a structured summary',
                    riskLevel: 'LOW',
                    approvalPolicy: 'AUTO',
                    agent: 'certification-agent',
                  },
                  {
                    id: 'step-approval',
                    title: 'Review Summary',
                    purpose: 'The AI has prepared a summary. Continue to final verification?',
                    riskLevel: 'MEDIUM',
                    approvalPolicy: 'HUMAN_APPROVAL_REQUIRED',
                    agent: null,
                  },
                  {
                    id: 'step-verify',
                    title: 'Final Verification',
                    purpose: 'Verify the summary is complete and present the final result',
                    riskLevel: 'LOW',
                    approvalPolicy: 'AUTO',
                    agent: 'certification-agent',
                  },
                ],
                approvalGates: ['step-approval'],
                riskLevel: 'MEDIUM',
              },
            };
          }
          if (input.workflowId === 'multi-agent-research-summary') {
            return {
              success: true,
              data: {
                id: 'multi-agent-research-summary',
                name: 'Opportunity Research & Summary',
                outcome: 'Multi-agent research, analysis, and summary of a topic',
                steps: [
                  {
                    id: 'step-research',
                    title: 'Research',
                    purpose: 'Gather relevant information and research findings',
                    riskLevel: 'LOW',
                    approvalPolicy: 'AUTO',
                    agent: 'research-agent',
                  },
                  {
                    id: 'step-analysis',
                    title: 'Analysis',
                    purpose: 'Analyze research findings and extract key insights',
                    riskLevel: 'LOW',
                    approvalPolicy: 'AUTO',
                    agent: 'analysis-agent',
                  },
                  {
                    id: 'step-summary',
                    title: 'Summary',
                    purpose: 'Produce a concise, well-structured summary',
                    riskLevel: 'LOW',
                    approvalPolicy: 'AUTO',
                    agent: 'summary-agent',
                  },
                  {
                    id: 'step-multi-approval',
                    title: 'Review Findings',
                    purpose: 'The agents have prepared findings. Continue to verification?',
                    riskLevel: 'MEDIUM',
                    approvalPolicy: 'HUMAN_APPROVAL_REQUIRED',
                    agent: null,
                  },
                  {
                    id: 'step-multi-verify',
                    title: 'Final Verification',
                    purpose: 'Verify the summary is complete and present the final result',
                    riskLevel: 'LOW',
                    approvalPolicy: 'AUTO',
                    agent: 'verification-agent',
                  },
                ],
                approvalGates: ['step-multi-approval'],
                riskLevel: 'MEDIUM',
              },
            };
          }
          return { success: false, error: `Workflow not found: ${input.workflowId}` };
        }),
    }),

    // ── Live Intelligence Bridge (EPIC-017) ────────────────────────────────
    //    Orchestrates the full loop through the EXISTING Brain (EPIC-016),
    //    Intelligence (EPIC-015), Marketplace (EPIC-013) and Execution
    //    (EPIC-014) services: start (understand) → discover → compare →
    //    recommend → approve / reject → handOff (configuration/execution) →
    //    verify → evaluateAndLearn (outcome + feedback + notification).
    //    Every procedure is authenticated + rate-limited; ownership is
    //    enforced at the service boundary (IDOR refused there) and by the
    //    auth middleware.
    liveIntelligence: router({
      start: heavyProcedure
        .input(z.object({ userId: z.string().min(1), objective: z.string().min(3).max(500) }))
        .mutation(({ input, ctx }) =>
          createLiveIntelligenceBridgeRouter(services.liveIntelligence).start(input, ctx),
        ),
      discover: heavyProcedure
        .input(bridgeLoopInput)
        .mutation(({ input, ctx }) =>
          createLiveIntelligenceBridgeRouter(services.liveIntelligence).discover(input, ctx),
        ),
      compare: heavyProcedure
        .input(bridgeLoopInput)
        .mutation(({ input, ctx }) =>
          createLiveIntelligenceBridgeRouter(services.liveIntelligence).compare(input, ctx),
        ),
      recommend: heavyProcedure
        .input(bridgeLoopInput)
        .mutation(({ input, ctx }) =>
          createLiveIntelligenceBridgeRouter(services.liveIntelligence).recommend(input, ctx),
        ),
      approve: heavyProcedure
        .input(bridgeRecommendationInput)
        .mutation(({ input, ctx }) =>
          createLiveIntelligenceBridgeRouter(services.liveIntelligence).approve(input, ctx),
        ),
      reject: heavyProcedure
        .input(bridgeRecommendationInput)
        .mutation(({ input, ctx }) =>
          createLiveIntelligenceBridgeRouter(services.liveIntelligence).reject(input, ctx),
        ),
      handOff: heavyProcedure
        .input(bridgeLoopInput)
        .mutation(({ input, ctx }) =>
          createLiveIntelligenceBridgeRouter(services.liveIntelligence).handOff(input, ctx),
        ),
      verify: standardProcedure
        .input(bridgeLoopInput)
        .query(({ input, ctx }) =>
          createLiveIntelligenceBridgeRouter(services.liveIntelligence).verify(input, ctx),
        ),
      evaluateAndLearn: heavyProcedure
        .input(
          z.object({
            userId: z.string().min(1),
            loopId: z.string().min(1).max(64),
            outputAccepted: z.boolean(),
          }),
        )
        .mutation(({ input, ctx }) =>
          createLiveIntelligenceBridgeRouter(services.liveIntelligence).evaluateAndLearn(
            input,
            ctx,
          ),
        ),
      get: standardProcedure
        .input(bridgeLoopInput)
        .query(({ input, ctx }) =>
          createLiveIntelligenceBridgeRouter(services.liveIntelligence).get(input, ctx),
        ),
      list: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createLiveIntelligenceBridgeRouter(services.liveIntelligence).list(input, ctx),
        ),
      performanceProfile: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createLiveIntelligenceBridgeRouter(services.liveIntelligence).performanceProfile(
            input,
            ctx,
          ),
        ),
      emitNotification: heavyProcedure
        .input(bridgeNotificationInput)
        .mutation(({ input, ctx }) =>
          createLiveIntelligenceBridgeRouter(services.liveIntelligence).emitNotification(
            input,
            ctx,
          ),
        ),
    }),

    // ── AI World Scheduler & Discovery Engine (EPIC-018) ─────────────────
    //    The aiWorldScheduler.* namespace: getStatus (the /ai-world Discovery
    //    Activity view) · listSchedules / setSchedule (enable/disable/
    //    frequency) · runNow (manual discovery through the EXACT same bounded
    //    path as scheduled runs — no privileged shortcut) · cancelRun ·
    //    listRuns / getLedger / listSourcePolicies. Every procedure is
    //    authenticated + rate-limited; per-user state is owner-scoped at the
    //    service (IDOR refused by construction).
    aiWorldScheduler: router({
      getStatus: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createSchedulerRouter(services.aiWorldScheduler).getStatus(input, ctx),
        ),
      // EPIC-018 runtime closure: whether the automatic cadence driver is
      // actually active (bound at the route layer when the driver starts;
      // mocks/tests without the binding honestly report inactive).
      getRuntimeStatus: standardProcedure.input(userId).query(({ input, ctx }) =>
        // The service always returns a status (honest inactive default before
        // the cadence driver binds; live status after) — one source of truth.
        createSchedulerRouter(services.aiWorldScheduler, () =>
          services.schedulerRuntimeStatus(),
        ).getRuntimeStatus(input, ctx),
      ),
      listSchedules: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createSchedulerRouter(services.aiWorldScheduler).listSchedules(input, ctx),
        ),
      setSchedule: standardProcedure
        .input(
          z.object({
            userId: z.string().min(1),
            jobCategory: discoveryJobCategoryEnum,
            enabled: z.boolean().optional(),
            frequency: scheduleFrequencyEnum.optional(),
          }),
        )
        .mutation(({ input, ctx }) =>
          createSchedulerRouter(services.aiWorldScheduler).setSchedule(input, ctx),
        ),
      runNow: heavyProcedure
        .input(z.object({ userId: z.string().min(1), jobCategory: discoveryJobCategoryEnum }))
        .mutation(({ input, ctx }) =>
          createSchedulerRouter(services.aiWorldScheduler).runNow(input, ctx),
        ),
      cancelRun: heavyProcedure
        .input(z.object({ userId: z.string().min(1), jobCategory: discoveryJobCategoryEnum }))
        .mutation(({ input, ctx }) =>
          createSchedulerRouter(services.aiWorldScheduler).cancelRun(input, ctx),
        ),
      listRuns: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createSchedulerRouter(services.aiWorldScheduler).listRuns(input, ctx),
        ),
      getLedger: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createSchedulerRouter(services.aiWorldScheduler).getLedger(input, ctx),
        ),
      listSourcePolicies: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createSchedulerRouter(services.aiWorldScheduler).listSourcePolicies(input, ctx),
        ),
    }),

    // ── Enterprise Knowledge Intelligence (EPIC-004 / EI-009) ───────────────
    //    The Enterprise Knowledge Layer — authoritative, versioned, validated,
    //    searchable, explainable, and traceable knowledge for every engine.
    knowledge: router({
      create: heavyProcedure
        .input(knowledgeCreateInput)
        .mutation(({ input, ctx }) =>
          createKnowledgeRouter(services.knowledgeIntelligence).create(input, ctx),
        ),
      update: heavyProcedure
        .input(knowledgeUpdateInput)
        .mutation(({ input, ctx }) =>
          createKnowledgeRouter(services.knowledgeIntelligence).update(input, ctx),
        ),
      delete: heavyProcedure
        .input(knowledgeIdInput)
        .mutation(({ input, ctx }) =>
          createKnowledgeRouter(services.knowledgeIntelligence).delete(input, ctx),
        ),
      getItem: standardProcedure
        .input(knowledgeIdInput)
        .query(({ input, ctx }) =>
          createKnowledgeRouter(services.knowledgeIntelligence).getItem(input, ctx),
        ),
      listItems: standardProcedure
        .input(knowledgeListInput)
        .query(({ input, ctx }) =>
          createKnowledgeRouter(services.knowledgeIntelligence).listItems(input, ctx),
        ),
      search: standardProcedure
        .input(knowledgeSearchInput)
        .query(({ input, ctx }) =>
          createKnowledgeRouter(services.knowledgeIntelligence).search(input, ctx),
        ),
      explain: standardProcedure
        .input(knowledgeIdInput)
        .query(({ input, ctx }) =>
          createKnowledgeRouter(services.knowledgeIntelligence).explain(input, ctx),
        ),
      validate: heavyProcedure
        .input(knowledgeValidateInput)
        .mutation(({ input, ctx }) =>
          createKnowledgeRouter(services.knowledgeIntelligence).validate(input, ctx),
        ),
      createVersion: heavyProcedure
        .input(knowledgeVersionInput)
        .mutation(({ input, ctx }) =>
          createKnowledgeRouter(services.knowledgeIntelligence).createVersion(input, ctx),
        ),
      listVersions: standardProcedure
        .input(knowledgeIdInput)
        .query(({ input, ctx }) =>
          createKnowledgeRouter(services.knowledgeIntelligence).listVersions(input, ctx),
        ),
      getVersion: standardProcedure
        .input(knowledgeVersionNumberInput)
        .query(({ input, ctx }) =>
          createKnowledgeRouter(services.knowledgeIntelligence).getVersion(input, ctx),
        ),
      diff: standardProcedure
        .input(knowledgeDiffInput)
        .query(({ input, ctx }) =>
          createKnowledgeRouter(services.knowledgeIntelligence).diff(input, ctx),
        ),
      relate: heavyProcedure
        .input(knowledgeRelateInput)
        .mutation(({ input, ctx }) =>
          createKnowledgeRouter(services.knowledgeIntelligence).relate(input, ctx),
        ),
      detectRelationships: heavyProcedure
        .input(knowledgeValidateInput)
        .mutation(({ input, ctx }) =>
          createKnowledgeRouter(services.knowledgeIntelligence).detectRelationships(input, ctx),
        ),
      listRelationships: standardProcedure
        .input(knowledgeRelationshipQueryInput)
        .query(({ input, ctx }) =>
          createKnowledgeRouter(services.knowledgeIntelligence).listRelationships(input, ctx),
        ),
      graph: standardProcedure
        .input(knowledgeGraphInput)
        .query(({ input, ctx }) =>
          createKnowledgeRouter(services.knowledgeIntelligence).graph(input, ctx),
        ),
      shortestPath: standardProcedure
        .input(knowledgeShortestPathInput)
        .query(({ input, ctx }) =>
          createKnowledgeRouter(services.knowledgeIntelligence).shortestPath(input, ctx),
        ),
      listConsumers: standardProcedure
        .input(knowledgeIdInput)
        .query(({ input, ctx }) =>
          createKnowledgeRouter(services.knowledgeIntelligence).listConsumers(input, ctx),
        ),
      recordConsumerUsage: heavyProcedure
        .input(knowledgeConsumerUsageInput)
        .mutation(({ input, ctx }) =>
          createKnowledgeRouter(services.knowledgeIntelligence).recordConsumerUsage(input, ctx),
        ),
      listDependencies: standardProcedure
        .input(knowledgeIdInput)
        .query(({ input, ctx }) =>
          createKnowledgeRouter(services.knowledgeIntelligence).listDependencies(input, ctx),
        ),
      transitionLifecycle: heavyProcedure
        .input(knowledgeLifecycleInput)
        .mutation(({ input, ctx }) =>
          createKnowledgeRouter(services.knowledgeIntelligence).transitionLifecycle(input, ctx),
        ),
      getAnalytics: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createKnowledgeRouter(services.knowledgeIntelligence).getAnalytics(input, ctx),
        ),
      getTimeline: standardProcedure
        .input(knowledgeTimelineInput)
        .query(({ input, ctx }) =>
          createKnowledgeRouter(services.knowledgeIntelligence).getTimeline(input, ctx),
        ),
      getDashboard: heavyProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createKnowledgeRouter(services.knowledgeIntelligence).getDashboard(input, ctx),
        ),
    }),

    // ── Enterprise Memory Intelligence (EPIC-004 / EI-010) ──────────────────
    //    The Enterprise Memory Layer — records, retrieves, ranks, compresses,
    //    consolidates, and expires evolving experience across the operating
    //    system. Knowledge is authoritative facts; memory is evolving
    //    experience. The two systems remain separate but tightly integrated.
    memoryIntelligence: router({
      capture: heavyProcedure
        .input(memoryCaptureInput)
        .mutation(({ input, ctx }) =>
          createMemoryIntelligenceRouter(services.memoryIntelligence).capture(input, ctx),
        ),
      update: heavyProcedure
        .input(memoryUpdateInput)
        .mutation(({ input, ctx }) =>
          createMemoryIntelligenceRouter(services.memoryIntelligence).update(input, ctx),
        ),
      delete: heavyProcedure
        .input(memoryIdInput)
        .mutation(({ input, ctx }) =>
          createMemoryIntelligenceRouter(services.memoryIntelligence).delete(input, ctx),
        ),
      getItem: standardProcedure
        .input(memoryIdInput)
        .query(({ input, ctx }) =>
          createMemoryIntelligenceRouter(services.memoryIntelligence).getItem(input, ctx),
        ),
      listItems: standardProcedure
        .input(memoryListInput)
        .query(({ input, ctx }) =>
          createMemoryIntelligenceRouter(services.memoryIntelligence).listItems(input, ctx),
        ),
      retrieve: standardProcedure
        .input(memoryRetrievalInput)
        .query(({ input, ctx }) =>
          createMemoryIntelligenceRouter(services.memoryIntelligence).retrieve(input, ctx),
        ),
      summarize: heavyProcedure
        .input(memorySummarizeInput)
        .mutation(({ input, ctx }) =>
          createMemoryIntelligenceRouter(services.memoryIntelligence).summarize(input, ctx),
        ),
      validate: heavyProcedure
        .input(memoryValidateInput)
        .mutation(({ input, ctx }) =>
          createMemoryIntelligenceRouter(services.memoryIntelligence).validate(input, ctx),
        ),
      consolidate: heavyProcedure
        .input(memoryConsolidateInput)
        .mutation(({ input, ctx }) =>
          createMemoryIntelligenceRouter(services.memoryIntelligence).consolidate(input, ctx),
        ),
      compress: heavyProcedure
        .input(memoryCompressInput)
        .mutation(({ input, ctx }) =>
          createMemoryIntelligenceRouter(services.memoryIntelligence).compress(input, ctx),
        ),
      expire: heavyProcedure
        .input(memoryExpireInput)
        .mutation(({ input, ctx }) =>
          createMemoryIntelligenceRouter(services.memoryIntelligence).expire(input, ctx),
        ),
      reinforce: heavyProcedure
        .input(memoryReinforceInput)
        .mutation(({ input, ctx }) =>
          createMemoryIntelligenceRouter(services.memoryIntelligence).reinforce(input, ctx),
        ),
      transitionLifecycle: heavyProcedure
        .input(memoryLifecycleInput)
        .mutation(({ input, ctx }) =>
          createMemoryIntelligenceRouter(services.memoryIntelligence).transitionLifecycle(
            input,
            ctx,
          ),
        ),
      relate: heavyProcedure
        .input(memoryRelateInput)
        .mutation(({ input, ctx }) =>
          createMemoryIntelligenceRouter(services.memoryIntelligence).relate(input, ctx),
        ),
      detectRelationships: heavyProcedure
        .input(memoryValidateInput)
        .mutation(({ input, ctx }) =>
          createMemoryIntelligenceRouter(services.memoryIntelligence).detectRelationships(
            input,
            ctx,
          ),
        ),
      listRelationships: standardProcedure
        .input(memoryRelationshipQueryInput)
        .query(({ input, ctx }) =>
          createMemoryIntelligenceRouter(services.memoryIntelligence).listRelationships(input, ctx),
        ),
      graph: standardProcedure
        .input(memoryGraphInput)
        .query(({ input, ctx }) =>
          createMemoryIntelligenceRouter(services.memoryIntelligence).graph(input, ctx),
        ),
      shortestPath: standardProcedure
        .input(memoryShortestPathInput)
        .query(({ input, ctx }) =>
          createMemoryIntelligenceRouter(services.memoryIntelligence).shortestPath(input, ctx),
        ),
      listConsumers: standardProcedure
        .input(memoryIdInput)
        .query(({ input, ctx }) =>
          createMemoryIntelligenceRouter(services.memoryIntelligence).listConsumers(input, ctx),
        ),
      recordConsumerUsage: heavyProcedure
        .input(memoryConsumerUsageInput)
        .mutation(({ input, ctx }) =>
          createMemoryIntelligenceRouter(services.memoryIntelligence).recordConsumerUsage(
            input,
            ctx,
          ),
        ),
      getAnalytics: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createMemoryIntelligenceRouter(services.memoryIntelligence).getAnalytics(input, ctx),
        ),
      getTimeline: standardProcedure
        .input(memoryTimelineInput)
        .query(({ input, ctx }) =>
          createMemoryIntelligenceRouter(services.memoryIntelligence).getTimeline(input, ctx),
        ),
      getDashboard: heavyProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createMemoryIntelligenceRouter(services.memoryIntelligence).getDashboard(input, ctx),
        ),
    }),

    // ── AI Runtime (ARC-005 / AI-RUNTIME-001) ─────────────────────────────────
    //    The canonical AI execution contract: capability → provider selection →
    //    context → model execution with retry/fallback → validation → metrics.
    //    heavyProcedure tier (20 req/min) — every call may hit a live provider.
    ai: router({
      orchestrate: heavyProcedure
        .input(aiOrchestrateInput)
        .mutation(({ input, ctx }) => createAIRouter(services.ai).orchestrate(input, ctx)),
      listProviders: standardProcedure
        .input(userId)
        .query(({ input, ctx }) => createAIRouter(services.ai).listProviders(input, ctx)),
      listCapabilities: standardProcedure
        .input(userId)
        .query(({ input, ctx }) => createAIRouter(services.ai).listCapabilities(input, ctx)),
      getProviderHealth: standardProcedure
        .input(aiProviderHealthInput)
        .query(({ input, ctx }) => createAIRouter(services.ai).getProviderHealth(input, ctx)),
      getAllProviderHealth: standardProcedure
        .input(userId)
        .query(({ input, ctx }) => createAIRouter(services.ai).getAllProviderHealth(input, ctx)),
      // AI-RUNTIME-002: streamed run (server-side SDK streaming, collected
      // as typed events) — heavy tier, every call may hit a live provider.
      stream: heavyProcedure
        .input(aiStreamInput)
        .mutation(({ input, ctx }) => createAIRouter(services.ai).stream(input, ctx)),
      // AI-RUNTIME-002: pure decision query — WHY would the runtime pick a
      // provider/model for this capability (EI-002/EI-004, no execution).
      explainSelection: standardProcedure
        .input(aiExplainSelectionInput)
        .query(({ input, ctx }) => createAIRouter(services.ai).explainSelection(input, ctx)),
    }),

    // ── Enterprise RAG Platform (EPIC-005 / AI-RUNTIME-002) ──────────────────
    //    Production RAG: ingest (chunk → embed → pgvector), search (vector
    //    with keyword fallback), delete, stats. User-scoped collections;
    //    auth + IDOR + rate-limit middleware on every procedure.
    rag: router({
      ingest: heavyProcedure
        .input(ragIngestInput)
        .mutation(({ input, ctx }) => createRagRouter(services.rag).ingest(input, ctx)),
      search: standardProcedure
        .input(ragSearchInput)
        .query(({ input, ctx }) => createRagRouter(services.rag).search(input, ctx)),
      deleteSource: standardProcedure
        .input(ragDeleteInput)
        .mutation(({ input, ctx }) => createRagRouter(services.rag).deleteSource(input, ctx)),
      getStats: standardProcedure
        .input(ragStatsInput)
        .query(({ input, ctx }) => createRagRouter(services.rag).getStats(input, ctx)),
      // AI-RUNTIME-002 C-01: production RAG health + readiness. Operators can
      // verify the vector store + embedding configuration before enabling
      // grounding-required AI flows.
      getHealth: standardProcedure
        .input(userId)
        .query(({ input, ctx }) => createRagRouter(services.rag).getHealth(input, ctx)),
      getReadiness: standardProcedure
        .input(userId)
        .query(({ input, ctx }) => createRagRouter(services.rag).getReadiness(input, ctx)),
    }),

    // ── Orchestrated AI Loop Engine (EPIC-006) ───────────────────────────────
    //    Controlled, measurable, evidence-first orchestration: a complex goal
    //    is understood (GoalSpecification), decomposed into a typed TaskGraph,
    //    assigned to AI specialists through the frozen AI runtime (never
    //    provider SDKs), evaluated by an explicit critic and refined — bounded
    //    by six hard budgets, with an explicit termination reason every time.
    //    loop.start is heavy tier (bounded background execution); status/
    //    trace/cancel/resume/list are standard tier.
    loop: router({
      start: heavyProcedure
        .input(loopStartInput)
        .mutation(({ input, ctx }) => createLoopRouter(services.loop).start(input, ctx)),
      status: standardProcedure
        .input(loopRunIdInput)
        .query(({ input, ctx }) => createLoopRouter(services.loop).status(input, ctx)),
      getTrace: standardProcedure
        .input(loopRunIdInput)
        .query(({ input, ctx }) => createLoopRouter(services.loop).getTrace(input, ctx)),
      cancel: standardProcedure
        .input(loopRunIdInput)
        .mutation(({ input, ctx }) => createLoopRouter(services.loop).cancel(input, ctx)),
      resume: heavyProcedure
        .input(loopResumeInput)
        .mutation(({ input, ctx }) => createLoopRouter(services.loop).resume(input, ctx)),
      listRuns: standardProcedure
        .input(userId)
        .query(({ input, ctx }) => createLoopRouter(services.loop).listRuns(input, ctx)),
      listPatterns: standardProcedure
        .input(userId)
        .query(({ input, ctx }) => createLoopRouter(services.loop).listPatterns(input, ctx)),
    }),

    // ── AI Application Factory (EPIC-007) ────────────────────────────────────
    //    The APPLICATION FACTORY layer above the frozen platform: takes a
    //    natural-language application idea and turns it into a structured,
    //    validated application project. UNDERSTAND → SPECIFY → ARCHITECT →
    //    PLAN (create) → user approval (approve) → GENERATE → TEST → CRITIQUE
    //    → REFINE (build, bounded by EPIC-006 budgets) → PACKAGE → DEPLOY
    //    (explicit authorization only). Reuses the AI runtime, the EPIC-006
    //    LoopEngine, the ToolRuntime and the EvidenceEvaluator — never
    //    rebuilds them. factory.create/build are heavy tier; the rest are
    //    standard tier.
    factory: router({
      create: heavyProcedure
        .input(factoryCreateInput)
        .mutation(({ input, ctx }) => createFactoryRouter(services.factory).create(input, ctx)),
      approve: standardProcedure
        .input(factoryApproveInput)
        .mutation(({ input, ctx }) => createFactoryRouter(services.factory).approve(input, ctx)),
      build: heavyProcedure
        .input(factoryBuildInput)
        .mutation(({ input, ctx }) => createFactoryRouter(services.factory).build(input, ctx)),
      status: standardProcedure
        .input(factoryApplicationIdInput)
        .query(({ input, ctx }) => createFactoryRouter(services.factory).status(input, ctx)),
      getDetail: standardProcedure
        .input(factoryApplicationIdInput)
        .query(({ input, ctx }) => createFactoryRouter(services.factory).getDetail(input, ctx)),
      preview: standardProcedure
        .input(factoryApplicationIdInput)
        .query(({ input, ctx }) =>
          createFactoryRouter(services.factory, factoryPreviewService).preview(input, ctx),
        ),
      deploy: heavyProcedure
        .input(factoryDeployInput)
        .mutation(({ input, ctx }) => createFactoryRouter(services.factory).deploy(input, ctx)),
      list: standardProcedure
        .input(userId)
        .query(({ input, ctx }) => createFactoryRouter(services.factory).list(input, ctx)),
      rename: standardProcedure
        .input(factoryRenameInput)
        .mutation(({ input, ctx }) => createFactoryRouter(services.factory).rename(input, ctx)),
      archive: standardProcedure
        .input(factoryApplicationIdInput)
        .mutation(({ input, ctx }) => createFactoryRouter(services.factory).archive(input, ctx)),
      delete: heavyProcedure
        .input(factoryDeleteInput)
        .mutation(({ input, ctx }) => createFactoryRouter(services.factory).delete(input, ctx)),
      resume: heavyProcedure
        .input(factoryApplicationIdInput)
        .mutation(({ input, ctx }) => createFactoryRouter(services.factory).resume(input, ctx)),
      history: standardProcedure
        .input(factoryApplicationIdInput)
        .query(({ input, ctx }) => createFactoryRouter(services.factory).history(input, ctx)),
      vcInit: standardProcedure
        .input(factoryApplicationIdInput)
        .mutation(({ input, ctx }) => createFactoryRouter(services.factory).vcInit(input, ctx)),
      vcBranch: standardProcedure
        .input(factoryVcBranchInput)
        .mutation(({ input, ctx }) => createFactoryRouter(services.factory).vcBranch(input, ctx)),
      vcCommit: standardProcedure
        .input(factoryVcCommitInput)
        .mutation(({ input, ctx }) => createFactoryRouter(services.factory).vcCommit(input, ctx)),
      vcDiff: standardProcedure
        .input(factoryApplicationIdInput)
        .query(({ input, ctx }) => createFactoryRouter(services.factory).vcDiff(input, ctx)),
      vcPreparePullRequest: standardProcedure
        .input(factoryVcPrInput)
        .mutation(({ input, ctx }) =>
          createFactoryRouter(services.factory).vcPreparePullRequest(input, ctx),
        ),
      vcHistory: standardProcedure
        .input(factoryApplicationIdInput)
        .query(({ input, ctx }) => createFactoryRouter(services.factory).vcHistory(input, ctx)),
    }),

    // ── Product Intelligence & Requirements Engine (EPIC-009) ────────────────
    //    The INTELLIGENCE LAYER ABOVE THE APPLICATION FACTORY: turns a raw
    //    user IDEA into a complete, traceable product specification through
    //    UNDERSTAND → ANALYZE → EXTRACT REQUIREMENTS (with provenance) →
    //    AMBIGUITY → QUESTION INTELLIGENCE → SAFE DEFAULTS → CONFLICT
    //    DETECTION → COMPLETENESS → PRODUCT BRIEF → JOURNEYS → DESIGN →
    //    ARCHITECTURE → AI/RAG/TOOLS → SECURITY-BY-DESIGN → COST → BUILD
    //    PLAN → USER APPROVAL → handoff to the APPLICATION FACTORY. Every
    //    procedure is owner-scoped (IDOR refused at the engine layer).
    //    requirements.start / plan / approve / handoffToFactory are heavy
    //    tier (plan derives the full product plan); the rest are standard.
    requirements: router({
      start: heavyProcedure
        .input(requirementsStartInput)
        .mutation(({ input, ctx }) =>
          createRequirementsRouter(services.requirements, services.factory).start(input, ctx),
        ),
      get: standardProcedure
        .input(requirementsSessionIdInput)
        .query(({ input, ctx }) => createRequirementsRouter(services.requirements).get(input, ctx)),
      list: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createRequirementsRouter(services.requirements).list(input, ctx),
        ),
      delete: standardProcedure
        .input(requirementsSessionIdInput)
        .mutation(({ input, ctx }) =>
          createRequirementsRouter(services.requirements).delete(input, ctx),
        ),
      answer: standardProcedure
        .input(requirementsAnswerInput)
        .mutation(({ input, ctx }) =>
          createRequirementsRouter(services.requirements).answer(input, ctx),
        ),
      acceptAllDefaults: standardProcedure
        .input(requirementsSessionIdInput)
        .mutation(({ input, ctx }) =>
          createRequirementsRouter(services.requirements).acceptAllDefaults(input, ctx),
        ),
      decideDefault: standardProcedure
        .input(requirementsDefaultDecisionInput)
        .mutation(({ input, ctx }) =>
          createRequirementsRouter(services.requirements).decideDefault(input, ctx),
        ),
      resolveConflict: standardProcedure
        .input(requirementsConflictInput)
        .mutation(({ input, ctx }) =>
          createRequirementsRouter(services.requirements).resolveConflict(input, ctx),
        ),
      plan: heavyProcedure
        .input(requirementsSessionIdInput)
        .mutation(({ input, ctx }) =>
          createRequirementsRouter(services.requirements).plan(input, ctx),
        ),
      approve: heavyProcedure
        .input(requirementsSessionIdInput)
        .mutation(({ input, ctx }) =>
          createRequirementsRouter(services.requirements).approve(input, ctx),
        ),
      reject: standardProcedure
        .input(requirementsRejectInput)
        .mutation(({ input, ctx }) =>
          createRequirementsRouter(services.requirements).reject(input, ctx),
        ),
      handoffGoal: standardProcedure
        .input(requirementsSessionIdInput)
        .query(({ input, ctx }) =>
          createRequirementsRouter(services.requirements).handoffGoal(input, ctx),
        ),
      handoffToFactory: heavyProcedure
        .input(requirementsSessionIdInput)
        .mutation(({ input, ctx }) =>
          createRequirementsRouter(services.requirements, services.factory).handoffToFactory(
            input,
            ctx,
          ),
        ),
      changeImpact: standardProcedure
        .input(requirementsChangeImpactInput)
        .mutation(({ input, ctx }) =>
          createRequirementsRouter(services.requirements).changeImpact(input, ctx),
        ),
    }),

    // ── Adaptive Application Experience & Visual Intelligence (EPIC-010) ────
    //    The layer ABOVE the Application Factory that evaluates persisted
    //    generated applications against the domain-aware design system, UI
    //    blueprint, design decisions, visual critic, multi-dimensional
    //    quality model (FUNCTIONAL/UX/VISUAL/ACCESSIBILITY/SECURITY/
    //    PERFORMANCE/AI/RAG/DATA/ARCHITECTURE) and traceability — and plans
    //    TARGETED refinement (only the affected layer changes; never
    //    regenerate-all). All procedures resolve the application through
    //    factory.getDetail, so owner isolation (IDOR) is enforced at the
    //    factory engine; authenticated + rate-limited middleware applies.
    experience: router({
      evaluate: standardProcedure
        .input(experienceEvaluateInput)
        .query(({ input, ctx }) =>
          createExperienceRouter(services.experience, services.factory).evaluate(input, ctx),
        ),
      // EPIC-010 Phase 8/11 optional seam: deterministic evaluation + a live
      // AI critique (when a provider is configured; abstains otherwise).
      evaluateWithAI: heavyProcedure
        .input(experienceEvaluateInput)
        .query(({ input, ctx }) =>
          createExperienceRouter(services.experience, services.factory).evaluateWithAI(input, ctx),
        ),
      findings: standardProcedure
        .input(experienceEvaluateInput)
        .query(({ input, ctx }) =>
          createExperienceRouter(services.experience, services.factory).findings(input, ctx),
        ),
      refine: standardProcedure
        .input(experienceRefineInput)
        .mutation(({ input, ctx }) =>
          createExperienceRouter(services.experience, services.factory).refine(input, ctx),
        ),
    }),

    //    The integration layer that turns every Enterprise Intelligence Engine
    //    into one Enterprise Operating System — system health, engine status,
    //    dependency graph, 15-stage pipeline validation, cross-engine
    //    validation, diagnostics, platform validation, performance and the
    //    OS dashboard (snapshot history). Platform-wide (not user-scoped).
    os: router({
      systemHealth: heavyProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createOSRouter(services.osIntelligence).systemHealth(input, ctx),
        ),
      pipelineHealth: heavyProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createOSRouter(services.osIntelligence).pipelineHealth(input, ctx),
        ),
      runDiagnostics: heavyProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createOSRouter(services.osIntelligence).runDiagnostics(input, ctx),
        ),
      validatePlatform: heavyProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createOSRouter(services.osIntelligence).validatePlatform(input, ctx),
        ),
      engineStatus: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createOSRouter(services.osIntelligence).engineStatus(input, ctx),
        ),
      dependencyGraph: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createOSRouter(services.osIntelligence).dependencyGraph(input, ctx),
        ),
      performanceMetrics: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createOSRouter(services.osIntelligence).performanceMetrics(input, ctx),
        ),
      dashboard: heavyProcedure
        .input(userId)
        .query(({ input, ctx }) => createOSRouter(services.osIntelligence).dashboard(input, ctx)),
      snapshots: standardProcedure
        .input(osSnapshotsInput)
        .query(({ input, ctx }) => createOSRouter(services.osIntelligence).snapshots(input, ctx)),
    }),

    // ── Context & Personal Intelligence Fabric (APP-001) ─────────────────────
    //    Post-V1 application-platform layer. Personal + business graphs,
    //    permission-gated hybrid search, minimum-useful context packages,
    //    explanations, provenance, permissions and health. User-scoped.
    contextFabric: router({
      getPersonalGraph: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createContextFabricRouter(services.contextFabric).getPersonalGraph(input, ctx),
        ),
      getBusinessGraph: standardProcedure
        .input(contextFabricOrgInput)
        .query(({ input, ctx }) =>
          createContextFabricRouter(services.contextFabric).getBusinessGraph(input, ctx),
        ),
      search: searchProcedure
        .input(contextFabricSearchInput)
        .query(({ input, ctx }) =>
          createContextFabricRouter(services.contextFabric).search(input, ctx),
        ),
      getEntity: standardProcedure
        .input(contextFabricEntityInput)
        .query(({ input, ctx }) =>
          createContextFabricRouter(services.contextFabric).getEntity(input, ctx),
        ),
      getRelationships: standardProcedure
        .input(contextFabricRelationshipsInput)
        .query(({ input, ctx }) =>
          createContextFabricRouter(services.contextFabric).getRelationships(input, ctx),
        ),
      buildContextPackage: heavyProcedure
        .input(contextFabricPackageInput)
        .query(({ input, ctx }) =>
          createContextFabricRouter(services.contextFabric).buildContextPackage(input, ctx),
        ),
      explainContextSelection: standardProcedure
        .input(contextFabricExplainInput)
        .query(({ input, ctx }) =>
          createContextFabricRouter(services.contextFabric).explainContextSelection(input, ctx),
        ),
      getProvenance: standardProcedure
        .input(contextFabricEntityInput)
        .query(({ input, ctx }) =>
          createContextFabricRouter(services.contextFabric).getProvenance(input, ctx),
        ),
      getPermissions: standardProcedure
        .input(contextFabricOrgInput.merge(contextFabricEntityInput))
        .query(({ input, ctx }) =>
          createContextFabricRouter(services.contextFabric).getPermissions(input, ctx),
        ),
      getSources: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createContextFabricRouter(services.contextFabric).getSources(input, ctx),
        ),
      getHealth: standardProcedure
        .input(userId)
        .query(({ input, ctx }) =>
          createContextFabricRouter(services.contextFabric).getHealth(input, ctx),
        ),
    }),

    // ── Client Portal (public, token-scoped — EPIC-003 / AC-002) ────────────
    portal: router({
      login: publicProcedure
        .input(portalToken)
        .mutation(({ input, ctx }) => createPortalRouter(services.clientOps).login(input, ctx)),
      getDashboard: publicProcedure
        .input(portalToken)
        .query(({ input, ctx }) => createPortalRouter(services.clientOps).getDashboard(input, ctx)),
      listContent: publicProcedure
        .input(portalToken)
        .query(({ input, ctx }) => createPortalRouter(services.clientOps).listContent(input, ctx)),
      getContent: publicProcedure
        .input(portalTokenAndContent)
        .query(({ input, ctx }) => createPortalRouter(services.clientOps).getContent(input, ctx)),
      approveContent: publicProcedure
        .input(portalTokenComment)
        .mutation(({ input, ctx }) =>
          createPortalRouter(services.clientOps).approveContent(input, ctx),
        ),
      rejectContent: publicProcedure
        .input(portalTokenComment)
        .mutation(({ input, ctx }) =>
          createPortalRouter(services.clientOps).rejectContent(input, ctx),
        ),
      commentContent: publicProcedure
        .input(portalTokenComment)
        .mutation(({ input, ctx }) =>
          createPortalRouter(services.clientOps).commentContent(input, ctx),
        ),
      downloadDeliverable: publicProcedure
        .input(
          z.object({
            token: z.string().min(16),
            contentId: z.string().min(1),
            format: deliveryFormatEnum,
          }),
        )
        .query(({ input, ctx }) =>
          createPortalRouter(services.clientOps).downloadDeliverable(input, ctx),
        ),
      listInvoices: publicProcedure
        .input(portalToken)
        .query(({ input, ctx }) => createPortalRouter(services.clientOps).listInvoices(input, ctx)),
      getInvoice: publicProcedure
        .input(portalTokenInvoice)
        .query(({ input, ctx }) => createPortalRouter(services.clientOps).getInvoice(input, ctx)),
    }),

    // ── EPIC-012 Ops Control Plane (standard tier) ───────────────────────────
    //    The operational control surface: reconstruct executions from the
    //    correlated trace spine, inspect cost/health/alerts, and execute
    //    audited controls. Reads are owner-scoped for regular users; platform
    //    views + provider controls require the OPS_OPERATOR_IDS allowlist
    //    (enforced inside OpsApplicationService, never in the UI).
    ops: router({
      traces: standardProcedure
        .input(opsTracesStatusInput)
        .query(({ input, ctx }) => createOpsRouter(services.ops).traces(input, ctx)),
      trace: standardProcedure
        .input(opsTraceInput)
        .query(({ input, ctx }) => createOpsRouter(services.ops).trace(input, ctx)),
      failures: standardProcedure
        .input(opsTracesInput)
        .query(({ input, ctx }) => createOpsRouter(services.ops).failures(input, ctx)),
      diagnostics: standardProcedure
        .input(opsTraceInput)
        .query(({ input, ctx }) => createOpsRouter(services.ops).diagnostics(input, ctx)),
      costLedger: standardProcedure
        .input(opsUserIdInput)
        .query(({ input, ctx }) => createOpsRouter(services.ops).costLedger(input, ctx)),
      costAnomalies: standardProcedure
        .input(opsUserIdInput)
        .query(({ input, ctx }) => createOpsRouter(services.ops).costAnomalies(input, ctx)),
      applicationHealth: standardProcedure
        .input(opsUserIdInput)
        .query(({ input, ctx }) => createOpsRouter(services.ops).applicationHealth(input, ctx)),
      providerHealth: standardProcedure
        .input(opsUserIdInput)
        .query(({ input, ctx }) => createOpsRouter(services.ops).providerHealth(input, ctx)),
      alerts: standardProcedure
        .input(opsUserIdInput)
        .query(({ input, ctx }) => createOpsRouter(services.ops).alerts(input, ctx)),
      evaluateAlerts: standardProcedure
        .input(opsUserIdInput)
        .mutation(({ input, ctx }) => createOpsRouter(services.ops).evaluateAlerts(input, ctx)),
      alertThresholds: standardProcedure
        .input(opsThresholdsInput)
        .mutation(({ input, ctx }) => createOpsRouter(services.ops).alertThresholds(input, ctx)),
      auditLog: standardProcedure
        .input(opsTracesInput)
        .query(({ input, ctx }) => createOpsRouter(services.ops).auditLog(input, ctx)),
      retry: standardProcedure
        .input(opsRetryInput)
        .mutation(({ input, ctx }) => createOpsRouter(services.ops).retry(input, ctx)),
      cancel: standardProcedure
        .input(opsCancelInput)
        .mutation(({ input, ctx }) => createOpsRouter(services.ops).cancel(input, ctx)),
      revalidate: standardProcedure
        .input(opsAppIdInput)
        .mutation(({ input, ctx }) => createOpsRouter(services.ops).revalidate(input, ctx)),
      requality: standardProcedure
        .input(opsAppIdInput)
        .mutation(({ input, ctx }) => createOpsRouter(services.ops).requality(input, ctx)),
      disableProvider: standardProcedure
        .input(opsProviderInput)
        .mutation(({ input, ctx }) => createOpsRouter(services.ops).disableProvider(input, ctx)),
      enableProvider: standardProcedure
        .input(opsProviderInput)
        .mutation(({ input, ctx }) => createOpsRouter(services.ops).enableProvider(input, ctx)),
    }),
    // ── SPRINT-027 — voice.* foundation seams (no UI yet) ──────────────
    // Thin procedures over the SpeechApplicationService: honest capability
    // status, bounded STT/TTS seams, the VOICE ≠ AUTHORIZATION decision and
    // the owner-scoped conversation store. All behind auth + rate tiers;
    // ownership enforced by the central middleware (input.userId match) and
    // the service (owner-scoped stores).
    voice: router({
      status: standardProcedure
        .input(voiceStatusInput)
        .query(({ input, ctx }) => createVoiceRouter(services.voice).status(input, ctx)),
      transcribe: standardProcedure
        .input(voiceTranscribeInput)
        .mutation(({ input, ctx }) => createVoiceRouter(services.voice).transcribe(input, ctx)),
      synthesize: standardProcedure
        .input(voiceSynthesizeInput)
        .mutation(({ input, ctx }) => createVoiceRouter(services.voice).synthesize(input, ctx)),
      assessAction: standardProcedure
        .input(voiceAssessInput)
        .mutation(({ input, ctx }) => createVoiceRouter(services.voice).assessAction(input, ctx)),
      // ── SPRINT-028 — voice assistant (voice → Brain bridge) ──────────
      // handleUtterance translates one spoken turn into the existing Brain
      // pipeline; confirmSensitive is THE ONLY approval path for a voice-
      // initiated sensitive action (explicit NON-VOICE confirmation through
      // the existing Brain approval authority); rejectSensitive mirrors it.
      handleUtterance: standardProcedure
        .input(voiceHandleUtteranceInput)
        .mutation(({ input, ctx }) =>
          createVoiceRouter(services.voice, services.voiceAssistant).handleUtterance(input, ctx),
        ),
      confirmSensitive: standardProcedure
        .input(voiceSensitiveDecisionInput)
        .mutation(({ input, ctx }) =>
          createVoiceRouter(services.voice, services.voiceAssistant).confirmSensitive(input, ctx),
        ),
      rejectSensitive: standardProcedure
        .input(voiceSensitiveDecisionInput)
        .mutation(({ input, ctx }) =>
          createVoiceRouter(services.voice, services.voiceAssistant).rejectSensitive(input, ctx),
        ),
      createConversation: standardProcedure
        .input(voiceCreateConversationInput)
        .mutation(({ input, ctx }) =>
          createVoiceRouter(services.voice).createConversation(input, ctx),
        ),
      listConversations: standardProcedure
        .input(voiceListConversationsInput)
        .query(({ input, ctx }) => createVoiceRouter(services.voice).listConversations(input, ctx)),
      appendTurn: standardProcedure
        .input(voiceAppendTurnInput)
        .mutation(({ input, ctx }) => createVoiceRouter(services.voice).appendTurn(input, ctx)),
      clearConversation: standardProcedure
        .input(voiceClearConversationInput)
        .mutation(({ input, ctx }) =>
          createVoiceRouter(services.voice).clearConversation(input, ctx),
        ),
    }),

    // ── SPRINT-029 — proactive intelligence (composition over the Brain) ──
    // refresh rides the EXISTING brain.discoverIntelligence pipeline;
    // dismiss/accept honor the user's explicit choice (accept refuses any
    // authorization-required recommendation — no self-authorization);
    // assessBusiness performs research/score ONLY, never executing.
    proactive: router({
      // ── SPRINT-029 — proactive intelligence (composition over the Brain) ──
      refresh: standardProcedure
        .input(proactiveInputs.refresh)
        .mutation(({ input, ctx }) =>
          createProactiveRouter(services.proactive).refresh(input, ctx),
        ),
      list: standardProcedure
        .input(proactiveInputs.list)
        .query(({ input, ctx }) => createProactiveRouter(services.proactive).list(input, ctx)),
      dismiss: standardProcedure
        .input(proactiveInputs.dismiss)
        .mutation(({ input, ctx }) =>
          createProactiveRouter(services.proactive).dismiss(input, ctx),
        ),
      accept: standardProcedure
        .input(proactiveInputs.accept)
        .mutation(({ input, ctx }) => createProactiveRouter(services.proactive).accept(input, ctx)),
      briefing: standardProcedure
        .input(proactiveInputs.briefing)
        .query(({ input, ctx }) => createProactiveRouter(services.proactive).briefing(input, ctx)),
      assessBusiness: standardProcedure
        .input(proactiveInputs.assessBusiness)
        .mutation(({ input, ctx }) =>
          createProactiveRouter(services.proactive).assessBusiness(input, ctx),
        ),
    }),

    // ── SPRINT-030 — intelligence fabric (composition over the frozen
    //    estate: provider registry + cost ledger + proactive layer).
    //    Provider health is OBSERVED only; cost policy is fail-closed;
    //    autonomy levels never jump; selectStrategy is ADVISORY ranking
    //    (actual routing stays in the frozen authority); workflows are
    //    BOUNDED (no unbounded fan-out); verification chains are FIXED and
    //    bounded (no AI-to-AI loops).
    fabric: router({
      getProviderHealth: standardProcedure
        .input(fabricInputs.getProviderHealth)
        .query(({ input, ctx }) =>
          createFabricRouter(services.fabric).getProviderHealth(input, ctx),
        ),
      allProviderHealth: standardProcedure
        .input(fabricInputs.allProviderHealth)
        .query(({ input, ctx }) =>
          createFabricRouter(services.fabric).allProviderHealth(input, ctx),
        ),
      observeOutcome: standardProcedure
        .input(fabricInputs.observeOutcome)
        .mutation(({ input, ctx }) =>
          createFabricRouter(services.fabric).observeOutcome(input, ctx),
        ),
      checkCostPolicy: standardProcedure
        .input(fabricInputs.checkCostPolicy)
        .query(({ input, ctx }) => createFabricRouter(services.fabric).checkCostPolicy(input, ctx)),
      classifyAutonomy: standardProcedure
        .input(fabricInputs.classifyAutonomy)
        .query(({ input, ctx }) =>
          createFabricRouter(services.fabric).classifyAutonomy(input, ctx),
        ),
      selectStrategy: standardProcedure
        .input(fabricInputs.selectStrategy)
        .query(({ input, ctx }) => createFabricRouter(services.fabric).selectStrategy(input, ctx)),
      validateWorkflow: standardProcedure
        .input(fabricInputs.validateWorkflow)
        .query(({ input, ctx }) =>
          createFabricRouter(services.fabric).validateWorkflow(input, ctx),
        ),
      evaluateVerificationChain: standardProcedure
        .input(fabricInputs.evaluateVerificationChain)
        .query(({ input, ctx }) =>
          createFabricRouter(services.fabric).evaluateVerificationChain(input, ctx),
        ),
    }),

    // ── SPRINT-031 — active intelligence control plane (composition over the
    //    existing Brain + proactive + fabric + cost ledger). Settings are
    //    explicit + confirmed only (fail-closed); the emergency stop is
    //    audited and never destructive; the cycle is BOUNDED and NEVER
    //    executes; opportunity transitions are guarded (APPROVED/EXECUTED
    //    require evidence from the EXISTING authorities).
    control: router({
      getSettings: standardProcedure
        .input(controlInputs.settingsGet)
        .query(({ input, ctx }) =>
          createControlRouter(services.controlPlane).getSettings(input, ctx),
        ),
      updateSettings: standardProcedure
        .input(controlInputs.settingsUpdate)
        .mutation(({ input, ctx }) =>
          createControlRouter(services.controlPlane).updateSettings(
            input as Record<string, unknown>,
            ctx,
          ),
        ),
      stopStatus: standardProcedure
        .input(controlInputs.stopStatus)
        .query(({ input, ctx }) =>
          createControlRouter(services.controlPlane).stopStatus(input, ctx),
        ),
      engageStop: standardProcedure
        .input(controlInputs.stopEngage)
        .mutation(({ input, ctx }) =>
          createControlRouter(services.controlPlane).engageStop(input, ctx),
        ),
      releaseStop: standardProcedure
        .input(controlInputs.stopRelease)
        .mutation(({ input, ctx }) =>
          createControlRouter(services.controlPlane).releaseStop(input, ctx),
        ),
      runCycle: standardProcedure
        .input(controlInputs.cycle)
        .mutation(({ input, ctx }) => createControlRouter(services.controlPlane).cycle(input, ctx)),
      todayBriefing: standardProcedure
        .input(controlInputs.briefing)
        .query(({ input, ctx }) => createControlRouter(services.controlPlane).briefing(input, ctx)),
      listOpportunities: standardProcedure
        .input(controlInputs.opportunitiesList)
        .query(({ input, ctx }) =>
          createControlRouter(services.controlPlane).listOpportunities(input, ctx),
        ),
      transitionOpportunity: standardProcedure
        .input(controlInputs.opportunityTransition)
        .mutation(({ input, ctx }) =>
          createControlRouter(services.controlPlane).transitionOpportunity(
            input as Record<string, unknown>,
            ctx,
          ),
        ),
      gateAction: standardProcedure
        .input(controlInputs.gate)
        .query(({ input, ctx }) =>
          createControlRouter(services.controlPlane).gateAction(
            input as Record<string, unknown>,
            ctx,
          ),
        ),
    }),

    // ── SPRINT-032 — world model & business operating system (composition
    //    over the existing Brain + proactive assessor + Intelligence Fabric
    //    + ActionClassPolicy + control plane). The world model is a bounded
    //    owner-scoped index — observations REQUIRE provenance (no fabricated
    //    facts), scores are advisory with every factor exposed, workflow
    //    decomposition is validated against the existing WorkflowBounds,
    //    external signals report UNAVAILABLE when no source is connected,
    //    and nothing here approves/spends/executes.
    world: router({
      overview: standardProcedure
        .input(worldInputs.overview)
        .query(({ input, ctx }) => createWorldRouter(services.world).overview(input, ctx)),
      graphEntities: standardProcedure
        .input(worldInputs.entities)
        .query(({ input, ctx }) =>
          createWorldRouter(services.world).entities(input as Record<string, unknown>, ctx),
        ),
      graphRelations: standardProcedure
        .input(worldInputs.relations)
        .query(({ input, ctx }) =>
          createWorldRouter(services.world).relations(input as Record<string, unknown>, ctx),
        ),
      graphObserve: standardProcedure
        .input(worldInputs.observe)
        .mutation(({ input, ctx }) =>
          createWorldRouter(services.world).observe(input as Record<string, unknown>, ctx),
        ),
      graphLink: standardProcedure
        .input(worldInputs.link)
        .mutation(({ input, ctx }) =>
          createWorldRouter(services.world).link(input as Record<string, unknown>, ctx),
        ),
      listBusinessUnits: standardProcedure
        .input(worldInputs.businessUnitsList)
        .query(({ input, ctx }) => createWorldRouter(services.world).businessUnitsList(input, ctx)),
      createBusinessUnit: standardProcedure
        .input(worldInputs.businessUnitCreate)
        .mutation(({ input, ctx }) =>
          createWorldRouter(services.world).businessUnitCreate(
            input as Record<string, unknown>,
            ctx,
          ),
        ),
      updateBusinessUnit: standardProcedure
        .input(worldInputs.businessUnitUpdate)
        .mutation(({ input, ctx }) =>
          createWorldRouter(services.world).businessUnitUpdate(
            input as Record<string, unknown>,
            ctx,
          ),
        ),
      removeBusinessUnit: standardProcedure
        .input(worldInputs.businessUnitRemove)
        .mutation(({ input, ctx }) =>
          createWorldRouter(services.world).businessUnitRemove(
            input as Record<string, unknown>,
            ctx,
          ),
        ),
      evaluateOpportunity: standardProcedure
        .input(worldInputs.evaluateOpportunity)
        .mutation(({ input, ctx }) =>
          createWorldRouter(services.world).evaluateOpportunity(
            input as Record<string, unknown>,
            ctx,
          ),
        ),
      opportunityPipeline: standardProcedure
        .input(worldInputs.pipeline)
        .query(({ input, ctx }) =>
          createWorldRouter(services.world).pipeline(input as Record<string, unknown>, ctx),
        ),
      listRoles: standardProcedure
        .input(worldInputs.rolesList)
        .query(({ input, ctx }) => createWorldRouter(services.world).rolesList(input, ctx)),
      registerRole: standardProcedure
        .input(worldInputs.roleRegister)
        .mutation(({ input, ctx }) =>
          createWorldRouter(services.world).roleRegister(input as Record<string, unknown>, ctx),
        ),
      suggestWorkers: standardProcedure
        .input(worldInputs.suggestWorkers)
        .query(({ input, ctx }) =>
          createWorldRouter(services.world).suggestWorkers(input as Record<string, unknown>, ctx),
        ),
      createWorkflow: standardProcedure
        .input(worldInputs.workflowCreate)
        .mutation(({ input, ctx }) =>
          createWorldRouter(services.world).workflowCreate(input as Record<string, unknown>, ctx),
        ),
      listWorkflows: standardProcedure
        .input(worldInputs.workflowsList)
        .query(({ input, ctx }) => createWorldRouter(services.world).workflowsList(input, ctx)),
      decomposeWorkflow: standardProcedure
        .input(worldInputs.decomposeWorkflow)
        .mutation(({ input, ctx }) =>
          createWorldRouter(services.world).decomposeWorkflow(
            input as Record<string, unknown>,
            ctx,
          ),
        ),
      // SPRINT-036 — multi-provider orchestration plan (representation only)
      orchestratePlan: standardProcedure
        .input(worldInputs.orchestratePlan)
        .mutation(({ input, ctx }) =>
          createWorldRouter(services.world).orchestratePlan(input as Record<string, unknown>, ctx),
        ),
      listOrchestrationPlans: standardProcedure
        .input(worldInputs.orchestrationPlansList)
        .query(({ input, ctx }) =>
          createWorldRouter(services.world).orchestrationPlansList(input, ctx),
        ),
      // SPRINT-037 — approval-gated execution through the EXISTING bridge.
      // world.approveOrchestrationPlan routes the decision through the Brain
      // (WorldApprovalPort); world.startOrchestrationPlan submits the APPROVED
      // plan to the existing ExecutionRunService (the ONLY runtime path).
      approveOrchestrationPlan: standardProcedure
        .input(worldInputs.approveOrchestrationPlan)
        .mutation(({ input, ctx }) =>
          createWorldRouter(services.world, services.executionRun).approveOrchestrationPlan(
            input as Record<string, unknown>,
            ctx,
          ),
        ),
      startOrchestrationPlan: standardProcedure
        .input(worldInputs.startOrchestrationPlan)
        .mutation(({ input, ctx }) =>
          createWorldRouter(services.world, services.executionRun).startOrchestrationPlan(
            input as Record<string, unknown>,
            ctx,
          ),
        ),
      listSignals: standardProcedure
        .input(worldInputs.signals)
        .query(({ input, ctx }) => createWorldRouter(services.world).signals(input, ctx)),
      classifyBoundary: standardProcedure
        .input(worldInputs.classifyBoundary)
        .query(({ input, ctx }) =>
          createWorldRouter(services.world).classifyBoundary(input as Record<string, unknown>, ctx),
        ),
      // SPRINT-033 Part F — revenue intelligence
      registerRevenueStream: standardProcedure
        .input(worldInputs.revenueRegister)
        .mutation(({ input, ctx }) =>
          createWorldRouter(services.world).revenueRegister(input as Record<string, unknown>, ctx),
        ),
      listRevenueStreams: standardProcedure
        .input(worldInputs.revenueList)
        .query(({ input, ctx }) => createWorldRouter(services.world).revenueList(input, ctx)),
      removeRevenueStream: standardProcedure
        .input(worldInputs.revenueRemove)
        .mutation(({ input, ctx }) =>
          createWorldRouter(services.world).revenueRemove(input as Record<string, unknown>, ctx),
        ),
      revenueSnapshot: standardProcedure
        .input(worldInputs.revenueSnapshot)
        .query(({ input, ctx }) => createWorldRouter(services.world).revenueSnapshot(input, ctx)),
      revenueDecisions: standardProcedure
        .input(worldInputs.revenueDecisions)
        .query(({ input, ctx }) => createWorldRouter(services.world).revenueDecisions(input, ctx)),
      // SPRINT-033 Part A — founder briefing
      founderBriefing: standardProcedure
        .input(worldInputs.founderBriefing)
        .query(({ input, ctx }) => createWorldRouter(services.world).founderBriefing(input, ctx)),
      // SPRINT-033 Part E — workflow execution blueprint
      buildBlueprint: standardProcedure
        .input(worldInputs.buildBlueprint)
        .mutation(({ input, ctx }) =>
          createWorldRouter(services.world).buildBlueprint(input as Record<string, unknown>, ctx),
        ),
      // SPRINT-034 — outcome evidence & revenue → outcome feedback
      recordOutcomeEvidence: standardProcedure
        .input(worldInputs.outcomeEvidenceRecord)
        .mutation(({ input, ctx }) =>
          createWorldRouter(services.world).outcomeEvidenceRecord(
            input as Record<string, unknown>,
            ctx,
          ),
        ),
      listOutcomeEvidence: standardProcedure
        .input(worldInputs.outcomeEvidenceList)
        .query(({ input, ctx }) =>
          createWorldRouter(services.world).outcomeEvidenceList(input, ctx),
        ),
      applyOutcomeFeedback: standardProcedure
        .input(worldInputs.outcomeFeedbackApply)
        .mutation(({ input, ctx }) =>
          createWorldRouter(services.world).outcomeFeedbackApply(
            input as Record<string, unknown>,
            ctx,
          ),
        ),
      // SPRINT-034 — blueprint → approval-gated execution
      requestBlueprintApproval: standardProcedure
        .input(worldInputs.blueprintApprovalRequest)
        .mutation(({ input, ctx }) =>
          createWorldRouter(services.world).blueprintApprovalRequest(
            input as Record<string, unknown>,
            ctx,
          ),
        ),
      listBlueprintApprovals: standardProcedure
        .input(worldInputs.blueprintApprovalsList)
        .query(({ input, ctx }) =>
          createWorldRouter(services.world).blueprintApprovalsList(input, ctx),
        ),
      decideBlueprintApproval: standardProcedure
        .input(worldInputs.blueprintApprovalDecide)
        .mutation(({ input, ctx }) =>
          createWorldRouter(services.world).blueprintApprovalDecide(
            input as Record<string, unknown>,
            ctx,
          ),
        ),
      // SPRINT-034 — cost-weighted revenue intelligence
      revenueRanking: standardProcedure
        .input(worldInputs.revenueRanking)
        .query(({ input, ctx }) => createWorldRouter(services.world).revenueRanking(input, ctx)),
      // SPRINT-034 — Founder Command Center (presentation-only read model)
      commandCenter: standardProcedure
        .input(worldInputs.commandCenter)
        .query(({ input, ctx }) => createWorldRouter(services.world).commandCenter(input, ctx)),
      // SPRINT-035 — bounded owner-scoped timeline (composed from existing stores)
      timeline: standardProcedure
        .input(worldInputs.timeline)
        .query(({ input, ctx }) =>
          createWorldRouter(services.world).timeline(input as Record<string, unknown>, ctx),
        ),
      // SPRINT-035 — honest signal health (never fabricated "live" status)
      signalHealth: standardProcedure
        .input(worldInputs.signalHealth)
        .query(({ input, ctx }) => createWorldRouter(services.world).signalHealth(input, ctx)),
      // ── SPRINT-038 — opportunity discovery & revenue validation ─────────
      // Practical business problems (evidence-required), three advisory
      // scores + LEVEL, bounded lifecycle, zero/low-cost experiment planner,
      // customer discovery, VERIFIED-payment-only revenue validation, STOP
      // recommendations, provider economics over the EXISTING fabric and the
      // Opportunity Radar. Nothing here approves/spends/executes; the founder
      // remains the ultimate authority.
      problemRegister: standardProcedure
        .input(worldInputs.problemRegister)
        .mutation(({ input, ctx }) =>
          createWorldRouter(services.world).problemRegister(input as Record<string, unknown>, ctx),
        ),
      problemList: standardProcedure
        .input(worldInputs.problemList)
        .query(({ input, ctx }) => createWorldRouter(services.world).problemList(input, ctx)),
      problemGet: standardProcedure
        .input(worldInputs.problemGet)
        .query(({ input, ctx }) =>
          createWorldRouter(services.world).problemGet(input as Record<string, unknown>, ctx),
        ),
      problemAddEvidence: standardProcedure
        .input(worldInputs.problemAddEvidence)
        .mutation(({ input, ctx }) =>
          createWorldRouter(services.world).problemAddEvidence(
            input as Record<string, unknown>,
            ctx,
          ),
        ),
      problemRecordCustomerSignal: standardProcedure
        .input(worldInputs.problemRecordCustomerSignal)
        .mutation(({ input, ctx }) =>
          createWorldRouter(services.world).problemRecordCustomerSignal(
            input as Record<string, unknown>,
            ctx,
          ),
        ),
      problemRecordVerifiedPayment: standardProcedure
        .input(worldInputs.problemRecordVerifiedPayment)
        .mutation(({ input, ctx }) =>
          createWorldRouter(services.world).problemRecordVerifiedPayment(
            input as Record<string, unknown>,
            ctx,
          ),
        ),
      problemAssess: standardProcedure
        .input(worldInputs.problemAssess)
        .mutation(({ input, ctx }) =>
          createWorldRouter(services.world).problemAssess(input as Record<string, unknown>, ctx),
        ),
      problemAdvance: standardProcedure
        .input(worldInputs.problemAdvance)
        .mutation(({ input, ctx }) =>
          createWorldRouter(services.world).problemAdvance(input as Record<string, unknown>, ctx),
        ),
      problemPlanExperiment: standardProcedure
        .input(worldInputs.problemPlanExperiment)
        .mutation(({ input, ctx }) =>
          createWorldRouter(services.world).problemPlanExperiment(
            input as Record<string, unknown>,
            ctx,
          ),
        ),
      problemCustomerDiscovery: standardProcedure
        .input(worldInputs.problemCustomerDiscovery)
        .mutation(({ input, ctx }) =>
          createWorldRouter(services.world).problemCustomerDiscovery(
            input as Record<string, unknown>,
            ctx,
          ),
        ),
      problemProviderEconomics: standardProcedure
        .input(worldInputs.problemProviderEconomics)
        .mutation(({ input, ctx }) =>
          createWorldRouter(services.world).problemProviderEconomics(
            input as Record<string, unknown>,
            ctx,
          ),
        ),
      problemBusinessCandidate: standardProcedure
        .input(worldInputs.problemBusinessCandidate)
        .mutation(({ input, ctx }) =>
          createWorldRouter(services.world).problemBusinessCandidate(
            input as Record<string, unknown>,
            ctx,
          ),
        ),
      opportunityRadar: standardProcedure
        .input(worldInputs.opportunityRadar)
        .query(({ input, ctx }) =>
          createWorldRouter(services.world).opportunityRadar(input as Record<string, unknown>, ctx),
        ),
      // SPRINT-039 — founder evidence loop
      observationRecord: standardProcedure
        .input(worldInputs.observationRecord)
        .mutation(({ input, ctx }) =>
          createWorldRouter(services.world).observationRecord(
            input as Record<string, unknown>,
            ctx,
          ),
        ),
      observationsList: standardProcedure
        .input(worldInputs.observationsList)
        .query(({ input, ctx }) =>
          createWorldRouter(services.world).observationsList(input as Record<string, unknown>, ctx),
        ),
      prospectRegister: standardProcedure
        .input(worldInputs.prospectRegister)
        .mutation(({ input, ctx }) =>
          createWorldRouter(services.world).prospectRegister(input as Record<string, unknown>, ctx),
        ),
      prospectAdvance: standardProcedure
        .input(worldInputs.prospectAdvance)
        .mutation(({ input, ctx }) =>
          createWorldRouter(services.world).prospectAdvance(input as Record<string, unknown>, ctx),
        ),
      prospectsList: standardProcedure
        .input(worldInputs.prospectsList)
        .query(({ input, ctx }) =>
          createWorldRouter(services.world).prospectsList(input as Record<string, unknown>, ctx),
        ),
      evidenceQualityView: standardProcedure
        .input(worldInputs.evidenceQualityView)
        .query(({ input, ctx }) =>
          createWorldRouter(services.world).evidenceQualityView(
            input as Record<string, unknown>,
            ctx,
          ),
        ),
      factorCalibrate: standardProcedure
        .input(worldInputs.factorCalibrate)
        .mutation(({ input, ctx }) =>
          createWorldRouter(services.world).factorCalibrate(input as Record<string, unknown>, ctx),
        ),
      nextBestActionView: standardProcedure
        .input(worldInputs.nextBestActionView)
        .query(({ input, ctx }) =>
          createWorldRouter(services.world).nextBestActionView(
            input as Record<string, unknown>,
            ctx,
          ),
        ),
      opportunityCompare: standardProcedure
        .input(worldInputs.opportunityCompare)
        .query(({ input, ctx }) =>
          createWorldRouter(services.world).opportunityCompare(
            input as Record<string, unknown>,
            ctx,
          ),
        ),
      opportunityDrilldownView: standardProcedure
        .input(worldInputs.opportunityDrilldownView)
        .query(({ input, ctx }) =>
          createWorldRouter(services.world).opportunityDrilldownView(
            input as Record<string, unknown>,
            ctx,
          ),
        ),
    }),

    // ── SPRINT-093 — Orchestration Fabric (SPRINT-093) ───────────────
    //    Central coordination: work submission, cancellation, queue state,
    //    concurrency snapshot, metrics, and event stream. All procedures
    //    are authenticated + rate-limited; work items are owner-scoped.
    orchestrator: router({
      submitWork: heavyProcedure
        .input(
          z.object({
            userId: z.string().min(1),
            workType: z.string().min(1),
            priority: z.string().optional(),
            description: z.string().min(1),
            dependencies: z.array(z.string()).optional(),
            requiresDatabase: z.boolean().optional(),
            resourceProfile: z.string().optional(),
            aiCapability: z.string().optional(),
            idempotencyKey: z.string().optional(),
          }),
        )
        .mutation(({ input, ctx }) => {
          const orchRouter = createFabricOrchestratorRouter(services.orchestrator);
          return orchRouter.submitWork(input, ctx);
        }),

      getWorkItem: standardProcedure
        .input(z.object({ userId: z.string().min(1), workItemId: z.string().min(1) }))
        .query(({ input, ctx }) => {
          const orchRouter = createFabricOrchestratorRouter(services.orchestrator);
          return orchRouter.getWorkItem(input, ctx);
        }),

      cancelWork: standardProcedure
        .input(
          z.object({
            userId: z.string().min(1),
            workItemId: z.string().min(1),
            reason: z.string().min(1),
          }),
        )
        .mutation(({ input, ctx }) => {
          const orchRouter = createFabricOrchestratorRouter(services.orchestrator);
          return orchRouter.cancelWork(input, ctx);
        }),

      getQueueState: standardProcedure
        .input(z.object({ userId: z.string().min(1) }))
        .query(({ input, ctx }) => {
          const orchRouter = createFabricOrchestratorRouter(services.orchestrator);
          return orchRouter.getQueueState(input, ctx);
        }),

      getConcurrency: standardProcedure
        .input(z.object({ userId: z.string().min(1) }))
        .query(({ input, ctx }) => {
          const orchRouter = createFabricOrchestratorRouter(services.orchestrator);
          return orchRouter.getConcurrency(input, ctx);
        }),

      getMetrics: standardProcedure
        .input(z.object({ userId: z.string().min(1) }))
        .query(({ input, ctx }) => {
          const orchRouter = createFabricOrchestratorRouter(services.orchestrator);
          return orchRouter.getMetrics(input, ctx);
        }),

      getEvents: standardProcedure
        .input(z.object({ userId: z.string().min(1), limit: z.number().optional() }))
        .query(({ input, ctx }) => {
          const orchRouter = createFabricOrchestratorRouter(services.orchestrator);
          return orchRouter.getEvents(input, ctx);
        }),
    }),
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
