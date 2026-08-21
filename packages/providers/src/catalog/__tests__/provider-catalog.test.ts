import { describe, expect, it } from 'vitest';
import { createCatalogProviders, CATALOG_SIZE } from '../provider-catalog.js';
import { PROVIDER_FAMILIES } from '../../domain/rules/ProviderRules.js';

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
