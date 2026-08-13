// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Intelligence: Lifecycle Service
// EI-009 — Enterprise Knowledge Intelligence Platform
// Moves a knowledge item through its lifecycle
// (draft → review → active → deprecated → archived) with the
// transition rules enforced, the audit trail appended, and the trust
// score re-computed on every transition (an active, validated item
// outranks a draft).
// ──────────────────────────────────────────────────────────────────

import type { KnowledgeItem, KnowledgeLifecycleStatus } from '../../types/knowledge-types.js';
import { canTransitionLifecycle } from '../rules/KnowledgeRules.js';
import { generateAuditId } from '../value-objects/KnowledgeId.js';
import { KnowledgeTrustScoreService } from './KnowledgeTrustScoreService.js';

export interface LifecycleResult {
  item: KnowledgeItem;
  transitioned: boolean;
  message?: string;
}

export class KnowledgeLifecycleService {
  private readonly trust: KnowledgeTrustScoreService;

  constructor(trust: KnowledgeTrustScoreService = new KnowledgeTrustScoreService()) {
    this.trust = trust;
  }

  /** Transition an item; returns the updated item (or the original + message). */
  transition(
    item: KnowledgeItem,
    to: KnowledgeLifecycleStatus,
    actor: string,
    note?: string,
  ): LifecycleResult {
    const gate = canTransitionLifecycle(item.lifecycleStatus, to);
    if (!gate.allowed) {
      return { item, transitioned: false, message: gate.message ?? 'Invalid lifecycle transition' };
    }

    const now = new Date().toISOString();
    const updated: KnowledgeItem = {
      ...item,
      lifecycleStatus: to,
      trust: this.trust.score({ ...item, lifecycleStatus: to }),
      audit: [
        ...item.audit,
        {
          auditId: generateAuditId(),
          action: 'lifecycle',
          actor,
          note: note ?? `lifecycle → ${to}`,
          timestamp: now,
        },
      ],
      updatedAt: now,
    };
    return { item: updated, transitioned: true };
  }
}
