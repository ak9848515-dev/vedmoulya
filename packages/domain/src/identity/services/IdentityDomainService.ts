// ──────────────────────────────────────────────────────────────────
// VedMoulya — Identity Domain Service
// Domain operations spanning multiple entities/value objects
// ──────────────────────────────────────────────────────────────────

import type { User } from '../entities/User.js';
import type { IdentityRepository } from '../repository/IdentityRepository.js';
import type { Email } from '../value-objects/Email.js';
import { Password } from '../value-objects/Password.js';

export interface DuplicateCheckResult {
  emailExists: boolean;
  existingUser?: User;
}

export interface PasswordChangeResult {
  valid: boolean;
  errors: string[];
}

/**
 * Domain service for identity operations that involve multiple aggregates
 * or require coordination between domain objects.
 */
export class IdentityDomainService {
  private readonly repository: IdentityRepository;

  constructor(repository: IdentityRepository) {
    this.repository = repository;
  }

  /** Check for duplicate email across the system */
  async checkForDuplicates(email: Email): Promise<DuplicateCheckResult> {
    const existing = await this.repository.findByEmail(email);
    return {
      emailExists: existing !== null,
      existingUser: existing ?? undefined,
    };
  }

  /** Validate a password change request */
  validatePasswordChange(
    currentPasswordHash: string,
    newPasswordPlain: string,
    newPasswordHash: string,
  ): PasswordChangeResult {
    const errors: string[] = [];

    if (currentPasswordHash === newPasswordHash) {
      errors.push('New password must be different from current password');
    }

    const validationError = Password.validate(newPasswordPlain);
    if (validationError) {
      errors.push(validationError);
    }

    return { valid: errors.length === 0, errors };
  }

  /** Determine if a user can authenticate based on status */
  canAuthenticate(user: User): { allowed: boolean; reason?: string } {
    if (user.status.isSuspended) {
      return { allowed: false, reason: user.status.reason ?? 'Account suspended' };
    }
    if (user.status.isDeleted) {
      return { allowed: false, reason: 'Account deleted' };
    }
    if (user.status.isLocked) {
      return { allowed: false, reason: user.status.reason ?? 'Account locked' };
    }
    if (user.status.isPending && !user.status.emailVerified) {
      return { allowed: false, reason: 'Email not verified' };
    }
    return { allowed: true };
  }

  /** Get users requiring attention (pending activation, etc.) */
  async getUsersRequiringAttention(): Promise<User[]> {
    const result = await this.repository.list({ page: 1, limit: 100 });
    return result.data.filter((u) => u.status.isPending || u.entityStatus === 'active');
  }
}
