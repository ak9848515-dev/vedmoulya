// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Decision Auditor unit tests
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DecisionAuditor } from '../DecisionAudit.js';
import { logger } from '@vedmoulya/core';

describe('DecisionAuditor', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('record logs an audit entry with generated id and timestamp', () => {
    const auditor = new DecisionAuditor();
    auditor.record({
      correlationId: 'corr-1',
      action: 'decision.ranked',
      actorId: 'u-1',
      targetId: 'dec-1',
      details: { rank: 1 },
      success: true,
    });
    expect(logger.info).toHaveBeenCalledOnce();
    const [message, payload] = logger.info.mock.calls[0] as [string, Record<string, unknown>];
    expect(message).toBe('Audit event');
    expect(payload).toMatchObject({
      audit: true,
      service: 'decision',
      action: 'decision.ranked',
      actorId: 'u-1',
      targetId: 'dec-1',
      success: true,
    });
    expect(typeof payload.id).toBe('string');
    expect(payload.timestamp).toBeInstanceOf(Date);
  });

  it('recordDecisionCreated logs the created action', () => {
    const auditor = new DecisionAuditor();
    auditor.recordDecisionCreated('u-1', 'dec-1', 'Buy a house', 'corr-1');
    const payload = logger.info.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload.action).toBe('decision.created');
    expect(payload.details).toEqual({ title: 'Buy a house' });
  });

  it('recordDecisionMade logs the made action with option id', () => {
    const auditor = new DecisionAuditor();
    auditor.recordDecisionMade('u-1', 'dec-1', 'opt-1', 'corr-1');
    const payload = logger.info.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload.action).toBe('decision.made');
    expect(payload.details).toEqual({ optionId: 'opt-1' });
  });

  it('recordDecisionCompleted logs the completed action with result', () => {
    const auditor = new DecisionAuditor();
    auditor.recordDecisionCompleted('u-1', 'dec-1', 'success', 'corr-1');
    const payload = logger.info.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload.action).toBe('decision.completed');
    expect(payload.details).toEqual({ result: 'success' });
  });

  it('recordSearch logs the search action with query and count', () => {
    const auditor = new DecisionAuditor();
    auditor.recordSearch('u-1', 'career move', 12, 'corr-1');
    const payload = logger.info.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload.action).toBe('decision.search.executed');
    expect(payload.details).toEqual({ query: 'career move', resultCount: 12 });
  });
});
