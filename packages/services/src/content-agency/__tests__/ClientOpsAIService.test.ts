// ──────────────────────────────────────────────────────────────────
// VedMoulya — ClientOpsAIService Tests
// EPIC-003 / SPRINT AC-002 — Client Operations & Revenue Engine
// Covers proposal generation: full context, partial context, and
// orchestrator failure propagation.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClientOpsAIService } from '../ClientOpsAIService.js';
import type { AIOrchestrationService } from '../../ai/AIOrchestrationService.js';
import type { ProposalGenerationContext } from '../ClientOpsAIService.js';

function makeOrchestrator(overrides: Record<string, unknown> = {}): AIOrchestrationService {
  const orchestrator = {
    orchestrate: vi.fn().mockResolvedValue({
      content: '# Proposal\n\n## Requirements\nContent pipeline.',
      provider: 'mock',
      model: 'mock-1',
      confidence: 0.9,
      qualityScore: 9,
      latency: 120,
      cost: 0.01,
      tokenUsage: { input: 100, output: 200, total: 300 },
      traceId: 'trace_1',
      validation: { passed: true, checks: [], overallScore: 9, decision: 'pass' },
      metadata: {},
    }),
    ...overrides,
  } as unknown as AIOrchestrationService;
  return orchestrator;
}

function fullContext(): ProposalGenerationContext {
  return {
    company: 'Acme Corp',
    industry: 'SaaS',
    requirements: 'Monthly content pipeline',
    scope: '12 articles',
    timeline: '3 months',
    deliverables: ['Blog posts', 'Social cards'],
    goals: ['Grow traffic', 'Generate leads'],
    brandVoice: 'Professional and approachable',
    pricing: [
      { label: 'Monthly retainer', amount: 2000 },
      { label: 'Setup fee', amount: 500 },
    ],
  };
}

describe('ClientOpsAIService', () => {
  let ai: AIOrchestrationService;

  beforeEach(() => {
    ai = makeOrchestrator();
  });

  it('generates a proposal with a complete context (all optional fields)', async () => {
    const svc = new ClientOpsAIService(ai);
    const result = await svc.generateProposal('user_1', fullContext());

    expect(result.document).toContain('# Proposal');
    expect(result.provider).toBe('mock');
    expect(result.model).toBe('mock-1');
    expect(result.qualityScore).toBe(9);
    expect(result.traceId).toBe('trace_1');
    expect(result.tokenUsage).toEqual({ input: 100, output: 200, total: 300 });
    expect(result.cost).toBe(0.01);
    expect(result.latencyMs).toBe(120);

    // The user prompt must include every populated field.
    const call = vi.mocked(ai.orchestrate).mock.calls[0]?.[0];
    const prompt = String(call?.userInput);
    expect(prompt).toContain('Company: Acme Corp');
    expect(prompt).toContain('Industry: SaaS');
    expect(prompt).toContain('Requested scope: 12 articles');
    expect(prompt).toContain('Desired timeline: 3 months');
    expect(prompt).toContain('Business goals: Grow traffic; Generate leads');
    expect(prompt).toContain('Brand voice to reflect: Professional and approachable');
    expect(prompt).toContain('Deliverables under consideration: Blog posts; Social cards');
    expect(prompt).toContain(
      'Pricing lines to formalise: Monthly retainer — 2000; Setup fee — 500',
    );
  });

  it('generates a proposal with a minimal context (optional fields omitted)', async () => {
    const svc = new ClientOpsAIService(ai);
    const result = await svc.generateProposal('user_2', {
      company: 'Startup',
      requirements: 'Landing page copy',
    });

    expect(result.document).toBeTruthy();
    const call = vi.mocked(ai.orchestrate).mock.calls[0]?.[0];
    const prompt = String(call?.userInput);
    expect(prompt).toContain('Company: Startup');
    expect(prompt).toContain('Client requirements: Landing page copy');
    // Optional fields must NOT appear.
    expect(prompt).not.toContain('Industry:');
    expect(prompt).not.toContain('Requested scope:');
    expect(prompt).not.toContain('Business goals:');
    expect(prompt).not.toContain('Brand voice to reflect:');
  });

  it('passes the proposal system prompt and premium tier to the orchestrator', async () => {
    const svc = new ClientOpsAIService(ai);
    await svc.generateProposal('user_3', fullContext());

    const call = vi.mocked(ai.orchestrate).mock.calls[0]?.[0];
    expect(call?.capability).toBe('content_generation');
    expect(call?.qualityTier).toBe('premium');
    expect(call?.userId).toBe('user_3');
    expect(call?.constraints).toEqual({ outputFormat: 'markdown', maxOutputTokens: 4000 });
    expect(String(call?.context?.systemPrompt)).toContain('## Pricing (Markdown table)');
    expect(call?.context?.identityContext).toBe('VedMoulya AI Content Agency');
  });

  it('propagates orchestrator failures as rejected promises', async () => {
    const failing = makeOrchestrator({
      orchestrate: vi.fn().mockRejectedValue(new Error('Provider unavailable')),
    });
    const svc = new ClientOpsAIService(failing);
    await expect(
      svc.generateProposal('user_4', { company: 'X', requirements: 'Y' }),
    ).rejects.toThrow('Provider unavailable');
  });
});
