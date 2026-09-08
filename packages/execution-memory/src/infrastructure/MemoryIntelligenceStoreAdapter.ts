// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Memory: Enterprise Memory Persistence Adapter
//
// PHASE 11 — structured persistence REUSES the existing persistence
// architecture: this adapter maps an ExecutionMemoryStore onto the
// existing @vedmoulya/memory-intelligence MemoryRepository (the
// platform that already owns memory persistence — Postgres in
// production, InMemoryMemoryRepository as its hermetic double). No
// second database, no new persistence architecture.
//
// Mapping is explicit and honest:
//   - MemoryEntry.category → MemoryItem.type (closed platform types),
//   - provenance executionIds → MemoryCitation[] (verified),
//   - sampleCount → usage.frequency, recency → usage.recency,
//   - evidence-based confidence → the platform's MemoryConfidence,
//   - retentionDays → MemoryRetentionPolicy + expiresAt.
// ──────────────────────────────────────────────────────────────────

import type {
  MemoryConfidence,
  MemoryItem,
  MemoryLevel,
  MemoryRetentionPolicy,
  MemoryType,
} from '@vedmoulya/memory-intelligence';
import type { MemoryRepository } from '@vedmoulya/memory-intelligence';
import {
  createMemoryId,
  generateMemoryAuditId,
  generateMemoryCitationId,
} from '@vedmoulya/memory-intelligence';
import type {
  ExecutionMemoryStore,
  MemoryStoreSearch,
} from '../contracts/execution-memory-ports.js';
import type { MemoryCategory, MemoryEntry } from '../types/execution-memory-types.js';
import { isKnownCapability } from '../domain/memory-validation.js';

const CATEGORY_TO_TYPE: Record<MemoryCategory, MemoryType> = {
  EXECUTION_PATTERN: 'execution',
  TOOL_RELIABILITY: 'execution',
  PLAN_PATTERN: 'learning',
  RECOVERY_PATTERN: 'learning',
  VERIFICATION_PATTERN: 'execution',
  ROUTING_SIGNAL: 'provider',
  USER_PREFERENCE: 'user_preference',
  TASK_PATTERN: 'learning',
};

function confidenceLevel(
  level: import('../types/execution-memory-types.js').ExecutionMemoryConfidenceLevel,
): MemoryLevel {
  switch (level) {
    case 'HIGH':
      return 'high';
    case 'MEDIUM':
      return 'medium';
    case 'LOW':
      return 'low';
    default:
      return 'low';
  }
}

function retentionPolicy(entry: MemoryEntry): MemoryRetentionPolicy {
  const days = entry.retentionDays;
  if (days === undefined) return 'permanent';
  if (days <= 1) return 'ephemeral';
  if (days <= 7) return 'short_term';
  if (days <= 30) return 'medium_term';
  return 'long_term';
}

/** Stable platform id derived from the aggregation fingerprint — repeated
 *  merges of the same entry OVERWRITE the same MemoryItem instead of
 *  duplicating it (dedup across services/persistence). */
export function memoryItemIdFor(entry: Pick<MemoryEntry, 'fingerprint'>): string {
  const slug = entry.fingerprint
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 96);
  return `xmem_${slug || 'entry'}`;
}

/** Map one MemoryEntry onto the enterprise MemoryItem (structured facts). */
export function toMemoryItem(entry: MemoryEntry, nowIso: string): MemoryItem {
  const confidence: MemoryConfidence = {
    score: entry.confidence.score,
    level: confidenceLevel(entry.confidence.level),
    factors: entry.confidence.factors,
  };
  return {
    memoryId: createMemoryId(memoryItemIdFor(entry)),
    type: CATEGORY_TO_TYPE[entry.category],
    title: `${entry.category}/${entry.scope}: ${entry.subject}`,
    content: `${entry.subject} ${entry.predicate} ${entry.value.toFixed(3)} (samples=${String(entry.sampleCount)}, success=${String(entry.successCount)})`,
    summary: entry.predicate,
    source: `execution-memory ${entry.fingerprint}`,
    sourceType: 'execution',
    owner: entry.userId ?? 'system',
    relatedGoal: undefined,
    relatedTask: undefined,
    relatedCapability: entry.capability,
    relatedProvider:
      entry.category === 'ROUTING_SIGNAL' ? entry.subject.replace(/^provider:/, '') : undefined,
    relatedExecution: entry.provenance.lastExecutionId,
    tags: [
      `category:${entry.category}`,
      `scope:${entry.scope}`,
      `subject:${entry.subject}`,
      `predicate:${entry.predicate}`,
      `fingerprint:${entry.fingerprint}`,
      ...(entry.userId !== undefined ? [`user:${entry.userId}`] : []),
    ],
    importance: {
      score: entry.confidence.score,
      level: confidenceLevel(entry.confidence.level),
      factors: ['derived from evidence-based confidence'],
    },
    confidence,
    usage: {
      totalRetrievals: 0,
      totalConsumers: 0,
      frequency: entry.sampleCount,
      recency: entry.recency,
    },
    lifecycleStatus: 'validated',
    compressionState: 'raw',
    retentionPolicy: retentionPolicy(entry),
    expiresAt: entry.expiresAt,
    consumers: [],
    relationships: [],
    citations: entry.provenance.executionIds.map((executionId) => ({
      citationId: generateMemoryCitationId(),
      sourceId: executionId,
      sourceTitle: `execution ${executionId}`,
      sourceType: 'execution' as const,
      reference: entry.entryId,
      retrievedAt: nowIso,
      verified: true,
    })),
    audit: [
      {
        auditId: generateMemoryAuditId(),
        action: 'learned',
        actor: 'execution-memory',
        note: `learned from ${String(entry.sampleCount)} verified evidence sample(s)`,
        timestamp: nowIso,
      },
    ],
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

/** Reverse-map a persisted MemoryItem back to a MemoryEntry. */
export function fromMemoryItem(item: MemoryItem): MemoryEntry {
  const tags = item.tags;
  const tag = (prefix: string): string | undefined => {
    const found = tags.find((t) => t.startsWith(prefix));
    return found?.slice(prefix.length);
  };
  const category = (tag('category:') ?? 'EXECUTION_PATTERN') as MemoryCategory;
  const scope = (tag('scope:') ?? 'GLOBAL') as MemoryEntry['scope'];
  const subject = tag('subject:') ?? item.title;
  const predicate = tag('predicate:') ?? item.summary ?? 'aggregated';
  const fingerprint = tag('fingerprint:') ?? `${category}|${scope}|${subject}|${predicate}`;
  const match = item.content.match(/samples=(\d+), success=(\d+)/);
  const sampleCount = match ? Number(match[1]) : item.usage.frequency;
  const successCount = match ? Number(match[2]) : 0;
  return {
    entryId: item.memoryId,
    fingerprint,
    category,
    scope,
    subject,
    predicate,
    value: sampleCount > 0 ? successCount / sampleCount : item.importance.score,
    capability:
      item.relatedCapability !== undefined && isKnownCapability(item.relatedCapability)
        ? item.relatedCapability
        : undefined,
    userId: item.owner !== 'system' ? item.owner : undefined,
    sampleCount,
    successCount,
    failureCount: sampleCount - successCount,
    verifiedCount: item.citations.length,
    evidence: {
      executionIds: item.citations.map((c) => c.sourceId),
      evidenceCount: item.citations.length,
    },
    confidence: {
      score: item.confidence.score,
      level:
        item.confidence.score >= 0.75
          ? 'HIGH'
          : item.confidence.score >= 0.55
            ? 'MEDIUM'
            : item.confidence.score >= 0.35
              ? 'LOW'
              : 'INSUFFICIENT',
      factors: item.confidence.factors,
    },
    recency: item.usage.recency,
    provenance: {
      executionIds: item.citations.map((c) => c.sourceId),
      sourceType: 'aggregation',
      lastExecutionId: item.relatedExecution,
    },
    retentionDays:
      item.retentionPolicy === 'permanent'
        ? undefined
        : item.retentionPolicy === 'ephemeral'
          ? 1
          : item.retentionPolicy === 'short_term'
            ? 7
            : item.retentionPolicy === 'medium_term'
              ? 30
              : 365,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    expiresAt: item.expiresAt,
  };
}

/**
 * Production-shaped adapter: ExecutionMemoryStore over the EXISTING
 * enterprise memory persistence. Use with PostgresMemoryRepository in
 * production or InMemoryMemoryRepository as its hermetic double.
 */
export class MemoryIntelligenceStoreAdapter implements ExecutionMemoryStore {
  constructor(
    private readonly repository: MemoryRepository,
    private readonly options: { now?: () => string } = {},
  ) {}

  private now(): string {
    return this.options.now?.() ?? new Date().toISOString();
  }

  async save(entry: MemoryEntry): Promise<void> {
    await this.repository.saveItem(toMemoryItem(entry, this.now()));
  }

  async get(entryId: string): Promise<MemoryEntry | undefined> {
    const item = await this.repository.findItemById(entryId);
    return item === null ? undefined : fromMemoryItem(item);
  }

  async getByFingerprint(fingerprint: string): Promise<MemoryEntry | undefined> {
    const items = await this.repository.listAllItems();
    const found = items.find((item) => item.tags.includes(`fingerprint:${fingerprint}`));
    return found === undefined ? undefined : fromMemoryItem(found);
  }

  async list(search: MemoryStoreSearch = {}): Promise<MemoryEntry[]> {
    const items = await this.repository.listAllItems();
    const entries = items.map(fromMemoryItem);
    return entries.filter((entry) => {
      if (search.userId !== undefined && entry.userId !== search.userId) return false;
      if (search.category !== undefined && entry.category !== search.category) return false;
      if (search.scope !== undefined && entry.scope !== search.scope) return false;
      if (search.subject !== undefined && entry.subject !== search.subject) return false;
      if (search.capability !== undefined && entry.capability !== search.capability) return false;
      return true;
    });
  }

  async delete(entryId: string): Promise<void> {
    await this.repository.deleteItem(entryId);
  }
}
