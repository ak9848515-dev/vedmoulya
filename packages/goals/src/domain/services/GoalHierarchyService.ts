// ──────────────────────────────────────────────────────────────────
// VedMoulya — Goal & Task Intelligence: Hierarchy Service
// EI-006 — Enterprise Goal & Task Intelligence Engine
// Manages parent/child goal relationships and aggregates a parent's
// goal score from its sub-goals (per GOAL_ENGINE.md hierarchy rules).
// ──────────────────────────────────────────────────────────────────

import type { Goal } from '../../types/goal-types.js';

export class GoalHierarchyService {
  /** Register a child under its parent (both directions, deduped). */
  link(parent: Goal, child: Goal): { parent: Goal; child: Goal } {
    const updatedParent: Goal = {
      ...parent,
      childGoalIds: parent.childGoalIds.includes(child.goalId)
        ? parent.childGoalIds
        : [...parent.childGoalIds, child.goalId],
    };
    const updatedChild: Goal = {
      ...child,
      parentGoalId: parent.goalId,
    };
    return { parent: updatedParent, child: updatedChild };
  }

  /** Detach a child from its parent. */
  unlink(parent: Goal, child: Goal): { parent: Goal; child: Goal } {
    return {
      parent: {
        ...parent,
        childGoalIds: parent.childGoalIds.filter((id) => id !== child.goalId),
      },
      child: { ...child, parentGoalId: undefined },
    };
  }

  /**
   * Aggregate a parent score from sub-goal scores + own strategic weight
   * (60% children average, 40% own value/priority/confidence blend).
   */
  aggregateParentScore(
    parent: Goal,
    children: Goal[],
    weights: { strategicWeight?: number; childWeight?: number } = {},
  ): number {
    const strategic = weights.strategicWeight ?? 0.4;
    const childWeight = weights.childWeight ?? 1 - strategic;
    const ownScore = this.ownScore(parent);
    if (children.length === 0) return ownScore;
    const childrenAvg = children.reduce((s, c) => s + c.goalScore, 0) / children.length;
    return Number((strategic * ownScore + childWeight * childrenAvg).toFixed(2));
  }

  /** Weighted blend of value, priority, confidence, urgency (0–1). */
  ownScore(goal: Goal): number {
    const priorityScore: Record<string, number> = {
      critical: 1,
      high: 0.8,
      medium: 0.6,
      low: 0.4,
      background: 0.2,
    };
    return Number(
      Math.min(
        1,
        goal.importance * 0.35 +
          (priorityScore[goal.priority] ?? 0.6) * 0.3 +
          goal.confidence * 0.2 +
          goal.urgency * 0.15,
      ).toFixed(2),
    );
  }
}
