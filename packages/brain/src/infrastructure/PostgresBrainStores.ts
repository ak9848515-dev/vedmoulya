// ──────────────────────────────────────────────────────────────────
// VedMoulya — Brain · PostgresBrainStores
// SPRINT-022 — Persistent Intelligence Foundation
//
// Production persistence for the EPIC-016/020 Brain stores, implementing
// the SAME synchronous ports as the in-memory stores. Write-through
// Postgres via the shared @vedmoulya/core WriteThroughDocumentStore base:
//   • BrainTaskStore / BrainDecisionStore (EPIC-016);
//   • OpportunityStore / IntelligenceEventStore (EPIC-020);
//   • BrainMemoryPort outcome memory (EPIC-020 §10 — durable learning);
//   • BrainExperiencePort adaptive scores (EPIC-020 §4 — persisted with
//     the same pure ledger-math as the in-memory ledger).
// Every record survives restart (hydrate at boot, idempotent upserts,
// flush at shutdown); bounds match the in-memory FIFO conventions; every
// query is owner-scoped + parameterized — IDOR/SQLi safe by construction.
// Stored documents are decisions, evidence references, outcomes and
// provenance ONLY — never secrets, tokens or chain-of-thought.
// ──────────────────────────────────────────────────────────────────

import type postgres from 'postgres';
import { WriteThroughDocumentStore } from '@vedmoulya/core';
import type { CapabilityId } from '@vedmoulya/capability-marketplace';
import type { BrainDecisionRecord, BrainTask } from '../types/brain-types.js';
import type {
  BrainOutcomeMemory,
  IntelligenceEvent,
  Opportunity,
  ProviderPerformanceScore,
} from '../types/continuous-types.js';
import type {
  BrainDecisionStore,
  BrainExperiencePort,
  BrainMemoryPort,
  BrainTaskStore,
  IntelligenceEventStore,
  OpportunityStore,
} from '../contracts/brain-ports.js';
import {
  computeLedgerEntry,
  ledgerEntryToScore,
  sortScoresByQuality,
  LEDGER_DEFAULT_HALF_LIFE_MS,
} from '../domain/ledger-math.js';
import type { LedgerEntry } from '../domain/ledger-math.js';

// Retention bounds — match the in-memory stores exactly.
export const BRAIN_TASKS_PER_OWNER = 50;
export const BRAIN_DECISIONS_PER_TASK = 200;
export const BRAIN_OPPORTUNITIES_PER_OWNER = 100;
export const BRAIN_EVENTS_PER_OWNER = 200;
export const BRAIN_OUTCOMES_PER_OWNER = 100;

function byCreatedAt<T extends { createdAt: string }>(a: T, b: T): number {
  return Date.parse(a.createdAt) - Date.parse(b.createdAt);
}

// ── EPIC-016 · tasks + decisions ──────────────────────────────────

/** Owner-scoped task store — keyed (userId, taskId). */
export class PostgresBrainTaskStore
  extends WriteThroughDocumentStore<BrainTask>
  implements BrainTaskStore
{
  constructor(sql: postgres.Sql, table = 'brain_tasks') {
    super(sql, table);
  }

  save(task: BrainTask): void {
    this.write(task.userId, task.id, task);
    this.prune(
      task.userId,
      BRAIN_TASKS_PER_OWNER,
      (t) => t.createdAt,
      (t) => t.id,
    );
  }

  get(userId: string, taskId: string): BrainTask | undefined {
    // Owner-scoped key — a foreign task is indistinguishable from absent.
    return this.read(userId, taskId);
  }

  list(userId: string): BrainTask[] {
    return this.all(userId).sort(byCreatedAt);
  }
}

/** Owner-scoped decision store — keyed (userId, recordId), grouped by task. */
export class PostgresBrainDecisionStore
  extends WriteThroughDocumentStore<BrainDecisionRecord>
  implements BrainDecisionStore
{
  constructor(sql: postgres.Sql, table = 'brain_decisions') {
    super(sql, table);
  }

  save(record: BrainDecisionRecord): void {
    this.write(record.userId, record.id, record);
    this.pruneGrouped(
      record.userId,
      (d) => d.taskId,
      BRAIN_DECISIONS_PER_TASK,
      (d) => d.createdAt,
      (d) => d.id,
    );
  }

  get(userId: string, taskId: string): BrainDecisionRecord[] {
    return this.all(userId)
      .filter((d) => d.taskId === taskId)
      .sort(byCreatedAt);
  }
}

// ── EPIC-020 · opportunities + intelligence events ────────────────

/** Owner-scoped opportunity store — keyed (userId, opportunityId). */
export class PostgresOpportunityStore
  extends WriteThroughDocumentStore<Opportunity>
  implements OpportunityStore
{
  constructor(sql: postgres.Sql, table = 'brain_opportunities') {
    super(sql, table);
  }

  save(opportunity: Opportunity): void {
    // Idempotent by stable id — re-discovery never duplicates records.
    this.write(opportunity.userId, opportunity.id, opportunity);
    this.prune(
      opportunity.userId,
      BRAIN_OPPORTUNITIES_PER_OWNER,
      (o) => o.createdAt,
      (o) => o.id,
    );
  }

  list(userId: string): Opportunity[] {
    return this.all(userId).sort(byCreatedAt);
  }

  update(
    userId: string,
    opportunityId: string,
    patch: Partial<Pick<Opportunity, 'status'>>,
  ): Opportunity | undefined {
    const existing = this.read(userId, opportunityId);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch };
    this.write(userId, opportunityId, updated);
    return updated;
  }
}

/** Owner-scoped intelligence-event store — keyed (userId, eventId). */
export class PostgresIntelligenceEventStore
  extends WriteThroughDocumentStore<IntelligenceEvent>
  implements IntelligenceEventStore
{
  constructor(sql: postgres.Sql, table = 'brain_intelligence_events') {
    super(sql, table);
  }

  save(event: IntelligenceEvent): void {
    this.write(event.userId, event.id, event);
    this.prune(
      event.userId,
      BRAIN_EVENTS_PER_OWNER,
      (e) => e.createdAt,
      (e) => e.id,
    );
  }

  list(userId: string): IntelligenceEvent[] {
    return this.all(userId).sort(byCreatedAt);
  }

  update(
    userId: string,
    eventId: string,
    patch: Partial<Pick<IntelligenceEvent, 'status'>>,
  ): IntelligenceEvent | undefined {
    const existing = this.read(userId, eventId);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch };
    this.write(userId, eventId, updated);
    return updated;
  }
}

// ── EPIC-020 §10 · durable outcome memory (Brain learning) ────────

/**
 * Durable Brain outcome memory. Records are keyed (userId, taskId) with
 * an idempotent upsert — re-evaluating the same task NEVER duplicates a
 * learning record (SPRINT-022 §8). list() feeds the /brain learning feed.
 */
export class PostgresOutcomeMemory
  extends WriteThroughDocumentStore<BrainOutcomeMemory>
  implements BrainMemoryPort
{
  constructor(sql: postgres.Sql, table = 'brain_outcome_memory') {
    super(sql, table);
  }

  recordOutcome(memory: BrainOutcomeMemory): Promise<void> {
    // Sync-port write-through (mirror + async upsert) — same pattern as
    // PostgresAdaptiveScoreLedger.recordPerformance.
    this.write(memory.userId, memory.taskId, memory);
    this.prune(
      memory.userId,
      BRAIN_OUTCOMES_PER_OWNER,
      (m) => m.capturedAt,
      (m) => m.taskId,
    );
    return Promise.resolve();
  }

  /** Owner-scoped read for the learning feed / dashboard. */
  list(userId: string): BrainOutcomeMemory[] {
    return this.all(userId).sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt));
  }
}

// ── EPIC-020 §4 · adaptive provider scores (persisted) ────────────

export interface PostgresAdaptiveScoreLedgerOptions {
  /** Half-life of a sample's influence (matches the in-memory ledger). */
  halfLifeMs?: number;
}

/**
 * Postgres-persisted BrainExperiencePort. Entries are platform advisory
 * evidence (provider × capability — not user data, matching the frozen
 * ledger semantics) keyed under owner '' — the ledger itself is not
 * owner-scoped by design. Uses the SAME pure ledger-math as the
 * in-memory ledger: identical scores, durable across restart.
 */
export class PostgresAdaptiveScoreLedger
  extends WriteThroughDocumentStore<LedgerEntry>
  implements BrainExperiencePort
{
  private readonly now: () => string;
  private readonly halfLifeMs: number;

  constructor(
    sql: postgres.Sql,
    table = 'adaptive_score_ledger',
    now: () => string = () => new Date().toISOString(),
    options: PostgresAdaptiveScoreLedgerOptions = {},
  ) {
    super(sql, table);
    this.now = now;
    this.halfLifeMs = options.halfLifeMs ?? LEDGER_DEFAULT_HALF_LIFE_MS;
  }

  recordPerformance(input: {
    providerId: string;
    capability: CapabilityId;
    succeeded: boolean;
    explicit: boolean;
    quality?: number;
    at: string;
  }): Promise<void> {
    const key = `${input.providerId}|${input.capability}`;
    const existing = this.read('', key);
    const entry = computeLedgerEntry(existing, input, this.now, this.halfLifeMs);
    this.write('', key, entry);
    return Promise.resolve();
  }

  scoresFor(capability: CapabilityId): ProviderPerformanceScore[] {
    return sortScoresByQuality(
      this.all('')
        .filter((e) => e.capability === capability)
        .map(ledgerEntryToScore),
    );
  }

  /** Best evidenced provider for a capability, excluding failed candidates. */
  bestFor(
    capability: CapabilityId,
    excludeProviderIds: string[] = [],
  ): ProviderPerformanceScore | undefined {
    return this.scoresFor(capability).find((s) => !excludeProviderIds.includes(s.providerId));
  }
}
