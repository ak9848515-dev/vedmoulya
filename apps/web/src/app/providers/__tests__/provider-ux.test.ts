// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Provider UX vocabulary tests
// AI PROVIDER UX SIMPLIFICATION
//
// Proves the presentation rules the simplified screens depend on:
//   - names/vendors come from the registry (with presentation aliases),
//   - connection status is derived from the REAL runtime-truth registry,
//   - capabilities are translated into plain language (and never dropped),
//   - failures become friendly, actionable messages — never raw errors.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  MAX_CAPABILITY_PHRASES,
  PROVIDER_CONTRACT_FAMILIES,
  capabilityPhrases,
  connectProviderFamily,
  friendlyConnectionError,
  isBuiltInProvider,
  isContractProviderFamily,
  isProviderActive,
  modelSubtitle,
  providerIdentity,
  providerStatusDisplay,
  supportsAutomaticModel,
  supportsOAuth,
} from '../provider-ux.js';

describe('provider identity (registry-backed naming)', () => {
  it('uses calm presentation names for known families', () => {
    expect(providerIdentity('google', 'Google (Gemini)')).toMatchObject({
      name: 'Gemini',
      vendor: 'Google',
      monogram: 'G',
    });
    expect(providerIdentity('anthropic', 'Anthropic (Claude)')).toMatchObject({
      name: 'Claude',
      vendor: 'Anthropic',
    });
    expect(providerIdentity('openai', 'OpenAI')).toMatchObject({
      name: 'OpenAI',
      vendor: 'OpenAI',
    });
  });

  it('falls back to the registry name for providers VedMoulya does not know', () => {
    const identity = providerIdentity('acme-ai', 'Acme AI');
    expect(identity.name).toBe('Acme AI');
    expect(identity.vendor).toBe('Custom endpoint');
    expect(identity.monogram).toBe('A');
  });

  it('never renders an empty monogram', () => {
    expect(providerIdentity('acme-ai', '   ').monogram).toBe('C');
  });

  it('knows which families have a configuration preset', () => {
    expect(isBuiltInProvider('google')).toBe(true);
    expect(isBuiltInProvider('openai')).toBe(true);
    expect(isBuiltInProvider('acme-ai')).toBe(false);
  });

  it('only offers OAuth where the codebase actually has it (Google)', () => {
    expect(supportsOAuth('google')).toBe(true);
    expect(supportsOAuth('openai')).toBe(false);
    expect(supportsOAuth('anthropic')).toBe(false);
  });
});

describe('connection status (derived from the runtime-truth registry)', () => {
  it('reports CONFIGURED as connected + configured', () => {
    const status = providerStatusDisplay('CONFIGURED', 'Gemini');
    expect(status.connection.key).toBe('connected');
    expect(status.connection.label).toBe('Connected');
    expect(status.connection.symbol).toBe('✓');
    expect(status.configured).toBe(true);
  });

  it('reports the deterministic mock as connected (it really executes)', () => {
    const status = providerStatusDisplay('MOCK', 'Mock (Test)');
    expect(status.connection.key).toBe('connected');
    expect(status.connection.hint).toMatch(/mock/i);
    expect(status.configured).toBe(true);
  });

  it('reports ERROR as the one genuine connection issue with a friendly hint', () => {
    const status = providerStatusDisplay('ERROR', 'OpenAI');
    expect(status.connection.key).toBe('issue');
    expect(status.connection.label).toBe('Connection issue');
    // PROVIDER-01 — the reason is the canonical lifecycle hint: actionable,
    // jargon-free, and never a raw error or an operator-facing key name.
    expect(status.connection.hint).toMatch(/reconnect/i);
    expect(status.connection.hint ?? '').not.toMatch(/AI_[A-Z_]+API_KEY|adapter/i);
    expect(status.configured).toBe(false);
  });

  it('never reads Connected for a configured provider the user switched off', () => {
    const off = providerStatusDisplay('CONFIGURED', 'OpenAI', false);
    expect(off.connection.key).toBe('not_connected');
    expect(off.connection.label).toBe('Not connected');
    // ...while still reporting that the runtime IS configured elsewhere.
    expect(off.configured).toBe(true);
    expect(off.connection.hint).toBeTruthy();
  });

  it('surfaces a real failed verification instead of a green connection', () => {
    const rejected = providerStatusDisplay('CONFIGURED', 'Gemini', true, {
      lastVerification: { ok: false, failureKind: 'invalid_api_key' },
    });
    expect(rejected.connection.key).toBe('issue');
    expect(rejected.connection.label).toBe('Connection issue');

    const unreachable = providerStatusDisplay('CONFIGURED', 'Gemini', true, {
      lastVerification: { ok: false, failureKind: 'unreachable' },
    });
    expect(unreachable.connection.key).toBe('issue');
    // The two flavours stay distinguishable through the reason, not the label.
    expect(unreachable.connection.hint).not.toBe(rejected.connection.hint);
  });

  it('does not offer Connect for a runtime that is not registered in this build', () => {
    const unregistered = providerStatusDisplay('DISABLED', 'Claude');
    expect(unregistered.connection.key).toBe('not_connected');
    expect(unregistered.connection.hint).toMatch(/not available in this version/i);
  });

  it('reports NOT_CONFIGURED / UNSUPPORTED_RUNTIME / unknown as not connected', () => {
    for (const runtime of ['NOT_CONFIGURED', 'UNSUPPORTED_RUNTIME', 'DISABLED', undefined]) {
      const status = providerStatusDisplay(runtime, 'Claude');
      expect(status.connection.key).toBe('not_connected');
      expect(status.connection.label).toBe('Not connected');
      expect(status.configured).toBe(false);
      expect(status.connection.hint).toBeTruthy();
    }
  });

  it('reports the LIVE transient stage while a check is running', () => {
    // The transient lifecycle states are only reachable through the explicit
    // `activity` option — a surface reporting its own in-flight work. They must
    // never be mistaken for a settled "Not connected", and they carry the
    // lifecycle's own label/symbol rather than a second vocabulary.
    const expected = [
      ['verifying', 'Verifying'],
      ['configuring', 'Connecting'],
    ] as const;
    for (const [activity, label] of expected) {
      const display = providerStatusDisplay('NOT_CONFIGURED', 'Gemini', true, { activity });
      expect(display.connection.key).toBe('not_connected');
      expect(display.connection.label).toBe(label);
      expect(display.connection.symbol).toBe('●');
      expect(display.configured).toBe(false);
      expect(display.connection.hint).toBeTruthy();
    }
  });

  it('never leaks operator-facing runtime internals into the hint', () => {
    const status = providerStatusDisplay('NOT_CONFIGURED', 'Gemini');
    expect(status.connection.hint ?? '').not.toMatch(/AI_[A-Z_]+API_KEY|adapter|dormant/i);
  });

  it('marks a provider ACTIVE only when it is configured AND switched on', () => {
    const connected = providerStatusDisplay('CONFIGURED', 'Gemini');
    expect(isProviderActive(true, connected)).toBe(true);
    expect(isProviderActive(false, connected)).toBe(false);
    const notConfigured = providerStatusDisplay('NOT_CONFIGURED', 'Gemini');
    expect(isProviderActive(true, notConfigured)).toBe(false);
  });
});

describe('capability sentences (auto-detected, plain language)', () => {
  it('translates raw catalog capability ids', () => {
    expect(
      capabilityPhrases([
        'reasoning',
        'general_conversation',
        'image_understanding',
        'content_generation',
        'function_calling',
      ]),
    ).toEqual([
      'Thinking & reasoning',
      'Conversations',
      'Understanding images',
      'Creating content',
      'Tool use',
    ]);
  });

  it('translates the experience view model labels too', () => {
    expect(capabilityPhrases(['Reasoning', 'Vision', 'Tools'])).toEqual([
      'Thinking & reasoning',
      'Understanding images',
      'Tool use',
    ]);
  });

  it('deduplicates synonyms and keeps unknown values verbatim', () => {
    const phrases = capabilityPhrases(['vision', 'Vision', 'some_new_ability']);
    expect(phrases).toContain('Understanding images');
    expect(phrases).toContain('some_new_ability');
    expect(phrases.filter((p) => p === 'Understanding images')).toHaveLength(1);
  });

  it('stays a summary, not a spec sheet', () => {
    const phrases = capabilityPhrases([
      'reasoning',
      'general_conversation',
      'vision',
      'content_generation',
      'function_calling',
      'coding',
      'summarization',
      'translation',
      'speech',
      'embeddings',
    ]);
    expect(phrases.length).toBe(MAX_CAPABILITY_PHRASES);
  });

  it('builds a short model subtitle from real capability data only', () => {
    expect(modelSubtitle(['reasoning', 'vision'])).toBe(
      'Thinking & reasoning · Understanding images',
    );
    expect(modelSubtitle([])).toBeUndefined();
  });
});

describe('friendly failures (no raw technical text)', () => {
  it('turns a rejected key into an actionable message', () => {
    const failure = friendlyConnectionError('Gemini', 'invalid_api_key');
    expect(failure.title).toBe("Couldn't connect to Gemini.");
    expect(failure.hint).toMatch(/check your api key/i);
  });

  it('explains reachability and rate limits without jargon', () => {
    expect(friendlyConnectionError('OpenAI', 'unreachable').hint).toMatch(/connection/i);
    expect(friendlyConnectionError('OpenAI', 'rate_limited').hint).toMatch(/busy|wait/i);
  });

  it('falls back to retry guidance for unknown and missing kinds', () => {
    expect(friendlyConnectionError('DeepSeek').hint).toMatch(/check your api key/i);
    expect(friendlyConnectionError('DeepSeek', 'something_else').title).toMatch(/deepseek/i);
  });
});

describe('model choice vocabulary', () => {
  it('offers Automatic only when the AI really offers a choice', () => {
    expect(supportsAutomaticModel(0)).toBe(false);
    expect(supportsAutomaticModel(1)).toBe(false);
    expect(supportsAutomaticModel(2)).toBe(true);
  });
});

describe('connect family (G9 — one closed gateway contract)', () => {
  // The exact family ids the gateway's setup / connect / disconnect procedures
  // accept. Everything the screens hand to those procedures goes through here.
  const CONTRACT_FAMILIES = [
    'google',
    'openai',
    'anthropic',
    'deepseek',
    'openrouter',
    'ollama',
    'openai-compatible',
  ] as const;

  it('passes every contract family through untouched', () => {
    for (const family of CONTRACT_FAMILIES) {
      expect(connectProviderFamily(family)).toBe(family);
    }
  });

  it('maps registry families the pipeline cannot probe natively onto the OpenAI-compatible endpoint', () => {
    // The registry really carries these (the EI-002 catalog plus user-defined
    // ids), but the connect contract does not — the gateway probes them as an
    // OpenAI-compatible endpoint instead of rejecting the request outright.
    // OpenRouter is NOT one of them any more: it is a first-class contract family.
    for (const family of ['mock', 'custom', 'acme-ai']) {
      expect(connectProviderFamily(family)).toBe('openai-compatible');
    }
  });

  it('never widens the contract back to an arbitrary registry id', () => {
    // Case/spelling differences and blank ids fall back rather than being
    // passed through as a family the gateway would reject.
    for (const family of ['', 'OpenAI', 'gemini', 'cogito']) {
      expect(connectProviderFamily(family)).toBe('openai-compatible');
    }
  });
});

describe('connect gate (G9 — the one-click flow is gated on the contract)', () => {
  it('accepts exactly the seven contract families', () => {
    expect([...PROVIDER_CONTRACT_FAMILIES]).toEqual([
      'google',
      'openai',
      'anthropic',
      'deepseek',
      'openrouter',
      'ollama',
      'openai-compatible',
    ]);
    for (const family of PROVIDER_CONTRACT_FAMILIES) {
      expect(isContractProviderFamily(family)).toBe(true);
    }
  });

  it('rejects every registry-only family, so the flow is never shown for one', () => {
    // The registry really carries these (the EI-002 catalog plus user-defined
    // ids) — they keep the advanced configuration instead of a one-click flow
    // that would silently probe them as an OpenAI-compatible endpoint.
    // OpenRouter used to be one of them; it now carries its own contract family.
    for (const family of ['mock', 'custom', 'acme-ai']) {
      expect(isContractProviderFamily(family)).toBe(false);
    }
  });

  it('rejects malformed ids and blank input rather than widening the gate', () => {
    for (const family of ['', 'OpenAI', 'gemini', ' cogito ']) {
      expect(isContractProviderFamily(family)).toBe(false);
    }
  });

  it('the mapping fallback and the gate agree: only gated-out ids become openai-compatible', () => {
    const all = [...PROVIDER_CONTRACT_FAMILIES, 'mock', 'custom', 'acme-ai', ''] as const;
    for (const family of all) {
      const mapped = connectProviderFamily(family);
      // A contract family is passed through; everything the gate rejects is
      // explicitly mapped onto the OpenAI-compatible advanced path.
      if (isContractProviderFamily(family)) expect(mapped).toBe(family);
      else expect(mapped).toBe('openai-compatible');
    }
  });
});
