import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryAuditor } from '../../observability/MemoryAudit.js';

// Mock @vedmoulya/core logger
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@vedmoulya/core', () => ({
  logger: mockLogger,
}));

describe('MemoryAuditor', () => {
  let auditor: MemoryAuditor;

  beforeEach(() => {
    auditor = new MemoryAuditor();
    vi.clearAllMocks();
  });

  it('records an audit entry with generated id and timestamp', () => {
    auditor.record({
      action: 'memory.captured',
      actorId: 'user-1',
      targetId: 'memory-1',
      correlationId: 'corr-1',
      details: { category: 'experience' },
      success: true,
    });

    expect(mockLogger.info).toHaveBeenCalledTimes(1);
    const [message, entry] = mockLogger.info.mock.calls[0] as [string, Record<string, unknown>];
    expect(message).toBe('Audit event');
    expect(entry.audit).toBe(true);
    expect(entry.service).toBe('memory');
    expect(entry.action).toBe('memory.captured');
    expect(entry.actorId).toBe('user-1');
    expect(entry.targetId).toBe('memory-1');
    expect(entry.correlationId).toBe('corr-1');
    expect(entry.success).toBe(true);
    expect(entry.id).toBeDefined();
    expect(entry.timestamp).toBeInstanceOf(Date);
  });

  it('recordMemoryCaptured logs memory creation', () => {
    auditor.recordMemoryCaptured('user-1', 'memory-1', 'experience', 'corr-1');

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Audit event',
      expect.objectContaining({
        action: 'memory.captured',
        actorId: 'user-1',
        targetId: 'memory-1',
        details: { category: 'experience' },
      }),
    );
  });

  it('recordMemoryRecalled logs memory recall', () => {
    auditor.recordMemoryRecalled('user-1', 'memory-1', 'corr-1');

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Audit event',
      expect.objectContaining({
        action: 'memory.recalled',
        targetId: 'memory-1',
      }),
    );
  });

  it('recordMemoryArchived logs memory archiving', () => {
    auditor.recordMemoryArchived('user-1', 'memory-1', 'corr-1');

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Audit event',
      expect.objectContaining({
        action: 'memory.archived',
        targetId: 'memory-1',
      }),
    );
  });

  it('recordMemoryForgotten logs memory forgetting', () => {
    auditor.recordMemoryForgotten('user-1', 'memory-1', 'corr-1');

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Audit event',
      expect.objectContaining({
        action: 'memory.forgotten',
        targetId: 'memory-1',
      }),
    );
  });

  it('recordSearch logs search with query and result count', () => {
    auditor.recordSearch('user-1', 'memory patterns', 10, 'corr-1');

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Audit event',
      expect.objectContaining({
        action: 'memory.search.executed',
        details: { query: 'memory patterns', resultCount: 10 },
      }),
    );
  });

  it('recordRetentionExecuted logs retention with expired and decayed counts', () => {
    auditor.recordRetentionExecuted('user-1', 5, 3, 'corr-1');

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Audit event',
      expect.objectContaining({
        action: 'memory.retention.executed',
        details: { expiredCount: 5, decayedCount: 3 },
      }),
    );
  });
});
