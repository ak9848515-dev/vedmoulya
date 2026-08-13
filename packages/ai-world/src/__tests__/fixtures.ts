// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI World test fixtures
// EPIC-012C — deterministic fixtures, no live external services
// ──────────────────────────────────────────────────────────────────

import type { DiscoveryItem, RawDiscoveryItem } from '../types/discovery-types.js';

/** Fixed clock for all deterministic tests. */
export const NOW = new Date('2026-08-10T12:00:00Z');

export function fixedNow(): Date {
  return NOW;
}

/** A raw source item with sensible defaults; override any field. */
export function rawItem(overrides: Partial<RawDiscoveryItem> = {}): RawDiscoveryItem {
  return {
    title: 'Sample discovery',
    category: 'model',
    sourceUrl: 'https://example.com/sample',
    summary: 'A sample discovery item for deterministic tests.',
    capabilities: ['reasoning'],
    claimedFreeClass: 'UNKNOWN',
    claimedLocalAvailability: 'UNKNOWN',
    evidence: [{ claim: 'Stable public fact', source: 'test-fixture', confidence: 'VERIFIED' }],
    ...overrides,
  };
}

/** A fully-shaped DiscoveryItem with defaults; override any field. */
export function item(overrides: Partial<DiscoveryItem> = {}): DiscoveryItem {
  return {
    id: 'it-1',
    title: 'Sample discovery',
    category: 'model',
    source: 'test-source',
    sourceUrl: 'https://example.com/sample',
    discoveredAt: NOW.toISOString(),
    summary: 'A sample discovery item.',
    capabilities: ['reasoning'],
    freeClass: 'UNKNOWN',
    localAvailability: 'UNKNOWN',
    relevance: 60,
    relevanceLabel: 'high',
    relevanceReasons: ['Directly relevant to VedMoulya capabilities.'],
    confidence: 'INFERRED',
    evidence: [
      {
        claim: 'Stable public fact',
        source: 'test-fixture',
        confidence: 'VERIFIED',
        retrievedAt: NOW.toISOString(),
      },
    ],
    recommendation: 'WATCH',
    recommendationReasons: ['Monitor.'],
    securityFlags: [],
    raw: true,
    ...overrides,
  };
}
