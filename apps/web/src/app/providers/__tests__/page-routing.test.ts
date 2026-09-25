// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI Providers configure routing (PROVIDER-UX Ollama)
//
// The "Add AI" / Configure step must open the LOCAL auto-detect experience for a
// local provider (Ollama) and the cloud ProviderConfigScreen for everyone else.
// This was the Ollama bug: the flow was implemented in SimpleProviderConfig but
// the configure route always rendered ProviderConfigScreen, so opening Ollama
// never auto-detected local models and never offered the model dropdown.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { configureExperienceFor, isContractProviderFamily } from '../provider-ux.js';

describe('configureExperienceFor (Ollama local routing)', () => {
  it('routes the local provider (ollama) to the SimpleProviderConfig flow', () => {
    expect(configureExperienceFor('ollama')).toBe('simple-local');
  });

  it('routes cloud providers to the ProviderConfigScreen flow', () => {
    for (const family of ['google', 'openai', 'anthropic', 'deepseek']) {
      expect(configureExperienceFor(family)).toBe('config-screen');
    }
  });
});

describe('one-click connect gate (registry-only families)', () => {
  // The one-click flow (ProviderConnectFlow) only renders for families the
  // gateway's connect contract accepts. A registry-only family keeps the
  // advanced configuration instead of being silently probed.
  it('offers the one-click flow for every built-in contract provider', () => {
    for (const family of ['google', 'openai', 'anthropic', 'deepseek', 'openrouter', 'ollama']) {
      expect(isContractProviderFamily(family)).toBe(true);
    }
  });

  it('gates the one-click flow off for registry-only providers', () => {
    for (const family of ['mock', 'acme-ai']) {
      expect(isContractProviderFamily(family)).toBe(false);
      // ...and those still route somewhere: the advanced config screen (the
      // local auto-detect flow is reserved for the local contract family).
      expect(configureExperienceFor(family)).toBe('config-screen');
    }
  });
});
