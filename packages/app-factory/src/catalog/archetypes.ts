// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Application Factory: Archetype Catalog
// EPIC-007 — Phase 2/18. Controlled interpretation: a user idea is
// mapped to a supported archetype deterministically. New archetypes
// are added here as declarative data — never as special-case code.
// ──────────────────────────────────────────────────────────────────

import type { AppArchetype, SpecialistRole, SpecialistRoleId } from '../types/app-types.js';

export interface ArchetypeDef {
  id: AppArchetype;
  label: string;
  description: string;
  /** Case-insensitive substring rules; checked in order. */
  keywords: string[];
}

export const ARCHETYPES: readonly ArchetypeDef[] = [
  {
    id: 'abap-debugger',
    label: 'ABAP Debugger Assistant',
    description:
      'Analyzes ABAP source + error, retrieves SAP knowledge, explains the failure, suggests corrections and generates validation tests.',
    keywords: ['abap', 'debugger', 'debug', 'sap error', 'sap code', 'short dump'],
  },
  {
    id: 'restaurant-app',
    label: 'Restaurant Application',
    description:
      'Menu, categories, cart, orders, customer interface and an admin view — responsive, mobile-ready.',
    keywords: ['restaurant', 'menu', 'ordering', 'food', 'cafe', 'food order'],
  },
  {
    id: 'ai-app-builder',
    label: 'AI Application Builder',
    description: 'A meta-application: helps users describe and scaffold their own AI applications.',
    // ORDER MATTERS: checked before generic so "AI app" never falls into generic.
    keywords: ['ai app', 'ai application', 'app builder', 'ai chatbot', 'llm app', 'agent app'],
  },
  {
    id: 'generic-web',
    label: 'Generic Web Application',
    description: 'A well-structured web application derived from the request.',
    keywords: [],
  },
];

/** Detect the archetype deterministically (no LLM, no uncontrolled guessing). */
export function detectArchetype(goal: string): AppArchetype {
  const normalized = goal.toLowerCase();
  for (const archetype of ARCHETYPES) {
    if (archetype.keywords.length === 0) continue;
    if (archetype.keywords.some((keyword) => normalized.includes(keyword))) {
      return archetype.id;
    }
  }
  return 'generic-web';
}

export function archetypeLabel(archetype: AppArchetype): string {
  return ARCHETYPES.find((a) => a.id === archetype)?.label ?? 'Generic Web Application';
}

// ── Specialist roles (Phase 4) ──────────────────────────────────────────────

export const SPECIALIST_ROLES: readonly SpecialistRole[] = [
  {
    id: 'requirements-analyst',
    label: 'Requirements Analyst',
    description: 'Derives and validates functional + non-functional requirements.',
    capabilities: ['reasoning', 'classification'],
    phases: ['requirements'],
  },
  {
    id: 'product-architect',
    label: 'Product Architect',
    description: 'Designs the application architecture from the specification.',
    capabilities: ['reasoning'],
    phases: ['architecture'],
  },
  {
    id: 'ui-ux-designer',
    label: 'UI/UX Designer',
    description: 'Designs screens, navigation and visual language.',
    capabilities: ['content_generation'],
    phases: ['ui_design'],
  },
  {
    id: 'frontend-engineer',
    label: 'Frontend Engineer',
    description: 'Implements the frontend with typed, accessible components.',
    capabilities: ['coding'],
    phases: ['implementation'],
  },
  {
    id: 'backend-engineer',
    label: 'Backend Engineer',
    description: 'Implements APIs and business logic.',
    capabilities: ['coding'],
    phases: ['implementation'],
  },
  {
    id: 'database-engineer',
    label: 'Database Engineer',
    description: 'Designs the data model and schema.',
    capabilities: ['coding'],
    phases: ['data_model'],
  },
  {
    id: 'ai-engineer',
    label: 'AI Engineer',
    description: 'Wires AI capabilities through the runtime.',
    capabilities: ['coding', 'reasoning'],
    phases: ['implementation'],
  },
  {
    id: 'rag-engineer',
    label: 'RAG Engineer',
    description: 'Configures retrieval for grounded answers.',
    capabilities: ['reasoning'],
    phases: ['implementation'],
  },
  {
    id: 'security-engineer',
    label: 'Security Engineer',
    description: 'Reviews authentication, authorization, IDOR, secrets, injection.',
    capabilities: ['classification'],
    phases: ['security_review'],
  },
  {
    id: 'test-engineer',
    label: 'Test Engineer',
    description: 'Writes unit + integration tests.',
    capabilities: ['coding'],
    phases: ['testing'],
  },
  {
    id: 'performance-engineer',
    label: 'Performance Engineer',
    description: 'Reviews latency, bundle and data access patterns.',
    capabilities: ['reasoning'],
    phases: ['performance_review'],
  },
  {
    id: 'code-reviewer',
    label: 'Code Reviewer',
    description: 'Independent critique of generated code.',
    capabilities: ['reasoning', 'coding'],
    phases: ['final_validation'],
  },
  {
    id: 'deployment-engineer',
    label: 'Deployment Engineer',
    description: 'Packages and prepares the deployment artifact.',
    capabilities: ['reasoning'],
    phases: ['build'],
  },
];

export function roleById(id: SpecialistRoleId): SpecialistRole {
  const role = SPECIALIST_ROLES.find((r) => r.id === id);
  if (!role) throw new Error(`unknown specialist role: ${id}`);
  return role;
}

export function rolesForPhase(phase: SpecialistRole['phases'][number]): SpecialistRole[] {
  return SPECIALIST_ROLES.filter((r) => r.phases.includes(phase));
}

export function specialistRoleLabel(id: SpecialistRoleId): string {
  return roleById(id).label;
}
