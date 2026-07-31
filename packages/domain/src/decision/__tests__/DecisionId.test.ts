import { describe, it, expect } from 'vitest';
import { createDecisionId, generateDecisionId } from '../value-objects/DecisionId.js';

describe('DecisionId', () => {
  it('creates from string', () => {
    const id = createDecisionId('dec_123');
    expect(id).toBe('dec_123');
  });

  it('generates unique IDs', () => {
    const id1 = generateDecisionId();
    const id2 = generateDecisionId();
    expect(id1).not.toBe(id2);
  });

  it('generated IDs start with dec_', () => {
    const id = generateDecisionId();
    expect(id.startsWith('dec_')).toBe(true);
  });
});
