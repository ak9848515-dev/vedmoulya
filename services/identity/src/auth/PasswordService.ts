// ──────────────────────────────────────────────────────────────────
// VedMoulya — Authentication: Password Service
// Bcrypt-based password hashing and verification
// ──────────────────────────────────────────────────────────────────

import { config, logger } from '@vedmoulya/core';

// Dynamic import for bcrypt (ESM-compatible)
let _bcrypt: typeof import('bcrypt') | null = null;
async function getBcrypt(): Promise<typeof import('bcrypt')> {
  if (!_bcrypt) {
    _bcrypt = await import('bcrypt');
  }
  return _bcrypt;
}

export class PasswordService {
  private readonly saltRounds: number;

  constructor(saltRounds?: number) {
    this.saltRounds = saltRounds ?? config.auth.bcryptRounds;
  }

  /** Hash a plaintext password */
  async hash(plain: string): Promise<string> {
    const bcrypt = await getBcrypt();
    const salt = await bcrypt.genSalt(this.saltRounds);
    const hash = await bcrypt.hash(plain, salt);
    return hash;
  }

  /** Verify a plaintext password against a hash */
  async verify(plain: string, hash: string): Promise<boolean> {
    try {
      const bcrypt = await getBcrypt();
      return await bcrypt.compare(plain, hash);
    } catch (error) {
      logger.error('Password verification failed', { error });
      return false;
    }
  }
}
