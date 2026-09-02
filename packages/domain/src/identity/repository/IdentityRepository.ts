// ──────────────────────────────────────────────────────────────────
// VedMoulya — Identity Repository Interface
// Contract for User persistence — infrastructure must implement
// ──────────────────────────────────────────────────────────────────

import type { User } from '../entities/User.js';
import type { UserId } from '../value-objects/UserId.js';
import type { Email } from '../value-objects/Email.js';
import type { PaginationParams, PaginatedResult } from '@vedmoulya/core';

export interface IdentityRepository {
  /** Find a user by their unique identifier */
  findById(id: UserId): Promise<User | null>;

  /** Find a user by their email address */
  findByEmail(email: Email): Promise<User | null>;

  /** Find a user by their linked Google subject id (null when none) */
  findByGoogleId(googleId: string): Promise<User | null>;

  /** Save a new user (insert) */
  save(user: User): Promise<void>;

  /** Update an existing user (upsert) */
  update(user: User): Promise<void>;

  /** Delete a user by their identifier (hard delete) */
  delete(id: UserId): Promise<void>;

  /** Check if a user with the given email exists */
  exists(email: Email): Promise<boolean>;

  /** List users with pagination */
  list(params: PaginationParams): Promise<PaginatedResult<User>>;

  /** Find users created within a date range */
  findByCreatedAtRange(
    start: Date,
    end: Date,
    params: PaginationParams,
  ): Promise<PaginatedResult<User>>;

  /** Count total users */
  count(): Promise<number>;

  /** Count active users */
  countActive(): Promise<number>;
}
