// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Postgres AI Usage Store (production durability)
// One row per idempotent event; `event_id` PK makes replays a no-op, so a
// retry/restart replay can never double-count an execution.
// No secrets/prompts are ever written — only measured usage + safe metadata.
// ─────────────────────────────────────────────────────────────────────────────

import { normalizeUsageInput, type AiUsageEvent, type AiUsageStore } from './AiUsageLedgerTypes.js';

/**
 * Minimal structural surface used by the store. Accepts the real postgres.js
 * `Sql` instance: a tagged-template callable that also exposes `json()` for
 * explicit jsonb serialization. Typed loosely (never/unknown) because the
 * driver's parameter generics are not satisfiable by a nominal interface.
 */
export interface PostgresSqlLike {
  /* eslint-disable @typescript-eslint/no-explicit-any -- driver generic surface */
  <T = any>(strings: TemplateStringsArray, ...values: any[]): Promise<T>;
  json: (value: any) => unknown;
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export class PostgresAiUsageStore implements AiUsageStore {
  constructor(private readonly sql: PostgresSqlLike) {}

  async ensureTable(): Promise<void> {
    await this.sql`
      CREATE TABLE IF NOT EXISTS ai_usage_events (
        event_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        provider_family TEXT NOT NULL,
        model TEXT NOT NULL,
        execution_id TEXT NOT NULL,
        mission_id TEXT,
        source TEXT NOT NULL,
        input_tokens BIGINT NOT NULL DEFAULT 0,
        output_tokens BIGINT NOT NULL DEFAULT 0,
        total_tokens BIGINT NOT NULL DEFAULT 0,
        cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
        cost_unknown BOOLEAN NOT NULL DEFAULT TRUE,
        currency TEXT NOT NULL DEFAULT 'USD',
        occurred_at TIMESTAMPTZ NOT NULL,
        status TEXT NOT NULL DEFAULT 'success',
        cached BOOLEAN NOT NULL DEFAULT FALSE,
        retried BOOLEAN NOT NULL DEFAULT FALSE,
        is_local BOOLEAN NOT NULL DEFAULT FALSE,
        parent_execution_id TEXT,
        document JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await this
      .sql`CREATE INDEX IF NOT EXISTS ai_usage_user_time ON ai_usage_events (user_id, occurred_at DESC)`;
    await this
      .sql`CREATE INDEX IF NOT EXISTS ai_usage_user_provider ON ai_usage_events (user_id, provider)`;
    await this.sql`CREATE INDEX IF NOT EXISTS ai_usage_execution ON ai_usage_events (execution_id)`;
  }

  async record(event: AiUsageEvent): Promise<boolean> {
    const e = normalizeUsageInput({ ...event, eventId: event.eventId });
    const rows = await this.sql<Array<{ inserted: boolean }>>`
      INSERT INTO ai_usage_events (
        event_id, user_id, provider, provider_family, model, execution_id,
        mission_id, source, input_tokens, output_tokens, total_tokens,
        cost_usd, cost_unknown, currency, occurred_at, status, cached,
        retried, is_local, parent_execution_id, document
      ) VALUES (
        ${e.eventId}, ${e.userId}, ${e.provider}, ${e.providerFamily}, ${e.model},
        ${e.executionId}, ${e.missionId ?? null}, ${e.source},
        ${e.inputTokens}, ${e.outputTokens}, ${e.totalTokens},
        ${e.costUsd}, ${e.costUnknown}, ${e.currency},
        ${new Date(e.timestamp).toISOString()}, ${e.status}, ${e.cached},
        ${e.retry}, ${e.local}, ${e.parentExecutionId ?? null},
        ${this.sql.json({ ...e })}
      )
      ON CONFLICT (event_id) DO NOTHING
      RETURNING TRUE AS inserted
    `;
    return rows[0]?.inserted ?? false;
  }

  async list(query: Parameters<AiUsageStore['list']>[0] = {}): Promise<AiUsageEvent[]> {
    const q = query;
    const limit = Math.min(Math.max(q.limit ?? 5000, 1), 20_000);
    const rows = await this.sql<Array<{ document: AiUsageEvent | string }>>`
      SELECT document FROM ai_usage_events
      ORDER BY occurred_at DESC
      LIMIT ${limit * 4}
    `;
    const events: AiUsageEvent[] = [];
    for (const row of rows) {
      const raw = row.document;
      const e: AiUsageEvent = typeof raw === 'string' ? (JSON.parse(raw) as AiUsageEvent) : raw;
      if (q.userId !== undefined && e.userId !== q.userId) continue;
      if (q.provider !== undefined && e.provider !== q.provider) continue;
      if (q.model !== undefined && e.model !== q.model) continue;
      if (q.source !== undefined && e.source !== q.source) continue;
      if (q.missionId !== undefined && e.missionId !== q.missionId) continue;
      if (q.executionId !== undefined && e.executionId !== q.executionId) continue;
      if (q.since !== undefined && e.timestamp < q.since) continue;
      if (q.until !== undefined && e.timestamp >= q.until) continue;
      if (q.excludeLocal === true && e.local) continue;
      if (q.localOnly === true && !e.local) continue;
      events.push(e);
      if (events.length >= limit) break;
    }
    return events;
  }

  async count(userId?: string): Promise<number> {
    if (userId === undefined) {
      const rows = await this.sql<
        Array<{ n: string | number }>
      >`SELECT COUNT(*) AS n FROM ai_usage_events`;
      return Number(rows[0]?.n ?? 0);
    }
    const rows = await this.sql<Array<{ n: string | number }>>`
      SELECT COUNT(*) AS n FROM ai_usage_events WHERE user_id = ${userId}
    `;
    return Number(rows[0]?.n ?? 0);
  }

  async clear(userId?: string): Promise<void> {
    if (userId === undefined) {
      await this.sql`DELETE FROM ai_usage_events`;
      return;
    }
    await this.sql`DELETE FROM ai_usage_events WHERE user_id = ${userId}`;
  }
}
