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
import { configureExperienceFor } from '../page.js';

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
