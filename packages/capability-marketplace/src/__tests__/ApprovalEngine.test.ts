// ──────────────────────────────────────────────────────────────────
// VedMoulya — ApprovalEngine tests
// EPIC-013 §12 — factories must clearly identify irreversible
// actions: publish, send, deploy, purchase, delete, share.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ApprovalEngine } from '../domain/ApprovalEngine.js';

const engine = new ApprovalEngine();

describe('ApprovalEngine — approval requirements', () => {
  it('flags a publish step as irreversible', () => {
    const result = engine.decide('Final Export', 'Publish the finished video');
    expect(result.irreversible).toBe(true);
    expect(result.actions).toContain('publish');
  });

  it('flags a deploy step as irreversible', () => {
    const result = engine.decide('Deploy', 'Deploy the application to production');
    expect(result.irreversible).toBe(true);
    expect(result.actions).toContain('deploy');
  });

  it('flags a send step as irreversible', () => {
    const result = engine.decide('Send', 'Email the report to the client');
    expect(result.irreversible).toBe(true);
    expect(result.actions).toContain('send');
  });

  it('flags a delete step as irreversible', () => {
    const result = engine.decide('Cleanup', 'Delete the old records permanently');
    expect(result.irreversible).toBe(true);
    expect(result.actions).toContain('delete');
  });

  it('does not flag a reversible step', () => {
    const result = engine.decide('Draft', 'Write the first draft of the script');
    expect(result.irreversible).toBe(false);
    expect(result.actions).toEqual([]);
  });
});
