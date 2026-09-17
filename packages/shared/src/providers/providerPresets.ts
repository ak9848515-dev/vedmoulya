// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Provider Presets (single source of truth)
// FINAL-02 — friendly provider UX + first-login Gemini auto-configuration.
//
// For every KNOWN provider family this table declares exactly what a normal
// user must supply in Simple mode (display name, credential, default
// endpoint, model discovery behaviour, default model) — so no provider UI
// component hard-codes provider behavior. Custom/OpenAI-compatible providers
// are advanced-only: Simple mode never asks for protocol/deployment fields.
//
// EVIDENCE GROUNDING (nothing invented):
//   - family ids + env keys mirror @vedmoulya/core PROVIDER_RUNTIME_DESCRIPTORS
//     (google → AI_GOOGLE_API_KEY, openai → AI_OPENAI_API_KEY/OPENAI_API_KEY,
//     deepseek → AI_DEEPSEEK_API_KEY, anthropic → adapter: null, ollama →
//     AI_OLLAMA_BASE_URL, no key).
//   - endpoints mirror the runtime adapters: GoogleGeminiProvider
//     (@ai-sdk/google → generativelanguage.googleapis.com), VercelAIProvider
//     (api.openai.com/v1), DeepSeekProvider (DEEPSEEK_BASE_URL =
//     api.deepseek.com), OllamaProvider (http://localhost:11434).
//   - default model ids are the adapters' own defaults / catalog models
//     (gemini-3.5-flash, gpt-4o-mini, deepseek-chat, claude-sonnet-4,
//     llama3.2) — never fabricated ids.
//
// SECURITY: no secret ever belongs here — this table is metadata only.
// ─────────────────────────────────────────────────────────────────────────────

/** Known provider families with a preset (custom = user-defined endpoint). */
export type ProviderPresetId = 'google' | 'openai' | 'anthropic' | 'deepseek' | 'ollama' | 'custom';

/** What credential Simple mode asks the user for. */
export type ProviderCredentialType =
  /** A provider API key (OpenAI / Anthropic / DeepSeek). */
  | 'api_key'
  /** A Gemini key from THIS deployment's environment (AI_GOOGLE_API_KEY) may
      already be configured server-side — the user connects without pasting
      anything. Otherwise a personal key is used for verification only. */
  | 'server_managed_or_api_key'
  /** No credential — a local server (Ollama) reachable on the network. */
  | 'none_local';

/** How available models are discovered for the model dropdown. */
export type ProviderModelDiscovery =
  /** REST list endpoint (Gemini v1beta/models, OpenAI /models, …). */
  | 'rest_list'
  /** Local runtime tag list (Ollama /api/tags). */
  | 'local_tags'
  /** No discovery — the user must enter a model id (explained why). */
  | 'none';

export interface ProviderPreset {
  presetId: ProviderPresetId;
  displayName: string;
  category: 'Cloud AI' | 'Local AI' | 'Enterprise AI';
  credentialType: ProviderCredentialType;
  /** Label for the credential field in Simple mode. */
  credentialLabel: string;
  /** Where the user obtains the credential (honest help, no fluff). */
  credentialHelp: string;
  /** Canonical provider endpoint (the runtime adapter's own). */
  defaultEndpoint: string;
  /** Simple mode hides the endpoint field entirely when false. */
  endpointUserConfigurable: boolean;
  modelDiscovery: ProviderModelDiscovery;
  /** Registry-estimate default model (adapter default or catalog model id). */
  defaultModelId: string;
  deployment: 'cloud' | 'local' | 'enterprise';
  /** Simple configuration is offered for this preset. */
  simpleModeSupported: boolean;
  /** Honest runtime note (e.g. catalog-only family without an adapter). */
  runtimeNote?: string;
  /** Where the user creates a credential. */
  docsUrl: string;
}

export const PROVIDER_PRESETS: Readonly<Record<ProviderPresetId, ProviderPreset>> = {
  google: {
    presetId: 'google',
    displayName: 'Google Gemini',
    category: 'Cloud AI',
    credentialType: 'server_managed_or_api_key',
    credentialLabel: 'API Key',
    credentialHelp:
      'Create a key at aistudio.google.com/apikey. Your Google sign-in is separate from Gemini API access.',
    defaultEndpoint: 'https://generativelanguage.googleapis.com',
    endpointUserConfigurable: false,
    modelDiscovery: 'rest_list',
    defaultModelId: 'gemini-3.5-flash',
    deployment: 'cloud',
    simpleModeSupported: true,
    docsUrl: 'https://aistudio.google.com/apikey',
  },
  openai: {
    presetId: 'openai',
    displayName: 'OpenAI',
    category: 'Cloud AI',
    credentialType: 'api_key',
    credentialLabel: 'API Key',
    credentialHelp: 'Create a key at platform.openai.com/api-keys.',
    defaultEndpoint: 'https://api.openai.com/v1',
    endpointUserConfigurable: false,
    modelDiscovery: 'rest_list',
    defaultModelId: 'gpt-4o-mini',
    deployment: 'cloud',
    simpleModeSupported: true,
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    presetId: 'anthropic',
    displayName: 'Anthropic (Claude)',
    category: 'Cloud AI',
    credentialType: 'api_key',
    credentialLabel: 'API Key',
    credentialHelp: 'Create a key at console.anthropic.com.',
    defaultEndpoint: 'https://api.anthropic.com',
    endpointUserConfigurable: false,
    modelDiscovery: 'rest_list',
    defaultModelId: 'claude-sonnet-4',
    deployment: 'cloud',
    simpleModeSupported: true,
    runtimeNote:
      'The connection can be verified here, but this VedMoulya build has no Anthropic execution adapter — the provider stays catalog-only until one ships.',
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  deepseek: {
    presetId: 'deepseek',
    displayName: 'DeepSeek',
    category: 'Cloud AI',
    credentialType: 'api_key',
    credentialLabel: 'API Key',
    credentialHelp: 'Create a key at platform.deepseek.com.',
    defaultEndpoint: 'https://api.deepseek.com',
    endpointUserConfigurable: false,
    modelDiscovery: 'rest_list',
    defaultModelId: 'deepseek-chat',
    deployment: 'cloud',
    simpleModeSupported: true,
    docsUrl: 'https://platform.deepseek.com/api_keys',
  },
  ollama: {
    presetId: 'ollama',
    displayName: 'Ollama (Local)',
    category: 'Local AI',
    credentialType: 'none_local',
    credentialLabel: 'Server URL',
    credentialHelp: 'Point VedMoulya at your running Ollama server — no API key required.',
    defaultEndpoint: 'http://localhost:11434',
    endpointUserConfigurable: true,
    modelDiscovery: 'local_tags',
    defaultModelId: 'llama3.2',
    deployment: 'local',
    simpleModeSupported: true,
    docsUrl: 'https://ollama.com',
  },
  custom: {
    presetId: 'custom',
    displayName: 'Custom / OpenAI-compatible',
    category: 'Enterprise AI',
    credentialType: 'api_key',
    credentialLabel: 'API Key',
    credentialHelp: 'Any OpenAI-compatible endpoint with an API key.',
    defaultEndpoint: '',
    endpointUserConfigurable: true,
    modelDiscovery: 'rest_list',
    defaultModelId: '',
    deployment: 'cloud',
    simpleModeSupported: false,
    docsUrl: 'https://platform.openai.com/docs/api-reference',
  },
};

/** Presets that offer Simple configuration (custom stays advanced-only). */
export const SIMPLE_PROVIDER_PRESET_IDS: readonly ProviderPresetId[] = [
  'google',
  'openai',
  'anthropic',
  'deepseek',
  'ollama',
];

/** Safe lookup — never undefined (returns a fallback carrying the id). */
export function providerPreset(id: string): ProviderPreset {
  const preset = (PROVIDER_PRESETS as Record<string, ProviderPreset | undefined>)[id];
  if (preset) return preset;
  return {
    presetId: 'custom',
    displayName: id === '' ? 'Custom provider' : `Custom provider (${id})`,
    category: 'Enterprise AI',
    credentialType: 'api_key',
    credentialLabel: 'API Key',
    credentialHelp: 'This provider uses a custom endpoint and API key.',
    defaultEndpoint: '',
    endpointUserConfigurable: true,
    modelDiscovery: 'rest_list',
    defaultModelId: '',
    deployment: 'cloud',
    simpleModeSupported: false,
    docsUrl: 'https://platform.openai.com/docs/api-reference',
  };
}

/** True when the family offers Simple configuration. */
export function isSimpleProviderPreset(id: string): boolean {
  return (SIMPLE_PROVIDER_PRESET_IDS as readonly string[]).includes(id);
}
