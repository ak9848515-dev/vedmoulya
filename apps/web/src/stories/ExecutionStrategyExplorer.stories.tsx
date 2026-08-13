// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Strategy Explorer Stories
// EI-004 — Enterprise Execution Strategy Engine
// ──────────────────────────────────────────────────────────────────

import type { Meta, StoryObj } from '@storybook/react';
import { StrategyCard, ValidationBadge } from '../app/execution-strategy/components.js';
import type { ExecutionStrategyDTO } from '@vedmoulya/execution-strategy';

const strategy: ExecutionStrategyDTO = {
  strategyId: 'strategy_demo_001',
  goalId: 'goal_demo_001',
  goal: 'Generate a blog post about enterprise AI strategy',
  business: ['platform'],
  capabilityPlan: {
    goal: 'Generate a blog post about enterprise AI strategy',
    steps: [
      {
        stepId: 'step_1',
        capability: 'content_generation',
        label: 'Research',
        description: 'Research the topic and gather sources',
        flowType: 'sequential',
        support: 'required',
        skippable: false,
        weight: 0.25,
        eligibleFamilies: ['anthropic', 'openai', 'google'],
        children: [],
      },
      {
        stepId: 'step_2',
        capability: 'content_generation',
        label: 'Writing',
        description: 'Draft the primary content',
        flowType: 'sequential',
        support: 'required',
        skippable: false,
        weight: 0.4,
        eligibleFamilies: ['anthropic', 'openai', 'google'],
        children: [],
      },
      {
        stepId: 'step_3',
        capability: 'reasoning',
        label: 'SEO',
        description: 'Optimize content for search',
        flowType: 'sequential',
        support: 'optional',
        skippable: true,
        weight: 0.15,
        eligibleFamilies: ['openai', 'google'],
        children: [],
      },
      {
        stepId: 'step_4',
        capability: 'reasoning',
        label: 'Review',
        description: 'Quality review and revision',
        flowType: 'sequential',
        support: 'required',
        skippable: false,
        weight: 0.1,
        eligibleFamilies: ['anthropic', 'openai'],
        children: [],
      },
      {
        stepId: 'step_5',
        capability: 'content_generation',
        label: 'Publishing',
        description: 'Format for publication',
        flowType: 'sequential',
        support: 'optional',
        skippable: true,
        weight: 0.1,
        eligibleFamilies: ['openai', 'ollama', 'mock'],
        children: [],
      },
    ],
    requiredCapabilities: ['content_generation', 'reasoning'],
    feasible: true,
    summary: '5 step plan: Research (sequential) → Writing → SEO → Review → Publishing',
  },
  providerCandidates: [
    {
      providerId: 'anthropic_claude-3-opus',
      family: 'anthropic',
      name: 'Anthropic Claude',
      modelId: 'claude-3-opus',
      capabilityMatch: 0.92,
      qualityEstimate: 0.97,
      latencyEstimateMs: 1200,
      costEstimateUsd: 0.42,
      contextWindow: 200000,
      availability: 'healthy',
      confidence: 0.95,
      historicalSuccess: 0.96,
      healthScore: 0.98,
      rankScore: 0.93,
    },
    {
      providerId: 'openai_gpt-4o',
      family: 'openai',
      name: 'OpenAI GPT-4o',
      modelId: 'gpt-4o',
      capabilityMatch: 0.88,
      qualityEstimate: 0.92,
      latencyEstimateMs: 900,
      costEstimateUsd: 0.31,
      contextWindow: 128000,
      availability: 'healthy',
      confidence: 0.97,
      historicalSuccess: 0.94,
      healthScore: 0.97,
      rankScore: 0.89,
    },
    {
      providerId: 'google_gemini-1.5-pro',
      family: 'google',
      name: 'Google Gemini',
      modelId: 'gemini-1.5-pro',
      capabilityMatch: 0.84,
      qualityEstimate: 0.88,
      latencyEstimateMs: 1100,
      costEstimateUsd: 0.24,
      contextWindow: 2000000,
      availability: 'healthy',
      confidence: 0.9,
      historicalSuccess: 0.9,
      healthScore: 0.95,
      rankScore: 0.85,
    },
  ],
  contextReference: {
    sources: ['conversation_memory', 'enterprise_memory', 'knowledge_base'],
    maxContextTokens: 4000,
    priorityCapabilities: ['content_generation', 'reasoning'],
    requiresAssembly: true,
  },
  executionMode: 'sequential',
  modePlan: {
    mode: 'sequential',
    sequential: {
      order: ['step_1', 'step_2', 'step_3', 'step_4', 'step_5'],
      failFast: true,
      expectedTotalMs: 6000,
    },
    parallel: {
      groups: [['step_1', 'step_2', 'step_3', 'step_4', 'step_5']],
      maxConcurrency: 3,
      expectedTotalMs: 6000,
    },
    description: 'Execute 5 steps in strict order',
  },
  priority: 'high',
  risk: {
    providerRisk: 0.06,
    executionRisk: 0.2,
    budgetRisk: 0.2,
    latencyRisk: 0.24,
    confidence: 0.85,
    overallRisk: 0.16,
    level: 'very_low',
    factors: ['All risk dimensions are within budget'],
  },
  confidence: 0.87,
  tokenBudget: {
    inputTokens: 3500,
    outputTokens: 1500,
    contextTokens: 4000,
    reservedTokens: 1000,
    maximumTokens: 15000,
    expectedTokens: 10000,
    confidence: 0.85,
  },
  costBudget: { expectedCostUsd: 0.42, maximumCostUsd: 2, category: 'minimum', confidence: 0.8 },
  latencyBudget: { expectedTimeMs: 7200, maximumTimeMs: 30000, confidence: 0.8 },
  qualityTarget: {
    targetScore: 0.9,
    minimumScore: 0.8,
    retryThreshold: 0.85,
    approvalRequired: false,
    humanReview: true,
    tier: 'premium',
  },
  fallbackPlan: {
    primaryPlanId: 'strategy_demo_001_primary',
    secondaryPlanId: 'strategy_demo_001_secondary',
    emergencyPlanId: 'strategy_demo_001_emergency',
    localExecutionPlanId: 'strategy_demo_001_local',
    description:
      'Primary: anthropic. Secondary: openai. Emergency: any healthy provider. Local: self-hosted.',
    activeTier: 'primary',
  },
  retryPolicy: {
    maximumRetries: 2,
    retryDelayMs: 1000,
    escalation: 'double-delay',
    stopConditions: [
      'budget_exceeded',
      'quality_below_threshold',
      'context_window_exceeded',
      'policy_violation',
    ],
  },
  validation: {
    passed: true,
    checks: [
      {
        check: 'Capability exists',
        passed: true,
        detail: 'Plan requires content_generation, reasoning',
      },
      { check: 'Context available', passed: true, detail: '5 steps planned' },
      { check: 'Provider available', passed: true, detail: '3 eligible provider(s) ranked' },
      { check: 'Budget possible', passed: true, detail: 'Max 15000 tokens / $2.00' },
      { check: 'Latency acceptable', passed: true, detail: 'Max 30000ms' },
      { check: 'Quality achievable', passed: true, detail: 'Target 0.9 / min 0.8' },
    ],
    summary: 'Strategy is valid and ready for execution planning.',
    score: 1,
  },
  createdAt: '2026-08-04T00:00:00.000Z',
  updatedAt: '2026-08-04T00:00:00.000Z',
  version: '1.0.0',
};

const highRiskStrategy: ExecutionStrategyDTO = {
  ...strategy,
  strategyId: 'strategy_demo_002',
  risk: {
    providerRisk: 0.8,
    executionRisk: 0.7,
    budgetRisk: 0.9,
    latencyRisk: 0.85,
    confidence: 0.7,
    overallRisk: 0.81,
    level: 'critical',
    factors: [
      'Provider fleet health or availability is low',
      'Cost or token estimate is close to or above the budget',
      'Expected latency approaches the latency budget',
    ],
  },
  confidence: 0.45,
  validation: {
    passed: false,
    checks: [
      {
        check: 'Capability exists',
        passed: true,
        detail: 'Plan requires content_generation, reasoning',
      },
      { check: 'Context available', passed: true, detail: '5 steps planned' },
      {
        check: 'Provider available',
        passed: false,
        detail: 'No eligible provider for the required capabilities',
      },
      { check: 'Budget possible', passed: false, detail: 'Budget is zero or unset' },
      { check: 'Latency acceptable', passed: true, detail: 'Max 30000ms' },
      { check: 'Quality achievable', passed: true, detail: 'Target 0.9 / min 0.8' },
    ],
    summary: 'Strategy has 2 validation issue(s).',
    score: 4 / 6,
  },
};

const metaCard: Meta<typeof StrategyCard> = {
  title: 'Explorer/StrategyCard',
  component: StrategyCard,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Displays a strategy summary card with capability chips, budgets, risk, and validation status.',
      },
    },
  },
};

export default metaCard;

type CardStory = StoryObj<typeof StrategyCard>;
type BadgeStory = StoryObj<typeof ValidationBadge>;

export const CardValid: CardStory = {
  args: { strategy },
};

export const CardHighRisk: CardStory = {
  args: { strategy: highRiskStrategy },
  parameters: {
    docs: {
      description: { story: 'Shows a critical-risk strategy with failed validation checks.' },
    },
  },
};

const metaBadge: Meta<typeof ValidationBadge> = {
  title: 'Explorer/ValidationBadge',
  component: ValidationBadge,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Shows the six-check strategy validation result with per-check details.',
      },
    },
  },
};

export const ValidationPassed: BadgeStory = {
  args: { strategy },
};

export const ValidationReviewRequired: BadgeStory = {
  args: { strategy: highRiskStrategy },
  parameters: {
    docs: { description: { story: 'Shows failed checks requiring strategy review.' } },
  },
};

export { metaBadge };
