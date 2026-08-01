// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace service entry smoke test
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { serviceName } from '../index.js';

describe('marketplace service entry', () => {
  it('exposes the canonical service name', () => {
    expect(serviceName).toBe('marketplace');
  });
});
