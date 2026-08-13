// ──────────────────────────────────────────────────────────────────
// VedMoulya — Postgres Enterprise Knowledge Graph
// EI-009 — Enterprise Knowledge Intelligence Platform
// Production implementation of the abstract KnowledgeGraph interface.
// Today both implementations traverse the relationship edges persisted
// by the KnowledgeRepository, so PostgresKnowledgeGraph extends the
// in-memory traversal logic — the seam that makes a future dedicated
// graph store (Neo4j, ltree) a drop-in override of this class without
// touching the KnowledgeGraph contract or its consumers.
// ──────────────────────────────────────────────────────────────────

import { InMemoryKnowledgeGraph } from './InMemoryKnowledgeGraph.js';

export class PostgresKnowledgeGraph extends InMemoryKnowledgeGraph {}
