// ── Honest usage board aggregation (cloud/local split, day/month) ────────────

import type { AiUsageEvent, AiUsageSource } from './AiUsageLedgerTypes.js';
import { emptyTotals, type UsageTotals } from './AiUsageAggregation.js';
import { startOfDayInTimeZone, startOfMonthInTimeZone } from './AiUsageCalendar.js';

export interface ProviderUsageBreakdown {
  provider: string;
  family: string;
  executions: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  costUnknown: boolean;
  local: boolean;
}

export interface ModelUsageBreakdown extends ProviderUsageBreakdown {
  model: string;
}

export interface SourceUsageBreakdown {
  source: AiUsageSource;
  executions: number;
  totalTokens: number;
  costUsd: number;
}

export interface AiUsageBoard {
  timezone: string;
  todayStart: number;
  monthStart: number;
  cloud: UsageTotals;
  local: UsageTotals;
  todayCloud: UsageTotals;
  todayLocal: UsageTotals;
  monthCloud: UsageTotals;
  monthLocal: UsageTotals;
  byProvider: ProviderUsageBreakdown[];
  byModel: ModelUsageBreakdown[];
  bySource: SourceUsageBreakdown[];
  todayByProvider: ProviderUsageBreakdown[];
  monthByProvider: ProviderUsageBreakdown[];
  recent: AiUsageEvent[];
  totalEvents: number;
}

function add(t: UsageTotals, e: AiUsageEvent): void {
  t.executions += 1;
  t.inputTokens += e.inputTokens;
  t.outputTokens += e.outputTokens;
  t.totalTokens += e.totalTokens;
  t.costUsd += e.costUsd;
  if (e.costUnknown && e.totalTokens > 0) t.costUnknown = true;
  if (e.cached) t.cachedExecutions += 1;
}

function providers(events: AiUsageEvent[]): ProviderUsageBreakdown[] {
  const map = new Map<string, ProviderUsageBreakdown>();
  for (const e of events) {
    let row = map.get(e.provider);
    if (!row) {
      row = {
        provider: e.provider,
        family: e.providerFamily,
        executions: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        costUsd: 0,
        costUnknown: false,
        local: e.local,
      };
      map.set(e.provider, row);
    }
    row.executions += 1;
    row.inputTokens += e.inputTokens;
    row.outputTokens += e.outputTokens;
    row.totalTokens += e.totalTokens;
    row.costUsd += e.costUsd;
    if (e.costUnknown && e.totalTokens > 0) row.costUnknown = true;
    if (!e.local) row.local = false;
  }
  return [...map.values()].sort((a, b) => b.totalTokens - a.totalTokens);
}

function models(events: AiUsageEvent[]): ModelUsageBreakdown[] {
  const map = new Map<string, ModelUsageBreakdown>();
  for (const e of events) {
    const key = `${e.provider}|${e.model}`;
    let row = map.get(key);
    if (!row) {
      row = {
        provider: e.provider,
        family: e.providerFamily,
        model: e.model,
        executions: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        costUsd: 0,
        costUnknown: false,
        local: e.local,
      };
      map.set(key, row);
    }
    row.executions += 1;
    row.inputTokens += e.inputTokens;
    row.outputTokens += e.outputTokens;
    row.totalTokens += e.totalTokens;
    row.costUsd += e.costUsd;
    if (e.costUnknown && e.totalTokens > 0) row.costUnknown = true;
    if (!e.local) row.local = false;
  }
  return [...map.values()].sort((a, b) => b.totalTokens - a.totalTokens);
}

function sources(events: AiUsageEvent[]): SourceUsageBreakdown[] {
  const map = new Map<AiUsageSource, SourceUsageBreakdown>();
  for (const e of events) {
    let row = map.get(e.source);
    if (!row) {
      row = { source: e.source, executions: 0, totalTokens: 0, costUsd: 0 };
      map.set(e.source, row);
    }
    row.executions += 1;
    row.totalTokens += e.totalTokens;
    row.costUsd += e.costUsd;
  }
  return [...map.values()].sort((a, b) => b.totalTokens - a.totalTokens);
}

export interface AggregateOptions {
  timezone?: string;
  now?: number;
  recentLimit?: number;
}

/** Aggregate durable events into the honest usage board (cloud/local split). */
export function aggregateAiUsage(
  events: AiUsageEvent[],
  options: AggregateOptions = {},
): AiUsageBoard {
  const timezone = options.timezone ?? 'UTC';
  const now = options.now ?? Date.now();
  const todayStart = startOfDayInTimeZone(now, timezone);
  const monthStart = startOfMonthInTimeZone(now, timezone);
  const cloud = emptyTotals();
  const local = emptyTotals();
  const todayCloud = emptyTotals();
  const todayLocal = emptyTotals();
  const monthCloud = emptyTotals();
  const monthLocal = emptyTotals();
  const todayEvents: AiUsageEvent[] = [];
  const monthEvents: AiUsageEvent[] = [];
  for (const e of events) {
    if (e.local) add(local, e);
    else add(cloud, e);
    if (e.timestamp >= todayStart) {
      todayEvents.push(e);
      if (e.local) add(todayLocal, e);
      else add(todayCloud, e);
    }
    if (e.timestamp >= monthStart) {
      monthEvents.push(e);
      if (e.local) add(monthLocal, e);
      else add(monthCloud, e);
    }
  }
  return {
    timezone,
    todayStart,
    monthStart,
    cloud,
    local,
    todayCloud,
    todayLocal,
    monthCloud,
    monthLocal,
    byProvider: providers(events),
    byModel: models(events),
    bySource: sources(events),
    todayByProvider: providers(todayEvents),
    monthByProvider: providers(monthEvents),
    recent: [...events]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, options.recentLimit ?? 50),
    totalEvents: events.length,
  };
}
