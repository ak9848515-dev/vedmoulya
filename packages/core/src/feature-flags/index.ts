// ──────────────────────────────────────────────────────────────────
// VedMoulya — Feature Flags
// ──────────────────────────────────────────────────────────────────

import { getConfig } from '../config/index.js';
import type { Configuration } from '../config/index.js';

export type FeatureFlag = keyof Configuration['features'];

export interface FeatureFlagRegistry {
  register(name: string, enabled: boolean): void;
  isEnabled(name: string): boolean;
  enable(name: string): void;
  disable(name: string): void;
  list(): Record<string, boolean>;
}

class DefaultFeatureFlagRegistry implements FeatureFlagRegistry {
  private readonly flags: Map<string, boolean> = new Map();
  private seeded = false;

  /**
   * Seed the three configuration-backed flags on first use. Deferring the
   * `config.features` reads keeps module scope inert (next build / bundlers
   * can import @vedmoulya/core without evaluating configuration).
   */
  private ensureSeeded(): void {
    if (this.seeded) return;
    this.seeded = true;
    const features = getConfig().features;
    this.flags.set('socialLoginEnabled', features.socialLoginEnabled);
    this.flags.set('aiAssistantEnabled', features.aiAssistantEnabled);
    this.flags.set('marketplaceEnabled', features.marketplaceEnabled);
  }

  register(name: string, enabled: boolean): void {
    this.ensureSeeded();
    this.flags.set(name, enabled);
  }

  isEnabled(name: string): boolean {
    this.ensureSeeded();
    return this.flags.get(name) ?? false;
  }

  enable(name: string): void {
    this.ensureSeeded();
    this.flags.set(name, true);
  }

  disable(name: string): void {
    this.ensureSeeded();
    this.flags.set(name, false);
  }

  list(): Record<string, boolean> {
    this.ensureSeeded();
    return Object.fromEntries(this.flags);
  }
}

export const featureFlags: FeatureFlagRegistry = new DefaultFeatureFlagRegistry();
