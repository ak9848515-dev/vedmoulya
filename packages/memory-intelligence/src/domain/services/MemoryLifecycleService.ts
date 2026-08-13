// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Memory Intelligence: Lifecycle Service
// EI-010 — Enterprise Memory Intelligence Platform
// Advances a memory through the Memory Lifecycle
//   Capture → Validate → Consolidate → Rank → Compress → Retrieve →
//   Learn → Archive → Expire
// as a validated state machine (captured → validated → consolidated →
// ranked → compressed → active · archive · expire). Each transition is
// audited. The pipeline runner in the application service drives these
// transitions as stages complete.
// ──────────────────────────────────────────────────────────────────

import type { MemoryItem, MemoryLifecycleStatus } from '../../types/memory-types.js';
import { canTransitionLifecycle } from '../rules/MemoryRules.js';
import { generateMemoryAuditId } from '../value-objects/MemoryId.js';

export interface LifecycleResult {
  transitioned: boolean;
  item: MemoryItem;
  message?: string;
}

export class MemoryLifecycleService {
  /** True when the memory is retrievable (active or later pipeline stages). */
  isRetrievable(memory: MemoryItem): boolean {
    return memory.lifecycleStatus === 'active';
  }

  /**
   * Transition one memory to `to`. Validates the state machine, writes
   * the audit entry, and refreshes `updatedAt`. No-op transitions pass
   * through untouched.
   */
  transition(
    memory: MemoryItem,
    to: MemoryLifecycleStatus,
    actor: string,
    note?: string,
  ): LifecycleResult {
    const check = canTransitionLifecycle(memory.lifecycleStatus, to);
    if (!check.allowed) {
      return { transitioned: false, item: memory, message: check.message };
    }
    const now = new Date().toISOString();
    const item: MemoryItem = {
      ...memory,
      lifecycleStatus: to,
      audit: [
        ...memory.audit,
        {
          auditId: generateMemoryAuditId(),
          action: this.auditActionFor(to),
          actor,
          note: note ?? `${memory.lifecycleStatus} → ${to}`,
          timestamp: now,
        },
      ],
      updatedAt: now,
    };
    return { transitioned: true, item };
  }

  private auditActionFor(to: MemoryLifecycleStatus): MemoryItem['audit'][number]['action'] {
    switch (to) {
      case 'validated':
        return 'validated';
      case 'consolidated':
        return 'consolidated';
      case 'ranked':
        return 'ranked';
      case 'compressed':
        return 'compressed';
      case 'active':
        return 'learned';
      case 'archived':
        return 'archived';
      case 'expired':
        return 'expired';
      default:
        return 'updated';
    }
  }
}
