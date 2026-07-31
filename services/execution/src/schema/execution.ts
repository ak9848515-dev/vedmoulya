// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Database Schema
// Drizzle ORM schema for the Execution Intelligence Engine tables
// BLD-009 — Execution Intelligence Engine
// ──────────────────────────────────────────────────────────────────

import {
  pgTable,
  varchar,
  text,
  timestamp,
  integer,
  doublePrecision,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

// ── Execution Plans Table ─────────────────────────────────────────────────
// Single source of truth. Missions, tasks, steps, timeline, and context
// are stored as JSONB within the plan row (matching the decision pattern).

export const executionPlans = pgTable(
  'execution_plans',
  {
    id: varchar('id', { length: 64 }).primaryKey(),

    // Core content
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description').notNull(),
    metadata: jsonb('metadata').default({}),
    tags: text('tags').array().default([]),

    // Planning level
    planningLevel: varchar('planning_level', { length: 16 }).default('operational').notNull(),

    // Status & Lifecycle
    status: varchar('status', { length: 16 }).default('pending').notNull(),
    statusReason: text('status_reason'),

    // Priority
    priorityLevel: varchar('priority_level', { length: 16 }).default('medium').notNull(),
    priorityScore: doublePrecision('priority_score').default(5.0).notNull(),

    // Progress
    progressCompleted: integer('progress_completed').default(0).notNull(),
    progressTotal: integer('progress_total').default(1).notNull(),

    // Goal references (consume only from Decision Engine / Knowledge Graph)
    goalReferences: jsonb('goal_references').default([]),
    decisionReferences: jsonb('decision_references').default([]),

    // Knowledge Graph & Memory references (never duplicate)
    knowledgeNodeIds: text('knowledge_node_ids').array().default([]),
    memoryIds: text('memory_ids').array().default([]),

    // Missions stored as JSONB (flexible, matches decision options pattern)
    missions: jsonb('missions').default([]),

    // Tasks stored as JSONB with full data (steps, dependencies, schedule, context)
    tasks: jsonb('tasks').default([]),

    // Timeline entries (chronological event log)
    timeline: jsonb('timeline').default({ entries: [] }),

    // Context (energy, time, location, resources)
    context: jsonb('context').default({}),

    // Entity
    entityStatus: varchar('entity_status', { length: 16 }).default('active').notNull(),

    // Metadata
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
  },
  (table) => [
    index('exec_planning_level_idx').on(table.planningLevel),
    index('exec_status_idx').on(table.status),
    index('exec_priority_idx').on(table.priorityScore),
    index('exec_entity_status_idx').on(table.entityStatus),
    index('exec_created_at_idx').on(table.createdAt),
  ],
);

// ── Type Exports ──────────────────────────────────────────────────────────

export type ExecutionPlanRow = typeof executionPlans.$inferSelect;
export type NewExecutionPlanRow = typeof executionPlans.$inferInsert;
