// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: UserId
// Branded type for type-safe user identification
// ──────────────────────────────────────────────────────────────────

import type { BrandedId } from '@vedmoulya/core';

/** Type-safe User identifier — branded string */
export type UserId = BrandedId<'UserId'>;

/** Create a UserId from a raw string */
export function createUserId(value: string): UserId {
  return value as UserId;
}

/** Generate a new UserId */
export function generateUserId(): UserId {
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  return `usr_${id}` as UserId;
}
