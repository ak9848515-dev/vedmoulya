// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Orchestrator entry point tests
// Covers createOrchestrator bootstrap: service creation + mock provider
// registration (the only logic in src/index.ts).
// ARC-005 — AI Orchestration
// ─────────────────────────────────────────────────────────────────────────────

import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  createOrchestrator,
  createOpenAIEmbeddingProvider,
  MockProvider,
  OpenAIProvider,
  VercelAIProvider,
  DeepSeekProvider,
  registerPlatformProviders,
} from '../index.js';
import { AIMetrics } from '../observability/AIMetrics.js';
import { AIOrchestrationService } from '@vedmoulya/services';
import { readProviderRuntimeState } from '@vedmoulya/core';

describe('createOrchestrator', () => {
  it('returns an AIOrchestrationService instance', () => {
    const orchestrator = createOrchestrator();

    expect(orchestrator).toBeInstanceOf(AIOrchestrationService);
  });

  it('registers the MockProvider for development/testing', () => {
    const orchestrator = createOrchestrator();

    const provider = orchestrator.getProvider('mock');

    expect(provider).toBeInstanceOf(MockProvider);
    expect(provider?.name).toBe('mock');
  });

  it('reports the mock provider as registered via listProviders', () => {
    const orchestrator = createOrchestrator();

    const providers = orchestrator.listProviders();

    expect(providers.providers.some((p) => p.id === 'mock')).toBe(true);
    // At least the mock provider; an ambient OPENAI_API_KEY may add openai.
    expect(providers.total).toBeGreaterThanOrEqual(1);
  });

  // Note: createOrchestrator(_config) currently accepts but intentionally
  // ignores its config parameter (no business-logic change in PR-001); these
  // tests pin the accepted-but-unused behavior for backward compatibility.
  it('accepts a partial config without throwing', () => {
    const orchestrator = createOrchestrator({
      providers: { enableMock: true },
    });

    expect(orchestrator).toBeInstanceOf(AIOrchestrationService);
    expect(orchestrator.getProvider('mock')).toBeDefined();
  });

  it('still registers mock when a real-provider config is supplied', () => {
    const orchestrator = createOrchestrator({
      providers: {
        openai: { apiKey: 'sk-test' },
        enableMock: true,
      },
    });

    expect(orchestrator.getProvider('mock')).toBeInstanceOf(MockProvider);
  });

  it('creates an OpenAI embedding provider only when an API key is configured', () => {
    const OLD_KEY = process.env.OPENAI_API_KEY;
    try {
      delete process.env.OPENAI_API_KEY;
      expect(createOpenAIEmbeddingProvider()).toBeUndefined();

      process.env.OPENAI_API_KEY = 'sk-embed';
      const provider = createOpenAIEmbeddingProvider();
      expect(provider).toBeDefined();
      expect(provider?.model).toContain('text-embedding');
    } finally {
      if (OLD_KEY === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = OLD_KEY;
    }
  });

  it('re-exports AIMetrics from the observability seam', () => {
    // The observability module is a thin re-export of @vedmoulya/services;
    // pin the symbol so the seam cannot silently drift.
    expect(AIMetrics).toBeDefined();
  });
});

describe('registerPlatformProviders', () => {
  const OLD_ENV = process.env.OPENAI_API_KEY;
  const OLD_DEEPSEEK_ENV = process.env.AI_DEEPSEEK_API_KEY;

  afterEach(() => {
    vi.unstubAllGlobals();
    if (OLD_ENV === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = OLD_ENV;
    }
    if (OLD_DEEPSEEK_ENV === undefined) {
      delete process.env.AI_DEEPSEEK_API_KEY;
    } else {
      process.env.AI_DEEPSEEK_API_KEY = OLD_DEEPSEEK_ENV;
    }
    delete process.env.AI_RUNTIME_LEGACY_RAW_FETCH;
  });

  it('registers mock and no real provider when no config keys and no env key', () => {
    delete process.env.OPENAI_API_KEY;
    const orchestrator = createOrchestrator();
    registerPlatformProviders(orchestrator, { providers: { enableMock: true } });
    expect(orchestrator.getProvider('mock')).toBeInstanceOf(MockProvider);
    expect(orchestrator.getProvider('openai')).toBeUndefined();
  });

  it('registers the Vercel AI SDK provider as the primary path when config supplies an api key (AI-RUNTIME-002)', () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_RUNTIME_LEGACY_RAW_FETCH;
    const orchestrator = createOrchestrator();
    registerPlatformProviders(orchestrator, {
      providers: { openai: { apiKey: 'sk-config' }, enableMock: true },
    });
    expect(orchestrator.getProvider('openai')).toBeInstanceOf(VercelAIProvider);
  });

  it('falls back to the OPENAI_API_KEY env var when config omits the key', () => {
    process.env.OPENAI_API_KEY = 'sk-env';
    delete process.env.AI_RUNTIME_LEGACY_RAW_FETCH;
    const orchestrator = createOrchestrator();
    registerPlatformProviders(orchestrator, { providers: { enableMock: true } });
    expect(orchestrator.getProvider('openai')).toBeInstanceOf(VercelAIProvider);
  });

  it('registers the raw-fetch OpenAIProvider only when explicitly opted in via AI_RUNTIME_LEGACY_RAW_FETCH=true', () => {
    delete process.env.OPENAI_API_KEY;
    process.env.AI_RUNTIME_LEGACY_RAW_FETCH = 'true';
    const orchestrator = createOrchestrator();
    registerPlatformProviders(orchestrator, {
      providers: { openai: { apiKey: 'sk-legacy' }, enableMock: true },
    });
    expect(orchestrator.getProvider('openai')).toBeInstanceOf(OpenAIProvider);
  });

  it('registers the DeepSeek SDK provider when a config api key is supplied', () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_DEEPSEEK_API_KEY;
    const orchestrator = createOrchestrator();
    registerPlatformProviders(orchestrator, {
      providers: { deepseek: { apiKey: 'sk-ds-config' }, enableMock: true },
    });
    expect(orchestrator.getProvider('deepseek')).toBeInstanceOf(DeepSeekProvider);
  });

  it('registers DeepSeek from the AI_DEEPSEEK_API_KEY env var when config omits the key', () => {
    delete process.env.OPENAI_API_KEY;
    process.env.AI_DEEPSEEK_API_KEY = 'sk-ds-env';
    const orchestrator = createOrchestrator();
    registerPlatformProviders(orchestrator, { providers: { enableMock: true } });
    expect(orchestrator.getProvider('deepseek')).toBeInstanceOf(DeepSeekProvider);
  });

  it('registers both OpenAI and DeepSeek when both keys are present (AI_DEFAULT_PROVIDER=deepseek with OpenAI fallback)', () => {
    process.env.AI_DEEPSEEK_API_KEY = 'sk-ds-both';
    delete process.env.AI_RUNTIME_LEGACY_RAW_FETCH;
    const orchestrator = createOrchestrator();
    registerPlatformProviders(orchestrator, {
      providers: { openai: { apiKey: 'sk-openai-both' }, enableMock: true },
    });
    expect(orchestrator.getProvider('openai')).toBeInstanceOf(VercelAIProvider);
    expect(orchestrator.getProvider('deepseek')).toBeInstanceOf(DeepSeekProvider);
  });

  it('does not register DeepSeek when no key is configured', () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_DEEPSEEK_API_KEY;
    const orchestrator = createOrchestrator();
    registerPlatformProviders(orchestrator, { providers: { enableMock: true } });
    expect(orchestrator.getProvider('deepseek')).toBeUndefined();
  });

  it('registers only mock when no config is provided', () => {
    delete process.env.OPENAI_API_KEY;
    const orchestrator = createOrchestrator();
    registerPlatformProviders(orchestrator);
    expect(orchestrator.getProvider('mock')).toBeInstanceOf(MockProvider);
    expect(orchestrator.getProvider('openai')).toBeUndefined();
  });

  it('the runtime registry (core) agrees with actual adapter registration (EPIC-019 contract)', () => {
    const OLD_NODE_ENV = process.env.NODE_ENV;
    const OLD_AI_ENABLE_MOCK = process.env.AI_ENABLE_MOCK;
    const OLD_AI_OPENAI = process.env.AI_OPENAI_API_KEY;
    try {
      delete process.env.OPENAI_API_KEY;
      delete process.env.AI_DEEPSEEK_API_KEY;
      process.env.AI_OPENAI_API_KEY = 'sk-openai-abcdefghijklmnopqrstuvwxyz123456789';
      process.env.NODE_ENV = 'development';
      delete process.env.AI_ENABLE_MOCK;

      const states = readProviderRuntimeState(process.env, 'development');
      const expected = states
        .filter((s) => s.registered)
        .map((s) => s.family)
        .sort();

      const orchestrator = createOrchestrator();
      registerPlatformProviders(orchestrator);
      const actual = orchestrator
        .listProviders()
        .providers.map((p) => p.id)
        .sort();

      expect(actual).toEqual(expected);
      // Anthropic/Google are catalog-only — they must never be registered.
      expect(actual).not.toContain('anthropic');
      expect(actual).not.toContain('google');
    } finally {
      if (OLD_NODE_ENV === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = OLD_NODE_ENV;
      if (OLD_AI_ENABLE_MOCK === undefined) delete process.env.AI_ENABLE_MOCK;
      else process.env.AI_ENABLE_MOCK = OLD_AI_ENABLE_MOCK;
      if (OLD_AI_OPENAI === undefined) delete process.env.AI_OPENAI_API_KEY;
      else process.env.AI_OPENAI_API_KEY = OLD_AI_OPENAI;
    }
  });
  it('does not register mock in production unless explicitly enabled (AI-RUNTIME-001)', () => {
    const OLD_NODE_ENV = process.env.NODE_ENV;
    const OLD_AI_ENABLE_MOCK = process.env.AI_ENABLE_MOCK;
    delete process.env.OPENAI_API_KEY;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.AI_ENABLE_MOCK;
      const orchestrator = createOrchestrator();
      expect(orchestrator.getProvider('mock')).toBeUndefined();
      expect(orchestrator.listProviders().total).toBe(0);

      // Explicit opt-in restores the mock provider.
      process.env.AI_ENABLE_MOCK = 'true';
      const optedIn = createOrchestrator();
      expect(optedIn.getProvider('mock')).toBeInstanceOf(MockProvider);
    } finally {
      if (OLD_NODE_ENV === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = OLD_NODE_ENV;
      if (OLD_AI_ENABLE_MOCK === undefined) delete process.env.AI_ENABLE_MOCK;
      else process.env.AI_ENABLE_MOCK = OLD_AI_ENABLE_MOCK;
    }
  });
});
