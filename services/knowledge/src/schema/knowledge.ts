// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Database Schema
// Drizzle ORM schema for the Knowledge Graph tables
// Maps to KnowledgeNode, KnowledgeEdge, and KnowledgeGraph domain entities
// ARC-003 — Knowledge Graph Bounded Context
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

// ── Knowledge Graphs Table ──────────────────────────────────────────────

export const knowledgeGraphs = pgTable(
  'knowledge_graphs',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    label: varchar('label', { length: 200 }).notNull(),
    description: text('description'),
    statusState: varchar('status_state', { length: 32 }).default('active').notNull(),
    statusReason: text('status_reason'),
    metadata: jsonb('metadata').default({}),
    entityStatus: varchar('entity_status', { length: 16 }).default('active').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('kg_status_idx').on(table.statusState),
    index('kg_created_at_idx').on(table.createdAt),
  ],
);

// ── Knowledge Nodes Table ───────────────────────────────────────────────

export const knowledgeNodes = pgTable(
  'knowledge_nodes',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    graphId: varchar('graph_id', { length: 64 }).notNull(),
    category: varchar('category', { length: 32 }).notNull(),
    label: varchar('label', { length: 200 }).notNull(),
    description: text('description'),
    metadata: jsonb('metadata').default({}),
    tags: text('tags').array().default([]),

    // Status & Lifecycle
    statusState: varchar('status_state', { length: 32 }).default('draft').notNull(),
    statusReason: text('status_reason'),

    // Confidence
    confidenceLevel: varchar('confidence_level', { length: 16 }).default('unknown').notNull(),
    confidenceScore: doublePrecision('confidence_score').default(0).notNull(),

    // Source
    sourceType: varchar('source_type', { length: 32 }).default('system_generated').notNull(),
    sourceDetail: text('source_detail'),
    sourceTimestamp: timestamp('source_timestamp'),

    // Quality
    qualityAccuracy: doublePrecision('quality_accuracy').default(0.5).notNull(),
    qualityCompleteness: doublePrecision('quality_completeness').default(0.5).notNull(),
    qualityConsistency: doublePrecision('quality_consistency').default(0.5).notNull(),
    qualityTimeliness: doublePrecision('quality_timeliness').default(1.0).notNull(),
    qualityRelevance: doublePrecision('quality_relevance').default(0.5).notNull(),

    // Version
    versionMajor: integer('version_major').default(1).notNull(),
    versionMinor: integer('version_minor').default(0).notNull(),
    versionPatch: integer('version_patch').default(0).notNull(),

    // Entity
    entityStatus: varchar('entity_status', { length: 16 }).default('active').notNull(),

    // Metadata
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('kn_graph_id_idx').on(table.graphId),
    index('kn_category_idx').on(table.category),
    index('kn_label_idx').on(table.label),
    index('kn_status_idx').on(table.statusState),
    index('kn_confidence_idx').on(table.confidenceLevel),
    index('kn_entity_status_idx').on(table.entityStatus),
    index('kn_tags_idx').on(table.tags),
    index('kn_graph_category_idx').on(table.graphId, table.category),
  ],
);

// ── Knowledge Edges Table ───────────────────────────────────────────────

export const knowledgeEdges = pgTable(
  'knowledge_edges',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    graphId: varchar('graph_id', { length: 64 }).notNull(),
    sourceId: varchar('source_id', { length: 64 }).notNull(),
    targetId: varchar('target_id', { length: 64 }).notNull(),
    type: varchar('type', { length: 64 }).notNull(),
    typeCategory: varchar('type_category', { length: 32 }).default('association').notNull(),
    label: varchar('label', { length: 200 }).notNull(),
    weight: doublePrecision('weight').default(0.5).notNull(),
    metadata: jsonb('metadata').default({}),

    // Confidence
    confidenceLevel: varchar('confidence_level', { length: 16 }).default('medium').notNull(),
    confidenceScore: doublePrecision('confidence_score').default(0.6).notNull(),

    // Status
    statusState: varchar('status_state', { length: 32 }).default('active').notNull(),
    statusReason: text('status_reason'),

    // Source
    sourceType: varchar('source_type', { length: 32 }).default('system_generated').notNull(),
    sourceDetail: text('source_detail'),

    // Entity
    entityStatus: varchar('entity_status', { length: 16 }).default('active').notNull(),

    // Metadata
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('ke_graph_id_idx').on(table.graphId),
    index('ke_source_id_idx').on(table.sourceId),
    index('ke_target_id_idx').on(table.targetId),
    index('ke_type_idx').on(table.type),
    index('ke_status_idx').on(table.statusState),
    index('ke_source_target_idx').on(table.sourceId, table.targetId),
    index('ke_graph_source_idx').on(table.graphId, table.sourceId),
  ],
);

// ── Knowledge Lineage Table ─────────────────────────────────────────────

export const knowledgeLineage = pgTable(
  'knowledge_lineage',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    entityId: varchar('entity_id', { length: 64 }).notNull(),
    entityType: varchar('entity_type', { length: 16 }).notNull(), // 'node' | 'edge'
    eventType: varchar('event_type', { length: 64 }).notNull(),
    sourceId: varchar('source_id', { length: 64 }).notNull(),
    description: text('description'),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
  },
  (table) => [
    index('kl_entity_id_idx').on(table.entityId),
    index('kl_entity_type_idx').on(table.entityType),
    index('kl_timestamp_idx').on(table.timestamp),
  ],
);

// ── Type Exports ────────────────────────────────────────────────────────

export type KnowledgeGraphRow = typeof knowledgeGraphs.$inferSelect;
export type NewKnowledgeGraphRow = typeof knowledgeGraphs.$inferInsert;

export type KnowledgeNodeRow = typeof knowledgeNodes.$inferSelect;
export type NewKnowledgeNodeRow = typeof knowledgeNodes.$inferInsert;

export type KnowledgeEdgeRow = typeof knowledgeEdges.$inferSelect;
export type NewKnowledgeEdgeRow = typeof knowledgeEdges.$inferInsert;

export type KnowledgeLineageRow = typeof knowledgeLineage.$inferSelect;
export type NewKnowledgeLineageRow = typeof knowledgeLineage.$inferInsert;
