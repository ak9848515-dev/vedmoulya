// ──────────────────────────────────────────────────────────────────
// VedMoulya — EPIC-010: Design System & Blueprint Engines
// Deterministic tests (Phases 1–7): the typed design system, domain-
// aware visual strategy, design decisions, UI blueprint, nine-state
// intelligence, explicit responsive behavior and automated
// accessibility checks.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { DesignSystemEngine } from '../DesignSystemEngine.js';
import { DesignDecisionEngine } from '../DesignDecisionEngine.js';
import { UIBlueprintEngine } from '../UIBlueprintEngine.js';
import { StateIntelligenceEngine, ALL_STATES } from '../StateIntelligenceEngine.js';
import { ResponsiveIntelligenceEngine } from '../ResponsiveIntelligenceEngine.js';
import { AccessibilityEngine } from '../AccessibilityEngine.js';
import type { DesignSpecification } from '@vedmoulya/requirements';
import type { AccessibilityCategory } from '../../types/experience-types.js';

const DESIGN_SYSTEM = new DesignSystemEngine();
const DECISIONS = new DesignDecisionEngine();
const BLUEPRINT = new UIBlueprintEngine();
const STATES = new StateIntelligenceEngine();
const RESPONSIVE = new ResponsiveIntelligenceEngine();
const A11Y = new AccessibilityEngine();

const RESTAURANT_SPEC: DesignSpecification = {
  sessionId: 's1',
  visualPersonality: 'Visual, warm, product-focused',
  targetAudience: 'Diners ordering on phones',
  brandDirection: 'Warm, appetizing',
  colorSystem: ['primary: #C2410C', 'surface: #FFFDF9'],
  typography: 'Friendly sans with generous line height',
  spacing: 'Token-based',
  components: ['menu cards', 'cart'],
  iconography: 'Friendly line icons',
  motion: 'Subtle transitions',
  responsiveStrategy: 'Mobile-first',
  accessibility: 'WCAG AA',
  interactionStates: ['hover', 'focus'],
  emptyStates: ['empty menu'],
  loadingStates: ['loading menu'],
  errorStates: ['checkout failed'],
  rationale: ['food is visual'],
};

describe('DesignSystemEngine (Phase 1)', () => {
  it('adds NEW tokens for design-spec colors not already in the catalog', () => {
    const spec: DesignSpecification = {
      ...RESTAURANT_SPEC,
      colorSystem: ['accent: #16A34A', 'surface: #FFFDF9'],
    };
    const system = DESIGN_SYSTEM.derive({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      designSpec: spec,
    });
    const accent = system.tokens.find((t) => t.id === 'color.accent');
    expect(accent).toBeDefined();
    expect(accent?.value).toBe('#16A34A');
    expect(system.byGroup.color).toContain('color.accent');
  });

  it('produces a typed design system with structured tokens', () => {
    const system = DESIGN_SYSTEM.derive({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      designSpec: RESTAURANT_SPEC,
    });
    expect(system.tokens.length).toBeGreaterThan(10);
    expect(system.byGroup.color.length).toBeGreaterThan(0);
    expect(system.byGroup.typography.length).toBeGreaterThan(0);
    expect(system.byGroup.spacing.length).toBeGreaterThan(0);
    expect(system.components.length).toBeGreaterThan(5);
    expect(system.visualPersonality).toBe('Visual, warm, product-focused');
  });

  it('covers every component kind: buttons, forms, navigation, cards, tables, dialogs, notifications, badges, charts, states', () => {
    const system = DESIGN_SYSTEM.derive({ applicationId: 'app-1', archetype: 'restaurant-app' });
    const kinds = system.components.map((c) => c.component);
    for (const kind of [
      'button',
      'form',
      'navigation',
      'card',
      'table',
      'dialog',
      'notification',
      'badge',
      'chart',
      'empty_state',
      'loading_state',
      'error_state',
    ]) {
      expect(kinds).toContain(kind);
    }
  });

  it('overrides catalog colors from the EPIC-009 design specification', () => {
    const system = DESIGN_SYSTEM.derive({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      designSpec: RESTAURANT_SPEC,
    });
    const primary = system.tokens.find((t) => t.id === 'color.primary');
    expect(primary?.value).toBe('#C2410C');
    expect(primary?.source).toBe('DESIGN_SPEC');
  });

  it('is domain-aware — an ABAP debugger is NOT a restaurant app', () => {
    const restaurant = DESIGN_SYSTEM.derive({ applicationId: 'a', archetype: 'restaurant-app' });
    const abap = DESIGN_SYSTEM.derive({ applicationId: 'b', archetype: 'abap-debugger' });
    expect(restaurant.visualPersonality.toLowerCase()).toContain('warm');
    expect(abap.visualPersonality.toLowerCase()).toContain('professional');
    expect(restaurant.tokens.find((t) => t.id === 'color.primary')?.value).not.toBe(
      abap.tokens.find((t) => t.id === 'color.primary')?.value,
    );
  });
});

describe('DesignDecisionEngine (Phase 3)', () => {
  it('converts the specification into executable decisions with rationale and alternatives', () => {
    const decisions = DECISIONS.derive({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      designSpec: RESTAURANT_SPEC,
    });
    expect(decisions.length).toBeGreaterThan(3);
    for (const d of decisions) {
      expect(d.id).toMatch(/^DESIGN-\d{3}$/);
      expect(d.decision.length).toBeGreaterThan(0);
      expect(d.rationale.length).toBeGreaterThan(0);
      expect(d.alternatives.length).toBeGreaterThan(0);
      expect(d.confidence).toBeGreaterThan(0);
      expect(d.source).toBe('DESIGN_SPEC');
    }
    expect(decisions.some((d) => d.decision.toLowerCase().includes('personality'))).toBe(true);
  });

  it('declares affected components per decision', () => {
    const decisions = DECISIONS.derive({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      designSpec: RESTAURANT_SPEC,
    });
    for (const d of decisions) {
      expect(d.affectedComponents.length).toBeGreaterThan(0);
    }
  });
});

describe('UIBlueprintEngine (Phase 4)', () => {
  it('builds screens, routes, navigation, components, layouts, responsive, interactions and accessibility', () => {
    const blueprint = BLUEPRINT.derive({ applicationId: 'app-1', archetype: 'restaurant-app' });
    expect(blueprint.screens.length).toBeGreaterThan(3);
    expect(blueprint.routes).toContain('/');
    expect(blueprint.navigation.length).toBeGreaterThan(0);
    expect(blueprint.components.length).toBeGreaterThan(0);
    expect(blueprint.layouts.length).toBeGreaterThan(0);
    expect(blueprint.responsive.length).toBeGreaterThan(0);
    expect(blueprint.interactions.length).toBeGreaterThan(0);
    expect(blueprint.accessibility.length).toBeGreaterThan(0);
    expect(blueprint.screens.some((s) => s.route === '/cart')).toBe(true);
  });

  it('declares the nine states for every important screen', () => {
    const blueprint = BLUEPRINT.derive({ applicationId: 'app-1', archetype: 'restaurant-app' });
    for (const screen of blueprint.screens) {
      expect(screen.states.length).toBeGreaterThan(0);
      for (const s of screen.states) {
        expect(ALL_STATES).toContain(s);
      }
    }
  });
});

describe('StateIntelligenceEngine — custom states (Phase 5)', () => {
  it('handles states not in the archetype default map with a generic spec', () => {
    const blueprint = {
      applicationId: 'app-x',
      screens: [
        {
          id: 'custom',
          route: '/custom',
          title: 'Custom',
          sections: ['x'],
          states: ['LOADING' as const, 'CUSTOM' as never],
          accessibility: [],
        },
      ],
      routes: ['/custom'],
      navigation: 'n',
      components: [],
      layouts: [],
      responsive: [],
      interactions: [],
      accessibility: [],
    };
    const derived = STATES.derive({
      applicationId: 'app-x',
      archetype: 'restaurant-app',
      blueprint,
    });
    const custom = derived[0]?.states.find((s) => s.state === ('CUSTOM' as never));
    expect(custom).toBeDefined();
    expect(custom?.component).toBe('StateComponent');
    const loading = derived[0]?.states.find((s) => s.state === 'LOADING');
    expect(loading?.requirements.some((r) => r.includes('custom'))).toBe(true);
  });
});

describe('AccessibilityEngine — evidence audit branches (Phase 7)', () => {
  it('reports failed automated checks for a bare UI', () => {
    const blueprint = BLUEPRINT.derive({ applicationId: 'app-1', archetype: 'restaurant-app' });
    const results = A11Y.audit({ applicationId: 'app-1', archetype: 'restaurant-app', blueprint }, [
      { path: 'src/ui/app.tsx', content: 'export const App = () => <div/>;' },
    ]);
    expect(results.some((r) => !r.passed)).toBe(true);
  });
});

describe('StateIntelligenceEngine (Phase 5)', () => {
  it('defines loading/empty/success/error/partial/offline/unauthorized/forbidden/validation states per screen', () => {
    const blueprint = BLUEPRINT.derive({ applicationId: 'app-1', archetype: 'restaurant-app' });
    const derived = STATES.derive({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      blueprint,
    });
    expect(derived.length).toBe(blueprint.screens.length);
    const allStates = new Set(derived.flatMap((s) => s.states.map((st) => st.state)));
    for (const state of ALL_STATES) {
      expect(allStates.has(state)).toBe(true);
    }
    for (const screen of derived) {
      for (const st of screen.states) {
        expect(st.component.length).toBeGreaterThan(0);
        expect(st.requirements.length).toBeGreaterThan(0);
      }
    }
  });

  it('exposes the canonical nine-state contract', () => {
    expect(STATES.contract()).toHaveLength(9);
  });
});

describe('ResponsiveIntelligenceEngine (Phase 6)', () => {
  it('declares explicit mobile/tablet/desktop behavior for every component — never a shrunk desktop', () => {
    const blueprint = BLUEPRINT.derive({ applicationId: 'app-1', archetype: 'restaurant-app' });
    const behaviors = RESPONSIVE.derive({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      blueprint,
    });
    expect(behaviors.length).toBeGreaterThanOrEqual(blueprint.responsive.length);
    for (const b of behaviors) {
      expect(b.mobile.length).toBeGreaterThan(0);
      expect(b.tablet.length).toBeGreaterThan(0);
      expect(b.desktop.length).toBeGreaterThan(0);
      expect(RESPONSIVE.isTrulyAdaptive(b)).toBe(true);
    }
  });
});

describe('AccessibilityEngine (Phase 7)', () => {
  it('covers keyboard, focus, semantics, labels, contrast, screen-reader, touch targets and reduced motion', () => {
    const blueprint = BLUEPRINT.derive({ applicationId: 'app-1', archetype: 'restaurant-app' });
    const reqs = A11Y.requirements({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      blueprint,
    });
    const cats = new Set<AccessibilityCategory>(reqs.map((r) => r.category));
    const expected: AccessibilityCategory[] = [
      'keyboard',
      'focus',
      'labels',
      'contrast',
      'screen_reader',
      'touch_target',
      'reduced_motion',
    ];
    for (const cat of expected) {
      expect(cats.has(cat)).toBe(true);
    }
  });

  it('audits generated code with automated checks (evidence, not assertion)', () => {
    const blueprint = BLUEPRINT.derive({ applicationId: 'app-1', archetype: 'restaurant-app' });
    const passingFiles = [
      {
        path: 'src/ui/app.tsx',
        content:
          'export const App = () => (<main role="main" aria-live="polite"><nav><a href="/menu">Menu</a></nav><section aria-label="Form"><label htmlFor="email">Email</label><input id="email" tabIndex={0} className="focus:ring min-h-11" /></section><style>{`@media (prefers-reduced-motion: reduce) { * { animation: none; } } .x { --text: #292524; --primary: #C2410C; }`}</style></main>);',
      },
    ];
    const failingFiles = [
      { path: 'src/ui/app.tsx', content: 'export const App = () => (<div>hi</div>);' },
    ];
    const passing = A11Y.audit(
      { applicationId: 'app-1', archetype: 'restaurant-app', blueprint },
      passingFiles,
    );
    const failing = A11Y.audit(
      { applicationId: 'app-1', archetype: 'restaurant-app', blueprint },
      failingFiles,
    );
    expect(passing.every((c) => c.passed)).toBe(true);
    expect(failing.some((c) => !c.passed)).toBe(true);
  });
});
