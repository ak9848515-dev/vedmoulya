// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Application Factory: Specification Engine
// EPIC-007 — Phase 1. Turns a natural-language application idea into
// a typed ApplicationSpecification.
//
// Controlled interpretation: requirements are inferred ONLY when the
// derivation is safe (deterministic keyword rules over the goal +
// archetype defaults). Anything critical that cannot be derived safely
// is marked `unresolved` and surfaced to the user — never silently
// assumed (Phase 1: "do not allow vague requirements to silently become
// implementation assumptions").
// ──────────────────────────────────────────────────────────────────

import { generateId } from '@vedmoulya/core';
import type {
  AppArchetype,
  AppRequirement,
  ApplicationSpecification,
  UserJourney,
} from '../types/app-types.js';
import { detectArchetype } from '../catalog/archetypes.js';

export interface SpecificationEngineOptions {
  /** Application id (stable across the project lifecycle). */
  applicationId: string;
  owner: string;
  /** The raw user idea ("Build an ABAP debugger."). */
  goal: string;
  budget?: Partial<ApplicationSpecification['budget']>;
}

/**
 * Deterministic keyword rules per archetype. Adding a capability or
 * requirement here is a conscious, documented decision — the derivation
 * reasons are recorded so the spec is explainable.
 */
const FEATURE_RULES: Array<{ keywords: string[]; feature: string; reason: string }> = [
  {
    keywords: ['login', 'sign in', 'auth', 'account', 'user account'],
    feature: 'User authentication',
    reason: 'goal mentions authentication',
  },
  { keywords: ['search', 'find'], feature: 'Search / filtering', reason: 'goal mentions search' },
  {
    keywords: ['cart', 'order', 'checkout', 'payment'],
    feature: 'Shopping cart & checkout',
    reason: 'goal mentions commerce',
  },
  {
    keywords: ['menu', 'restaurant', 'food'],
    feature: 'Menu browsing & categories',
    reason: 'goal mentions menu',
  },
  {
    keywords: ['reservation', 'booking'],
    feature: 'Reservations / bookings',
    reason: 'goal mentions booking',
  },
  {
    keywords: ['admin', 'dashboard', 'management'],
    feature: 'Admin dashboard',
    reason: 'goal mentions administration',
  },
  {
    keywords: ['chat', 'chatbot', 'support'],
    feature: 'Conversational chat interface',
    reason: 'goal mentions chat',
  },
  {
    keywords: ['abap', 'sap', 'debugger', 'short dump'],
    feature: 'ABAP source analysis & error diagnosis',
    reason: 'goal mentions ABAP',
  },
  {
    keywords: ['ai', 'llm', 'model', 'intelligent'],
    feature: 'AI-powered capabilities',
    reason: 'goal mentions AI',
  },
  {
    keywords: ['mobile', 'ios', 'android'],
    feature: 'Mobile-responsive UI',
    reason: 'goal mentions mobile',
  },
  {
    keywords: ['multi', 'tenant', 'organization'],
    feature: 'Multi-tenant / organization scoping',
    reason: 'goal mentions tenants',
  },
  {
    keywords: ['notification', 'email', 'alert'],
    feature: 'Notifications',
    reason: 'goal mentions notifications',
  },
  {
    keywords: ['report', 'analytics', 'statistics'],
    feature: 'Reports & analytics',
    reason: 'goal mentions reporting',
  },
];

export class SpecificationEngine {
  derive(options: SpecificationEngineOptions): ApplicationSpecification {
    const goal = options.goal.trim();
    if (!goal) throw new Error('application goal is required');
    const archetype = detectArchetype(goal);
    const lower = goal.toLowerCase();

    const features = new Set<string>();
    const derivationReasons: string[] = [];
    for (const rule of FEATURE_RULES) {
      if (rule.keywords.some((k) => lower.includes(k))) {
        features.add(rule.feature);
        derivationReasons.push(`feature "${rule.feature}" — ${rule.reason}`);
      }
    }
    // Archetype base features are always derived (safe defaults).
    for (const base of baseFeatures(archetype)) {
      features.add(base);
      derivationReasons.push(`feature "${base}" — base feature of the ${archetype} archetype`);
    }

    const requirements = this.buildRequirements(goal, archetype, Array.from(features));
    const unresolved = requirements
      .filter((r) => r.status === 'unresolved')
      .map((r) => ({ label: r.description, reason: r.reason }));

    return {
      applicationId: options.applicationId,
      name: this.deriveName(goal, archetype),
      purpose: `A ${archetype.replaceAll('-', ' ')} built from the request: "${goal}"`,
      targetUsers: this.deriveTargetUsers(archetype),
      userJourneys: this.buildJourneys(archetype, Array.from(features)),
      features: Array.from(features),
      requirements,
      acceptanceCriteria: this.buildAcceptanceCriteria(archetype, Array.from(features)),
      budget: {
        maxIterations: 8,
        maxTokens: 24_000,
        maxCostUsd: 2.0,
        maxLatencyMs: 600_000,
        maxProviderCalls: 64,
        maxToolCalls: 24,
        ...options.budget,
      },
      constraints: this.buildConstraints(goal, archetype),
      archetype,
      derivationReasons,
      unresolved,
    };
  }

  private buildRequirements(
    goal: string,
    archetype: AppArchetype,
    features: string[],
  ): AppRequirement[] {
    const reqs: AppRequirement[] = [];
    const add = (
      category: AppRequirement['category'],
      description: string,
      source: AppRequirement['source'],
      status: AppRequirement['status'],
      reason: string,
    ): void => {
      reqs.push({
        requirementId: `req-${generateId()}`,
        category,
        description,
        source,
        status,
        reason,
      });
    };

    // Core spec fields the factory must always capture.
    add(
      'functional',
      'A clear application purpose and target users',
      'inferred',
      'resolved',
      'derived from the goal text',
    );
    add(
      'non_functional',
      'Responsive UI usable on mobile and desktop',
      'inferred',
      'resolved',
      'platform default for generated apps',
    );
    add(
      'security',
      'Authentication and authorization are defined',
      'inferred',
      'resolved',
      'security is mandatory for generated apps',
    );

    // Features → functional requirements (all safely derived).
    for (const feature of features) {
      add(
        'functional',
        `Support ${feature.toLowerCase()}`,
        'inferred',
        'resolved',
        `derived from feature "${feature}"`,
      );
    }

    // Critical-but-unknowns → UNRESOLVED (never silently assumed).
    if (!/database|postgres|sql|storage|persist|data/i.test(goal)) {
      add(
        'data',
        'Data persistence model (database choice + schema)',
        'inferred',
        'unresolved',
        'the goal does not state how data is stored — surfaced for confirmation',
      );
    }
    if (!/deploy|host|vercel|production|live/i.test(goal)) {
      add(
        'non_functional',
        'Deployment target',
        'inferred',
        'unresolved',
        'the goal does not state where the app should run — surfaced for confirmation',
      );
    }

    // UI expectations from the goal.
    if (/admin|dashboard|management/i.test(goal)) {
      add(
        'ui',
        'Admin interface with management views',
        'inferred',
        'resolved',
        'goal mentions administration',
      );
    }
    add(
      'ui',
      'Clean, accessible UI with loading/empty/error states',
      'inferred',
      'resolved',
      'production-quality UI is a factory default',
    );

    return reqs;
  }

  private deriveName(goal: string, archetype: AppArchetype): string {
    const stripped = goal
      .replace(/^(please|build|create|make|develop|generate)\s+/i, '')
      .replace(/[.\s]+$/, '');
    const slug = stripped
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    return slug || archetype;
  }

  private deriveTargetUsers(archetype: AppArchetype): string[] {
    switch (archetype) {
      case 'abap-debugger':
        return ['SAP developers', 'ABAP consultants'];
      case 'restaurant-app':
        return ['Restaurant customers', 'Restaurant staff', 'Restaurant administrators'];
      case 'ai-app-builder':
        return ['Application builders', 'AI product teams'];
      default:
        return ['End users', 'Administrators'];
    }
  }

  private buildJourneys(archetype: AppArchetype, features: string[]): UserJourney[] {
    const journeys: UserJourney[] = [];
    switch (archetype) {
      case 'abap-debugger':
        journeys.push({
          journeyId: `journey-${generateId()}`,
          name: 'Diagnose an ABAP short dump',
          actor: 'SAP developer',
          steps: [
            'Paste ABAP code and error',
            'Retrieve SAP knowledge',
            'Analyze source',
            'Receive diagnosis + correction',
            'Validate the fix',
          ],
        });
        break;
      case 'restaurant-app':
        journeys.push({
          journeyId: `journey-${generateId()}`,
          name: 'Browse menu and order',
          actor: 'Customer',
          steps: [
            'Browse categories',
            'Add items to cart',
            'Review cart',
            'Checkout',
            'Track order',
          ],
        });
        break;
      case 'ai-app-builder':
        journeys.push({
          journeyId: `journey-${generateId()}`,
          name: 'Describe and scaffold an AI app',
          actor: 'Builder',
          steps: [
            'Describe the app idea',
            'Review specification + architecture',
            'Approve plan',
            'Generate project',
            'Validate + export',
          ],
        });
        break;
      default:
        journeys.push({
          journeyId: `journey-${generateId()}`,
          name: 'Primary user journey',
          actor: 'End user',
          steps: ['Open the app', 'Complete the core workflow', 'Manage account', 'Get support'],
        });
    }
    if (features.some((f) => f.toLowerCase().includes('admin'))) {
      journeys.push({
        journeyId: `journey-${generateId()}`,
        name: 'Administration',
        actor: 'Administrator',
        steps: ['Sign in as admin', 'Review data', 'Manage content', 'View reports'],
      });
    }
    return journeys;
  }

  private buildAcceptanceCriteria(archetype: AppArchetype, features: string[]): string[] {
    const criteria = [
      'The application runs without runtime errors on the target platform',
      'All core user journeys are implemented and usable',
      'Authentication and authorization are enforced',
      'The UI is responsive and accessible',
      'The test suite passes',
      'The build completes successfully',
    ];
    if (archetype === 'abap-debugger') {
      criteria.push(
        'The debugger returns a diagnosis, explanation, corrected code and validation for a given ABAP short dump',
      );
    }
    if (archetype === 'restaurant-app') {
      criteria.push('A customer can browse the menu, add to cart, and place an order');
    }
    if (archetype === 'ai-app-builder') {
      criteria.push('A user can describe an AI app idea and receive a validated project scaffold');
    }
    if (features.length > 0) {
      criteria.push(`Delivered features: ${features.slice(0, 4).join(', ')}`);
    }
    return criteria;
  }

  private buildConstraints(goal: string, archetype: AppArchetype): string[] {
    const constraints = [
      'Generated code is typed, structured, testable, lintable and buildable',
      'All AI execution flows through the frozen AI runtime — no direct provider calls',
      'All file changes flow through the controlled workspace operation layer',
    ];
    if (archetype === 'restaurant-app') {
      constraints.push('Menu categories and ordering flows must be clear and quick');
    }
    if (/low\s*cost|budget|cheap/i.test(goal)) {
      constraints.push('The solution should minimize infrastructure and AI cost');
    }
    return constraints;
  }
}

function baseFeatures(archetype: AppArchetype): string[] {
  switch (archetype) {
    case 'abap-debugger':
      return [
        'ABAP syntax analysis',
        'Error explanation',
        'Correction suggestions',
        'Test generation',
      ];
    case 'restaurant-app':
      return ['Menu browsing', 'Cart management', 'Order placement', 'Order tracking'];
    case 'ai-app-builder':
      return [
        'Idea intake',
        'Specification generation',
        'Architecture generation',
        'Project scaffolding',
      ];
    default:
      return ['Core CRUD workflows', 'Basic user interface'];
  }
}
