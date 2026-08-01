// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Decision Module (DI) Tests
// Covers decisionModule metadata, registerDecisionServices wiring into the
// container, and the initialize/shutdown lifecycle hooks.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { container, moduleRegistry } from '@vedmoulya/core';

// Mock the DatabaseConnection module so lifecycle hooks never open a real pool.
const { initializeDatabaseMock, closeDatabaseMock } = vi.hoisted(() => ({
  initializeDatabaseMock: vi.fn(),
  closeDatabaseMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../persistence/DatabaseConnection.js', () => ({
  initializeDatabase: initializeDatabaseMock,
  closeDatabase: closeDatabaseMock,
  getDatabase: vi.fn(),
}));

const { decisionModule, registerDecisionServices } = await import('../DecisionModule.js');

describe('DecisionModule', () => {
  beforeEach(() => {
    moduleRegistry.reset();
    container.clear();
    initializeDatabaseMock.mockClear();
    closeDatabaseMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes module metadata', () => {
    expect(decisionModule.name).toBe('decision');
    expect(decisionModule.description).toContain('Decision Intelligence Engine');
    expect(decisionModule.version).toBe('0.1.0');
    expect(decisionModule.dependencies).toContain('core');
  });

  it('registers all decision services with the container', () => {
    registerDecisionServices();

    expect(container.has('decision.db')).toBe(true);
    expect(container.has('decision.repository')).toBe(true);
    expect(container.has('decision.cache')).toBe(true);
    expect(container.has('decision.event-publisher')).toBe(true);
    expect(container.has('decision.metrics')).toBe(true);
    expect(container.has('decision.auditor')).toBe(true);
    expect(container.has('decision.tracer')).toBe(true);
  });

  it('register() wires services into the container', () => {
    decisionModule.register();

    expect(container.has('decision.repository')).toBe(true);
    expect(container.has('decision.metrics')).toBe(true);
    expect(container.has('decision.event-publisher')).toBe(true);
  });

  it('resolve() materializes the registered services', () => {
    registerDecisionServices();

    expect(container.resolve('decision.cache')).toBeDefined();
    expect(container.resolve('decision.metrics')).toBeDefined();
    expect(container.resolve('decision.auditor')).toBeDefined();
    expect(container.resolve('decision.tracer')).toBeDefined();
  });

  it('initialize() initializes the database connection', async () => {
    await decisionModule.initialize();
    expect(initializeDatabaseMock).toHaveBeenCalledTimes(1);
  });

  it('shutdown() closes the database connection', async () => {
    await decisionModule.shutdown();
    expect(closeDatabaseMock).toHaveBeenCalledTimes(1);
  });
});
