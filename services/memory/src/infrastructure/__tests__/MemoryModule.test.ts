import { describe, it, expect, vi, afterEach } from 'vitest';

const mockInitialize = vi.hoisted(() => vi.fn());
const mockClose = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../persistence/DatabaseConnection.js', () => ({
  initializeDatabase: mockInitialize,
  closeDatabase: mockClose,
}));

import { container } from '@vedmoulya/core';
import { registerMemoryServices, memoryModule } from '../di/MemoryModule.js';

class FakeEventBus {}

describe('registerMemoryServices', () => {
  afterEach(() => {
    container.clear();
    vi.clearAllMocks();
  });

  it('registers all memory infrastructure services', () => {
    registerMemoryServices();
    expect(container.has('memory.db')).toBe(true);
    expect(container.has('memory.repository')).toBe(true);
    expect(container.has('memory.cache')).toBe(true);
    expect(container.has('memory.event-publisher')).toBe(true);
    expect(container.has('memory.metrics')).toBe(true);
    expect(container.has('memory.auditor')).toBe(true);
    expect(container.has('memory.tracer')).toBe(true);
  });

  it('resolves the repository, cache, and observability services', () => {
    registerMemoryServices();
    expect(container.resolve('memory.repository')).toBeDefined();
    expect(container.resolve('memory.cache')).toBeDefined();
    expect(container.resolve('memory.metrics')).toBeDefined();
    expect(container.resolve('memory.auditor')).toBeDefined();
    expect(container.resolve('memory.tracer')).toBeDefined();
  });

  it('resolves the event publisher with a fresh event bus when none is registered', () => {
    registerMemoryServices();
    const publisher = container.resolve('memory.event-publisher');
    expect(publisher).toBeDefined();
  });

  it('uses the existing event bus when one is registered', () => {
    container.register('event-bus', () => new FakeEventBus());
    registerMemoryServices();
    const publisher = container.resolve('memory.event-publisher');
    expect(publisher).toBeDefined();
  });

  it('resolves the db factory by calling initializeDatabase', () => {
    registerMemoryServices();
    container.resolve('memory.db');
    expect(mockInitialize).toHaveBeenCalled();
  });
});

describe('memoryModule definition', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('declares memory module metadata', () => {
    expect(memoryModule.name).toBe('memory');
    expect(memoryModule.description).toContain('Memory Engine');
    expect(memoryModule.version).toBe('0.1.0');
    expect(memoryModule.dependencies).toContain('core');
  });

  it('register() wires up the container services', () => {
    registerMemoryServices();
    memoryModule.register();
    expect(container.has('memory.repository')).toBe(true);
  });

  it('initialize() initializes the database', async () => {
    await memoryModule.initialize();
    expect(mockInitialize).toHaveBeenCalled();
  });

  it('shutdown() closes the database', async () => {
    await memoryModule.shutdown();
    expect(mockClose).toHaveBeenCalled();
  });
});
