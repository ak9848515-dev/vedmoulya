// ──────────────────────────────────────────────────────────────────
// VedMoulya — Product Intelligence & Requirements Engine: Knowledge
// EPIC-009 — declarative, deterministic knowledge per application
// archetype. This is NOT code duplication of the Application Factory:
// the factory derives its own spec/architecture from a goal; EPIC-009
// uses this knowledge to decide WHAT TO ASK, WHAT TO DEFAULT, and HOW
// TO PLAN the product BEFORE any factory work begins.
// Every template carries a reason/impact so nothing is silent.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType, QualityTier } from '@vedmoulya/ai';
import type { AppArchetype, DeploymentTargetId } from '@vedmoulya/app-factory';
import type {
  ArchitectureApiEndpoint,
  ArchitectureDataEntity,
  DesignSpecification,
  InteractionModel,
  JourneyPathKind,
  JourneyStep,
  QuestionClass,
  QuestionImpacts,
  QuestionOption,
  RAGSource,
  RequirementCategory,
  ToolStrategyEntry,
} from '../types/requirement-types.js';

// ── Shared building blocks ──────────────────────────────────────────────────

export interface QuestionTemplate {
  id: string;
  topic: string;
  class: QuestionClass;
  text: string;
  rationale: string;
  impacts: QuestionImpacts;
  options?: QuestionOption[];
  freeText?: boolean;
  defaultAnswer?: string;
  /** Security/architecture-sensitive answers can never be silently defaulted. */
  securitySensitive?: boolean;
  /** Ambiguity topic this question resolves (linked to AmbiguityEngine). */
  resolvesAmbiguity?: string;
}

export interface DefaultTemplate {
  id: string;
  unknown: string;
  assumption: string;
  defaultValue: string;
  reason: string;
  impact: string;
  securitySensitive: boolean;
  relatedRequirementDescription: string;
  relatedCategory: RequirementCategory;
}

export interface DesignPersonality {
  visualPersonality: string;
  targetAudience: string;
  brandDirection: string;
  colorSystem: string[];
  typography: string;
  spacing: string;
  iconography: string;
  motion: string;
  responsiveStrategy: string;
  accessibility: string;
}

export interface StackChoiceTemplate {
  layer: string;
  choice: string;
  reason: string;
  alternative: string;
  tradeoff: string;
}

export interface AIStrategyTemplate {
  required: boolean;
  capabilities: Array<{ capability: CapabilityType; purpose: string; qualityTier: QualityTier }>;
  modelClass: string;
  providerStrategy: string;
  contextRequirements: string[];
  ragRequired: boolean;
  structuredOutput: boolean;
  toolCalling: boolean;
  latencyRequirement: string;
  qualityRequirement: string;
  tokenBudget: { maxInputTokens: number; maxOutputTokens: number };
  fallback: string;
  reasons: string[];
}

export interface RAGStrategyTemplate {
  required: boolean;
  sources: RAGSource[];
  retrievalStrategy: string;
  groundingRequired: boolean;
  evidenceRequired: boolean;
  reasons: string[];
}

export interface SecurityBaselineTemplate {
  authentication: string;
  authorization: string;
  roles: string[];
  ownership: string;
  tenancy: string;
  secrets: string[];
  pii: string[];
  apiSecurity: string[];
  fileAccess: string[];
  toolPermissions: string[];
  audit: string[];
  logging: string[];
}

export interface CostModelTemplate {
  baseAiCalls: number;
  inputTokensPerCall: number;
  outputTokensPerCall: number;
  ragCalls: number;
  embeddingCalls: number;
  expectedIterations: number;
  costPerCallUsd: number;
  latencyPerCallMs: number;
  assumptions: string[];
}

export interface BuildStepTemplate {
  id: string;
  title: string;
  phase: string;
  dependencies: string[];
  parallelEligible: boolean;
}

export interface ArchetypeKnowledge {
  archetype: AppArchetype;
  label: string;
  keywords: string[];
  domains: string[];
  defaultApplicationType: string;
  defaultPlatforms: string[];
  problemPattern: string;
  questionTemplates: QuestionTemplate[];
  defaultTemplates: DefaultTemplate[];
  design: DesignPersonality;
  stack: StackChoiceTemplate[];
  ai: AIStrategyTemplate;
  rag: RAGStrategyTemplate;
  tools: ToolStrategyEntry[];
  deniedTools: string[];
  security: SecurityBaselineTemplate;
  cost: CostModelTemplate;
  build: BuildStepTemplate[];
  journeyActors: Array<{
    actor: string;
    journeys: Array<{ name: string; path: JourneyPathKind; steps: JourneyStep[] }>;
  }>;
  experience: {
    primaryModel: InteractionModel;
    secondaryModels: InteractionModel[];
    reasons: string[];
    screens: string[];
    navigation: string;
  };
  dataModel: ArchitectureDataEntity[];
  apiContract: ArchitectureApiEndpoint[];
  businessRules: string[];
  nonGoals: string[];
  deploymentTarget: DeploymentTargetId;
}

// ── Impact scale helper (used by question ranking) ──────────────────────────
// 5 = architecture-changing, 4 = security-critical, 3 = significant,
// 2 = notable, 1 = minor, 0 = none.

// ── Shared security baseline (most generated apps) ──────────────────────────

const COMMON_SECURITY: SecurityBaselineTemplate = {
  authentication:
    'Secure authentication via the approved identity infrastructure (email/password + optional OAuth)',
  authorization: 'Role + owner-scoped authorization enforced on every API endpoint',
  roles: ['Customer/end-user', 'Administrator'],
  ownership: 'Owner-scoped data access (a user can only read/write their own records)',
  tenancy: 'Single-tenant for MVP unless the goal explicitly requires multi-tenancy',
  secrets: [
    'No secrets in the repository',
    'Environment-variable injection only',
    'Per-service API keys with rotation',
  ],
  pii: [
    'Minimize PII collection',
    'Encrypt PII at rest',
    'Right-to-delete workflow where applicable',
  ],
  apiSecurity: [
    'Input validation on every endpoint',
    'Rate limiting on auth + public endpoints',
    'No IDOR: resource ids resolved owner-scoped',
  ],
  fileAccess: [
    'No direct filesystem access from the UI',
    'Generated artifacts only in the isolated workspace',
  ],
  toolPermissions: [
    'Frozen ToolRuntime allowlist only (echo, current_time, calculator)',
    'No unrestricted tool access',
  ],
  audit: [
    'Every destructive action and deploy recorded in the application history',
    'Requirement changes versioned (never silently mutated)',
  ],
  logging: ['Structured request logs with request correlation', 'No secrets or PII in logs'],
};

// ── Shared architecture stack (platform-first, technology-aware) ────────────

const PLATFORM_STACK: StackChoiceTemplate[] = [
  {
    layer: 'Frontend',
    choice: 'Next.js / React (platform design system)',
    reason: 'reuses the frozen VedMoulya web stack and UI library',
    alternative: 'Vite + React SPA',
    tradeoff: 'SPA loses server rendering and the shared design system',
  },
  {
    layer: 'Backend',
    choice: 'VedMoulya API runtime (gateway + tRPC)',
    reason: 'typed API boundary matches the platform gateway pattern',
    alternative: 'Standalone Express/Fastify service',
    tradeoff: 'duplicates gateway concerns: auth, rate limits, observability',
  },
  {
    layer: 'Database',
    choice: 'Postgres (platform contract)',
    reason: 'Postgres is the frozen VedMoulya database contract',
    alternative: 'SQLite / MongoDB',
    tradeoff: 'SQLite lacks concurrency; MongoDB abandons the frozen contract',
  },
  {
    layer: 'Authentication',
    choice: 'Existing approved auth infrastructure',
    reason: 'reuse the platform identity layer instead of building auth',
    alternative: 'Third-party auth (Auth0/Clerk)',
    tradeoff: 'introduces a vendor dependency without platform benefit',
  },
  {
    layer: 'Authorization',
    choice: 'Role + owner-scoped middleware',
    reason: 'IDOR protection is enforced at the service layer, never only in the UI',
    alternative: 'UI-only guards',
    tradeoff: 'leaves direct API calls unprotected',
  },
  {
    layer: 'AI',
    choice: 'VedMoulya AI Runtime',
    reason: 'every AI call must flow through the frozen runtime (routing, budgets, evidence)',
    alternative: 'Direct provider SDK calls',
    tradeoff: 'loses routing, budgets, evidence and audit',
  },
  {
    layer: 'RAG',
    choice: 'VedMoulya RAG (Postgres/pgvector) — only when required',
    reason: 'grounded retrieval via the platform RAG when domain knowledge is needed',
    alternative: 'No retrieval / keyword search',
    tradeoff: 'cheaper but ungrounded answers',
  },
  {
    layer: 'Tools',
    choice: 'Frozen ToolRuntime (allowlist)',
    reason: 'tool execution inherits allowlists, schema validation and audit',
    alternative: 'Direct tool SDK calls',
    tradeoff: 'uncontrolled tool execution',
  },
  {
    layer: 'Integrations',
    choice: 'Adapter seam per integration (payment/email/maps)',
    reason: 'vendor-neutral adapters behind narrow ports',
    alternative: 'Hard-coded vendor calls',
    tradeoff: 'locks the app to one vendor',
  },
  {
    layer: 'Observability',
    choice: 'Platform observability (metrics, structured logs)',
    reason: 'request correlation and latency budgets from the platform',
    alternative: 'None for MVP',
    tradeoff: 'blind failure diagnosis',
  },
  {
    layer: 'Testing',
    choice: 'Vitest + deterministic fixtures',
    reason: 'matches the platform testing stack',
    alternative: 'Jest / Cypress',
    tradeoff: 'second toolchain without benefit',
  },
  {
    layer: 'Deployment',
    choice: 'Supported deployment target (local → Vercel/self-hosted)',
    reason: 'deployment is an approved adapter, not a new vendor',
    alternative: 'Custom infra',
    tradeoff: 'ops burden',
  },
];

// ── Shared cost model ───────────────────────────────────────────────────────

const ECONOMY_COST: CostModelTemplate = {
  baseAiCalls: 12,
  inputTokensPerCall: 1_200,
  outputTokensPerCall: 600,
  ragCalls: 0,
  embeddingCalls: 0,
  expectedIterations: 2,
  costPerCallUsd: 0.002,
  latencyPerCallMs: 1_800,
  assumptions: [
    'Deterministic planning phases add zero AI cost',
    'AI cost comes only from the build loop and runtime features',
    'Economy tier model (cheap, fast, adequate quality)',
  ],
};

// ── Shared journey template ─────────────────────────────────────────────────

const ADMIN_JOURNEYS: Array<{
  actor: string;
  journeys: Array<{ name: string; path: JourneyPathKind; steps: JourneyStep[] }>;
}> = [
  {
    actor: 'Administrator',
    journeys: [
      {
        name: 'Manage the application',
        path: 'happy',
        steps: [
          { label: 'Sign in as admin' },
          { label: 'Open dashboard' },
          { label: 'Review live data' },
          { label: 'Manage content' },
        ],
      },
      {
        name: 'Permission denied',
        path: 'permission_failure',
        steps: [
          { label: 'Attempt restricted action' },
          { label: 'See an explainable denial' },
          { label: 'Request access or retry' },
        ],
      },
      {
        name: 'Recover after a failed operation',
        path: 'recovery',
        steps: [
          { label: 'Operation fails with a reason' },
          { label: 'Retry with corrected input' },
          { label: 'Operation completes' },
        ],
      },
    ],
  },
];

// ── RESTAURANT ──────────────────────────────────────────────────────────────

const RESTAURANT: ArchetypeKnowledge = {
  archetype: 'restaurant-app',
  label: 'Restaurant application',
  keywords: [
    'restaurant',
    'menu',
    'food',
    'order',
    'dine',
    'takeaway',
    'delivery',
    'cafe',
    'kitchen',
  ],
  domains: ['food & beverage', 'hospitality'],
  defaultApplicationType: 'Customer ordering + administration web application',
  defaultPlatforms: ['Responsive web application', 'Mobile-first web layout'],
  problemPattern:
    'A restaurant needs a modern way for customers to discover the menu, place orders, and for staff to manage those orders.',
  questionTemplates: [
    {
      id: 'q-restaurant-service-modes',
      topic: 'Restaurant ordering',
      class: 'BLOCKING',
      text: 'Do you want dine-in, takeaway, delivery, or all three?',
      rationale:
        'Service modes change the order flow, the data model (delivery address vs table number), and the staff workflow — the architecture differs for each.',
      impacts: {
        architecture: 5,
        security: 1,
        business: 5,
        ux: 4,
        implementation: 4,
        cost: 2,
        confidence: 3,
      },
      options: [
        { label: 'All three (dine-in, takeaway, delivery)', value: 'all' },
        { label: 'Dine-in only', value: 'dine_in' },
        { label: 'Takeaway only', value: 'takeaway' },
        { label: 'Delivery only', value: 'delivery' },
      ],
      defaultAnswer: 'all',
    },
    {
      id: 'q-restaurant-payment',
      topic: 'Restaurant ordering',
      class: 'BLOCKING',
      text: 'Should customers pay online, or pay at the restaurant?',
      rationale:
        'Online payment is an architecture-changing integration (payment provider, PCI scope, order status coupling) and a security-sensitive decision.',
      impacts: {
        architecture: 5,
        security: 5,
        business: 5,
        ux: 3,
        implementation: 5,
        cost: 4,
        confidence: 2,
      },
      options: [
        { label: 'Pay online', value: 'online' },
        { label: 'Pay at the restaurant', value: 'at_restaurant' },
        { label: 'Both', value: 'both' },
      ],
      securitySensitive: true,
      resolvesAmbiguity: 'online-payment',
    },
    {
      id: 'q-restaurant-accounts',
      topic: 'Restaurant ordering',
      class: 'IMPORTANT',
      text: 'Should customers create an account, or should they be able to order as guests?',
      rationale:
        'Account vs guest checkout changes authentication scope, order history, and the marketing surface.',
      impacts: {
        architecture: 3,
        security: 2,
        business: 3,
        ux: 3,
        implementation: 3,
        cost: 1,
        confidence: 3,
      },
      options: [
        { label: 'Guest checkout + optional account', value: 'guest_optional' },
        { label: 'Accounts required', value: 'accounts_required' },
        { label: 'Guests only', value: 'guest_only' },
      ],
      defaultAnswer: 'guest_optional',
      resolvesAmbiguity: 'customer-accounts',
    },
    {
      id: 'q-restaurant-admin',
      topic: 'Restaurant ordering',
      class: 'BLOCKING',
      text: 'Who manages the menu and orders, and do they need a staff dashboard?',
      rationale:
        'Admin management determines the role model, admin API surface and dashboard scope.',
      impacts: {
        architecture: 4,
        security: 3,
        business: 4,
        ux: 2,
        implementation: 4,
        cost: 2,
        confidence: 3,
      },
      options: [
        { label: 'Staff dashboard for menu + orders', value: 'staff_dashboard' },
        { label: 'Owner only (simple back-office)', value: 'owner_only' },
        { label: 'No admin UI for MVP', value: 'none' },
      ],
      defaultAnswer: 'staff_dashboard',
    },
    {
      id: 'q-restaurant-delivery-fleet',
      topic: 'Delivery',
      class: 'IMPORTANT',
      text: 'If delivery is included — do you have your own delivery team, or use a third-party service (e.g. delivery partners)?',
      rationale:
        'Own fleet vs third-party changes order dispatch, live tracking expectations and integration scope.',
      impacts: {
        architecture: 3,
        security: 2,
        business: 4,
        ux: 3,
        implementation: 4,
        cost: 3,
        confidence: 2,
      },
      options: [
        { label: 'Our own team', value: 'own_fleet' },
        { label: 'Third-party service', value: 'third_party' },
        { label: 'Pickup/takeaway only', value: 'no_delivery' },
      ],
      defaultAnswer: 'third_party',
    },
    {
      id: 'q-restaurant-tracking',
      topic: 'Delivery',
      class: 'OPTIONAL',
      text: 'Do customers need live order tracking (status + estimated time)?',
      rationale:
        'Live tracking adds polling/realtime scope; order status alone is cheaper and usually sufficient.',
      impacts: {
        architecture: 3,
        security: 1,
        business: 3,
        ux: 4,
        implementation: 3,
        cost: 2,
        confidence: 2,
      },
      options: [
        { label: 'Order status only', value: 'status_only' },
        { label: 'Live tracking', value: 'live_tracking' },
      ],
      defaultAnswer: 'status_only',
    },
  ],
  defaultTemplates: [
    {
      id: 'd-restaurant-responsive',
      unknown: 'Target platforms',
      assumption: 'Customers order from phones and desktops',
      defaultValue: 'Responsive web application, mobile-first',
      reason: 'ordering happens overwhelmingly on phones',
      impact: 'UI layout and touch targets',
      securitySensitive: false,
      relatedRequirementDescription: 'Responsive mobile-first UI',
      relatedCategory: 'ux',
    },
    {
      id: 'd-restaurant-delivery-fee',
      unknown: 'Delivery fees',
      assumption: 'Delivery fees are configurable by the owner',
      defaultValue: 'Configurable delivery fee per order',
      reason: 'fee policy varies by restaurant; a setting beats a hard-coded rule',
      impact: 'Checkout totals and admin settings',
      securitySensitive: false,
      relatedRequirementDescription: 'Configurable delivery fee',
      relatedCategory: 'business_rule',
    },
    {
      id: 'd-restaurant-db',
      unknown: 'Data persistence',
      assumption: 'Menu, carts and orders must persist',
      defaultValue: 'Postgres database',
      reason: 'Postgres is the frozen platform database contract',
      impact: 'Data model and API',
      securitySensitive: false,
      relatedRequirementDescription: 'Persistent menu/cart/order data',
      relatedCategory: 'data',
    },
    {
      id: 'd-restaurant-secure-auth',
      unknown: 'Authentication for staff',
      assumption: 'Staff areas must be protected',
      defaultValue: 'Secure authentication + role-based access for staff',
      reason: 'admin surfaces are security-sensitive and cannot be silently public',
      impact: 'Security plan and role model',
      securitySensitive: true,
      relatedRequirementDescription: 'Protected staff/admin area',
      relatedCategory: 'security',
    },
  ],
  design: {
    visualPersonality: 'Visual, warm, product-focused',
    targetAudience: 'Hungry customers deciding fast; staff operating under time pressure',
    brandDirection:
      'Appetizing photography-forward brand with warm neutrals and a confident accent color',
    colorSystem: [
      'Warm neutral background (cream/off-white)',
      'High-contrast food photography as the primary visual',
      'Single strong accent (e.g. terracotta or deep green)',
      'Clean whites for menus and cart cards',
    ],
    typography:
      'Large, legible display type for dish names; comfortable body text; generous tap targets',
    spacing:
      'Generous card spacing with clear visual hierarchy between categories, items and the cart',
    iconography: 'Simple, friendly line icons (cart, clock, star, location)',
    motion:
      'Subtle entrance transitions for menu categories and cart updates; nothing that delays ordering',
    responsiveStrategy:
      'Mobile-first: bottom cart bar, large touch targets; desktop gains a persistent side panel',
    accessibility:
      'WCAG AA contrast, keyboard-navigable menus, visible focus states, alt text on dishes',
  },
  stack: PLATFORM_STACK,
  ai: {
    required: false,
    capabilities: [
      {
        capability: 'content_generation',
        purpose: 'generate appetizing menu descriptions',
        qualityTier: 'economy',
      },
    ],
    modelClass: 'Economy text generation (optional)',
    providerStrategy: 'Default provider via AI runtime routing; economy tier',
    contextRequirements: [
      'Only the menu item context, never the whole menu',
      'No customer PII in AI context',
    ],
    ragRequired: false,
    structuredOutput: false,
    toolCalling: false,
    latencyRequirement: 'AI optional — core ordering must work without AI',
    qualityRequirement: 'Menu copy is nice-to-have; correctness of orders is core',
    tokenBudget: { maxInputTokens: 2_000, maxOutputTokens: 300 },
    fallback: 'Static menu descriptions when AI is unavailable',
    reasons: [
      'Ordering correctness does not depend on AI',
      'AI adds cost without product necessity',
    ],
  },
  rag: {
    required: false,
    sources: [],
    retrievalStrategy: 'none',
    groundingRequired: false,
    evidenceRequired: false,
    reasons: ['No external/domain knowledge required for ordering flows'],
  },
  tools: [
    {
      name: 'payment',
      purpose: 'process online payments',
      permissions: 'charge orders only',
      dataAccess: 'order total + payment token (never raw card data)',
      risk: 'high',
      approvalRequired: true,
    },
    {
      name: 'email',
      purpose: 'order confirmations',
      permissions: 'send transactional email',
      dataAccess: 'order number + customer email',
      risk: 'low',
      approvalRequired: false,
    },
    {
      name: 'notification',
      purpose: 'order status updates',
      permissions: 'push/email notifications',
      dataAccess: 'order status + channel address',
      risk: 'low',
      approvalRequired: false,
    },
  ],
  deniedTools: ['filesystem', 'shell', 'database_admin', 'code_execution'],
  security: {
    ...COMMON_SECURITY,
    roles: ['Customer', 'Kitchen staff', 'Administrator'],
    pii: [
      'Customer name + contact for orders',
      'Delivery address (delivery mode)',
      'Payment tokens handled by the payment provider (never stored raw)',
    ],
    audit: [...COMMON_SECURITY.audit, 'Every order status change recorded with actor'],
  },
  cost: ECONOMY_COST,
  build: [
    {
      id: 'b-req',
      title: 'Finalize requirements + data model',
      phase: 'requirements',
      dependencies: [],
      parallelEligible: false,
    },
    {
      id: 'b-data',
      title: 'Design database schema (categories, items, carts, orders)',
      phase: 'data_model',
      dependencies: ['b-req'],
      parallelEligible: true,
    },
    {
      id: 'b-api',
      title: 'Define menu + cart + order API contract',
      phase: 'api_contract',
      dependencies: ['b-req'],
      parallelEligible: true,
    },
    {
      id: 'b-ui',
      title: 'Design system + menu/cart/checkout UI',
      phase: 'ui_design',
      dependencies: ['b-req'],
      parallelEligible: true,
    },
    {
      id: 'b-impl',
      title: 'Implement ordering flow + admin dashboard',
      phase: 'implementation',
      dependencies: ['b-data', 'b-api', 'b-ui'],
      parallelEligible: false,
    },
    {
      id: 'b-test',
      title: 'Test ordering, payment and admin flows',
      phase: 'testing',
      dependencies: ['b-impl'],
      parallelEligible: false,
    },
    {
      id: 'b-sec',
      title: 'Security review (auth, IDOR, payment tokens)',
      phase: 'security',
      dependencies: ['b-impl'],
      parallelEligible: true,
    },
    {
      id: 'b-build',
      title: 'Build + validate + package',
      phase: 'build',
      dependencies: ['b-test', 'b-sec'],
      parallelEligible: false,
    },
  ],
  journeyActors: [
    {
      actor: 'Customer',
      journeys: [
        {
          name: 'Order food (happy path)',
          path: 'happy',
          steps: [
            { label: 'Open the app' },
            { label: 'Browse menu categories' },
            { label: 'Select items' },
            { label: 'Review cart' },
            { label: 'Checkout' },
            { label: 'Pay (if online)' },
            { label: 'Confirmation' },
            { label: 'Track order' },
          ],
        },
        {
          name: 'Item unavailable',
          path: 'failure',
          steps: [
            { label: 'Select an unavailable item' },
            { label: 'See it disabled or clearly marked' },
            { label: 'Choose an alternative' },
          ],
        },
        {
          name: 'Empty menu',
          path: 'empty_state',
          steps: [
            { label: 'Open an empty category' },
            { label: 'See a friendly empty state' },
            { label: 'Explore other categories' },
          ],
        },
        {
          name: 'Order rejected',
          path: 'validation_failure',
          steps: [
            { label: 'Submit an invalid order' },
            { label: 'See field-level validation' },
            { label: 'Fix and resubmit' },
          ],
        },
        {
          name: 'Offline / network failure',
          path: 'network_failure',
          steps: [
            { label: 'Place order offline' },
            { label: 'See a clear retry prompt' },
            { label: 'Retry when connected' },
          ],
        },
        {
          name: 'Resume after interruption',
          path: 'recovery',
          steps: [
            { label: 'Checkout interrupted' },
            { label: 'Cart restored on return' },
            { label: 'Complete the order' },
          ],
        },
      ],
    },
    ...ADMIN_JOURNEYS,
  ],
  experience: {
    primaryModel: 'workflow',
    secondaryModels: ['mobile_first_workflow', 'dashboard'],
    reasons: [
      'Ordering is a linear task (browse → select → cart → checkout) best served by a guided workflow',
      'Staff need a dashboard for operations',
    ],
    screens: [
      'Home (categories)',
      'Menu',
      'Cart',
      'Checkout',
      'Order confirmation/tracking',
      'Admin dashboard',
      'Admin orders',
      'Admin menu editor',
    ],
    navigation: 'Bottom bar on mobile (Menu / Cart / Orders / Profile); top nav on desktop',
  },
  dataModel: [
    {
      entity: 'Category',
      fields: [
        { name: 'id', type: 'uuid' },
        { name: 'name', type: 'text' },
        { name: 'sortOrder', type: 'int' },
      ],
    },
    {
      entity: 'MenuItem',
      fields: [
        { name: 'id', type: 'uuid' },
        { name: 'categoryId', type: 'uuid' },
        { name: 'name', type: 'text' },
        { name: 'description', type: 'text' },
        { name: 'price', type: 'decimal' },
        { name: 'available', type: 'boolean' },
      ],
    },
    {
      entity: 'Cart',
      fields: [
        { name: 'id', type: 'uuid' },
        { name: 'ownerId', type: 'uuid' },
      ],
    },
    {
      entity: 'Order',
      fields: [
        { name: 'id', type: 'uuid' },
        { name: 'ownerId', type: 'uuid' },
        { name: 'status', type: 'text' },
        { name: 'mode', type: 'text' },
        { name: 'total', type: 'decimal' },
        { name: 'createdAt', type: 'timestamp' },
      ],
    },
    {
      entity: 'OrderItem',
      fields: [
        { name: 'id', type: 'uuid' },
        { name: 'orderId', type: 'uuid' },
        { name: 'itemId', type: 'uuid' },
        { name: 'quantity', type: 'int' },
        { name: 'unitPrice', type: 'decimal' },
      ],
    },
  ],
  apiContract: [
    {
      endpoint: '/api/menu/categories',
      method: 'GET',
      purpose: 'list categories',
      authRequired: false,
    },
    { endpoint: '/api/menu/items', method: 'GET', purpose: 'list items', authRequired: false },
    { endpoint: '/api/cart', method: 'GET', purpose: 'read the cart', authRequired: true },
    {
      endpoint: '/api/cart/items',
      method: 'POST',
      purpose: 'add item to cart',
      authRequired: true,
    },
    { endpoint: '/api/orders', method: 'POST', purpose: 'place an order', authRequired: true },
    { endpoint: '/api/orders', method: 'GET', purpose: 'list my orders', authRequired: true },
    {
      endpoint: '/api/orders/:id/status',
      method: 'GET',
      purpose: 'order status',
      authRequired: true,
    },
    {
      endpoint: '/api/admin/orders',
      method: 'GET',
      purpose: 'admin: list orders',
      authRequired: true,
    },
  ],
  businessRules: [
    'An order can only be placed with at least one available item',
    'Delivery mode requires a valid delivery address',
    'Staff can update order status; customers see status changes',
    'Menu prices are controlled by staff, never by customers',
  ],
  nonGoals: [
    'Table-side payments (hardware POS)',
    'Loyalty program for MVP',
    'Multi-branch management for MVP',
  ],
  deploymentTarget: 'local',
};

// ── ABAP DEBUGGER ───────────────────────────────────────────────────────────

const ABAP: ArchetypeKnowledge = {
  archetype: 'abap-debugger',
  label: 'ABAP debugger assistant',
  keywords: ['abap', 'sap', 'debugger', 'short dump', 'syntax', 'badi', 'enhancement'],
  domains: ['SAP development tools', 'enterprise software'],
  defaultApplicationType: 'Developer tool (web) that diagnoses ABAP code and errors',
  defaultPlatforms: ['Responsive web application'],
  problemPattern:
    'SAP developers waste hours on short dumps and syntax errors; a focused assistant diagnoses ABAP source, explains errors, retrieves SAP knowledge and suggests corrections.',
  questionTemplates: [
    {
      id: 'q-abap-input',
      topic: 'Diagnosis workflow',
      class: 'BLOCKING',
      text: 'How will developers give the assistant code — pasting snippets, uploading files, or connecting to SAP?',
      rationale:
        'Pasted snippets vs SAP integration vs file upload completely changes the data path, security surface and architecture.',
      impacts: {
        architecture: 5,
        security: 4,
        business: 4,
        ux: 3,
        implementation: 5,
        cost: 3,
        confidence: 3,
      },
      options: [
        { label: 'Paste code and error text', value: 'paste' },
        { label: 'Paste + file upload', value: 'paste_upload' },
        { label: 'Live SAP connection', value: 'sap_connection' },
      ],
      defaultAnswer: 'paste',
      resolvesAmbiguity: 'abap-input',
    },
    {
      id: 'q-abap-knowledge',
      topic: 'Knowledge grounding',
      class: 'BLOCKING',
      text: 'Should the assistant explain errors using SAP knowledge (documentation), or only analyze what it is given?',
      rationale:
        'Grounded SAP knowledge requires RAG (external knowledge) with an evidence requirement — an architecture decision.',
      impacts: {
        architecture: 5,
        security: 2,
        business: 4,
        ux: 3,
        implementation: 4,
        cost: 4,
        confidence: 3,
      },
      options: [
        { label: 'Retrieve SAP knowledge to explain errors', value: 'rag' },
        { label: 'Analyze the code only', value: 'code_only' },
      ],
      defaultAnswer: 'rag',
      resolvesAmbiguity: 'sap-knowledge',
    },
    {
      id: 'q-abap-accounts',
      topic: 'Access',
      class: 'IMPORTANT',
      text: 'Who can use this tool — anyone on the internet, or only your developers?',
      rationale:
        'Public vs internal tooling changes authentication, rate limits and data retention.',
      impacts: {
        architecture: 3,
        security: 4,
        business: 3,
        ux: 2,
        implementation: 3,
        cost: 2,
        confidence: 3,
      },
      options: [
        { label: 'Only our developers (invite/login)', value: 'private' },
        { label: 'Anyone can try it', value: 'public' },
      ],
      defaultAnswer: 'private',
      securitySensitive: true,
    },
    {
      id: 'q-abap-version',
      topic: 'Diagnosis workflow',
      class: 'IMPORTANT',
      text: 'Which SAP release should the assistant assume (e.g. S/4HANA, ECC)?',
      rationale:
        'Statement/function availability differs across releases; the answer tunes the knowledge base and suggestions.',
      impacts: {
        architecture: 2,
        security: 1,
        business: 2,
        ux: 1,
        implementation: 2,
        cost: 1,
        confidence: 3,
      },
      options: [
        { label: 'S/4HANA', value: 's4hana' },
        { label: 'ECC', value: 'ecc' },
        { label: 'Both / configurable', value: 'both' },
      ],
      defaultAnswer: 'both',
    },
    {
      id: 'q-abap-output',
      topic: 'Diagnosis workflow',
      class: 'IMPORTANT',
      text: 'What should the assistant return after diagnosis?',
      rationale:
        'The output contract (explanation + corrected code + tests) shapes the AI strategy and structured output.',
      impacts: {
        architecture: 3,
        security: 1,
        business: 3,
        ux: 3,
        implementation: 3,
        cost: 2,
        confidence: 3,
      },
      options: [
        { label: 'Explanation + corrected code + validation', value: 'full' },
        { label: 'Explanation only', value: 'explain_only' },
      ],
      defaultAnswer: 'full',
    },
  ],
  defaultTemplates: [
    {
      id: 'd-abap-storage',
      unknown: 'History storage',
      assumption: 'Developers want to revisit past diagnoses',
      defaultValue: 'Save past diagnoses per developer',
      reason: 'diagnosis history is high-value and cheap to persist',
      impact: 'Data model and privacy',
      securitySensitive: false,
      relatedRequirementDescription: 'Persistent diagnosis history',
      relatedCategory: 'data',
    },
    {
      id: 'd-abap-sensitive',
      unknown: 'Corporate code handling',
      assumption: 'Pasted code may contain confidential logic',
      defaultValue:
        'Code is processed and stored only for the owner; never shared or used for training',
      reason: 'developer code is sensitive corporate IP',
      impact: 'Security plan and retention',
      securitySensitive: true,
      relatedRequirementDescription: 'Confidentiality of pasted source code',
      relatedCategory: 'security',
    },
    {
      id: 'd-abap-export',
      unknown: 'Export needs',
      assumption: 'Developers may want to keep the corrected code',
      defaultValue: 'Copy-to-clipboard + download of corrected code',
      reason: 'trivial to provide and expected by developers',
      impact: 'UI surface',
      securitySensitive: false,
      relatedRequirementDescription: 'Copy/download corrected code',
      relatedCategory: 'ux',
    },
  ],
  design: {
    visualPersonality: 'Focused, professional, information-dense',
    targetAudience: 'Time-pressed SAP developers and consultants',
    brandDirection:
      'Developer-tool aesthetic: dense-but-readable, calm neutral palette with a precise accent',
    colorSystem: [
      'Neutral slate/ink backgrounds',
      'Single precision accent (e.g. deep blue)',
      'Semantic colors only for diagnostics (pass/fail/warning)',
      'Code blocks with clear syntax contrast',
    ],
    typography: 'Compact monospace for code, tight sans-serif for UI, readable line lengths',
    spacing: 'Dense spacing; information density prioritized over whitespace',
    iconography: 'Minimal, technical line icons',
    motion: 'None that delays diagnosis; subtle progress states for analysis',
    responsiveStrategy: 'Editor + results split pane on desktop; stacked cards on mobile',
    accessibility: 'WCAG AA, keyboard shortcuts for analysis, screen-reader-friendly results',
  },
  stack: PLATFORM_STACK,
  ai: {
    required: true,
    capabilities: [
      {
        capability: 'coding',
        purpose: 'analyze ABAP source and generate corrections',
        qualityTier: 'standard',
      },
      {
        capability: 'reasoning',
        purpose: 'trace data flow and explain root cause',
        qualityTier: 'standard',
      },
      {
        capability: 'summarization',
        purpose: 'condense SAP knowledge for the diagnosis',
        qualityTier: 'standard',
      },
    ],
    modelClass: 'Standard reasoning + coding model',
    providerStrategy: 'Default provider via AI runtime routing (capability-based)',
    contextRequirements: [
      'Only the snippet + error, never the whole repository',
      'Grounded SAP knowledge passed as evidence, not model memory',
    ],
    ragRequired: true,
    structuredOutput: true,
    toolCalling: false,
    latencyRequirement: 'Diagnosis under ~10s for a typical snippet',
    qualityRequirement: 'Corrections must be syntactically valid; explanations evidence-grounded',
    tokenBudget: { maxInputTokens: 8_000, maxOutputTokens: 1_200 },
    fallback: 'Abstain (Evidence-First) when SAP knowledge is insufficient — never guess',
    reasons: [
      'The core value is grounded diagnosis',
      'Structured output (explanation/correction/validation) is required for the UI',
    ],
  },
  rag: {
    required: true,
    sources: [
      {
        name: 'SAP ABAP knowledge base',
        collection: 'sap-abap',
        freshness: 'Updated with SAP release notes',
        authority: 'Curated SAP documentation',
      },
    ],
    retrievalStrategy: 'Top-k grounded retrieval with min-score threshold',
    groundingRequired: true,
    evidenceRequired: true,
    reasons: [
      'Error explanations must be grounded in authoritative SAP knowledge',
      'Evidence-First: abstain instead of fabricating',
    ],
  },
  tools: [
    {
      name: 'calculator',
      purpose: 'static validation of numeric expressions in suggestions',
      permissions: 'pure computation only',
      dataAccess: 'none',
      risk: 'low',
      approvalRequired: false,
    },
  ],
  deniedTools: ['filesystem', 'shell', 'network', 'code_execution', 'database'],
  security: {
    ...COMMON_SECURITY,
    roles: ['Developer', 'Administrator'],
    pii: [],
    secrets: [...COMMON_SECURITY.secrets, 'No SAP credentials stored by the web app'],
    fileAccess: ['Pasted snippets are workspace-confined; no arbitrary file reads'],
    audit: [...COMMON_SECURITY.audit, 'Diagnosis history is owner-scoped and deletable'],
  },
  cost: {
    ...ECONOMY_COST,
    baseAiCalls: 18,
    ragCalls: 18,
    inputTokensPerCall: 2_000,
    costPerCallUsd: 0.004,
    assumptions: [
      'RAG retrieval per diagnosis',
      'Two AI calls per diagnosis (analyze + explain)',
      'Standard tier reasoning model',
    ],
  },
  build: [
    {
      id: 'b-req',
      title: 'Finalize requirements + knowledge strategy',
      phase: 'requirements',
      dependencies: [],
      parallelEligible: false,
    },
    {
      id: 'b-data',
      title: 'Design schema (snippets, diagnoses)',
      phase: 'data_model',
      dependencies: ['b-req'],
      parallelEligible: true,
    },
    {
      id: 'b-api',
      title: 'Diagnosis API contract',
      phase: 'api_contract',
      dependencies: ['b-req'],
      parallelEligible: true,
    },
    {
      id: 'b-ui',
      title: 'Editor + results UI',
      phase: 'ui_design',
      dependencies: ['b-req'],
      parallelEligible: true,
    },
    {
      id: 'b-rag',
      title: 'Wire SAP knowledge RAG + grounding',
      phase: 'implementation',
      dependencies: ['b-api'],
      parallelEligible: false,
    },
    {
      id: 'b-impl',
      title: 'Implement diagnosis pipeline (AI runtime)',
      phase: 'implementation',
      dependencies: ['b-data', 'b-api', 'b-ui', 'b-rag'],
      parallelEligible: false,
    },
    {
      id: 'b-test',
      title: 'Test diagnosis accuracy + abstention',
      phase: 'testing',
      dependencies: ['b-impl'],
      parallelEligible: false,
    },
    {
      id: 'b-sec',
      title: 'Security review (code handling, auth)',
      phase: 'security',
      dependencies: ['b-impl'],
      parallelEligible: true,
    },
    {
      id: 'b-build',
      title: 'Build + validate + package',
      phase: 'build',
      dependencies: ['b-test', 'b-sec'],
      parallelEligible: false,
    },
  ],
  journeyActors: [
    {
      actor: 'SAP developer',
      journeys: [
        {
          name: 'Diagnose a short dump',
          path: 'happy',
          steps: [
            { label: 'Paste ABAP code and error' },
            { label: 'Run analysis' },
            { label: 'Retrieve SAP knowledge' },
            { label: 'Read diagnosis + explanation' },
            { label: 'Apply corrected code' },
            { label: 'Validate the fix' },
          ],
        },
        {
          name: 'Insufficient knowledge',
          path: 'failure',
          steps: [
            { label: 'Submit an unusual error' },
            { label: 'System abstains with a reason' },
            { label: 'Refine input or consult SAP docs' },
          ],
        },
        {
          name: 'Empty history',
          path: 'empty_state',
          steps: [
            { label: 'Open history' },
            { label: 'See an explainable empty state' },
            { label: 'Run a first diagnosis' },
          ],
        },
        {
          name: 'Past diagnosis removed',
          path: 'permission_failure',
          steps: [
            { label: 'Access another developer\u2019s history' },
            { label: 'Denied (owner-scoped)' },
            { label: 'Use own history' },
          ],
        },
        {
          name: 'Network failure',
          path: 'network_failure',
          steps: [
            { label: 'Analyze offline' },
            { label: 'See a retry prompt' },
            { label: 'Retry' },
          ],
        },
        {
          name: 'Recovery',
          path: 'recovery',
          steps: [
            { label: 'Analysis interrupted' },
            { label: 'Resume or rerun' },
            { label: 'Get the diagnosis' },
          ],
        },
      ],
    },
    ...ADMIN_JOURNEYS,
  ],
  experience: {
    primaryModel: 'editor',
    secondaryModels: ['search', 'dashboard'],
    reasons: [
      'Diagnosis is a focused input → analysis → output task; an editor split-view is the natural model',
      'History needs search',
    ],
    screens: ['Diagnosis editor', 'Analysis results', 'History', 'Settings'],
    navigation: 'Top-level tabs (Diagnose / History / Settings)',
  },
  dataModel: [
    {
      entity: 'Snippet',
      fields: [
        { name: 'id', type: 'uuid' },
        { name: 'ownerId', type: 'uuid' },
        { name: 'code', type: 'text' },
        { name: 'errorMessage', type: 'text' },
        { name: 'createdAt', type: 'timestamp' },
      ],
    },
    {
      entity: 'Diagnosis',
      fields: [
        { name: 'id', type: 'uuid' },
        { name: 'snippetId', type: 'uuid' },
        { name: 'explanation', type: 'text' },
        { name: 'correctedCode', type: 'text' },
        { name: 'evidence', type: 'jsonb' },
      ],
    },
  ],
  apiContract: [
    {
      endpoint: '/api/diagnose',
      method: 'POST',
      purpose: 'diagnose a snippet + error',
      authRequired: true,
    },
    { endpoint: '/api/snippets', method: 'GET', purpose: 'list my snippets', authRequired: true },
    { endpoint: '/api/snippets', method: 'POST', purpose: 'save a snippet', authRequired: true },
    {
      endpoint: '/api/diagnoses/:id',
      method: 'GET',
      purpose: 'read a diagnosis',
      authRequired: true,
    },
  ],
  businessRules: [
    'Diagnosis only runs on explicitly submitted snippets',
    'Evidence-First: an answer without sufficient SAP knowledge is abstained, never fabricated',
    'Snippets are owner-scoped and never shared across developers',
  ],
  nonGoals: ['Automated SAP transport deployment', 'Live SAP system connection for MVP'],
  deploymentTarget: 'local',
};

// ── AI APP BUILDER ──────────────────────────────────────────────────────────

const AI_APP_BUILDER: ArchetypeKnowledge = {
  archetype: 'ai-app-builder',
  label: 'AI application builder',
  keywords: ['ai app', 'ai application', 'builder', 'copilot', 'agent', 'assistant'],
  domains: ['developer tools', 'AI products'],
  defaultApplicationType: 'Guided AI application builder (idea → scaffold)',
  defaultPlatforms: ['Responsive web application'],
  problemPattern:
    'Non-experts struggle to turn an AI product idea into a concrete, implementable application; a guided builder captures intent, proposes architecture and scaffolds the project.',
  questionTemplates: [
    {
      id: 'q-builder-audience',
      topic: 'Product scope',
      class: 'BLOCKING',
      text: 'Who is this builder for — non-technical founders, developers, or both?',
      rationale:
        'The audience changes the depth of technical detail, the wizard language and the scaffold output.',
      impacts: {
        architecture: 4,
        security: 2,
        business: 5,
        ux: 5,
        implementation: 4,
        cost: 2,
        confidence: 3,
      },
      options: [
        { label: 'Non-technical founders', value: 'founders' },
        { label: 'Developers', value: 'developers' },
        { label: 'Both', value: 'both' },
      ],
      defaultAnswer: 'both',
    },
    {
      id: 'q-builder-output',
      topic: 'Product scope',
      class: 'BLOCKING',
      text: 'What should the builder produce — a specification + architecture, or actual runnable project code?',
      rationale:
        'Producing code means the full build pipeline; producing plans only is a much smaller scope.',
      impacts: {
        architecture: 5,
        security: 3,
        business: 5,
        ux: 4,
        implementation: 5,
        cost: 4,
        confidence: 2,
      },
      options: [
        { label: 'Plans + runnable code scaffold', value: 'code' },
        { label: 'Specification + architecture only', value: 'plans_only' },
      ],
      defaultAnswer: 'code',
      resolvesAmbiguity: 'builder-output',
    },
    {
      id: 'q-builder-ai',
      topic: 'AI usage',
      class: 'BLOCKING',
      text: 'Should the builder itself use AI (to help design the app), and should the apps it builds use AI?',
      rationale:
        'AI in the builder and AI in the generated apps are two separate strategy decisions with different budgets.',
      impacts: {
        architecture: 5,
        security: 2,
        business: 4,
        ux: 3,
        implementation: 5,
        cost: 5,
        confidence: 2,
      },
      options: [
        { label: 'Both (AI-guided builder + AI-capable apps)', value: 'both' },
        { label: 'AI-guided builder only', value: 'builder_only' },
        { label: 'No AI', value: 'none' },
      ],
      defaultAnswer: 'both',
    },
    {
      id: 'q-builder-auth',
      topic: 'Access',
      class: 'IMPORTANT',
      text: 'Who can use the builder, and should users sign in to save their projects?',
      rationale: 'Saving projects requires authentication; public use without accounts is simpler.',
      impacts: {
        architecture: 3,
        security: 3,
        business: 3,
        ux: 2,
        implementation: 3,
        cost: 1,
        confidence: 3,
      },
      options: [
        { label: 'Sign-in required, projects saved', value: 'signed_in' },
        { label: 'No account needed', value: 'public' },
      ],
      defaultAnswer: 'signed_in',
    },
  ],
  defaultTemplates: [
    {
      id: 'd-builder-persist',
      unknown: 'Project persistence',
      assumption: 'Users want to come back to their projects',
      defaultValue: 'Owner-scoped project storage',
      reason: 'a builder without persistence loses its core value',
      impact: 'Data model and auth',
      securitySensitive: false,
      relatedRequirementDescription: 'Persistent projects',
      relatedCategory: 'data',
    },
    {
      id: 'd-builder-scope',
      unknown: 'Build depth',
      assumption: 'Generated apps are validated structured projects, not arbitrary code',
      defaultValue: 'Scaffold validated projects through the Application Factory pipeline',
      reason: 'bounded generation keeps output safe and testable',
      impact: 'Build plan and expectations',
      securitySensitive: false,
      relatedRequirementDescription: 'Validated scaffold output',
      relatedCategory: 'non_functional',
    },
  ],
  design: {
    visualPersonality: 'Confident, modern, clarity-first',
    targetAudience: 'Founders and developers describing an idea and reading a plan',
    brandDirection:
      'Modern AI-product aesthetic: calm surfaces, gradient accents, confident typography',
    colorSystem: [
      'Clean light/dark surfaces',
      'Indigo/violet accent gradient (AI feel)',
      'Semantic status colors',
      'High-contrast text',
    ],
    typography: 'Modern sans with strong hierarchy; generous reading width',
    spacing: 'Comfortable spacing; wizard steps breathe',
    iconography: 'Friendly rounded icons (sparkles, rocket, layers)',
    motion: 'Gentle step transitions between wizard stages',
    responsiveStrategy: 'Single-column wizard on mobile; split summary panel on desktop',
    accessibility: 'WCAG AA, keyboard-complete wizard, focus management between steps',
  },
  stack: PLATFORM_STACK,
  ai: {
    required: true,
    capabilities: [
      {
        capability: 'reasoning',
        purpose: 'derive specifications from an idea',
        qualityTier: 'standard',
      },
      {
        capability: 'classification',
        purpose: 'detect app archetypes and capabilities',
        qualityTier: 'standard',
      },
      {
        capability: 'content_generation',
        purpose: 'generate architecture and plan prose',
        qualityTier: 'standard',
      },
    ],
    modelClass: 'Standard reasoning + generation model',
    providerStrategy: 'Default provider via AI runtime routing',
    contextRequirements: ['The user idea + confirmed requirements only'],
    ragRequired: false,
    structuredOutput: true,
    toolCalling: false,
    latencyRequirement: 'Plan generation under ~15s',
    qualityRequirement: 'Specification must be internally consistent and actionable',
    tokenBudget: { maxInputTokens: 6_000, maxOutputTokens: 2_000 },
    fallback: 'Deterministic templates when AI is unavailable',
    reasons: [
      'The product is AI-centric by definition',
      'Structured output is required to render plans',
    ],
  },
  rag: {
    required: false,
    sources: [],
    retrievalStrategy: 'none',
    groundingRequired: false,
    evidenceRequired: false,
    reasons: ['No external knowledge required beyond templates and runtime capabilities'],
  },
  tools: [
    {
      name: 'generator',
      purpose: 'scaffold validated projects',
      permissions: 'create files in the isolated workspace only',
      dataAccess: 'the generated project',
      risk: 'medium',
      approvalRequired: true,
    },
    {
      name: 'version_control',
      purpose: 'project versioning',
      permissions: 'commit within the project repository',
      dataAccess: 'project files',
      risk: 'low',
      approvalRequired: false,
    },
  ],
  deniedTools: ['shell', 'network', 'code_execution', 'database_admin'],
  security: {
    ...COMMON_SECURITY,
    roles: ['Builder', 'Administrator'],
    pii: [],
    audit: [...COMMON_SECURITY.audit, 'Scaffold generation recorded in the project history'],
  },
  cost: {
    ...ECONOMY_COST,
    baseAiCalls: 24,
    expectedIterations: 3,
    costPerCallUsd: 0.003,
    assumptions: [
      'Multiple AI calls per scaffold (spec, architecture, plan)',
      'Deterministic phases add no cost',
    ],
  },
  build: [
    {
      id: 'b-req',
      title: 'Requirements + builder scope',
      phase: 'requirements',
      dependencies: [],
      parallelEligible: false,
    },
    {
      id: 'b-data',
      title: 'Project + scaffold schema',
      phase: 'data_model',
      dependencies: ['b-req'],
      parallelEligible: true,
    },
    {
      id: 'b-api',
      title: 'Builder API contract',
      phase: 'api_contract',
      dependencies: ['b-req'],
      parallelEligible: true,
    },
    {
      id: 'b-ui',
      title: 'Wizard + plan summary UI',
      phase: 'ui_design',
      dependencies: ['b-req'],
      parallelEligible: true,
    },
    {
      id: 'b-impl',
      title: 'Implement builder pipeline (AI runtime + factory)',
      phase: 'implementation',
      dependencies: ['b-data', 'b-api', 'b-ui'],
      parallelEligible: false,
    },
    {
      id: 'b-test',
      title: 'Test archetype detection + scaffold validity',
      phase: 'testing',
      dependencies: ['b-impl'],
      parallelEligible: false,
    },
    {
      id: 'b-sec',
      title: 'Security review',
      phase: 'security',
      dependencies: ['b-impl'],
      parallelEligible: true,
    },
    {
      id: 'b-build',
      title: 'Build + validate + package',
      phase: 'build',
      dependencies: ['b-test', 'b-sec'],
      parallelEligible: false,
    },
  ],
  journeyActors: [
    {
      actor: 'Builder',
      journeys: [
        {
          name: 'Scaffold an AI app',
          path: 'happy',
          steps: [
            { label: 'Describe the idea' },
            { label: 'Answer key questions' },
            { label: 'Review the plan' },
            { label: 'Approve' },
            { label: 'Project scaffolded' },
            { label: 'Continue in the workspace' },
          ],
        },
        {
          name: 'Ambiguous idea',
          path: 'validation_failure',
          steps: [
            { label: 'Submit a vague idea' },
            { label: 'Asked targeted questions' },
            { label: 'Clarify and continue' },
          ],
        },
        {
          name: 'Empty project list',
          path: 'empty_state',
          steps: [
            { label: 'Open projects' },
            { label: 'See an inviting empty state' },
            { label: 'Start a new project' },
          ],
        },
        {
          name: 'Recovery',
          path: 'recovery',
          steps: [
            { label: 'Plan interrupted' },
            { label: 'Resume from the saved session' },
            { label: 'Complete the plan' },
          ],
        },
      ],
    },
    ...ADMIN_JOURNEYS,
  ],
  experience: {
    primaryModel: 'wizard',
    secondaryModels: ['dashboard', 'workflow'],
    reasons: [
      'Building an app is a guided multi-step flow (describe → clarify → approve → scaffold)',
      'A dashboard lists and resumes projects',
    ],
    screens: ['Idea intake', 'Questions', 'Plan review', 'Project list', 'Scaffold result'],
    navigation: 'Linear wizard with a persistent progress indicator',
  },
  dataModel: [
    {
      entity: 'Project',
      fields: [
        { name: 'id', type: 'uuid' },
        { name: 'ownerId', type: 'uuid' },
        { name: 'idea', type: 'text' },
        { name: 'status', type: 'text' },
        { name: 'createdAt', type: 'timestamp' },
      ],
    },
    {
      entity: 'Scaffold',
      fields: [
        { name: 'id', type: 'uuid' },
        { name: 'projectId', type: 'uuid' },
        { name: 'blueprint', type: 'jsonb' },
        { name: 'version', type: 'text' },
      ],
    },
  ],
  apiContract: [
    {
      endpoint: '/api/projects',
      method: 'POST',
      purpose: 'create a project from an idea',
      authRequired: true,
    },
    {
      endpoint: '/api/projects/:id/plan',
      method: 'GET',
      purpose: 'read the generated plan',
      authRequired: true,
    },
    {
      endpoint: '/api/projects/:id/scaffold',
      method: 'POST',
      purpose: 'approve and scaffold',
      authRequired: true,
    },
    { endpoint: '/api/projects', method: 'GET', purpose: 'list my projects', authRequired: true },
  ],
  businessRules: [
    'Scaffolding requires explicit plan approval',
    'Generated projects are validated before they are exposed as ready',
    'A user can only access their own projects',
  ],
  nonGoals: ['One-click production deployment of generated apps for MVP'],
  deploymentTarget: 'local',
};

// ── GENERIC WEB ─────────────────────────────────────────────────────────────

const GENERIC: ArchetypeKnowledge = {
  archetype: 'generic-web',
  label: 'Web application',
  keywords: ['web', 'app', 'platform', 'dashboard', 'portal', 'tool'],
  domains: ['general'],
  defaultApplicationType: 'Web application',
  defaultPlatforms: ['Responsive web application'],
  problemPattern:
    'A web application that turns a described workflow into a usable product with defined users, data and operations.',
  questionTemplates: [
    {
      id: 'q-generic-users',
      topic: 'Users & access',
      class: 'BLOCKING',
      text: 'Who will use this application, and do they need to sign in?',
      rationale: 'Authentication and role scope are architecture-changing and security-sensitive.',
      impacts: {
        architecture: 5,
        security: 5,
        business: 4,
        ux: 3,
        implementation: 4,
        cost: 2,
        confidence: 3,
      },
      options: [
        { label: 'Sign-in with accounts', value: 'accounts' },
        { label: 'Public access', value: 'public' },
        { label: 'Invite-only', value: 'invite' },
      ],
      defaultAnswer: 'accounts',
      securitySensitive: true,
    },
    {
      id: 'q-generic-admin',
      topic: 'Users & access',
      class: 'IMPORTANT',
      text: 'Does someone need to administer content or users?',
      rationale: 'Admin surfaces add a role model and dashboard scope.',
      impacts: {
        architecture: 3,
        security: 3,
        business: 3,
        ux: 2,
        implementation: 3,
        cost: 1,
        confidence: 3,
      },
      options: [
        { label: 'Admin dashboard needed', value: 'admin' },
        { label: 'No admin UI for MVP', value: 'none' },
      ],
      defaultAnswer: 'admin',
    },
    {
      id: 'q-generic-deploy',
      topic: 'Delivery',
      class: 'IMPORTANT',
      text: 'Where should this run once built — internally, or on the public web?',
      rationale: 'Deployment target changes the environment, security posture and ops plan.',
      impacts: {
        architecture: 3,
        security: 2,
        business: 3,
        ux: 1,
        implementation: 2,
        cost: 3,
        confidence: 3,
      },
      options: [
        { label: 'Internal / private', value: 'internal' },
        { label: 'Public web', value: 'public_web' },
      ],
      defaultAnswer: 'public_web',
    },
    {
      id: 'q-generic-data',
      topic: 'Data',
      class: 'BLOCKING',
      text: 'What is the most important data this app manages?',
      rationale: 'The core entity drives the data model and the whole API surface.',
      impacts: {
        architecture: 5,
        security: 2,
        business: 5,
        ux: 2,
        implementation: 5,
        cost: 2,
        confidence: 2,
      },
      freeText: true,
    },
  ],
  defaultTemplates: [
    {
      id: 'd-generic-stack',
      unknown: 'Technology stack',
      assumption: 'The app should reuse the proven platform stack',
      defaultValue: 'Next.js/React + Postgres + platform runtime',
      reason: 'the frozen platform stack is the safest, most maintainable default',
      impact: 'Every layer of the architecture',
      securitySensitive: false,
      relatedRequirementDescription: 'Reuse the platform technology stack',
      relatedCategory: 'non_functional',
    },
    {
      id: 'd-generic-responsiveness',
      unknown: 'Platforms',
      assumption: 'Users access from desktop and mobile',
      defaultValue: 'Responsive web application',
      reason: 'responsive web covers the widest audience with one build',
      impact: 'UI strategy',
      securitySensitive: false,
      relatedRequirementDescription: 'Responsive web UI',
      relatedCategory: 'ux',
    },
    {
      id: 'd-generic-ai',
      unknown: 'AI usage',
      assumption: 'AI is only added where it adds product value',
      defaultValue: 'No AI unless the goal requires it',
      reason: 'AI adds cost and latency; adding it unnecessarily violates the simplicity principle',
      impact: 'AI strategy and cost plan',
      securitySensitive: false,
      relatedRequirementDescription: 'No unnecessary AI',
      relatedCategory: 'ai',
    },
  ],
  design: {
    visualPersonality: 'Clean, professional, task-focused',
    targetAudience: 'The application\u2019s primary end users and operators',
    brandDirection: 'Neutral professional brand with a clear accent; content-first layout',
    colorSystem: [
      'Neutral light surfaces with dark text',
      'One consistent accent color',
      'Semantic colors for status',
      'White cards on soft gray background',
    ],
    typography: 'Clear sans-serif hierarchy; readable body text; restrained display type',
    spacing: 'Consistent 4/8px scale; comfortable card spacing',
    iconography: 'Clean, consistent line icons',
    motion: 'Subtle transitions; no gratuitous animation',
    responsiveStrategy: 'Desktop-first with a mobile-usable layout',
    accessibility: 'WCAG AA, semantic HTML, visible focus, keyboard support',
  },
  stack: PLATFORM_STACK,
  ai: {
    required: false,
    capabilities: [],
    modelClass: 'none by default',
    providerStrategy: 'n/a (deterministic core)',
    contextRequirements: [],
    ragRequired: false,
    structuredOutput: false,
    toolCalling: false,
    latencyRequirement: 'Core flows must not depend on AI latency',
    qualityRequirement: 'Deterministic correctness of core flows',
    tokenBudget: { maxInputTokens: 0, maxOutputTokens: 0 },
    fallback: 'n/a',
    reasons: ['AI is only introduced when the goal requires it — never by default'],
  },
  rag: {
    required: false,
    sources: [],
    retrievalStrategy: 'none',
    groundingRequired: false,
    evidenceRequired: false,
    reasons: ['No domain knowledge required by default'],
  },
  tools: [],
  deniedTools: ['shell', 'filesystem', 'network', 'code_execution', 'database_admin'],
  security: COMMON_SECURITY,
  cost: ECONOMY_COST,
  build: [
    {
      id: 'b-req',
      title: 'Finalize requirements + core entity',
      phase: 'requirements',
      dependencies: [],
      parallelEligible: false,
    },
    {
      id: 'b-data',
      title: 'Design schema for the core entity',
      phase: 'data_model',
      dependencies: ['b-req'],
      parallelEligible: true,
    },
    {
      id: 'b-api',
      title: 'API contract for core workflows',
      phase: 'api_contract',
      dependencies: ['b-req'],
      parallelEligible: true,
    },
    {
      id: 'b-ui',
      title: 'Core screens + design system',
      phase: 'ui_design',
      dependencies: ['b-req'],
      parallelEligible: true,
    },
    {
      id: 'b-impl',
      title: 'Implement core workflows',
      phase: 'implementation',
      dependencies: ['b-data', 'b-api', 'b-ui'],
      parallelEligible: false,
    },
    {
      id: 'b-test',
      title: 'Test core workflows',
      phase: 'testing',
      dependencies: ['b-impl'],
      parallelEligible: false,
    },
    {
      id: 'b-sec',
      title: 'Security review',
      phase: 'security',
      dependencies: ['b-impl'],
      parallelEligible: true,
    },
    {
      id: 'b-build',
      title: 'Build + validate + package',
      phase: 'build',
      dependencies: ['b-test', 'b-sec'],
      parallelEligible: false,
    },
  ],
  journeyActors: [
    {
      actor: 'End user',
      journeys: [
        {
          name: 'Complete the core workflow',
          path: 'happy',
          steps: [
            { label: 'Open the app' },
            { label: 'Complete the primary action' },
            { label: 'See the result' },
          ],
        },
        {
          name: 'Invalid input',
          path: 'validation_failure',
          steps: [
            { label: 'Submit invalid data' },
            { label: 'See field-level errors' },
            { label: 'Fix and resubmit' },
          ],
        },
        {
          name: 'Empty state',
          path: 'empty_state',
          steps: [
            { label: 'Open with no data' },
            { label: 'See a helpful empty state' },
            { label: 'Take the first action' },
          ],
        },
        {
          name: 'Permission denied',
          path: 'permission_failure',
          steps: [
            { label: 'Attempt a restricted action' },
            { label: 'See a clear denial' },
            { label: 'Request access' },
          ],
        },
        {
          name: 'Network failure',
          path: 'network_failure',
          steps: [{ label: 'Act offline' }, { label: 'See a retry prompt' }, { label: 'Retry' }],
        },
        {
          name: 'Recovery',
          path: 'recovery',
          steps: [{ label: 'Action interrupted' }, { label: 'Resume' }, { label: 'Complete' }],
        },
      ],
    },
    ...ADMIN_JOURNEYS,
  ],
  experience: {
    primaryModel: 'dashboard',
    secondaryModels: ['workflow', 'search'],
    reasons: [
      'A generic web app is best served by a dashboard with clear task entry points',
      'Workflows cover multi-step operations',
    ],
    screens: ['Home/dashboard', 'Primary workflow', 'Detail view', 'Settings'],
    navigation: 'Sidebar navigation with breadcrumbs',
  },
  dataModel: [
    {
      entity: 'Item',
      fields: [
        { name: 'id', type: 'uuid' },
        { name: 'name', type: 'text' },
        { name: 'ownerId', type: 'uuid' },
        { name: 'createdAt', type: 'timestamp' },
      ],
    },
  ],
  apiContract: [
    { endpoint: '/api/items', method: 'GET', purpose: 'list items', authRequired: true },
    { endpoint: '/api/items', method: 'POST', purpose: 'create an item', authRequired: true },
  ],
  businessRules: ['Core workflow rules defined during requirement confirmation'],
  nonGoals: ['Scope beyond the confirmed core workflow'],
  deploymentTarget: 'local',
};

// ── Knowledge index ─────────────────────────────────────────────────────────

export const ARCHETYPE_KNOWLEDGE: Record<AppArchetype, ArchetypeKnowledge> = {
  'restaurant-app': RESTAURANT,
  'abap-debugger': ABAP,
  'ai-app-builder': AI_APP_BUILDER,
  'generic-web': GENERIC,
};

/** Resolve the knowledge set for an archetype (falls back to generic). */
export function knowledgeFor(archetype: AppArchetype): ArchetypeKnowledge {
  return ARCHETYPE_KNOWLEDGE[archetype];
}

/** All archetype ids in knowledge order. */
export const KNOWN_ARCHETYPES: AppArchetype[] = [
  'restaurant-app',
  'abap-debugger',
  'ai-app-builder',
  'generic-web',
];

/** Impact scale used by the question ranker (higher = more architecture impact). */
export const IMPACT_WEIGHTS = {
  architecture: 5,
  security: 4,
  business: 3,
  ux: 2,
  implementation: 3,
  cost: 2,
  confidence: 1,
} as const;

export function buildDesignSpecification(
  sessionId: string,
  k: ArchetypeKnowledge,
  customAudience?: string,
): DesignSpecification {
  return {
    sessionId,
    visualPersonality: k.design.visualPersonality,
    targetAudience: customAudience ?? k.design.targetAudience,
    brandDirection: k.design.brandDirection,
    colorSystem: k.design.colorSystem,
    typography: k.design.typography,
    spacing: k.design.spacing,
    components: [
      'Primary action button',
      'Status indicator',
      'Empty state component',
      'Loading skeleton',
      'Error banner',
    ],
    iconography: k.design.iconography,
    motion: k.design.motion,
    responsiveStrategy: k.design.responsiveStrategy,
    accessibility: k.design.accessibility,
    interactionStates: ['hover', 'focus', 'active', 'disabled', 'loading', 'error'],
    emptyStates: [
      'First-run empty state with a call to action',
      'No-results state with a reset action',
    ],
    loadingStates: [
      'Skeleton placeholders for lists',
      'Inline progress for actions',
      'Full-screen loader only for critical transitions',
    ],
    errorStates: [
      'Inline field errors',
      'Action-level error banners with retry',
      'Global error boundary with recovery',
    ],
    rationale: [
      `Design personality: ${k.design.visualPersonality}`,
      `Audience: ${k.design.targetAudience}`,
      `Brand direction: ${k.design.brandDirection}`,
    ],
  };
}
