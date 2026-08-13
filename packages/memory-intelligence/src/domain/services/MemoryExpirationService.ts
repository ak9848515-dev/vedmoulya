// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Memory Intelligence: Expiration Service
// EI-010 — Enterprise Memory Intelligence Platform
// The Memory Pipeline stage: Expiration. Enforces the retention
// policies — every memory carries an absolute `expiresAt` computed
// from its policy at capture time. This service transitions expired
// memories to `expired` (and optionally purges ephemeral ones) while
// leaving permanent memories untouched. Retention Manager surface.
// ──────────────────────────────────────────────────────────────────

import type { MemoryItem } from '../../types/memory-types.js';
import { generateMemoryAuditId } from '../value-objects/MemoryId.js';

export interface ExpirationOptions {
  /** Also delete expired ephemeral/short-term memories (default false). */
  purge?: boolean;
  /** Clock injection for tests. */
  now?: string;
}

export interface ExpirationResult {
  expired: MemoryItem[];
  purged: MemoryItem[];
  active: MemoryItem[];
}

export class MemoryExpirationService {
  /** True when the memory has passed its absolute expiry timestamp. */
  isExpired(memory: MemoryItem, now = new Date().toISOString()): boolean {
    if (!memory.expiresAt) return false;
    return new Date(now).getTime() >= new Date(memory.expiresAt).getTime();
  }

  /**
   * Run the expiration sweep: transition every overdue memory to
   * `expired` (audited). When `purge` is set, expired memories with an
   * ephemeral/short-term policy are removed entirely.
   */
  expire(memories: MemoryItem[], options: ExpirationOptions = {}): ExpirationResult {
    const now = options.now ?? new Date().toISOString();
    const expired: MemoryItem[] = [];
    const purged: MemoryItem[] = [];
    const active: MemoryItem[] = [];

    for (const memory of memories) {
      if (memory.lifecycleStatus === 'expired') {
        if (
          options.purge &&
          (memory.retentionPolicy === 'ephemeral' || memory.retentionPolicy === 'short_term')
        ) {
          purged.push(memory);
        } else {
          expired.push(memory);
        }
        continue;
      }
      if (this.isExpired(memory, now)) {
        if (
          options.purge &&
          (memory.retentionPolicy === 'ephemeral' || memory.retentionPolicy === 'short_term')
        ) {
          purged.push(memory);
        } else {
          expired.push({
            ...memory,
            lifecycleStatus: 'expired',
            audit: [
              ...memory.audit,
              {
                auditId: generateMemoryAuditId(),
                action: 'expired',
                actor: 'memory-platform',
                note: `Retention policy ${memory.retentionPolicy} reached (expiresAt ${memory.expiresAt})`,
                timestamp: now,
              },
            ],
            updatedAt: now,
          });
        }
      } else {
        active.push(memory);
      }
    }
    return { expired, purged, active };
  }
}
