// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Memory Intelligence: Seed Catalog
// EI-010 — Enterprise Memory Intelligence Platform
// Realistic seed memory so the platform demonstrates value
// immediately: 23 memories across the 14 memory types, referencing
// the SAME seed entities the other EI catalogs seed
// (goal_blog_seed, openai, anthropic, research capability,
// strat_blog_001, …). Includes relationships, citations, consumers,
// usage, importance + confidence. Used for dev, the web dashboard,
// and tests. Deterministic ids — idempotent upsert.
// ──────────────────────────────────────────────────────────────────

import type {
  MemoryCitation,
  MemoryConsumer,
  MemoryItem,
  MemoryRelationship,
  MemorySourceType,
} from '../types/memory-types.js';

export const SEED_MEMORY_SIZE = 23;
export const SEED_MEMORY_RELATIONSHIPS_SIZE = 17;

// ── Compact item spec ────────────────────────────────────────────────────────

interface ItemSpec {
  id: string;
  type: MemoryItem['type'];
  title: string;
  content: string;
  source: string;
  sourceType: MemorySourceType;
  owner: string;
  relatedGoal?: string;
  relatedTask?: string;
  relatedCapability?: string;
  relatedProvider?: string;
  relatedProject?: string;
  relatedUser?: string;
  relatedContext?: string;
  relatedDecision?: string;
  relatedExecution?: string;
  tags: string[];
  importance: number;
  confidence: number;
  retrievals: number;
  frequency: number;
  recency: number;
  compression: MemoryItem['compressionState'];
  lifecycle: MemoryItem['lifecycleStatus'];
  retention: MemoryItem['retentionPolicy'];
  citations: Array<{ sourceId: string; sourceTitle: string; reference: string; verified: boolean }>;
  consumers: Array<{
    consumerId: string;
    consumerType: MemoryConsumer['consumerType'];
    consumerLabel: string;
    usageCount: number;
  }>;
  relationships: Array<{
    type: MemoryRelationship['type'];
    target: string;
    weight: number;
    note?: string;
  }>;
  createdAt: string;
}

const SPECS: ItemSpec[] = [
  // ── Provider Memory (EI-002) ──────────────────────────────────────────────
  {
    id: 'mem_openai_reliability',
    type: 'provider',
    title: 'OpenAI stays reliable on reasoning runs',
    content:
      'Three consecutive blog pipeline runs used openai for the reasoning stage. All completed with high quality. Latency stayed under p95. No retries needed in the last two runs.',
    source: 'execution session history (EI-005)',
    sourceType: 'execution',
    owner: 'platform',
    relatedProvider: 'openai',
    relatedCapability: 'reasoning',
    relatedGoal: 'goal_blog_seed',
    relatedExecution: 'exec_blog_001',
    tags: ['openai', 'reliability', 'reasoning', 'success'],
    importance: 0.82,
    confidence: 0.88,
    retrievals: 18,
    frequency: 3,
    recency: 0.95,
    compression: 'summarized',
    lifecycle: 'active',
    retention: 'long_term',
    citations: [
      {
        sourceId: 'provider-registry',
        sourceTitle: 'Enterprise Provider Registry',
        reference: 'providers/openai',
        verified: true,
      },
    ],
    consumers: [
      {
        consumerId: 'enterprise-brain',
        consumerType: 'engine',
        consumerLabel: 'Enterprise Brain (EI-008)',
        usageCount: 12,
      },
    ],
    relationships: [{ type: 'supports', target: 'mem_blog_pipeline_playbook', weight: 0.8 }],
    createdAt: '2026-07-20T08:00:00.000Z',
  },
  {
    id: 'mem_anthropic_long_context',
    type: 'provider',
    title: 'Anthropic handles long-context briefs well',
    content:
      'When the client brief exceeded 30k tokens, anthropic produced the best draft on the first pass. Strong instruction following on brand voice rules.',
    source: 'content-agency execution log (AC-001)',
    sourceType: 'observation',
    owner: 'platform',
    relatedProvider: 'anthropic',
    relatedGoal: 'goal_blog_seed',
    tags: ['anthropic', 'long-context', 'brand-voice'],
    importance: 0.68,
    confidence: 0.8,
    retrievals: 7,
    frequency: 1,
    recency: 0.6,
    compression: 'compressed',
    lifecycle: 'active',
    retention: 'medium_term',
    citations: [
      {
        sourceId: 'content-agency',
        sourceTitle: 'Content Agency executions',
        reference: 'executions/exec_blog_014',
        verified: true,
      },
    ],
    consumers: [
      {
        consumerId: 'learning-intelligence',
        consumerType: 'engine',
        consumerLabel: 'Learning Intelligence (EI-007)',
        usageCount: 5,
      },
    ],
    relationships: [{ type: 'similar_to', target: 'mem_openai_reliability', weight: 0.5 }],
    createdAt: '2026-07-22T09:30:00.000Z',
  },
  // ── Capability Memory (EI-001) ────────────────────────────────────────────
  {
    id: 'mem_research_capability_cost',
    type: 'capability',
    title: 'Research capability run cost estimate holds',
    content:
      'The research capability averaged $0.004 per run across the last 20 pipeline executions, matching the registry estimate. Confidence high — no budget surprises.',
    source: 'execution analytics (EI-005)',
    sourceType: 'execution',
    owner: 'platform',
    relatedCapability: 'research',
    relatedGoal: 'goal_blog_seed',
    tags: ['research', 'cost', 'budget'],
    importance: 0.72,
    confidence: 0.86,
    retrievals: 11,
    frequency: 2,
    recency: 0.7,
    compression: 'compressed',
    lifecycle: 'active',
    retention: 'medium_term',
    citations: [
      {
        sourceId: 'capability-registry',
        sourceTitle: 'Enterprise Capability Registry',
        reference: 'capabilities/research',
        verified: true,
      },
    ],
    consumers: [
      {
        consumerId: 'enterprise-brain',
        consumerType: 'engine',
        consumerLabel: 'Enterprise Brain (EI-008)',
        usageCount: 9,
      },
    ],
    relationships: [{ type: 'depends_on', target: 'mem_openai_reliability', weight: 0.6 }],
    createdAt: '2026-07-21T10:00:00.000Z',
  },
  // ── Goal Memory (EI-006) ──────────────────────────────────────────────────
  {
    id: 'mem_blog_goal_success_pattern',
    type: 'success',
    title: 'Blog goal succeeds with pipeline mode',
    content:
      'goal_blog_seed reached a ready pipeline in every attempt when using pipeline mode with the research → draft → review → publish chain. Budget envelope $0.5–$1 held. 90% quality gate passed on the second review.',
    source: 'goal registry + pipeline history (EI-006)',
    sourceType: 'goal',
    owner: 'operations',
    relatedGoal: 'goal_blog_seed',
    tags: ['blog', 'pipeline', 'success', 'goal'],
    importance: 0.85,
    confidence: 0.9,
    retrievals: 22,
    frequency: 4,
    recency: 0.9,
    compression: 'summarized',
    lifecycle: 'active',
    retention: 'long_term',
    citations: [
      {
        sourceId: 'goal-registry',
        sourceTitle: 'Enterprise Goal Registry',
        reference: 'goals/goal_blog_seed',
        verified: true,
      },
    ],
    consumers: [
      {
        consumerId: 'enterprise-brain',
        consumerType: 'engine',
        consumerLabel: 'Enterprise Brain (EI-008)',
        usageCount: 14,
      },
    ],
    relationships: [
      { type: 'supports', target: 'mem_blog_pipeline_playbook', weight: 0.7 },
      { type: 'supports', target: 'mem_openai_reliability', weight: 0.6 },
    ],
    createdAt: '2026-07-23T11:00:00.000Z',
  },
  // ── Failure Memory ────────────────────────────────────────────────────────
  {
    id: 'mem_google_vision_failure',
    type: 'failure',
    title: 'google vision stage failed twice in a row',
    content:
      'The vision stage using google failed twice in consecutive pipeline runs with quota errors. Fallback to deepseek succeeded but added 4 minutes latency. Learning event recorded for provider fallback.',
    source: 'orchestrator failure log (EI-005)',
    sourceType: 'execution',
    owner: 'platform',
    relatedProvider: 'google',
    relatedCapability: 'vision',
    relatedGoal: 'goal_blog_seed',
    relatedExecution: 'exec_blog_021',
    tags: ['google', 'vision', 'failure', 'fallback'],
    importance: 0.78,
    confidence: 0.84,
    retrievals: 9,
    frequency: 2,
    recency: 0.65,
    compression: 'compressed',
    lifecycle: 'active',
    retention: 'medium_term',
    citations: [
      {
        sourceId: 'orchestrator',
        sourceTitle: 'Execution Orchestrator failures',
        reference: 'failures/exec_blog_021',
        verified: true,
      },
    ],
    consumers: [
      {
        consumerId: 'learning-intelligence',
        consumerType: 'engine',
        consumerLabel: 'Learning Intelligence (EI-007)',
        usageCount: 11,
      },
    ],
    relationships: [{ type: 'contradicts', target: 'mem_openai_reliability', weight: 0.7 }],
    createdAt: '2026-07-24T13:00:00.000Z',
  },
  // ── Execution Memory (EI-005) ─────────────────────────────────────────────
  {
    id: 'mem_blog_pipeline_playbook',
    type: 'execution',
    title: 'Blog pipeline execution playbook',
    content:
      'End-to-end runbook for the blog goal: research → draft → review → publish. Pipeline mode. Provider fallback chain anthropic → google → deepseek. Review stage required after every draft.',
    source: 'execution-strategy registry (EI-004)',
    sourceType: 'business',
    owner: 'platform',
    relatedGoal: 'goal_blog_seed',
    relatedExecution: 'exec_blog_001',
    tags: ['blog', 'pipeline', 'playbook'],
    importance: 0.8,
    confidence: 0.85,
    retrievals: 15,
    frequency: 3,
    recency: 0.8,
    compression: 'summarized',
    lifecycle: 'active',
    retention: 'long_term',
    citations: [
      {
        sourceId: 'execution-strategy-registry',
        sourceTitle: 'Execution Strategy Registry',
        reference: 'strategies/strat_blog_001',
        verified: true,
      },
    ],
    consumers: [
      {
        consumerId: 'enterprise-brain',
        consumerType: 'engine',
        consumerLabel: 'Enterprise Brain (EI-008)',
        usageCount: 12,
      },
      {
        consumerId: 'content-agency',
        consumerType: 'module',
        consumerLabel: 'Content Agency (AC-001)',
        usageCount: 6,
      },
    ],
    relationships: [{ type: 'produced_by', target: 'mem_blog_goal_success_pattern', weight: 0.8 }],
    createdAt: '2026-07-22T10:00:00.000Z',
  },
  // ── Decision Memory (EI-008) ──────────────────────────────────────────────
  {
    id: 'mem_brain_approved_handoff',
    type: 'decision',
    title: 'Brain approved plan_goal_blog_seed_seed',
    content:
      'The Enterprise Brain decision plan for goal_blog_seed was approved and handed to the orchestrator. Provider selection chose openai with anthropic fallback. Budget strategy stayed within the $1 envelope.',
    source: 'brain registry (EI-008)',
    sourceType: 'decision',
    owner: 'platform',
    relatedGoal: 'goal_blog_seed',
    relatedDecision: 'plan_goal_blog_seed_seed',
    tags: ['brain', 'decision', 'approval', 'handoff'],
    importance: 0.88,
    confidence: 0.92,
    retrievals: 25,
    frequency: 1,
    recency: 0.85,
    compression: 'summarized',
    lifecycle: 'active',
    retention: 'permanent',
    citations: [
      {
        sourceId: 'brain-registry',
        sourceTitle: 'Enterprise Brain plans',
        reference: 'plans/plan_goal_blog_seed_seed',
        verified: true,
      },
    ],
    consumers: [
      {
        consumerId: 'execution-orchestrator',
        consumerType: 'engine',
        consumerLabel: 'Execution Orchestrator (EI-005)',
        usageCount: 8,
      },
    ],
    relationships: [{ type: 'supports', target: 'mem_blog_goal_success_pattern', weight: 0.9 }],
    createdAt: '2026-07-23T12:00:00.000Z',
  },
  // ── Learning Memory (EI-007) ──────────────────────────────────────────────
  {
    id: 'mem_learning_provider_recommendation',
    type: 'learning',
    title: 'Learning recommends openai for reasoning',
    content:
      'Learning aggregation across 54 events recommends openai for reasoning-stage tasks: 94% success, best accuracy, lowest latency. Recommendation approved by the human operator on 2026-07-29.',
    source: 'learning registry (EI-007)',
    sourceType: 'learning',
    owner: 'platform',
    relatedCapability: 'reasoning',
    relatedProvider: 'openai',
    tags: ['learning', 'recommendation', 'provider', 'reasoning'],
    importance: 0.76,
    confidence: 0.87,
    retrievals: 13,
    frequency: 2,
    recency: 0.75,
    compression: 'summarized',
    lifecycle: 'active',
    retention: 'medium_term',
    citations: [
      {
        sourceId: 'learning-registry',
        sourceTitle: 'Learning recommendation',
        reference: 'recommendations/best_provider',
        verified: true,
      },
    ],
    consumers: [
      {
        consumerId: 'enterprise-brain',
        consumerType: 'engine',
        consumerLabel: 'Enterprise Brain (EI-008)',
        usageCount: 10,
      },
    ],
    relationships: [{ type: 'refines', target: 'mem_openai_reliability', weight: 0.7 }],
    createdAt: '2026-07-29T08:00:00.000Z',
  },
  // ── Context Memory (EI-003) ───────────────────────────────────────────────
  {
    id: 'mem_context_assembly',
    type: 'context',
    title: 'Context assembly prefers threshold compression',
    content:
      'Under 30k tokens threshold compression keeps critical context intact; beyond 30k hybrid performs best. Priority categories first ordering held quality at 92% across 5 assemblies.',
    source: 'context registry (EI-003)',
    sourceType: 'context',
    owner: 'platform',
    relatedContext: 'context_assembly_001',
    tags: ['context', 'compression', 'assembly'],
    importance: 0.64,
    confidence: 0.78,
    retrievals: 6,
    frequency: 1,
    recency: 0.5,
    compression: 'compressed',
    lifecycle: 'active',
    retention: 'short_term',
    citations: [
      {
        sourceId: 'context-registry',
        sourceTitle: 'Enterprise Context Registry',
        reference: 'context/context_assembly_001',
        verified: true,
      },
    ],
    consumers: [
      {
        consumerId: 'context',
        consumerType: 'engine',
        consumerLabel: 'Context Intelligence (EI-003)',
        usageCount: 4,
      },
    ],
    relationships: [],
    createdAt: '2026-07-25T09:00:00.000Z',
  },
  // ── User Preference Memory ────────────────────────────────────────────────
  {
    id: 'mem_user_weekly_digest',
    type: 'user_preference',
    title: 'User prefers weekly execution digest',
    content:
      'The user prefers a weekly digest of execution summaries with confidence displayed. Selected in the Q2 preferences survey. The learning module honors this for the delivery format.',
    source: 'user research survey Q2',
    sourceType: 'user',
    owner: 'product',
    relatedUser: 'user_demo',
    tags: ['user', 'preference', 'digest', 'weekly'],
    importance: 0.58,
    confidence: 0.7,
    retrievals: 4,
    frequency: 1,
    recency: 0.4,
    compression: 'compressed',
    lifecycle: 'active',
    retention: 'long_term',
    citations: [
      {
        sourceId: 'user-research',
        sourceTitle: 'User research archive',
        reference: 'surveys/Q2-preferences.pdf',
        verified: false,
      },
    ],
    consumers: [
      {
        consumerId: 'learning-intelligence',
        consumerType: 'engine',
        consumerLabel: 'Learning Intelligence (EI-007)',
        usageCount: 3,
      },
    ],
    relationships: [],
    createdAt: '2026-07-12T08:00:00.000Z',
  },
  // ── Project Memory ────────────────────────────────────────────────────────
  {
    id: 'mem_mobile_release_notes',
    type: 'project',
    title: 'Mobile project — Capacitor wrapper notes',
    content:
      'MOB-002: edge-to-edge insets, secure storage, splash API, back-button policy. Android 15 enforces edge-to-edge; the WebView handles insets via viewport-fit=cover.',
    source: 'mobile project log',
    sourceType: 'project',
    owner: 'mobile',
    relatedProject: 'project_mobile',
    tags: ['mobile', 'capacitor', 'android'],
    importance: 0.52,
    confidence: 0.75,
    retrievals: 3,
    frequency: 1,
    recency: 0.3,
    compression: 'compressed',
    lifecycle: 'active',
    retention: 'short_term',
    citations: [],
    consumers: [],
    relationships: [],
    createdAt: '2026-07-31T08:00:00.000Z',
  },
  // ── Session Memory ────────────────────────────────────────────────────────
  {
    id: 'mem_session_20260730_morning',
    type: 'session',
    title: 'Morning session — goal review standup',
    content:
      'Session covered the blog goal status, the vision-stage failure, and the learning recommendation approval. Next action: re-run pipeline with the fallback chain.',
    source: 'session log',
    sourceType: 'event',
    owner: 'operations',
    relatedGoal: 'goal_blog_seed',
    relatedUser: 'user_demo',
    tags: ['session', 'standup', 'goal-review'],
    importance: 0.45,
    confidence: 0.68,
    retrievals: 2,
    frequency: 1,
    recency: 0.15,
    compression: 'raw',
    lifecycle: 'compressed',
    retention: 'ephemeral',
    citations: [],
    consumers: [],
    relationships: [{ type: 'follows', target: 'mem_google_vision_failure', weight: 0.6 }],
    createdAt: '2026-07-30T08:00:00.000Z',
  },
  // ── Working Memory ────────────────────────────────────────────────────────
  {
    id: 'mem_working_budget_track',
    type: 'working',
    title: 'Working — current budget track',
    content:
      'Q3 budget track: spent $2.31 of the $10 allocation across content executions. The blog pipeline consumed $0.6. No action required yet.',
    source: 'budget telemetry',
    sourceType: 'business',
    owner: 'operations',
    relatedGoal: 'goal_blog_seed',
    tags: ['budget', 'working', 'q3'],
    importance: 0.62,
    confidence: 0.8,
    retrievals: 8,
    frequency: 2,
    recency: 0.85,
    compression: 'compressed',
    lifecycle: 'active',
    retention: 'ephemeral',
    citations: [],
    consumers: [
      {
        consumerId: 'enterprise-brain',
        consumerType: 'engine',
        consumerLabel: 'Enterprise Brain (EI-008)',
        usageCount: 5,
      },
    ],
    relationships: [],
    createdAt: '2026-08-02T08:00:00.000Z',
  },
  // ── Business Memory ───────────────────────────────────────────────────────
  {
    id: 'mem_client_acme_tone',
    type: 'business',
    title: 'Acme prefers concise, data-led content',
    content:
      'Client Acme Inc. reviews drafts for data density and concise phrasing. Brand voice rules from the onboarding pack apply. Two review rounds were needed until tone matched.',
    source: 'client onboarding + review history',
    sourceType: 'business',
    owner: 'account-team',
    relatedGoal: 'goal_blog_seed',
    relatedProject: 'project_acme',
    tags: ['acme', 'client', 'tone', 'content'],
    importance: 0.7,
    confidence: 0.82,
    retrievals: 10,
    frequency: 2,
    recency: 0.72,
    compression: 'summarized',
    lifecycle: 'active',
    retention: 'long_term',
    citations: [
      {
        sourceId: 'client-docs',
        sourceTitle: 'Acme onboarding pack',
        reference: 'acme/brand-guide.pdf',
        verified: false,
      },
    ],
    consumers: [
      {
        consumerId: 'content-agency',
        consumerType: 'module',
        consumerLabel: 'Content Agency (AC-001)',
        usageCount: 7,
      },
    ],
    relationships: [{ type: 'supports', target: 'mem_blog_goal_success_pattern', weight: 0.6 }],
    createdAt: '2026-07-18T11:00:00.000Z',
  },
  // ── Long-Term Memory ──────────────────────────────────────────────────────
  {
    id: 'mem_lt_company_glossary',
    type: 'long_term',
    title: 'Company glossary — canonical terms',
    content:
      'Life OS glossary: goal, task, execution, knowledge, learning, decision. Shared vocabulary across all modules to avoid concept drift. Reviewed by program management.',
    source: 'company glossary',
    sourceType: 'manual',
    owner: 'program-management',
    tags: ['glossary', 'domain', 'canonical'],
    importance: 0.6,
    confidence: 0.8,
    retrievals: 5,
    frequency: 1,
    recency: 0.35,
    compression: 'compressed',
    lifecycle: 'active',
    retention: 'permanent',
    citations: [
      {
        sourceId: '09_Documents',
        sourceTitle: 'Company Glossary',
        reference: 'Company Glossary.md',
        verified: true,
      },
    ],
    consumers: [],
    relationships: [],
    createdAt: '2026-07-06T08:00:00.000Z',
  },
  // ── Provider failure / context / success variety ──────────────────────────
  {
    id: 'mem_deepseek_fallback_ok',
    type: 'provider',
    title: 'deepseek fallback saved the vision run',
    content:
      'When google hit quota limits, deepseek completed the vision stage with acceptable quality. Adds latency but avoids a failed pipeline. Keep deepseek in the fallback chain.',
    source: 'orchestrator fallback log (EI-005)',
    sourceType: 'observation',
    owner: 'platform',
    relatedProvider: 'deepseek',
    relatedCapability: 'vision',
    relatedGoal: 'goal_blog_seed',
    tags: ['deepseek', 'fallback', 'vision'],
    importance: 0.66,
    confidence: 0.79,
    retrievals: 8,
    frequency: 2,
    recency: 0.6,
    compression: 'compressed',
    lifecycle: 'active',
    retention: 'medium_term',
    citations: [
      {
        sourceId: 'orchestrator',
        sourceTitle: 'Execution Orchestrator fallbacks',
        reference: 'fallbacks/exec_blog_021',
        verified: true,
      },
    ],
    consumers: [
      {
        consumerId: 'learning-intelligence',
        consumerType: 'engine',
        consumerLabel: 'Learning Intelligence (EI-007)',
        usageCount: 6,
      },
    ],
    relationships: [{ type: 'recalls', target: 'mem_google_vision_failure', weight: 0.8 }],
    createdAt: '2026-07-24T14:00:00.000Z',
  },
  {
    id: 'mem_context_draft_brief',
    type: 'context',
    title: 'Draft brief context for the next blog run',
    content:
      'Draft context for the next execution: target 1 400 words, tone concise + data-led, quality gate 90%, audience client procurement leads.',
    source: 'draft context capture',
    sourceType: 'observation',
    owner: 'operations',
    relatedGoal: 'goal_blog_seed',
    relatedContext: 'context_brief_002',
    tags: ['context', 'draft', 'brief'],
    importance: 0.42,
    confidence: 0.65,
    retrievals: 1,
    frequency: 1,
    recency: 0.2,
    compression: 'raw',
    lifecycle: 'compressed',
    retention: 'ephemeral',
    citations: [],
    consumers: [],
    relationships: [],
    createdAt: '2026-08-04T08:00:00.000Z',
  },
  {
    id: 'mem_success_quality_gate',
    type: 'success',
    title: 'Quality gate passed on second review',
    content:
      'The 90% quality gate passed on the second review after tone adjustments. Confirms the review-stage-required pattern for client-facing content.',
    source: 'content-agency review history',
    sourceType: 'event',
    owner: 'operations',
    relatedGoal: 'goal_blog_seed',
    relatedProject: 'project_acme',
    tags: ['quality-gate', 'success', 'review'],
    importance: 0.56,
    confidence: 0.77,
    retrievals: 4,
    frequency: 1,
    recency: 0.45,
    compression: 'compressed',
    lifecycle: 'active',
    retention: 'medium_term',
    citations: [],
    consumers: [
      {
        consumerId: 'content-agency',
        consumerType: 'module',
        consumerLabel: 'Content Agency (AC-001)',
        usageCount: 3,
      },
    ],
    relationships: [{ type: 'supports', target: 'mem_blog_goal_success_pattern', weight: 0.7 }],
    createdAt: '2026-07-24T15:00:00.000Z',
  },
  {
    id: 'mem_user_prefers_markdown',
    type: 'user_preference',
    title: 'User prefers markdown deliverables',
    content:
      'Markdown preferred over HTML/PDF for drafts; PDF only for the final client delivery. Recorded from delivery preferences.',
    source: 'delivery preferences',
    sourceType: 'user',
    owner: 'product',
    relatedUser: 'user_demo',
    tags: ['user', 'delivery', 'markdown'],
    importance: 0.48,
    confidence: 0.72,
    retrievals: 3,
    frequency: 1,
    recency: 0.3,
    compression: 'compressed',
    lifecycle: 'active',
    retention: 'long_term',
    citations: [],
    consumers: [],
    relationships: [],
    createdAt: '2026-07-14T08:00:00.000Z',
  },
  // ── Decision + learning variety ───────────────────────────────────────────
  {
    id: 'mem_decision_budget_strategy',
    type: 'decision',
    title: 'Budget strategy stayed within $1 envelope',
    content:
      'Decision: keep the $0.5–$1 budget envelope for blog pipeline. Confirmed by the last three executions; no overspend recorded.',
    source: 'brain registry (EI-008)',
    sourceType: 'decision',
    owner: 'platform',
    relatedGoal: 'goal_blog_seed',
    relatedDecision: 'decision_budget_blog',
    tags: ['budget', 'decision', 'envelope'],
    importance: 0.74,
    confidence: 0.83,
    retrievals: 12,
    frequency: 3,
    recency: 0.77,
    compression: 'summarized',
    lifecycle: 'active',
    retention: 'long_term',
    citations: [],
    consumers: [
      {
        consumerId: 'enterprise-brain',
        consumerType: 'engine',
        consumerLabel: 'Enterprise Brain (EI-008)',
        usageCount: 8,
      },
    ],
    relationships: [{ type: 'depends_on', target: 'mem_research_capability_cost', weight: 0.6 }],
    createdAt: '2026-07-26T08:00:00.000Z',
  },
  {
    id: 'mem_learning_latency_signal',
    type: 'learning',
    title: 'Latency signals: openai p50 beats others',
    content:
      'Across learning events, openai p50 latency is 40% below google for reasoning. Relevant when the goal has a latency constraint.',
    source: 'learning registry (EI-007)',
    sourceType: 'learning',
    owner: 'platform',
    relatedProvider: 'openai',
    relatedCapability: 'reasoning',
    tags: ['latency', 'learning', 'provider'],
    importance: 0.6,
    confidence: 0.81,
    retrievals: 6,
    frequency: 1,
    recency: 0.55,
    compression: 'compressed',
    lifecycle: 'active',
    retention: 'medium_term',
    citations: [],
    consumers: [
      {
        consumerId: 'enterprise-brain',
        consumerType: 'engine',
        consumerLabel: 'Enterprise Brain (EI-008)',
        usageCount: 6,
      },
    ],
    relationships: [{ type: 'refines', target: 'mem_openai_reliability', weight: 0.6 }],
    createdAt: '2026-07-27T08:00:00.000Z',
  },
  // ── Session + working closing set ─────────────────────────────────────────
  {
    id: 'mem_session_20260801_close',
    type: 'session',
    title: 'End-of-week session — outcomes summary',
    content:
      'Weekly summary: blog pipeline ready, vision fallback chain tested, learning recommendation approved, budget at 23% of Q3 allocation.',
    source: 'session log',
    sourceType: 'event',
    owner: 'operations',
    relatedGoal: 'goal_blog_seed',
    tags: ['session', 'weekly', 'summary'],
    importance: 0.5,
    confidence: 0.7,
    retrievals: 2,
    frequency: 1,
    recency: 0.25,
    compression: 'raw',
    lifecycle: 'compressed',
    retention: 'ephemeral',
    citations: [],
    consumers: [],
    relationships: [{ type: 'follows', target: 'mem_session_20260730_morning', weight: 0.7 }],
    createdAt: '2026-08-01T17:00:00.000Z',
  },
  {
    id: 'mem_working_next_action',
    type: 'working',
    title: 'Working — next action: re-run with fallback',
    content:
      'Next action recorded: re-run the blog pipeline with the fallback chain, expect the vision stage to use deepseek if google is still throttled.',
    source: 'working memory capture',
    sourceType: 'observation',
    owner: 'operations',
    relatedGoal: 'goal_blog_seed',
    tags: ['working', 'next-action', 'pipeline'],
    importance: 0.54,
    confidence: 0.66,
    retrievals: 3,
    frequency: 1,
    recency: 0.4,
    compression: 'raw',
    lifecycle: 'compressed',
    retention: 'ephemeral',
    citations: [],
    consumers: [],
    relationships: [{ type: 'recalls', target: 'mem_deepseek_fallback_ok', weight: 0.6 }],
    createdAt: '2026-08-05T08:00:00.000Z',
  },
];

// ── Builders ─────────────────────────────────────────────────────────────────

function level(score: number): MemoryItem['importance']['level'] {
  return score >= 0.8 ? 'high' : score >= 0.5 ? 'medium' : 'low';
}

function item(spec: ItemSpec): MemoryItem {
  const now = spec.createdAt;
  const citations: MemoryCitation[] = spec.citations.map((c) => ({
    citationId: `mcit_seed_${spec.id}_${c.sourceId.replace(/[^a-z0-9]/gi, '')}`,
    sourceId: c.sourceId,
    sourceTitle: c.sourceTitle,
    sourceType: spec.sourceType,
    reference: c.reference,
    retrievedAt: now,
    verified: c.verified,
  }));
  const consumers: MemoryConsumer[] = spec.consumers.map((c) => ({
    consumerId: c.consumerId,
    consumerType: c.consumerType,
    consumerLabel: c.consumerLabel,
    usageCount: c.usageCount,
    firstUsedAt: now,
    lastUsedAt: now,
  }));
  const relationships: MemoryRelationship[] = spec.relationships.map((r) => ({
    relationshipId: `mrel_seed_${spec.id}_${r.target}`,
    type: r.type,
    sourceId: spec.id,
    sourceTitle: spec.title,
    targetId: r.target,
    targetTitle: undefined,
    weight: r.weight,
    actor: 'memory-platform',
    note: r.note,
    createdAt: now,
  }));
  const content = spec.content;
  const summary =
    spec.compression === 'raw'
      ? undefined
      : content.length > 200
        ? `${content.slice(0, 200)}…`
        : content;
  return {
    memoryId: spec.id,
    type: spec.type,
    title: spec.title,
    content,
    summary,
    source: spec.source,
    sourceType: spec.sourceType,
    owner: spec.owner,
    relatedGoal: spec.relatedGoal,
    relatedTask: spec.relatedTask,
    relatedCapability: spec.relatedCapability,
    relatedProvider: spec.relatedProvider,
    relatedProject: spec.relatedProject,
    relatedUser: spec.relatedUser,
    relatedContext: spec.relatedContext,
    relatedDecision: spec.relatedDecision,
    relatedExecution: spec.relatedExecution,
    tags: spec.tags,
    importance: {
      score: spec.importance,
      level: level(spec.importance),
      factors: ['seed importance', `type ${spec.type} salience`],
    },
    confidence: {
      score: spec.confidence,
      level: level(spec.confidence),
      factors: [`source ${spec.sourceType} reliability`, 'seed confidence'],
    },
    usage: {
      totalRetrievals: spec.retrievals,
      totalConsumers: consumers.length,
      frequency: spec.frequency,
      recency: spec.recency,
    },
    lifecycleStatus: spec.lifecycle,
    compressionState: spec.compression,
    retentionPolicy: spec.retention,
    consumers,
    relationships,
    citations,
    audit: [
      {
        auditId: `maud_seed_${spec.id}_captured`,
        action: 'captured',
        actor: 'memory-platform',
        note: `Captured from ${spec.source}`,
        timestamp: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

/** Build the full seed registry (23 items, deterministic ids — idempotent upsert). */
export function createCatalogMemoryItems(): MemoryItem[] {
  return SPECS.map(item);
}

/** All relationship edges of the seed catalog (referencing only seed items). */
export function createCatalogMemoryRelationships(): MemoryRelationship[] {
  return createCatalogMemoryItems().flatMap((i) => i.relationships);
}

/** Convenience: the seed items keyed by id (tests + seed script). */
export function createCatalogMemoryItemMap(): Map<string, MemoryItem> {
  const map = new Map<string, MemoryItem>();
  for (const item of createCatalogMemoryItems()) map.set(item.memoryId, item);
  return map;
}

/** True when all 14 memory types are present (catalog integrity check). */
export function hasAllMemoryTypes(items: readonly MemoryItem[]): boolean {
  const present = new Set(items.map((i) => i.type));
  return [
    'working',
    'session',
    'project',
    'business',
    'capability',
    'provider',
    'execution',
    'decision',
    'learning',
    'context',
    'user_preference',
    'failure',
    'success',
    'long_term',
  ].every((type) => present.has(type as MemoryItem['type']));
}
