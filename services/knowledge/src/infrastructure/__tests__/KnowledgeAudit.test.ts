import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KnowledgeAuditor } from '../../observability/KnowledgeAudit.js';

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

describe('KnowledgeAuditor', () => {
  let auditor: KnowledgeAuditor;

  beforeEach(() => {
    auditor = new KnowledgeAuditor();
    vi.clearAllMocks();
  });

  it('records an audit entry with generated id and timestamp', () => {
    auditor.record({
      action: 'knowledge.node.created',
      actorId: 'user-1',
      targetId: 'node-1',
      correlationId: 'corr-1',
      details: { category: 'skill' },
      success: true,
    });

    expect(mockLogger.info).toHaveBeenCalledTimes(1);
    const [message, entry] = mockLogger.info.mock.calls[0];
    expect(message).toBe('Audit event');
    expect(entry.audit).toBe(true);
    expect(entry.service).toBe('knowledge');
    expect(entry.action).toBe('knowledge.node.created');
    expect(entry.actorId).toBe('user-1');
    expect(entry.targetId).toBe('node-1');
    expect(entry.correlationId).toBe('corr-1');
    expect(entry.success).toBe(true);
    expect(entry.id).toBeDefined();
    expect(entry.timestamp).toBeInstanceOf(Date);
  });

  it('recordNodeCreated logs node creation', () => {
    auditor.recordNodeCreated('user-1', 'node-1', 'skill', 'corr-1');

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Audit event',
      expect.objectContaining({
        action: 'knowledge.node.created',
        actorId: 'user-1',
        targetId: 'node-1',
        details: { category: 'skill' },
      }),
    );
  });

  it('recordNodeDeleted logs node deletion', () => {
    auditor.recordNodeDeleted('user-1', 'node-1', 'corr-1');

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Audit event',
      expect.objectContaining({
        action: 'knowledge.node.deleted',
        targetId: 'node-1',
      }),
    );
  });

  it('recordEdgeCreated logs edge creation with source and target', () => {
    auditor.recordEdgeCreated('user-1', 'edge-1', 'source-1', 'target-1', 'corr-1');

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Audit event',
      expect.objectContaining({
        action: 'knowledge.edge.created',
        targetId: 'edge-1',
        details: { sourceId: 'source-1', targetId: 'target-1' },
      }),
    );
  });

  it('recordGraphCreated logs graph creation with label', () => {
    auditor.recordGraphCreated('user-1', 'graph-1', 'My Graph', 'corr-1');

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Audit event',
      expect.objectContaining({
        action: 'knowledge.graph.created',
        targetId: 'graph-1',
        details: { label: 'My Graph' },
      }),
    );
  });

  it('recordSearch logs search with query and result count', () => {
    auditor.recordSearch('user-1', 'typescript patterns', 10, 'corr-1');

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Audit event',
      expect.objectContaining({
        action: 'knowledge.search.executed',
        details: { query: 'typescript patterns', resultCount: 10 },
      }),
    );
  });
});
