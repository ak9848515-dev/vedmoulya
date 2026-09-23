export const name = 'shared' as const;

export type { QuickActionDTO } from './types/QuickActionDTO.js';

// ── Provider Presets (FINAL-02 — friendly provider UX) ──────────────────────
// Single source of truth for KNOWN-provider setup metadata. The UI renders
// Simple mode from this table (only the fields a user actually needs) and the
// gateway's connection tester aligns to the same families/endpoints.
// KEEP IN SYNC with @vedmoulya/core PROVIDER_RUNTIME_DESCRIPTORS (family ids,
// env keys) and services/orchestrator provider adapters (default model ids,
// endpoints) — services/api/src/__tests__/ProviderPresetsAlignment.test.ts
// enforces the contract. This module must stay DEPENDENCY-FREE (web bundle).
export {
  PROVIDER_PRESETS,
  SIMPLE_PROVIDER_PRESET_IDS,
  providerPreset,
  isSimpleProviderPreset,
} from './providers/providerPresets.js';
export type {
  ProviderPresetId,
  ProviderPreset,
  ProviderCredentialType,
  ProviderModelDiscovery,
} from './providers/providerPresets.js';

// ── Deterministic model selection (G9 — one-click setup) ────────────────────
// "Which model is the default?" is settled from provider METADATA (the id and
// the capabilities the provider really reported), so no provider-specific
// setup logic ever lives in the UI. Also DEPENDENCY-FREE (web bundle).
export { choosePreferredModel, scorePreferredModel } from './providers/provider-model-selection.js';
export type {
  SelectableModel,
  PreferredModelChoice,
  PreferredModelSource,
} from './providers/provider-model-selection.js';
