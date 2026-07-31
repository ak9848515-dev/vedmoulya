// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Password Service
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { PasswordService } from '../src/auth/PasswordService.js';

describe('PasswordService', () => {
  // Use low salt rounds for fast tests
  const passwordService = new PasswordService(4);

  describe('hashing', () => {
    it('hashes a password', async () => {
      const hash = await passwordService.hash('TestPass123');
      expect(hash).toBeTruthy();
      expect(hash).not.toBe('TestPass123');
    });

    it('produces different hashes for same password (different salt)', async () => {
      const hash1 = await passwordService.hash('TestPass123');
      const hash2 = await passwordService.hash('TestPass123');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verification', () => {
    it('verifies correct password', async () => {
      const hash = await passwordService.hash('ValidPass1');
      const valid = await passwordService.verify('ValidPass1', hash);
      expect(valid).toBe(true);
    });

    it('rejects incorrect password', async () => {
      const hash = await passwordService.hash('ValidPass1');
      const valid = await passwordService.verify('WrongPass1', hash);
      expect(valid).toBe(false);
    });

    it('handles empty hash gracefully', async () => {
      const valid = await passwordService.verify('password', '');
      expect(valid).toBe(false);
    });
  });
});
