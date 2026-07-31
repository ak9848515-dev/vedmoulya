import { describe, it, expect, vi } from 'vitest';
import { MemoryFactory } from '../factory/MemoryFactory.js';
import type { MemoryRepository } from '../repository/MemoryRepository.js';
import type { CreateMemoryCommand } from '../factory/MemoryFactory.js';
import { Memory } from '../entities/Memory.js';

describe('MemoryFactory', () => {
  let factory: MemoryFactory;
  let mockRepository: MemoryRepository;

  beforeEach(() => {
    mockRepository = {} as MemoryRepository;
    factory = new MemoryFactory(mockRepository);
  });

  describe('createMemory', () => {
    const validCommand: CreateMemoryCommand = {
      category: 'experience',
      title: 'Test Memory',
      content: 'This is test content.',
    };

    it('creates a memory from a valid command', async () => {
      const result = await factory.createMemory(validCommand);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.title).toBe('Test Memory');
    });

    it('creates memory with defaults for optional fields', async () => {
      const result = await factory.createMemory(validCommand);
      expect(result.success).toBe(true);
      expect(result.data!.importance.score).toBe(5); // medium
      expect(result.data!.confidence.score).toBeCloseTo(0.6); // medium
      expect(result.data!.source.type).toBe('system_generated');
      expect(result.data!.state.state).toBe('active');
    });

    it('creates memory with custom importance score', async () => {
      const result = await factory.createMemory({
        ...validCommand,
        importanceScore: 8,
      });
      expect(result.data!.importance.score).toBe(8);
      expect(result.data!.importance.level).toBe('high');
    });

    it('creates memory with custom confidence score', async () => {
      const result = await factory.createMemory({
        ...validCommand,
        confidenceScore: 0.9,
      });
      expect(result.data!.confidence.score).toBeCloseTo(0.9);
      expect(result.data!.confidence.level).toBe('high');
    });

    it('creates memory with source type', async () => {
      const result = await factory.createMemory({
        ...validCommand,
        sourceType: 'user_input',
        sourceDetail: 'User typed it',
      });
      expect(result.data!.source.type).toBe('user_input');
      expect(result.data!.source.detail).toBe('User typed it');
    });

    it('creates memory with knowledge node reference', async () => {
      const result = await factory.createMemory({
        ...validCommand,
        knowledgeNodeId: 'kg-node-456',
      });
      expect(result.data!.knowledgeNodeId).toBe('kg-node-456');
    });

    it('creates memory with tags', async () => {
      const result = await factory.createMemory({
        ...validCommand,
        tags: ['important', 'test'],
      });
      expect(result.data!.tags).toContain('important');
      expect(result.data!.tags).toContain('test');
    });

    it('creates memory with retention class', async () => {
      const result = await factory.createMemory({
        ...validCommand,
        retentionClass: 'permanent',
      });
      expect(result.data!.retentionPolicy.isPermanent).toBe(true);
    });

    it('creates memory with metadata', async () => {
      const result = await factory.createMemory({
        ...validCommand,
        metadata: { source: 'test', version: 1 },
      });
      expect(result.data!.metadata).toEqual({ source: 'test', version: 1 });
    });

    it('handles invalid category gracefully', async () => {
      const result = await factory.createMemory({
        ...validCommand,
        category: 'invalid_category',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('reconstructMemory', () => {
    it('reconstructs a memory from persisted data', () => {
      const memory = MemoryFactory.reconstructMemory({
        id: 'mem_test123',
        category: 'reflection',
        title: 'Reconstructed Memory',
        content: 'Data from persistence',
        importanceScore: 7,
        importanceLevel: 'high',
        confidenceScore: 0.8,
        confidenceLevel: 'high',
        strength: 0.8,
        strengthInterval: 24,
        easeFactor: 2.5,
        recallCount: 5,
        state: 'active',
        tags: ['reconstructed'],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-06-01'),
        lastRecalledAt: new Date('2024-05-01'),
      });

      expect(memory).toBeInstanceOf(Memory);
      expect(memory.id).toBe('mem_test123');
      expect(memory.category.value).toBe('reflection');
      expect(memory.title).toBe('Reconstructed Memory');
      expect(memory.content).toBe('Data from persistence');
      expect(memory.importance.score).toBe(7);
      expect(memory.confidence.score).toBeCloseTo(0.8);
      expect(memory.strength.value).toBeCloseTo(0.8);
      expect(memory.state.state).toBe('active');
      expect(memory.tags).toContain('reconstructed');
    });

    it('reconstructs with minimal data', () => {
      const memory = MemoryFactory.reconstructMemory({
        id: 'mem_minimal',
        category: 'experience',
        title: 'Minimal',
        content: 'Just enough data',
      });

      expect(memory).toBeInstanceOf(Memory);
      expect(memory.importance.level).toBe('medium');
      expect(memory.confidence.level).toBe('medium');
      expect(memory.strength.value).toBeCloseTo(0.3);
      expect(memory.version.label).toBe('v1.0.0');
    });

    it('reconstructs with state and reason', () => {
      const memory = MemoryFactory.reconstructMemory({
        id: 'mem_decaying',
        category: 'observation',
        title: 'Decaying',
        content: 'Lost over time',
        state: 'decaying',
        stateReason: 'Low recall frequency',
      });

      expect(memory.state.state).toBe('decaying');
      expect(memory.state.reason).toBe('Low recall frequency');
    });

    it('reconstructs with knowledge graph reference', () => {
      const memory = MemoryFactory.reconstructMemory({
        id: 'mem_linked',
        category: 'context',
        title: 'Linked',
        content: 'References KG node',
        knowledgeNodeId: 'kg-node-789',
      });

      expect(memory.knowledgeNodeId).toBe('kg-node-789');
    });

    it('reconstructs with version info', () => {
      const memory = MemoryFactory.reconstructMemory({
        id: 'mem_versioned',
        category: 'experience',
        title: 'Versioned',
        content: 'Version 2.3.4',
        versionMajor: 2,
        versionMinor: 3,
        versionPatch: 4,
      });

      expect(memory.version.label).toBe('v2.3.4');
    });
  });
});
