// ──────────────────────────────────────────────────────────────────
// VedMoulya — CapabilityGraph tests
// EPIC-013 — deterministic keyword detection maps a free-text outcome
// to the capabilities it requires. Every detection is annotated with
// the keywords that matched (provenance, never magic).
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { CapabilityGraph } from '../domain/CapabilityGraph.js';

const graph = new CapabilityGraph();

describe('CapabilityGraph — keyword detection', () => {
  it('detects capabilities from a free-text outcome', () => {
    const detected = graph.detect('Create a blog post about AI and transcribe this podcast');
    const ids = detected.map((d) => d.capability);
    expect(ids).toContain('TEXT_GENERATION');
    expect(ids).toContain('SPEECH_TO_TEXT');
  });

  it('records the exact keywords that matched (provenance)', () => {
    const detected = graph.detect('Write a research article');
    const text = detected.find((d) => d.capability === 'TEXT_GENERATION');
    expect(text?.matchedKeywords).toContain('write');
    expect(text?.matchedKeywords).toContain('article');
  });

  it('matches case-insensitively', () => {
    const detected = graph.detect('CREATE A VIDEO WITH A LOGO');
    const ids = detected.map((d) => d.capability);
    expect(ids).toContain('VIDEO_GENERATION');
    expect(ids).toContain('IMAGE_GENERATION');
  });

  it('returns an empty list for unrelated text', () => {
    expect(graph.detect('lets go to the beach')).toEqual([]);
  });

  it('hasCapability is true when a capability is detected', () => {
    expect(graph.hasCapability('Write a script', 'TEXT_GENERATION')).toBe(true);
  });

  it('hasCapability is false when no keyword matches', () => {
    expect(graph.hasCapability('Go for a walk', 'CODING')).toBe(false);
    expect(graph.hasCapability('Write a script', 'CODING')).toBe(false);
  });
});
