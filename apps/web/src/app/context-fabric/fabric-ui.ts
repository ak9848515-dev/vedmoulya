// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric: shared UI helpers
// APP-001 — Post-V1 Application Platform Layer
// Per-entity-type / source / relationship / permission palettes and
// formatting helpers shared by the context-fabric views.
// ─────────────────────────────────────────────────────────────────────────────

import type { ContextSource, FabricEntityType } from '@vedmoulya/context-fabric';

/** Per-entity-type accent colors (personal + business graph kinds). */
export const ENTITY_COLORS: Partial<Record<FabricEntityType, string>> = {
  user: '#2B5FD9',
  goal: '#F97316',
  project: '#7C3AED',
  task: '#3B82F6',
  skill: '#06B6D4',
  knowledge: '#8B5CF6',
  memory: '#F59E0B',
  document: '#0D9488',
  application: '#22C55E',
  preference: '#EC4899',
  work_history: '#64748B',
  learning_history: '#84CC16',
  ai_interaction: '#14B8A6',
  organization: '#2B5FD9',
  person: '#F97316',
  team: '#7C3AED',
  client: '#06B6D4',
  process: '#8B5CF6',
  policy: '#F59E0B',
  business_capability: '#22C55E',
};

/** Human labels for entity types. */
export const ENTITY_LABELS: Record<string, string> = {
  user: 'User',
  goal: 'Goal',
  project: 'Project',
  task: 'Task',
  skill: 'Skill',
  knowledge: 'Knowledge',
  memory: 'Memory',
  document: 'Document',
  application: 'Application',
  preference: 'Preference',
  work_history: 'Work history',
  learning_history: 'Learning history',
  ai_interaction: 'AI interaction',
  organization: 'Organization',
  person: 'Person',
  team: 'Team',
  client: 'Client',
  process: 'Process',
  policy: 'Policy',
  business_capability: 'Business capability',
};

/** Source badges (provenance). */
export const SOURCE_BADGES: Partial<Record<ContextSource, string>> = {
  manual: 'bg-[#64748B] text-white',
  import: 'bg-[#06B6D4] text-white',
  inference: 'bg-[#7C3AED] text-white',
  system: 'bg-[#334155] text-white',
  memory: 'bg-[#F59E0B] text-white',
  knowledge: 'bg-[#8B5CF6] text-white',
  context: 'bg-[#14B8A6] text-white',
  identity: 'bg-[#2B5FD9] text-white',
  goal: 'bg-[#F97316] text-white',
  task: 'bg-[#3B82F6] text-white',
  document: 'bg-[#0D9488] text-white',
  application: 'bg-[#22C55E] text-white',
  capabilities: 'bg-[#84CC16] text-white',
  user_input: 'bg-[#EC4899] text-white',
};

/** Permission scope badge colors. */
export const SCOPE_BADGES: Record<string, string> = {
  private: 'bg-[#EF4444] text-white',
  organization: 'bg-[#2B5FD9] text-white',
  public: 'bg-[#22C55E] text-white',
};

export function scoreColor(score: number): string {
  if (score >= 0.7) return 'text-[#22C55E]';
  if (score >= 0.4) return 'text-[#F59E0B]';
  return 'text-[#EF4444]';
}

export function formatDate(iso: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}
