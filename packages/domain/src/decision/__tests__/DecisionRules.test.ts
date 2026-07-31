import { describe, it, expect } from 'vitest';
import {
  decisionContentRule,
  reasoningRequiredRule,
  outcomeRequiredRule,
  optionsRequiredRule,
  validate,
} from '../rules/DecisionRules.js';
import { Decision } from '../entities/Decision.js';
import { generateDecisionId } from '../value-objects/DecisionId.js';
import { DecisionReasoning } from '../value-objects/DecisionReasoning.js';

const createDecision = () => {
  return Decision.create({
    id: generateDecisionId(),
    title: 'Test',
    description: 'Desc',
    category: 'strategic',
  });
};

describe('Decision Rules', () => {
  describe('decisionContentRule', () => {
    it('passes for valid decision', () => {
      const decision = createDecision();
      const result = decisionContentRule(decision);
      expect(result.valid).toBe(true);
    });

    it('fails for empty title', () => {
      const decision = Decision.create({
        id: generateDecisionId(),
        title: '',
        description: 'Desc',
        category: 'strategic',
      });
      const result = decisionContentRule(decision);
      expect(result.valid).toBe(false);
    });
  });

  describe('reasoningRequiredRule', () => {
    it('passes when decision is not decided (no reasoning needed)', () => {
      const decision = createDecision();
      const result = reasoningRequiredRule(decision);
      expect(result.valid).toBe(true);
    });

    it('passes when reasoning exists for decided decision', () => {
      const decision = createDecision();
      decision.pullEvents();
      decision.addOption({
        id: 'opt_1',
        label: 'A',
        description: '',
        pros: ['Cheaper'],
        cons: ['Slower'],
      });
      const reasoning = new DecisionReasoning({
        method: 'cost_benefit',
        summary: 'Chose A over B',
        assumptions: ['Budget is fixed'],
        pros: ['Cheaper'],
        cons: ['Slower'],
      });
      decision.startAnalysis();
      decision.startEvaluation();
      decision.decide('opt_1', reasoning);
      const result = reasoningRequiredRule(decision);
      expect(result.valid).toBe(true);
    });
  });

  describe('outcomeRequiredRule', () => {
    it('passes when decision is not completed', () => {
      const decision = createDecision();
      const result = outcomeRequiredRule(decision);
      expect(result.valid).toBe(true);
    });
  });

  describe('optionsRequiredRule', () => {
    it('passes when decision is not evaluating', () => {
      const decision = createDecision();
      const result = optionsRequiredRule(decision);
      expect(result.valid).toBe(true);
    });
  });

  describe('validate', () => {
    it('returns valid when all rules pass', () => {
      const decision = createDecision();
      decision.addOption({ id: 'opt_1', label: 'A', description: '', pros: [], cons: [] });
      const result = validate([decisionContentRule, optionsRequiredRule], decision);
      expect(result.valid).toBe(true);
    });
  });
});
