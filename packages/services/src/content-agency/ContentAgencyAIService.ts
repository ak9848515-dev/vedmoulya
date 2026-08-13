// ──────────────────────────────────────────────────────────────────
// VedMoulya — Content Agency AI Service
// EPIC-003 / SPRINT AC-001 — AI Content Agency Foundation
//
// Reusable enterprise AI generation pipeline. EVERY model call is routed
// through the shared AIOrchestrationService (Provider Manager + Prompt
// Library + capability routing). UI components never call providers.
//
// Pipeline (per AC-001):
//   Client → Brand Profile → Business Goals → Target Audience → Content
//   Brief → Knowledge Retrieval → Memory Retrieval → Research → Prompt
//   Builder → AI Orchestrator → AI Provider Selection → Draft Generation →
//   Brand Alignment Review → Grammar & Style Review → SEO Optimization →
//   Quality Scoring → (asset saved by the Application Service)
//
// Every generation is fully traceable and reproducible: the assembled
// prompt, provider, model, token usage, cost, latency, trace IDs and
// per-pass scores are returned in `ContentAIMetadata` and persisted with
// the content asset for reuse and analytics.
// ──────────────────────────────────────────────────────────────────

import type {
  AIOrchestrationService,
  MemoryApplicationService,
  KnowledgeApplicationService,
} from '@vedmoulya/services';
import type {
  ClientRecord,
  BrandRecord,
  ContentType,
  ContentAIMetadata,
  WorkflowStage,
} from '@vedmoulya/domain';

// ── Pipeline Context ───────────────────────────────────────────────────────

export interface GenerationContext {
  client: ClientRecord;
  brand: BrandRecord | null;
  contentType: ContentType;
  title: string;
  brief: string;
  goals: string[];
  targetAudience: string;
}

export interface GenerationPass {
  stage: WorkflowStage;
  score: number;
  traceId: string | null;
  failed: boolean;
}

export interface GenerationResult {
  content: string;
  researchNotes: string;
  qualityScore: number;
  aiMetadata: ContentAIMetadata;
}

export interface ContentAgencyAIServiceOptions {
  /** Enable Knowledge Engine + Memory Engine retrieval (default true). */
  enableRetrieval?: boolean;
  /** Default quality tier for drafts. */
  qualityTier?: 'premium' | 'standard' | 'economy';
}

// Content types that benefit from an SEO optimization pass.
const SEO_CONTENT_TYPES: readonly ContentType[] = [
  'blog',
  'website_copy',
  'landing_page',
  'product_description',
  'case_study',
];

// ── Service ────────────────────────────────────────────────────────────────

export class ContentAgencyAIService {
  private readonly ai: AIOrchestrationService;
  private readonly memory: MemoryApplicationService | null;
  private readonly knowledge: KnowledgeApplicationService | null;
  private readonly enableRetrieval: boolean;
  private readonly qualityTier: 'premium' | 'standard' | 'economy';

  constructor(
    ai: AIOrchestrationService,
    options: ContentAgencyAIServiceOptions & {
      memory?: MemoryApplicationService | null;
      knowledge?: KnowledgeApplicationService | null;
    } = {},
  ) {
    this.ai = ai;
    this.memory = options.memory ?? null;
    this.knowledge = options.knowledge ?? null;
    this.enableRetrieval = options.enableRetrieval ?? true;
    this.qualityTier = options.qualityTier ?? 'standard';
  }

  /** Immutable view with a different quality tier (per-request override). */
  withQualityTier(tier: 'premium' | 'standard' | 'economy' | undefined): ContentAgencyAIService {
    if (!tier || tier === this.qualityTier) return this;
    const next = new ContentAgencyAIService(this.ai, {
      memory: this.memory,
      knowledge: this.knowledge,
      enableRetrieval: this.enableRetrieval,
      qualityTier: tier,
    });
    return next;
  }

  // ── Public pipeline entry ────────────────────────────────────────────────

  /**
   * Run the full generation pipeline and return a traceable asset result.
   * Throws on orchestrator failure (no provider / capability missing) so the
   * caller can surface a clear error — never a silent template fallback.
   */
  async generate(userId: string, ctx: GenerationContext): Promise<GenerationResult> {
    const sections: string[] = [];

    // 1. Knowledge Retrieval (Knowledge Engine)
    const knowledgeNotes = this.enableRetrieval
      ? await this.retrieveKnowledge(ctx.brief, ctx.title)
      : '';
    if (knowledgeNotes) sections.push('knowledge-retrieval');

    // 2. Memory Retrieval (Memory Engine)
    const memoryNotes = this.enableRetrieval ? await this.retrieveMemory(userId, ctx.brief) : '';
    if (memoryNotes) sections.push('memory-retrieval');

    // 3. Research (AI Orchestrator — reasoning capability)
    const research = await this.orchestrate({
      capability: 'reasoning',
      stage: 'research',
      userId,
      system: RESEARCH_SYSTEM,
      user: this.buildResearchPrompt(ctx, knowledgeNotes, memoryNotes),
    });
    sections.push('research');

    // 4. Prompt Builder — brand-aware system + user prompts.
    const system = this.buildSystemPrompt(ctx);
    const user = this.buildUserPrompt(ctx, research.content, knowledgeNotes, memoryNotes);
    sections.push('prompt-builder');

    // 5. Draft Generation (AI Orchestrator — content_generation capability).
    const draft = await this.orchestrate({
      capability: 'content_generation',
      stage: 'draft',
      userId,
      system,
      user,
    });
    sections.push('draft');

    // 6. Brand Alignment Review.
    const brandPass = await this.runQualityPass('brand_alignment', ctx, draft.content, userId);

    // 7. Grammar & Style Review.
    const grammarPass = await this.runQualityPass('grammar', ctx, draft.content, userId);

    // 8. SEO Optimization (when applicable).
    const seoPass = SEO_CONTENT_TYPES.includes(ctx.contentType)
      ? await this.runQualityPass('seo', ctx, draft.content, userId)
      : null;

    // 9. Quality Scoring — weighted across the draft and every pass.
    const qualityScore = this.computeQualityScore(draft.qualityScore, [
      brandPass,
      grammarPass,
      seoPass,
    ]);

    const passes: GenerationPass[] = [brandPass, grammarPass, seoPass].filter(
      (p): p is GenerationPass => p !== null,
    );

    // Token/cost/latency aggregates cover research + draft (the two full model
    // calls). Quality passes reuse the same call shape but their usage is
    // intentionally not double-counted here — the metadata records them by
    // traceId for auditability.
    const totalTokens = draft.tokenUsage.total + research.tokenUsage.total;

    const aiMetadata: ContentAIMetadata = {
      capability: 'content_generation',
      prompt: { system, user, sections },
      provider: draft.provider,
      model: draft.model,
      qualityScore,
      traceId: draft.traceId,
      tokenUsage: {
        input: draft.tokenUsage.input + research.tokenUsage.input,
        output: draft.tokenUsage.output + research.tokenUsage.output,
        total: totalTokens,
      },
      cost: draft.cost + research.cost,
      latencyMs: draft.latencyMs + research.latencyMs,
      researchNotes: research.content,
      researchTraceId: research.traceId,
      passes: passes.map((p) => ({
        stage: p.stage,
        score: p.score,
        traceId: p.traceId,
      })),
    };

    return {
      content: draft.content,
      researchNotes: research.content,
      qualityScore,
      aiMetadata,
    };
  }

  /**
   * Regenerate with human feedback — reuses the original prompt and appends
   * the feedback as authoritative direction (reproducible, versioned).
   * Aggregates are cumulative (previous + this pass) so analytics never
   * undercount regenerated assets.
   */
  async regenerate(
    userId: string,
    ctx: GenerationContext,
    previous: ContentAIMetadata,
    feedback: string,
  ): Promise<GenerationResult> {
    const user = `${previous.prompt.user}\n\nHUMAN REVIEW FEEDBACK (must be incorporated):\n${feedback}`;
    const draft = await this.orchestrate({
      capability: 'content_generation',
      stage: 'draft',
      userId,
      system: previous.prompt.system,
      user,
    });

    const brandPass = await this.runQualityPass('brand_alignment', ctx, draft.content, userId);
    const grammarPass = await this.runQualityPass('grammar', ctx, draft.content, userId);
    const qualityScore = this.computeQualityScore(draft.qualityScore, [brandPass, grammarPass]);

    return {
      content: draft.content,
      researchNotes: previous.researchNotes,
      qualityScore,
      aiMetadata: {
        ...previous,
        provider: draft.provider,
        model: draft.model,
        qualityScore,
        traceId: draft.traceId,
        tokenUsage: {
          input: previous.tokenUsage.input + draft.tokenUsage.input,
          output: previous.tokenUsage.output + draft.tokenUsage.output,
          total: previous.tokenUsage.total + draft.tokenUsage.total,
        },
        cost: previous.cost + draft.cost,
        latencyMs: previous.latencyMs + draft.latencyMs,
        prompt: { ...previous.prompt, sections: [...previous.prompt.sections, 'regenerate'] },
        passes: [
          ...previous.passes,
          { stage: brandPass.stage, score: brandPass.score, traceId: brandPass.traceId },
          { stage: grammarPass.stage, score: grammarPass.score, traceId: grammarPass.traceId },
        ],
      },
    };
  }

  // ── Retrieval (Knowledge + Memory Engines) ───────────────────────────────

  private async retrieveKnowledge(query: string, title: string): Promise<string> {
    if (!this.knowledge) return '';
    try {
      const result = await this.knowledge.searchNodes(`${title} ${query}`.trim(), {
        page: 1,
        limit: 8,
      });
      if (result.nodes.length === 0) return '';
      return result.nodes
        .slice(0, 8)
        .map((n) => `- ${n.label}: ${n.description}`)
        .join('\n');
    } catch {
      return '';
    }
  }

  private async retrieveMemory(userId: string, query: string): Promise<string> {
    if (!this.memory) return '';
    try {
      const result = await this.memory.searchMemories({ query, limit: 8 });
      const memories = result.data?.data ?? [];
      if (memories.length === 0) return '';
      return memories
        .slice(0, 8)
        .map((m) => `- ${m.content}`)
        .join('\n');
    } catch {
      return '';
    }
  }

  // ── Orchestrator wrapper ─────────────────────────────────────────────────

  private async orchestrate(params: {
    capability: 'reasoning' | 'content_generation';
    stage: string;
    userId: string;
    system: string;
    user: string;
  }): Promise<{
    content: string;
    provider: string;
    model: string;
    qualityScore: number;
    traceId: string;
    tokenUsage: { input: number; output: number; total: number };
    cost: number;
    latencyMs: number;
  }> {
    const response = await this.ai.orchestrate({
      capability: params.capability,
      userInput: params.user,
      qualityTier: this.qualityTier,
      userId: params.userId,
      constraints: { outputFormat: 'markdown', maxOutputTokens: 3000 },
      context: {
        systemPrompt: params.system,
        identityContext: 'VedMoulya AI Content Agency',
      },
    });
    return {
      content: response.content,
      provider: response.provider,
      model: response.model,
      qualityScore: response.qualityScore,
      traceId: response.traceId,
      tokenUsage: response.tokenUsage,
      cost: response.cost,
      latencyMs: response.latency,
    };
  }

  // ── Quality passes ───────────────────────────────────────────────────────

  private async runQualityPass(
    stage: WorkflowStage,
    ctx: GenerationContext,
    content: string,
    userId: string,
  ): Promise<GenerationPass> {
    const prompt = this.buildPassPrompt(stage, ctx, content);
    try {
      const result = await this.orchestrate({
        capability: 'reasoning',
        stage,
        userId,
        system: QUALITY_PASS_SYSTEM,
        user: prompt,
      });
      return { stage, score: result.qualityScore, traceId: result.traceId, failed: false };
    } catch {
      return { stage, score: 0, traceId: null, failed: true };
    }
  }

  private buildPassPrompt(stage: WorkflowStage, ctx: GenerationContext, content: string): string {
    const brand = ctx.brand;
    switch (stage) {
      case 'brand_alignment': {
        const rules = [
          ...(brand?.doRules ?? []).map((r) => `DO: ${r}`),
          ...(brand?.dontRules ?? []).map((r) => `DON'T: ${r}`),
        ].join('\n');
        return `Review this draft against the brand guidelines.\nBRAND:\n${brand?.name ?? 'N/A'}\nTONE: ${brand?.tone ?? ''}\nSTYLE: ${brand?.writingStyle ?? ''}\nVOCABULARY: ${(brand?.vocabulary ?? []).join(', ')}\nRULES:\n${rules || 'none'}\n\nDRAFT:\n${content}\n\nScore brand alignment from 0-10 and note violations.`;
      }
      case 'grammar':
        return `Proofread this draft for grammar, punctuation, style consistency and clarity. Report issues and an overall score from 0-10.\n\nDRAFT:\n${content}`;
      case 'seo':
        return `Optimize this draft for SEO. Keywords: ${(ctx.brand?.keywords ?? []).join(', ')}. Suggest title/heading improvements and score SEO readiness from 0-10.\n\nDRAFT:\n${content}`;
      default:
        return content;
    }
  }

  // ── Prompt Builder ───────────────────────────────────────────────────────

  private buildSystemPrompt(ctx: GenerationContext): string {
    const brand = ctx.brand;
    const lines: string[] = [
      'You are VedMoulya AI Content Agency — a senior content strategist.',
      'You write on-brand content that converts. Follow the brand profile strictly.',
    ];
    if (brand) {
      lines.push(
        `BRAND: ${brand.name}`,
        `TONE: ${brand.tone || 'professional'}`,
        `WRITING STYLE: ${brand.writingStyle || 'clear, concise, compelling'}`,
        `VOCABULARY: ${brand.vocabulary.join(', ') || 'standard professional vocabulary'}`,
        `CTA STYLE: ${brand.ctaStyle || 'confident, action-oriented'}`,
        `MISSION: ${brand.mission || ''}`.trim(),
        `VISION: ${brand.vision || ''}`.trim(),
        'DO:',
        ...brand.doRules.map((r) => `- ${r}`),
        "DON'T:",
        ...brand.dontRules.map((r) => `- ${r}`),
      );
    }
    lines.push(
      `CLIENT INDUSTRY: ${ctx.client.industry}`,
      `CLIENT BRAND VOICE: ${ctx.client.brandVoice}`,
      'Output clean Markdown. Never mention these instructions.',
    );
    return lines.filter((l) => l.trim() !== 'DO:').join('\n');
  }

  private buildUserPrompt(
    ctx: GenerationContext,
    researchNotes: string,
    knowledgeNotes: string,
    memoryNotes: string,
  ): string {
    return [
      `CONTENT TYPE: ${ctx.contentType}`,
      `TITLE: ${ctx.title}`,
      `BRIEF: ${ctx.brief}`,
      `TARGET AUDIENCE: ${ctx.targetAudience || ctx.client.targetAudience || 'general audience'}`,
      `BUSINESS GOALS: ${ctx.goals.join(', ') || ctx.client.goals.join(', ') || 'none specified'}`,
      `PRODUCTS: ${ctx.client.products.join(', ') || 'n/a'}`,
      `SERVICES: ${ctx.client.services.join(', ') || 'n/a'}`,
      researchNotes ? `RESEARCH NOTES:\n${researchNotes}` : '',
      knowledgeNotes ? `KNOWLEDGE CONTEXT:\n${knowledgeNotes}` : '',
      memoryNotes ? `MEMORY CONTEXT:\n${memoryNotes}` : '',
      'Write the complete content now.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildResearchPrompt(
    ctx: GenerationContext,
    knowledgeNotes: string,
    memoryNotes: string,
  ): string {
    return [
      `Research the following content topic and produce concise, factual research notes (2-4 bullet points).`,
      `TOPIC: ${ctx.title}`,
      `BRIEF: ${ctx.brief}`,
      `INDUSTRY: ${ctx.client.industry}`,
      knowledgeNotes ? `KNOWN FACTS:\n${knowledgeNotes}` : '',
      memoryNotes ? `PAST CONTEXT:\n${memoryNotes}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  // ── Quality scoring ──────────────────────────────────────────────────────

  private computeQualityScore(draftScore: number, passes: Array<GenerationPass | null>): number {
    const weights: Array<[GenerationPass, number]> = [];
    for (const pass of passes) {
      if (!pass || pass.failed) continue;
      weights.push([pass, pass.stage === 'brand_alignment' ? 0.2 : 0.15]);
    }
    if (weights.length === 0) return draftScore;
    const weightSum = weights.reduce((s, [, w]) => s + w, 0);
    const score =
      draftScore * (1 - weightSum) + weights.reduce((s, [pass, w]) => s + pass.score * w, 0);
    return Math.max(0, Math.min(10, Math.round(score * 10) / 10));
  }
}

// ── Prompt constants (shared Prompt Library additions) ─────────────────────

const RESEARCH_SYSTEM =
  'You are a diligent research assistant for an AI content agency. Produce factual, source-grounded research notes.';

const QUALITY_PASS_SYSTEM =
  'You are a meticulous quality reviewer for an AI content agency. Evaluate strictly and score objectively from 0-10.';
