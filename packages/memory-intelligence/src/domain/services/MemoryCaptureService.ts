// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Memory Intelligence: Capture Service
// EI-010 — Enterprise Memory Intelligence Platform
// The first stage of the Memory Pipeline: Event → Capture. Produces a
// validated `MemoryItem` from an observed event, assigns confidence
// from source reliability, computes the initial recency, and attaches
// the capture audit entry. Classification (type + retention) is done
// here so downstream stages only evolve existing memories.
// ──────────────────────────────────────────────────────────────────

/* eslint-disable security/detect-object-injection -- Heuristic false-positive:
   the only indexed accesses are typed Record lookups keyed by the closed
   MemorySourceType / MemoryRetentionPolicy unions — no runtime
   attacker-controlled keys. */

import type { MemoryCaptureInput } from '../../application/MemoryDTO.js';
import { sourceTypeRule, titleRule, validate } from '../rules/MemoryRules.js';
import { generateMemoryAuditId, generateMemoryId } from '../value-objects/MemoryId.js';
import type { MemoryConfidence, MemoryItem, MemoryLevel } from '../../types/memory-types.js';
import { MEMORY_SOURCE_RELIABILITY } from '../../types/memory-types.js';

export interface CaptureResult {
  item: MemoryItem;
}

function levelFor(score: number): MemoryLevel {
  return score >= 0.8 ? 'high' : score >= 0.5 ? 'medium' : 'low';
}

export class MemoryCaptureService {
  /** Default confidence applied when the input does not carry one. */
  readonly defaultConfidence = 0.7;

  /** Compute the initial confidence from source reliability + input score. */
  confidence(input: MemoryCaptureInput): MemoryConfidence {
    const reliability = MEMORY_SOURCE_RELIABILITY[input.sourceType];
    const declared = input.confidence?.score;
    const score =
      declared !== undefined
        ? Math.max(0, Math.min(1, declared))
        : Math.max(0, Math.min(1, reliability));
    return {
      score,
      level: levelFor(score),
      factors: [
        `source type ${input.sourceType} reliability ${reliability.toFixed(2)}`,
        declared !== undefined
          ? `declared confidence ${declared}`
          : 'defaulted from source reliability',
      ],
    };
  }

  /** Classify the retention policy for a captured memory. */
  retentionPolicy(input: MemoryCaptureInput): MemoryItem['retentionPolicy'] {
    return input.retentionPolicy ?? 'short_term';
  }

  /** Capture: build a fresh `captured` memory item (no persistence). */
  capture(input: MemoryCaptureInput, now = new Date().toISOString()): CaptureResult {
    const titleCheck = titleRule(input.title);
    const sourceCheck = sourceTypeRule(input.sourceType);
    const checks = validate([titleCheck, sourceCheck]);
    if (!checks.passed) {
      throw new Error(checks.message ?? 'Invalid memory capture');
    }

    const type = input.type;
    const retentionPolicy = this.retentionPolicy(input);
    const memoryId = generateMemoryId(input.title);
    const confidence = this.confidence(input);
    const importanceFactors =
      input.importance !== undefined
        ? [`declared importance ${input.importance.toFixed(2)}`]
        : ['initial capture — importance computed after consolidation'];

    return {
      item: {
        memoryId,
        type,
        title: input.title.trim(),
        content: input.content.trim(),
        source: input.source.trim(),
        sourceType: input.sourceType,
        owner: input.owner.trim(),
        relatedGoal: input.relatedGoal,
        relatedTask: input.relatedTask,
        relatedCapability: input.relatedCapability,
        relatedProvider: input.relatedProvider,
        relatedProject: input.relatedProject,
        relatedUser: input.relatedUser,
        relatedContext: input.relatedContext,
        relatedDecision: input.relatedDecision,
        relatedExecution: input.relatedExecution,
        tags: [...new Set((input.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean))],
        importance: {
          score: Math.max(0, Math.min(1, input.importance ?? 0.5)),
          level: levelFor(input.importance ?? 0.5),
          factors: importanceFactors,
        },
        confidence,
        usage: { totalRetrievals: 0, totalConsumers: 0, frequency: 1, recency: 1 },
        lifecycleStatus: 'captured',
        compressionState: 'raw',
        retentionPolicy,
        expiresAt: this.expiryFor(retentionPolicy, now),
        consumers: [],
        relationships: [],
        citations: [],
        audit: [
          {
            auditId: generateMemoryAuditId(),
            action: 'captured',
            actor: input.actor ?? 'memory-platform',
            note: `Captured from ${input.source} (${input.sourceType})`,
            timestamp: now,
          },
        ],
        createdAt: now,
        updatedAt: now,
      },
    };
  }

  /** Absolute expiry from a retention policy (permanent → undefined). */
  expiryFor(
    policy: MemoryItem['retentionPolicy'],
    now = new Date().toISOString(),
  ): string | undefined {
    if (policy === 'permanent') return undefined;
    const days: Record<MemoryItem['retentionPolicy'], number> = {
      ephemeral: 1,
      short_term: 7,
      medium_term: 30,
      long_term: 365,
      permanent: 0,
    };
    const ms = days[policy] * 24 * 60 * 60 * 1000;
    return new Date(new Date(now).getTime() + ms).toISOString();
  }
}
