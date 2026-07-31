import { describe, it, expect } from 'vitest';
import { MemoryRetentionPolicy } from '../value-objects/MemoryRetentionPolicy.js';

describe('MemoryRetentionPolicy', () => {
  describe('static factory methods', () => {
    it('creates permanent with min importance 7', () => {
      const p = MemoryRetentionPolicy.permanent();
      expect(p.retentionClass).toBe('permanent');
      expect(p.isPermanent).toBe(true);
      expect(p.ttlDays).toBe(0);
      expect(p.minImportanceScore).toBe(7);
    });

    it('creates long-term with 365 day TTL', () => {
      const p = MemoryRetentionPolicy.longTerm();
      expect(p.retentionClass).toBe('long_term');
      expect(p.ttlDays).toBe(365);
      expect(p.minImportanceScore).toBe(5);
      expect(p.requireReinforcement).toBe(true);
    });

    it('creates short-term with 30 day TTL', () => {
      const p = MemoryRetentionPolicy.shortTerm();
      expect(p.retentionClass).toBe('short_term');
      expect(p.ttlDays).toBe(30);
      expect(p.minImportanceScore).toBe(3);
    });

    it('creates transient with 7 day TTL', () => {
      const p = MemoryRetentionPolicy.transient();
      expect(p.retentionClass).toBe('transient');
      expect(p.ttlDays).toBe(7);
      expect(p.minImportanceScore).toBe(1);
      expect(p.requireReinforcement).toBe(false);
    });
  });

  describe('fromClass', () => {
    it('maps class strings to policies', () => {
      expect(MemoryRetentionPolicy.fromClass('permanent').retentionClass).toBe('permanent');
      expect(MemoryRetentionPolicy.fromClass('long_term').retentionClass).toBe('long_term');
      expect(MemoryRetentionPolicy.fromClass('short_term').retentionClass).toBe('short_term');
      expect(MemoryRetentionPolicy.fromClass('unknown').retentionClass).toBe('transient');
    });
  });

  describe('shouldRetain', () => {
    it('retains permanent memories with sufficient importance', () => {
      const p = MemoryRetentionPolicy.permanent();
      expect(p.shouldRetain(8, 1000)).toBe(true);
      expect(p.shouldRetain(6, 1000)).toBe(false);
    });

    it('rejects memories past TTL', () => {
      const p = MemoryRetentionPolicy.shortTerm();
      expect(p.shouldRetain(7, 31)).toBe(false);
    });

    it('retains within TTL', () => {
      const p = MemoryRetentionPolicy.longTerm();
      expect(p.shouldRetain(7, 100)).toBe(true);
    });

    it('rejects un-reinforced memories past half TTL below threshold', () => {
      const p = MemoryRetentionPolicy.shortTerm();
      expect(p.shouldRetain(2, 20)).toBe(false);
    });
  });

  describe('equals', () => {
    it('compares by retention class', () => {
      const a = MemoryRetentionPolicy.shortTerm();
      const b = MemoryRetentionPolicy.shortTerm();
      const c = MemoryRetentionPolicy.longTerm();
      expect(a.equals(b)).toBe(true);
      expect(a.equals(c)).toBe(false);
    });
  });
});
