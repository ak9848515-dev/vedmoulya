// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Canonical Durable AI Usage Ledger
// SPRINT: Dynamic AI Usage / Token Balance / Provider Quota / Multi-AI Runtime
//
// ONE canonical AI execution accounting system. Every AI execution flows:
//
//   AI EXECUTION → USAGE EVENT → DURABLE LEDGER → AGGREGATION → UI
//
// Sources (ASK / MISSION / BRAIN / DAILY_AI / BUSINESS / …) all write the SAME
// event shape. Local AI is observable but EXCLUDED from cloud accounting.
//
// HONESTY CONTRACT (never violated):
//   - no fabricated balances, quotas, costs or remaining tokens
//   - unknown quota/cost stays UNKNOWN (never 1M-minus-usage)
//   - secrets / prompts / keys are never stored
//   - idempotent: one execution = one event (streaming terminal only,
//     retries/fallbacks = one event per real provider call)
// ─────────────────────────────────────────────────────────────────────────────

export type AiUsageSource =
  | 'ASK'
  | 'MISSION'
  | 'BRAIN'
  | 'DAILY_AI'
  | 'BUSINESS'
  | 'CONTENT_AGENCY'
  | 'CONSULTANCY'
  | 'RESEARCH'
  | 'FREELANCE'
  | 'LOCAL_AGENT'
  | 'MULTI_AI_PARENT'
  | 'MULTI_AI_CHILD'
  | 'MULTI_AI_SYNTHESIS'
  | 'OTHER';

export type AiUsageStatus = 'success' | 'error' | 'cached' | 'abstained';

export interface AiUsageEvent {
  /** Deterministic idempotency key: `${executionId}:${provider}:${attempt}:${model}` or trace:span. */
  eventId: string;
  userId: string;
  providerFamily: string;
  /** Adapter/provider name that actually executed (e.g. `google`, `user-gemini`). */
  provider: string;
  model: string;
  /** Request-level correlation (AIOrchestrationService requestId). */
  executionId: string;
  missionId?: string;
  objectiveId?: string;
  source: AiUsageSource;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  /** USD. Absent pricing → 0 with costUnknown=true (never invented). */
  costUsd: number;
  costUnknown: boolean;
  currency: string;
  timestamp: number;
  status: AiUsageStatus;
  cached: boolean;
  retry: boolean;
  parentExecutionId?: string;
  /** Local inference (Ollama / LM-Studio / local) — excluded from cloud totals. */
  local: boolean;
  latencyMs?: number;
  /** Safe telemetry only: capability, mode, fallback chain — never secrets/prompts. */
  metadata?: Record<string, string | number | boolean>;
}

export interface AiUsageRecordInput extends Omit<
  AiUsageEvent,
  'eventId' | 'totalTokens' | 'currency'
> {
  eventId?: string;
  totalTokens?: number;
  currency?: string;
}

const LOCAL_FAMILIES = new Set(['ollama', 'lm-studio', 'lmstudio', 'local']);

export function isLocalProviderFamily(family: string | undefined): boolean {
  return family !== undefined && LOCAL_FAMILIES.has(family.toLowerCase());
}

export function isLocalProvider(provider: string | undefined, family: string | undefined): boolean {
  const p = (provider ?? '').toLowerCase();
  const f = (family ?? '').toLowerCase();
  return (
    LOCAL_FAMILIES.has(f) ||
    p === 'ollama' ||
    p.startsWith('ollama') ||
    p.includes('lm-studio') ||
    p.includes('local-agent') ||
    f.includes('local-agent')
  );
}

export function buildEventId(input: {
  executionId: string;
  provider: string;
  attempt?: number;
  model?: string;
  traceId?: string;
  spanId?: string;
}): string {
  if (input.traceId && input.spanId) return `${input.traceId}:${input.spanId}`;
  const attempt = input.attempt ?? 0;
  const model = (input.model ?? 'unknown').slice(0, 120);
  return `${input.executionId}:${input.provider}:attempt-${String(attempt)}:${model}`;
}

export function normalizeUsageInput(input: AiUsageRecordInput): AiUsageEvent {
  const clamp = (n: unknown): number =>
    typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  const inputTokens = clamp(input.inputTokens);
  const outputTokens = clamp(input.outputTokens);
  const totalTokens =
    input.totalTokens !== undefined && Number.isFinite(input.totalTokens) && input.totalTokens > 0
      ? Math.floor(input.totalTokens)
      : inputTokens + outputTokens;
  const local = input.local || isLocalProvider(input.provider, input.providerFamily);
  return {
    eventId:
      input.eventId ??
      buildEventId({
        executionId: input.executionId,
        provider: input.provider,
        model: input.model,
      }),
    userId: input.userId,
    providerFamily: input.providerFamily,
    provider: input.provider,
    model: input.model || 'unknown',
    executionId: input.executionId,
    ...(input.missionId !== undefined ? { missionId: input.missionId } : {}),
    ...(input.objectiveId !== undefined ? { objectiveId: input.objectiveId } : {}),
    source: input.source,
    inputTokens,
    outputTokens,
    totalTokens,
    costUsd:
      typeof input.costUsd === 'number' && Number.isFinite(input.costUsd) && input.costUsd >= 0
        ? input.costUsd
        : 0,
    costUnknown: input.costUnknown,
    currency: input.currency ?? 'USD',
    timestamp: input.timestamp,
    status: input.status,
    cached: input.cached,
    retry: input.retry,
    ...(input.parentExecutionId !== undefined
      ? { parentExecutionId: input.parentExecutionId }
      : {}),
    local,
    ...(input.latencyMs !== undefined ? { latencyMs: input.latencyMs } : {}),
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
  };
}

/** Owner-scoped durable store contract. Record is idempotent (INSERT … DO NOTHING). */
export interface AiUsageStore {
  record(event: AiUsageEvent): Promise<boolean>;
  list(query?: {
    userId?: string;
    provider?: string;
    model?: string;
    source?: AiUsageSource;
    missionId?: string;
    executionId?: string;
    since?: number;
    until?: number;
    excludeLocal?: boolean;
    localOnly?: boolean;
    limit?: number;
  }): Promise<AiUsageEvent[]>;
  count(userId?: string): Promise<number>;
  clear?(userId?: string): Promise<void>;
}
