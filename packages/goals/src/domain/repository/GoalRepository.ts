// ──────────────────────────────────────────────────────────────────
// VedMoulya — Goal & Task Intelligence: Goal Repository Contract
// EI-006 — Enterprise Goal & Task Intelligence Engine
// ──────────────────────────────────────────────────────────────────

import type { Goal, GoalSearchCriteria } from '../../types/goal-types.js';
import type { GoalId } from '../value-objects/Identifiers.js';

export interface GoalRepository {
  save(goal: Goal): Promise<void>;
  findById(id: GoalId): Promise<Goal | undefined>;
  listAll(): Promise<Goal[]>;
  search(criteria: GoalSearchCriteria): Promise<{ items: Goal[]; total: number }>;
  findByCategory(category: string): Promise<Goal[]>;
  findByStatus(status: string): Promise<Goal[]>;
  findChildren(parentGoalId: string): Promise<Goal[]>;
  delete(id: GoalId): Promise<boolean>;
  exists(id: GoalId): Promise<boolean>;
}
