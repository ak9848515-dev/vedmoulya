// ─────────────────────────────────────────────────────────────
// VedMoulya — AI Usage Recorder (canonical write path)
// Every AI execution writes ONE idempotent event here.
// Streaming → terminal usage only. Retry/fallback → one event per
// real provider call. Failed calls with zero billable usage record zero.
// ─────────────────────────────────────────────────────────────

import {
  buildEventId,
  isLocalProvider,
  normalizeUsageInput,
  type AiUsageEvent,
  type AiUsageRecordInput,
  type AiUsageSource,
  type AiUsageStore,
} from './AiUsageLedgerTypes.js';

export interface RecordUsageInput extends Omit<
  AiUsageRecordInput,
  'userId' | 'timestamp' | 'eventId'
> {
  userId: string;
  timestamp?: number;
  eventId?: string;
  attempt?: number;
  traceId?: string;
  spanId?: string;
}

export class AiUsageRecorder {
  constructor(private readonly store: AiUsageStore) {}

  getStore(): AiUsageStore {
    return this.store;
  }

  /** Record one execution. Returns true when newly inserted. */
  async record(input: RecordUsageInput): Promise<boolean> {
    const timestamp = input.timestamp ?? Date.now();
    const local = input.local || isLocalProvider(input.provider, input.providerFamily);
    const eventId =
      input.eventId ??
      buildEventId({
        executionId: input.executionId,
        provider: input.provider,
        attempt: input.attempt ?? 0,
        model: input.model,
        traceId: input.traceId,
        spanId: input.spanId,
      });
    const event: AiUsageEvent = normalizeUsageInput({
      ...(input as AiUsageRecordInput),
      userId: input.userId,
      timestamp,
      eventId,
      local,
    });
    try {
      return await this.store.record(event);
    } catch {
      return false;
    }
  }

  /** Backfill ONE event from a completed trace span (durable restart safety). */
  async recordFromSpan(span: {
    traceId: string;
    spanId: string;
    attributes: Record<string, string | number | boolean | undefined>;
    durationMs?: number;
    userId?: string;
    traceName?: string;
    missionId?: string;
    startedAt?: number;
  }): Promise<boolean> {
    const a = span.attributes;
    if (a.status !== 'success') return false;
    const provider = typeof a.provider === 'string' ? a.provider : 'unknown';
    const family =
      typeof a.provider_family === 'string'
        ? a.provider_family
        : typeof a.providerFamily === 'string'
          ? a.providerFamily
          : provider;
    const model = typeof a.model === 'string' && a.model.trim().length > 0 ? a.model : 'unknown';
    const toNum = (v: unknown): number =>
      typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
    const inputTokens = toNum(a.input_tokens);
    const outputTokens = toNum(a.output_tokens);
    const totalTokens =
      a.total_tokens !== undefined ? toNum(a.total_tokens) : inputTokens + outputTokens;
    const cost =
      typeof a.cost === 'number' ? a.cost : typeof a.cost_usd === 'number' ? a.cost_usd : undefined;
    const userId =
      span.userId ?? (typeof a['ai.user_id'] === 'string' ? a['ai.user_id'] : undefined);
    if (!userId) return false;
    const source = inferSource(a, span.traceName);
    // Mission identity is READ from the execution span, never manufactured and
    // never inferred from `source`: only the Mission path attaches these, so an
    // Ask/Brain/Daily-AI span simply has neither attribute.
    const missionId =
      typeof span.missionId === 'string'
        ? span.missionId
        : typeof a.mission_id === 'string'
          ? a.mission_id
          : undefined;
    const objectiveId =
      typeof a.objective_id === 'string' && a.objective_id.length > 0 ? a.objective_id : undefined;
    return this.record({
      userId,
      providerFamily: family,
      provider,
      model,
      executionId: typeof a.request_id === 'string' ? a.request_id : span.traceId,
      ...(missionId !== undefined ? { missionId } : {}),
      ...(objectiveId !== undefined ? { objectiveId } : {}),
      source,
      inputTokens,
      outputTokens,
      totalTokens,
      costUsd: cost ?? 0,
      costUnknown: cost === undefined,
      currency: 'USD',
      timestamp: span.startedAt ?? Date.now(),
      status: 'success',
      cached: a.cache === 'hit',
      retry: typeof a.attempt === 'number' && a.attempt > 0,
      local: isLocalProvider(provider, family),
      ...(typeof span.durationMs === 'number' ? { latencyMs: span.durationMs } : {}),
      traceId: span.traceId,
      spanId: span.spanId,
      attempt: typeof a.attempt === 'number' ? a.attempt : 0,
    });
  }
}

function inferSource(
  a: Record<string, string | number | boolean | undefined>,
  traceName?: string,
): AiUsageSource {
  const raw = typeof a.ai_source === 'string' ? a.ai_source.toUpperCase() : undefined;
  const known: AiUsageSource[] = [
    'ASK',
    'MISSION',
    'BRAIN',
    'DAILY_AI',
    'BUSINESS',
    'CONTENT_AGENCY',
    'CONSULTANCY',
    'RESEARCH',
    'FREELANCE',
    'LOCAL_AGENT',
    'MULTI_AI_PARENT',
    'MULTI_AI_CHILD',
    'MULTI_AI_SYNTHESIS',
    'OTHER',
  ];
  if (raw && (known as string[]).includes(raw)) return raw as AiUsageSource;
  if (typeof a.mode === 'string' && a.mode.includes('local-agent')) return 'LOCAL_AGENT';
  if (traceName === 'ai.request') return 'ASK';
  return 'OTHER';
}
