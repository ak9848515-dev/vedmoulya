// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI Provider Runtime Registry Tests (EPIC-019)
// The configuration layer must agree with the actual runtime registry:
// catalog ≠ adapter ≠ execution. No claim is made for a family just because it
// exists in the taxonomy.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  PROVIDER_RUNTIME_DESCRIPTORS,
  readProviderRuntimeState,
  runtimeExecutionReady,
  validateDefaultProvider,
} from '../provider-runtime.js';
import type { ProviderRuntimeMode } from '../provider-runtime.js';

const JWT = 'x'.repeat(48);
const OPENAI_KEY = 'sk-prod-abcdefghijklmnopqrstuvwxyz123456789';
const DEEPSEEK_KEY = 'sk-ds-abcdefghijklmnopqrstuvwxyz123456789';

function stateByFamily(
  env: Record<string, string | undefined>,
  mode: ProviderRuntimeMode,
  family: string,
) {
  const states = readProviderRuntimeState(env, mode);
  const state = states.find((s) => s.family === family);
  if (!state) throw new Error(`missing family ${family}`);
  return state;
}

describe('AI provider runtime registry — dev mode without credentials', () => {
  const env = { AUTH_JWT_SECRET: JWT, NODE_ENV: 'development' };

  it('catalog families without an adapter report UNSUPPORTED_RUNTIME (never AVAILABLE)', () => {
    for (const family of ['anthropic', 'openrouter', 'ollama']) {
      const state = stateByFamily(env, 'development', family);
      expect(state.status).toBe('UNSUPPORTED_RUNTIME');
      expect(state.adapterImplemented).toBe(false);
      expect(state.registered).toBe(false);
      expect(state.canExecute).toBe(false);
    }
  });

  it('Google has an adapter but no key → NOT_CONFIGURED (not UNSUPPORTED_RUNTIME)', () => {
    const state = stateByFamily(env, 'development', 'google');
    expect(state.status).toBe('NOT_CONFIGURED');
    expect(state.adapterImplemented).toBe(true);
    expect(state.registered).toBe(false);
    expect(state.canExecute).toBe(true);
  });

  it('openai/deepseek/google without keys report NOT_CONFIGURED (adapter exists, dormant)', () => {
    expect(stateByFamily(env, 'development', 'openai').status).toBe('NOT_CONFIGURED');
    expect(stateByFamily(env, 'development', 'deepseek').status).toBe('NOT_CONFIGURED');
    expect(stateByFamily(env, 'development', 'google').status).toBe('NOT_CONFIGURED');
  });

  it('mock is active in development (registered, executable, free)', () => {
    const mock = stateByFamily(env, 'development', 'mock');
    expect(mock.status).toBe('MOCK');
    expect(mock.registered).toBe(true);
    expect(mock.canExecute).toBe(true);
    expect(mock.freeTier).toBe(true);
  });

  it('development is AI-executable through the deterministic mock (no keys needed)', () => {
    const result = runtimeExecutionReady(env, 'development');
    expect(result.ok).toBe(true);
    expect(result.providers).toEqual(['mock']);
  });
});

describe('AI provider runtime registry — configured providers', () => {
  const envWithOpenAi = { AUTH_JWT_SECRET: JWT, AI_OPENAI_API_KEY: OPENAI_KEY };
  const envWithDeepSeek = { AUTH_JWT_SECRET: JWT, AI_DEEPSEEK_API_KEY: DEEPSEEK_KEY };

  it('configured OpenAI → CONFIGURED + registered + executable (dev and prod)', () => {
    for (const mode of ['development', 'production'] as const) {
      const state = stateByFamily(envWithOpenAi, mode, 'openai');
      expect(state.status).toBe('CONFIGURED');
      expect(state.registered).toBe(true);
      expect(state.canExecute).toBe(true);
    }
    const result = runtimeExecutionReady(envWithOpenAi, 'production');
    expect(result.ok).toBe(true);
    expect(result.providers).toContain('openai');
  });

  it('configured DeepSeek → CONFIGURED + registered (the adapter is implemented)', () => {
    const state = stateByFamily(envWithDeepSeek, 'production', 'deepseek');
    expect(state.status).toBe('CONFIGURED');
    expect(state.registered).toBe(true);
    const result = runtimeExecutionReady(envWithDeepSeek, 'production');
    expect(result.ok).toBe(true);
    expect(result.providers).toContain('deepseek');
  });

  it('configured Google Gemini → CONFIGURED + registered (SPRINT-049)', () => {
    const GOOGLE_KEY = 'AIzaSy-test-abcdefghijklmnopqrstuvwxyz1234';
    const envWithGoogle = { AUTH_JWT_SECRET: JWT, AI_GOOGLE_API_KEY: GOOGLE_KEY };
    const state = stateByFamily(envWithGoogle, 'production', 'google');
    expect(state.status).toBe('CONFIGURED');
    expect(state.registered).toBe(true);
    expect(state.canExecute).toBe(true);
    const result = runtimeExecutionReady(envWithGoogle, 'production');
    expect(result.ok).toBe(true);
    expect(result.providers).toContain('google');
  });

  it('google is a valid AI_DEFAULT_PROVIDER when configured (SPRINT-049)', () => {
    const GOOGLE_KEY = 'AIzaSy-test-abcdefghijklmnopqrstuvwxyz1234';
    const result = validateDefaultProvider(
      { ...envWithDeepSeek, AI_DEFAULT_PROVIDER: 'google', AI_GOOGLE_API_KEY: GOOGLE_KEY },
      'production',
    );
    expect(result.ok).toBe(true);
    expect(result.family).toBe('google');
  });

  it('deepseek is a valid AI_DEFAULT_PROVIDER (runtime-supported)', () => {
    const result = validateDefaultProvider(
      { ...envWithDeepSeek, AI_DEFAULT_PROVIDER: 'deepseek' },
      'production',
    );
    expect(result.ok).toBe(true);
    expect(result.family).toBe('deepseek');
  });

  it('placeholder-length keys are flagged ERROR, not CONFIGURED', () => {
    const env = { AUTH_JWT_SECRET: JWT, AI_OPENAI_API_KEY: 'sk-short' };
    expect(stateByFamily(env, 'development', 'openai').status).toBe('ERROR');
    expect(stateByFamily(env, 'development', 'openai').registered).toBe(false);
  });
});
describe('AI provider runtime registry — unsupported providers', () => {
  it('an anthropic key never satisfies production AI (no adapter)', () => {
    const env = { AUTH_JWT_SECRET: JWT, AI_ANTHROPIC_API_KEY: OPENAI_KEY };
    const state = stateByFamily(env, 'production', 'anthropic');
    expect(state.status).toBe('UNSUPPORTED_RUNTIME');
    const result = runtimeExecutionReady(env, 'production');
    expect(result.ok).toBe(false);
    expect(result.providers).toEqual([]);
  });

  it('AI_DEFAULT_PROVIDER=anthropic is rejected in production', () => {
    const env = {
      AUTH_JWT_SECRET: JWT,
      AI_DEFAULT_PROVIDER: 'anthropic',
      AI_ANTHROPIC_API_KEY: OPENAI_KEY,
    };
    const result = validateDefaultProvider(env, 'production');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/catalog/i);
  });

  it('a Google key with adapter → CONFIGURED (not UNSUPPORTED_RUNTIME)', () => {
    const GOOGLE_KEY = 'AIzaSy-test-abcdefghijklmnopqrstuvwxyz1234';
    const env = { AUTH_JWT_SECRET: JWT, AI_GOOGLE_API_KEY: GOOGLE_KEY };
    const state = stateByFamily(env, 'production', 'google');
    expect(state.status).toBe('CONFIGURED');
    expect(state.adapterImplemented).toBe(true);
  });

  it('Google without key → NOT_CONFIGURED (adapter exists but dormant)', () => {
    const env = { AUTH_JWT_SECRET: JWT };
    const state = stateByFamily(env, 'production', 'google');
    expect(state.status).toBe('NOT_CONFIGURED');
    expect(state.adapterImplemented).toBe(true);
    expect(state.registered).toBe(false);
  });

  it('AI_DEFAULT_PROVIDER=mock is rejected in production (never silent)', () => {
    const env = { AUTH_JWT_SECRET: JWT, AI_DEFAULT_PROVIDER: 'mock', AI_ENABLE_MOCK: 'true' };
    const result = validateDefaultProvider(env, 'production');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/never silently serves the mock/i);
  });

  it('unknown AI_DEFAULT_PROVIDER values are rejected everywhere', () => {
    const env = { AUTH_JWT_SECRET: JWT, AI_DEFAULT_PROVIDER: 'not-a-provider' };
    const result = validateDefaultProvider(env, 'development');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not a known provider family/i);
  });

  it('unknown families never appear as CONFIGURED/registered', () => {
    const states = readProviderRuntimeState(
      { AUTH_JWT_SECRET: JWT, AI_DEFAULT_PROVIDER: 'nonsense' },
      'development',
    );
    for (const state of states) {
      expect([
        'openai',
        'deepseek',
        'anthropic',
        'google',
        'openrouter',
        'ollama',
        'mock',
      ]).toContain(state.family);
    }
  });
});

describe('AI provider runtime registry — mock', () => {
  it('mock is DISABLED in production without an explicit opt-in', () => {
    const mock = stateByFamily({ AUTH_JWT_SECRET: JWT }, 'production', 'mock');
    expect(mock.status).toBe('DISABLED');
    expect(mock.registered).toBe(false);
  });

  it('AI_ENABLE_MOCK=true is the ONLY production mock activation', () => {
    const env = { AUTH_JWT_SECRET: JWT, AI_ENABLE_MOCK: 'true' };
    const mock = stateByFamily(env, 'production', 'mock');
    expect(mock.status).toBe('MOCK');
    expect(mock.registered).toBe(true);
    const result = runtimeExecutionReady(env, 'production');
    expect(result.ok).toBe(true);
    expect(result.providers).toEqual(['mock']);
  });

  it('disabling the AI feature makes AI non-required', () => {
    const result = runtimeExecutionReady(
      { AUTH_JWT_SECRET: JWT, FF_AI_ASSISTANT_ENABLED: 'false' },
      'production',
    );
    expect(result.ok).toBe(true);
    expect(result.reason).toMatch(/AI assistant disabled/i);
  });
});

describe('AI provider runtime registry — descriptor completeness', () => {
  it('every ProviderFamily in @vedmoulya/ai has a runtime descriptor', () => {
    const families: readonly string[] = [
      'openai',
      'anthropic',
      'google',
      'deepseek',
      'openrouter',
      'ollama',
      'mock',
    ];
    const described = PROVIDER_RUNTIME_DESCRIPTORS.map((d) => d.family);
    for (const family of families) {
      expect(described).toContain(family);
    }
  });

  it('no descriptor leaks secret values', () => {
    const text = JSON.stringify(PROVIDER_RUNTIME_DESCRIPTORS);
    expect(text).not.toMatch(/sk-|AIza|ghp_/i);
  });
});
