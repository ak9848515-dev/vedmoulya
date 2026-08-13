// ──────────────────────────────────────────────────────────────────
// VedMoulya — RelevanceScorer tests
// EPIC-012C — QUALITY and USEFULNESS over volume (§4)
//
// A viral AI product is not automatically useful to VedMoulya.
// Scoring considers relevance, technical usefulness, quality,
// recency, evidence, free availability, local usability,
// integration potential, adoption (minor) and strategic importance.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { RelevanceScorer } from '../domain/RelevanceScorer.js';
import { rawItem, NOW } from './fixtures.js';

const scorer = new RelevanceScorer();
const now = (): Date => NOW;

describe('RelevanceScorer — usefulness over popularity', () => {
  it('scores a capability-overlapping item as high relevance', () => {
    const result = scorer.score(
      rawItem({
        category: 'model',
        capabilities: ['reasoning', 'coding', 'vision'],
        evidence: [
          { claim: 'a', source: 's', confidence: 'VERIFIED' },
          { claim: 'b', source: 's', confidence: 'VERIFIED' },
          { claim: 'c', source: 's', confidence: 'VERIFIED' },
        ],
      }),
      { now },
    );
    expect(result.label).toBe('high');
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  it('a suggested registry family adds concrete integration potential (one-click configure)', () => {
    const base = {
      category: 'provider' as const,
      capabilities: ['coding'],
      // Old published date + no evidence keep the reason list short so the
      // configurable reason survives the top-4 slice.
      publishedAt: '2024-01-01T00:00:00.000Z',
      evidence: [],
    };
    const configurable = scorer.score(
      rawItem({ ...base, modelFacts: { capabilities: ['coding'], suggestedFamily: 'openrouter' } }),
      { now },
    );
    const notConfigurable = scorer.score(rawItem(base), { now });
    expect(configurable.score).toBeGreaterThan(notConfigurable.score);
    expect(configurable.reasons.some((r) => r.includes('configurable'))).toBe(true);
  });

  it('does NOT reward a viral but irrelevant item (popularity is minor)', () => {
    // 100k stars, no VedMoulya-relevant capabilities → low score.
    const result = scorer.score(
      rawItem({
        category: 'github',
        capabilities: ['social_media', 'gaming'],
        github: { name: 'x/y', stars: 100000 },
        evidence: [],
      }),
      { now },
    );
    expect(result.label).toBe('low');
    expect(result.score).toBeLessThan(35);
  });

  it('scores conservatively when capabilities are unknown (never rewarded blindly)', () => {
    const result = scorer.score(rawItem({ capabilities: [] }), { now });
    // Limited signal is never inflated: the item explains the assumption
    // instead of pretending certainty.
    expect(result.label).not.toBe('high');
    expect(result.score).toBeLessThan(60);
    expect(result.reasons.some((r) => r.includes('unknown'))).toBe(true);
  });

  it('adds a strategic bonus for pricing/availability news', () => {
    const strategic = scorer.score(
      rawItem({
        category: 'news',
        capabilities: [],
        summary: 'Provider raised prices and changed the free tier.',
        evidence: [],
      }),
      { now },
    );
    const ordinaryNews = scorer.score(
      rawItem({
        category: 'news',
        capabilities: [],
        summary: 'A provider released a blog post about its roadmap.',
        evidence: [],
      }),
      { now },
    );
    expect(strategic.score).toBeGreaterThan(ordinaryNews.score);
    expect(strategic.reasons.some((r) => r.includes('Strategic'))).toBe(true);
  });

  it('rewards free availability and local usability without making them dominant', () => {
    const freeAndLocal = scorer.score(
      rawItem({
        capabilities: ['coding'],
        claimedFreeClass: 'FREE_WITH_QUOTA',
        claimedLocalAvailability: 'yes',
        evidence: [],
      }),
      { now },
    );
    const paidRemote = scorer.score(
      rawItem({
        capabilities: ['coding'],
        claimedFreeClass: 'PAID',
        claimedLocalAvailability: 'no',
        evidence: [],
      }),
      { now },
    );
    expect(freeAndLocal.score).toBeGreaterThan(paidRemote.score);
  });

  it('deducts for unknown/absent evidence (never rewards fabricated certainty)', () => {
    const noEvidence = scorer.score(
      rawItem({ capabilities: ['coding'], evidence: [], claimedFreeClass: 'FREE_API' }),
      { now },
    );
    const verified = scorer.score(
      rawItem({
        capabilities: ['coding'],
        evidence: [
          { claim: 'a', source: 's', confidence: 'VERIFIED' },
          { claim: 'b', source: 's', confidence: 'VERIFIED' },
          { claim: 'c', source: 's', confidence: 'VERIFIED' },
        ],
      }),
      { now },
    );
    expect(verified.score).toBeGreaterThan(noEvidence.score);
  });

  it('rewards recent items and lets old items decay', () => {
    const fresh = scorer.score(
      rawItem({ capabilities: ['coding'], publishedAt: NOW.toISOString() }),
      { now },
    );
    const ancient = scorer.score(
      rawItem({ capabilities: ['coding'], publishedAt: '2023-01-01T00:00:00.000Z' }),
      { now },
    );
    expect(fresh.score).toBeGreaterThan(ancient.score);
  });

  it('returns conservative reasons when signal is limited', () => {
    const result = scorer.score(rawItem({ capabilities: ['unknown_cap_x'] }), { now });
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});
