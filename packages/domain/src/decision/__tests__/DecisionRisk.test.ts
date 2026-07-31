import { describe, it, expect } from 'vitest';
import { DecisionRisk } from '../value-objects/DecisionRisk.js';

describe('DecisionRisk', () => {
  it('creates from score with negligible risk', () => {
    const risk = DecisionRisk.fromScore(0, 'No risk');
    expect(risk.level).toBe('negligible');
    expect(risk.description).toBe('No risk');
  });

  it('creates from score with low risk', () => {
    const risk = DecisionRisk.fromScore(2, 'Low risk', 'Monitor');
    expect(risk.level).toBe('low');
    expect(risk.score).toBe(2);
    expect(risk.description).toBe('Low risk');
    expect(risk.mitigation).toBe('Monitor');
  });

  it('creates from score with medium risk', () => {
    const risk = DecisionRisk.fromScore(5, 'Medium risk');
    expect(risk.level).toBe('medium');
  });

  it('creates from score with high risk', () => {
    const risk = DecisionRisk.fromScore(7, 'High risk');
    expect(risk.level).toBe('high');
  });

  it('creates from score with critical risk', () => {
    const risk = DecisionRisk.fromScore(10, 'Critical risk');
    expect(risk.level).toBe('critical');
    expect(risk.score).toBe(10);
  });

  it('clamps score to 0-10 range', () => {
    expect(DecisionRisk.fromScore(-5, 'test').score).toBe(0);
    expect(DecisionRisk.fromScore(15, 'test').score).toBe(10);
  });

  it('isAcceptable returns true for low and negligible', () => {
    expect(DecisionRisk.fromScore(0, 'none').isAcceptable()).toBe(true);
    expect(DecisionRisk.fromScore(2, 'low').isAcceptable()).toBe(true);
    expect(DecisionRisk.fromScore(5, 'medium').isAcceptable()).toBe(false);
  });

  it('isCritical returns true for critical and high', () => {
    expect(DecisionRisk.fromScore(10, 'critical').isCritical()).toBe(true);
    expect(DecisionRisk.fromScore(7, 'high').isCritical()).toBe(true);
    expect(DecisionRisk.fromScore(3, 'low').isCritical()).toBe(false);
  });
});
