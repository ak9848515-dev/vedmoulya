// ──────────────────────────────────────────────────────────────────
// VedMoulya — Product Intelligence: Intent Understanding Engine
// EPIC-009 — Phase 1. Turns a raw user idea into a typed ProductIntent
// where EVERY claim carries provenance (explicit / inferred /
// assumption / unknown) and a confidence. Never silently converts
// inference into user-provided fact.
// ──────────────────────────────────────────────────────────────────

import { detectArchetype } from '@vedmoulya/app-factory';
import type { AppArchetype } from '@vedmoulya/app-factory';
import type {
  IntentClaim,
  IntentField,
  ProductIntent,
  ProvenanceSource,
} from '../types/requirement-types.js';
import { knowledgeFor } from '../catalog/knowledge.js';

export interface IntentUnderstandingInput {
  sessionId: string;
  idea: string;
  archetype?: AppArchetype;
}

const EXPLICIT_FEATURE_RULES: Array<{ keywords: string[]; feature: string }> = [
  {
    keywords: ['login', 'sign in', 'auth', 'account', 'user account'],
    feature: 'User authentication',
  },
  { keywords: ['search', 'find', 'query'], feature: 'Search / filtering' },
  { keywords: ['cart', 'order', 'checkout', 'payment', 'pay'], feature: 'Ordering & checkout' },
  { keywords: ['menu', 'restaurant', 'food', 'dish'], feature: 'Menu & items' },
  { keywords: ['delivery', 'deliver'], feature: 'Delivery' },
  { keywords: ['reservation', 'booking', 'appointment'], feature: 'Reservations / appointments' },
  { keywords: ['admin', 'dashboard', 'management', 'staff'], feature: 'Administration' },
  { keywords: ['chat', 'chatbot', 'support', 'assistant'], feature: 'Conversational interface' },
  {
    keywords: ['abap', 'sap', 'debugger', 'short dump', 'syntax'],
    feature: 'ABAP analysis & diagnosis',
  },
  { keywords: ['ai', 'llm', 'model', 'intelligent', 'copilot'], feature: 'AI-powered capability' },
  { keywords: ['mobile', 'ios', 'android', 'phone'], feature: 'Mobile experience' },
  {
    keywords: ['multi', 'tenant', 'organization', 'team'],
    feature: 'Multi-tenant / organization scoping',
  },
  { keywords: ['notification', 'email', 'alert'], feature: 'Notifications' },
  { keywords: ['report', 'analytics', 'statistics', 'insight'], feature: 'Reports & analytics' },
  { keywords: ['upload', 'file'], feature: 'File handling' },
  { keywords: ['invoice', 'billing', 'subscription'], feature: 'Billing / subscriptions' },
];

const INTEGRATION_RULES: Array<{ keywords: string[]; integration: string }> = [
  { keywords: ['payment', 'pay', 'stripe', 'upi', 'razorpay'], integration: 'Payment provider' },
  { keywords: ['email', 'mail'], integration: 'Transactional email' },
  { keywords: ['notification', 'push', 'sms'], integration: 'Notification channel' },
  { keywords: ['maps', 'location', 'geolocation'], integration: 'Maps / location' },
  { keywords: ['github', 'git'], integration: 'Version control (Git)' },
  { keywords: ['calendar', 'schedule'], integration: 'Calendar' },
  { keywords: ['slack', 'teams'], integration: 'Team messaging' },
];

const CONSTRAINT_RULES: Array<{ keywords: string[]; constraint: string }> = [
  {
    keywords: ['low cost', 'budget', 'cheap', 'affordable'],
    constraint: 'Minimize infrastructure and AI cost',
  },
  {
    keywords: ['secure', 'security', 'private', 'confidential', 'gdpr'],
    constraint: 'Security and privacy are first-class',
  },
  {
    keywords: ['fast', 'quick', 'performance', 'scalable'],
    constraint: 'Performance and scalability matter',
  },
  {
    keywords: ['compliance', 'regulatory', 'audit'],
    constraint: 'Compliance / auditability required',
  },
  { keywords: ['offline', 'no internet'], constraint: 'Offline-capable' },
];

export class IntentUnderstandingEngine {
  derive(input: IntentUnderstandingInput): ProductIntent {
    const idea = input.idea.trim();
    if (!idea) throw new Error('idea is required');
    const archetype = input.archetype ?? detectArchetype(idea);
    const k = knowledgeFor(archetype);
    const lower = idea.toLowerCase();

    const explicit: IntentClaim[] = [];
    const knownFeatures: string[] = [];
    const integrations: string[] = [];
    const aiExpectations: string[] = [];
    const deploymentExpectations: string[] = [];
    const knownConstraints: string[] = [];
    const derivationReasons: string[] = [];

    for (const rule of EXPLICIT_FEATURE_RULES) {
      if (rule.keywords.some((kw) => lower.includes(kw))) {
        knownFeatures.push(rule.feature);
        explicit.push(
          claim(
            'knownFeatures',
            `feature: ${rule.feature}`,
            rule.feature,
            'USER',
            0.95,
            'stated in the user\u2019s idea',
          ),
        );
        derivationReasons.push(`feature "${rule.feature}" — explicitly stated`);
      }
    }
    for (const rule of INTEGRATION_RULES) {
      if (rule.keywords.some((kw) => lower.includes(kw))) {
        integrations.push(rule.integration);
        explicit.push(
          claim(
            'integrations',
            `integration: ${rule.integration}`,
            rule.integration,
            'USER',
            0.9,
            'stated in the user\u2019s idea',
          ),
        );
      }
    }
    for (const rule of CONSTRAINT_RULES) {
      if (rule.keywords.some((kw) => lower.includes(kw))) {
        knownConstraints.push(rule.constraint);
        explicit.push(
          claim(
            'knownConstraints',
            `constraint: ${rule.constraint}`,
            rule.constraint,
            'USER',
            0.9,
            'stated in the user\u2019s idea',
          ),
        );
      }
    }
    if (k.ai.required || /\bai\b|llm|model|intelligent|copilot|assistant/i.test(lower)) {
      aiExpectations.push('AI-powered behavior');
    }
    if (/deploy|host|vercel|production|live|publish/i.test(lower)) {
      deploymentExpectations.push('Production deployment');
      explicit.push(
        claim(
          'deploymentExpectations',
          'deployment: production deployment expected',
          'Production deployment',
          'USER',
          0.8,
          'stated in the user\u2019s idea',
        ),
      );
    }

    const platforms = new Set(k.defaultPlatforms);
    if (/mobile|ios|android|phone/i.test(lower)) {
      platforms.add('Native-app consideration');
      explicit.push(
        claim(
          'platforms',
          'platform: mobile',
          'Mobile',
          'USER',
          0.9,
          'stated in the user\u2019s idea',
        ),
      );
    }
    if (/desktop|web\b/i.test(lower)) {
      explicit.push(
        claim('platforms', 'platform: web', 'Web', 'USER', 0.9, 'stated in the user\u2019s idea'),
      );
    }

    const inferred: IntentClaim[] = [
      claim(
        'domain',
        'domain',
        k.domains.join(', '),
        'INFERENCE',
        0.6,
        `from the ${archetype} archetype`,
      ),
      claim(
        'applicationType',
        'application type',
        k.defaultApplicationType,
        'INFERENCE',
        0.7,
        `from the ${archetype} archetype`,
      ),
      claim(
        'targetUsers',
        'target users',
        k.journeyActors.map((a) => a.actor).join(', '),
        'INFERENCE',
        0.7,
        `from the ${archetype} archetype roles`,
      ),
    ];
    for (const p of platforms) {
      inferred.push(
        claim(
          'platforms',
          `platform default: ${p}`,
          p,
          'INFERENCE',
          0.65,
          `from the ${archetype} archetype`,
        ),
      );
    }
    if (k.rag.required) {
      inferred.push(
        claim(
          'aiExpectations',
          'grounded knowledge expected',
          'Grounded domain knowledge (RAG)',
          'INFERENCE',
          0.7,
          'archetype requires grounded knowledge',
        ),
      );
    }

    // Unknowns: every open question template represents a genuine unknown.
    const unknowns: IntentClaim[] = k.questionTemplates.map((q) =>
      claim(
        'knownFeatures',
        `unknown: ${q.text}`,
        q.topic,
        'QUESTION',
        0.2,
        `question ${q.id} not yet answered`,
      ),
    );

    const assumptions: IntentClaim[] = k.defaultTemplates.map((d) =>
      claim(
        'assumptions',
        `assumption: ${d.assumption}`,
        d.defaultValue,
        'DEFAULT',
        d.securitySensitive ? 0.4 : 0.75,
        d.reason,
      ),
    );

    const explicitCount = explicit.length;
    const overallConfidence = Math.min(
      0.9,
      0.35 + explicitCount * 0.08 + (aiExpectations.length > 0 ? 0.05 : 0),
    );

    return {
      sessionId: input.sessionId,
      problem: k.problemPattern,
      desiredOutcome: `A working ${k.label} that lets ${k.journeyActors[0]?.actor ?? 'users'} complete their core workflow reliably and safely.`,
      targetUsers: k.journeyActors.map((a) => a.actor),
      domain: k.domains.join(', '),
      applicationType: k.defaultApplicationType,
      platforms: Array.from(platforms),
      knownFeatures,
      knownConstraints,
      businessContext: undefined,
      integrations,
      aiExpectations,
      deploymentExpectations,
      successCriteria: [
        'Core user journeys work end-to-end',
        'Security requirements are enforced',
        'The UI is responsive and accessible',
        'The build passes validation',
      ],
      explicit,
      inferred,
      assumptions,
      unknowns,
      overallConfidence,
      archetype,
      derivationReasons,
    };
  }
}

function claim(
  key: IntentField,
  label: string,
  value: string,
  source: ProvenanceSource,
  confidence: number,
  detail: string,
): IntentClaim {
  return {
    key,
    label,
    value,
    provenance: { source, confidence, detail },
    isUnknown: source === 'QUESTION',
  };
}
