// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Production AI Configuration Validation Tests
// AI-RUNTIME-002 C-07 — production must fail fast on missing mandatory AI
// configuration; development/test may use safe deterministic doubles; the
// mock is NEVER silently used in production.
// ─────────────────────────────────────────────────────────────────────────────

import { afterEach, describe, it, expect } from 'vitest';
import {
  readProductionAIConfigState,
  validateProductionAIConfig,
} from '../infrastructure/ProductionAIConfig.js';

const CLEANED_KEYS = [
  'NODE_ENV',
  'AI_DEFAULT_PROVIDER',
  'AI_OPENAI_API_KEY',
  'OPENAI_API_KEY',
  'AI_ANTHROPIC_API_KEY',
  'AI_GOOGLE_API_KEY',
  'AI_DEEPSEEK_API_KEY',
  'AI_ENABLE_MOCK',
  'AI_RUNTIME_LEGACY_RAW_FETCH',
  'IDENTITY_DATABASE_URL',
  'DATABASE_URL',
  'AI_MAX_INPUT_TOKENS',
  'AI_MAX_OUTPUT_TOKENS',
  'AI_PROVIDER_TIMEOUT_MS',
  'OTEL_EXPORTER_OTLP_ENDPOINT',
  'AI_TOOL_ALLOWLIST',
  'AI_PROMPT_CACHE_ENABLED',
];

function cleanEnv(): void {
  for (const key of CLEANED_KEYS) {
    delete process.env[key];
  }
}

describe('validateProductionAIConfig (C-07)', () => {
  afterEach(() => {
    cleanEnv();
  });

  it('never validates strictly outside production/staging (dev may use doubles)', () => {
    cleanEnv();
    process.env.NODE_ENV = 'development';
    const result = validateProductionAIConfig();
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails fast in production when the AI provider key and mock are both absent', () => {
    cleanEnv();
    process.env.NODE_ENV = 'production';
    process.env.IDENTITY_DATABASE_URL = 'postgres://db:5432/vedmoulya';
    process.env.AI_TOOL_ALLOWLIST = 'echo,calculator';
    expect(() => validateProductionAIConfig()).toThrow(
      /A real AI provider key is required in production.*AI_OPENAI_API_KEY.*or AI_DEEPSEEK_API_KEY/i,
    );
  });

  it('accepts a DeepSeek key as the real production AI provider', () => {
    cleanEnv();
    process.env.NODE_ENV = 'production';
    process.env.AI_DEEPSEEK_API_KEY = 'sk-ds-abcdefghijklmnopqrstuvwxyz123456';
    process.env.IDENTITY_DATABASE_URL = 'postgres://db:5432/vedmoulya';
    process.env.AI_MAX_INPUT_TOKENS = '8000';
    process.env.AI_MAX_OUTPUT_TOKENS = '2048';
    process.env.AI_PROVIDER_TIMEOUT_MS = '60000';
    process.env.AI_TOOL_ALLOWLIST = 'echo,current_time,calculator';
    const state = readProductionAIConfigState();
    expect(state.deepSeekKeyPresent).toBe(true);
    const result = validateProductionAIConfig();
    expect(result.ok).toBe(true);
  });

  it('accepts OpenAI and DeepSeek keys together (default deepseek + openai fallback)', () => {
    cleanEnv();
    process.env.NODE_ENV = 'production';
    process.env.AI_DEEPSEEK_API_KEY = 'sk-ds-abcdefghijklmnopqrstuvwxyz123456';
    process.env.AI_OPENAI_API_KEY = 'sk-abcdefghijklmnopqrstuvwxyz123456';
    process.env.IDENTITY_DATABASE_URL = 'postgres://db:5432/vedmoulya';
    process.env.AI_MAX_INPUT_TOKENS = '8000';
    process.env.AI_MAX_OUTPUT_TOKENS = '2048';
    process.env.AI_PROVIDER_TIMEOUT_MS = '60000';
    process.env.AI_TOOL_ALLOWLIST = 'echo,current_time,calculator';
    const state = readProductionAIConfigState();
    expect(state.openAiKeyPresent).toBe(true);
    expect(state.deepSeekKeyPresent).toBe(true);
    const result = validateProductionAIConfig();
    expect(result.ok).toBe(true);
  });

  it('accepts an explicit mock opt-in in production (AI_ENABLE_MOCK=true)', () => {
    cleanEnv();
    process.env.NODE_ENV = 'production';
    process.env.AI_ENABLE_MOCK = 'true';
    process.env.IDENTITY_DATABASE_URL = 'postgres://db:5432/vedmoulya';
    process.env.AI_TOOL_ALLOWLIST = 'echo,calculator';
    process.env.AI_MAX_INPUT_TOKENS = '8000';
    process.env.AI_MAX_OUTPUT_TOKENS = '2048';
    process.env.AI_PROVIDER_TIMEOUT_MS = '60000';
    const result = validateProductionAIConfig();
    expect(result.ok).toBe(true);
  });

  it('fails fast when the RAG database URL is missing in production', () => {
    cleanEnv();
    process.env.NODE_ENV = 'production';
    process.env.AI_OPENAI_API_KEY = 'sk-abcdefghijklmnopqrstuvwxyz123456';
    process.env.AI_TOOL_ALLOWLIST = 'echo,calculator';
    expect(() => validateProductionAIConfig()).toThrow(
      /IDENTITY_DATABASE_URL.*required in production/i,
    );
  });

  it('fails fast when the tool allowlist is not explicitly configured in production', () => {
    cleanEnv();
    process.env.NODE_ENV = 'production';
    process.env.AI_OPENAI_API_KEY = 'sk-abcdefghijklmnopqrstuvwxyz123456';
    process.env.IDENTITY_DATABASE_URL = 'postgres://db:5432/vedmoulya';
    expect(() => validateProductionAIConfig()).toThrow(/AI_TOOL_ALLOWLIST/);
  });

  it('reports the full configuration state snapshot', () => {
    cleanEnv();
    process.env.NODE_ENV = 'production';
    process.env.AI_OPENAI_API_KEY = 'sk-abcdefghijklmnopqrstuvwxyz123456';
    process.env.IDENTITY_DATABASE_URL = 'postgres://db:5432/vedmoulya';
    process.env.AI_MAX_INPUT_TOKENS = '8000';
    process.env.AI_PROVIDER_TIMEOUT_MS = '60000';
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://otel:4318';
    process.env.AI_TOOL_ALLOWLIST = 'echo';
    const state = readProductionAIConfigState();
    expect(state.strict).toBe(true);
    expect(state.openAiKeyPresent).toBe(true);
    expect(state.ragDatabaseUrlPresent).toBe(true);
    expect(state.maxInputTokensConfigured).toBe(true);
    expect(state.providerTimeoutMsConfigured).toBe(true);
    expect(state.otelEndpointConfigured).toBe(true);
    expect(state.toolAllowlistConfigured).toBe(true);
    expect(state.promptCacheConfigured).toBe(true);
  });

  it('accepts a fully configured production environment', () => {
    cleanEnv();
    process.env.NODE_ENV = 'production';
    process.env.AI_OPENAI_API_KEY = 'sk-abcdefghijklmnopqrstuvwxyz123456';
    process.env.IDENTITY_DATABASE_URL = 'postgres://db:5432/vedmoulya';
    process.env.AI_MAX_INPUT_TOKENS = '8000';
    process.env.AI_MAX_OUTPUT_TOKENS = '2048';
    process.env.AI_PROVIDER_TIMEOUT_MS = '60000';
    process.env.AI_TOOL_ALLOWLIST = 'echo,current_time,calculator';
    const result = validateProductionAIConfig();
    expect(result.ok).toBe(true);
  });
});
describe('validateProductionAIConfig — EPIC-019 provider truth', () => {
  afterEach(() => {
    cleanEnv();
  });

  function fullProdEnv(): void {
    process.env.NODE_ENV = 'production';
    process.env.IDENTITY_DATABASE_URL = 'postgres://db:5432/vedmoulya';
    process.env.AI_MAX_INPUT_TOKENS = '8000';
    process.env.AI_MAX_OUTPUT_TOKENS = '2048';
    process.env.AI_PROVIDER_TIMEOUT_MS = '60000';
    process.env.AI_TOOL_ALLOWLIST = 'echo,current_time,calculator';
  }

  it('fails fast when AI_DEFAULT_PROVIDER is a catalog-only family (no adapter)', () => {
    cleanEnv();
    fullProdEnv();
    process.env.AI_DEFAULT_PROVIDER = 'anthropic';
    process.env.AI_ANTHROPIC_API_KEY = 'sk-ant-abcdefghijklmnopqrstuvwxyz1234567890';
    expect(() => validateProductionAIConfig()).toThrow(
      /AI_DEFAULT_PROVIDER.*not available at runtime/i,
    );
  });

  it('fails fast when AI_DEFAULT_PROVIDER=mock (production never silently serves mock)', () => {
    cleanEnv();
    fullProdEnv();
    process.env.AI_DEFAULT_PROVIDER = 'mock';
    process.env.AI_ENABLE_MOCK = 'true';
    expect(() => validateProductionAIConfig()).toThrow(/AI_DEFAULT_PROVIDER/);
  });

  it('an Anthropic key alone does not satisfy the production AI gate', () => {
    cleanEnv();
    fullProdEnv();
    process.env.AI_ANTHROPIC_API_KEY = 'sk-ant-abcdefghijklmnopqrstuvwxyz1234567890';
    expect(() => validateProductionAIConfig()).toThrow(
      /A real AI provider key is required in production/i,
    );
  });

  it('accepts AI_DEFAULT_PROVIDER=deepseek with a configured DeepSeek key', () => {
    cleanEnv();
    fullProdEnv();
    process.env.AI_DEFAULT_PROVIDER = 'deepseek';
    process.env.AI_DEEPSEEK_API_KEY = 'sk-ds-abcdefghijklmnopqrstuvwxyz123456789';
    const state = readProductionAIConfigState();
    expect(state.defaultProvider).toBe('deepseek');
    expect(state.defaultProviderSupported).toBe(true);
    expect(state.deepSeekKeyPresent).toBe(true);
    const result = validateProductionAIConfig();
    expect(result.ok).toBe(true);
  });

  it('the state snapshot reports the runtime-truthful default provider support', () => {
    cleanEnv();
    fullProdEnv();
    process.env.AI_OPENAI_API_KEY = 'sk-abcdefghijklmnopqrstuvwxyz123456789';
    const state = readProductionAIConfigState();
    expect(state.defaultProvider).toBe('openai');
    expect(state.defaultProviderSupported).toBe(true);
    expect(state.openAiKeyPresent).toBe(true);
    expect(state.strict).toBe(true);
  });
});
