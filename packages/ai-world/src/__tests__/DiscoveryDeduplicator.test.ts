// ──────────────────────────────────────────────────────────────────
// VedMoulya — DiscoveryDeduplicator tests
// EPIC-012C — duplicate discovery (§16)
// Duplicates are skipped, never overwritten — by stable id or by
// canonical source URL.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { DiscoveryDeduplicator } from '../domain/DiscoveryDeduplicator.js';
import { item } from './fixtures.js';

const deduper = new DiscoveryDeduplicator();

describe('DiscoveryDeduplicator — duplicate discovery', () => {
  it('detects a duplicate by stable id', () => {
    const existing = item({ id: 'dup-1', sourceUrl: 'https://example.com/one' });
    const candidate = item({ id: 'dup-1', sourceUrl: 'https://example.com/two' });
    const result = deduper.dedupe(candidate, [existing]);
    expect(result.isDuplicate).toBe(true);
    expect(result.matchId).toBe('dup-1');
  });

  it('detects a duplicate by canonical source URL', () => {
    const existing = item({ id: 'a', sourceUrl: 'https://example.com/same' });
    const candidate = item({ id: 'b', sourceUrl: 'https://example.com/same' });
    const result = deduper.dedupe(candidate, [existing]);
    expect(result.isDuplicate).toBe(true);
    expect(result.matchId).toBe('a');
  });

  it('treats distinct URLs from different sources as new items', () => {
    const existing = item({ id: 'a', sourceUrl: 'https://example.com/a' });
    const candidate = item({ id: 'b', sourceUrl: 'https://example.com/b' });
    const result = deduper.dedupe(candidate, [existing]);
    expect(result.isDuplicate).toBe(false);
    expect(result.matchId).toBeUndefined();
  });

  it('does not collide when neither id nor URL matches', () => {
    const result = deduper.dedupe(item({ id: 'x', sourceUrl: 'https://e.com/x' }), []);
    expect(result.isDuplicate).toBe(false);
  });

  it('matches against every retained item, including the current run additions', () => {
    const result = deduper.dedupe(item({ id: 'y', sourceUrl: 'https://e.com/y' }), [
      item({ id: 'y', sourceUrl: 'https://e.com/other' }),
    ]);
    expect(result.isDuplicate).toBe(true);
  });
});
