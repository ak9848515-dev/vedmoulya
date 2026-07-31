// ──────────────────────────────────────────────────────────────────
// VedMoulya — Identity Business Rules
// Domain validation rules for identity operations
// ──────────────────────────────────────────────────────────────────

import { Password } from '../value-objects/Password.js';
import type { User } from '../entities/User.js';
import type { IdentityStatus } from '../value-objects/IdentityStatus.js';

export interface RuleResult {
  valid: boolean;
  message?: string;
}

export type Rule = (data: unknown) => RuleResult;

// ── User Registration Rules ───────────────────────────────────────────────

export const displayNameRule: Rule = (data: unknown) => {
  const name = data as string;
  if (!name || name.trim().length < 2) {
    return { valid: false, message: 'Display name must be at least 2 characters' };
  }
  if (name.trim().length > 100) {
    return { valid: false, message: 'Display name must be at most 100 characters' };
  }
  if (/[<>{}[\]\\/]/.test(name)) {
    return { valid: false, message: 'Display name contains invalid characters' };
  }
  return { valid: true };
};

export const passwordRule: Rule = (data: unknown) => {
  const password = data as string;
  const error = Password.validate(password);
  return error ? { valid: false, message: error } : { valid: true };
};

// ── Authentication Rules ──────────────────────────────────────────────────

export function canAuthenticateRule(status: IdentityStatus): RuleResult {
  if (!status.isActive && !status.isPending) {
    return { valid: false, message: `Account is ${status.state}` };
  }
  return { valid: true };
}

// ── Email Change Rules ────────────────────────────────────────────────────

export function emailChangeRule(user: User, _newEmail: string): RuleResult {
  if (user.status.isPending && !user.status.emailVerified) {
    return { valid: false, message: 'Verify current email before changing' };
  }
  return { valid: true };
}

// ── Account Deletion Rules ────────────────────────────────────────────────

export function accountDeletionRule(user: User): RuleResult {
  if (user.entityStatus === 'archived') {
    return { valid: false, message: 'Account is already archived' };
  }
  return { valid: true };
}

// ── Composite Validator ──────────────────────────────────────────────────

export function validate(rules: Rule[], data: unknown): RuleResult {
  for (const rule of rules) {
    const result = rule(data);
    if (!result.valid) return result;
  }
  return { valid: true };
}
