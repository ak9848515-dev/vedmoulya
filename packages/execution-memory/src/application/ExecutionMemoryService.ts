// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Memory: Application Service
//
//   EXECUTION → VERIFIED OUTCOME → LEARNING SIGNAL → MEMORY CANDIDATE →
//   VALIDATION → PERSISTENCE → RETRIEVAL → FUTURE PLAN / DECISION
//
// ingestRun() is the learning cycle entry point: extract records from
// the frozen run, derive deterministic signals, build candidates,
// validate them, and aggregate accepted candidates into the store
// (repeated evidence merges — never 1M noisy entries). recordUserPreference()
// is the ONLY way USER_PREFERENCE memory is created (explicit, latest
// wins). retrieve*() surfaces are advisory; resolveMemoryConflicts
// ensures current runtime truth always beats stale memory.
// ──────────────────────────────────────────────────────────────────

import { generateId } from '@vedmoulya/core';
import { sanitizeTraceText } from '@vedmoulya/agent-execution';
import type { AgentExecutionRun, AgentExecutionTraceRecord } from '@vedmoulya/agent-execution';
import type {
  ExecutionMemoryObserver,
  ExecutionMemoryStore,
} from '../contracts/execution-memory-ports.js';
import { InMemoryExecutionMemoryStore } from '../infrastructure/InMemoryExecutionMemoryStore.js';
import { extractExecutionRecords } from '../domain/execution-record.js';
import { extractLearningSignals, type LearningSignalOptions } from '../domain/learning-signals.js';
import { buildMemoryCandidates } from '../domain/memory-candidates.js';
import { validateCandidates } from '../domain/memory-validation.js';
import {
  applyPassiveDecay,
  computeConfidence,
  fingerprintFor,
  mergeCandidate,
} from '../domain/memory-confidence.js';
import { resolveMemoryConflicts } from '../domain/memory-conflicts.js';
import { buildEvidenceBlock, rankEvidence } from '../domain/memory-retrieval.js';
import type {
  ExecutionMemoryConfidence,
  IngestResult,
  MemoryCandidate,
  MemoryEntry,
  MemoryEvidence,
  MemoryEvidenceBlock,
  MemoryQuery,
  RejectedCandidate,
  RuntimeTruth,
} from '../types/execution-memory-types.js';

export interface ExecutionMemoryServiceOptions {
  store?: ExecutionMemoryStore;
  /** Deterministic clock. */
  clock?: { now(): string; timestampMs(): number };
  /** Optional observability hooks. */
  observer?: ExecutionMemoryObserver;
  /** Evidence half-life in days (default 45). */
  halfLifeDays?: number;
  /** Default retention for learned entries in days (undefined = permanent). */
  retentionDays?: number;
  learningSignals?: LearningSignalOptions;
}

export interface UserPreferenceInput {
  userId: string;
  /** e.g. 'outputFormat' — bounded, sanitized. */
  subject: string;
  /** e.g. 'docx' — bounded, sanitized. */
  value: string;
  /** Explicit source (e.g. 'user-request'), never inferred. */
  source: string;
}

export class ExecutionMemoryService {
  private readonly store: ExecutionMemoryStore;
  private readonly clock: { now(): string; timestampMs(): number };
  private readonly observer?: ExecutionMemoryObserver;
  private readonly halfLifeDays: number;
  private readonly retentionDays?: number;
  private readonly learningSignalsOptions: LearningSignalOptions;
  /** Serializes read-modify-write upserts (concurrent ingest safety). */
  private upsertLock: Promise<void> = Promise.resolve();

  constructor(options: ExecutionMemoryServiceOptions = {}) {
    this.store = options.store ?? new InMemoryExecutionMemoryStore();
    this.clock = options.clock ?? {
      now: (): string => new Date().toISOString(),
      timestampMs: (): number => Date.now(),
    };
    this.observer = options.observer;
    this.halfLifeDays = options.halfLifeDays ?? 45;
    this.retentionDays = options.retentionDays;
    this.learningSignalsOptions = options.learningSignals ?? {};
  }

  // ── The learning cycle ──────────────────────────────────────────

  /** Full learning pass over a frozen completed run (records → signals → candidates → validated entries). */
  async ingestRun(
    run: AgentExecutionRun,
    traces?: AgentExecutionTraceRecord[],
    options: { replanCount?: number; knownTools?: string[]; knownProviders?: string[] } = {},
  ): Promise<IngestResult> {
    const nowIso = this.clock.now();
    const nowMs = this.clock.timestampMs();

    const records = extractExecutionRecords({ run, traces, replanCount: options.replanCount });
    const signals = extractLearningSignals(records, this.learningSignalsOptions);
    const candidates = buildMemoryCandidates(signals, records, nowIso);
    const { accepted, rejected } = validateCandidates(candidates, {
      records,
      knownTools: options.knownTools,
      knownProviders: options.knownProviders,
    });

    const persisted: MemoryEntry[] = [];
    for (const candidate of accepted) {
      const entry = await this.upsertCandidate(candidate, nowMs, nowIso);
      persisted.push(entry);
      this.observer?.onCandidate?.(candidate, true, []);
    }
    for (const rejectedItem of rejected) {
      this.observer?.onCandidate?.(rejectedItem.candidate, false, rejectedItem.reasons);
    }

    return {
      runId: run.runId,
      records: records.length,
      signals,
      accepted: persisted,
      rejected: rejected.map((r): RejectedCandidate => ({
        candidateId: r.candidate.candidateId,
        category: r.candidate.category,
        reasons: r.reasons,
      })),
    };
  }

  /** Explicit user preference — the ONLY USER_PREFERENCE creation path (Phase 18). */
  async recordUserPreference(input: UserPreferenceInput): Promise<MemoryEntry> {
    const nowIso = this.clock.now();
    const nowMs = this.clock.timestampMs();
    const subject = sanitizeTraceText(input.subject.trim(), { maxLength: 120 });
    const value = sanitizeTraceText(input.value.trim(), { maxLength: 120 });
    if (subject.length === 0 || value.length === 0) {
      throw new Error('user preference requires a non-empty subject and value');
    }
    const candidate: MemoryCandidate = {
      candidateId: `candidate-${generateId()}`,
      category: 'USER_PREFERENCE',
      scope: 'USER',
      subject,
      predicate: input.source,
      value: 1,
      sampleCount: 1,
      successCount: 1,
      failureCount: 0,
      verifiedCount: 0,
      userId: input.userId,
      executionIds: [],
      signalKinds: ['GOAL_ACHIEVED'],
      createdAt: nowIso,
    };
    // LATEST EXPLICIT STATEMENT WINS: a repeated preference replaces the
    // old value instead of averaging it away.
    const fingerprint = fingerprintFor(candidate);
    const existing = await this.store.getByFingerprint(fingerprint);
    if (existing !== undefined) {
      const updated: MemoryEntry = {
        ...existing,
        value: 1,
        subject,
        predicate: input.source,
        updatedAt: nowIso,
        expiresAt: undefined,
        recency: 1,
        confidence: computeConfidence({
          sampleCount: 1,
          successCount: 1,
          verifiedCount: 0,
          recency: 1,
        }),
      };
      await this.store.save(updated);
      return updated;
    }
    const entry = await this.upsertCandidate(candidate, nowMs, nowIso, 'user');
    return entry;
  }

  // ── Retrieval (advisory only) ───────────────────────────────────

  /** Ranked memory evidence, conflict-filtered against current runtime truth. */
  async retrieve(query: MemoryQuery, runtimeTruth?: RuntimeTruth): Promise<MemoryEvidence[]> {
    const nowMs = this.clock.timestampMs();
    const entries = await this.store.list({});
    // Passive decay applied at retrieval: influence fades with age while
    // the historical record itself is retained.
    const decayed = entries.map((entry) => applyPassiveDecay(entry, nowMs, this.halfLifeDays));
    const ranked = rankEvidence(decayed, query, nowMs);
    const { accepted } = resolveMemoryConflicts(ranked, runtimeTruth);
    this.observer?.onRetrieval?.(query, accepted.length);
    return accepted;
  }

  /** Planner advisory context (Phase 13). */
  async retrieveForPlanning(query: MemoryQuery): Promise<MemoryEvidence[]> {
    return this.retrieve({
      ...query,
      categories: ['PLAN_PATTERN', 'TOOL_RELIABILITY', 'TASK_PATTERN', 'EXECUTION_PATTERN'],
    });
  }

  /** Bounded evidence block for the adaptive decision model (Phase 14). */
  async retrieveForDecision(
    query: MemoryQuery,
    runtimeTruth?: RuntimeTruth,
  ): Promise<MemoryEvidenceBlock> {
    const evidence = await this.retrieve(query, runtimeTruth);
    return buildEvidenceBlock(evidence);
  }

  /** Advisory routing signal ONLY (Phase 15) — never a routing authority. */
  async provideRoutingAdvisory(
    query: MemoryQuery,
    runtimeTruth?: RuntimeTruth,
  ): Promise<MemoryEvidence[]> {
    return this.retrieve({ ...query, categories: ['ROUTING_SIGNAL'] }, runtimeTruth);
  }

  // ── Administration / observability ──────────────────────────────

  async getEntry(entryId: string): Promise<MemoryEntry | undefined> {
    return this.store.get(entryId);
  }

  async listEntries(
    search: {
      userId?: string;
      category?: import('../types/execution-memory-types.js').MemoryCategory;
    } = {},
  ): Promise<MemoryEntry[]> {
    return this.store.list(search);
  }

  async deleteEntry(entryId: string): Promise<void> {
    await this.store.delete(entryId);
  }

  /** Pure confidence helper (exported for consumers/tests). */
  confidence(input: {
    sampleCount: number;
    successCount: number;
    verifiedCount: number;
    recency: number;
  }): ExecutionMemoryConfidence {
    return computeConfidence(input);
  }

  // ── Internal ────────────────────────────────────────────────────

  private async upsertCandidate(
    candidate: MemoryCandidate,
    nowMs: number,
    nowIso: string,
    sourceType: 'execution' | 'user' = 'execution',
  ): Promise<MemoryEntry> {
    // Serialize read-modify-write so concurrent upserts of the same
    // fingerprint aggregate (never duplicate, never corrupt).
    const run = this.upsertLock.then(async () => {
      const fingerprint = fingerprintFor(candidate);
      const existing = await this.store.getByFingerprint(fingerprint);
      const merged = mergeCandidate(
        existing,
        candidate,
        nowMs,
        nowIso,
        this.halfLifeDays,
        this.retentionDays,
        sourceType,
      );
      await this.store.save(merged.entry);
      return merged.entry;
    });
    this.upsertLock = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}
