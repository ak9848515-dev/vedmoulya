// ──────────────────────────────────────────────────────────────────
// VedMoulya — Product Intelligence: Requirement Extraction Engine
// EPIC-009 — Phase 2. Extracts a typed RequirementSet across 13
// categories from the understood ProductIntent. Each requirement
// carries id, priority, confidence, source, dependencies, risks,
// status and reason. Critical unknowns stay UNKNOWN (never silently
// assumed) and are surfaced as questions.
// ──────────────────────────────────────────────────────────────────

import type {
  ProductIntent,
  Requirement,
  RequirementCategory,
  RequirementPriority,
  RequirementSet,
  RequirementStatus,
} from '../types/requirement-types.js';
import { knowledgeFor, type ArchetypeKnowledge } from '../catalog/knowledge.js';

export interface RequirementExtractionInput {
  sessionId: string;
  intent: ProductIntent;
}

/** Deterministic risk rules applied when a description matches. */
const RISK_RULES: Array<{ keywords: string[]; risk: string }> = [
  {
    keywords: ['payment', 'pay', 'checkout'],
    risk: 'Payment processing introduces PCI and fraud risk',
  },
  {
    keywords: ['pii', 'personal', 'profile', 'address'],
    risk: 'PII handling requires privacy controls',
  },
  { keywords: ['admin', 'staff', 'role'], risk: 'Role escalation must be carefully authorized' },
  { keywords: ['delivery', 'location'], risk: 'Location data raises privacy expectations' },
  { keywords: ['public', 'anyone'], risk: 'Public access widens the abuse surface' },
  {
    keywords: ['multi', 'tenant', 'organization'],
    risk: 'Tenant isolation bugs cause cross-tenant leakage',
  },
];

export class RequirementExtractionEngine {
  extract(input: RequirementExtractionInput): RequirementSet {
    const { intent } = input;
    const k = knowledgeFor(intent.archetype);
    const reqs: Requirement[] = [];
    const add = (
      category: RequirementCategory,
      description: string,
      priority: RequirementPriority,
      source: Requirement['source'],
      status: RequirementStatus,
      reason: string,
      dependencies: string[] = [],
      extraRisks: string[] = [],
    ): void => {
      const risks = risksFor(description, extraRisks);
      reqs.push({
        id: `REQ-${String(reqs.length + 1).padStart(3, '0')}`,
        description,
        category,
        priority,
        confidence: source === 'QUESTION' ? 0.2 : source === 'USER' ? 0.95 : 0.7,
        source,
        dependencies,
        risks,
        status,
        reason,
        version: 1,
      });
    };

    this.baseFunctional(input, k, add);
    this.nonFunctional(input, k, add);
    this.businessRules(k, add);
    this.userRequirements(input, k, add);
    this.dataRequirements(input, k, add);
    this.integrationRequirements(input, k, add);
    this.aiRequirements(input, k, add);
    this.uxRequirements(input, k, add);
    this.securityRequirements(input, k, add);
    this.performanceRequirements(input, k, add);
    this.scalabilityRequirements(input, k, add);
    this.deploymentRequirements(input, k, add);
    this.complianceRequirements(input, k, add);
    this.criticalUnknowns(input, k, add);

    const byCategory = {} as Record<RequirementCategory, string[]>;
    for (const cat of CATEGORY_ORDER) {
      byCategory[cat] = reqs.filter((r) => r.category === cat).map((r) => r.id);
    }

    const counts = {
      total: reqs.length,
      byStatus: Object.fromEntries(
        STATUS_ORDER.map((s) => [s, reqs.filter((r) => r.status === s).length]),
      ) as Record<RequirementStatus, number>,
      byPriority: Object.fromEntries(
        PRIORITY_ORDER.map((p) => [p, reqs.filter((r) => r.priority === p).length]),
      ) as Record<RequirementPriority, number>,
    };

    const confidence =
      reqs.length === 0 ? 0 : reqs.reduce((sum, r) => sum + r.confidence, 0) / reqs.length;

    return { sessionId: input.sessionId, requirements: reqs, byCategory, confidence, counts };
  }

  private baseFunctional(
    input: RequirementExtractionInput,
    k: ArchetypeKnowledge,
    add: AddFn,
  ): void {
    // Explicit features from the user are the strongest functional source.
    for (const feature of input.intent.knownFeatures) {
      add(
        'functional',
        `Support ${feature.toLowerCase()}`,
        'HIGH',
        'USER',
        'CONFIRMED',
        'explicitly requested by the user',
      );
    }
    // Core entities become functional requirements.
    for (const entity of k.dataModel) {
      add(
        'functional',
        `Manage ${entity.entity.toLowerCase()} records`,
        'HIGH',
        'DEFAULT',
        'PROPOSED',
        `from the ${k.archetype} archetype data model`,
      );
    }
    for (const endpoint of k.apiContract) {
      add(
        'functional',
        `Expose ${endpoint.method} ${endpoint.endpoint} (${endpoint.purpose})`,
        'MEDIUM',
        'DEFAULT',
        'PROPOSED',
        `from the ${k.archetype} API contract`,
      );
    }
    for (const rule of k.businessRules) {
      add(
        'business_rule',
        rule,
        'HIGH',
        'DEFAULT',
        'PROPOSED',
        `from the ${k.archetype} business rules`,
      );
    }
    for (const actor of k.journeyActors) {
      for (const journey of actor.journeys) {
        if (journey.path === 'happy') {
          add(
            'user',
            `${actor.actor}: ${journey.name}`,
            'HIGH',
            'DEFAULT',
            'PROPOSED',
            `from the ${k.archetype} user journeys`,
          );
        }
      }
    }
  }

  private nonFunctional(input: ProductIntentInput, k: ArchetypeKnowledge, add: AddFn): void {
    add(
      'non_functional',
      'Responsive UI usable on mobile and desktop',
      'HIGH',
      'DEFAULT',
      'PROPOSED',
      'platform default for generated applications',
    );
    add(
      'non_functional',
      'Typed, structured, testable, lintable, buildable code',
      'HIGH',
      'SYSTEM',
      'PROPOSED',
      'generated applications must satisfy the validation pipeline',
    );
    for (const constraint of input.intent.knownConstraints) {
      add(
        'non_functional',
        constraint,
        'HIGH',
        'USER',
        'CONFIRMED',
        'explicitly requested by the user',
      );
    }
  }

  private businessRules(k: ArchetypeKnowledge, add: AddFn): void {
    // business rules are added in baseFunctional via k.businessRules; add
    // platform-level rules here.
    add(
      'business_rule',
      'Destructive actions require explicit user authorization',
      'CRITICAL',
      'SYSTEM',
      'PROPOSED',
      'the execution policy blocks destructive writes by default',
    );
    add(
      'business_rule',
      'Deployment requires explicit approval',
      'CRITICAL',
      'SYSTEM',
      'PROPOSED',
      'deployment is never automatic',
    );
  }

  private userRequirements(input: ProductIntentInput, k: ArchetypeKnowledge, add: AddFn): void {
    add(
      'user',
      'The application serves ' + k.journeyActors.map((a) => a.actor).join(' and '),
      'HIGH',
      'INFERENCE',
      'PROPOSED',
      'from the archetype role model',
    );
  }

  private dataRequirements(input: ProductIntentInput, k: ArchetypeKnowledge, add: AddFn): void {
    add(
      'data',
      `Persist ${k.dataModel.map((e) => e.entity.toLowerCase()).join(', ')}`,
      'HIGH',
      'DEFAULT',
      'PROPOSED',
      'from the archetype data model',
    );
    if (input.intent.integrations.some((i) => i.toLowerCase().includes('payment'))) {
      add(
        'data',
        'Payment references are stored tokenized (never raw card data)',
        'CRITICAL',
        'INFERENCE',
        'PROPOSED',
        'payment integrations imply tokenized references',
        [],
        ['Card data handling'],
      );
    }
  }

  private integrationRequirements(
    input: ProductIntentInput,
    k: ArchetypeKnowledge,
    add: AddFn,
  ): void {
    for (const integration of input.intent.integrations) {
      add(
        'integration',
        `Integrate ${integration.toLowerCase()}`,
        'HIGH',
        'USER',
        'CONFIRMED',
        'explicitly requested by the user',
        [],
        integration.toLowerCase().includes('payment') ? ['Vendor dependency'] : [],
      );
    }
    for (const tool of k.tools) {
      if (
        !input.intent.integrations.some((i) => i.toLowerCase().includes(tool.name.toLowerCase()))
      ) {
        add(
          'integration',
          `Integrate ${tool.name} (${tool.purpose})`,
          'MEDIUM',
          'DEFAULT',
          'PROPOSED',
          `from the ${k.archetype} tool strategy`,
          [],
          tool.risk === 'high' ? ['High-risk integration requires approval'] : [],
        );
      }
    }
  }

  private aiRequirements(input: ProductIntentInput, k: ArchetypeKnowledge, add: AddFn): void {
    if (input.intent.aiExpectations.length > 0 || k.ai.required) {
      for (const cap of k.ai.capabilities) {
        add(
          'ai',
          `AI capability: ${cap.capability} — ${cap.purpose}`,
          'HIGH',
          'DEFAULT',
          'PROPOSED',
          'from the AI strategy',
        );
      }
      add(
        'ai',
        'All AI execution flows through the frozen AI runtime',
        'CRITICAL',
        'SYSTEM',
        'PROPOSED',
        'no direct provider calls',
      );
      if (k.rag.required) {
        add(
          'ai',
          'Grounded answers with an evidence requirement',
          'CRITICAL',
          'SYSTEM',
          'PROPOSED',
          'Evidence-First: abstain instead of fabricating',
        );
      }
    } else {
      add(
        'ai',
        'No unnecessary AI — the application works without it',
        'LOW',
        'DEFAULT',
        'PROPOSED',
        'AI is only added where it creates product value',
      );
    }
  }

  private uxRequirements(input: ProductIntentInput, k: ArchetypeKnowledge, add: AddFn): void {
    add(
      'ux',
      'Clear loading, empty and error states',
      'HIGH',
      'DEFAULT',
      'PROPOSED',
      'production-quality UX is a platform default',
    );
    add(
      'ux',
      'Accessible UI (WCAG AA, keyboard support, visible focus)',
      'HIGH',
      'DEFAULT',
      'PROPOSED',
      'accessibility is a platform default',
    );
    add(
      'ux',
      k.design.visualPersonality,
      'MEDIUM',
      'DEFAULT',
      'PROPOSED',
      'from the design intelligence',
    );
  }

  private securityRequirements(input: ProductIntentInput, k: ArchetypeKnowledge, add: AddFn): void {
    add(
      'security',
      k.security.authentication,
      'CRITICAL',
      'DEFAULT',
      'PROPOSED',
      'from the security baseline',
    );
    add(
      'security',
      k.security.authorization,
      'CRITICAL',
      'DEFAULT',
      'PROPOSED',
      'from the security baseline',
    );
    add(
      'security',
      'IDOR protection: every resource is owner-scoped',
      'CRITICAL',
      'SYSTEM',
      'PROPOSED',
      'the platform enforces ownership at the engine layer',
    );
    add(
      'security',
      'No secrets in the repository',
      'CRITICAL',
      'DEFAULT',
      'PROPOSED',
      'from the security baseline',
    );
    add(
      'security',
      'Input validation on every API endpoint',
      'HIGH',
      'DEFAULT',
      'PROPOSED',
      'from the security baseline',
    );
  }

  private performanceRequirements(
    input: ProductIntentInput,
    k: ArchetypeKnowledge,
    add: AddFn,
  ): void {
    add(
      'performance',
      k.ai.latencyRequirement,
      'MEDIUM',
      'DEFAULT',
      'PROPOSED',
      'from the AI strategy',
    );
    add(
      'performance',
      'No N+1 queries in the data model',
      'HIGH',
      'SYSTEM',
      'PROPOSED',
      'data access must be query-efficient',
    );
    add(
      'performance',
      'Initial page load under 3s on mid-tier hardware',
      'MEDIUM',
      'DEFAULT',
      'PROPOSED',
      'platform performance target',
    );
  }

  private scalabilityRequirements(
    input: ProductIntentInput,
    k: ArchetypeKnowledge,
    add: AddFn,
  ): void {
    add(
      'scalability',
      'Data model supports growth beyond the first dataset size',
      'MEDIUM',
      'DEFAULT',
      'PROPOSED',
      'the relational model scales with indexes',
    );
    add(
      'scalability',
      'Stateless application tier (horizontal scale-ready)',
      'MEDIUM',
      'DEFAULT',
      'PROPOSED',
      'statelessness keeps scaling simple',
    );
  }

  private deploymentRequirements(
    input: ProductIntentInput,
    k: ArchetypeKnowledge,
    add: AddFn,
  ): void {
    add(
      'deployment',
      `Deployment target: ${k.deploymentTarget}`,
      'HIGH',
      'DEFAULT',
      'PROPOSED',
      'from the archetype deployment plan',
    );
    add(
      'deployment',
      'Deployment is an explicit, approved action',
      'CRITICAL',
      'SYSTEM',
      'PROPOSED',
      'the factory deployment adapter requires authorization',
    );
    for (const expectation of input.intent.deploymentExpectations) {
      add(
        'deployment',
        expectation,
        'HIGH',
        'USER',
        'CONFIRMED',
        'explicitly requested by the user',
      );
    }
  }

  private complianceRequirements(
    input: ProductIntentInput,
    k: ArchetypeKnowledge,
    add: AddFn,
  ): void {
    if (k.security.pii.length > 0) {
      add(
        'compliance',
        'PII handling respects privacy principles (minimize, encrypt, delete)',
        'HIGH',
        'DEFAULT',
        'PROPOSED',
        'from the security baseline PII controls',
      );
    }
    if (input.intent.integrations.some((i) => i.toLowerCase().includes('payment'))) {
      add(
        'compliance',
        'Payment flows follow provider security guidelines (tokenized, no raw card storage)',
        'CRITICAL',
        'INFERENCE',
        'PROPOSED',
        'online payments imply payment-security compliance',
      );
    }
  }

  private criticalUnknowns(input: ProductIntentInput, k: ArchetypeKnowledge, add: AddFn): void {
    // Every unanswered BLOCKING/security-sensitive question becomes a
    // CRITICAL UNKNOWN requirement — never silently assumed.
    for (const q of k.questionTemplates) {
      if (q.class === 'BLOCKING' || q.securitySensitive) {
        add(
          'functional',
          q.text,
          'CRITICAL',
          'QUESTION',
          'UNKNOWN',
          `question ${q.id} must be answered before architecture/build`,
          [],
          q.securitySensitive === true
            ? ['Security-sensitive decision']
            : ['Architecture-changing decision'],
        );
      }
    }
  }
}

const CATEGORY_ORDER: readonly RequirementCategory[] = [
  'functional',
  'non_functional',
  'business_rule',
  'user',
  'data',
  'integration',
  'ai',
  'ux',
  'security',
  'performance',
  'scalability',
  'deployment',
  'compliance',
];

const STATUS_ORDER: readonly RequirementStatus[] = [
  'UNKNOWN',
  'PROPOSED',
  'CONFIRMED',
  'REJECTED',
  'IMPLEMENTED',
  'VALIDATED',
];
const PRIORITY_ORDER: readonly RequirementPriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

type AddFn = (
  category: RequirementCategory,
  description: string,
  priority: RequirementPriority,
  source: Requirement['source'],
  status: RequirementStatus,
  reason: string,
  dependencies?: string[],
  extraRisks?: string[],
) => void;

interface ProductIntentInput {
  intent: ProductIntent;
}

function risksFor(description: string, extra: string[]): string[] {
  const lower = description.toLowerCase();
  const risks: string[] = [];
  for (const rule of RISK_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      risks.push(rule.risk);
    }
  }
  risks.push(...extra);
  return risks;
}
