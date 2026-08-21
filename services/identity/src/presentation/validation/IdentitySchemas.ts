// ──────────────────────────────────────────────────────────────────
// VedMoulya — Identity Validation Schemas
// Zod schemas for request/response validation
// ──────────────────────────────────────────────────────────────────

import { z } from 'zod';

// ── Common ─────────────────────────────────────────────────────────────────

export const userIdParam = z.object({
  id: z.string().min(1, 'User ID is required'),
});

export const paginationQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ── Registration ──────────────────────────────────────────────────────────

export const registerUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  displayName: z.string().min(2, 'Display name must be at least 2 characters').max(100),
  givenName: z.string().max(100).optional(),
  familyName: z.string().max(100).optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

// ── First-login profile setup (SPRINT-041B) ──────────────────────────────
// Small closed vocabularies for the identity profile — the estate has no
// existing gender/purpose taxonomy, so these are the identity profile's own
// contract (never a parallel copy of another module's vocabulary).

export const profileGenderEnum = z.enum(['female', 'male', 'non_binary', 'prefer_not_to_say']);

export const profilePurposeEnum = z.enum([
  'learning',
  'building',
  'career',
  'business',
  'personal',
  'other',
]);

export const PROFILE_AGE_MIN = 13;
export const PROFILE_AGE_MAX = 120;

// ── Profile Update ────────────────────────────────────────────────────────

export const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(100).optional(),
  givenName: z.string().max(100).optional(),
  familyName: z.string().max(100).optional(),
  avatarUrl: z.string().url('Invalid avatar URL').optional().or(z.literal('')),
  bio: z.string().max(500).optional(),
  timezone: z.string().max(64).optional(),
  locale: z.string().max(10).optional(),
  age: z.number().int().min(PROFILE_AGE_MIN).max(PROFILE_AGE_MAX).optional(),
  gender: profileGenderEnum.optional(),
  purpose: profilePurposeEnum.optional(),
  primaryGoal: z.string().min(1).max(200).optional(),
});

// ── Preferences Update ────────────────────────────────────────────────────

export const updatePreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.string().max(10).optional(),
  notificationsEnabled: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  weeklyDigest: z.boolean().optional(),
});

// ── Settings Update ───────────────────────────────────────────────────────

export const updateSettingsSchema = z.object({
  twoFactorEnabled: z.boolean().optional(),
  sessionTimeoutMinutes: z.number().int().min(5).max(1440).optional(),
  loginNotifications: z.boolean().optional(),
  profileVisibility: z.enum(['public', 'private', 'connections']).optional(),
  showOnlineStatus: z.boolean().optional(),
  allowDataSharing: z.boolean().optional(),
  preferredAuthMethod: z.enum(['email', 'google', 'any']).optional(),
});

// ── Email Change ──────────────────────────────────────────────────────────

export const changeEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Current password is required'),
});

// ── Status Change ─────────────────────────────────────────────────────────

export const deactivateUserSchema = z.object({
  reason: z.string().max(500).optional(),
});

// ── Password Change ───────────────────────────────────────────────────────

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

// ── Inferred Types ────────────────────────────────────────────────────────

export type RegisterUserInput = z.infer<typeof registerUserSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type DeactivateUserInput = z.infer<typeof deactivateUserSchema>;
export type PaginationInput = z.infer<typeof paginationQuery>;
