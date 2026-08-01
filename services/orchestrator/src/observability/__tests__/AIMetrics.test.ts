// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AIMetrics re-export smoke test
// ARC-005 — AI Orchestration
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { AIMetrics } from '../AIMetrics.js';

describe('AIMetrics re-export', () => {
  it('resolves the singleton from @vedmoulya/services', () => {
    expect(AIMetrics).toBeDefined();
  });
});
