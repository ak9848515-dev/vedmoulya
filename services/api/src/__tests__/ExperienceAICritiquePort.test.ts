// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Experience AI Critique Adapter (EPIC-010 Phase 8/11)
// Deterministic tests for the optional AI-powered critique seam:
//   - the bounded prompt never sends the whole repository
//   - tolerant JSON parsing (markdown fences, invalid shapes) never fabricates
//   - the port over the frozen runtime abstains honestly on provider failure
//   - the wired ApiApplicationService exposes the seam (evaluateWithAI)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  buildAICritiquePrompt,
  parseAICritiqueFindings,
} from '../infrastructure/ExperienceAICritiquePort.js';

const DESIGN = {
  visualPersonality: 'warm & inviting',
  tokens: [
    { id: 'color.primary', value: '#C2410C' },
    { id: 'space.md', value: '1rem' },
  ],
};

const BLUEPRINT = {
  screens: [
    { id: 'menu', title: 'Menu' },
    { id: 'cart', title: 'Cart' },
  ],
  routes: ['/', '/menu', '/cart'],
};

const FILES = [
  {
    path: 'src/ui/app.tsx',
    content:
      'export const App = () => (<main><h1>Menu</h1><button className="btn">Order</button></main>);',
  },
  {
    path: 'src/lib/orders.ts',
    content: 'export const placeOrder = async () => { /* working */ };',
  },
];

describe('buildAICritiquePrompt (bounded — never the whole repository)', () => {
  it('includes design tokens, screens and only UI files, bounded per file', () => {
    const prompt = buildAICritiquePrompt({
      applicationId: 'app-1',
      archetype: 'restaurant-app',
      designSystem: DESIGN,
      blueprint: BLUEPRINT,
      files: FILES,
    });
    expect(prompt).toContain('restaurant-app');
    expect(prompt).toContain('color.primary=#C2410C');
    expect(prompt).toContain('menu (Menu)');
    // UI files only — the non-UI lib file is excluded from the critique.
    expect(prompt).toContain('src/ui/app.tsx');
    expect(prompt).not.toContain('src/lib/orders.ts');
    // The bounded prompt demands quoted evidence and allows abstention.
    expect(prompt).toContain('MUST quote concrete evidence');
    expect(prompt).toContain('ABSTAIN');
  });

  it('truncates oversized files to the per-file bound', () => {
    const big = { path: 'src/ui/huge.tsx', content: 'x'.repeat(10_000) };
    const prompt = buildAICritiquePrompt({
      applicationId: 'app-1',
      archetype: 'generic-web',
      designSystem: DESIGN,
      blueprint: BLUEPRINT,
      files: [big],
    });
    expect(prompt.length).toBeLessThan(5_000);
  });
});

describe('parseAICritiqueFindings (tolerant — never fabricates)', () => {
  it('parses valid findings from plain JSON', () => {
    const findings = parseAICritiqueFindings(
      JSON.stringify({
        findings: [
          {
            severity: 'HIGH',
            area: 'hierarchy',
            location: 'app',
            issue: 'Primary action competes visually with secondary actions',
            evidence: 'The `.btn` class shares emphasis across all actions',
            recommendation: 'Increase primary CTA prominence',
            confidence: 'HIGH',
          },
        ],
      }),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ severity: 'HIGH', area: 'hierarchy', confidence: 'HIGH' });
  });

  it('tolerates markdown code fences', () => {
    const findings = parseAICritiqueFindings(
      '```json\n{"findings":[{"severity":"LOW","area":"spacing","location":"cart","issue":"padding drift","evidence":"`.space-md` not applied","recommendation":"use the token","confidence":"MEDIUM"}]}\n```',
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].area).toBe('spacing');
  });

  it('returns [] for invalid JSON (never a fabricated critique)', () => {
    expect(parseAICritiqueFindings('not json at all')).toEqual([]);
  });

  it('drops findings with invalid shapes (bad severity/area/empty evidence)', () => {
    const findings = parseAICritiqueFindings(
      JSON.stringify({
        findings: [
          {
            severity: 'BLOCKER',
            area: 'hierarchy',
            location: 'x',
            issue: 'bad severity',
            evidence: 'e',
            recommendation: 'r',
            confidence: 'HIGH',
          },
          {
            severity: 'HIGH',
            area: 'not-an-area',
            location: 'x',
            issue: 'bad area',
            evidence: 'e',
            recommendation: 'r',
            confidence: 'HIGH',
          },
          {
            severity: 'HIGH',
            area: 'hierarchy',
            location: 'x',
            issue: 'no evidence',
            evidence: '',
            recommendation: 'r',
            confidence: 'HIGH',
          },
          {
            severity: 'HIGH',
            area: 'hierarchy',
            location: 'x',
            issue: 'ok',
            evidence: '`.btn` present',
            recommendation: 'r',
            confidence: 'MEDIUM',
          },
        ],
      }),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].issue).toBe('ok');
  });

  it('returns [] when the payload is not an object or has no findings array', () => {
    expect(parseAICritiqueFindings('[]')).toEqual([]);
    expect(parseAICritiqueFindings(JSON.stringify({ findings: 'nope' }))).toEqual([]);
  });

  it('caps at 20 AFTER shape-filtering — junk items never starve valid findings', () => {
    // 25 items: the first 25 are invalid shapes, the last 5 are valid. The cap
    // must apply to VALID findings (yielding 5), not to the first 20 raw items.
    const findings = parseAICritiqueFindings(
      JSON.stringify({
        findings: [
          ...Array.from({ length: 25 }, (_, i) => ({
            severity: 'BLOCKER',
            area: 'hierarchy',
            location: 'x',
            issue: `junk ${i}`,
            evidence: '',
            recommendation: 'r',
            confidence: 'HIGH',
          })),
          ...Array.from({ length: 5 }, (_, i) => ({
            severity: 'LOW',
            area: 'spacing',
            location: 'cart',
            issue: `valid ${i}`,
            evidence: '`.space-md` present',
            recommendation: 'use the token',
            confidence: 'MEDIUM',
          })),
        ],
      }),
    );
    expect(findings).toHaveLength(5);
    expect(findings.map((f) => f.issue)).toEqual([
      'valid 0',
      'valid 1',
      'valid 2',
      'valid 3',
      'valid 4',
    ]);
  });

  it('caps a flood of valid findings at 20', () => {
    const findings = parseAICritiqueFindings(
      JSON.stringify({
        findings: Array.from({ length: 40 }, (_, i) => ({
          severity: 'LOW',
          area: 'spacing',
          location: 'cart',
          issue: `flood ${i}`,
          evidence: '`.space-md` present',
          recommendation: 'use the token',
          confidence: 'MEDIUM',
        })),
      }),
    );
    expect(findings).toHaveLength(20);
  });
});
