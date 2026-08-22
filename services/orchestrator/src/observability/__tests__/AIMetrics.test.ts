import { describe, it, expect } from 'vitest';
import { AIMetrics } from '../AIMetrics.js';

describe('AIMetrics re-export', () => {
  it('exports AIMetrics from @vedmoulya/services', () => {
    expect(AIMetrics).toBeDefined();
  });
});
