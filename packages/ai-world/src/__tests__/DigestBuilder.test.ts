// ──────────────────────────────────────────────────────────────────
// VedMoulya — DigestBuilder tests
// EPIC-012C — concise daily/periodic AI World digest (§10)
//
// The digest is a short, scannable "AI WORLD — TODAY" list of the few
// items that matter most — deliberately NOT a long news feed.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { DigestBuilder } from '../domain/DigestBuilder.js';
import { item } from './fixtures.js';

const builder = new DigestBuilder();

describe('DigestBuilder — daily digest', () => {
  it('orders entries by recommendation strength (INTEGRATE first)', () => {
    const digest = builder.build(
      [
        item({ id: 'watch', recommendation: 'WATCH', relevance: 40 }),
        item({ id: 'integrate', recommendation: 'INTEGRATE', relevance: 50 }),
        item({ id: 'try', recommendation: 'TRY', relevance: 80 }),
      ],
      { date: '2026-08-10' },
    );
    expect(digest.date).toBe('2026-08-10');
    expect(digest.entries.map((e) => e.item.id)).toEqual(['integrate', 'try', 'watch']);
  });

  it('excludes IGNORE items entirely', () => {
    const digest = builder.build(
      [
        item({ id: 'ignore', recommendation: 'IGNORE', relevance: 99 }),
        item({ id: 'try', recommendation: 'TRY', relevance: 60 }),
      ],
      { date: '2026-08-10' },
    );
    expect(digest.entries.map((e) => e.item.id)).toEqual(['try']);
  });

  it('excludes security-flagged items even when highly recommended', () => {
    const digest = builder.build(
      [
        item({
          id: 'risky',
          recommendation: 'TRY',
          relevance: 99,
          securityFlags: ['prompt_injection'],
        }),
      ],
      { date: '2026-08-10' },
    );
    expect(digest.entries).toHaveLength(0);
    expect(digest.summary).toContain('Nothing new');
  });

  it('caps the digest at maxEntries (default 5)', () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      item({ id: `it-${i}`, recommendation: 'WATCH', relevance: 50 + i }),
    );
    const digest = builder.build(many, { date: '2026-08-10' });
    expect(digest.entries.length).toBeLessThanOrEqual(5);
  });

  it('breaks relevance ties by higher relevance first', () => {
    const digest = builder.build(
      [
        item({ id: 'low', recommendation: 'WATCH', relevance: 40 }),
        item({ id: 'high', recommendation: 'WATCH', relevance: 90 }),
      ],
      { date: '2026-08-10' },
    );
    expect(digest.entries.map((e) => e.item.id)).toEqual(['high', 'low']);
  });

  it('explains why each entry matters in plain language', () => {
    const digest = builder.build([item({ id: 'c', recommendation: 'CONFIGURE' })], {
      date: '2026-08-10',
    });
    expect(digest.entries[0]?.why).toContain('can be configured in VedMoulya now');
  });

  it('summarises the day honestly', () => {
    const digest = builder.build(
      [
        item({ id: 'a', recommendation: 'TRY' }),
        item({ id: 'b', recommendation: 'WATCH' }),
        item({ id: 'c', recommendation: 'REVIEW' }),
      ],
      { date: '2026-08-10' },
    );
    expect(digest.summary).toContain('3 important updates');
  });
});
