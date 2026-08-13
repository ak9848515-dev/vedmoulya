// ──────────────────────────────────────────────────────────────────
// VedMoulya — Learning Safety Service
// EI-007 — Enterprise Learning Intelligence Platform
// Enforces the learning safety contract:
//   • Human approval — recommendations are born `pending` and only become
//     actionable through an explicit `approve`.
//   • Version history — every state change bumps the decision version.
//   • Rollback — an approved recommendation can be rolled back.
//   • Audit trail — every action appends a timestamped, actor-scoped entry.
//   • Confidence thresholds — approval is gated on sample count and
//     model confidence.
// Learning NEVER bypasses human approval for architectural or critical
// behavioral changes.
// ──────────────────────────────────────────────────────────────────

import type {
  DecisionAction,
  DecisionStatus,
  LearningAuditEntry,
  LearningDecision,
  LearningModel,
  LearningRecommendation,
} from '../../types/learning-types.js';
import { createDecisionId } from '../value-objects/RecommendationId.js';
import type { LearningSafetyThresholds } from '../rules/LearningRules.js';
import {
  DEFAULT_SAFETY_THRESHOLDS,
  recommendationEligibilityRule,
} from '../rules/LearningRules.js';

export class LearningSafetyService {
  readonly thresholds: LearningSafetyThresholds;

  constructor(thresholds: Partial<LearningSafetyThresholds> = {}) {
    this.thresholds = { ...DEFAULT_SAFETY_THRESHOLDS, ...thresholds };
  }

  // ── Eligibility gate ──────────────────────────────────────────────────────

  isEligible(model: LearningModel): { eligible: boolean; reasons: string[] } {
    const rule = recommendationEligibilityRule(
      model.sampleCount,
      model.confidence,
      this.thresholds,
    );
    if (!rule.passed)
      return { eligible: false, reasons: [rule.message ?? 'Below safety threshold'] };
    return { eligible: true, reasons: [] };
  }

  canApprove(model: LearningModel | undefined): { allowed: boolean; reasons: string[] } {
    if (!this.thresholds.approvalRequired) {
      return { allowed: true, reasons: ['Approval requirement disabled by configuration'] };
    }
    if (!model) {
      return { allowed: false, reasons: ['Recommendation has no learning model'] };
    }
    if (model.sampleCount < this.thresholds.minSamplesForApproval) {
      return {
        allowed: false,
        reasons: [
          `Insufficient samples (${model.sampleCount} < ${this.thresholds.minSamplesForApproval})`,
        ],
      };
    }
    if (model.confidence < this.thresholds.minConfidenceForApproval) {
      return {
        allowed: false,
        reasons: [
          `Confidence below threshold (${model.confidence.toFixed(2)} < ${this.thresholds.minConfidenceForApproval})`,
        ],
      };
    }
    return { allowed: true, reasons: [] };
  }

  // ── Decision lifecycle (versioned + audited) ──────────────────────────────

  createDecision(recommendation: LearningRecommendation, actor: string): LearningDecision {
    return {
      decisionId: createDecisionId(recommendation.recommendationId),
      recommendationId: recommendation.recommendationId,
      recommendationType: recommendation.type,
      targetEntityId: recommendation.targetEntity.entityId,
      status: 'pending',
      version: 1,
      actor,
      audit: [this.auditEntry('created', 1, actor)],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /** Transition a decision to a new status with version bump + audit entry. */
  transition(
    decision: LearningDecision,
    to: DecisionStatus,
    action: DecisionAction,
    actor: string,
    note?: string,
  ): LearningDecision {
    if (!this.canTransition(decision.status, to)) {
      throw new Error(
        `Cannot transition decision ${decision.recommendationId} from ${decision.status} to ${to}`,
      );
    }
    const version = decision.version + 1;
    return {
      ...decision,
      status: to,
      version,
      actor,
      note,
      audit: [...decision.audit, this.auditEntry(action, version, actor, note)],
      updatedAt: new Date().toISOString(),
    };
  }

  approve(decision: LearningDecision, actor: string, note?: string): LearningDecision {
    return this.transition(decision, 'approved', 'approved', actor, note);
  }

  reject(decision: LearningDecision, actor: string, note?: string): LearningDecision {
    return this.transition(decision, 'rejected', 'rejected', actor, note);
  }

  /** Roll back an approved recommendation (creates a new version + audit entry). */
  rollback(decision: LearningDecision, actor: string, note?: string): LearningDecision {
    return this.transition(decision, 'rolled_back', 'rolled_back', actor, note);
  }

  // ── State machine ─────────────────────────────────────────────────────────

  private canTransition(from: DecisionStatus, to: DecisionStatus): boolean {
    if (to === 'approved') return from === 'pending';
    if (to === 'rejected') return from === 'pending';
    if (to === 'rolled_back') return from === 'approved';
    return false;
  }

  private auditEntry(
    action: DecisionAction,
    version: number,
    actor: string,
    note?: string,
  ): LearningAuditEntry {
    return {
      auditId: `audit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      action,
      version,
      actor,
      note,
      timestamp: new Date().toISOString(),
    };
  }
}
