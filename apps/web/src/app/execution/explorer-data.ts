// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Execution Explorer: Shared Data
// EPIC-004 / EI-005 — Enterprise Execution Orchestrator
// Seed graph inputs (mirror packages/execution-orchestrator catalog), label
// maps, and helpers shared by the explorer screens (page, sessions, workers).
// ─────────────────────────────────────────────────────────────────────────────

export interface GraphStepInput {
  stepId: string;
  capability:
    | 'reasoning'
    | 'coding'
    | 'vision'
    | 'embeddings'
    | 'summarization'
    | 'classification'
    | 'translation'
    | 'speech'
    | 'image_understanding'
    | 'general_conversation'
    | 'content_generation';
  label: string;
  flowType: 'sequential' | 'parallel' | 'optional' | 'conditional';
  weight: number;
  eligibleFamilies: Array<
    'openai' | 'anthropic' | 'google' | 'deepseek' | 'openrouter' | 'ollama' | 'mock'
  >;
}

export interface GraphInputPayload {
  strategyId: string;
  goalId: string;
  goal: string;
  steps: GraphStepInput[];
  mode: 'sequential' | 'parallel' | 'hybrid' | 'pipeline';
  priority: 'critical' | 'high' | 'medium' | 'low' | 'background';
  maxRetries: number;
  retryDelayMs: number;
  maxLatencyMs: number;
  expectedTokens: number;
  maxCostUsd: number;
}

export const BLOG_SEED: GraphInputPayload = {
  strategyId: 'strategy_blog_seed',
  goalId: 'goal_blog_001',
  goal: 'Generate a blog post about microservices architecture',
  steps: [
    {
      stepId: 'research',
      capability: 'reasoning',
      label: 'Research',
      flowType: 'sequential',
      weight: 0.25,
      eligibleFamilies: ['anthropic', 'openai', 'google'],
    },
    {
      stepId: 'writing',
      capability: 'content_generation',
      label: 'Writing',
      flowType: 'sequential',
      weight: 0.3,
      eligibleFamilies: ['anthropic', 'openai', 'google'],
    },
    {
      stepId: 'seo',
      capability: 'classification',
      label: 'SEO',
      flowType: 'parallel',
      weight: 0.15,
      eligibleFamilies: ['openai', 'deepseek'],
    },
    {
      stepId: 'review',
      capability: 'reasoning',
      label: 'Review',
      flowType: 'parallel',
      weight: 0.15,
      eligibleFamilies: ['anthropic', 'openai'],
    },
    {
      stepId: 'publishing',
      capability: 'content_generation',
      label: 'Publishing',
      flowType: 'sequential',
      weight: 0.15,
      eligibleFamilies: ['openai'],
    },
  ],
  mode: 'hybrid',
  priority: 'high',
  maxRetries: 2,
  retryDelayMs: 1000,
  maxLatencyMs: 30000,
  expectedTokens: 8000,
  maxCostUsd: 2,
};

export const NEWSLETTER_SEED: GraphInputPayload = {
  strategyId: 'strategy_newsletter_seed',
  goalId: 'goal_newsletter_001',
  goal: 'Generate a monthly client newsletter',
  steps: [
    {
      stepId: 'research',
      capability: 'reasoning',
      label: 'Research',
      flowType: 'sequential',
      weight: 0.3,
      eligibleFamilies: ['openai', 'google'],
    },
    {
      stepId: 'writing',
      capability: 'content_generation',
      label: 'Writing',
      flowType: 'sequential',
      weight: 0.4,
      eligibleFamilies: ['openai'],
    },
    {
      stepId: 'review',
      capability: 'reasoning',
      label: 'Review',
      flowType: 'sequential',
      weight: 0.2,
      eligibleFamilies: ['anthropic', 'openai'],
    },
    {
      stepId: 'publishing',
      capability: 'content_generation',
      label: 'Publishing',
      flowType: 'sequential',
      weight: 0.1,
      eligibleFamilies: ['openai'],
    },
  ],
  mode: 'sequential',
  priority: 'medium',
  maxRetries: 1,
  retryDelayMs: 2000,
  maxLatencyMs: 20000,
  expectedTokens: 6000,
  maxCostUsd: 1.5,
};

export const STATE_BADGE: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'ai' }
> = {
  created: { label: 'Created', variant: 'default' },
  validated: { label: 'Validated', variant: 'info' },
  ready: { label: 'Ready', variant: 'info' },
  running: { label: 'Running', variant: 'ai' },
  waiting: { label: 'Waiting', variant: 'default' },
  paused: { label: 'Paused', variant: 'warning' },
  retrying: { label: 'Retrying', variant: 'warning' },
  completed: { label: 'Completed', variant: 'success' },
  failed: { label: 'Failed', variant: 'danger' },
  cancelled: { label: 'Cancelled', variant: 'danger' },
};

export const CAPABILITY_LABELS: Record<string, string> = {
  reasoning: 'Reasoning',
  coding: 'Coding',
  vision: 'Vision',
  embeddings: 'Embeddings',
  summarization: 'Summarization',
  classification: 'Classification',
  translation: 'Translation',
  speech: 'Speech',
  image_understanding: 'Image Understanding',
  general_conversation: 'General Chat',
  content_generation: 'Content Generation',
};

export const WORKER_KIND_LABELS: Record<string, string> = {
  research: 'Research',
  writing: 'Writing',
  review: 'Review',
  seo: 'SEO',
  publishing: 'Publishing',
  translation: 'Translation',
  ocr: 'OCR',
  vision: 'Vision',
  memory: 'Memory',
  knowledge: 'Knowledge',
  custom: 'Custom',
};

export function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
