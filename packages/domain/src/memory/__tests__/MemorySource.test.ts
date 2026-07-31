import { describe, it, expect } from 'vitest';
import { MemorySource } from '../value-objects/MemorySource.js';

describe('MemorySource', () => {
  describe('static factory methods', () => {
    const testCases = [
      {
        name: 'userInput',
        type: 'user_input',
        method: MemorySource.userInput,
        detail: 'user typed',
      },
      {
        name: 'aiInference',
        type: 'ai_inference',
        method: MemorySource.aiInference,
        detail: 'AI generated',
      },
      {
        name: 'systemGenerated',
        type: 'system_generated',
        method: MemorySource.systemGenerated,
        detail: 'system created',
      },
      {
        name: 'importSource',
        type: 'import',
        method: MemorySource.importSource,
        detail: 'imported data',
      },
      {
        name: 'integration',
        type: 'integration',
        method: MemorySource.integration,
        detail: 'external API',
      },
      {
        name: 'conversation',
        type: 'conversation',
        method: MemorySource.conversation,
        detail: 'chat history',
      },
      {
        name: 'observation',
        type: 'observation',
        method: MemorySource.observation,
        detail: 'observed event',
      },
      {
        name: 'reflection',
        type: 'reflection',
        method: MemorySource.reflection,
        detail: 'system reflection',
      },
    ];

    for (const { name, type, method, detail } of testCases) {
      it(`${name} has type ${type}`, () => {
        const source = method(detail);
        expect(source.type).toBe(type);
        expect(source.detail).toBe(detail);
        expect(source.timestamp).toBeInstanceOf(Date);
      });
    }
  });

  describe('constructor with timestamp', () => {
    it('uses provided timestamp', () => {
      const date = new Date('2024-01-01');
      const source = new MemorySource('observation', 'test detail', date);
      expect(source.timestamp).toBe(date);
    });

    it('defaults to current time', () => {
      const before = Date.now();
      const source = MemorySource.systemGenerated('test');
      const after = Date.now();
      expect(source.timestamp.getTime()).toBeGreaterThanOrEqual(before);
      expect(source.timestamp.getTime()).toBeLessThanOrEqual(after);
    });
  });

  describe('equals', () => {
    it('compares type and detail', () => {
      const a = MemorySource.userInput('test');
      const b = MemorySource.userInput('test');
      const c = MemorySource.userInput('different');
      expect(a.equals(b)).toBe(true);
      expect(a.equals(c)).toBe(false);
    });
  });

  describe('toString', () => {
    it('returns formatted string', () => {
      const source = MemorySource.observation('noticed event');
      expect(source.toString()).toContain('observation');
      expect(source.toString()).toContain('noticed event');
    });
  });
});
