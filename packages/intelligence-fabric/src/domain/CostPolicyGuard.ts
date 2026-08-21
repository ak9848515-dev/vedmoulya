// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Intelligence Fabric · CostPolicyGuard
// SPRINT-030 — G-2 · fail-closed cost policy enforcement.
//
// This is a POLICY layer, NOT a budget engine. It checks a proposed cost
// (estimated or actual) against per-bucket caps using spend evidence the
// caller supplies (the existing CostLedger measures; RunBudgetGuard enforces
// per-run execution limits — this guard adds the daily/provider/workspace
// dimensions on top of that same estate). Honesty rules:
//   • a fabricated estimate is never produced — estimatedCostUsd is optional
//   • UNKNOWN cost stays UNKNOWN: when a cap exists and the cost is unknown,
//     the guard BLOCKS only if the bucket is already at/over its cap — it
//     never blocks on an unknown it cannot justify, and it never silently
//     exceeds a cap it can see
//   • a bucket at/over its cap BLOCKS regardless of the new amount
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CostBucket,
  CostPolicyDecision,
  CostPolicyLimits,
  CostSpendSnapshot,
} from '../types/fabric-types.js';

export interface CostPolicyCheckInput {
  /** The spend this action would add (actual or best-known estimate). */
  additionalUsd?: number;
  /** Provider the spend is attributed to (for the provider bucket). */
  providerId?: string;
  /** Workspace the spend is attributed to (for the workspace bucket). */
  workspaceId?: string;
  limits: CostPolicyLimits;
  current: CostSpendSnapshot;
}

/**
 * Deterministic fail-closed policy check. Returns ALLOW with a reason, or
 * BLOCK with the exhausted bucket. `additionalUsd === undefined` means the
 * cost is UNKNOWN — see class comment for the honest handling.
 */
export class CostPolicyGuard {
  check(input: CostPolicyCheckInput): CostPolicyDecision {
    const current: CostSpendSnapshot = { ...input.current };
    const reasons: string[] = [];

    const task = current.taskUsd ?? 0;
    const daily = current.dailyUsd ?? 0;
    const provider = input.providerId ? (current.providerUsd ?? 0) : 0;
    const workspace = input.workspaceId ? (current.workspaceUsd ?? 0) : 0;

    const buckets: Array<{ bucket: CostBucket; used: number; cap?: number }> = [
      { bucket: 'task', used: task, cap: input.limits.maxTaskCostUsd },
      { bucket: 'daily', used: daily, cap: input.limits.maxDailyCostUsd },
      { bucket: 'provider', used: provider, cap: input.limits.maxProviderCostUsd },
      { bucket: 'workspace', used: workspace, cap: input.limits.maxWorkspaceCostUsd },
    ];

    // 1. A bucket already at/over its cap blocks everything.
    for (const b of buckets) {
      if (b.cap !== undefined && b.used >= b.cap) {
        return {
          allowed: false,
          reason: `${b.bucket} spend $${b.used.toFixed(4)} is at/over the cap $${b.cap.toFixed(4)} — blocked.`,
          exhaustedBucket: b.bucket,
          current: this.snapshot(current, input),
        };
      }
    }

    // 2. Cost unknown + caps present: allow ONLY while no bucket is near its
    //    cap; the actual is tracked at execution and re-checked (never
    //    fabricated, never silently exceeded).
    if (input.additionalUsd === undefined) {
      const nearCap = buckets.find((b) => b.cap !== undefined && b.used > b.cap * 0.9);
      if (nearCap) {
        return {
          allowed: false,
          reason: `${nearCap.bucket} spend $${nearCap.used.toFixed(4)} is within 10% of the cap $${(nearCap.cap ?? 0).toFixed(4)} and the new cost is UNKNOWN — blocked (fail-closed).`,
          exhaustedBucket: nearCap.bucket,
          current: this.snapshot(current, input),
        };
      }
      reasons.push(
        'Cost of this action is UNKNOWN — no estimate fabricated; actual will be tracked and re-checked at execution.',
      );
      return {
        allowed: true,
        reason: reasons.join(' '),
        current: this.snapshot(current, input),
      };
    }

    // 3. Known additional cost: the projected total must stay under each cap.
    //    The provider/workspace buckets only project when that scope is
    //    actually identified (a cost cannot be attributed to an unknown
    //    provider/workspace — nothing fabricated).
    const projections: Array<{ bucket: CostBucket; projected: number; cap?: number }> = [
      { bucket: 'task', projected: task + input.additionalUsd, cap: input.limits.maxTaskCostUsd },
      {
        bucket: 'daily',
        projected: daily + input.additionalUsd,
        cap: input.limits.maxDailyCostUsd,
      },
      ...(input.providerId
        ? [
            {
              bucket: 'provider' as const,
              projected: provider + input.additionalUsd,
              cap: input.limits.maxProviderCostUsd,
            },
          ]
        : []),
      ...(input.workspaceId
        ? [
            {
              bucket: 'workspace' as const,
              projected: workspace + input.additionalUsd,
              cap: input.limits.maxWorkspaceCostUsd,
            },
          ]
        : []),
    ];
    for (const p of projections) {
      if (p.cap !== undefined && p.projected > p.cap) {
        return {
          allowed: false,
          reason: `${p.bucket} projected spend $${p.projected.toFixed(4)} exceeds the cap $${p.cap.toFixed(4)}.`,
          exhaustedBucket: p.bucket,
          current: this.snapshot(current, input),
        };
      }
    }

    reasons.push(`Projected $${input.additionalUsd.toFixed(4)} is within all configured caps.`);
    return {
      allowed: true,
      reason: reasons.join(' '),
      current: this.snapshot(current, input),
    };
  }

  private snapshot(current: CostSpendSnapshot, input: CostPolicyCheckInput): CostSpendSnapshot {
    return {
      taskUsd: current.taskUsd,
      dailyUsd: current.dailyUsd,
      providerUsd: input.providerId ? current.providerUsd : undefined,
      workspaceUsd: input.workspaceId ? current.workspaceUsd : undefined,
    };
  }
}
