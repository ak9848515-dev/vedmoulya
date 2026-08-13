// ──────────────────────────────────────────────────────────────────
// VedMoulya — CapabilityDecomposer tests
// EPIC-013 §3 — a factory request becomes a capability plan first.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { CapabilityDecomposer } from '../domain/CapabilityDecomposer.js';

const decomposer = new CapabilityDecomposer();

describe('CapabilityDecomposer — capability decomposition', () => {
  it('decomposes a video request into the full video pipeline', () => {
    const result = decomposer.decompose(
      'Create a 60-second educational video about the solar system',
    );
    const titles = result.steps.map((s) => s.title);
    expect(titles).toContain('Research');
    expect(titles).toContain('Script');
    expect(titles).toContain('Fact Check');
    expect(titles).toContain('Storyboard');
    expect(titles).toContain('Visuals');
    expect(titles).toContain('Voice');
    expect(titles).toContain('Music');
    expect(titles).toContain('Assembly');
    expect(titles).toContain('Quality Check');
    expect(titles).toContain('Final Export');
    // Video generation is a required capability.
    expect(result.requiredCapabilities).toContain('VIDEO_GENERATION');
  });

  it('decomposes a coding request into the coding pipeline', () => {
    const result = decomposer.decompose('Build an application that analyzes data');
    const titles = result.steps.map((s) => s.title);
    expect(titles).toEqual([
      'Understand Requirements',
      'Architecture',
      'Implement',
      'Test & Validate',
      'Deploy',
    ]);
    expect(result.requiredCapabilities).toContain('CODING');
  });

  it('falls back to the general pipeline for plain content requests', () => {
    const result = decomposer.decompose('Write a blog post about productivity');
    const titles = result.steps.map((s) => s.title);
    expect(titles).toContain('Create');
    expect(titles).toContain('Quality Check');
  });

  it('records WHY each capability was detected (provenance)', () => {
    const result = decomposer.decompose('Create a 60-second educational video');
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.reasons[0]?.matchedKeywords.length).toBeGreaterThan(0);
  });
});
