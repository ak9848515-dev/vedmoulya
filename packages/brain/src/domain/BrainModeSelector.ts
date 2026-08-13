// ──────────────────────────────────────────────────────────────────
// VedMoulya — Brain · BrainModeSelector
// EPIC-016 §24 — Brain modes.
//
// FAST / BALANCED / QUALITY / DEEP_RESEARCH / COST_SENSITIVE /
// PRIVATE_LOCAL. The Brain picks a default from the task's requirements;
// the user can override. Deterministic — no AI needed for this choice.
// ──────────────────────────────────────────────────────────────────

import type { BrainMode, IntentProfile } from '../types/brain-types.js';

export interface ModeContext {
  profile: IntentProfile;
  capabilityCount: number;
  userOverride?: BrainMode;
  /** User preferences from the provider prefs (free-first, local-first…). */
  preferenceHints?: {
    costSensitive?: boolean;
    localFirst?: boolean;
  };
}

export class BrainModeSelector {
  select(ctx: ModeContext): BrainMode {
    if (ctx.userOverride) return ctx.userOverride;

    const { profile, capabilityCount, preferenceHints } = ctx;

    // Privacy requirement dominates: local/private.
    if (profile.privacyRequirement === 'PRIVATE' || preferenceHints?.localFirst) {
      return 'PRIVATE_LOCAL';
    }

    // Cost sensitivity from explicit constraints or preferences.
    const costSensitive =
      preferenceHints?.costSensitive === true ||
      profile.constraints.some((c) => /free|budget|cheap|no cost/i.test(c));
    if (costSensitive) return 'COST_SENSITIVE';

    // Deep research: multi-provider independent research desired.
    if (/research|investigate|compare|comprehensive/i.test(profile.objective)) {
      return 'DEEP_RESEARCH';
    }

    // Quality target.
    if (profile.qualityTarget === 'HIGH') return 'QUALITY';

    // Fast/urgency.
    if (profile.urgency === 'HIGH' && capabilityCount <= 2) return 'FAST';

    // Complexity: more capabilities → BALANCED (parallel where safe).
    if (capabilityCount >= 4) return 'BALANCED';

    return 'BALANCED';
  }
}
