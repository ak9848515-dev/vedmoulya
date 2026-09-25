// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Provider Presets Alignment Contract (FINAL-02)
//
// The friendly provider UX renders Simple mode from @vedmoulya/shared
// PROVIDER_PRESETS. This test enforces the documented contract (see the
// comment in packages/shared/src/index.ts):
//   1. preset family ids stay in sync with @vedmoulya/core's
//      PROVIDER_RUNTIME_DESCRIPTORS (the SAME registry the config layer,
//      production validator and provider registration use);
//   2. runtime-truth fields (env keys, adapter existence, executability)
//      agree between the preset table and the core descriptors;
//   3. the preset default endpoints match the endpoints the gateway's
//      ProviderConnectionTester actually probes (no drifted URLs);
//   4. Simple mode is offered EXACTLY for the declared simple preset ids —
//      unknown families and custom providers never get Simple mode.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import { PROVIDER_RUNTIME_DESCRIPTORS } from '@vedmoulya/core';
import {
  PROVIDER_PRESETS,
  SIMPLE_PROVIDER_PRESET_IDS,
  providerPreset,
  isSimpleProviderPreset,
} from '@vedmoulya/shared';
import { testProviderConnection } from '../services/ProviderConnectionTester.js';

const PRESET_IDS = Object.keys(PROVIDER_PRESETS);

describe('ProviderPresetsAlignment (FINAL-02 contract)', () => {
  it('preset families (except user-defined custom) exist in the core runtime descriptors', () => {
    const coreFamilies = PROVIDER_RUNTIME_DESCRIPTORS.map((d) => d.family);
    for (const id of PRESET_IDS) {
      if (id === 'custom') continue; // user-defined endpoint, not a runtime family
      expect(coreFamilies, `preset "${id}" must exist in PROVIDER_RUNTIME_DESCRIPTORS`).toContain(
        id,
      );
    }
  });

  it('cloud credential env keys agree with the core descriptors', () => {
    const byFamily = new Map(PROVIDER_RUNTIME_DESCRIPTORS.map((d) => [d.family, d]));

    // google → AI_GOOGLE_API_KEY (the same key registerPlatformProviders reads)
    expect(byFamily.get('google')?.envKeys).toContain('AI_GOOGLE_API_KEY');
    // openai → canonical AI_OPENAI_API_KEY with legacy OPENAI_API_KEY fallback
    expect(byFamily.get('openai')?.envKeys).toEqual(['AI_OPENAI_API_KEY', 'OPENAI_API_KEY']);
    // deepseek → AI_DEEPSEEK_API_KEY only
    expect(byFamily.get('deepseek')?.envKeys).toEqual(['AI_DEEPSEEK_API_KEY']);
    // anthropic → AI_ANTHROPIC_API_KEY, but catalog-only (no adapter)
    expect(byFamily.get('anthropic')?.envKeys).toContain('AI_ANTHROPIC_API_KEY');
    // openrouter → AI_OPENROUTER_API_KEY (shared OpenAI-compatible adapter)
    expect(byFamily.get('openrouter')?.envKeys).toContain('AI_OPENROUTER_API_KEY');
  });

  it('Anthropic is catalog-only in BOTH tables (honest runtime note, no Simple-mode execution claim)', () => {
    const desc = PROVIDER_RUNTIME_DESCRIPTORS.find((d) => d.family === 'anthropic');
    expect(desc?.adapter).toBeNull();
    expect(desc?.canExecute).toBe(false);

    const preset = PROVIDER_PRESETS.anthropic;
    expect(preset.runtimeNote).toBeTruthy();
    expect(preset.runtimeNote).toMatch(/no Anthropic execution adapter/i);
  });

  it('preset default endpoints match the endpoints the connection tester actually probes', async () => {
    const captured: Array<{ family: string; url: string }> = [];
    const fetchFn = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      captured.push({
        family: 'x',
        url: typeof url === 'string' ? url : String(url),
      });
      return new Response(JSON.stringify({ data: [], models: [] }), { status: 200 });
    }) as unknown as typeof fetch;

    const cases: Array<{
      family: 'google' | 'openai' | 'deepseek' | 'anthropic' | 'openrouter' | 'ollama';
      apiKey?: string;
    }> = [
      { family: 'google', apiKey: 'k' },
      { family: 'openai', apiKey: 'k' },
      { family: 'deepseek', apiKey: 'k' },
      { family: 'anthropic', apiKey: 'k' },
      { family: 'openrouter', apiKey: 'k' },
      { family: 'ollama' },
    ];
    for (const c of cases) {
      await testProviderConnection({ ...c, fetchFn, env: {} });
    }

    expect(captured.map((c) => c.url)).toEqual([
      `${PROVIDER_PRESETS.google.defaultEndpoint}/v1beta/models`,
      `${PROVIDER_PRESETS.openai.defaultEndpoint}/models`,
      `${PROVIDER_PRESETS.deepseek.defaultEndpoint}/models`,
      `${PROVIDER_PRESETS.anthropic.defaultEndpoint}/v1/models`,
      `${PROVIDER_PRESETS.openrouter.defaultEndpoint}/models`,
      `${PROVIDER_PRESETS.ollama.defaultEndpoint}/api/tags`,
    ]);
  });

  it('Simple mode is offered exactly for the declared simple preset ids', () => {
    expect(SIMPLE_PROVIDER_PRESET_IDS).toEqual([
      'google',
      'openai',
      'anthropic',
      'deepseek',
      'openrouter',
      'ollama',
    ]);
    for (const id of SIMPLE_PROVIDER_PRESET_IDS) {
      expect(PROVIDER_PRESETS[id as keyof typeof PROVIDER_PRESETS].simpleModeSupported).toBe(true);
      expect(isSimpleProviderPreset(id)).toBe(true);
    }
    // custom and unknown families never get Simple mode.
    expect(PROVIDER_PRESETS.custom.simpleModeSupported).toBe(false);
    expect(isSimpleProviderPreset('custom')).toBe(false);
    expect(isSimpleProviderPreset('definitely-not-a-family')).toBe(false);
  });

  it('cloud presets never expose the endpoint field in Simple mode; local/custom always do', () => {
    for (const id of ['google', 'openai', 'anthropic', 'deepseek', 'openrouter'] as const) {
      expect(PROVIDER_PRESETS[id].endpointUserConfigurable, id).toBe(false);
    }
    expect(PROVIDER_PRESETS.ollama.endpointUserConfigurable).toBe(true);
    expect(PROVIDER_PRESETS.custom.endpointUserConfigurable).toBe(true);
  });

  it('every preset carries complete, honest user-facing metadata', () => {
    for (const id of PRESET_IDS) {
      const preset = PROVIDER_PRESETS[id as keyof typeof PROVIDER_PRESETS];
      expect(preset.displayName.trim().length, id).toBeGreaterThan(0);
      expect(preset.credentialHelp.trim().length, id).toBeGreaterThan(0);
      expect(preset.docsUrl.startsWith('https://'), id).toBe(true);
      expect(['Cloud AI', 'Local AI', 'Enterprise AI']).toContain(preset.category);
      expect(['cloud', 'local', 'enterprise']).toContain(preset.deployment);
      if (preset.credentialType !== 'none_local') {
        expect(preset.credentialLabel.trim().length, id).toBeGreaterThan(0);
      }
    }
  });

  it('unknown family lookup falls back to a custom-shaped preset (never Simple mode)', () => {
    const fallback = providerPreset('some-new-family');
    expect(fallback.presetId).toBe('custom');
    expect(fallback.simpleModeSupported).toBe(false);
    expect(fallback.endpointUserConfigurable).toBe(true);
    expect(fallback.displayName).toContain('some-new-family');
  });

  it('prototype-named ids never resolve an inherited Object.prototype member', () => {
    // Regression guard: the lookup used to be a keyed object read
    // (`PROVIDER_PRESETS[id]`), so ids naming Object.prototype members
    // ('toString', '__proto__', 'constructor', …) returned inherited
    // functions/objects as if they were provider presets. The lookup is now
    // Map-backed, so only the table's OWN entries can ever resolve.
    const prototypeNames = [
      'toString',
      '__proto__',
      'constructor',
      'valueOf',
      'hasOwnProperty',
      'isPrototypeOf',
      'propertyIsEnumerable',
      '__defineGetter__',
    ];
    for (const id of prototypeNames) {
      const preset = providerPreset(id);
      // A real ProviderPreset shape — never a function or a prototype object.
      expect(typeof preset.displayName, id).toBe('string');
      expect(preset.presetId, id).toBe('custom');
      expect(preset.displayName).toBe(`Custom provider (${id})`);
      expect(preset.simpleModeSupported, id).toBe(false);
      expect(preset.endpointUserConfigurable, id).toBe(true);
      // '__proto__' is the one that used to return the prototype object itself.
      expect(preset).not.toBe(Object.prototype);
    }
    // …and the guard did not disturb real ids.
    expect(providerPreset('google').presetId).toBe('google');
    expect(providerPreset('google').displayName).toBe('Google Gemini');
    expect(providerPreset('openai').presetId).toBe('openai');
    // An empty id stays the unqualified custom label (no dangling parentheses).
    expect(providerPreset('').displayName).toBe('Custom provider');
  });

  it('adapter default model ids stay pinned to the presets (pinning contract)', () => {
    // Sources (services/orchestrator/src/providers/*): the adapters' own
    // defaults — GoogleGeminiProvider → gemini-3.5-flash, VercelAIProvider →
    // gpt-4o-mini, DeepSeekProvider → deepseek-chat, OllamaProvider →
    // llama3.2. If an adapter default changes, update BOTH sides together.
    expect(PROVIDER_PRESETS.google.defaultModelId).toBe('gemini-3.5-flash');
    expect(PROVIDER_PRESETS.openai.defaultModelId).toBe('gpt-4o-mini');
    expect(PROVIDER_PRESETS.deepseek.defaultModelId).toBe('deepseek-chat');
    expect(PROVIDER_PRESETS.ollama.defaultModelId).toBe('llama3.2');
    // Anthropic has no execution adapter — its default is a catalog model.
    expect(PROVIDER_PRESETS.anthropic.defaultModelId).toBe('claude-sonnet-4');
    expect(PROVIDER_PRESETS.custom.defaultModelId).toBe('');
  });
});
