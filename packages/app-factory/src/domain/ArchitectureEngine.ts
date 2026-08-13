// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Application Factory: Architecture Engine
// EPIC-007 — Phase 2. Converts an ApplicationSpecification into a
// technology-aware ApplicationArchitecture. Technology choices are
// declared, explained, and biased toward reusing approved VedMoulya
// platform capabilities — never arbitrarily vendor-locked.
// ──────────────────────────────────────────────────────────────────

import type {
  ApplicationArchitecture,
  ApplicationSpecification,
  ArchitectureLayer,
  DeploymentTargetId,
} from '../types/app-types.js';

export interface ArchitectureEngineOptions {
  specification: ApplicationSpecification;
  /** Override the default deployment target. */
  deploymentTarget?: DeploymentTargetId;
}

/** Approved default stack per archetype (declared, not invented per run). */
function stackFor(archetype: ApplicationSpecification['archetype']): Array<{
  layer: ArchitectureLayer['layer'];
  technology: string;
  reusesPlatform: boolean;
  rationale: string;
}> {
  switch (archetype) {
    case 'abap-debugger':
      return [
        {
          layer: 'frontend',
          technology: 'Next.js / React',
          reusesPlatform: true,
          rationale: 'the VedMoulya web stack is Next.js/React — reuse the frozen design system',
        },
        {
          layer: 'backend',
          technology: 'VedMoulya API runtime',
          reusesPlatform: true,
          rationale: 'business logic flows through the existing gateway + AI runtime',
        },
        {
          layer: 'database',
          technology: 'Postgres',
          reusesPlatform: true,
          rationale: 'Postgres is the frozen VedMoulya database contract',
        },
        {
          layer: 'auth',
          technology: 'Existing approved auth infrastructure',
          reusesPlatform: true,
          rationale: 'reuse the platform identity layer instead of building auth',
        },
        {
          layer: 'ai',
          technology: 'VedMoulya AI Runtime',
          reusesPlatform: true,
          rationale: 'every AI call must flow through the frozen runtime',
        },
        {
          layer: 'rag',
          technology: 'VedMoulya RAG',
          reusesPlatform: true,
          rationale: 'SAP knowledge retrieval is grounded via the platform RAG',
        },
        {
          layer: 'tools',
          technology: 'Frozen ToolRuntime',
          reusesPlatform: true,
          rationale: 'tool execution inherits allowlists, schema validation and audit',
        },
        {
          layer: 'api',
          technology: 'tRPC / typed API contract',
          reusesPlatform: true,
          rationale: 'typed API boundary matches the platform gateway pattern',
        },
        {
          layer: 'testing',
          technology: 'Vitest + deterministic fixtures',
          reusesPlatform: true,
          rationale: 'matches the platform testing stack',
        },
        {
          layer: 'deployment',
          technology: 'Supported deployment target',
          reusesPlatform: false,
          rationale: 'deployment is an approved adapter, not a new vendor',
        },
      ];
    case 'restaurant-app':
      return [
        {
          layer: 'frontend',
          technology: 'Next.js / React',
          reusesPlatform: true,
          rationale: 'the VedMoulya web stack is Next.js/React with a shared design system',
        },
        {
          layer: 'backend',
          technology: 'VedMoulya API runtime',
          reusesPlatform: true,
          rationale: 'menu/cart/order logic flows through the existing gateway',
        },
        {
          layer: 'database',
          technology: 'Postgres',
          reusesPlatform: true,
          rationale: 'Postgres is the frozen database contract',
        },
        {
          layer: 'auth',
          technology: 'Existing approved auth infrastructure',
          reusesPlatform: true,
          rationale: 'reuse the platform identity layer',
        },
        {
          layer: 'ai',
          technology: 'VedMoulya AI Runtime (optional recommendations)',
          reusesPlatform: true,
          rationale: 'AI stays behind the runtime boundary when used',
        },
        {
          layer: 'rag',
          technology: 'VedMoulya RAG (optional)',
          reusesPlatform: true,
          rationale: 'only if menu/search grounding is required',
        },
        {
          layer: 'tools',
          technology: 'Frozen ToolRuntime',
          reusesPlatform: true,
          rationale: 'no new tool surface',
        },
        {
          layer: 'api',
          technology: 'tRPC / typed API contract',
          reusesPlatform: true,
          rationale: 'typed API boundary matches the platform gateway pattern',
        },
        {
          layer: 'testing',
          technology: 'Vitest + deterministic fixtures',
          reusesPlatform: true,
          rationale: 'matches the platform testing stack',
        },
        {
          layer: 'deployment',
          technology: 'Supported deployment target',
          reusesPlatform: false,
          rationale: 'deployment is an approved adapter',
        },
      ];
    case 'ai-app-builder':
      return [
        {
          layer: 'frontend',
          technology: 'Next.js / React',
          reusesPlatform: true,
          rationale: 'the VedMoulya web stack is Next.js/React',
        },
        {
          layer: 'backend',
          technology: 'VedMoulya API runtime',
          reusesPlatform: true,
          rationale: 'the builder orchestrates through the existing runtime',
        },
        {
          layer: 'database',
          technology: 'Postgres',
          reusesPlatform: true,
          rationale: 'Postgres is the frozen database contract',
        },
        {
          layer: 'auth',
          technology: 'Existing approved auth infrastructure',
          reusesPlatform: true,
          rationale: 'reuse the platform identity layer',
        },
        {
          layer: 'ai',
          technology: 'VedMoulya AI Runtime',
          reusesPlatform: true,
          rationale: 'the builder IS an AI application — all AI flows through the runtime',
        },
        {
          layer: 'rag',
          technology: 'VedMoulya RAG',
          reusesPlatform: true,
          rationale: 'grounded project generation via platform RAG',
        },
        {
          layer: 'tools',
          technology: 'Frozen ToolRuntime',
          reusesPlatform: true,
          rationale: 'controlled tool execution',
        },
        {
          layer: 'api',
          technology: 'tRPC / typed API contract',
          reusesPlatform: true,
          rationale: 'typed API boundary',
        },
        {
          layer: 'testing',
          technology: 'Vitest + deterministic fixtures',
          reusesPlatform: true,
          rationale: 'matches the platform testing stack',
        },
        {
          layer: 'deployment',
          technology: 'Supported deployment target',
          reusesPlatform: false,
          rationale: 'deployment is an approved adapter',
        },
      ];
    default:
      return [
        {
          layer: 'frontend',
          technology: 'Next.js / React',
          reusesPlatform: true,
          rationale: 'the VedMoulya web stack is Next.js/React',
        },
        {
          layer: 'backend',
          technology: 'VedMoulya API runtime',
          reusesPlatform: true,
          rationale: 'business logic flows through the existing gateway',
        },
        {
          layer: 'database',
          technology: 'Postgres',
          reusesPlatform: true,
          rationale: 'Postgres is the frozen database contract',
        },
        {
          layer: 'auth',
          technology: 'Existing approved auth infrastructure',
          reusesPlatform: true,
          rationale: 'reuse the platform identity layer',
        },
        {
          layer: 'ai',
          technology: 'VedMoulya AI Runtime (as required)',
          reusesPlatform: true,
          rationale: 'AI stays behind the runtime boundary',
        },
        {
          layer: 'rag',
          technology: 'VedMoulya RAG (as required)',
          reusesPlatform: true,
          rationale: 'grounded retrieval when needed',
        },
        {
          layer: 'tools',
          technology: 'Frozen ToolRuntime',
          reusesPlatform: true,
          rationale: 'no new tool surface',
        },
        {
          layer: 'api',
          technology: 'tRPC / typed API contract',
          reusesPlatform: true,
          rationale: 'typed API boundary',
        },
        {
          layer: 'testing',
          technology: 'Vitest + deterministic fixtures',
          reusesPlatform: true,
          rationale: 'matches the platform testing stack',
        },
        {
          layer: 'deployment',
          technology: 'Supported deployment target',
          reusesPlatform: false,
          rationale: 'deployment is an approved adapter',
        },
      ];
  }
}

export class ArchitectureEngine {
  derive(options: ArchitectureEngineOptions): ApplicationArchitecture {
    const { specification } = options;
    const stack = stackFor(specification.archetype);
    const layers: ArchitectureLayer[] = stack.map((entry) => ({
      layer: entry.layer,
      technology: entry.technology,
      reusesPlatform: entry.reusesPlatform,
      rationale: entry.rationale,
    }));

    const dataModel = this.buildDataModel(specification);
    const apiContract = this.buildApiContract(specification);
    const aiCapabilities = this.buildAiCapabilities(specification);
    const deploymentTarget = options.deploymentTarget ?? defaultDeploymentTarget();

    return {
      applicationId: specification.applicationId,
      layers,
      dataModel,
      apiContract,
      aiCapabilities,
      integrations: this.buildIntegrations(specification),
      securityControls: this.buildSecurityControls(),
      performanceTargets: this.buildPerformanceTargets(),
      deploymentTarget,
      validationReasons: stack.map((s) => `layer ${s.layer}: ${s.technology} — ${s.rationale}`),
    };
  }

  private buildDataModel(
    specification: ApplicationSpecification,
  ): ApplicationArchitecture['dataModel'] {
    switch (specification.archetype) {
      case 'abap-debugger':
        return [
          {
            entity: 'Snippet',
            fields: [
              { name: 'id', type: 'uuid' },
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
            ],
          },
        ];
      case 'restaurant-app':
        return [
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
              { name: 'price', type: 'decimal' },
              { name: 'available', type: 'boolean' },
            ],
          },
          {
            entity: 'Cart',
            fields: [
              { name: 'id', type: 'uuid' },
              { name: 'userId', type: 'uuid' },
            ],
          },
          {
            entity: 'Order',
            fields: [
              { name: 'id', type: 'uuid' },
              { name: 'userId', type: 'uuid' },
              { name: 'status', type: 'text' },
              { name: 'total', type: 'decimal' },
              { name: 'createdAt', type: 'timestamp' },
            ],
          },
        ];
      case 'ai-app-builder':
        return [
          {
            entity: 'Project',
            fields: [
              { name: 'id', type: 'uuid' },
              { name: 'ownerId', type: 'uuid' },
              { name: 'goal', type: 'text' },
              { name: 'status', type: 'text' },
              { name: 'createdAt', type: 'timestamp' },
            ],
          },
          {
            entity: 'GeneratedBlueprint',
            fields: [
              { name: 'id', type: 'uuid' },
              { name: 'projectId', type: 'uuid' },
              { name: 'blueprintJson', type: 'jsonb' },
              { name: 'version', type: 'text' },
            ],
          },
        ];
      default:
        return [
          {
            entity: 'Item',
            fields: [
              { name: 'id', type: 'uuid' },
              { name: 'name', type: 'text' },
              { name: 'createdAt', type: 'timestamp' },
            ],
          },
        ];
    }
  }

  private buildApiContract(
    specification: ApplicationSpecification,
  ): ApplicationArchitecture['apiContract'] {
    const contract: ApplicationArchitecture['apiContract'] = [];
    switch (specification.archetype) {
      case 'abap-debugger':
        contract.push(
          {
            endpoint: '/api/debug/diagnose',
            method: 'POST',
            purpose: 'diagnose an ABAP snippet + error',
            authRequired: true,
          },
          {
            endpoint: '/api/debug/snippets',
            method: 'GET',
            purpose: 'list saved snippets',
            authRequired: true,
          },
        );
        break;
      case 'restaurant-app':
        contract.push(
          {
            endpoint: '/api/menu/categories',
            method: 'GET',
            purpose: 'list menu categories',
            authRequired: false,
          },
          {
            endpoint: '/api/menu/items',
            method: 'GET',
            purpose: 'list menu items',
            authRequired: false,
          },
          { endpoint: '/api/cart', method: 'GET', purpose: 'read the cart', authRequired: true },
          {
            endpoint: '/api/cart/items',
            method: 'POST',
            purpose: 'add an item to the cart',
            authRequired: true,
          },
          {
            endpoint: '/api/orders',
            method: 'POST',
            purpose: 'place an order',
            authRequired: true,
          },
          { endpoint: '/api/orders', method: 'GET', purpose: 'list my orders', authRequired: true },
          {
            endpoint: '/api/admin/orders',
            method: 'GET',
            purpose: 'admin: list all orders',
            authRequired: true,
          },
        );
        break;
      case 'ai-app-builder':
        contract.push(
          {
            endpoint: '/api/projects',
            method: 'POST',
            purpose: 'create a project from a goal',
            authRequired: true,
          },
          {
            endpoint: '/api/projects/:id/blueprint',
            method: 'GET',
            purpose: 'read the generated blueprint',
            authRequired: true,
          },
          {
            endpoint: '/api/projects/:id/validate',
            method: 'POST',
            purpose: 're-run validation',
            authRequired: true,
          },
        );
        break;
      default:
        contract.push(
          { endpoint: '/api/items', method: 'GET', purpose: 'list items', authRequired: false },
          { endpoint: '/api/items', method: 'POST', purpose: 'create an item', authRequired: true },
        );
    }
    return contract;
  }

  private buildAiCapabilities(
    specification: ApplicationSpecification,
  ): ApplicationArchitecture['aiCapabilities'] {
    switch (specification.archetype) {
      case 'abap-debugger':
        return [
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
            evidence: { collection: 'sap-abap', groundingRequired: true },
          },
        ];
      case 'restaurant-app':
        return [
          {
            capability: 'content_generation',
            purpose: 'generate menu descriptions',
            qualityTier: 'economy',
          },
        ];
      case 'ai-app-builder':
        return [
          {
            capability: 'reasoning',
            purpose: 'derive project specifications',
            qualityTier: 'standard',
          },
          {
            capability: 'content_generation',
            purpose: 'generate architecture + blueprint text',
            qualityTier: 'standard',
          },
          {
            capability: 'classification',
            purpose: 'detect archetypes and capabilities',
            qualityTier: 'standard',
          },
        ];
      default:
        return [
          {
            capability: 'content_generation',
            purpose: 'generate application content',
            qualityTier: 'economy',
          },
        ];
    }
  }

  private buildIntegrations(
    specification: ApplicationSpecification,
  ): ApplicationArchitecture['integrations'] {
    const integrations: ApplicationArchitecture['integrations'] = [];
    if (specification.features.some((f) => f.toLowerCase().includes('payment'))) {
      integrations.push({ name: 'Payment provider', purpose: 'checkout processing' });
    }
    if (specification.features.some((f) => f.toLowerCase().includes('notif'))) {
      integrations.push({ name: 'Notification channel', purpose: 'order and account alerts' });
    }
    if (specification.archetype === 'abap-debugger') {
      integrations.push({
        name: 'SAP knowledge base (RAG)',
        purpose: 'grounded error documentation',
      });
    }
    if (integrations.length === 0) {
      integrations.push({ name: 'None required for MVP', purpose: 'keep the first build focused' });
    }
    return integrations;
  }

  private buildSecurityControls(): string[] {
    return [
      'Authentication via the approved identity infrastructure',
      'Authorization checks on every API endpoint',
      'IDOR protection (owner-scoped reads/writes)',
      'Input validation on every endpoint',
      'No secrets in the repository (environment injection only)',
      'Dependency allowlist enforced by the factory',
    ];
  }

  private buildPerformanceTargets(): string[] {
    return [
      'Initial page load < 3s on mid-tier hardware',
      'API p95 latency < 500ms',
      'No N+1 queries in the data model',
      'Bundle budgets enforced at build time',
    ];
  }
}

function defaultDeploymentTarget(): DeploymentTargetId {
  return 'local';
}
