// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Notifications service entry smoke test
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { serviceName } from '../index.js';

describe('notifications service entry', () => {
  it('exposes the canonical service name', () => {
    expect(serviceName).toBe('notifications');
  });
});
