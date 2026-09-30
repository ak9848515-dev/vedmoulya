// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Phase B/C focused tests: INR + streaming/non-streaming model.
// Part 1: centralized currency conversion / formatting.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  conversionInputsFromProvider,
  convertUsdToInr,
  createCachedExchangeRateProvider,
  formatInr,
  formatUsdAsInr,
  fetchUsdToInrReferenceRate,
  type ExchangeRateProvider,
} from './currency.js';

function fxProvider(rate: number | undefined, source = 'live:test'): ExchangeRateProvider {
  return {
    usdToInrRate: () => rate,
    source: () => source,
    observedAt: () => '2026-09-29T00:00:00.000Z',
  };
}

describe('INR economics presentation (Phase B/C part 1)', () => {
  it('loads the actual USD/INR reference rate and preserves its published date', async () => {
    const fetchFn = async (): Promise<Response> =>
      new Response(JSON.stringify({ date: '2026-09-28', base: 'USD', quote: 'INR', rate: 91.25 }));
    const provider = await fetchUsdToInrReferenceRate(fetchFn as typeof fetch);
    expect(provider?.usdToInrRate()).toBe(91.25);
    expect(provider?.observedAt()).toBe('2026-09-28');
    expect(provider?.source()).toBe('frankfurter-central-bank-reference');
  });

  it('returns no provider for failed or malformed FX responses', async () => {
    const failedFetch = async (): Promise<Response> => new Response('', { status: 503 });
    const malformedFetch = async (): Promise<Response> =>
      new Response(JSON.stringify({ date: 'bad-date', rate: 0 }));
    await expect(fetchUsdToInrReferenceRate(failedFetch as typeof fetch)).resolves.toBeUndefined();
    await expect(
      fetchUsdToInrReferenceRate(malformedFetch as typeof fetch),
    ).resolves.toBeUndefined();
  });

  it('converts canonical USD to INR with an injected rate', () => {
    const converted = convertUsdToInr({ usdAmount: 1.5, rate: 80, source: 'live:test' });
    expect(converted.available).toBe(true);
    if (!converted.available) throw new Error('expected converted result');
    expect(converted.costInr).toBeCloseTo(120, 10);
    expect(converted.currency).toBe('INR');
    expect(converted.fxRate).toBe(80);
    expect(converted.fxSource).toBe('live:test');
    expect(typeof converted.convertedAt).toBe('string');
  });

  it('formats INR with the Indian locale and rupee symbol', () => {
    expect(formatInr(1234567.89)).toBe('₹12,34,567.89');
    expect(formatInr(0)).toBe('₹0.00');
  });

  it('produces expected INR through the exchange-rate provider seam', () => {
    const inputs = conversionInputsFromProvider(fxProvider(82.5, 'live:rbi'));
    expect(inputs).toEqual({ rate: 82.5, source: 'live:rbi' });
    expect(formatUsdAsInr(2, inputs)).toBe(formatInr(165));
  });

  it('keeps zero cost at zero and never invents an FX rate', () => {
    const zero = convertUsdToInr({ usdAmount: 0, rate: 82.5, source: 'live:rbi' });
    expect(zero.available).toBe(true);
    if (!zero.available) throw new Error('expected converted result');
    expect(zero.costInr).toBe(0);
    expect(formatInr(zero.costInr)).toBe('₹0.00');

    expect(convertUsdToInr({ usdAmount: 1 })).toEqual({
      available: false,
      currency: 'INR',
      reason: 'rate_unavailable',
    });
    expect(convertUsdToInr({ usdAmount: 1, rate: 0 })).toEqual({
      available: false,
      currency: 'INR',
      reason: 'rate_unavailable',
    });
    expect(conversionInputsFromProvider(fxProvider(undefined))).toEqual({});
    expect(formatUsdAsInr(1)).toBe('FX unavailable');
    expect(formatUsdAsInr(1, {}, 'rate missing')).toBe('rate missing');
  });

  it('cached provider stays unavailable until a refresh succeeds, then caches the rate', async () => {
    const provider = createCachedExchangeRateProvider(
      (async () =>
        new Response(
          JSON.stringify({ date: '2026-09-28', base: 'USD', quote: 'INR', rate: 90 }),
        )) as unknown as typeof fetch,
    );
    // No rate until the (live) lookup actually succeeds — never invented.
    expect(provider.usdToInrRate()).toBeUndefined();
    await provider.refresh();
    expect(provider.usdToInrRate()).toBe(90);
    expect(provider.source()).toBe('frankfurter-central-bank-reference');
    expect(provider.observedAt()).toBe('2026-09-28');
  });

  it('cached provider keeps the previous rate when a later refresh fails', async () => {
    let fail = false;
    const provider = createCachedExchangeRateProvider((async () =>
      fail
        ? new Response('', { status: 503 })
        : new Response(
            JSON.stringify({ date: '2026-09-28', base: 'USD', quote: 'INR', rate: 88 }),
          )) as unknown as typeof fetch);
    await provider.refresh();
    expect(provider.usdToInrRate()).toBe(88);
    fail = true;
    await provider.refresh();
    expect(provider.usdToInrRate()).toBe(88);
  });
});
