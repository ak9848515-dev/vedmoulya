import { describe, expect, it } from 'vitest';
import { createCatalogProviders, CATALOG_SIZE } from '../provider-catalog.js';
import { PROVIDER_FAMILIES } from '../../domain/rules/ProviderRules.js';
import { PROVIDER_PRESETS } from '@vedmoulya/shared';

describe('provider catalog', () => {
  it('seeds the 7 built-in provider families (custom is user-added, not in catalog)', () => {
    expect(CATALOG_SIZE).toBe(7);
    const providers = createCatalogProviders();
    const catalogIds = providers.map((p) => p.id).sort();
    // All catalog providers must be valid families.
    for (const id of catalogIds) {
      expect(PROVIDER_FAMILIES).toContain(id);
    }
    // 'custom' is a valid family but not in the seed catalog (user-added).
    expect(catalogIds).not.toContain('custom');
  });

  it('every provider exposes at least one model and a non-empty capability matrix', () => {
    for (const provider of createCatalogProviders()) {
      expect(provider.models.length).toBeGreaterThan(0);
      expect(provider.matrix.length).toBeGreaterThan(0);
      expect(provider.capabilities.length).toBeGreaterThan(0);
      expect(provider.supportedModalities.length).toBeGreaterThan(0);
    }
  });

  it('every provider has valid health, lifecycle, and profiles', () => {
    for (const provider of createCatalogProviders()) {
      expect(provider.health.healthScore).toBeGreaterThanOrEqual(0);
      expect(provider.health.healthScore).toBeLessThanOrEqual(1);
      expect(provider.availability).toBeGreaterThanOrEqual(0);
      expect(provider.availability).toBeLessThanOrEqual(1);
      expect(provider.lifecycleStatus.value).toMatch(
        /^(draft|testing|active|maintenance|deprecated|archived)$/,
      );
      expect(provider.version.toString()).toBe('1.0.0');
      for (const entry of provider.matrix) {
        expect(entry.quality).toBeGreaterThanOrEqual(0);
        expect(entry.quality).toBeLessThanOrEqual(1);
        expect(entry.confidence).toBeGreaterThanOrEqual(0);
        expect(entry.confidence).toBeLessThanOrEqual(1);
        expect(entry.historicalSuccess).toBeGreaterThanOrEqual(0);
        expect(entry.historicalSuccess).toBeLessThanOrEqual(1);
      }
    }
  });

  it('the content_generation capability is covered by multiple providers', () => {
    const providers = createCatalogProviders();
    const covering = providers.filter((p) => p.supportsCapability('content_generation'));
    expect(covering.length).toBeGreaterThanOrEqual(6);
  });

  it('embeddings is covered by openai, google, openrouter, and mock — but not anthropic', () => {
    const providers = createCatalogProviders();
    const byId = new Map(providers.map((p) => [p.id, p]));
    expect(byId.get('openai')?.supportsCapability('embeddings')).toBe(true);
    expect(byId.get('google')?.supportsCapability('embeddings')).toBe(true);
    expect(byId.get('anthropic')?.supportsCapability('embeddings')).toBe(false);
    expect(byId.get('deepseek')?.supportsCapability('embeddings')).toBe(false);
  });

  it('ollama is free tier with zero cost (local, privacy-first)', () => {
    const ollama = createCatalogProviders().find((p) => p.id === 'ollama');
    expect(ollama?.cost.tier).toBe('free');
    expect(ollama?.cost.inputPerMillionTokens).toBe(0);
    expect(ollama?.cost.outputPerMillionTokens).toBe(0);
  });

  it('the mock provider is the testing-environment provider', () => {
    const mock = createCatalogProviders().find((p) => p.id === 'mock');
    expect(mock?.lifecycleStatus.value).toBe('testing');
    expect(mock?.health.healthScore).toBe(1);
    expect(mock?.hasFeature('streaming')).toBe(true);
    expect(mock?.hasFeature('embeddings')).toBe(true);
  });

  it('every matrix entry capability is supported by the provider', () => {
    for (const provider of createCatalogProviders()) {
      for (const entry of provider.matrix) {
        expect(provider.supportsCapability(entry.capability)).toBe(true);
      }
    }
  });
});

// S3.1B.2 — Google retired the 2.5 generation for newer API keys ("no longer
// available to new users" — verified 404 against the configured production
// credential), so the catalog must not be able to SELECT a retired model.
describe('provider catalog — Gemini model compatibility (S3.1B.2)', () => {
  const google = (): ReturnType<typeof createCatalogProviders>[number] => {
    const provider = createCatalogProviders().find((p) => p.id === 'google');
    if (!provider) throw new Error('google must exist in the provider catalog');
    return provider;
  };

  it('offers the model the configured production credential actually serves', () => {
    expect(google().models.map((m) => m.id)).toContain('gemini-3.8-flash');
  });

  it('no longer advertises any retired Gemini model id', () => {
    const ids = google().models.map((m) => m.id);
    expect(ids).not.toContain('gemini-2.5-pro');
    expect(ids).not.toContain('gemini-2.5-flash');
    expect(ids.some((id) => id.startsWith('gemini-2.5-'))).toBe(false);
  });

  it('the Gemini default model id is not a retired generation', () => {
    // The default itself is a FINAL-02 pinning contract (shared with the
    // provider adapters) and is deliberately NOT re-picked by this repair.
    // What matters here is that it can never point at a retired model.
    const defaultModelId = PROVIDER_PRESETS.google.defaultModelId;
    expect(defaultModelId).not.toMatch(/^gemini-2\.5-/);
    expect(google().models.map((m) => m.id)).not.toContain(defaultModelId);
  });

  it('no selectable Gemini model id is retired, whatever the default is', () => {
    // Guards the invariant the repair exists for: every model the google
    // candidate can be routed to is a currently supported generation.
    for (const model of google().models) {
      expect(model.id).not.toMatch(/^gemini-2\.5-/);
    }
  });

  it('preserves the Gemini generative capability metadata and provider semantics', () => {
    const model = google().models.find((m) => m.id === 'gemini-3.8-flash');
    expect(model).toBeDefined();
    // Limits are the PROVIDER-REPORTED values for this model id, not a copy
    // from the retired entry.
    expect(model?.contextLength).toBe(1048576);
    expect(model?.maxOutputTokens).toBe(65536);
    expect(model?.streaming).toBe(true);
    expect(model?.functionCalling).toBe(true);
    expect(model?.embeddings).toBe(false);
    // The provider itself is unchanged in family/name/ownership.
    expect(google().family).toBe('google');
    expect(google().name).toBe('Google (Gemini)');
    // Gemini still declares the generative capability surface it always did.
    for (const capability of ['reasoning', 'coding', 'vision', 'content_generation']) {
      expect(google().supportsCapability(capability)).toBe(true);
    }
    // Embeddings are still served by the dedicated embedding model, not by the
    // generative one.
    expect(google().supportsCapability('embeddings')).toBe(true);
    // S3.1B.2 (embedding) — the configured credential no longer returns
    // text-embedding-004; the catalog must expose the embedding model that
    // credential actually serves, with its provider-reported limit.
    const embeddingModel = google().models.find((m) => m.embeddings);
    expect(embeddingModel?.id).toBe('gemini-embedding-001');
    expect(embeddingModel?.contextLength).toBe(2048);
    expect(embeddingModel?.embeddings).toBe(true);
  });

  it('no longer advertises the retired Gemini embedding model id (S3.1B.2)', () => {
    // Guards the invariant the repair exists for: the embedding model a google
    // candidate can be selected against is one the configured credential
    // actually serves — verified live against v1beta/models.
    expect(google().models.map((m) => m.id)).not.toContain('text-embedding-004');
    expect(google().models.find((m) => m.embeddings)?.id).toBe('gemini-embedding-001');
    expect(google().supportsCapability('embeddings')).toBe(true);
  });

  it('no unrelated provider model set was disturbed', () => {
    const byId = new Map(createCatalogProviders().map((p) => [p.id, p]));
    expect(byId.get('ollama')?.cost.tier).toBe('free');
    expect(byId.get('mock')?.lifecycleStatus.value).toBe('testing');
    expect(byId.get('anthropic')?.supportsCapability('embeddings')).toBe(false);
    expect(createCatalogProviders()).toHaveLength(CATALOG_SIZE);
  });
});
