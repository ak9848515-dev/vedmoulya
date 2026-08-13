// ──────────────────────────────────────────────────────────────────
// VedMoulya — Postgres Enterprise Memory Graph
// EI-010 — Enterprise Memory Intelligence Platform
// Production implementation of the abstract MemoryGraph interface.
// Today both implementations traverse the relationship edges persisted
// by the MemoryRepository, so PostgresMemoryGraph extends the
// in-memory traversal logic — the seam that makes a future dedicated
// graph store (Neo4j, ltree) a drop-in override of this class without
// touching the MemoryGraph contract or its consumers.
// ──────────────────────────────────────────────────────────────────

import { InMemoryMemoryGraph } from './InMemoryMemoryGraph.js';

export class PostgresMemoryGraph extends InMemoryMemoryGraph {}
