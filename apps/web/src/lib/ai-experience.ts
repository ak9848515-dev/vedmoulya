// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI Experience Model (UX-06)
//
// THE SINGLE SOURCE OF TRUTH for what "VedMoulya AI" is made of.
//
// The AI destination already owns a large set of routes (see AI_DESTINATION.match
// in navigation-model.ts). Those routes are engineering surfaces. This file is the
// product framing on top of them: the eight things a person expects to find under
// AI — Overview · Intelligence · Memory · Knowledge · Context · Providers ·
// Models · Marketplace — and, under each one, the deeper surfaces that belong to
// it.
//
// Two rules this file exists to enforce:
//   1. NOTHING here invents a destination. Every route is resolved against
//      navigation-model.ts, so the AI hierarchy can never disagree with the
//      navigation authority (UX-01). `aiOwnershipViolations()` proves it.
//   2. Provider configuration has exactly ONE home — `/providers`. Models is a
//      VIEW of a provider (each provider runs its own model), so it resolves to
//      the same route and carries `parentId: 'providers'`. There is no second
//      provider/credential surface anywhere in this model.
// ─────────────────────────────────────────────────────────────────────────────

import type { LucideIcon } from 'lucide-react';
import { Boxes, BrainCircuit, Cpu, Database, Layers, Library, Sparkles, Store } from 'lucide-react';
import { AI_DESTINATION } from './navigation-model.js';

// ── Types ───────────────────────────────────────────────────────────────────

export type AISectionId =
  | 'overview'
  | 'intelligence'
  | 'memory'
  | 'knowledge'
  | 'context'
  | 'providers'
  | 'models'
  | 'marketplace';

/** A deeper AI surface reached from a section rather than from the AI landing. */
export interface AISurface {
  label: string;
  route: string;
  description: string;
}

export interface AISection {
  id: AISectionId;
  /** What the person calls it. Never an internal module name. */
  label: string;
  /** The canonical route for this section (an existing route). */
  route: string;
  /** One plain-language sentence: what this section is for. */
  description: string;
  icon: LucideIcon;
  /**
   * When set, this section is a VIEW of another section rather than a
   * destination of its own (Models is a view of Providers). It shares the
   * parent's route and never competes with it for active state.
   */
  parentId?: AISectionId;
  /** Deeper surfaces owned by this section. */
  surfaces?: readonly AISurface[];
}

// ── The model ───────────────────────────────────────────────────────────────

/**
 * The AI hierarchy. `overview` is the AI landing itself; the rest are the
 * product-level sections it exposes.
 */
export const AI_SECTIONS: readonly AISection[] = [
  {
    id: 'overview',
    label: 'Overview',
    route: '/ai',
    description: 'What your AI is doing for you right now.',
    icon: Sparkles,
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    route: '/intelligence',
    description: 'What your AI has noticed, decided and learned.',
    icon: BrainCircuit,
    surfaces: [
      {
        label: 'Enterprise Brain',
        route: '/enterprise-brain',
        description: 'Every decision your AI makes, explained and approved by you.',
      },
      {
        label: 'Learning Intelligence',
        route: '/learning-intelligence',
        description: 'What VedMoulya learned from things that already ran.',
      },
      {
        label: 'Ecosystem Intelligence',
        route: '/ecosystem-intelligence',
        description: 'Better tools and models it found — recommended, never activated.',
      },
      {
        label: 'Live Intelligence',
        route: '/live-intelligence',
        description: 'Watch one task move through understand → discover → approve → learn.',
      },
      {
        label: 'Brain',
        route: '/brain',
        description: 'The reasoning core that turns a goal into a plan.',
      },
    ],
  },
  {
    id: 'memory',
    label: 'Memory',
    route: '/memory',
    description: 'What VedMoulya remembers about your journey.',
    icon: Database,
  },
  {
    id: 'knowledge',
    label: 'Knowledge',
    route: '/knowledge',
    description: 'What you have taught it, and how trustworthy it is.',
    icon: Library,
  },
  {
    id: 'context',
    label: 'Context',
    route: '/context',
    description: 'What your AI considers before it answers.',
    icon: Layers,
    surfaces: [
      {
        label: 'Context & Personal Intelligence Fabric',
        route: '/context-fabric',
        description: 'The permission-aware fabric that decides what context an agent may see.',
      },
    ],
  },
  {
    id: 'providers',
    label: 'Providers',
    route: '/providers',
    description: 'Connect and manage the AI VedMoulya runs on.',
    icon: Cpu,
  },
  {
    id: 'models',
    label: 'Models',
    route: '/providers',
    description: 'Each provider runs its own model — choose it inside Providers.',
    icon: Boxes,
    parentId: 'providers',
  },
  {
    id: 'marketplace',
    label: 'Marketplace',
    route: '/capability-marketplace',
    description: 'Capabilities and skills you can add.',
    icon: Store,
    surfaces: [
      {
        label: 'Capabilities',
        route: '/capabilities',
        description: 'What VedMoulya can do, and what each one still needs.',
      },
      {
        label: 'AI World',
        route: '/ai-world',
        description: 'Discoveries from the ecosystem that are worth a look.',
      },
      {
        label: 'Ecosystem',
        route: '/ecosystem',
        description: 'The tools and services your AI can reach.',
      },
      {
        label: 'Platform Marketplace',
        route: '/marketplace',
        description: 'Platform assets, templates and updates.',
      },
      {
        label: 'Operating System',
        route: '/os',
        description: 'The machinery underneath — surfaces, graphs and diagnostics.',
      },
    ],
  },
] as const;

/** Sections that stand on their own (Models is a view of Providers). */
export const AI_TOP_LEVEL_SECTIONS: readonly AISection[] = AI_SECTIONS.filter(
  (section) => section.parentId === undefined && section.id !== 'overview',
);

/**
 * How the AI landing groups its sections. Three plain-language groups keep the
 * hub readable without hiding anything behind engineering terminology.
 */
export type AISectionGroupId = 'mind' | 'setup' | 'extend';

export interface AISectionGroup {
  id: AISectionGroupId;
  label: string;
  description: string;
  /** Top-level sections in this group, in display order. */
  sections: readonly AISectionId[];
}

export const AI_SECTION_GROUPS: readonly AISectionGroup[] = [
  {
    id: 'mind',
    label: "Your AI's mind",
    description: 'What it knows, remembers and considers before it answers.',
    sections: ['intelligence', 'memory', 'knowledge', 'context'],
  },
  {
    id: 'setup',
    label: 'Set up your AI',
    description: 'Connect a provider and choose the model it runs on.',
    sections: ['providers', 'models'],
  },
  {
    id: 'extend',
    label: 'Add to your AI',
    description: 'Capabilities and skills you can bring in.',
    sections: ['marketplace'],
  },
] as const;

const SECTION_BY_ID = new Map<AISectionId, AISection>(
  AI_SECTIONS.map((section) => [section.id, section]),
);

export function aiSectionById(id: AISectionId): AISection {
  const section = SECTION_BY_ID.get(id);
  if (section === undefined) {
    throw new Error(`Unknown AI section: ${id}`);
  }
  return section;
}

// ── Ownership guard (the AI hierarchy cannot invent routes) ─────────────────

/** Every route this model knows about, as [route, owner-check] pairs. */
export function aiRoutes(): string[] {
  const routes = new Set<string>();
  for (const section of AI_SECTIONS) {
    routes.add(section.route);
    for (const surface of section.surfaces ?? []) routes.add(surface.route);
  }
  return [...routes];
}

/**
 * Routes in this model that navigation-model.ts does NOT assign to AI.
 *
 * A non-empty result is a real information-architecture bug: the AI hub would
 * be advertising something it does not own. The AI landing and the tests both
 * use this, so the product framing and the navigation authority can never drift.
 */
export function aiOwnershipViolations(): Array<{ route: string; owner: string }> {
  const owned = (pathname: string): boolean =>
    AI_DESTINATION.match.some((prefix) =>
      prefix === '/' ? pathname === '/' : pathname === prefix || pathname.startsWith(`${prefix}/`),
    );

  const violations: Array<{ route: string; owner: string }> = [];
  for (const route of aiRoutes()) {
    const pathname = route.split('?')[0] ?? route;
    if (!owned(pathname)) {
      violations.push({ route, owner: AI_DESTINATION.id });
    }
  }
  return violations;
}
