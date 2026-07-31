import { describe, it, expect } from 'vitest';
import { MemoryVersion } from '../value-objects/MemoryVersion.js';

describe('MemoryVersion', () => {
  describe('initial', () => {
    it('creates v1.0.0', () => {
      const v = MemoryVersion.initial();
      expect(v.major).toBe(1);
      expect(v.minor).toBe(0);
      expect(v.patch).toBe(0);
      expect(v.label).toBe('v1.0.0');
    });
  });

  describe('bumpPatch', () => {
    it('increments patch version', () => {
      const v = MemoryVersion.initial().bumpPatch();
      expect(v.label).toBe('v1.0.1');
    });
  });

  describe('bumpMinor', () => {
    it('increments minor and resets patch', () => {
      const v = new MemoryVersion(1, 2, 5).bumpMinor();
      expect(v.minor).toBe(3);
      expect(v.patch).toBe(0);
    });
  });

  describe('bumpMajor', () => {
    it('increments major and resets minor and patch', () => {
      const v = new MemoryVersion(1, 5, 3).bumpMajor();
      expect(v.major).toBe(2);
      expect(v.minor).toBe(0);
      expect(v.patch).toBe(0);
    });
  });

  describe('label', () => {
    it('formats as semantic version', () => {
      const v = new MemoryVersion(2, 3, 4);
      expect(v.label).toBe('v2.3.4');
    });
  });

  describe('isNewerThan', () => {
    it('compares major version first', () => {
      const older = new MemoryVersion(1, 0, 0);
      const newer = new MemoryVersion(2, 0, 0);
      expect(newer.isNewerThan(older)).toBe(true);
      expect(older.isNewerThan(newer)).toBe(false);
    });

    it('compares minor version second', () => {
      const older = new MemoryVersion(1, 0, 0);
      const newer = new MemoryVersion(1, 1, 0);
      expect(newer.isNewerThan(older)).toBe(true);
    });

    it('compares patch version last', () => {
      const older = new MemoryVersion(1, 1, 0);
      const newer = new MemoryVersion(1, 1, 1);
      expect(newer.isNewerThan(older)).toBe(true);
    });
  });

  describe('equals', () => {
    it('compares all three segments', () => {
      const a = new MemoryVersion(1, 2, 3);
      const b = new MemoryVersion(1, 2, 3);
      const c = new MemoryVersion(1, 2, 4);
      expect(a.equals(b)).toBe(true);
      expect(a.equals(c)).toBe(false);
    });
  });
});
