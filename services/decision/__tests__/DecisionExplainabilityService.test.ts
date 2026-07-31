// ──────────────────────────────────────────────────────────────────
// VedMoulya — Decision Explainability Service Tests
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DecisionExplainabilityService } from '../src/services/DecisionExplainabilityService.js';
import { Decision, generateDecisionId } from '@vedmoulya/domain';
import { DecisionReasoning } from '@vedmoulya/domain';
import { DecisionConfidence } from '@vedmoulya/domain';
import { DecisionOutcome } from '@vedmoulya/domain';

describe('DecisionExplainabilityService', () => {
  let service: DecisionExplainabilityService;

  beforeEach(() => {
    service = new DecisionExplainabilityService();
  });

  const createTestDecision = () => {
    const decision = Decision.create({
      id: generateDecisionId(),
      title: 'Choose Programming Language',
      description: 'Which language to learn next',
      category: 'career',
      tags: ['career', 'learning'],
    });

    decision.addOption({
      id: 'opt_python',
      label: 'Python',
      description: 'General purpose language',
      pros: ['Versatile', 'High demand', 'Easy to learn'],
      cons: ['Slower execution'],
    });

    decision.addOption({
      id: 'opt_rust',
      label: 'Rust',
      description: 'Systems programming language',
      pros: ['Fast', 'Memory safe'],
      cons: ['Steep learning curve', 'Fewer jobs'],
    });

    return decision;
  };

  describe('generateShortExplanation', () => {
    it('generates short explanation for pending decision', () => {
      const decision = createTestDecision();
      const explanation = service.generateShortExplanation(decision);
      expect(explanation).toContain('Choose Programming Language');
      expect(explanation).toContain('2 options');
    });

    it('generates short explanation for decided decision', () => {
      const decision = createTestDecision();
      const reasoning = new DecisionReasoning({
        method: 'analytical',
        summary: 'Python offers better career prospects',
        pros: ['Versatile'],
        cons: ['Slower'],
      });
      decision.startAnalysis();
      decision.startEvaluation();
      decision.decide('opt_python', reasoning);
      decision.pullEvents();

      const explanation = service.generateShortExplanation(decision);
      expect(explanation).toContain('Python');
      expect(explanation).toContain('better career prospects');
    });
  });

  describe('generateStandardExplanation', () => {
    it('generates standard explanation with all components', () => {
      const decision = createTestDecision();
      const reasoning = new DecisionReasoning({
        method: 'analytical',
        summary: 'Python offers the best balance of versatility and demand',
        assumptions: ['Job market remains stable'],
        pros: ['Versatile', 'High demand'],
        cons: ['Slower execution'],
      });
      decision.startAnalysis();
      decision.startEvaluation();
      decision.decide('opt_python', reasoning);
      decision.updateConfidence(DecisionConfidence.high());
      decision.pullEvents();

      const explanation = service.generateStandardExplanation(decision);
      expect(explanation).toContain('Recommended: Python');
      expect(explanation).toContain('Confidence: high');
      expect(explanation).toContain('Rust');
    });
  });

  describe('generateRiskSummary', () => {
    it('returns no critical risks when none exist', () => {
      const decision = createTestDecision();
      const summary = service.generateRiskSummary(decision);
      expect(summary).toContain('No critical risks');
    });
  });

  describe('generateOpportunitySummary', () => {
    it('returns no significant opportunities when none exist', () => {
      const decision = createTestDecision();
      const summary = service.generateOpportunitySummary(decision);
      expect(summary).toContain('No significant opportunities');
    });
  });

  describe('generateExplanation', () => {
    it('generates a full explanation for a decision', async () => {
      const decision = createTestDecision();
      const reasoning = new DecisionReasoning({
        method: 'analytical',
        summary: 'Python offers the best balance',
        assumptions: ['Market demand continues'],
        pros: ['Versatile'],
        cons: ['Slower'],
      });
      decision.startAnalysis();
      decision.startEvaluation();
      decision.decide('opt_python', reasoning);
      decision.updateConfidence(DecisionConfidence.high());
      decision.pullEvents();

      const response = await service.generateExplanation(
        { decisionId: decision.id, format: 'standard' },
        decision,
      );

      expect(response.decisionId).toBe(decision.id);
      expect(response.format).toBe('standard');
      expect(response.explanation.summary).toBeTruthy();
      expect(response.explanation.reason).toBeTruthy();
      expect(response.explanation.confidenceText).toBeTruthy();
    });

    it('generates raw format with machine-readable data', async () => {
      const decision = createTestDecision();
      decision.startAnalysis();
      decision.startEvaluation();
      decision.pullEvents();

      const response = await service.generateExplanation(
        { decisionId: decision.id, format: 'raw' },
        decision,
      );

      expect(response.format).toBe('raw');
      expect(response.explanation.rawData).toBeDefined();
      expect(response.explanation.rawData?.decisionId).toBe(decision.id);
    });
  });
});
