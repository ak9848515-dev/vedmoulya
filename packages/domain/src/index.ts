export const name = 'domain' as const;

// ── Identity Bounded Context ──────────────────────────────────────────────
export * from './identity/index.js';

// ── Knowledge Graph Bounded Context ───────────────────────────────────────
export * from './knowledge/index.js';

// ── Memory Engine Bounded Context ─────────────────────────────────────────
export * from './memory/index.js';

// ── Decision Intelligence Engine Bounded Context ──────────────────────────
export * from './decision/index.js';

// ── Execution Intelligence Engine Bounded Context ─────────────────────────
export * from './execution/index.js';

// ── Content Agency Bounded Context (EPIC-003/AC-001) ──────────────────────
export * from './content-agency/index.js';
