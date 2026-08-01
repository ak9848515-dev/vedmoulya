// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Learning service entry smoke test
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { serviceName } from '../index.js';

describe('learning service entry', () => {
  it('exposes the canonical service name', () => {
    expect(serviceName).toBe('learning');
  });
});
