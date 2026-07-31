// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Orchestration Application Service
// Orchestrates AI provider requests: context assembly → routing →
// execution (with retry + fallback) → validation → response
// Uses its requestCache and AIMetrics observability on every call.
// ARC-005 — AI Orchestration
// ──────────────────────────────────────────────────────────────────

import { BaseService, ValidationError, NotFoundError, generateId, sleep } from '@vedmoulya/core';
import {
  AIRequestFactory,
  AIDomainService,
  supportedCapabilityRule,
  qualityTierRule,
  fallbackRule,
  retryLimitRule,
  ProviderId,
} from '@vedmoulya/ai';
import type {
  AIResponse,
  AIRequest,
  CapabilityType,
  QualityTier,
  ProviderHealth,
  FailureReason,
} from '@vedmoulya/ai';
import { AIMapper } from './AIMapper.js';
import { AIMetrics } from './AIMetrics.js';
import type {
  OrchestrateRequestDTO,
  OrchestrateResponseDTO,
  ProviderHealthDTO,
  ProviderListDTO,
  CapabilityListDTO,
} from './AIDTO.js';

// Provider adapter interface (implemented in services/orchestrator)
export interface ProviderAdapter {
  name: string;
  family: string;
  capabilities: CapabilityType[];
  isHealthy(): Promise<boolean>;
  getHealth(): Promise<ProviderHealth>;
  execute(request: {
    messages: Array<{ role: string; content: string }>;
    model: string;
    maxTokens?: number;
  }): Promise<AIResponse>;
  stream?(request: {
    messages: Array<{ role: string; content: string }>;
    model: string;
    maxTokens?: number;
  }): AsyncIterable<unknown>;
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Maximum retries per provider before falling back to the next candidate. */
const MAX_RETRIES = 3;

/** Upper bound for the in-memory request cache (FIFO eviction). */
const MAX_CACHE_ENTRIES = 100;

/** Cache TTL in milliseconds (5 minutes). */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Optional runtime tuning for the orchestrator (used by tests to speed up
 * exponential backoff and by deployments to bound cache behaviour).
 *
 * Note: retry count is governed by the AI domain rules (max 3 attempts per
 * provider) via `AIRequest.isRetryable()` / `retryLimitRule` — see
 * `executeWithRetryAndFallback`.
 */
export interface AIOrchestrationOptions {
  /** Base delay (ms) for exponential backoff retries. Default: 1000. */
  retryBaseDelayMs?: number;
  /** Maximum number of cached responses. Default: 100. */
  maxCacheEntries?: number;
  /** Cache TTL in milliseconds. Default: 5 minutes. */
  cacheTtlMs?: number;
}

export class AIOrchestrationService extends BaseService {
  private readonly domainService: AIDomainService;
  private readonly factory: AIRequestFactory;
  private readonly providers: Map<string, ProviderAdapter> = new Map();
  private readonly requestCache: Map<string, { response: AIResponse; cachedAt: number }> =
    new Map();
  private readonly metrics: AIMetrics;
  private readonly retryBaseDelayMs: number;
  private readonly maxCacheEntries: number;
  private readonly cacheTtlMs: number;

  constructor(options: AIOrchestrationOptions = {}) {
    super('ai-orchestrator');
    this.domainService = new AIDomainService();
    this.factory = new AIRequestFactory();
    this.metrics = AIMetrics.getInstance();
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 1000;
    this.maxCacheEntries = options.maxCacheEntries ?? MAX_CACHE_ENTRIES;
    this.cacheTtlMs = options.cacheTtlMs ?? CACHE_TTL_MS;
  }

  // ── Provider Registration ────────────────────────────────────────────────

  registerProvider(adapter: ProviderAdapter): void {
    this.providers.set(adapter.name, adapter);
    this.logger.info('Provider registered', {
      provider: adapter.name,
      capabilities: adapter.capabilities,
    });
  }

  getProvider(name: string): ProviderAdapter | undefined {
    return this.providers.get(name);
  }

  // ── Capability Routing ───────────────────────────────────────────────────

  private selectCandidates(capability: CapabilityType, tier: QualityTier): ProviderAdapter[] {
    // Validate capability
    const capabilityRule = supportedCapabilityRule(capability);
    if (!capabilityRule.passed) {
      throw new ValidationError(capabilityRule.message ?? 'Unsupported capability');
    }

    // Validate tier
    const tierRule = qualityTierRule(capability, tier);
    if (!tierRule.passed) {
      throw new ValidationError(tierRule.message ?? 'Invalid quality tier');
    }

    // Find providers supporting this capability
    const candidates = Array.from(this.providers.values()).filter((p) =>
      p.capabilities.includes(capability),
    );

    if (candidates.length === 0) {
      throw new NotFoundError('Provider', capability);
    }

    return candidates;
  }

  // ── Request Cache ────────────────────────────────────────────────────────

  /**
   * Deterministic cache key from the request inputs that affect the response.
   */
  private buildCacheKey(request: OrchestrateRequestDTO): string {
    const canonical = JSON.stringify({
      capability: request.capability,
      userInput: request.userInput,
      qualityTier: request.qualityTier,
      systemPrompt: request.context?.systemPrompt ?? null,
      identityContext: request.context?.identityContext ?? null,
      knowledgeContext: request.context?.knowledgeContext ?? null,
      memoryContext: request.context?.memoryContext ?? null,
      decisionContext: request.context?.decisionContext ?? null,
      executionContext: request.context?.executionContext ?? null,
      conversationHistory: request.context?.conversationHistory ?? null,
      // Constraints affect the provider request (maxOutputTokens etc.), so they
      // must be part of the cache identity to avoid serving wrong responses.
      constraints: request.constraints ?? null,
      userId: request.userId ?? null,
      conversationId: request.conversationId ?? null,
    });
    return this.hashString(canonical);
  }

  /**
   * Small deterministic FNV-1a hash to keep cache keys bounded in size.
   */
  private hashString(input: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36);
  }

  private getCached(key: string): AIResponse | undefined {
    const entry = this.requestCache.get(key);
    if (!entry) return undefined;

    // Evict expired entries
    if (Date.now() - entry.cachedAt > this.cacheTtlMs) {
      this.requestCache.delete(key);
      return undefined;
    }

    return entry.response;
  }

  private setCached(key: string, response: AIResponse): void {
    // FIFO eviction when the cache exceeds its bound
    if (this.requestCache.size >= this.maxCacheEntries) {
      const oldestKey = this.requestCache.keys().next().value;
      if (oldestKey !== undefined) {
        this.requestCache.delete(oldestKey);
      }
    }
    this.requestCache.set(key, { response, cachedAt: Date.now() });
  }

  // ── Failure Classification ───────────────────────────────────────────────

  /**
   * Map a provider error to a domain FailureReason so retry/fallback rules
   * can decide the right recovery action.
   */
  private classifyFailure(error: unknown): FailureReason {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error);

    if (message.includes('429') || message.includes('rate limit')) {
      return 'rate_limited';
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'timeout';
    }
    // Match 5xx provider status codes precisely (e.g. "api error: 503") plus
    // transport-level failures. Avoids broad substring false positives.
    if (
      /api error: 5\d{2}/.test(message) ||
      message.includes('fetch failed') ||
      message.includes('network') ||
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('unavailable')
    ) {
      return 'provider_unavailable';
    }
    return 'internal_error';
  }

  // ── Core Orchestration ───────────────────────────────────────────────────

  async orchestrate(request: OrchestrateRequestDTO): Promise<OrchestrateResponseDTO> {
    const requestId = generateId();
    this.logger.info('Orchestrating request', { requestId, capability: request.capability });
    this.metrics.recordRequest();

    // 0. Request cache lookup (existing requestCache)
    const cacheKey = this.buildCacheKey(request);
    const cached = this.getCached(cacheKey);
    if (cached) {
      this.metrics.recordCacheHit();
      this.logger.info('AI cache hit', { requestId, capability: request.capability });
      // Note: cached responses carry the original call's latency/cost/traceId,
      // so consumers should treat those as the cached computation, not the
      // current request's.
      return AIMapper.toOrchestrateResponse(cached);
    }
    this.metrics.recordCacheMiss();

    // 1. Create domain entity
    const aiRequest = this.factory.createNewRequest({
      capability: request.capability,
      systemInstructions:
        request.context?.systemPrompt ?? 'You are a helpful AI assistant within VedMoulya.',
      userInput: request.userInput,
      userContext: request.context?.identityContext,
      taskContext: request.context?.knowledgeContext,
      constraints: request.constraints ? [JSON.stringify(request.constraints)] : undefined,
      safetyInstructions: ['Do not fabricate information', 'Be helpful and honest'],
      qualityTier: request.qualityTier,
      userId: request.userId,
      conversationId: request.conversationId,
      metadata: { requestId },
    });

    // 2. Validate constraints (counter tracks total validation attempts)
    this.metrics.recordValidationResult();
    const validationErrors = this.domainService.validateConstraints(aiRequest);
    if (validationErrors.length > 0) {
      throw new ValidationError(validationErrors.join('; '));
    }

    // 3. Select candidate providers (primary + fallbacks)
    const candidates = this.selectCandidates(request.capability, request.qualityTier);

    // 4. Build messages for provider
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: aiRequest.prompt.systemInstructions },
    ];

    if (aiRequest.prompt.userContext) {
      messages.push({ role: 'system', content: `User Context: ${aiRequest.prompt.userContext}` });
    }

    if (aiRequest.prompt.taskContext) {
      messages.push({ role: 'system', content: `Task Context: ${aiRequest.prompt.taskContext}` });
    }

    messages.push({ role: 'user', content: aiRequest.prompt.userInput });

    // 5. Execute with per-provider retry and cross-provider fallback
    const response = await this.executeWithRetryAndFallback(
      candidates,
      messages,
      request.constraints?.maxOutputTokens,
      aiRequest,
    );

    // 6. Cache the successful response
    this.setCached(cacheKey, response);

    // 7. Map to DTO and return
    return AIMapper.toOrchestrateResponse(response);
  }

  /**
   * Execute the request against candidate providers, retrying each provider
   * on retryable failures (exponential backoff) and falling back to the next
   * candidate when a provider exhausts its retries. Records every attempt,
   * success, failure, fallback, token usage, and cost via AIMetrics.
   */
  private async executeWithRetryAndFallback(
    candidates: ProviderAdapter[],
    messages: Array<{ role: string; content: string }>,
    maxTokens: number | undefined,
    aiRequest: AIRequest,
  ): Promise<AIResponse> {
    let lastError: Error | undefined;

    for (const [candidateIndex, provider] of candidates.entries()) {
      const providerId = ProviderId.create(provider.name);
      // First provider routes from 'pending'; fallback providers move from
      // 'failed' back to 'routing' via the domain entity's fallback().
      if (aiRequest.status === 'pending') {
        aiRequest.assignProvider(providerId);
      } else {
        aiRequest.fallback(providerId);
      }

      // Per-provider retry loop. Retry budget is capped by the AI domain
      // rules (AIRequest.isRetryable() / retryLimitRule allow attempts < 3).
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        aiRequest.startExecution();
        try {
          const response = await provider.execute({ messages, model: provider.name, maxTokens });
          aiRequest.complete(response);

          // Success observability
          this.metrics.recordSuccess(response.latency);
          this.metrics.recordTokenUsage(response.tokenUsage.input, response.tokenUsage.output);
          this.metrics.recordCost(response.cost);
          this.logger.info('AI provider success', {
            provider: provider.name,
            attempt: aiRequest.attempts,
            latency: response.latency,
          });
          return response;
        } catch (error) {
          lastError = error as Error;
          const reason = this.classifyFailure(error);
          aiRequest.fail(reason, lastError.message);

          if (reason === 'rate_limited') {
            this.metrics.recordRateLimit();
          }

          // Retryable and attempts remain?
          const retryRule = retryLimitRule(reason, aiRequest.attempts);
          if (aiRequest.isRetryable() && retryRule.passed && attempt < MAX_RETRIES) {
            const delay = this.domainService.calculateBackoff(
              aiRequest.attempts,
              this.retryBaseDelayMs,
            );
            this.logger.warn('AI provider attempt failed, retrying', {
              provider: provider.name,
              attempt: aiRequest.attempts,
              reason,
              delayMs: delay,
            });
            await sleep(delay);
            aiRequest.fallback(providerId); // failed → routing for next attempt
            continue;
          }

          // Exhausted retries — try the next candidate provider
          this.logger.warn('AI provider failed after retries', {
            provider: provider.name,
            reason,
            attempts: aiRequest.attempts,
          });
          break;
        }
      }

      // Fallback decision: another candidate remains and we're within budget
      const hasNext = candidateIndex < candidates.length - 1;
      const fallback = fallbackRule(true, hasNext, aiRequest.attempts);
      if (fallback.passed && hasNext) {
        this.metrics.recordFallback();
        this.logger.warn('Falling back to next AI provider', { from: provider.name });
        continue;
      }

      this.metrics.recordFailure();
      break;
    }

    throw lastError ?? new Error('All AI providers failed');
  }

  // ── Health ───────────────────────────────────────────────────────────────

  async getProviderHealth(providerName: string): Promise<ProviderHealthDTO> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new NotFoundError('Provider', providerName);
    }

    const health = await provider.getHealth();
    this.metrics.recordProviderHealth(health.status === 'healthy');
    return AIMapper.toProviderHealthDTO(health);
  }

  async getAllProviderHealth(): Promise<ProviderHealthDTO[]> {
    const results: ProviderHealthDTO[] = [];
    for (const [, provider] of this.providers) {
      try {
        const health = await provider.getHealth();
        this.metrics.recordProviderHealth(health.status === 'healthy');
        results.push(AIMapper.toProviderHealthDTO(health));
      } catch {
        this.metrics.recordProviderHealth(false);
        results.push({
          providerId: provider.name,
          status: 'down',
          latency: 0,
          errorRate: 1,
          isRateLimited: false,
          lastChecked: new Date().toISOString(),
        });
      }
    }
    return results;
  }

  // ── Provider & Capability Listing ────────────────────────────────────────

  listProviders(): ProviderListDTO {
    const providers = Array.from(this.providers.values()).map((p) => ({
      id: p.name,
      family: p.family as import('@vedmoulya/ai').ProviderFamily,
      status: 'registered',
      capabilities: p.capabilities,
      models: [p.name],
    }));

    return { providers, total: providers.length };
  }

  listCapabilities(): CapabilityListDTO {
    const capabilityMap = new Map<CapabilityType, Set<string>>();

    for (const [, provider] of this.providers) {
      for (const cap of provider.capabilities) {
        if (!capabilityMap.has(cap)) {
          capabilityMap.set(cap, new Set());
        }
        capabilityMap.get(cap)?.add(provider.name);
      }
    }

    const capabilities = Array.from(capabilityMap.entries()).map(([type, providers]) => ({
      type,
      providerCount: providers.size,
      bestProvider: Array.from(providers)[0] ?? 'none',
    }));

    return { capabilities, total: capabilities.length };
  }
}
