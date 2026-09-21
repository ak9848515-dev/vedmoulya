// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — UX-06 AI hierarchy invariants
//
// Pins the AI experience model (lib/ai-experience.ts):
//   - the eight canonical AI sections exist, with unique ids and routes
//   - nothing in the model advertises a route navigation-model.ts does not
//     assign to AI (no second navigation authority)
//   - provider configuration keeps exactly ONE home (/providers) and Models is
//     a view of it — never a competing destination
//   - no AI section lives under /settings (provider setup is not in Settings)
//   - every top-level section is reachable from the AI landing groups
//   - every deeper surface belongs to the section that lists it
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  AI_SECTION_GROUPS,
  AI_SECTIONS,
  AI_TOP_LEVEL_SECTIONS,
  aiOwnershipViolations,
  aiRoutes,
  aiSectionById,
  type AISectionId,
} from '../ai-experience.js';
import { AI_DESTINATION, destinationForPathname } from '../navigation-model.js';

const CANONICAL_ORDER: AISectionId[] = [
  'overview',
  'intelligence',
  'memory',
  'knowledge',
  'context',
  'providers',
  'models',
  'marketplace',
];

describe('UX-06 — the canonical AI sections', () => {
  it('are exactly the eight canonical sections, in order', () => {
    expect(AI_SECTIONS.map((section) => section.id)).toEqual(CANONICAL_ORDER);
  });

  it('carry unique ids and page paths', () => {
    expect(new Set(AI_SECTIONS.map((s) => s.id)).size).toBe(AI_SECTIONS.length);
    const paths = AI_SECTIONS.map((s) => s.route);
    // Providers and Models deliberately share /providers (Models is a view).
    expect(new Set(paths).size).toBe(AI_SECTIONS.length - 1);
  });

  it('refuses an unknown section instead of inventing one', () => {
    expect(() => aiSectionById('telepathy' as AISectionId)).toThrow(/Unknown AI section/);
  });
});

describe('UX-06 — the AI model never contradicts the navigation authority', () => {
  it('advertises no route the navigation model does not assign to AI', () => {
    expect(aiOwnershipViolations()).toEqual([]);
  });

  it.each(aiRoutes())('%s resolves to the AI destination', (route) => {
    const pathname = route.split('?')[0] ?? route;
    expect(destinationForPathname(pathname).id).toBe('ai');
    expect(AI_DESTINATION.match).toContain(pathname);
  });

  it('keeps every AI section out of Settings', () => {
    for (const route of aiRoutes()) {
      expect(route.startsWith('/settings'), route).toBe(false);
    }
  });
});

describe('UX-06 — provider configuration has exactly one home', () => {
  it('Providers is /providers', () => {
    expect(aiSectionById('providers').route).toBe('/providers');
  });

  it('Models is a VIEW of Providers, not a competing destination', () => {
    const models = aiSectionById('models');
    expect(models.parentId).toBe('providers');
    expect(models.route).toBe(aiSectionById('providers').route);
  });

  it('exposes the provider route exactly once among top-level sections', () => {
    const providerRoutes = AI_TOP_LEVEL_SECTIONS.map((section) => section.route).filter(
      (route) => route === '/providers',
    );
    expect(providerRoutes).toEqual(['/providers']);
  });

  it('has no duplicate top-level routes at all', () => {
    const routes = AI_TOP_LEVEL_SECTIONS.map((section) => section.route);
    expect(new Set(routes).size).toBe(routes.length);
  });
});

describe('UX-06 — every AI section is reachable from the landing', () => {
  it('excludes only the landing itself and the Models view', () => {
    expect(AI_TOP_LEVEL_SECTIONS.map((section) => section.id)).toEqual(
      CANONICAL_ORDER.filter((id) => id !== 'overview' && id !== 'models'),
    );
  });

  it('assigns every section except the landing to exactly one group', () => {
    const grouped = AI_SECTION_GROUPS.flatMap((group) => [...group.sections]);
    // The landing IS the overview, so it is the one section with no card.
    expect([...grouped].sort()).toEqual(CANONICAL_ORDER.filter((id) => id !== 'overview').sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it('gives every group a human label and a description', () => {
    expect(AI_SECTION_GROUPS.length).toBeGreaterThan(0);
    for (const group of AI_SECTION_GROUPS) {
      expect(group.label.trim().length).toBeGreaterThan(0);
      expect(group.description.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('UX-06 — deeper surfaces belong to the section that lists them', () => {
  const surfaces = AI_SECTIONS.flatMap((section) =>
    (section.surfaces ?? []).map((surface) => ({ sectionId: section.id, surface })),
  );

  it('exist for the sections that have deeper screens', () => {
    expect(surfaces.length).toBeGreaterThan(0);
    expect(
      AI_SECTIONS.filter((section) => (section.surfaces ?? []).length > 0).length,
    ).toBeGreaterThan(0);
  });

  it('are uniquely routed and AI-owned', () => {
    const routes = surfaces.map((entry) => entry.surface.route);
    expect(new Set(routes).size).toBe(routes.length);
    for (const route of routes) {
      expect(destinationForPathname(route).id).toBe('ai');
    }
  });

  it('never advertise the provider route (that stays Providers/Models)', () => {
    for (const entry of surfaces) {
      expect(entry.surface.route).not.toBe('/providers');
    }
  });
});
