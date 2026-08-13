// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Provider Experience Service Capability-Label Tests (EPIC-012A)
//
// Proves the view-model pipes REAL per-model capability data from the registry
// (never hardcoded, never empty for models that declare capabilities):
//   - taxonomy capabilities map to premium display labels
//   - boolean feature flags contribute labels (reasoning/coding/vision/audio/
//     embeddings/tools)
//   - deduplication (image_understanding → Vision + vision flag → Vision once)
//   - bounded list (the dropdown shows a hint, not a spec sheet)
//   - honest empty list when the registry declares no capability data
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { modelCapabilityLabels } from '../services/ProviderExperienceService.js';
import type { ProviderModelDTO } from '@vedmoulya/providers';

function model(overrides: Partial<ProviderModelDTO>): ProviderModelDTO {
  return {
    id: 'm1',
    name: 'Model 1',
    contextLength: 128000,
    maxOutputTokens: 8192,
    streaming: false,
    vision: false,
    functionCalling: false,
    embeddings: false,
    reasoning: false,
    coding: false,
    creativeWriting: false,
    translation: false,
    image: false,
    audio: false,
    video: false,
    modalities: ['text-in', 'text-out'],
    capabilities: [],
    ...overrides,
  };
}

describe('modelCapabilityLabels', () => {
  it('maps declared taxonomy capabilities to premium display labels', () => {
    const labels = modelCapabilityLabels(
      model({ capabilities: ['reasoning', 'coding', 'vision'] }),
    );
    expect(labels).toEqual(['Reasoning', 'Coding', 'Vision']);
  });

  it('contributes labels from boolean feature flags (bounded to 4)', () => {
    const labels = modelCapabilityLabels(
      model({
        reasoning: true,
        coding: true,
        vision: true,
        audio: true,
        embeddings: true,
        functionCalling: true,
      }),
    );
    // The dropdown shows a hint, not a spec sheet: the first four flags win.
    expect(labels.length).toBeLessThanOrEqual(4);
    expect(labels[0]).toBe('Reasoning');
    expect(labels[1]).toBe('Coding');
    expect(labels[2]).toBe('Vision');
    expect(labels[3]).toBe('Audio');
  });

  it('deduplicates synonyms (image_understanding → Vision merged with vision flag)', () => {
    const labels = modelCapabilityLabels(
      model({ capabilities: ['image_understanding'], vision: true }),
    );
    expect(labels.filter((l) => l === 'Vision').length).toBe(1);
  });

  it('maps speech → Audio and general_conversation → Chat', () => {
    const labels = modelCapabilityLabels(
      model({ capabilities: ['speech', 'general_conversation', 'content_generation'] }),
    );
    expect(labels).toContain('Audio');
    expect(labels).toContain('Chat');
    expect(labels).toContain('Generation');
  });

  it('bounds the list to 4 labels (dropdown hint, not a spec sheet)', () => {
    const labels = modelCapabilityLabels(
      model({
        capabilities: [
          'reasoning',
          'coding',
          'vision',
          'embeddings',
          'summarization',
          'classification',
          'translation',
        ],
      }),
    );
    expect(labels.length).toBeLessThanOrEqual(4);
  });

  it('returns an honest empty list when the registry declares no capabilities', () => {
    expect(modelCapabilityLabels(model({ capabilities: [] }))).toEqual([]);
  });
});
