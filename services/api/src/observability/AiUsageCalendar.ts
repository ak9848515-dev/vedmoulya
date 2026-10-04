// ── Calendar boundaries (true calendar day/month in the USER's timezone) ────

import { resolveTimeZone } from './AiUsageAggregation.js';

function tzDay(now: number, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(now));
}

function tzMonth(now: number, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
  }).format(new Date(now));
}

/** Midnight starting TODAY in `tz` (true calendar-day boundary). */
export function startOfDayInTimeZone(now: number, tz: string): number {
  const zone = resolveTimeZone(tz);
  const today = tzDay(now, zone);
  let lo = now - 48 * 3_600_000;
  let hi = now;
  for (let i = 0; i < 60; i += 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (tzDay(mid, zone) === today) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** First instant of THIS MONTH in `tz` (explicit calendar month). */
export function startOfMonthInTimeZone(now: number, tz: string): number {
  const zone = resolveTimeZone(tz);
  const month = tzMonth(now, zone);
  let lo = now - 62 * 24 * 3_600_000;
  let hi = now;
  for (let i = 0; i < 70; i += 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (tzMonth(mid, zone) === month) hi = mid;
    else lo = mid;
  }
  return startOfDayInTimeZone(hi, zone);
}
