// ──────────────────────────────────────────────────────────────────
// VedMoulya — Goal & Task Intelligence: Classification Service
// EI-006 — Enterprise Goal & Task Intelligence Engine
// Automatically classifies a goal: business domain, required
// capabilities, required context, risk level, and complexity. Pure
// deterministic classification from the goal analysis + text signals.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import type {
  ComplexityLevel,
  Goal,
  GoalAnalysis,
  GoalClassification,
  RiskLevel,
} from '../../types/goal-types.js';

const DOMAIN_KEYWORDS: Array<{ domain: string; keywords: string[] }> = [
  {
    domain: 'content',
    keywords: ['blog', 'content', 'writing', 'newsletter', 'article', 'post', 'copy', 'seo'],
  },
  {
    domain: 'sales',
    keywords: ['sales', 'revenue', 'sell', 'pipeline', 'lead', 'client', 'proposal'],
  },
  { domain: 'marketing', keywords: ['marketing', 'brand', 'campaign', 'audience', 'social', 'ad'] },
  {
    domain: 'engineering',
    keywords: ['code', 'app', 'software', 'website', 'automation', 'api', 'build', 'launch'],
  },
  {
    domain: 'operations',
    keywords: ['process', 'workflow', 'operations', 'system', 'efficiency', 'automate'],
  },
  {
    domain: 'finance',
    keywords: ['finance', 'budget', 'cost', 'profit', 'invoice', 'pricing', 'revenue'],
  },
  {
    domain: 'career',
    keywords: ['career', 'job', 'interview', 'resume', 'promotion', 'portfolio'],
  },
  {
    domain: 'learning',
    keywords: ['learn', 'course', 'skill', 'study', 'certification', 'training'],
  },
  { domain: 'health', keywords: ['health', 'fitness', 'diet', 'exercise', 'wellness', 'sleep'] },
  { domain: 'personal', keywords: ['personal', 'habit', 'lifestyle', 'daily', 'routine'] },
];

const COMPLEXITY_BY_TASK_COUNT: Array<{ max: number; level: ComplexityLevel }> = [
  { max: 3, level: 'simple' },
  { max: 6, level: 'moderate' },
  { max: 10, level: 'complex' },
];

/** Complexity from effort hours alone. */
function complexityFromEffort(effortHours: number): ComplexityLevel {
  if (effortHours <= 4) return 'simple';
  if (effortHours <= 16) return 'moderate';
  if (effortHours <= 80) return 'complex';
  return 'very_complex';
}

export class GoalClassificationService {
  /**
   * Classify a goal from its analysis + raw text signals. `taskCountHint`
   * lets the decomposition result refine complexity (used by the planner).
   */
  classify(
    goal: Goal,
    analysis: GoalAnalysis,
    opts: { taskCountHint?: number; effortHours?: number } = {},
  ): GoalClassification {
    const text = `${goal.title} ${goal.description} ${goal.tags.join(' ')}`.toLowerCase();

    const businessDomain: string[] = [];
    for (const rule of DOMAIN_KEYWORDS) {
      if (rule.keywords.some((k) => text.includes(k)) && !businessDomain.includes(rule.domain)) {
        businessDomain.push(rule.domain);
      }
    }
    if (businessDomain.length === 0 && goal.category === 'business')
      businessDomain.push('business');

    const requiredCapabilities = this.mergeCapabilities(analysis.capabilityHints, goal.category);
    const requiredContext = this.mergeContext(analysis.contextHints, goal.category);

    // Risk: inverse confidence + dependency load + complexity.
    const dependencyFactor = Math.min(0.3, goal.dependencies.length * 0.08);
    const confidenceFactor = 0.25 + (1 - goal.confidence) * 0.5;
    const complexityFactor =
      opts.taskCountHint !== undefined
        ? Math.min(0.25, opts.taskCountHint * 0.025)
        : goal.complexity === 'simple'
          ? 0.05
          : goal.complexity === 'moderate'
            ? 0.12
            : goal.complexity === 'complex'
              ? 0.2
              : 0.3;
    const riskScore = Number(
      Math.min(
        1,
        Math.max(0.05, dependencyFactor + confidenceFactor * 0.4 + complexityFactor),
      ).toFixed(2),
    );
    const riskLevel = this.riskLevel(riskScore);

    const complexity = this.complexity(goal, opts);

    const base = 1000 + Math.round(goal.estimatedEffort * 500);
    return {
      businessDomain: businessDomain.length > 0 ? businessDomain : ['general'],
      requiredCapabilities,
      requiredContext,
      riskScore,
      riskLevel,
      complexity,
      estimatedTokenRange: {
        min: base,
        max: base * 3,
      },
      estimatedCostRangeUsd: {
        min: Number((base * 0.0001).toFixed(2)),
        max: Number((base * 3 * 0.0001).toFixed(2)),
      },
    };
  }

  /** Derive a risk level band from a 0–1 score. */
  riskLevel(score: number): RiskLevel {
    if (score < 0.2) return 'very_low';
    if (score < 0.4) return 'low';
    if (score < 0.6) return 'medium';
    if (score < 0.8) return 'high';
    return 'critical';
  }

  private complexity(
    goal: Goal,
    opts: { taskCountHint?: number; effortHours?: number },
  ): ComplexityLevel {
    const byEffort = complexityFromEffort(opts.effortHours ?? goal.estimatedEffort);
    if (opts.taskCountHint === undefined) return byEffort;
    // Combined signal: effort band wins for boundary clarity.
    const byTasks =
      COMPLEXITY_BY_TASK_COUNT.find(
        (c) => opts.taskCountHint !== undefined && (opts.taskCountHint ?? 0) <= c.max,
      )?.level ?? 'very_complex';
    const rank = { simple: 1, moderate: 2, complex: 3, very_complex: 4 };
    return rank[byEffort] >= rank[byTasks] ? byEffort : byTasks;
  }

  private mergeCapabilities(
    hints: CapabilityType[],
    category: GoalCategoryString,
  ): CapabilityType[] {
    const merged = [...hints];
    const CATEGORY_CAPABILITIES: Record<string, CapabilityType[]> = {
      business: ['reasoning'],
      learning: ['reasoning'],
      career: ['reasoning'],
      revenue: ['reasoning', 'content_generation'],
      project: ['reasoning'],
      health: ['general_conversation'],
      personal: ['general_conversation'],
    };
    for (const cap of CATEGORY_CAPABILITIES[category] ?? []) {
      if (!merged.includes(cap)) merged.push(cap);
    }
    if (merged.length === 0) merged.push('reasoning');
    return merged;
  }

  private mergeContext(hints: string[], category: GoalCategoryString): string[] {
    const merged = [...hints];
    const CATEGORY_CONTEXT: Record<string, string[]> = {
      business: ['business_rules'],
      career: ['knowledge_base'],
      learning: ['knowledge_base'],
      revenue: ['client_data', 'business_rules'],
      project: ['project_data'],
      health: ['conversation_memory'],
      personal: ['conversation_memory'],
    };
    for (const ctx of CATEGORY_CONTEXT[category] ?? []) {
      if (!merged.includes(ctx)) merged.push(ctx);
    }
    return merged;
  }
}

type GoalCategoryString = string;
