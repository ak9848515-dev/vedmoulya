// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Application Factory: UI Quality Evaluator
// EPIC-007 — Phase 11. For UI applications, a UI quality evaluator
// checks: responsive design, accessibility, consistent spacing,
// typography, navigation, empty/loading/error states, mobile and
// desktop layout, dark/light mode where appropriate, and visual
// consistency. "Technically working" is NOT equivalent to
// "production quality" — the evaluator scores it explicitly.
//
// Deterministic checks over the generated UI plan + source files.
// ──────────────────────────────────────────────────────────────────

import type { UIQualityReport } from '../types/app-types.js';

export interface UIQualityInput {
  files: Array<{ path: string; content: string }>;
  /** The UI design document content (screens, navigation, design language). */
  uiDesign: string;
  hasAdminViews: boolean;
}

const RESPONSIVE_MARKERS = ['responsive', 'mobile', 'breakpoint', 'md:', 'sm:', 'lg:', '@media'];
const ACCESSIBILITY_MARKERS = [
  'aria-',
  'role=',
  'alt=',
  'label',
  'focus',
  'tabindex',
  'accessible',
];
const STATES_MARKERS = ['loading', 'empty', 'error', 'skeleton', 'fallback', 'spinner'];

export class UIQualityEvaluator {
  evaluate(input: UIQualityInput): UIQualityReport {
    const checks: UIQualityReport['checks'] = [];
    const uiDesign = input.uiDesign.toLowerCase();
    const allContent = input.files
      .map((f) => f.content)
      .join('\n')
      .toLowerCase();

    const has = (markers: string[], haystack: string): boolean =>
      markers.some((m) => haystack.includes(m.toLowerCase()));

    checks.push({
      check: 'responsive design',
      passed: has(RESPONSIVE_MARKERS, uiDesign) || has(RESPONSIVE_MARKERS, allContent),
      detail: 'responsive/breakpoint handling present in the UI plan or source',
    });
    checks.push({
      check: 'accessibility',
      passed: has(ACCESSIBILITY_MARKERS, uiDesign) || has(ACCESSIBILITY_MARKERS, allContent),
      detail: 'ARIA roles / labels / focus handling present',
    });
    checks.push({
      check: 'navigation',
      passed: /navigation|navbar|menu|route|link/.test(uiDesign),
      detail: 'navigation structure described in the UI plan',
    });
    checks.push({
      check: 'empty states',
      passed: has(['empty state', 'empty'], uiDesign) || /empty|no items|none yet/.test(allContent),
      detail: 'empty-state handling present',
    });
    checks.push({
      check: 'loading states',
      passed: has(STATES_MARKERS, uiDesign) || has(STATES_MARKERS, allContent),
      detail: 'loading indicator present',
    });
    checks.push({
      check: 'error states',
      passed:
        /error|failed|unavailable/.test(uiDesign) ||
        /catch|error|onError|errorBoundary/.test(allContent),
      detail: 'error handling present',
    });
    checks.push({
      check: 'mobile layout',
      passed:
        has(['mobile', 'sm:', 'md:', 'breakpoint'], uiDesign) ||
        has(['sm:', 'md:', '@media'], allContent),
      detail: 'mobile breakpoints present',
    });
    checks.push({
      check: 'desktop layout',
      passed: /desktop|lg:|xl:|wide|sidebar/.test(uiDesign) || /lg:|xl:/.test(allContent),
      detail: 'desktop layout handling present',
    });
    checks.push({
      check: 'dark/light mode',
      passed:
        has(['dark mode', 'dark:', 'theme', 'light mode'], uiDesign) ||
        /dark|light|theme/.test(allContent),
      detail: 'theme handling present where appropriate',
    });
    checks.push({
      check: 'visual consistency',
      passed: /design language|design system|spacing|typography|tokens|color palette/.test(
        uiDesign,
      ),
      detail: 'a consistent design language is described',
    });
    checks.push({
      check: 'spacing & typography',
      passed: /spacing|typography|font|type scale/.test(uiDesign),
      detail: 'spacing and typography are specified',
    });
    checks.push({
      check: 'admin views',
      passed: !input.hasAdminViews || /admin|dashboard|management/.test(uiDesign),
      detail: 'admin views designed when the app has them',
    });

    const passed = checks.filter((c) => c.passed).length;
    const score = checks.length === 0 ? 0 : passed / checks.length;
    return {
      applicationId: '',
      score: Number(score.toFixed(2)),
      checks,
      verdict: score >= 0.7 ? 'PASS' : 'FAIL',
    };
  }
}
