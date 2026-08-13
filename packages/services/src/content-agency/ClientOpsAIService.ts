// ──────────────────────────────────────────────────────────────────
// VedMoulya — Client Operations AI Service
// EPIC-003 / SPRINT AC-002 — Client Operations & Revenue Engine
// Proposal generation. Like the AC-001 content pipeline, every AI
// call is routed exclusively through the shared AI Orchestrator
// (Provider Manager + Prompt Library + Memory/Knowledge context) —
// no direct provider calls. Module 11 requirement.
// ──────────────────────────────────────────────────────────────────

import type { AIOrchestrationService } from '../ai/AIOrchestrationService.js';
import type { ProposalPricingLine } from '@vedmoulya/domain';

export interface ProposalGenerationContext {
  company: string;
  industry?: string;
  requirements: string;
  scope?: string;
  timeline?: string;
  deliverables?: string[];
  goals?: string[];
  brandVoice?: string;
  pricing?: ProposalPricingLine[];
}

export interface ProposalGenerationResult {
  document: string;
  provider: string;
  model: string;
  qualityScore: number;
  traceId: string | null;
  tokenUsage: { input: number; output: number; total: number };
  cost: number;
  latencyMs: number;
}

const PROPOSAL_SYSTEM = [
  'You are a senior client-success proposal writer for a boutique AI content agency.',
  'Write a complete, professional, persuasive client proposal in Markdown.',
  'Use this exact section structure:',
  '## Company & Context',
  '## Requirements',
  '## Scope of Work',
  '## Timeline',
  '## Pricing (Markdown table)',
  '## Deliverables',
  '## Terms & Conditions',
  'Use clear, confident, benefit-driven language. Pricing must be concrete and itemised.',
].join('\n');

export class ClientOpsAIService {
  private readonly ai: AIOrchestrationService;

  constructor(ai: AIOrchestrationService) {
    this.ai = ai;
  }

  /**
   * Generate a full proposal document for the given client context.
   * Throws on orchestrator failure so callers surface a clear error.
   */
  async generateProposal(
    userId: string,
    ctx: ProposalGenerationContext,
  ): Promise<ProposalGenerationResult> {
    const user = [
      `Company: ${ctx.company}`,
      ctx.industry ? `Industry: ${ctx.industry}` : '',
      `Client requirements: ${ctx.requirements}`,
      ctx.scope ? `Requested scope: ${ctx.scope}` : '',
      ctx.timeline ? `Desired timeline: ${ctx.timeline}` : '',
      ctx.goals && ctx.goals.length > 0 ? `Business goals: ${ctx.goals.join('; ')}` : '',
      ctx.brandVoice ? `Brand voice to reflect: ${ctx.brandVoice}` : '',
      ctx.deliverables && ctx.deliverables.length > 0
        ? `Deliverables under consideration: ${ctx.deliverables.join('; ')}`
        : '',
      ctx.pricing && ctx.pricing.length > 0
        ? `Pricing lines to formalise: ${ctx.pricing
            .map((p) => `${p.label} — ${p.amount}`)
            .join('; ')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    const response = await this.ai.orchestrate({
      capability: 'content_generation',
      userInput: user,
      qualityTier: 'premium',
      userId,
      constraints: { outputFormat: 'markdown', maxOutputTokens: 4000 },
      context: {
        systemPrompt: PROPOSAL_SYSTEM,
        identityContext: 'VedMoulya AI Content Agency',
      },
    });

    return {
      document: response.content,
      provider: response.provider,
      model: response.model,
      qualityScore: response.qualityScore,
      traceId: response.traceId,
      tokenUsage: response.tokenUsage,
      cost: response.cost,
      latencyMs: response.latency,
    };
  }
}
