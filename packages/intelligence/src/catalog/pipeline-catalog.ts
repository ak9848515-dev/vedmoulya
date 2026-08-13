// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Intelligence Pipeline: Seed Catalog
// EI-006 / INT-001
// Quick-build catalog entries that reference goals from the Goal &
// Task Intelligence Engine seed catalog (goal-catalog.ts) — no data
// duplication: the pipeline is built live through the engines.
// ──────────────────────────────────────────────────────────────────

export interface PipelineCatalogEntry {
  /** Goal id known to the goals engine seed catalog. */
  goalId: string;
  label: string;
  description: string;
}

export const PIPELINE_CATALOG: readonly PipelineCatalogEntry[] = [
  {
    goalId: 'goal_blog_seed',
    label: 'Launch a weekly client blog',
    description: 'Business goal — content pipeline from goal to ready session.',
  },
  {
    goalId: 'goal_learning_seed',
    label: 'Master TypeScript advanced patterns',
    description: 'Learning goal — capability + provider + context assembly.',
  },
  {
    goalId: 'goal_career_seed',
    label: 'Get promoted to Senior Engineer',
    description: 'Career goal — strategy + graph + session readiness.',
  },
  {
    goalId: 'goal_revenue_seed',
    label: 'Grow recurring revenue by 25%',
    description: 'Revenue goal — full seven-stage pipeline.',
  },
  {
    goalId: 'goal_project_seed',
    label: 'Ship the analytics dashboard MVP',
    description: 'Project goal — validated graph + session, no execution.',
  },
] as const;

export const SEED_PIPELINE_CATALOG_SIZE = PIPELINE_CATALOG.length;

/** Resolve a catalog entry by goal id (undefined when unknown). */
export function findCatalogEntry(goalId: string): PipelineCatalogEntry | undefined {
  return PIPELINE_CATALOG.find((entry) => entry.goalId === goalId);
}
