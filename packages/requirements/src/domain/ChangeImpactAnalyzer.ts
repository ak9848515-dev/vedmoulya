// ──────────────────────────────────────────────────────────────────
// VedMoulya — Product Intelligence: Change Impact Analyzer
// EPIC-009 — Phase 24 (MANDATORY). When an existing application
// receives e.g. "Add online payments", VedMoulya must NOT immediately
// modify code. First it calculates requirement/architecture/database/
// API/UX/security/AI/testing/deployment/cost impact, displays WHAT
// WILL CHANGE / WHAT WILL NOT CHANGE / RISKS / NEW REQUIREMENTS / NEW
// SECURITY REQUIREMENTS / ESTIMATED COST, then requests approval.
// ──────────────────────────────────────────────────────────────────

import type {
  ChangeImpact,
  ProductArchitecture,
  Requirement,
  RequirementSet,
} from '../types/requirement-types.js';
import { RequirementVersionControl } from './RequirementVersionControl.js';

export interface ChangeImpactInput {
  sessionId: string;
  request: string;
  requirements: RequirementSet;
  architecture: ProductArchitecture;
  /** Override the deterministic cost estimate (tests). */
  estimatedCostUsd?: number;
}

interface ImpactRule {
  keywords: string[];
  dimension: {
    requirement: string[];
    architecture: string[];
    database: string[];
    api: string[];
    ux: string[];
    security: string[];
    ai: string[];
    testing: string[];
    deployment: string[];
  };
  risks: string[];
  newRequirements: string[];
  newSecurity: string[];
  costUsd: number;
}

const RULES: ImpactRule[] = [
  {
    keywords: ['payment', 'pay', 'checkout', 'upi', 'stripe', 'razorpay'],
    dimension: {
      requirement: ['New: customers can pay online', 'New: payment status visible on orders'],
      architecture: [
        'New payment-provider adapter layer',
        'Order state machine extended with payment states',
      ],
      database: [
        'Order table gains paymentStatus + token reference columns',
        'Payment events table (append-only)',
      ],
      api: ['New /payments create + status endpoints', 'Checkout endpoint returns payment intent'],
      ux: ['Checkout screen gains a payment step', 'Order tracking shows payment status'],
      security: [
        'PCI-scope awareness: raw card data never stored',
        'Payment tokens handled by the provider only',
      ],
      ai: ['No change to AI strategy (payments are deterministic)'],
      testing: ['Payment intent + webhook tests', 'PCI-safety assertions (no card data persisted)'],
      deployment: ['Payment provider credentials added to the environment'],
    },
    risks: [
      'Payment provider outage blocks checkout',
      'Fraud/chargeback handling must be planned',
      'Webhook verification must be secure',
    ],
    newRequirements: [
      'Process online payments securely (tokenized)',
      'Payment status tracking on orders',
    ],
    newSecurity: [
      'Payment tokens are provider-managed and never logged',
      'Webhook signatures verified before processing',
    ],
    costUsd: 0.5,
  },
  {
    keywords: ['delivery', 'dispatch', 'rider'],
    dimension: {
      requirement: ['New: delivery orders with address capture', 'New: delivery status tracking'],
      architecture: [
        'Order model gains delivery mode + address',
        'Optional delivery-service adapter',
      ],
      database: ['Order table gains deliveryAddress + mode columns'],
      api: ['New /orders/:id/delivery status endpoint', 'Address validation on checkout'],
      ux: ['Checkout gains address entry', 'Order tracking shows delivery ETA'],
      security: ['Delivery addresses are PII: encrypted at rest, deletable'],
      ai: ['No change to AI strategy'],
      testing: ['Address validation tests', 'Delivery-state transition tests'],
      deployment: ['No deployment change'],
    },
    risks: ['Invalid addresses block delivery', 'ETA promises create support load'],
    newRequirements: [
      'Support delivery orders with address capture',
      'Delivery status visible to customers',
    ],
    newSecurity: ['Delivery addresses handled as PII (encrypt + right to delete)'],
    costUsd: 0.2,
  },
  {
    keywords: ['auth', 'login', 'account', 'sign up', 'oauth', 'sso'],
    dimension: {
      requirement: ['New: account creation and login', 'New: authenticated user area'],
      architecture: ['Authentication wired to the identity infrastructure', 'Role model extended'],
      database: ['User profile table', 'Sessions (stateless JWT — no server sessions)'],
      api: ['/auth/register, /auth/login endpoints', 'Protected routes behind the auth middleware'],
      ux: ['Login/register screens', 'Account menu'],
      security: ['Rate-limited auth endpoints', 'Password hashing + optional MFA'],
      ai: ['No change to AI strategy'],
      testing: ['Auth flow tests (register/login/logout)', 'Rate-limit tests'],
      deployment: ['Auth secrets in the environment'],
    },
    risks: ['Account takeover if auth is misconfigured', 'Password reset flow adds scope'],
    newRequirements: ['User accounts with secure login'],
    newSecurity: ['Auth endpoints rate-limited', 'Credential stuffing protection'],
    costUsd: 0.3,
  },
  {
    keywords: ['admin', 'dashboard', 'management', 'staff'],
    dimension: {
      requirement: ['New: admin dashboard', 'New: staff role with management rights'],
      architecture: ['Admin API surface', 'Role-based access control'],
      database: ['Audit log table for admin actions'],
      api: ['/admin/* endpoints (role-guarded)'],
      ux: ['Admin dashboard screens', 'Role-aware navigation'],
      security: ['Role escalation must be explicit', 'Admin actions audited'],
      ai: ['Optional admin AI summaries — only if requested'],
      testing: ['Role-enforcement tests (customer cannot call admin APIs)'],
      deployment: ['No deployment change'],
    },
    risks: ['Privilege escalation bugs', 'Admin surface widens the attack area'],
    newRequirements: ['Administrative dashboard with role guard'],
    newSecurity: [
      'Admin actions audited with actor + timestamp',
      'Role checks enforced server-side',
    ],
    costUsd: 0.4,
  },
  {
    keywords: ['ai', 'chat', 'chatbot', 'llm', 'assistant', 'copilot'],
    dimension: {
      requirement: ['New: AI-assisted capability', 'New: AI strategy (runtime-bound)'],
      architecture: ['AI runtime wiring', 'Structured output contracts'],
      database: ['Optional conversation history table'],
      api: ['AI endpoints behind the runtime'],
      ux: ['AI interaction states (loading/error/abstain)'],
      security: ['Prompt-injection handling for user content', 'AI context scoped to the user'],
      ai: ['AI strategy becomes required: capability, model class, token budget, fallback'],
      testing: ['AI accuracy + abstention tests', 'Budget-bound tests'],
      deployment: ['Provider keys in the environment'],
    },
    risks: ['AI cost drift', 'Groundedness failures (hallucination) without evidence checks'],
    newRequirements: [
      'AI capability through the frozen AI runtime',
      'Grounded output with an evidence requirement',
    ],
    newSecurity: [
      'AI context never includes other users\u2019 data',
      'Prompt-injection resistance for user content',
    ],
    costUsd: 1.0,
  },
  {
    keywords: ['report', 'analytics', 'insight', 'statistics', 'charts'],
    dimension: {
      requirement: ['New: reports/analytics views'],
      architecture: ['Read-model queries over existing data'],
      database: ['Optional aggregated materialized views'],
      api: ['/reports endpoints'],
      ux: ['Analytics screens with charts'],
      security: ['Report data owner-scoped', 'No PII in aggregates'],
      ai: ['No change to AI strategy (unless AI summaries requested)'],
      testing: ['Aggregation correctness tests'],
      deployment: ['No deployment change'],
    },
    risks: ['Aggregation queries degrade performance (mitigate with indexes)'],
    newRequirements: ['Reports and analytics views'],
    newSecurity: ['Report access owner-scoped'],
    costUsd: 0.2,
  },
  {
    keywords: ['search', 'filter'],
    dimension: {
      requirement: ['New: search/filtering'],
      architecture: ['Search over the core entity'],
      database: ['Indexes on searchable columns'],
      api: ['Query params on list endpoints'],
      ux: ['Search input + result states (empty/no-results)'],
      security: ['Search results owner-scoped'],
      ai: ['No change (deterministic search)'],
      testing: ['Search relevance + empty-state tests'],
      deployment: ['No deployment change'],
    },
    risks: ['Search result leakage if not owner-scoped'],
    newRequirements: ['Search and filtering over core data'],
    newSecurity: ['Search results scoped to the requester'],
    costUsd: 0.1,
  },
];

export class ChangeImpactAnalyzer {
  private readonly vc = new RequirementVersionControl();

  analyze(input: ChangeImpactInput): ChangeImpact {
    const lower = input.request.toLowerCase();
    let matched: ImpactRule | undefined;
    for (const rule of RULES) {
      if (rule.keywords.some((kw) => lower.includes(kw))) {
        matched = rule;
        break;
      }
    }

    if (!matched) {
      return this.genericImpact(input);
    }

    const newRequirements: Requirement[] = matched.newRequirements.map((description, i) => ({
      id: `REQ-NEW-${i + 1}`,
      description,
      category:
        matched.dimension.security.length > 0 && description.toLowerCase().includes('security')
          ? 'security'
          : 'functional',
      priority: 'HIGH',
      confidence: 0.8,
      source: 'INFERENCE',
      dependencies: [],
      risks: matched.risks,
      status: 'PROPOSED',
      version: 1,
    }));

    return {
      sessionId: input.sessionId,
      request: input.request,
      requirementImpact: matched.dimension.requirement,
      architectureImpact: matched.dimension.architecture,
      databaseImpact: matched.dimension.database,
      apiImpact: matched.dimension.api,
      uxImpact: matched.dimension.ux,
      securityImpact: matched.dimension.security,
      aiImpact: matched.dimension.ai,
      testingImpact: matched.dimension.testing,
      deploymentImpact: matched.dimension.deployment,
      costImpact: `Estimated added AI/build cost: $${input.estimatedCostUsd ?? matched.costUsd}`,
      whatWillChange: [
        ...matched.dimension.requirement,
        ...matched.dimension.api,
        ...matched.newSecurity,
      ],
      whatWillNotChange: [
        'The confirmed core workflows remain unchanged',
        'The technology stack stays on the platform defaults',
        'Existing data is preserved',
      ],
      risks: matched.risks,
      newRequirements,
      newSecurityRequirements: matched.newSecurity,
      estimatedCostUsd: input.estimatedCostUsd ?? matched.costUsd,
      requiresApproval: true,
    };
  }

  private genericImpact(input: ChangeImpactInput): ChangeImpact {
    return {
      sessionId: input.sessionId,
      request: input.request,
      requirementImpact: [
        `New functional scope requested: "${input.request}"`,
        'Requirement details must be confirmed before planning',
      ],
      architectureImpact: ['Dependent on the confirmed scope — no architecture change assumed'],
      databaseImpact: ['Dependent on the confirmed scope'],
      apiImpact: ['Dependent on the confirmed scope'],
      uxImpact: ['Dependent on the confirmed scope'],
      securityImpact: ['Re-reviewed when the exact change is defined'],
      aiImpact: ['Unchanged unless the request involves AI'],
      testingImpact: ['New tests required for the new behavior'],
      deploymentImpact: ['Re-validated at deploy time'],
      costImpact:
        'Estimated added cost: $0.10 (planning) — re-estimated after requirements are confirmed',
      whatWillChange: [`New scope: ${input.request}`],
      whatWillNotChange: ['Confirmed requirements', 'Technology stack', 'Existing data'],
      risks: ['Scope ambiguity — the change must be clarified before build'],
      newRequirements: [
        {
          id: 'REQ-NEW-1',
          description: input.request,
          category: 'functional',
          priority: 'HIGH',
          confidence: 0.5,
          source: 'USER',
          dependencies: [],
          risks: ['Undefined scope'],
          status: 'PROPOSED',
          version: 1,
        },
      ],
      newSecurityRequirements: [],
      estimatedCostUsd: 0.1,
      requiresApproval: true,
    };
  }
}
