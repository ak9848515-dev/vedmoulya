// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Control Plane · AutonomySettingsValidator
// SPRINT-031 — fail-closed, deterministic validation of user autonomy control.
// Nothing is ever "allow everything by default": an invalid or unconfirmed
// settings shape is REFUSED (the previous settings stay in force), and the
// default is the most restrictive posture (level 0 observe, no spend, private
// only). This validator never grants — it only accepts explicit, bounded,
// confirmed user intent.
// ─────────────────────────────────────────────────────────────────────────────

import type { AutonomyLevel } from '@vedmoulya/intelligence-fabric';
import type { AutonomySettings, QuietHours } from '../types/control-types.js';
import { DEFAULT_AUTONOMY_SETTINGS } from '../types/control-types.js';

export type SettingsValidation =
  { success: true; settings: AutonomySettings } | { success: false; error: string };

const CATEGORY_RE = /^[A-Z_]{2,40}$/;
const PROVIDER_RE = /^[a-z0-9_-]{1,60}$/;
const ID_RE = /^[a-zA-Z0-9_-]{1,80}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function isValidTime(t: string | undefined): boolean {
  return t === undefined || TIME_RE.test(t);
}

/**
 * Validate a user-supplied settings shape. `userConfirmed` is REQUIRED to be
 * true (explicit consent) — silence is never consent, a default is never a
 * grant. Returns the normalized settings or a refusal.
 */
export class AutonomySettingsValidator {
  validate(input: {
    ownerId: string;
    autonomyLevel: number;
    allowedCategories?: string[];
    prohibitedCategories?: string[];
    maxDailyCostUsd?: number;
    maxTaskCostUsd?: number;
    allowedProviders?: string[];
    prohibitedProviders?: string[];
    privateOnly?: boolean;
    userConfirmed?: boolean;
    notificationPreference?: 'all' | 'briefing-only' | 'none';
    quietHours?: QuietHours;
    automationPermissions?: string[];
    updatedBy: string;
    updatedAt?: string;
  }): SettingsValidation {
    if (input.userConfirmed !== true) {
      return {
        success: false,
        error: 'Settings require explicit user confirmation — silence is never consent.',
      };
    }
    if (
      !Number.isInteger(input.autonomyLevel) ||
      input.autonomyLevel < 0 ||
      input.autonomyLevel > 5
    ) {
      return {
        success: false,
        error: `autonomyLevel must be an integer 0..5, got ${input.autonomyLevel}.`,
      };
    }
    const caps: Array<[string, number | undefined]> = [
      ['maxDailyCostUsd', input.maxDailyCostUsd],
      ['maxTaskCostUsd', input.maxTaskCostUsd],
    ];
    for (const [name, value] of caps) {
      if (value === undefined) continue;
      if (!Number.isFinite(value) || value < 0) {
        return { success: false, error: `${name} must be a non-negative number, got ${value}.` };
      }
    }
    for (const list of [
      ['allowedCategories', input.allowedCategories],
      ['prohibitedCategories', input.prohibitedCategories],
    ] as const) {
      const [name, arr] = list;
      if (arr === undefined) continue;
      if (arr.length > 20 || arr.some((c) => !CATEGORY_RE.test(c))) {
        return { success: false, error: `${name} contains an invalid category.` };
      }
    }
    for (const list of [
      ['allowedProviders', input.allowedProviders],
      ['prohibitedProviders', input.prohibitedProviders],
    ] as const) {
      const [name, arr] = list;
      if (arr === undefined) continue;
      if (arr.length > 50 || arr.some((p) => !PROVIDER_RE.test(p))) {
        return { success: false, error: `${name} contains an invalid provider id.` };
      }
    }
    if (input.allowedProviders && input.prohibitedProviders) {
      const overlap = input.allowedProviders.filter((p) => input.prohibitedProviders?.includes(p));
      if (overlap.length > 0) {
        return {
          success: false,
          error: `Providers cannot be both allowed and prohibited: ${overlap.join(', ')}.`,
        };
      }
    }
    if (!isValidTime(input.quietHours?.start) || !isValidTime(input.quietHours?.end)) {
      return { success: false, error: 'quietHours must use 24h "HH:MM" values.' };
    }
    if (input.automationPermissions && input.automationPermissions.some((id) => !ID_RE.test(id))) {
      return { success: false, error: 'automationPermissions contains an invalid id.' };
    }

    const now = input.updatedAt ?? new Date().toISOString();
    const defaults = DEFAULT_AUTONOMY_SETTINGS;
    const settings: AutonomySettings = {
      ownerId: input.ownerId,
      autonomyLevel: input.autonomyLevel as AutonomyLevel,
      allowedCategories: input.allowedCategories ?? defaults.allowedCategories,
      prohibitedCategories: input.prohibitedCategories ?? defaults.prohibitedCategories,
      maxDailyCostUsd: input.maxDailyCostUsd ?? defaults.maxDailyCostUsd,
      maxTaskCostUsd: input.maxTaskCostUsd ?? defaults.maxTaskCostUsd,
      allowedProviders: input.allowedProviders ?? defaults.allowedProviders,
      prohibitedProviders: input.prohibitedProviders ?? defaults.prohibitedProviders,
      privateOnly: input.privateOnly ?? defaults.privateOnly,
      userConfirmed: true,
      notificationPreference: input.notificationPreference ?? defaults.notificationPreference,
      quietHours: input.quietHours ?? defaults.quietHours,
      automationPermissions: input.automationPermissions ?? defaults.automationPermissions,
      updatedAt: now,
      updatedBy: input.updatedBy,
    };
    return { success: true, settings };
  }
}
