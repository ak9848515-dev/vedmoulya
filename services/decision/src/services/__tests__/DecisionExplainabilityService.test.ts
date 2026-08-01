// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Decision Explainability Service Tests
// Covers generateExplanation (all formats + AI enhancement), the short/
// standard generators, risk & opportunity summaries, and DNA attribution.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Decision,
  DecisionConfidence,
  DecisionOpportunity,
  DecisionPriority,
  DecisionReasoning,
  DecisionRisk,
  DecisionScore,
  DecisionStatus,
  type DecisionId,
  type DecisionOption,
} from '@vedmoulya/domain';
import { DecisionExplainabilityService } from '../DecisionExplainabilityService.js';
import { resetDecisionConfig, updateDecisionConfig } from '../../config/DecisionConfig.js';
import type { AIOrchestratorClient } from '../../integration/AIOrchestratorClient.js';

// ── Fixture Helpers ─────────────────────────────────────────────────────────

function makeOption(overrides: Partial<DecisionOption> = {}): DecisionOption {
  return {
    id: 'opt_a',
    label: 'Option A',
    description: 'Description A',
    pros: ['Cheap'],
    cons: [],
    score: DecisionScore.compute([{ criterion: 'cost', score: 8, weight: 1 }]),
    risk: new DecisionRisk('low', 2, 'Minor risk'),
    opportunity: new DecisionOpportunity('high', 7, 'Market growth'),
    ...overrides,
  };
}

function makeDecidedDecision(options: DecisionOption[] = [makeOption()]): Decision {
  const reasoning = new DecisionReasoning({
    method: 'analytical',
    summary: 'Option A offers the best balance.',
    pros: ['Cheap'],
    cons: [],
  });
  const decision = new Decision({
    id: 'dec_1' as DecisionId,
    title: 'Choose a framework',
    description: 'Select the best framework',
    category: 'technical',
    status: DecisionStatus.evaluating(),
    priority: DecisionPriority.fromScore(8),
    confidence: DecisionConfidence.fromScore(0.8),
    options,
    knowledgeNodeIds: ['kn-1'],
    memoryIds: ['mem-1'],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    completedAt: new Date('2026-01-03T00:00:00Z'),
  });
  decision.decide('opt_a', reasoning);
  return decision;
}

function makeAiClient(
  enabled = true,
  result: string | null = 'AI enhanced summary',
): AIOrchestratorClient {
  return {
    isEnabled: () => enabled,
    generateExplanation: vi.fn().mockResolvedValue(result),
  } as unknown as AIOrchestratorClient;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('DecisionExplainabilityService', () => {
  beforeEach(() => {
    updateDecisionConfig({
      explainability: {
        defaultFormat: 'standard',
        maxAlternatives: 3,
        includeAlternatives: true,
      },
    });
  });

  afterEach(() => {
    resetDecisionConfig();
    vi.restoreAllMocks();
  });

  describe('generateExplanation', () => {
    it('generates a short-format explanation with alternatives', async () => {
      const service = new DecisionExplainabilityService();
      const decision = makeDecidedDecision([
        makeOption(),
        makeOption({ id: 'opt_b', label: 'Option B' }),
      ]);

      const response = await service.generateExplanation(
        { decisionId: 'dec_1', format: 'short' },
        decision,
      );

      expect(response.format).toBe('short');
      expect(response.decisionId).toBe('dec_1');
      expect(response.explanation.summary).toBe(
        'Recommended Option A based on technical analysis.',
      );
      expect(response.explanation.reason).toBe('Option A offers the best balance.');
      expect(response.explanation.dnaAttribution).toHaveLength(3);
      expect(response.explanation.dnaAttribution[0]).toEqual({
        dimension: 'Knowledge',
        attribute: 'Based on 1 knowledge references',
      });
      expect(response.explanation.dnaAttribution[1]).toEqual({
        dimension: 'Experience',
        attribute: 'Informed by 1 past experiences',
      });
      expect(response.explanation.dnaAttribution[2].dimension).toBe('Priority');
      expect(response.explanation.confidenceText).toContain('confident');
      expect(response.explanation.alternatives.length).toBeGreaterThan(0);
      expect(response.explanation.rawData).toBeUndefined();
      expect(new Date(response.generatedAt).toString()).not.toBe('Invalid Date');
    });

    it('uses the configured default format when none is requested', async () => {
      updateDecisionConfig({
        explainability: {
          defaultFormat: 'short',
          maxAlternatives: 3,
          includeAlternatives: true,
        },
      });
      const service = new DecisionExplainabilityService();
      const response = await service.generateExplanation(
        { decisionId: 'dec_1' },
        makeDecidedDecision(),
      );

      expect(response.format).toBe('short');
    });

    it('omits alternatives when includeAlternatives is false', async () => {
      const service = new DecisionExplainabilityService();
      const response = await service.generateExplanation(
        { decisionId: 'dec_1', format: 'short', includeAlternatives: false },
        makeDecidedDecision(),
      );

      expect(response.explanation.alternatives).toEqual([]);
    });

    it('limits alternatives by maxAlternatives', async () => {
      const service = new DecisionExplainabilityService();
      const decision = makeDecidedDecision([
        makeOption(),
        makeOption({ id: 'opt_b', label: 'Option B' }),
        makeOption({ id: 'opt_c', label: 'Option C' }),
      ]);

      const response = await service.generateExplanation(
        { decisionId: 'dec_1', format: 'short', maxAlternatives: 1 },
        decision,
      );

      expect(response.explanation.alternatives).toHaveLength(1);
      expect(response.explanation.alternatives[0]?.reason).toContain('Score: 8/10');
      expect(response.explanation.alternatives[0]?.reason).toContain('Acceptable risk.');
      expect(response.explanation.alternatives[0]?.reason).toContain('Significant opportunity.');
    });

    it('emits raw machine-readable data for the raw format', async () => {
      const service = new DecisionExplainabilityService();
      const response = await service.generateExplanation(
        { decisionId: 'dec_1', format: 'raw' },
        makeDecidedDecision(),
      );

      const raw = response.explanation.rawData;
      expect(raw).toBeDefined();
      expect(raw).toMatchObject({
        decisionId: 'dec_1',
        title: 'Choose a framework',
        category: 'technical',
        status: 'decided',
        optionsCount: 1,
        evidenceCount: 0,
        constraintCount: 0,
        knowledgeNodeIds: ['kn-1'],
        memoryIds: ['mem-1'],
        selectedOptionId: 'opt_a',
        hasReasoning: true,
        hasOutcome: false,
      });
      expect(raw?.version).toBe('v1.1.0');
      expect(raw?.priority).toEqual({ level: 'high', score: 8 });
      expect(raw?.confidence).toEqual({ level: 'high', score: 0.8 });
    });

    it('replaces the summary with the AI explanation in detailed format', async () => {
      const aiClient = makeAiClient();
      const service = new DecisionExplainabilityService(undefined, aiClient);

      const response = await service.generateExplanation(
        { decisionId: 'dec_1', format: 'detailed' },
        makeDecidedDecision(),
      );

      expect(response.explanation.summary).toBe('AI enhanced summary');
      expect(aiClient.generateExplanation).toHaveBeenCalledWith(
        expect.objectContaining({ decisionId: 'dec_1', title: 'Choose a framework' }),
      );
    });

    it('keeps the generated summary when the AI client is disabled', async () => {
      const service = new DecisionExplainabilityService(undefined, makeAiClient(false));

      const response = await service.generateExplanation(
        { decisionId: 'dec_1', format: 'detailed' },
        makeDecidedDecision(),
      );

      expect(response.explanation.summary).toBe(
        'Recommended Option A based on technical analysis.',
      );
    });

    it('keeps the generated summary when AI returns no content', async () => {
      const service = new DecisionExplainabilityService(undefined, makeAiClient(true, null));

      const response = await service.generateExplanation(
        { decisionId: 'dec_1', format: 'detailed' },
        makeDecidedDecision(),
      );

      expect(response.explanation.summary).toBe(
        'Recommended Option A based on technical analysis.',
      );
    });

    it('handles a pending decision without a selected option', async () => {
      const service = new DecisionExplainabilityService();
      const decision = new Decision({
        id: 'dec_2' as DecisionId,
        title: 'Explore options',
        description: 'Decide on next steps',
        category: 'career',
        status: DecisionStatus.requested(),
        confidence: DecisionConfidence.unknown(),
        options: [makeOption(), makeOption({ id: 'opt_b', label: 'Option B' })],
      });

      const response = await service.generateExplanation(
        { decisionId: 'dec_2', format: 'short' },
        decision,
      );

      expect(response.explanation.summary).toBe(
        'Decision analysis for "Explore options" with 2 options considered.',
      );
      expect(response.explanation.reason).toBe('Decision is pending evaluation.');
      expect(response.explanation.dnaAttribution).toEqual([
        { dimension: 'Priority', attribute: 'medium (5/10)' },
      ]);
      expect(response.explanation.confidenceText).toBe(
        'Confidence level is unknown — additional data needed.',
      );
    });
  });

  describe('confidence text', () => {
    it.each([
      [DecisionConfidence.veryHigh(), 'very confident'],
      [DecisionConfidence.high(), 'confident'],
      [DecisionConfidence.medium(), 'moderately confident'],
      [DecisionConfidence.low(), 'exploring this option'],
    ])('maps confidence level %s', async (confidence, expectedPhrase) => {
      const service = new DecisionExplainabilityService();
      const decision = new Decision({
        id: 'dec_c' as DecisionId,
        title: 'Confidence test',
        description: 'desc',
        category: 'personal',
        confidence,
      });

      const response = await service.generateExplanation(
        { decisionId: 'dec_c', format: 'short' },
        decision,
      );

      expect(response.explanation.confidenceText).toContain(expectedPhrase);
    });
  });

  describe('generateShortExplanation', () => {
    it('uses label + reasoning summary when decided', () => {
      const service = new DecisionExplainabilityService();
      const result = service.generateShortExplanation(makeDecidedDecision());

      expect(result).toBe('Option A: Option A offers the best balance.');
    });

    it('falls back to a title-based summary when pending', () => {
      const service = new DecisionExplainabilityService();
      const decision = new Decision({
        id: 'dec_s' as DecisionId,
        title: 'Pending call',
        description: 'desc',
        category: 'strategic',
        options: [makeOption()],
      });

      expect(service.generateShortExplanation(decision)).toBe(
        '"Pending call" — 1 options, confidence unknown',
      );
    });
  });

  describe('generateStandardExplanation', () => {
    it('composes a multi-part explanation for a decided decision', () => {
      const service = new DecisionExplainabilityService();
      const decision = makeDecidedDecision([
        makeOption(),
        makeOption({ id: 'opt_b', label: 'Option B' }),
      ]);

      const result = service.generateStandardExplanation(decision);

      expect(result).toContain('Recommended: Option A');
      expect(result).toContain('Reason: Option A offers the best balance.');
      expect(result).toContain('Confidence: high (score: 0.80)');
      expect(result).toContain('Alternatives: Option B');
    });

    it('omits recommendation and alternatives when nothing is selected', () => {
      const service = new DecisionExplainabilityService();
      const decision = new Decision({
        id: 'dec_st' as DecisionId,
        title: 'Fresh call',
        description: 'desc',
        category: 'learning',
        confidence: DecisionConfidence.medium(),
      });

      const result = service.generateStandardExplanation(decision);

      expect(result).toBe('Confidence: medium (score: 0.50)');
    });
  });

  describe('generateRiskSummary', () => {
    it('lists options with critical risks', () => {
      const service = new DecisionExplainabilityService();
      const decision = makeDecidedDecision([
        makeOption(),
        makeOption({
          id: 'opt_b',
          label: 'Option B',
          risk: new DecisionRisk('critical', 9, 'Data loss'),
        }),
      ]);

      expect(service.generateRiskSummary(decision)).toBe('Risks identified: Option B: Data loss');
    });

    it('reports when no critical risks exist', () => {
      const service = new DecisionExplainabilityService();
      expect(service.generateRiskSummary(makeDecidedDecision())).toBe(
        'No critical risks identified.',
      );
    });
  });

  describe('generateOpportunitySummary', () => {
    it('lists options with significant opportunities', () => {
      const service = new DecisionExplainabilityService();
      const decision = makeDecidedDecision([
        makeOption({
          opportunity: new DecisionOpportunity('moderate', 4, 'Steady gains'),
        }),
        makeOption({
          id: 'opt_b',
          label: 'Option B',
          opportunity: new DecisionOpportunity('transformational', 9, 'Market leadership'),
        }),
      ]);

      expect(service.generateOpportunitySummary(decision)).toBe(
        'Opportunities: Option B: Market leadership',
      );
    });

    it('reports when no significant opportunities exist', () => {
      const service = new DecisionExplainabilityService();
      const decision = makeDecidedDecision([
        makeOption({
          opportunity: new DecisionOpportunity('moderate', 4, 'Steady gains'),
        }),
      ]);

      expect(service.generateOpportunitySummary(decision)).toBe(
        'No significant opportunities identified.',
      );
    });
  });
});
