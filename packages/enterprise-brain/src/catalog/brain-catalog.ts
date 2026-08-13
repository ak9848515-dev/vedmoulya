// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Brain: Seed Catalog
// EI-008 — Enterprise Brain (Central Decision Intelligence)
// Realistic seed decision plan so the platform demonstrates value
// immediately: one fully explained plan for the seed blog goal
// (`goal_blog_seed`) with all 14 decision types, referencing the same
// seed entities the other EI catalogs seed (openai, anthropic, google,
// research, strat_blog_001, budget_standard, …). Used for dev, the
// web dashboard, and tests.
// ──────────────────────────────────────────────────────────────────

import type {
  BrainDecision,
  BrainDecisionPlan,
  BrainDecisionReason,
  BrainDecisionStatus,
  BrainDecisionType,
  BrainRecommendation,
} from '../types/brain-types.js';
import { BRAIN_DECISION_TYPE_LABELS, BRAIN_DECISION_TYPES } from '../types/brain-types.js';
import { createBrainDecisionId, generateAuditId } from '../domain/value-objects/BrainDecisionId.js';

export const SEED_PLAN_ID = 'plan_goal_blog_seed_seed';
export const SEED_GOAL_ID = 'goal_blog_seed';
export const SEED_DECISIONS_SIZE = 14;
export const SEED_PLANS_SIZE = 1;

const NOW = '2026-08-05T09:30:00.000Z';

interface SeedDecisionSpec {
  type: BrainDecisionType;
  recommendation: BrainRecommendation;
  confidence: { score: number; factors: string[] };
  reason: BrainDecisionReason;
  status?: BrainDecisionStatus;
}

function decision(planId: string, goalId: string, spec: SeedDecisionSpec): BrainDecision {
  const status = spec.status ?? 'proposed';
  const version = status === 'proposed' ? 1 : 2;
  return {
    decisionId: createBrainDecisionId(`bd_${planId}_${spec.type}`),
    planId,
    goalId,
    type: spec.type,
    title: BRAIN_DECISION_TYPE_LABELS[spec.type],
    description: spec.reason.why,
    recommendation: spec.recommendation,
    confidence: {
      score: spec.confidence.score,
      level:
        spec.confidence.score >= 0.8 ? 'high' : spec.confidence.score >= 0.5 ? 'medium' : 'low',
      factors: spec.confidence.factors,
    },
    reason: spec.reason,
    context: {
      goalId,
      goalTitle: 'Publish a client blog post',
      goalCategory: 'business',
      goalPriority: 'high',
      business: ['content-agency', 'blog'],
      budgetUsd: 1,
      engineSources: [],
      observedAt: NOW,
    },
    status,
    version,
    actor: status === 'proposed' ? 'enterprise-brain' : 'human-owner',
    history: [
      {
        auditId: generateAuditId(),
        action: 'created',
        version: 1,
        actor: 'enterprise-brain',
        timestamp: NOW,
      },
      ...(status === 'proposed'
        ? []
        : [
            {
              auditId: generateAuditId(),
              action: status,
              version: 2,
              actor: 'human-owner',
              timestamp: NOW,
            },
          ]),
    ],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

/** Build the seed plan + its 14 decisions (deterministic ids — idempotent upsert). */
export function createCatalogBrainPlan(): { plan: BrainDecisionPlan; decisions: BrainDecision[] } {
  const planId = SEED_PLAN_ID;
  const goalId = SEED_GOAL_ID;

  const specs: SeedDecisionSpec[] = [
    {
      type: 'goal_priority',
      status: 'approved',
      recommendation: {
        entityType: 'goal',
        entityId: 'goal_blog_seed',
        entityLabel: 'Publish a client blog post',
        action: 'prioritize',
        params: { priority: 'high', goalScore: 0.82, urgency: 0.7, importance: 0.9 },
      },
      confidence: {
        score: 0.86,
        factors: ['Goal score 0.82 with confidence 0.9', 'Declared priority high'],
      },
      reason: {
        why: 'Prioritize "Publish a client blog post" for the content-agency pipeline.',
        evidence: [
          'Goal scores 0.82 with 0.9 confidence.',
          'High priority: urgency 0.7, importance 0.9.',
        ],
        tradeoffs: [
          'Defers lower-value backlog goals.',
          'Client delivery window constrains schedule.',
        ],
        alternatives: ['Re-balance toward strategic importance only.'],
        risks: ['Stale goal score if the brief changes.'],
      },
    },
    {
      type: 'task_priority',
      recommendation: {
        entityType: 'task',
        entityId: 'task_summary_01',
        entityLabel: 'Research outline',
        action: 'prioritize',
        params: { order: ['task_summary_01', 'task_summary_02'], topTaskIds: ['task_summary_01'] },
      },
      confidence: {
        score: 0.78,
        factors: ['Task queue derived from priority, urgency, importance'],
      },
      reason: {
        why: 'Order the blog goal tasks so research precedes drafting.',
        evidence: [
          '2 task(s) ranked; "Research outline" leads.',
          'Critical path: research → draft.',
        ],
        tradeoffs: ['Critical tasks jump the queue.'],
        alternatives: ['Prioritize by estimated cost first.'],
        risks: ['Draft depends on research completion.'],
      },
    },
    {
      type: 'execution_order',
      recommendation: {
        entityType: 'execution',
        entityId: 'execution_order',
        entityLabel: '2-step dependency-safe order',
        action: 'order',
        params: { order: ['task_summary_01', 'task_summary_02'], parallelEligible: false },
      },
      confidence: { score: 0.72, factors: ['Dependency-safe ordering'] },
      reason: {
        why: 'Define the execution order for the blog pipeline.',
        evidence: ['Ordered 2 task(s); 0 parallel-eligible.', 'Prerequisites precede dependents.'],
        tradeoffs: ['Sequential order maximizes determinism.'],
        alternatives: ['Fully parallel when dependencies shrink.'],
        risks: ['Hidden cross-task dependencies can stall.'],
      },
    },
    {
      type: 'capability_selection',
      status: 'approved',
      recommendation: {
        entityType: 'capability',
        entityId: 'research',
        entityLabel: 'Research',
        action: 'use',
        params: { requiredCapabilities: ['research'], estimatedCostUsd: 0.004, confidence: 0.94 },
      },
      confidence: { score: 0.85, factors: ['Registry match "Research"', 'Goal requires research'] },
      reason: {
        why: 'Pick the capability that best serves the blog brief.',
        evidence: [
          'Capability Registry: 13 capability(ies), 11 active.',
          'Goal requires: research.',
          'Selected "Research".',
        ],
        tradeoffs: ['Broad capabilities cost more per run.', 'Narrow capabilities are cheaper.'],
        alternatives: ['A composition of smaller capabilities'],
        risks: ['Registry staleness can select past quality minimum.'],
      },
    },
    {
      type: 'provider_selection',
      recommendation: {
        entityType: 'provider',
        entityId: 'openai',
        entityLabel: 'OpenAI',
        action: 'use',
        params: { source: 'learning', value: 0.92, confidence: 0.9, sampleCount: 5 },
      },
      confidence: { score: 0.84, factors: ['Learned from observed outcomes (EI-007)'] },
      reason: {
        why: 'Choose the provider for the blog pipeline using learned outcomes.',
        evidence: ['Learning recommends "OpenAI" (0.92 value, 5 samples).', 'Selected: OpenAI.'],
        tradeoffs: ['Premium providers raise quality but multiply cost.'],
        alternatives: ['Anthropic', 'DeepSeek'],
        risks: ['Provider outages invalidate the selection mid-run.'],
      },
    },
    {
      type: 'context_strategy',
      recommendation: {
        entityType: 'context',
        entityId: 'context_strategy_standard',
        entityLabel: 'Threshold compression',
        action: 'assemble',
        params: {
          priorityCategories: ['knowledge', 'brand'],
          compression: 'threshold',
          maxContextTokens: 20000,
        },
      },
      confidence: { score: 0.75, factors: ['Context registry summary available (30 items)'] },
      reason: {
        why: 'Define how the blog goal assembles context.',
        evidence: [
          'Context Registry: 30 item(s), 48 200 token(s).',
          'High-priority: knowledge, brand.',
        ],
        tradeoffs: ['Richer context improves quality but grows cost.'],
        alternatives: ['Minimal context (critical only)', 'Full context, no compression'],
        risks: ['Stale context misleads decisions.'],
      },
    },
    {
      type: 'execution_strategy',
      recommendation: {
        entityType: 'strategy',
        entityId: 'strat_blog_001',
        entityLabel: 'Blog pipeline strategy',
        action: 'apply',
        params: { mode: 'pipeline', strategyId: 'strat_blog_001' },
      },
      confidence: { score: 0.8, factors: ['Learned best strategy (EI-007)'] },
      reason: {
        why: 'Select the execution strategy for the blog goal.',
        evidence: [
          'Execution Strategy Engine: 4 strategy(ies), avg confidence 0.84.',
          'Learning prefers "Blog pipeline strategy".',
        ],
        tradeoffs: ['Pipeline mode maximizes throughput, harder to debug.'],
        alternatives: ['Hybrid mode', 'Sequential mode'],
        risks: ['Strategy budgets can be exceeded by cost drift.'],
      },
    },
    {
      type: 'budget_strategy',
      recommendation: {
        entityType: 'budget',
        entityId: 'budget_envelope',
        entityLabel: '$0.5–$1 envelope ($0.1/run)',
        action: 'allocate',
        params: { budgetMinUsd: 0.5, budgetMaxUsd: 1, perRunUsd: 0.1, currency: 'USD' },
      },
      confidence: { score: 0.8, factors: ['Learned budget average (EI-007)'] },
      reason: {
        why: 'Set the budget envelope for the blog goal.',
        evidence: [
          'Goal classification estimates $0.5–$1 per execution.',
          'Learned best budget observed ~$0.55/run.',
        ],
        tradeoffs: ['Tight budgets force cheaper providers.'],
        alternatives: ['Raise the envelope for premium quality'],
        risks: ['Provider cost drift breaks the envelope.'],
      },
    },
    {
      type: 'quality_threshold',
      recommendation: {
        entityType: 'quality',
        entityId: 'quality_strict',
        entityLabel: '90% quality gate',
        action: 'enforce',
        params: { qualityThreshold: 0.9, qualityMinimum: 0.75 },
      },
      confidence: { score: 0.8, factors: ['Derived from goal priority high'] },
      reason: {
        why: 'Set the quality gate for client-facing blog output.',
        evidence: ['Goal priority high → strict quality gate.', 'Threshold: 90%.'],
        tradeoffs: ['Strict gate increases retries and cost.'],
        alternatives: ['Standard gate (75%) for internal drafts'],
        risks: ['Unachievable gate blocks delivery.'],
      },
    },
    {
      type: 'risk_assessment',
      recommendation: {
        entityType: 'goal',
        entityId: 'goal_blog_seed',
        entityLabel: 'medium risk posture',
        action: 'mitigate',
        params: {
          riskScore: 0.42,
          riskLevel: 'medium',
          risks: ['Observed platform failures: 9', 'Client deadline constraints'],
        },
      },
      confidence: { score: 0.75, factors: ['From the goal classification'] },
      reason: {
        why: 'Assess the risk posture of the blog goal.',
        evidence: [
          'Classification risk 0.42 (medium); complexity standard.',
          'Learning recorded 9 platform failures.',
        ],
        tradeoffs: ['Conservative posture protects quality at cost of speed.'],
        alternatives: ['Re-run classification after more context'],
        risks: ['Unmodeled dependencies surface as failures.'],
      },
    },
    {
      type: 'retry_policy',
      recommendation: {
        entityType: 'retry',
        entityId: 'retry_3',
        entityLabel: 'max 3 retries',
        action: 'configure',
        params: {
          maxRetries: 3,
          retryDelayMs: 1000,
          retryableFailures: ['timeout', 'rate_limit', 'transient_error'],
        },
      },
      confidence: { score: 0.75, factors: ['Derived from 54 observed events'] },
      reason: {
        why: 'Define how many times blog steps may retry.',
        evidence: ['Observed failure rate ~17% → 3 retries.', 'Retry delay 1000 ms.'],
        tradeoffs: ['Generous retries recover transient failures but add cost.'],
        alternatives: ['Exponential backoff (2× per retry)'],
        risks: ['Retry storms amplify provider outages.'],
      },
    },
    {
      type: 'fallback_policy',
      recommendation: {
        entityType: 'fallback',
        entityId: 'fallback_chain',
        entityLabel: 'anthropic → google → deepseek',
        action: 'configure',
        params: { fallbackOrder: ['anthropic', 'google', 'deepseek'], strategy: 'next_healthy' },
      },
      confidence: { score: 0.7, factors: ['From provider fleet health (EI-002)'] },
      reason: {
        why: 'Define the fallback chain so a failing provider never blocks delivery.',
        evidence: [
          'Fallback order derived from 4 healthy provider(s).',
          'Chain: anthropic → google → deepseek.',
        ],
        tradeoffs: ['Long chains maximize resilience but hide systemic issues.'],
        alternatives: ['Same-family fallback first'],
        risks: ['Fallback can exceed the budget envelope.'],
      },
    },
    {
      type: 'learning_feedback',
      recommendation: {
        entityType: 'learning',
        entityId: 'learning_feedback_goal',
        entityLabel: 'provider · context · capability · execution',
        action: 'record',
        params: {
          categories: ['provider', 'context', 'capability', 'execution'],
          sourceType: 'goal',
          goalId: 'goal_blog_seed',
        },
      },
      confidence: { score: 0.8, factors: ['Learning platform live (54 events)'] },
      reason: {
        why: 'Close the loop for the blog goal.',
        evidence: [
          'Learning holds 54 event(s), 12 model(s).',
          'Signals: provider, context, capability, execution.',
        ],
        tradeoffs: ['Rich feedback improves future decisions but adds overhead.'],
        alternatives: ['Record only provider + capability outcomes'],
        risks: ['Unrecorded runs leave blind spots.'],
      },
    },
    {
      type: 'business_objectives',
      recommendation: {
        entityType: 'objective',
        entityId: 'business_objectives',
        entityLabel: 'Operational impact, Visibility, Portfolio growth',
        action: 'track',
        params: {
          objectives: ['Operational impact', 'Visibility', 'Portfolio growth'],
          kpis: ['outcome_met', 'revenue_impact'],
        },
      },
      confidence: { score: 0.75, factors: ['Mapped from goal category business'] },
      reason: {
        why: 'Map the blog goal to business objectives.',
        evidence: [
          'Goal category business; tags: content-agency, blog.',
          'Objectives: Operational impact, Visibility, Portfolio growth.',
        ],
        tradeoffs: ['Chasing many objectives dilutes focus.'],
        alternatives: ['Pursue only the primary objective'],
        risks: ['Objectives without KPIs cannot be measured.'],
      },
    },
  ];

  const decisions = specs.map((spec) => decision(planId, goalId, spec));

  const plan: BrainDecisionPlan = {
    planId,
    goalId,
    goalTitle: 'Publish a client blog post',
    status: 'proposed',
    decisions,
    overallConfidence: 0.78,
    pipeline: [
      { step: 'Receive Goal', engine: 'gateway', consulted: true, note: 'goalId goal_blog_seed' },
      { step: 'Analyze Goal', engine: 'goals', consulted: true },
      { step: 'Consult Goal Engine', engine: 'goals', consulted: true },
      { step: 'Consult Learning', engine: 'learning', consulted: true },
      { step: 'Consult Capability Registry', engine: 'capabilities', consulted: true },
      { step: 'Consult Provider Intelligence', engine: 'providers', consulted: true },
      { step: 'Consult Context Intelligence', engine: 'context', consulted: true },
      { step: 'Consult Execution Strategy', engine: 'execution-strategy', consulted: true },
      { step: 'Generate Decision Plan', engine: 'enterprise-brain', consulted: true },
      { step: 'Explain Decision', engine: 'enterprise-brain', consulted: true },
      {
        step: 'Pass to Execution Orchestrator',
        engine: 'execution-orchestrator',
        consulted: true,
        note: 'Handoff gated on human approval',
      },
    ],
    version: 1,
    actor: 'enterprise-brain',
    createdAt: NOW,
    updatedAt: NOW,
  };

  return { plan, decisions };
}

/** Decisions-only convenience for tests and the seed script. */
export function createCatalogBrainDecisions(): BrainDecision[] {
  return createCatalogBrainPlan().decisions;
}

/** True when all 14 decision types are present (catalog integrity check). */
export function hasAllDecisionTypes(decisions: readonly BrainDecision[]): boolean {
  const present = new Set(decisions.map((d) => d.type));
  return BRAIN_DECISION_TYPES.every((type) => present.has(type));
}
