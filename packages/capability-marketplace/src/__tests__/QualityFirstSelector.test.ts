// ──────────────────────────────────────────────────────────────────
// VedMoulya — QualityFirstSelector tests
// EPIC-013 §8 — selection priority CAPABILITY → QUALITY → EVIDENCE
// → RELIABILITY → USER PREFERENCE → FREE/LOCAL → COST. The cheapest
// tool never wins when it produces inferior output; free is a
// tiebreaker at the END, never the driver.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { QualityFirstSelector } from '../domain/QualityFirstSelector.js';
import { candidate } from './fixtures.js';

const selector = new QualityFirstSelector();

describe('QualityFirstSelector — quality-first selection', () => {
  it('prefers higher evidence-backed quality over a free option', () => {
    const highQuality = candidate({
      id: 'a',
      name: 'High Quality',
      quality: 0.95,
      freeAvailability: 'PAID',
    });
    const freeLower = candidate({
      id: 'b',
      name: 'Free Model',
      quality: 0.6,
      freeAvailability: 'FREE',
    });
    const { selected } = selector.select([freeLower, highQuality]);
    expect(selected?.id).toBe('a');
  });

  it('prefers quality even when the free option is available', () => {
    const paidBest = candidate({ id: 'a', name: 'Paid Best', quality: 0.9 });
    const freeGood = candidate({
      id: 'b',
      name: 'Free Good',
      quality: 0.89,
      freeAvailability: 'FREE',
    });
    const { selected } = selector.select([freeGood, paidBest]);
    expect(selected?.id).toBe('a');
  });

  it('uses free/local as a tiebreaker at equal quality', () => {
    const paid = candidate({ id: 'a', name: 'Paid', quality: 0.8, freeAvailability: 'PAID' });
    const free = candidate({ id: 'b', name: 'Free', quality: 0.8, freeAvailability: 'FREE' });
    const { selected } = selector.select([paid, free]);
    expect(selected?.id).toBe('b');
  });

  it('never selects UNAVAILABLE or UNKNOWN candidates', () => {
    const unavailable = candidate({
      id: 'a',
      name: 'Unavailable',
      classification: 'UNAVAILABLE',
      quality: 1,
    });
    const ready = candidate({ id: 'b', name: 'Ready', quality: 0.7 });
    const { selected } = selector.select([unavailable, ready]);
    expect(selected?.id).toBe('b');
  });

  it('prefers READY over CONFIGURE at equal quality', () => {
    const configure = candidate({
      id: 'a',
      name: 'Configure Me',
      classification: 'CONFIGURE',
      quality: 0.9,
    });
    const ready = candidate({ id: 'b', name: 'Ready', classification: 'READY', quality: 0.9 });
    const { selected } = selector.select([configure, ready]);
    expect(selected?.id).toBe('b');
  });

  it('honours the user-preferred family at equal quality', () => {
    const other = candidate({ id: 'a', name: 'Other', providerFamily: 'google', quality: 0.9 });
    const preferred = candidate({
      id: 'b',
      name: 'Preferred',
      providerFamily: 'openai',
      quality: 0.9,
    });
    const { selected } = selector.select([other, preferred], { family: 'openai' });
    expect(selected?.id).toBe('b');
  });

  it('returns undefined when nothing is eligible', () => {
    const { selected, reasons } = selector.select([]);
    expect(selected).toBeUndefined();
    expect(reasons.join(' ')).toMatch(/unavailable/);
  });
});
