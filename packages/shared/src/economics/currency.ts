// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Centralized currency presentation / USD→INR conversion.
// A1/A2/A4/A5: canonical persisted economics stay `costUsd` (USD). This module
// is the ONLY presentation/conversion seam: user-facing economics must call
// `convertUsdToInr` + `formatInr`. Rates are never hard-coded at call sites
// and are NEVER invented: when no live rate is supplied, call sites must pass
// their injected rate or receive an explicit `rateUnavailable` result.
// ─────────────────────────────────────────────────────────────────────────────

export interface ExchangeRateProvider {
  /** Current USD→INR rate, or undefined when live FX is unavailable. */
  usdToInrRate(): number | undefined;
  /** Rate provenance label, e.g. `live:rbi-reference`. */
  source(): string;
  /** ISO timestamp the rate was observed. */
  observedAt(): string;
}

export interface ConvertToInrOptions {
  usdAmount: number;
  /**
   * Injected live rate. Required for a converted result — when absent the
   * conversion is explicitly unavailable (no silent USD==INR, no invented rate).
   */
  rate?: number;
  source?: string;
}

export interface FxConversionInputs {
  rate?: number;
  source?: string;
}

export const FRANKFURTER_USD_INR_SOURCE = 'frankfurter-central-bank-reference';

/** Fetch the latest USD/INR reference quote from Frankfurter (daily reference rates). */
export async function fetchUsdToInrReferenceRate(
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<ExchangeRateProvider | undefined> {
  try {
    const response = await fetchFn('https://api.frankfurter.dev/v2/rate/USD/INR', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return undefined;
    const payload: unknown = await response.json();
    if (typeof payload !== 'object' || payload === null) return undefined;
    const record = payload as Record<string, unknown>;
    const rate = record['rate'];
    const date = record['date'];
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) return undefined;
    if (typeof date !== 'string' || Number.isNaN(Date.parse(date))) return undefined;
    return {
      usdToInrRate: () => rate,
      source: () => FRANKFURTER_USD_INR_SOURCE,
      observedAt: () => date,
    };
  } catch {
    return undefined;
  }
}

export type InrConversionResult =
  | {
      readonly available: true;
      readonly costInr: number;
      readonly fxRate: number;
      readonly fxSource: string;
      readonly currency: 'INR';
      readonly convertedAt: string;
    }
  | {
      readonly available: false;
      readonly currency: 'INR';
      readonly reason: 'rate_unavailable';
    };

/**
 * Convert canonical USD economics to user-facing INR. Zero stays zero; an
 * absent/invalid rate yields an explicit unavailable result instead of a guess.
 */
export function convertUsdToInr({
  usdAmount,
  rate,
  source = 'injected',
}: ConvertToInrOptions): InrConversionResult {
  if (!Number.isFinite(usdAmount) || usdAmount < 0) {
    return { available: false, currency: 'INR', reason: 'rate_unavailable' };
  }
  if (rate === undefined || !Number.isFinite(rate) || rate <= 0) {
    return { available: false, currency: 'INR', reason: 'rate_unavailable' };
  }
  const fxSource = source.trim().length > 0 ? source : 'injected';
  return {
    available: true,
    costInr: usdAmount * rate,
    fxRate: rate,
    fxSource: fxSource,
    currency: 'INR',
    convertedAt: new Date().toISOString(),
  };
}

/**
 * Resolve conversion inputs from an injected exchange-rate provider. Keeps the
 * call-site contract explicit: returns the live rate (or undefined) with its
 * source so `convertUsdToInr` can report provenance or unavailability.
 */
export function conversionInputsFromProvider(provider?: ExchangeRateProvider): FxConversionInputs {
  if (!provider) return {};
  const rate = provider.usdToInrRate();
  if (rate === undefined || !Number.isFinite(rate) || rate <= 0) return {};
  return { rate, source: provider.source() };
}

/**
 * Formats a number as Indian Rupees (INR) for user-facing economics.
 */
export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount);
}

/**
 * User-facing INR for a canonical USD value. When FX is unavailable the raw
 * USD value is NOT shown as ₹; the caller renders an explicit unavailable
 * label (never USD==INR, never an invented conversion).
 */
export function formatUsdAsInr(
  usdAmount: number,
  options: FxConversionInputs = {},
  unavailableLabel = 'FX unavailable',
): string {
  const converted = convertUsdToInr({ usdAmount, ...options });
  if (!converted.available) return unavailableLabel;
  return formatInr(converted.costInr);
}

/**
 * A reference-rate provider whose rate is fetched lazily and cached.
 * `refresh()` performs the (best-effort) live lookup; until it succeeds the
 * provider reports NO rate, so consumers keep their explicit
 * "FX unavailable" state instead of inventing one. Never throws.
 */
export interface CachedExchangeRateProvider extends ExchangeRateProvider {
  /** Fetch/refresh the reference rate; resolves to the fetched provider or undefined. */
  refresh(): Promise<ExchangeRateProvider | undefined>;
}

/**
 * Wrap `fetchUsdToInrReferenceRate` in a synchronous `ExchangeRateProvider` so
 * server call sites that must stay synchronous (e.g. rationale formatting) can
 * consume the latest successfully-fetched rate without awaiting. A failed or
 * malformed fetch leaves the previous rate intact, or "unavailable" when none
 * was ever observed — a rate is never guessed.
 */
export function createCachedExchangeRateProvider(
  fetchFn: typeof fetch = globalThis.fetch,
): CachedExchangeRateProvider {
  let rate: number | undefined;
  let source = 'unavailable';
  let observedAt = '';

  return {
    usdToInrRate: () => rate,
    source: () => source,
    observedAt: () => observedAt,
    async refresh(): Promise<ExchangeRateProvider | undefined> {
      const provider = await fetchUsdToInrReferenceRate(fetchFn);
      if (provider) {
        rate = provider.usdToInrRate();
        source = provider.source();
        observedAt = provider.observedAt();
      }
      return provider;
    },
  };
}
