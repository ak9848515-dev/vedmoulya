// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory Database Schema
// Drizzle ORM schema for the Memory Engine tables
// Maps to Memory domain entity with timeline and snapshot support
// ARC-003/ARC-004 — Memory Engine Bounded Context
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

// ── Memories Table ─────────────────────────────────────────────────────────
// Core table for all memory entries. Each row is a single memory entry
// capturing experience, observation, history, reflection, or context.

export const memories = pgTable(
  'memories',
  {
    id: varchar('id', { length: 64 }).primaryKey(),

    // Core content
    label: varchar('label', { length: 200 }).notNull(),
    description: text('description'),
    content: text('content').notNull(),
    metadata: jsonb('metadata').default({}),
    tags: text('tags').array().default([]),

    // Category & Source
    category: varchar('category', { length: 32 }).notNull(),
    sourceType: varchar('source_type', { length: 32 }).default('observation').notNull(),
    sourceDetail: text('source_detail'),
    sourceTimestamp: timestamp('source_timestamp'),

    // Importance (0.0 – 1.0)
    importanceLevel: varchar('importance_level', { length: 16 }).default('medium').notNull(),
    importanceScore: doublePrecision('importance_score').default(0.5).notNull(),

    // Confidence (0.0 – 1.0)
    confidenceLevel: varchar('confidence_level', { length: 16 }).default('medium').notNull(),
    confidenceScore: doublePrecision('confidence_score').default(0.6).notNull(),

    // Strength (0.0 – 1.0) — decays over time
    strengthScore: doublePrecision('strength_score').default(1.0).notNull(),

    // Freshness (0.0 – 1.0) — decays over time
    freshnessScore: doublePrecision('freshness_score').default(1.0).notNull(),

    // Status & Lifecycle
    state: varchar('state', { length: 16 }).default('active').notNull(),
    stateReason: text('state_reason'),

    // Version
    versionMajor: integer('version_major').default(1).notNull(),
    versionMinor: integer('version_minor').default(0).notNull(),
    versionPatch: integer('version_patch').default(0).notNull(),

    // Knowledge Graph Reference (optional)
    knowledgeNodeId: varchar('knowledge_node_id', { length: 64 }),
    knowledgeEdgeId: varchar('knowledge_edge_id', { length: 64 }),

    // Retention
    retentionClass: varchar('retention_class', { length: 16 }).default('standard').notNull(),
    retentionTtlDays: integer('retention_ttl_days').default(365).notNull(),
    expiresAt: timestamp('expires_at'),

    // Recall tracking
    recallCount: integer('recall_count').default(0).notNull(),
    lastRecalledAt: timestamp('last_recalled_at'),

    // Entity
    entityStatus: varchar('entity_status', { length: 16 }).default('active').notNull(),

    // Metadata
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('mem_category_idx').on(table.category),
    index('mem_state_idx').on(table.state),
    index('mem_importance_idx').on(table.importanceLevel),
    index('mem_confidence_idx').on(table.confidenceLevel),
    index('mem_strength_idx').on(table.strengthScore),
    index('mem_freshness_idx').on(table.freshnessScore),
    index('mem_knowledge_node_idx').on(table.knowledgeNodeId),
    index('mem_retention_class_idx').on(table.retentionClass),
    index('mem_expires_at_idx').on(table.expiresAt),
    index('mem_entity_status_idx').on(table.entityStatus),
    index('mem_created_at_idx').on(table.createdAt),
  ],
);

// ── Memory Timeline Table ──────────────────────────────────────────────────
// Tracks every significant event in a memory's lifecycle for timeline retrieval.

export const memoryTimeline = pgTable(
  'memory_timeline',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    memoryId: varchar('memory_id', { length: 64 }).notNull(),
    eventType: varchar('event_type', { length: 64 }).notNull(),
    description: text('description'),
    metadata: jsonb('metadata').default({}),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
  },
  (table) => [
    index('mt_memory_id_idx').on(table.memoryId),
    index('mt_event_type_idx').on(table.eventType),
    index('mt_timestamp_idx').on(table.timestamp),
    index('mt_memory_timestamp_idx').on(table.memoryId, table.timestamp),
  ],
);

// ── Memory Snapshots Table ─────────────────────────────────────────────────
// Periodic snapshots of memory state for versioning and restoration.

export const memorySnapshots = pgTable(
  'memory_snapshots',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    memoryId: varchar('memory_id', { length: 64 }).notNull(),
    snapshotData: jsonb('snapshot_data').notNull(),
    versionMajor: integer('version_major').notNull(),
    versionMinor: integer('version_minor').notNull(),
    versionPatch: integer('version_patch').notNull(),
    reason: text('reason'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('ms_memory_id_idx').on(table.memoryId),
    index('ms_version_idx').on(
      table.memoryId,
      table.versionMajor,
      table.versionMinor,
      table.versionPatch,
    ),
    index('ms_created_at_idx').on(table.createdAt),
  ],
);

// ── Type Exports ───────────────────────────────────────────────────────────

export type MemoryRow = typeof memories.$inferSelect;
export type NewMemoryRow = typeof memories.$inferInsert;

export type MemoryTimelineRow = typeof memoryTimeline.$inferSelect;
export type NewMemoryTimelineRow = typeof memoryTimeline.$inferInsert;

export type MemorySnapshotRow = typeof memorySnapshots.$inferSelect;
export type NewMemorySnapshotRow = typeof memorySnapshots.$inferInsert;
