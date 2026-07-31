// ──────────────────────────────────────────────────────────────────
// VedMoulya — Decision Database Schema
// Drizzle ORM schema for the Decision Intelligence Engine tables
// Maps to Decision domain entity with options, scoring, risk, etc.
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
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

// ── Decisions Table ────────────────────────────────────────────────────────
// Core table for all decision entries. Each row is a single decision
// with its options, scoring, reasoning, constraints, and outcomes.

export const decisions = pgTable(
  'decisions',
  {
    id: varchar('id', { length: 64 }).primaryKey(),

    // Core content
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description').notNull(),
    metadata: jsonb('metadata').default({}),
    tags: text('tags').array().default([]),

    // Category & Initiator
    category: varchar('category', { length: 32 }).notNull(),
    initiator: varchar('initiator', { length: 32 }).default('user').notNull(),

    // Status & Lifecycle
    status: varchar('status', { length: 16 }).default('requested').notNull(),
    statusReason: text('status_reason'),

    // Priority (0.0 – 10.0)
    priorityLevel: varchar('priority_level', { length: 16 }).default('medium').notNull(),
    priorityScore: doublePrecision('priority_score').default(5.0).notNull(),

    // Confidence (0.0 – 1.0)
    confidenceLevel: varchar('confidence_level', { length: 16 }).default('unknown').notNull(),
    confidenceScore: doublePrecision('confidence_score').default(0.0).notNull(),

    // Version (semver)
    versionMajor: integer('version_major').default(1).notNull(),
    versionMinor: integer('version_minor').default(0).notNull(),
    versionPatch: integer('version_patch').default(0).notNull(),

    // Request info
    requester: varchar('requester', { length: 100 }),
    requestReason: text('request_reason'),
    requestContext: text('request_context'),

    // Selected option & reasoning
    selectedOptionId: varchar('selected_option_id', { length: 64 }),
    reasoningMethod: varchar('reasoning_method', { length: 32 }),
    reasoningSummary: text('reasoning_summary'),
    reasoningAssumptions: jsonb('reasoning_assumptions').default([]),
    reasoningPros: jsonb('reasoning_pros').default([]),
    reasoningCons: jsonb('reasoning_cons').default([]),

    // Outcome
    outcomeResult: varchar('outcome_result', { length: 16 }),
    outcomeDescription: text('outcome_description'),
    outcomeActualImpact: text('outcome_actual_impact'),
    outcomeLessons: jsonb('outcome_lessons').default([]),

    // Knowledge Graph & Memory references
    knowledgeNodeIds: text('knowledge_node_ids').array().default([]),
    memoryIds: text('memory_ids').array().default([]),

    // Options (stored as JSONB for flexibility)
    options: jsonb('options').default([]),

    // Evidence (stored as JSONB)
    evidence: jsonb('evidence').default([]),

    // Constraints (stored as JSONB)
    constraints: jsonb('constraints').default([]),

    // Entity
    entityStatus: varchar('entity_status', { length: 16 }).default('active').notNull(),

    // Metadata
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
  },
  (table) => [
    index('dec_category_idx').on(table.category),
    index('dec_status_idx').on(table.status),
    index('dec_priority_idx').on(table.priorityScore),
    index('dec_confidence_idx').on(table.confidenceScore),
    index('dec_initiator_idx').on(table.initiator),
    index('dec_entity_status_idx').on(table.entityStatus),
    index('dec_created_at_idx').on(table.createdAt),
    index('dec_knowledge_node_ids_idx').on(table.knowledgeNodeIds),
  ],
);

// ── Decision Timeline Table ────────────────────────────────────────────────
// Tracks every significant event in a decision's lifecycle for audit history.

export const decisionTimeline = pgTable(
  'decision_timeline',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    decisionId: varchar('decision_id', { length: 64 }).notNull(),
    eventType: varchar('event_type', { length: 64 }).notNull(),
    description: text('description'),
    metadata: jsonb('metadata').default({}),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
  },
  (table) => [
    index('dt_decision_id_idx').on(table.decisionId),
    index('dt_event_type_idx').on(table.eventType),
    index('dt_timestamp_idx').on(table.timestamp),
    index('dt_decision_timestamp_idx').on(table.decisionId, table.timestamp),
  ],
);

// ── Type Exports ───────────────────────────────────────────────────────────

export type DecisionRow = typeof decisions.$inferSelect;
export type NewDecisionRow = typeof decisions.$inferInsert;

export type DecisionTimelineRow = typeof decisionTimeline.$inferSelect;
export type NewDecisionTimelineRow = typeof decisionTimeline.$inferInsert;
