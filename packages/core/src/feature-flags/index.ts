// ──────────────────────────────────────────────────────────────────
// VedMoulya — Feature Flags
// ──────────────────────────────────────────────────────────────────

import { config } from '../config/index.js';

export type FeatureFlag = keyof typeof config.features;

export interface FeatureFlagRegistry {
  register(name: string, enabled: boolean): void;
  isEnabled(name: string): boolean;
  enable(name: string): void;
  disable(name: string): void;
  list(): Record<string, boolean>;
}

class DefaultFeatureFlagRegistry implements FeatureFlagRegistry {
  private readonly flags: Map<string, boolean> = new Map();

  constructor() {
    this.flags.set('socialLoginEnabled', config.features.socialLoginEnabled);
    this.flags.set('aiAssistantEnabled', config.features.aiAssistantEnabled);
    this.flags.set('marketplaceEnabled', config.features.marketplaceEnabled);
  }

  register(name: string, enabled: boolean): void {
    this.flags.set(name, enabled);
  }

  isEnabled(name: string): boolean {
    return this.flags.get(name) ?? false;
  }

  enable(name: string): void {
    this.flags.set(name, true);
  }

  disable(name: string): void {
    this.flags.set(name, false);
  }

  list(): Record<string, boolean> {
    return Object.fromEntries(this.flags);
  }
}

export const featureFlags: FeatureFlagRegistry = new DefaultFeatureFlagRegistry();
