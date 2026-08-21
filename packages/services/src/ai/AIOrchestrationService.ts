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
  TokenEstimationService,
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
import { ProviderRoutingAdvisor } from './runtime/ProviderRoutingAdvisor.js';
import { ContextOptimizer } from './runtime/ContextOptimizer.js';
import { PromptCacheManager } from './runtime/PromptCacheManager.js';
import { StructuredOutputValidator } from './runtime/StructuredOutputValidator.js';
import { EvidenceEvaluator } from './runtime/EvidenceEvaluator.js';
import { AIObservability } from './runtime/AIObservability.js';
import type {
  ProviderIntelligencePort,
  ExecutionStrategyPort,
  ProviderSelectionExplanation,
  RagRetrievalPort,
  TokenOptimizationResult,
  EvidenceAssessment,
  EvidenceItem,
  ContextSelectionExplanation,
} from './runtime/index.js';
import type {
  OrchestrateRequestDTO,
  OrchestrateResponseDTO,
  ProviderHealthDTO,
  ProviderListDTO,
  CapabilityListDTO,
  StreamRunDTO,
  StreamEventDTO,
  ProviderSelectionDTO,
  TokenOptimizationDTO,
  EvidenceAssessmentDTO,
  ContextSelectionExplanationDTO,
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
  /**
   * Schema-validated structured output (AI-RUNTIME-002). Optional: adapters
   * that cannot produce typed objects fall back to plain `execute` and the
   * runtime validates the text result deterministically.
   */
  generateStructured?(request: {
    messages: Array<{ role: string; content: string }>;
    model: string;
    maxTokens?: number;
    schema: Record<string, unknown>;
  }): Promise<AIResponse>;
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
  /** EI-002 provider intelligence port (AI-RUNTIME-002). */
  providerIntelligence?: ProviderIntelligencePort;
  /** EI-004 execution strategy port (AI-RUNTIME-002). */
  executionStrategy?: ExecutionStrategyPort;
  /** EI-003 input-optimization pipeline (AI-RUNTIME-002). */
  contextOptimizer?: ContextOptimizer;
  /** Provider-aware prompt cache (AI-RUNTIME-002). */
  promptCache?: PromptCacheManager;
  /** Production RAG retrieval port (AI-RUNTIME-002). */
  rag?: RagRetrievalPort;
  /** Evidence-First evaluator (AI-RUNTIME-002 Phase 8). */
  evidenceEvaluator?: EvidenceEvaluator;
  /** AI observability (AI-RUNTIME-002 C-03). Defaults to NOOP. */
  observability?: AIObservability;
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
  private readonly structuredValidator = new StructuredOutputValidator();
  private providerIntelligence: ProviderIntelligencePort | undefined;
  private executionStrategy: ExecutionStrategyPort | undefined;
  private readonly contextOptimizer: ContextOptimizer | undefined;
  private readonly promptCache: PromptCacheManager | undefined;
  private rag: RagRetrievalPort | undefined;
  private readonly evidenceEvaluator: EvidenceEvaluator;
  private readonly observability: AIObservability;
  private advisor: ProviderRoutingAdvisor | undefined;

  constructor(options: AIOrchestrationOptions = {}) {
    super('ai-orchestrator');
    this.domainService = new AIDomainService();
    this.factory = new AIRequestFactory();
    this.metrics = AIMetrics.getInstance();
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 1000;
    this.maxCacheEntries = options.maxCacheEntries ?? MAX_CACHE_ENTRIES;
    this.cacheTtlMs = options.cacheTtlMs ?? CACHE_TTL_MS;
    this.providerIntelligence = options.providerIntelligence;
    this.executionStrategy = options.executionStrategy;
    this.contextOptimizer = options.contextOptimizer;
    this.promptCache = options.promptCache;
    this.rag = options.rag;
    this.evidenceEvaluator = options.evidenceEvaluator ?? new EvidenceEvaluator();
    this.observability = options.observability ?? new AIObservability();
    this.rebuildAdvisor();
  }

  /**
   * Wire the EI-002 / EI-004 intelligence ports after construction (the
   * gateway constructs this service before its registry application services
   * exist). Re-usable for runtime reconfiguration.
   */
  configureIntelligence(options: {
    providerIntelligence?: ProviderIntelligencePort;
    executionStrategy?: ExecutionStrategyPort;
    rag?: RagRetrievalPort;
  }): void {
    this.providerIntelligence = options.providerIntelligence ?? this.providerIntelligence;
    this.executionStrategy = options.executionStrategy ?? this.executionStrategy;
    if (options.rag !== undefined) {
      this.rag = options.rag;
    }
    this.rebuildAdvisor();
  }

  private rebuildAdvisor(): void {
    this.advisor =
      this.providerIntelligence && this.executionStrategy
        ? new ProviderRoutingAdvisor(this.providerIntelligence, this.executionStrategy)
        : undefined;
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
   * Includes RAG query + evidence grounding so a grounding-required request can
   * never be served a cached ungrounded answer, and vice versa.
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
      // AI-RUNTIME-002: RAG evidence + grounding policy are part of the response
      // identity — a grounded answer must never be served for an ungrounded
      // request or vice versa.
      ragQuery: request.ragQuery ?? null,
      groundingRequired: request.groundingRequired ?? false,
      enableOptimization: request.enableOptimization ?? false,
      structuredSchema: request.structuredSchema ?? null,
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
    const runSpan = this.observability.startSpan(
      'ai.run',
      requestId,
      { capability: request.capability },
      { userId: request.userId },
    );
    this.logger.info('Orchestrating request', { requestId, capability: request.capability });
    this.metrics.recordRequest();

    // Evidence-First: groundingRequired without a RAG query is a programming
    // error — the runtime cannot ground an answer it never retrieves.
    if (request.groundingRequired === true && !request.ragQuery) {
      throw new ValidationError(
        'groundingRequired is set but no ragQuery was supplied: grounding-required tasks must retrieve evidence.',
      );
    }

    // 0. Request cache lookup (existing requestCache). RAG-grounded and
    // grounding-required requests are NEVER served from or written to the
    // request cache: retrieved evidence changes over time and cached entries
    // cannot carry the evidence assessment, so serving a stale grounded answer
    // (or a fabricated ungrounded one for a grounding-required request) would
    // violate the Evidence-First contract.
    const usesEvidence = request.ragQuery !== undefined || request.groundingRequired === true;
    const cacheKey = this.buildCacheKey(request);
    const cached = usesEvidence ? undefined : this.getCached(cacheKey);
    if (cached) {
      this.metrics.recordCacheHit();
      this.logger.info('AI cache hit', { requestId, capability: request.capability });
      runSpan.setAttribute('cache', 'hit');
      runSpan.end();
      // Note: cached responses carry the original call's latency/cost/traceId,
      // so consumers should treat those as the cached computation, not the
      // current request's.
      return AIMapper.toOrchestrateResponse(cached);
    }
    this.metrics.recordCacheMiss();
    runSpan.setAttribute('cache', 'miss');

    // 0b. Production RAG retrieval (AI-RUNTIME-002): when a ragQuery is
    // supplied and the RAG port is wired, retrieved chunks are appended to
    // the knowledge context BEFORE optimization so the model sees fresh
    // enterprise knowledge. A retrieval failure never crashes the request —
    // the pipeline degrades to context-free execution with telemetry.
    //
    // Evidence-First (Phase 8): when groundingRequired is set, the retrieved
    // evidence is measured and the runtime ABSTAINS (returns a typed
    // abstention, no provider call) if evidence is insufficient or
    // irreconcilably conflicting — it never fabricates a grounded answer.
    // The assessment is also attached to successful responses for telemetry.
    let evidence: EvidenceAssessment | undefined;
    if (request.ragQuery && this.rag) {
      const retrievalSpan = this.observability.startSpan(
        'ai.retrieval',
        requestId,
        {
          collection: request.ragQuery.collection,
          query: request.ragQuery.query,
          topK: request.ragQuery.topK ?? 5,
        },
        { userId: request.userId },
      );
      try {
        const retrieval = await this.rag.retrieve({
          userId: request.userId ?? '',
          query: request.ragQuery.query,
          collection: request.ragQuery.collection,
          topK: request.ragQuery.topK,
        });
        const evidenceSpan = this.observability.startSpan(
          'ai.evidence',
          requestId,
          { item_count: retrieval.results.length },
          { userId: request.userId, parent: 'ai.retrieval' },
        );
        evidence = this.evidenceEvaluator.evaluate(
          retrieval.results.map((r): EvidenceItem => ({
            title: r.title,
            content: r.content,
            score: r.score,
            source: r.source ?? request.ragQuery?.collection ?? 'knowledge_base',
          })),
        );
        evidenceSpan.setAttribute('evidence_state', evidence.state);
        evidenceSpan.setAttribute('groundedness', evidence.groundedness);
        evidenceSpan.setAttribute('conflicting', evidence.conflictingEvidence);
        evidenceSpan.end();
        retrievalSpan.setAttribute('results', retrieval.results.length);
        if (retrieval.results.length > 0) {
          const chunks = retrieval.results.map((r) => `[${r.title}] ${r.content}`).join('\n');
          request = {
            ...request,
            context: {
              ...request.context,
              knowledgeContext: request.context?.knowledgeContext
                ? `${request.context.knowledgeContext}\n\nRetrieved knowledge:\n${chunks}`
                : `Retrieved knowledge:\n${chunks}`,
            },
          };
        }
        retrievalSpan.end();
      } catch (error) {
        retrievalSpan.end('error', error instanceof Error ? error.message : String(error));
        this.logger.warn('RAG retrieval failed; continuing without retrieved context', {
          requestId,
          error: error instanceof Error ? error.message : String(error),
        });
        // Evidence-First: a retrieval failure for a grounding-required task is
        // INSUFFICIENT evidence — abstain rather than fabricate.
        if (request.groundingRequired === true) {
          evidence = this.evidenceEvaluator.evaluate([]);
        }
      }

      // Evidence-First abstention: grounding was required but the evidence
      // cannot support a grounded answer (insufficient, conflicting, or
      // retrieval failed). Return a typed abstention instead of calling a
      // provider (no fabrication).
      if (
        evidence &&
        this.evidenceEvaluator.shouldAbstain(evidence, request.groundingRequired === true)
      ) {
        this.metrics.recordAbstention();
        this.logger.info('AI abstained: insufficient evidence for grounding-required task', {
          requestId,
          capability: request.capability,
          evidenceState: evidence.state,
        });
        const dto = AIMapper.toOrchestrateResponse(this.buildAbstentionResponse(request, evidence));
        runSpan.setAttribute('abstained', true);
        runSpan.setAttribute('evidence_state', evidence.state);
        runSpan.end();
        return {
          ...dto,
          evidence: this.toEvidenceDTO(evidence),
          abstained: true,
        };
      }
    }

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
      metadata: { requestId, userId: request.userId },
    });

    // 2. Validate constraints (counter tracks total validation attempts)
    this.metrics.recordValidationResult();
    const validationErrors = this.domainService.validateConstraints(aiRequest);
    if (validationErrors.length > 0) {
      throw new ValidationError(validationErrors.join('; '));
    }

    // 3. Build provider messages through the EI-003 optimization pipeline
    //    (raw → rank → filter → dedupe → compress → token estimate → budget).
    const optimizationSpan = this.observability.startSpan('ai.optimization', requestId);
    const { messages, optimization, selection } = this.buildOptimizedMessages(request, aiRequest);
    optimizationSpan.setAttribute('optimized', optimization !== undefined);
    if (optimization) {
      optimizationSpan.setAttribute('original_tokens', optimization.originalTokens);
      optimizationSpan.setAttribute('final_tokens', optimization.finalTokens);
      optimizationSpan.setAttribute('compression_ratio', optimization.compressionRatio);
    }
    optimizationSpan.end();

    // 3b. Token budget guard (AI-RUNTIME-001): deterministic pre-billed check.
    const estimatedInputTokens = TokenEstimationService.estimateMessagesTokens(messages);
    this.metrics.recordTokenEstimate(estimatedInputTokens);
    if (
      request.constraints?.maxInputTokens !== undefined &&
      estimatedInputTokens > request.constraints.maxInputTokens
    ) {
      throw new ValidationError(
        `Estimated input tokens (${estimatedInputTokens}) exceed the maxInputTokens budget (${request.constraints.maxInputTokens}). Reduce context or raise the budget.`,
      );
    }

    // 4. Candidate selection ordered by the EI-002/EI-004 advisor.
    const selectionSpan = this.observability.startSpan('ai.model_selection', requestId);
    let candidates = this.selectCandidates(request.capability, request.qualityTier);
    let providerSelection: ProviderSelectionDTO | undefined;
    if (this.advisor) {
      try {
        const explanation = await this.advisor.decide({
          capability: request.capability,
          estimatedInputTokens,
          requestedOutputTokens: request.constraints?.maxOutputTokens,
        });
        providerSelection = this.toProviderSelectionDTO(explanation);
        this.metrics.recordProviderSelection(explanation.selected.providerId);
        selectionSpan.setAttribute('selected_provider', explanation.selected.providerId);
        selectionSpan.setAttribute('selected_model', explanation.selected.modelId);
        candidates = this.orderCandidatesByAdvisor(candidates, explanation);
      } catch (error) {
        // Advisor failure is non-fatal: deterministic registration order.
        this.logger.warn('Provider advisor failed; using registration order', {
          requestId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    selectionSpan.setAttribute('candidates', candidates.length);
    selectionSpan.end();

    // 5. Execute — schema-validated structured output when requested.
    const response = request.structuredSchema
      ? await this.executeStructured(candidates, messages, request, aiRequest, requestId)
      : await this.executeWithRetryAndFallback(
          candidates,
          messages,
          request.constraints?.maxOutputTokens,
          aiRequest,
          requestId,
        );

    // 6. Cache the successful response (never for RAG/grounding-required runs)
    if (!usesEvidence) {
      this.setCached(cacheKey, response);
    }

    // 7. Map to DTO, augment with runtime contracts, return
    const dto = AIMapper.toOrchestrateResponse(response);
    runSpan.setAttribute('provider', response.provider);
    runSpan.setAttribute('input_tokens', response.tokenUsage.input);
    runSpan.setAttribute('output_tokens', response.tokenUsage.output);
    runSpan.setAttribute('cost', response.cost);
    runSpan.end();
    return {
      ...dto,
      providerSelection,
      tokenOptimization: optimization ? this.toTokenOptimizationDTO(optimization) : undefined,
      evidence: evidence ? this.toEvidenceDTO(evidence) : undefined,
      contextSelection: this.toContextSelectionDTO(selection),
    };
  }

  // ── AI-RUNTIME-002: Streamed run ─────────────────────────────────────────

  /**
   * Execute a request through the runtime and collect the provider stream as
   * typed events (server-side SDK streaming; the tRPC transport delivers the
   * collected run). Emits THINKING → PREPARING_CONTEXT → SELECTING_MODEL →
   * STREAMING → VALIDATING status events plus content chunks.
   */
  async stream(request: OrchestrateRequestDTO): Promise<StreamRunDTO> {
    const requestId = generateId();
    const runSpan = this.observability.startSpan(
      'ai.stream_run',
      requestId,
      { capability: request.capability },
      { userId: request.userId },
    );
    const events: StreamEventDTO[] = [];
    const emit = (event: StreamEventDTO): void => {
      events.push(event);
    };

    // Evidence-First: groundingRequired without a RAG query is a programming
    // error (same rule as orchestrate).
    if (request.groundingRequired === true && !request.ragQuery) {
      runSpan.end('error', 'groundingRequired without ragQuery');
      throw new ValidationError(
        'groundingRequired is set but no ragQuery was supplied: grounding-required tasks must retrieve evidence.',
      );
    }

    emit({ type: 'status', stage: 'thinking' });
    emit({ type: 'status', stage: 'preparing_context' });

    // Evidence-First: retrieve + evaluate evidence when RAG is configured,
    // and abstain (typed done event, no provider call) when a grounding-
    // required task has insufficient or conflicting evidence.
    let evidence: EvidenceAssessment | undefined;
    if (request.ragQuery && this.rag) {
      const retrievalSpan = this.observability.startSpan(
        'ai.retrieval',
        requestId,
        {
          collection: request.ragQuery.collection,
          query: request.ragQuery.query,
          topK: request.ragQuery.topK ?? 5,
        },
        { userId: request.userId },
      );
      try {
        const retrieval = await this.rag.retrieve({
          userId: request.userId ?? '',
          query: request.ragQuery.query,
          collection: request.ragQuery.collection,
          topK: request.ragQuery.topK,
        });
        const evidenceSpan = this.observability.startSpan(
          'ai.evidence',
          requestId,
          { item_count: retrieval.results.length },
          { userId: request.userId, parent: 'ai.retrieval' },
        );
        evidence = this.evidenceEvaluator.evaluate(
          retrieval.results.map((r): EvidenceItem => ({
            title: r.title,
            content: r.content,
            score: r.score,
            source: r.source ?? request.ragQuery?.collection ?? 'knowledge_base',
          })),
        );
        evidenceSpan.setAttribute('evidence_state', evidence.state);
        evidenceSpan.setAttribute('groundedness', evidence.groundedness);
        evidenceSpan.setAttribute('conflicting', evidence.conflictingEvidence);
        evidenceSpan.end();
        retrievalSpan.setAttribute('results', retrieval.results.length);
        if (retrieval.results.length > 0) {
          const chunks = retrieval.results.map((r) => `[${r.title}] ${r.content}`).join('\n');
          request = {
            ...request,
            context: {
              ...request.context,
              knowledgeContext: request.context?.knowledgeContext
                ? `${request.context.knowledgeContext}\n\nRetrieved knowledge:\n${chunks}`
                : `Retrieved knowledge:\n${chunks}`,
            },
          };
        }
        retrievalSpan.end();
      } catch (error) {
        retrievalSpan.end('error', error instanceof Error ? error.message : String(error));
        this.logger.warn('RAG retrieval failed; continuing without retrieved context', {
          requestId,
          error: error instanceof Error ? error.message : String(error),
        });
        if (request.groundingRequired === true) {
          const evidenceSpan = this.observability.startSpan(
            'ai.evidence',
            requestId,
            { item_count: 0 },
            { userId: request.userId, parent: 'ai.retrieval' },
          );
          evidence = this.evidenceEvaluator.evaluate([]);
          evidenceSpan.setAttribute('evidence_state', evidence.state);
          evidenceSpan.end();
        }
      }

      if (
        evidence &&
        this.evidenceEvaluator.shouldAbstain(evidence, request.groundingRequired === true)
      ) {
        this.metrics.recordAbstention();
        const abstention = this.buildAbstentionResponse(request, evidence);
        emit({ type: 'status', stage: 'validating' });
        emit({
          type: 'content',
          stage: 'streaming',
          content: abstention.content,
        });
        emit({ type: 'done', data: { abstained: true, evidenceState: evidence.state } });
        runSpan.setAttribute('abstained', true);
        runSpan.setAttribute('evidence_state', evidence.state);
        runSpan.end();
        return {
          traceId: requestId,
          events,
          final: {
            ...AIMapper.toOrchestrateResponse(abstention),
            evidence: this.toEvidenceDTO(evidence),
            abstained: true,
          },
        };
      }
    }

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
      metadata: { requestId, userId: request.userId },
    });

    const validationErrors = this.domainService.validateConstraints(aiRequest);
    if (validationErrors.length > 0) {
      throw new ValidationError(validationErrors.join('; '));
    }

    const optimizationSpan = this.observability.startSpan(
      'ai.optimization',
      requestId,
      {},
      { userId: request.userId },
    );
    const { messages, optimization, selection } = this.buildOptimizedMessages(request, aiRequest);
    optimizationSpan.setAttribute('optimized', optimization !== undefined);
    if (optimization) {
      optimizationSpan.setAttribute('original_tokens', optimization.originalTokens);
      optimizationSpan.setAttribute('final_tokens', optimization.finalTokens);
      optimizationSpan.setAttribute('compression_ratio', optimization.compressionRatio);
    }
    optimizationSpan.end();
    const candidates = this.selectCandidates(request.capability, request.qualityTier);
    emit({ type: 'status', stage: 'selecting_model' });

    let final: AIResponse;
    const streamingProvider = candidates.find((p) => typeof p.stream === 'function');
    // Generator methods must be bound to the adapter instance (`this` is
    // used for timeouts/usage inside the generator body).
    const streamFn = streamingProvider?.stream?.bind(streamingProvider);
    if (streamingProvider && streamFn) {
      const streamSpan = this.observability.startSpan(
        'ai.provider_execution',
        requestId,
        { provider: streamingProvider.name, mode: 'stream' },
        { userId: request.userId },
      );
      emit({ type: 'status', stage: 'streaming' });
      let text = '';
      try {
        for await (const chunk of streamFn({
          messages,
          model: streamingProvider.name,
          maxTokens: request.constraints?.maxOutputTokens,
        })) {
          const c = chunk as {
            type?: string;
            data?: {
              text?: string;
              latencyMs?: number;
              tokenUsage?: { input: number; output: number };
            };
          };
          if (c.type === 'content' && c.data?.text) {
            text += c.data.text;
            emit({ type: 'content', stage: 'streaming', content: c.data.text });
          } else if (c.type === 'done' && c.data) {
            emit({ type: 'done', data: c.data });
          }
        }
        streamSpan.setAttribute('status', 'success');
        streamSpan.setAttribute('output_tokens', TokenEstimationService.estimateTokens(text));
        streamSpan.end();
      } catch (error) {
        streamSpan.end('error', error instanceof Error ? error.message : String(error));
        runSpan.end('error', error instanceof Error ? error.message : String(error));
        emit({ type: 'error', data: { message: 'streaming failed' } });
        throw error;
      }
      final = this.buildStreamedResponse(streamingProvider, text, request, aiRequest);
    } else {
      // Non-streaming provider: the full response is delivered as a single
      // content chunk, but the run still advertises the streaming stage so
      // consumers observe the full IDLE → THINKING → … → STREAMING → …
      // sequence even when the adapter has no native stream.
      emit({ type: 'status', stage: 'streaming' });
      final = await this.executeWithRetryAndFallback(
        candidates,
        messages,
        request.constraints?.maxOutputTokens,
        aiRequest,
        requestId,
      );
      emit({ type: 'content', stage: 'streaming', content: final.content });
    }

    emit({ type: 'status', stage: 'validating' });
    const dto = AIMapper.toOrchestrateResponse(final);
    const finalDto: OrchestrateResponseDTO = {
      ...dto,
      tokenOptimization: optimization ? this.toTokenOptimizationDTO(optimization) : undefined,
      evidence: evidence ? this.toEvidenceDTO(evidence) : undefined,
      contextSelection: this.toContextSelectionDTO(selection),
    };
    emit({ type: 'done', data: { provider: final.provider, model: final.model } });
    runSpan.setAttribute('provider', final.provider);
    runSpan.end();

    return { traceId: requestId, events, final: finalDto };
  }

  // ── AI-RUNTIME-002: Schema-validated structured output ───────────────────

  /**
   * Execute with schema-validated structured output. Uses the adapter's
   * generateStructured path when available; otherwise executes text and
   * validates deterministically with bounded retry. Business engines never
   * receive unvalidated model JSON.
   */
  private async executeStructured(
    candidates: ProviderAdapter[],
    messages: Array<{ role: string; content: string }>,
    request: OrchestrateRequestDTO,
    aiRequest: AIRequest,
    requestId?: string,
  ): Promise<AIResponse> {
    const schema = request.structuredSchema ?? {};
    let lastError: Error | undefined;

    for (const provider of candidates) {
      const providerId = ProviderId.create(provider.name);
      if (aiRequest.status === 'pending') {
        aiRequest.assignProvider(providerId);
      } else {
        aiRequest.fallback(providerId);
      }

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        aiRequest.startExecution();
        const executionSpan = this.observability.startSpan(
          'ai.provider_execution',
          requestId ?? 'unknown',
          { provider: provider.name, mode: 'structured', attempt },
          { userId: request.userId },
        );
        try {
          const response = provider.generateStructured
            ? await provider.generateStructured({
                messages,
                model: provider.name,
                maxTokens: request.constraints?.maxOutputTokens,
                schema,
              })
            : await provider.execute({
                messages,
                model: provider.name,
                maxTokens: request.constraints?.maxOutputTokens,
              });

          const validationSpan = this.observability.startSpan(
            'ai.validation',
            requestId ?? 'unknown',
            { mode: 'structured', provider: provider.name },
            { userId: request.userId, parent: 'ai.provider_execution' },
          );
          const validation = this.structuredValidator.validate(schema, response.content);
          validationSpan.setAttribute('valid', validation.ok);
          validationSpan.end();
          if (!validation.ok) {
            throw new Error(`Structured output validation failed: ${validation.errors.join('; ')}`);
          }

          executionSpan.setAttribute('status', 'success');
          executionSpan.setAttribute('input_tokens', response.tokenUsage.input);
          executionSpan.setAttribute('output_tokens', response.tokenUsage.output);
          executionSpan.setAttribute('cost', response.cost);
          executionSpan.setAttribute('latency_ms', response.latency);
          executionSpan.end();
          aiRequest.complete(response);
          this.metrics.recordSuccess(response.latency);
          this.metrics.recordTokenUsage(response.tokenUsage.input, response.tokenUsage.output);
          this.metrics.recordCost(response.cost);
          this.logger.info('AI structured output success', {
            provider: provider.name,
            attempt: aiRequest.attempts,
            latency: response.latency,
          });
          return response;
        } catch (error) {
          lastError = error as Error;
          const reason = this.classifyFailure(error);
          aiRequest.fail(reason, lastError.message);
          executionSpan.setAttribute('status', 'error');
          executionSpan.setAttribute('error_reason', reason);
          executionSpan.end('error', lastError.message);
          if (attempt < MAX_RETRIES) {
            const retrySpan = this.observability.startSpan(
              'ai.retry',
              requestId ?? 'unknown',
              { provider: provider.name, attempt, reason },
              { userId: request.userId, parent: 'ai.provider_execution' },
            );
            await sleep(
              this.domainService.calculateBackoff(aiRequest.attempts, this.retryBaseDelayMs),
            );
            retrySpan.end();
            aiRequest.fallback(providerId);
          }
        }
      }
      const fallbackSpan = this.observability.startSpan(
        'ai.fallback',
        requestId ?? 'unknown',
        { from: provider.name, remaining: candidates.length - 1 },
        { userId: request.userId },
      );
      fallbackSpan.end();
      this.metrics.recordFallback();
    }

    this.metrics.recordFailure();
    throw lastError ?? new Error('Structured output failed for all providers');
  }

  // ── AI-RUNTIME-002: Provider selection explanation ───────────────────────

  /**
   * Pure decision query: why would the runtime pick a provider/model for this
   * capability? Consumes live EI-002/EI-004 intelligence, executes nothing.
   */
  async explainSelection(input: {
    capability: CapabilityType;
    estimatedInputTokens?: number;
    requestedOutputTokens?: number;
  }): Promise<ProviderSelectionDTO> {
    if (!this.advisor) {
      throw new NotFoundError('ProviderRoutingAdvisor', 'not configured');
    }
    const explanation = await this.advisor.decide({
      capability: input.capability,
      estimatedInputTokens: input.estimatedInputTokens ?? 1_000,
      requestedOutputTokens: input.requestedOutputTokens,
    });
    return this.toProviderSelectionDTO(explanation);
  }

  // ── AI-RUNTIME-002: Context optimization pipeline ────────────────────────

  /**
   * Build the provider messages, applying the EI-003 optimization pipeline
   * when enabled and the prompt cache when wired. Returns the optimization
   * measurement so orchestrate()/stream() can attach it to the response.
   */
  private buildOptimizedMessages(
    request: OrchestrateRequestDTO,
    aiRequest: AIRequest,
  ): {
    messages: Array<{ role: string; content: string }>;
    optimization: TokenOptimizationResult | undefined;
    selection: ContextSelectionExplanation[] | undefined;
  } {
    const systemInstructions = aiRequest.prompt.systemInstructions;
    const sections = this.buildContextSections(request);

    // Prompt cache: reuse an optimized stable prefix keyed by identity +
    // capability + RAW stable request content (system + unoptimized context
    // sections). The user input NEVER participates in the key. Keying on the
    // raw stable input — not the optimized output — guarantees read/write
    // key parity: the same stable request always resolves to the same entry
    // and skips re-optimization, while the stored value is the optimized
    // prefix ready for a fresh dynamic tail.
    // C-05: the prompt cache is OPTIONAL infrastructure — a cache failure
    // (get/set throws) must degrade to a cache miss and never break the AI
    // request, and must never serve another user's cached prefix (keys are
    // identity-scoped).
    let cacheKey: string | undefined;
    let cacheEntry: import('./runtime/PromptCacheManager.js').PromptCacheEntry | undefined;
    if (this.promptCache && sections.length > 0) {
      try {
        cacheKey = this.promptCache.keyFor({
          userId: request.userId ?? 'anonymous',
          capability: request.capability,
          stableMessages: [
            { role: 'system', content: systemInstructions },
            ...sections.map((s) => ({ role: 'system' as const, content: s.content })),
          ],
        });
        cacheEntry = this.promptCache.get(cacheKey);
      } catch {
        // Cache failure → treat as a miss and re-optimize (never crash).
        cacheKey = undefined;
        cacheEntry = undefined;
      }
    }
    if (cacheKey && this.promptCache && cacheEntry) {
      return {
        messages: [
          ...cacheEntry.stableMessages,
          { role: 'user', content: aiRequest.prompt.userInput },
        ],
        optimization: undefined,
        selection: undefined,
      };
    }

    let optimizedSections = sections;
    let optimization: TokenOptimizationResult | undefined;
    let selection: ContextSelectionExplanation[] | undefined;
    if (this.contextOptimizer && request.enableOptimization && sections.length > 0) {
      const run = this.contextOptimizer.optimize({
        capability: request.capability,
        userInput: aiRequest.prompt.userInput,
        systemPrompt: systemInstructions,
        sections,
        maxInputTokens: request.constraints?.maxInputTokens,
        requestedOutputTokens: request.constraints?.maxOutputTokens,
      });
      optimization = run.result;
      optimizedSections = run.optimizedSections;
      selection = run.selection;
      this.metrics.recordContextOptimization(
        run.result.originalTokens,
        run.result.finalTokens,
        run.result.compressionRatio,
      );
      if (run.result.budgetBreached && request.constraints?.maxInputTokens !== undefined) {
        throw new ValidationError(
          `Context exceeds the maxInputTokens budget (${String(request.constraints.maxInputTokens)}) even after ranking, filtering, deduplication and compression. Reduce the context or raise the budget.`,
        );
      }
    }

    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemInstructions },
    ];
    for (const section of optimizedSections) {
      messages.push({ role: 'system', content: this.labelSection(section) + section.content });
    }
    messages.push({ role: 'user', content: aiRequest.prompt.userInput });

    // Cache the OPTIMIZED stable prefix under the RAW stable key so the next
    // identical stable request skips the EI-003 pipeline entirely. Failure to
    // write the cache must not fail the request (C-05).
    if (cacheKey && this.promptCache) {
      try {
        this.promptCache.set(cacheKey, {
          stableMessages: messages.slice(0, -1),
          stableTokens: TokenEstimationService.estimateMessagesTokens(messages.slice(0, -1)),
          cachedAt: Date.now(),
        });
      } catch {
        // Cache write failure → best-effort, request proceeds.
      }
    }

    return { messages, optimization, selection };
  }

  private buildContextSections(request: OrchestrateRequestDTO): Array<{
    source: import('./runtime/index.js').ContextSection['source'];
    category: import('./runtime/index.js').ContextSection['category'];
    content: string;
  }> {
    const sections: Array<{
      source: import('./runtime/index.js').ContextSection['source'];
      category: import('./runtime/index.js').ContextSection['category'];
      content: string;
    }> = [];
    const ctx = request.context;
    if (ctx?.identityContext) {
      sections.push({
        source: 'enterprise_memory',
        category: 'user_profile',
        content: ctx.identityContext,
      });
    }
    if (ctx?.knowledgeContext) {
      sections.push({
        source: 'knowledge_base',
        category: 'knowledge',
        content: ctx.knowledgeContext,
      });
    }
    if (ctx?.memoryContext) {
      sections.push({
        source: 'conversation_memory',
        category: 'memory',
        content: ctx.memoryContext,
      });
    }
    if (ctx?.decisionContext) {
      sections.push({
        source: 'business_rules',
        category: 'business',
        content: ctx.decisionContext,
      });
    }
    if (ctx?.executionContext) {
      sections.push({ source: 'project_data', category: 'project', content: ctx.executionContext });
    }
    return sections;
  }

  /** Preserve the human-readable prompt labels the pipeline previously emitted. */
  private labelSection(section: {
    source: import('./runtime/index.js').ContextSection['source'];
    category: import('./runtime/index.js').ContextSection['category'];
  }): string {
    switch (section.category) {
      case 'user_profile':
        return 'User Context: ';
      case 'knowledge':
        return 'Task Context: ';
      case 'memory':
        return 'Memory Context: ';
      case 'business':
        return 'Decision Context: ';
      case 'project':
        return 'Execution Context: ';
      default:
        return '';
    }
  }

  private orderCandidatesByAdvisor(
    candidates: ProviderAdapter[],
    explanation: ProviderSelectionExplanation,
  ): ProviderAdapter[] {
    const priority = new Map<string, number>();
    priority.set(explanation.selected.providerId, 0);
    explanation.fallback.forEach((fallback, index) => {
      priority.set(fallback.providerId, index + 1);
    });
    return [...candidates].sort((a, b) => {
      const pa = priority.get(a.name) ?? 100;
      const pb = priority.get(b.name) ?? 100;
      return pa - pb;
    });
  }

  private toProviderSelectionDTO(explanation: ProviderSelectionExplanation): ProviderSelectionDTO {
    return {
      capability: explanation.capability,
      selected: explanation.selected,
      fallback: explanation.fallback,
      candidatesConsidered: explanation.candidatesConsidered,
      strategy: explanation.strategy,
      estimatedInputTokens: explanation.estimatedInputTokens,
      estimatedCost: explanation.estimatedCost,
      evaluatedAt: explanation.evaluatedAt,
    };
  }

  private toContextSelectionDTO(
    selection: ContextSelectionExplanation[] | undefined,
  ): ContextSelectionExplanationDTO[] | undefined {
    if (!selection) return undefined;
    return selection.map((item) => ({
      itemId: item.itemId,
      source: item.source,
      category: item.category,
      content: item.content,
      selected: item.selected,
      score: item.score,
      tokens: item.tokens,
      reasons: item.reasons,
    }));
  }

  private toEvidenceDTO(assessment: EvidenceAssessment): EvidenceAssessmentDTO {
    return {
      state: assessment.state,
      evidenceCount: assessment.evidenceCount,
      availability: assessment.availability,
      groundedness: assessment.groundedness,
      relevance: assessment.relevance,
      sourceAuthority: assessment.sourceAuthority,
      sourceFreshness: assessment.sourceFreshness,
      conflictingEvidence: assessment.conflictingEvidence,
      reasons: assessment.reasons,
    };
  }

  /** Typed abstention response — used when grounding is required but evidence
   *  is insufficient or conflicting (Evidence-First, no fabrication). */
  private buildAbstentionResponse(
    request: OrchestrateRequestDTO,
    evidence: EvidenceAssessment,
  ): AIResponse {
    const message =
      evidence.state === 'CONFLICTING_EVIDENCE'
        ? 'VedMoulya found conflicting evidence for this question and could not provide a confident, grounded answer. Please narrow the question or provide additional sources.'
        : 'VedMoulya could not find sufficient evidence to answer this question confidently. It has abstained rather than fabricate an answer. Please provide more context or sources.';
    return {
      content: message,
      provider: 'abstention',
      model: 'abstention',
      confidence: 0,
      qualityScore: 0,
      latency: 0,
      cost: 0,
      tokenUsage: { input: 0, output: 0, total: 0 },
      validation: {
        passed: false,
        checks: [{ name: 'evidence', passed: false, score: 0 }],
        overallScore: 0,
        decision: 'reject',
      },
      traceId: `abstain-${String(Date.now())}`,
      metadata: {
        providerFamily: 'abstention' as import('@vedmoulya/ai').ProviderFamily,
        modelVersion: 'none',
        processingTime: 0,
        contextUsed: [],
        routingDecision: {
          selectedProvider: 'abstention',
          reason: `abstained: ${evidence.state}`,
          alternativesConsidered: [],
          strategy: 'balanced',
        },
        validationDetails: [{ name: 'evidence', passed: false, score: 0 }],
      },
    };
  }

  private toTokenOptimizationDTO(result: TokenOptimizationResult): TokenOptimizationDTO {
    return {
      originalTokens: result.originalTokens,
      rankedTokens: result.rankedTokens,
      filteredTokens: result.filteredTokens,
      compressedTokens: result.compressedTokens,
      finalTokens: result.finalTokens,
      tokensRemoved: result.tokensRemoved,
      compressionRatio: result.compressionRatio,
      itemsRemoved: result.itemsRemoved,
      strategyUsed: result.strategyUsed,
      estimatedInputCost: result.estimatedInputCost,
      estimatedOutputCost: result.estimatedOutputCost,
      estimatedTotalCost: result.estimatedTotalCost,
      budgetBreached: result.budgetBreached,
    };
  }

  /** Assemble an AIResponse from a fully-streamed provider output. */
  private buildStreamedResponse(
    provider: ProviderAdapter,
    text: string,
    _request: OrchestrateRequestDTO,
    _aiRequest: AIRequest,
  ): AIResponse {
    const tokens = TokenEstimationService.estimateTokens(text);
    return {
      content: text,
      provider: provider.name,
      model: provider.name,
      confidence: 0.9,
      qualityScore: 8.0,
      latency: 0,
      cost: 0,
      tokenUsage: { input: 0, output: tokens, total: tokens },
      validation: {
        passed: true,
        checks: [{ name: 'format', passed: true, score: 10 }],
        overallScore: 8.0,
        decision: 'pass',
      },
      traceId: `stream-${String(Date.now())}`,
      metadata: {
        providerFamily: provider.family as import('@vedmoulya/ai').ProviderFamily,
        modelVersion: provider.name,
        processingTime: 0,
        contextUsed: [],
        routingDecision: {
          selectedProvider: provider.name,
          reason: 'streamed execution',
          alternativesConsidered: [],
          strategy: 'balanced',
        },
        validationDetails: [],
      },
    };
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
    requestId?: string,
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
        const executionSpan = this.observability.startSpan(
          'ai.provider_execution',
          requestId ?? 'unknown',
          { provider: provider.name, attempt, mode: 'text' },
          { userId: requestId ? this.requestUser(aiRequest) : undefined },
        );
        try {
          const response = await provider.execute({ messages, model: provider.name, maxTokens });
          executionSpan.setAttribute('status', 'success');
          executionSpan.setAttribute('input_tokens', response.tokenUsage.input);
          executionSpan.setAttribute('output_tokens', response.tokenUsage.output);
          executionSpan.setAttribute('cost', response.cost);
          executionSpan.setAttribute('latency_ms', response.latency);
          executionSpan.end();
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
          executionSpan.setAttribute('status', 'error');
          executionSpan.setAttribute('error_reason', reason);
          executionSpan.end('error', lastError.message);
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
            const retrySpan = this.observability.startSpan(
              'ai.retry',
              requestId ?? 'unknown',
              { provider: provider.name, attempt, reason, delay_ms: delay },
              {
                userId: requestId ? this.requestUser(aiRequest) : undefined,
                parent: 'ai.provider_execution',
              },
            );
            this.logger.warn('AI provider attempt failed, retrying', {
              provider: provider.name,
              attempt: aiRequest.attempts,
              reason,
              delayMs: delay,
            });
            await sleep(delay);
            retrySpan.end();
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
        const fallbackSpan = this.observability.startSpan(
          'ai.fallback',
          requestId ?? 'unknown',
          { from: provider.name, remaining: candidates.length - candidateIndex - 1 },
          { userId: requestId ? this.requestUser(aiRequest) : undefined },
        );
        fallbackSpan.end();
        this.metrics.recordFallback();
        this.logger.warn('Falling back to next AI provider', { from: provider.name });
        continue;
      }

      this.metrics.recordFailure();
      break;
    }

    throw lastError ?? new Error('All AI providers failed');
  }

  /** Small helper: recover the requesting user for span correlation. */
  private requestUser(aiRequest: AIRequest): string | undefined {
    return aiRequest.metadata.userId as string | undefined;
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
