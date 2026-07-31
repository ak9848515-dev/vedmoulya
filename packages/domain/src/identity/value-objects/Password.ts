// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: Password
// Immutable password value object with hashing and validation rules
// ──────────────────────────────────────────────────────────────────

export interface PasswordStrength {
  score: number; // 0-100
  label: 'weak' | 'fair' | 'strong' | 'very-strong';
}

export class Password {
  private readonly _hash: string;
  private readonly _updatedAt: Date;

  private constructor(hash: string, updatedAt: Date) {
    this._hash = hash;
    this._updatedAt = updatedAt;
  }

  get hash(): string {
    return this._hash;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  /** Create from a bcrypt hash (for persistence reconstruction) */
  static fromHash(hash: string, updatedAt?: Date): Password {
    return new Password(hash, updatedAt ?? new Date());
  }

  toString(): string {
    return this._hash;
  }
  toJSON(): string {
    return this._hash;
  }

  equals(other: Password): boolean {
    return this._hash === other._hash;
  }

  /** Validate password strength rules */
  static evaluateStrength(password: string): PasswordStrength {
    let score = 0;

    if (password.length >= 8) score += 20;
    if (password.length >= 12) score += 10;
    if (/[A-Z]/.test(password)) score += 15;
    if (/[a-z]/.test(password)) score += 15;
    if (/[0-9]/.test(password)) score += 15;
    if (/[^A-Za-z0-9]/.test(password)) score += 15;
    if (password.length >= 16) score += 10;

    const label =
      score >= 80 ? 'very-strong' : score >= 60 ? 'strong' : score >= 40 ? 'fair' : 'weak';

    return { score, label };
  }

  /** Validate password meets minimum requirements */
  static validate(password: string): string | null {
    if (!password || password.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    return null;
  }
}
