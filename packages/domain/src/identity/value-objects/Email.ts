// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: Email
// Immutable email value object with validation
// ──────────────────────────────────────────────────────────────────

import { isEmail } from '@vedmoulya/core';

export class Email {
  private readonly _value: string;
  private readonly _normalized: string;
  private readonly _domain: string;
  private readonly _local: string;

  private constructor(value: string, normalized: string, local: string, domain: string) {
    this._value = value;
    this._normalized = normalized;
    this._local = local;
    this._domain = domain;
  }

  /** Create an Email value object — validates format */
  static create(value: string): Email {
    const trimmed = value.trim().toLowerCase();
    if (!isEmail(trimmed)) {
      throw new Error(`Invalid email address: ${value}`);
    }
    const [local, domain] = trimmed.split('@') as [string, string];
    return new Email(trimmed, trimmed, local, domain);
  }

  /** Unsafe factory for reconstruction from persistence (no validation) */
  static from(value: string): Email {
    const trimmed = value.trim().toLowerCase();
    const [local, domain] = trimmed.split('@') as [string, string];
    return new Email(value, trimmed, local, domain);
  }

  get value(): string {
    return this._value;
  }
  get normalized(): string {
    return this._normalized;
  }
  get domain(): string {
    return this._domain;
  }
  get local(): string {
    return this._local;
  }

  toString(): string {
    return this._normalized;
  }
  toJSON(): string {
    return this._normalized;
  }

  equals(other: Email): boolean {
    return this._normalized === other._normalized;
  }
}
