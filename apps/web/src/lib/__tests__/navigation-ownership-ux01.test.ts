// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — UX-01/UX-02/UX-05 Page Ownership & Context Tests
//
// Pins the closure-sprint navigation contract:
//   - every legacy module page resolves to the destination that owns it
//   - Content Agency is owned by Life (→ Business workspace)
//   - Providers is owned by AI
//   - the Application Factory is owned by Missions (it is a build engine)
//   - mission deep links are canonical and never fabricated
//   - the shell fallback breadcrumb never contradicts the model
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  AI_DESTINATION,
  LIFE_DESTINATION,
  MISSIONS_DESTINATION,
  destinationForPathname,
  missionDetailRoute,
  owningDestinationForPathname,
} from '../navigation-model.js';

describe('UX-01 — module pages are owned by a destination, not floating', () => {
  const ownership: Array<[string, string]> = [
    ['/career', 'life'],
    ['/learning', 'life'],
    ['/business', 'life'],
    ['/content-agency', 'life'],
    ['/content-agency/clients', 'life'],
    ['/content-agency/ops/invoices', 'life'],
    ['/applications', 'missions'],
    ['/providers', 'ai'],
    ['/providers/google', 'ai'],
  ];

  it.each(ownership)('%s is owned by %s', (pathname, expected) => {
    expect(destinationForPathname(pathname).id).toBe(expected);
  });

  it('reports the parent destination for a module page', () => {
    expect(owningDestinationForPathname('/career')?.id).toBe('life');
    expect(owningDestinationForPathname('/providers')?.id).toBe('ai');
    expect(owningDestinationForPathname('/content-agency')?.id).toBe('life');
    expect(owningDestinationForPathname('/applications')?.id).toBe('missions');
  });

  it('does not report a parent for a destination’s own landing route', () => {
    expect(owningDestinationForPathname('/life')).toBeNull();
    expect(owningDestinationForPathname('/ai')).toBeNull();
    expect(owningDestinationForPathname('/')).toBeNull();
    expect(owningDestinationForPathname('/progress')).toBeNull();
    expect(owningDestinationForPathname('/autonomous-builder')).toBeNull();
  });

  it('/missions is a sub-surface of Missions, not its landing route', () => {
    // /missions is the history / discovery surface; the operational landing
    // route of the Missions destination remains /autonomous-builder.
    expect(owningDestinationForPathname('/missions')?.id).toBe('missions');
  });

  it('Life owns Career, Learning and Business (no fourth product)', () => {
    for (const route of ['/career', '/learning', '/business', '/content-agency']) {
      expect(LIFE_DESTINATION.match, route).toContain(route);
    }
  });

  it('AI owns Providers', () => {
    expect(AI_DESTINATION.match).toContain('/providers');
  });

  it('Missions owns the Application Factory build engine', () => {
    expect(MISSIONS_DESTINATION.match).toContain('/applications');
    // …and Life no longer claims it (the old, contradictory mapping).
    expect(LIFE_DESTINATION.match).not.toContain('/applications');
  });
});

describe('UX-04 — canonical mission detail route', () => {
  it('builds the operational mission deep link', () => {
    expect(missionDetailRoute('m-123')).toBe('/autonomous-builder?mission=m-123');
  });

  it('is the canonical operational experience for a mission', () => {
    // /missions is the history / discovery surface: it has no mission id.
    expect(destinationForPathname('/missions').id).toBe('missions');
    expect(destinationForPathname('/autonomous-builder').id).toBe('missions');
  });

  it('refuses to fabricate a mission id', () => {
    expect(missionDetailRoute(null)).toBeNull();
    expect(missionDetailRoute(undefined)).toBeNull();
    expect(missionDetailRoute('')).toBeNull();
    expect(missionDetailRoute('   ')).toBeNull();
  });

  it('encodes ids safely', () => {
    expect(missionDetailRoute('m 1/2')).toBe('/autonomous-builder?mission=m%201%2F2');
  });

  it('routes still resolve to the Missions destination with the query', () => {
    const route = missionDetailRoute('m-123');
    expect(route).not.toBeNull();
    const pathname = (route as string).split('?')[0] ?? '';
    expect(destinationForPathname(pathname).id).toBe('missions');
  });
});
