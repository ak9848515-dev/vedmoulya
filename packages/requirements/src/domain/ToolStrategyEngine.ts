// ──────────────────────────────────────────────────────────────────
// VedMoulya — Product Intelligence: Tool Strategy Engine
// EPIC-009 — Phase 19. Identifies the tools the generated application
// needs (database, email, payment, maps, storage, GitHub, external
// APIs, MCP, browser, file processing). Every tool carries purpose,
// permissions, data access, risk and approval requirement. No
// unrestricted tool access is ever planned.
// ──────────────────────────────────────────────────────────────────

import type { AppArchetype } from '@vedmoulya/app-factory';
import type { ToolStrategy, ToolStrategyEntry } from '../types/requirement-types.js';
import { knowledgeFor } from '../catalog/knowledge.js';

export interface ToolStrategyInput {
  sessionId: string;
  archetype: AppArchetype;
  /** Integrations explicitly requested by the user. */
  requestedIntegrations: string[];
}

const INTEGRATION_TOOL: Array<{
  integration: string;
  tool: Omit<ToolStrategyEntry, 'name'> & { name: string };
}> = [
  {
    integration: 'payment',
    tool: {
      name: 'payment',
      purpose: 'process payments',
      permissions: 'charge the order total only',
      dataAccess: 'order total + payment token (never raw card data)',
      risk: 'high',
      approvalRequired: true,
    },
  },
  {
    integration: 'email',
    tool: {
      name: 'email',
      purpose: 'transactional notifications',
      permissions: 'send transactional email to the customer',
      dataAccess: 'customer email + order reference',
      risk: 'low',
      approvalRequired: false,
    },
  },
  {
    integration: 'maps',
    tool: {
      name: 'maps',
      purpose: 'location search / address autocomplete',
      permissions: 'geocode user-entered addresses',
      dataAccess: 'user-entered address',
      risk: 'medium',
      approvalRequired: true,
    },
  },
  {
    integration: 'version control',
    tool: {
      name: 'version_control',
      purpose: 'project versioning',
      permissions: 'commit within the project repository',
      dataAccess: 'project files',
      risk: 'low',
      approvalRequired: false,
    },
  },
];

export class ToolStrategyEngine {
  derive(input: ToolStrategyInput): ToolStrategy {
    const k = knowledgeFor(input.archetype);
    const tools: ToolStrategyEntry[] = [...k.tools];
    const requested = new Set(input.requestedIntegrations.map((i) => i.toLowerCase()));

    for (const mapping of INTEGRATION_TOOL) {
      const integrationMatches = Array.from(requested).some((i) => i.includes(mapping.integration));
      const alreadyPlanned = tools.some((t) => t.name === mapping.tool.name);
      if (integrationMatches && !alreadyPlanned) {
        tools.push(mapping.tool);
      }
    }

    // High-risk tools always require approval (Phase 19: no unrestricted access).
    const withApproval = tools.map((t) =>
      t.risk === 'high' ? { ...t, approvalRequired: true } : t,
    );

    return {
      tools: withApproval,
      deniedTools: [
        ...k.deniedTools,
        'unrestricted_shell',
        'unrestricted_filesystem',
        'unrestricted_network',
      ],
    };
  }
}
