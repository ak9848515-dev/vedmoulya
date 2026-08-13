// ──────────────────────────────────────────────────────────────────
// VedMoulya — Goal & Task Intelligence: Understanding Service
// EI-006 — Enterprise Goal & Task Intelligence Engine
// Understands a goal: detects category, business domain, capability
// and context hints, and a suggested priority — from the goal text via
// deterministic keyword heuristics (no AI execution). Produces the
// GoalAnalysis consumed by classification and the web explorer.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import type {
  GoalAnalysis,
  GoalCategory,
  GoalInput,
  GoalPriority,
} from '../../types/goal-types.js';

const CATEGORY_KEYWORDS: Record<GoalCategory, string[]> = {
  business: ['business', 'company', 'firm', 'startup', 'agency', 'client', 'office', 'b2b'],
  personal: ['personal', 'myself', 'my own', 'habit', 'lifestyle', 'daily'],
  learning: [
    'learn',
    'course',
    'study',
    'skill',
    'training',
    'certification',
    'education',
    'master',
  ],
  career: [
    'career',
    'job',
    'resume',
    'interview',
    'promotion',
    'salary',
    'profession',
    'portfolio',
  ],
  revenue: [
    'revenue',
    'income',
    'sales',
    'sell',
    'profit',
    'pricing',
    'subscription',
    'monetize',
    'earning',
  ],
  project: ['project', 'launch', 'build', 'ship', 'deliver', 'release', 'milestone', 'timeline'],
  health: ['health', 'fitness', 'exercise', 'diet', 'sleep', 'wellness', 'mental'],
  custom: [],
};

const CAPABILITY_KEYWORDS: Array<{ capability: CapabilityType; keywords: string[] }> = [
  {
    capability: 'content_generation',
    keywords: ['blog', 'content', 'write', 'writing', 'newsletter', 'post', 'article', 'copy'],
  },
  {
    capability: 'reasoning',
    keywords: [
      'research',
      'analyze',
      'analysis',
      'strategy',
      'plan',
      'decide',
      'evaluate',
      'reason',
    ],
  },
  { capability: 'summarization', keywords: ['summarize', 'summary', 'digest', 'brief'] },
  {
    capability: 'classification',
    keywords: ['classify', 'categorize', 'tag', 'seo', 'label', 'organize'],
  },
  { capability: 'translation', keywords: ['translate', 'translation', 'language', 'localize'] },
  { capability: 'vision', keywords: ['image', 'vision', 'photo', 'visual', 'design', 'logo'] },
  {
    capability: 'coding',
    keywords: [
      'code',
      'coding',
      'app',
      'software',
      'program',
      'website',
      'web',
      'automation',
      'script',
    ],
  },
  {
    capability: 'embeddings',
    keywords: ['memory', 'knowledge base', 'search', 'retrieve', 'index'],
  },
  {
    capability: 'general_conversation',
    keywords: ['coach', 'advice', 'brainstorm', 'chat', 'discuss'],
  },
];

const CONTEXT_KEYWORDS: Array<{ context: string; keywords: string[] }> = [
  { context: 'business_rules', keywords: ['business', 'company', 'client', 'policy', 'brand'] },
  {
    context: 'knowledge_base',
    keywords: ['knowledge', 'research', 'document', 'reference', 'source'],
  },
  {
    context: 'conversation_memory',
    keywords: ['previous', 'earlier', 'remember', 'history', 'ongoing'],
  },
  { context: 'client_data', keywords: ['client', 'customer', 'audience', 'market'] },
  { context: 'project_data', keywords: ['project', 'milestone', 'timeline', 'deadline', 'plan'] },
  { context: 'documents', keywords: ['report', 'document', 'file', 'contract', 'proposal'] },
];

const PRIORITY_SIGNALS: Array<{ priority: GoalPriority; keywords: string[] }> = [
  {
    priority: 'critical',
    keywords: ['urgent', 'asap', 'immediately', 'critical', 'deadline', 'today', 'emergency'],
  },
  { priority: 'high', keywords: ['important', 'priority', 'soon', 'this week', 'key'] },
  { priority: 'medium', keywords: ['medium', 'next month', 'regular', 'normal'] },
];

/** Normalize text for keyword matching. */
function normalize(text: string): string {
  return text.toLowerCase();
}

/** Word-boundary regex so substrings like "script" in "TypeScript" don't match. */
function matches(text: string, keyword: string): boolean {
  // `keyword` comes from internal keyword catalogs, never user input.
  // eslint-disable-next-line security/detect-non-literal-regexp
  return new RegExp(`\\b${keyword}\\b`).test(text);
}

export class GoalUnderstandingService {
  /** Analyze a goal input into a structured GoalAnalysis. */
  analyze(input: GoalInput, goalId: string): GoalAnalysis {
    const title = normalize(input.title);
    const description = normalize(input.description);
    const text = `${title} ${description}`;

    // Category detection: explicit (non-default) category wins, else keyword scoring.
    let category: GoalCategory = 'custom';
    let bestScore = 0;
    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS) as Array<
      [GoalCategory, string[]]
    >) {
      if (cat === 'custom') continue;
      const score = keywords.reduce((s, k) => (matches(text, k) ? s + 1 : s), 0);
      if (score > bestScore) {
        bestScore = score;
        category = cat;
      }
    }
    if (input.category && input.category !== 'custom') category = input.category;

    const domainHints = this.collectHints(
      text,
      CATEGORY_KEYWORDS[category].filter((k) => k !== category),
    );
    const capabilityHints: CapabilityType[] = [];
    for (const rule of CAPABILITY_KEYWORDS) {
      if (
        rule.keywords.some((k) => matches(text, k)) &&
        !capabilityHints.includes(rule.capability)
      ) {
        capabilityHints.push(rule.capability);
      }
    }
    const contextHints: string[] = [];
    for (const rule of CONTEXT_KEYWORDS) {
      if (rule.keywords.some((k) => matches(text, k)) && !contextHints.includes(rule.context)) {
        contextHints.push(rule.context);
      }
    }

    const suggestedPriority = this.suggestPriority(text, input.priority);
    const categoryConfidence = input.category ? 0.95 : Math.min(0.9, 0.35 + bestScore * 0.18);

    const summary = `Detected as a ${category} goal (confidence ${Math.round(categoryConfidence * 100)}%)${capabilityHints.length > 0 ? ` requiring ${capabilityHints.join(', ')}` : ''}.`;

    return {
      goalId,
      category,
      categoryConfidence,
      domainHints,
      capabilityHints,
      contextHints,
      suggestedPriority,
      summary,
    };
  }

  private collectHints(text: string, keywords: string[]): string[] {
    return keywords.filter((k) => matches(text, k));
  }

  private suggestPriority(text: string, explicit?: GoalPriority): GoalPriority {
    if (explicit) return explicit;
    for (const rule of PRIORITY_SIGNALS) {
      if (rule.keywords.some((k) => matches(text, k))) return rule.priority;
    }
    return 'medium';
  }
}
