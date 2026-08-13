// ──────────────────────────────────────────────────────────────────
// VedMoulya — Experience Intelligence: Design Knowledge Catalog
// EPIC-010 — declarative, domain-aware visual knowledge. One universal
// visual template is FORBIDDEN: an ABAP debugger is professional and
// dense, a restaurant app is visual and warm, finance is trustworthy
// and analytical. The engines below consume this catalog — they never
// hardcode visual values.
// ──────────────────────────────────────────────────────────────────

import type { AppArchetype } from '@vedmoulya/app-factory';
import type { DesignSpecification } from '@vedmoulya/requirements';
import type {
  AccessibilityRequirement,
  ApplicationDesignSystem,
  BlueprintScreen,
  ComponentStyleSpec,
  DesignToken,
  ResponsiveBehavior,
  ScreenStateId,
  ScreenStateSpec,
  UIBlueprint,
  VisualCriticArea,
} from '../types/experience-types.js';

export interface ArchetypeExperienceKnowledge {
  archetype: AppArchetype;
  visualPersonality: string;
  /** Token value set: group → id → value. */
  tokens: Record<string, Record<string, string>>;
  components: ComponentStyleSpec[];
  screens: BlueprintScreen[];
  navigation: string;
  layouts: string[];
  sharedComponents: string[];
  interactions: string[];
  responsive: ResponsiveBehavior[];
  stateSpecs: ScreenStateSpec[];
  accessibility: AccessibilityRequirement[];
  /** Critic expectations — the checks that define "good" for this domain. */
  criticChecks: Array<{ area: VisualCriticArea; description: string }>;
  rationale: string[];
}

const STANDARD_STATES: ScreenStateId[] = [
  'LOADING',
  'EMPTY',
  'SUCCESS',
  'ERROR',
  'PARTIAL',
  'OFFLINE',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'VALIDATION_ERROR',
];

function statesOf(...states: ScreenStateId[]): ScreenStateId[] {
  return states.length > 0 ? states : STANDARD_STATES;
}

// ── Restaurant (visual / warm / product-focused / mobile-first) ────────────

const RESTAURANT: ArchetypeExperienceKnowledge = {
  archetype: 'restaurant-app',
  visualPersonality: 'Visual, warm, product-focused',
  tokens: {
    color: {
      primary: '#C2410C',
      primaryHover: '#9A3412',
      surface: '#FFFDF9',
      surfaceAlt: '#FBF6EF',
      text: '#292524',
      textMuted: '#78716C',
      border: '#E7E5E4',
      success: '#15803D',
      warning: '#B45309',
      danger: '#B91C1C',
    },
    typography: {
      display: '600 2rem/1.2 "Inter", system-ui',
      heading: '600 1.25rem/1.3 "Inter", system-ui',
      body: '400 0.95rem/1.6 "Inter", system-ui',
      caption: '400 0.8rem/1.4 "Inter", system-ui',
    },
    spacing: { xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2.5rem' },
    radius: { sm: '0.5rem', md: '0.75rem', card: '1rem', pill: '9999px' },
    elevation: { card: '0 1px 3px rgba(0,0,0,0.08)', dialog: '0 10px 30px rgba(0,0,0,0.18)' },
    surface: { app: '#FFFDF9', card: '#FFFFFF', overlay: 'rgba(41,37,36,0.5)' },
    component: {
      primaryButton: 'high-contrast warm primary, large touch target',
      menuCard: 'large food imagery, price badge, favorite toggle',
      nav: 'bottom tab bar on mobile, top bar on desktop',
      empty: 'appetite photo + "Menu is being prepared"',
    },
  },
  components: [
    {
      component: 'button',
      decisions: [
        'Large (44px+) touch targets',
        'Warm primary for order actions',
        'Clear pressed/loading states',
      ],
      states: ['default', 'hover', 'pressed', 'loading', 'disabled'],
    },
    {
      component: 'form',
      decisions: [
        'Rounded, warm-toned inputs',
        'Inline validation with clear messaging',
        'Single-column on mobile',
      ],
      states: ['default', 'focused', 'valid', 'invalid', 'disabled'],
    },
    {
      component: 'navigation',
      decisions: [
        'Bottom tab bar on mobile (Menu/Cart/Orders/Profile)',
        'Top bar + search on desktop',
      ],
      states: ['active', 'inactive', 'badge'],
    },
    {
      component: 'card',
      decisions: [
        'Menu items as rich product cards',
        'Price badge top-right',
        'Consistent image ratio',
      ],
      states: ['default', 'selected', 'unavailable'],
    },
    {
      component: 'table',
      decisions: ['Order history tables with clear status colors'],
      states: ['default', 'hover', 'empty'],
    },
    {
      component: 'dialog',
      decisions: ['Checkout confirmation dialogs', 'Clear primary/secondary actions'],
      states: ['open', 'closing', 'error'],
    },
    {
      component: 'notification',
      decisions: ['Order status toasts (placed → confirmed → out for delivery)'],
      states: ['success', 'info', 'warning', 'error'],
    },
    {
      component: 'badge',
      decisions: ['Price / status / dietary tags'],
      states: ['neutral', 'success', 'warning', 'danger'],
    },
    {
      component: 'chart',
      decisions: ['Sales dashboard charts for the admin'],
      states: ['loading', 'data', 'empty'],
    },
    {
      component: 'empty_state',
      decisions: ['Friendly copy + illustration + CTA to the menu'],
      states: ['cart empty', 'orders empty'],
    },
    {
      component: 'loading_state',
      decisions: ['Skeleton menu cards while the menu loads'],
      states: ['initial', 'refresh'],
    },
    {
      component: 'error_state',
      decisions: ['Warm, non-technical error copy with retry'],
      states: ['network', 'checkout'],
    },
  ],
  screens: [
    {
      id: 'menu',
      route: '/',
      title: 'Menu',
      sections: ['Category tabs', 'Menu item grid', 'Cart summary bar'],
      states: statesOf('LOADING', 'EMPTY', 'ERROR', 'PARTIAL', 'OFFLINE', 'SUCCESS'),
      accessibility: [
        'Menu items are keyboard navigable',
        'Images have descriptive alt text',
        'Price changes are announced',
      ],
    },
    {
      id: 'cart',
      route: '/cart',
      title: 'Cart',
      sections: ['Item list', 'Quantity controls', 'Totals', 'Checkout CTA'],
      states: statesOf('EMPTY', 'VALIDATION_ERROR', 'SUCCESS'),
      accessibility: ['Quantity controls have labels', 'Focus moves to added items'],
    },
    {
      id: 'checkout',
      route: '/checkout',
      title: 'Checkout',
      sections: ['Delivery details', 'Payment', 'Order summary', 'Place order'],
      states: statesOf('LOADING', 'VALIDATION_ERROR', 'ERROR', 'FORBIDDEN', 'SUCCESS'),
      accessibility: [
        'Form fields have labels',
        'Errors are announced',
        'One primary action per step',
      ],
    },
    {
      id: 'confirmation',
      route: '/confirmation',
      title: 'Order Confirmation',
      sections: ['Order number', 'Estimated time', 'Status timeline'],
      states: statesOf('LOADING', 'ERROR', 'SUCCESS'),
      accessibility: ['Order status uses text + icons (not color alone)'],
    },
    {
      id: 'orders',
      route: '/orders',
      title: 'My Orders',
      sections: ['Order list', 'Status filters', 'Reorder action'],
      states: statesOf('EMPTY', 'LOADING', 'ERROR', 'PARTIAL', 'SUCCESS'),
      accessibility: ['Order rows are reachable as links'],
    },
    {
      id: 'admin',
      route: '/admin',
      title: 'Admin Dashboard',
      sections: ['Metrics', 'Orders queue', 'Menu management', 'Reports'],
      states: statesOf('LOADING', 'EMPTY', 'ERROR', 'UNAUTHORIZED', 'FORBIDDEN', 'SUCCESS'),
      accessibility: [
        'Dashboard has a skip-to-content link',
        'Status colors are accompanied by text',
      ],
    },
  ],
  navigation:
    'Bottom tab bar on mobile (Menu · Cart · Orders · Profile); persistent top bar with search + cart count on desktop',
  layouts: [
    'Mobile: single column, bottom tabs',
    'Tablet: two-column menu grid with sidebar cart',
    'Desktop: top nav + three-column (categories · items · cart)',
  ],
  sharedComponents: [
    'MenuCard',
    'QuantityStepper',
    'PriceBadge',
    'OrderStatusTimeline',
    'EmptyState',
    'LoadingSkeleton',
    'ErrorBanner',
  ],
  interactions: [
    'Add to cart with animation + count bump',
    'Quantity stepper with +/-',
    'Order status auto-refresh',
    'Form validation on blur',
  ],
  responsive: [
    {
      component: 'navigation',
      mobile: 'Bottom tab bar (thumb-reachable)',
      tablet: 'Compact top bar',
      desktop: 'Full top bar + search',
      rationale: 'one-hand mobile use vs. dense desktop browsing',
    },
    {
      component: 'menu grid',
      mobile: '1 column cards',
      tablet: '2 columns',
      desktop: '3 columns + category sidebar',
      rationale: 'product focus: imagery scales with screen',
    },
    {
      component: 'cart',
      mobile: 'Slide-up summary sheet',
      tablet: 'Sticky side panel',
      desktop: 'Persistent third column',
      rationale: 'keep cart visible without shrinking content',
    },
  ],
  stateSpecs: [
    {
      state: 'LOADING',
      description: 'Skeleton menu/order cards while data loads',
      component: 'LoadingSkeleton',
      requirements: ['Never block the whole screen', 'Skeletons match final layout'],
    },
    {
      state: 'EMPTY',
      description: 'No menu items / empty cart / no orders yet',
      component: 'EmptyState',
      requirements: ['Friendly copy + CTA back to the menu', 'Never show an empty table'],
    },
    {
      state: 'SUCCESS',
      description: 'Order placed; item added to cart',
      component: 'OrderConfirmation / Toast',
      requirements: ['Explicit confirmation', 'Next action is obvious'],
    },
    {
      state: 'ERROR',
      description: 'Network or checkout failure',
      component: 'ErrorBanner',
      requirements: ['Plain-language message', 'Retry action'],
    },
    {
      state: 'PARTIAL',
      description: 'Some categories fail to load, others render',
      component: 'PartialContent',
      requirements: ['Render what is available', 'Show a retry for the failed section'],
    },
    {
      state: 'OFFLINE',
      description: 'No connection',
      component: 'OfflineBanner',
      requirements: ['Show cached menu if available', 'Reconnect detection'],
    },
    {
      state: 'UNAUTHORIZED',
      description: 'User is signed out',
      component: 'SignInGate',
      requirements: ['Explain why the action needs sign-in'],
    },
    {
      state: 'FORBIDDEN',
      description: 'User lacks staff role',
      component: 'AccessDenied',
      requirements: ['Never reveal what the admin area contains'],
    },
    {
      state: 'VALIDATION_ERROR',
      description: 'Bad address / missing payment fields',
      component: 'InlineValidation',
      requirements: ['Message next to the offending field', 'Focus moves to the first error'],
    },
  ],
  accessibility: [
    {
      id: 'a-rest-keyboard',
      category: 'keyboard',
      requirement: 'Every interactive element reachable and operable by keyboard',
      reference: 'WCAG 2.1 A',
      check: 'tab order matches visual order',
    },
    {
      id: 'a-rest-focus',
      category: 'focus',
      requirement: 'Visible focus ring on all interactive elements',
      reference: 'WCAG 2.4.7',
      check: 'focus styles are present in generated CSS',
    },
    {
      id: 'a-rest-labels',
      category: 'labels',
      requirement: 'All form fields have programmatic labels',
      reference: 'WCAG 1.3.1',
      check: 'label/aria-label present',
    },
    {
      id: 'a-rest-contrast',
      category: 'contrast',
      requirement: 'Text contrast ≥ 4.5:1 (WCAG AA)',
      reference: 'WCAG 1.4.3',
      check: 'contrast ratio of primary/text tokens',
    },
    {
      id: 'a-rest-sr',
      category: 'screen_reader',
      requirement: 'Screen-reader announcements for order status changes',
      reference: 'WCAG 4.1.3',
      check: 'aria-live region present',
    },
    {
      id: 'a-rest-touch',
      category: 'touch_target',
      requirement: 'Touch targets ≥ 44×44 px on mobile',
      reference: 'WCAG 2.5.5',
      check: 'min sizes in component tokens',
    },
    {
      id: 'a-rest-motion',
      category: 'reduced_motion',
      requirement: 'Respect prefers-reduced-motion',
      reference: 'WCAG 2.3.3',
      check: 'motion guard present',
    },
  ],
  criticChecks: [
    {
      area: 'hierarchy',
      description: 'Primary CTA (order/checkout) must visually dominate secondary actions',
    },
    { area: 'spacing', description: 'Consistent spacing rhythm from the spacing scale' },
    { area: 'alignment', description: 'Menu cards align on a consistent grid' },
    { area: 'consistency', description: 'One button style, one card style across screens' },
    { area: 'readability', description: 'Menu prices and names legible at mobile size' },
    { area: 'responsiveness', description: 'Layout adapts per breakpoint — not a shrunk desktop' },
    { area: 'accessibility', description: 'Contrast, labels, focus and touch targets hold' },
    {
      area: 'interaction_clarity',
      description: 'Add-to-cart and checkout affordances are obvious',
    },
    { area: 'visual_density', description: 'Product-focused: imagery-forward without clutter' },
    {
      area: 'domain_appropriateness',
      description: 'Warm, appetizing palette — never a cold enterprise look',
    },
  ],
  rationale: [
    'Food is visual: large imagery, warm palette, big touch targets for one-handed mobile ordering.',
    'Bottom navigation maps the five primary mobile workflows (browse → cart → orders → profile).',
    'Status colors always accompanied by text so color-blind users can track orders.',
  ],
};

// ── ABAP Debugger (professional / dense / diagnostic) ──────────────────────

const ABAP: ArchetypeExperienceKnowledge = {
  archetype: 'abap-debugger',
  visualPersonality: 'Professional, dense, diagnostic, developer-focused',
  tokens: {
    color: {
      primary: '#1D4ED8',
      primaryHover: '#1E40AF',
      surface: '#F8FAFC',
      surfaceAlt: '#F1F5F9',
      text: '#0F172A',
      textMuted: '#64748B',
      border: '#CBD5E1',
      success: '#047857',
      warning: '#B45309',
      danger: '#B91C1C',
      diagnostic: '#7C3AED',
    },
    typography: {
      display: '600 1.5rem/1.2 "JetBrains Mono", monospace',
      heading: '600 1.05rem/1.3 "Inter", system-ui',
      body: '400 0.875rem/1.5 "Inter", system-ui',
      caption: '400 0.75rem/1.4 "Inter", system-ui',
      code: '400 0.8125rem/1.5 "JetBrains Mono", monospace',
    },
    spacing: { xs: '0.125rem', sm: '0.375rem', md: '0.75rem', lg: '1.25rem', xl: '2rem' },
    radius: { sm: '0.25rem', md: '0.375rem', card: '0.5rem', pill: '9999px' },
    elevation: { card: '0 1px 2px rgba(0,0,0,0.06)', dialog: '0 8px 24px rgba(0,0,0,0.16)' },
    surface: { app: '#F8FAFC', card: '#FFFFFF', overlay: 'rgba(15,23,42,0.5)' },
    component: {
      primaryButton: 'compact blue primary, high density',
      codePanel: 'monospace, dark header, line numbers',
      diagnostics: 'severity-colored chips (error/warning/info)',
      nav: 'left sidebar with fixed sections',
    },
  },
  components: [
    {
      component: 'button',
      decisions: [
        'Compact buttons (information-dense tool)',
        'Primary = diagnose/run',
        'Keyboard shortcuts on primary actions',
      ],
      states: ['default', 'hover', 'pressed', 'loading', 'disabled'],
    },
    {
      component: 'form',
      decisions: ['Compact single-line inputs', 'Code paste area is monospace'],
      states: ['default', 'focused', 'valid', 'invalid'],
    },
    {
      component: 'navigation',
      decisions: [
        'Left sidebar: Sessions · Snippets · Diagnostics · Settings',
        'Workspace-focused, minimal chrome',
      ],
      states: ['active', 'inactive'],
    },
    {
      component: 'card',
      decisions: ['Diagnostic cards with severity header', 'Code excerpt panels with line numbers'],
      states: ['default', 'error', 'warning', 'success'],
    },
    {
      component: 'table',
      decisions: ['Symptom → cause → fix tables', 'Column headers always visible'],
      states: ['default', 'hover', 'empty'],
    },
    {
      component: 'dialog',
      decisions: ['Confirm destructive actions (clear sessions)'],
      states: ['open', 'closing'],
    },
    {
      component: 'notification',
      decisions: ['Diagnostic completion toasts'],
      states: ['success', 'info', 'warning', 'error'],
    },
    {
      component: 'badge',
      decisions: ['Severity chips (error/warning/info/success)'],
      states: ['error', 'warning', 'info', 'success'],
    },
    {
      component: 'chart',
      decisions: ['Failure-rate trends over time'],
      states: ['loading', 'data', 'empty'],
    },
    {
      component: 'empty_state',
      decisions: ['"Paste source or open a session to begin" + example CTA'],
      states: ['no sessions', 'no results'],
    },
    {
      component: 'loading_state',
      decisions: ['Compact progress on the analyze action'],
      states: ['analyzing'],
    },
    {
      component: 'error_state',
      decisions: ['Technical-but-clear error with raw line context'],
      states: ['parse failure', 'provider failure'],
    },
  ],
  screens: [
    {
      id: 'sessions',
      route: '/',
      title: 'Sessions',
      sections: ['Session list', 'New session', 'Search'],
      states: statesOf('LOADING', 'EMPTY', 'ERROR', 'SUCCESS'),
      accessibility: ['Session rows are links', 'Search has a label'],
    },
    {
      id: 'diagnose',
      route: '/diagnose',
      title: 'Diagnose',
      sections: ['Source input', 'Analysis controls', 'Diagnostic results', 'Fix suggestions'],
      states: statesOf('LOADING', 'EMPTY', 'ERROR', 'VALIDATION_ERROR', 'SUCCESS'),
      accessibility: ['Code textarea is keyboard operable', 'Severity is not color-only'],
    },
    {
      id: 'snippet',
      route: '/snippet/:id',
      title: 'Snippet',
      sections: ['Code view', 'Diagnostics', 'Fix diff'],
      states: statesOf('LOADING', 'ERROR', 'SUCCESS'),
      accessibility: ['Code is in a code landmark'],
    },
    {
      id: 'settings',
      route: '/settings',
      title: 'Settings',
      sections: ['Provider config', 'Code handling', 'Privacy'],
      states: statesOf('SUCCESS', 'VALIDATION_ERROR'),
      accessibility: ['Settings form is fully labeled'],
    },
  ],
  navigation:
    'Left sidebar with fixed sections (Sessions · Snippets · Diagnostics · Settings); breadcrumbs for nested views',
  layouts: [
    'Mobile: single column with drawer navigation',
    'Tablet: sidebar collapses to icons',
    'Desktop: fixed sidebar + content + optional inspector',
  ],
  sharedComponents: [
    'SeverityBadge',
    'CodePanel',
    'DiagnosticCard',
    'SessionList',
    'EmptyState',
    'LoadingIndicator',
    'ErrorBanner',
  ],
  interactions: [
    'Analyze with inline progress',
    'Apply fix → live diff',
    'Copy snippet',
    'Filter diagnostics by severity',
  ],
  responsive: [
    {
      component: 'navigation',
      mobile: 'Drawer navigation (hamburger)',
      tablet: 'Icon-only sidebar',
      desktop: 'Full sidebar',
      rationale: 'developer tool: screen space goes to code',
    },
    {
      component: 'code panel',
      mobile: 'Full-width, smaller font',
      tablet: 'Full-width with toggleable inspector',
      desktop: 'Split pane code + diagnostics',
      rationale: 'diagnostics beside code only when space allows',
    },
    {
      component: 'diagnostics',
      mobile: 'Stacked cards',
      tablet: 'Two-column grid',
      desktop: 'Filterable table',
      rationale: 'density scales with available width',
    },
  ],
  stateSpecs: [
    {
      state: 'LOADING',
      description: 'Analyzing source…',
      component: 'LoadingIndicator',
      requirements: ['Inline, non-blocking', 'Shows progress phase'],
    },
    {
      state: 'EMPTY',
      description: 'No sessions or no diagnostics yet',
      component: 'EmptyState',
      requirements: ['Shows an example path to start'],
    },
    {
      state: 'SUCCESS',
      description: 'Analysis complete with findings',
      component: 'DiagnosticCard',
      requirements: ['Results count summary', 'Clear next action'],
    },
    {
      state: 'ERROR',
      description: 'Analysis or provider failure',
      component: 'ErrorBanner',
      requirements: ['Distinguish parse errors from provider failures'],
    },
    {
      state: 'PARTIAL',
      description: 'Some diagnostics rendered, others pending',
      component: 'PartialContent',
      requirements: ['Render available diagnostics with a progress note'],
    },
    {
      state: 'OFFLINE',
      description: 'No connectivity (provider unavailable)',
      component: 'OfflineBanner',
      requirements: ['Explain provider dependency'],
    },
    {
      state: 'UNAUTHORIZED',
      description: 'Signed out',
      component: 'SignInGate',
      requirements: ['Explain that sessions are private'],
    },
    {
      state: 'FORBIDDEN',
      description: 'No access to a shared snippet',
      component: 'AccessDenied',
      requirements: ['No leakage of snippet content'],
    },
    {
      state: 'VALIDATION_ERROR',
      description: 'Empty source or bad input',
      component: 'InlineValidation',
      requirements: ['Explain what input is expected'],
    },
  ],
  accessibility: [
    {
      id: 'a-abap-keyboard',
      category: 'keyboard',
      requirement: 'Full keyboard operation — this is a developer tool',
      reference: 'WCAG 2.1 A',
      check: 'all actions reachable via keyboard',
    },
    {
      id: 'a-abap-focus',
      category: 'focus',
      requirement: 'Visible focus ring on code panels and actions',
      reference: 'WCAG 2.4.7',
      check: 'focus styles in generated CSS',
    },
    {
      id: 'a-abap-semantics',
      category: 'semantics',
      requirement: 'Code in <pre>/code landmarks; sections use landmarks',
      reference: 'WCAG 1.3.1',
      check: 'landmark elements present',
    },
    {
      id: 'a-abap-sr',
      category: 'screen_reader',
      requirement: 'Screen readers announce severity counts',
      reference: 'WCAG 4.1.3',
      check: 'aria-live on diagnostics summary',
    },
    {
      id: 'a-abap-contrast',
      category: 'contrast',
      requirement: 'Monospace text meets 4.5:1 contrast',
      reference: 'WCAG 1.4.3',
      check: 'token contrast ratio',
    },
    {
      id: 'a-abap-motion',
      category: 'reduced_motion',
      requirement: 'No essential motion; respect reduced-motion',
      reference: 'WCAG 2.3.3',
      check: 'motion guard present',
    },
  ],
  criticChecks: [
    {
      area: 'hierarchy',
      description: 'Primary action (analyze) distinct from secondary (clear/save)',
    },
    { area: 'spacing', description: 'Dense but consistent spacing — no wasted whitespace' },
    { area: 'alignment', description: 'Code and diagnostics align on a shared grid' },
    { area: 'consistency', description: 'One diagnostic card style, one severity scale' },
    { area: 'readability', description: 'Monospace at readable size with adequate line height' },
    { area: 'responsiveness', description: 'Code remains readable on mobile' },
    { area: 'accessibility', description: 'Severity never conveyed by color alone' },
    { area: 'interaction_clarity', description: 'Apply-fix affordance is unmistakable' },
    { area: 'visual_density', description: 'Information-dense without overload' },
    { area: 'domain_appropriateness', description: 'Developer tool feel — not a consumer app' },
  ],
  rationale: [
    'A developer tool earns trust through density, precision and speed — not decoration.',
    'Monospace surfaces communicate "diagnostic tool" immediately.',
    'Severity chips with text + icon satisfy both speed and accessibility.',
  ],
};

// ── Generic Web (neutral / clear / adaptable) ──────────────────────────────

const GENERIC: ArchetypeExperienceKnowledge = {
  archetype: 'generic-web',
  visualPersonality: 'Clear, structured, adaptable',
  tokens: {
    color: {
      primary: '#2B5FD9',
      primaryHover: '#234DB3',
      surface: '#FFFFFF',
      surfaceAlt: '#F8FAFC',
      text: '#0F172A',
      textMuted: '#64748B',
      border: '#E2E8F0',
      success: '#15803D',
      warning: '#B45309',
      danger: '#B91C1C',
    },
    typography: {
      display: '600 2rem/1.2 "Inter", system-ui',
      heading: '600 1.25rem/1.3 "Inter", system-ui',
      body: '400 0.95rem/1.6 "Inter", system-ui',
      caption: '400 0.8rem/1.4 "Inter", system-ui',
    },
    spacing: { xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2.5rem' },
    radius: { sm: '0.375rem', md: '0.5rem', card: '0.75rem', pill: '9999px' },
    elevation: { card: '0 1px 3px rgba(0,0,0,0.07)', dialog: '0 10px 28px rgba(0,0,0,0.16)' },
    surface: { app: '#FFFFFF', card: '#FFFFFF', overlay: 'rgba(15,23,42,0.5)' },
    component: {
      primaryButton: 'blue primary, standard size',
      nav: 'top navbar + responsive drawer',
      card: 'neutral cards with clear dividers',
      form: 'standard labeled fields',
    },
  },
  components: [
    {
      component: 'button',
      decisions: ['Clear primary/secondary hierarchy', 'Loading state on async actions'],
      states: ['default', 'hover', 'pressed', 'loading', 'disabled'],
    },
    {
      component: 'form',
      decisions: ['Labels above fields', 'Inline validation'],
      states: ['default', 'focused', 'valid', 'invalid'],
    },
    {
      component: 'navigation',
      decisions: ['Top navbar on desktop, drawer on mobile'],
      states: ['active', 'inactive'],
    },
    {
      component: 'card',
      decisions: ['Neutral cards with consistent padding'],
      states: ['default', 'hover'],
    },
    {
      component: 'table',
      decisions: ['Sortable headers, striped rows'],
      states: ['default', 'hover', 'empty'],
    },
    { component: 'dialog', decisions: ['Modal for confirmations'], states: ['open', 'closing'] },
    {
      component: 'notification',
      decisions: ['Top-right toasts'],
      states: ['success', 'info', 'warning', 'error'],
    },
    {
      component: 'badge',
      decisions: ['Status badges'],
      states: ['neutral', 'success', 'warning', 'danger'],
    },
    { component: 'chart', decisions: ['Dashboard charts'], states: ['loading', 'data', 'empty'] },
    { component: 'empty_state', decisions: ['Icon + explanation + CTA'], states: ['no data'] },
    { component: 'loading_state', decisions: ['Skeleton or spinner'], states: ['initial'] },
    { component: 'error_state', decisions: ['Clear error + retry'], states: ['request'] },
  ],
  screens: [
    {
      id: 'home',
      route: '/',
      title: 'Home',
      sections: ['Hero', 'Primary actions', 'Recent items'],
      states: statesOf('LOADING', 'EMPTY', 'ERROR', 'SUCCESS'),
      accessibility: ['Skip-to-content link', 'Landmark regions'],
    },
    {
      id: 'list',
      route: '/items',
      title: 'Items',
      sections: ['Filters', 'List/table', 'Pagination'],
      states: statesOf('LOADING', 'EMPTY', 'ERROR', 'SUCCESS'),
      accessibility: ['Filter controls labeled'],
    },
    {
      id: 'detail',
      route: '/items/:id',
      title: 'Detail',
      sections: ['Detail view', 'Actions', 'Related items'],
      states: statesOf('LOADING', 'ERROR', 'UNAUTHORIZED', 'FORBIDDEN', 'SUCCESS'),
      accessibility: ['Detail content in main landmark'],
    },
    {
      id: 'settings',
      route: '/settings',
      title: 'Settings',
      sections: ['Profile', 'Preferences'],
      states: statesOf('SUCCESS', 'VALIDATION_ERROR'),
      accessibility: ['Fully labeled form'],
    },
  ],
  navigation: 'Top navbar on desktop, responsive drawer on mobile',
  layouts: ['Mobile: single column', 'Tablet: two columns', 'Desktop: content + sidebar'],
  sharedComponents: [
    'NavBar',
    'Card',
    'DataTable',
    'Modal',
    'Toast',
    'EmptyState',
    'LoadingSkeleton',
    'ErrorBanner',
  ],
  interactions: ['Responsive drawer', 'Sortable tables', 'Inline validation'],
  responsive: [
    {
      component: 'navigation',
      mobile: 'Drawer',
      tablet: 'Compact navbar',
      desktop: 'Full navbar + breadcrumbs',
      rationale: 'standard responsive navigation pattern',
    },
    {
      component: 'tables',
      mobile: 'Card list (horizontal scroll avoided)',
      tablet: 'Table with condensed columns',
      desktop: 'Full table',
      rationale: 'tables become cards on small screens',
    },
    {
      component: 'layout',
      mobile: 'Single column',
      tablet: 'Two column',
      desktop: 'Content + sidebar',
      rationale: 'progressive use of space',
    },
  ],
  stateSpecs: [
    {
      state: 'LOADING',
      description: 'Skeleton or spinner during data fetch',
      component: 'LoadingSkeleton',
      requirements: ['Non-blocking, layout-stable'],
    },
    {
      state: 'EMPTY',
      description: 'No records',
      component: 'EmptyState',
      requirements: ['Explains why + CTA'],
    },
    {
      state: 'SUCCESS',
      description: 'Action completed',
      component: 'Toast',
      requirements: ['Explicit confirmation'],
    },
    {
      state: 'ERROR',
      description: 'Request failed',
      component: 'ErrorBanner',
      requirements: ['Plain language + retry'],
    },
    {
      state: 'PARTIAL',
      description: 'Partial data available',
      component: 'PartialContent',
      requirements: ['Render what exists'],
    },
    {
      state: 'OFFLINE',
      description: 'No connection',
      component: 'OfflineBanner',
      requirements: ['Detect + explain'],
    },
    {
      state: 'UNAUTHORIZED',
      description: 'Signed out',
      component: 'SignInGate',
      requirements: ['Explain why sign-in is needed'],
    },
    {
      state: 'FORBIDDEN',
      description: 'No permission',
      component: 'AccessDenied',
      requirements: ['No content leakage'],
    },
    {
      state: 'VALIDATION_ERROR',
      description: 'Form validation',
      component: 'InlineValidation',
      requirements: ['Field-adjacent messages'],
    },
  ],
  accessibility: [
    {
      id: 'a-gen-keyboard',
      category: 'keyboard',
      requirement: 'Full keyboard navigation',
      reference: 'WCAG 2.1 A',
      check: 'tab order + focus',
    },
    {
      id: 'a-gen-focus',
      category: 'focus',
      requirement: 'Visible focus indicators',
      reference: 'WCAG 2.4.7',
      check: 'focus CSS',
    },
    {
      id: 'a-gen-labels',
      category: 'labels',
      requirement: 'All controls labeled',
      reference: 'WCAG 1.3.1',
      check: 'labels present',
    },
    {
      id: 'a-gen-contrast',
      category: 'contrast',
      requirement: 'AA contrast',
      reference: 'WCAG 1.4.3',
      check: 'token ratios',
    },
    {
      id: 'a-gen-sr',
      category: 'screen_reader',
      requirement: 'Landmarks + status announcements',
      reference: 'WCAG 1.3.1',
      check: 'landmarks present',
    },
    {
      id: 'a-gen-touch',
      category: 'touch_target',
      requirement: '44px touch targets on mobile',
      reference: 'WCAG 2.5.5',
      check: 'sizes',
    },
    {
      id: 'a-gen-motion',
      category: 'reduced_motion',
      requirement: 'Respect reduced motion',
      reference: 'WCAG 2.3.3',
      check: 'motion guard',
    },
  ],
  criticChecks: [
    { area: 'hierarchy', description: 'Primary actions are visually dominant' },
    { area: 'spacing', description: 'Consistent spacing from the scale' },
    { area: 'alignment', description: 'Cards and tables align on a grid' },
    { area: 'consistency', description: 'One component style per kind' },
    { area: 'readability', description: 'Body text legible at 16px equivalent' },
    { area: 'responsiveness', description: 'Adaptive layouts per breakpoint' },
    { area: 'accessibility', description: 'AA contrast, labels, focus, touch targets' },
    { area: 'interaction_clarity', description: 'Actions obvious and discoverable' },
    { area: 'visual_density', description: 'Neither sparse nor cluttered' },
    { area: 'domain_appropriateness', description: 'Matches the declared visual personality' },
  ],
  rationale: [
    'Neutral, clear, adaptable — the safe baseline for arbitrary web workflows.',
    'Structured tokens allow the domain to tint the system later without a redesign.',
  ],
};

// ── AI App Builder (precise / flow-focused / structured) ───────────────────

const AI_BUILDER: ArchetypeExperienceKnowledge = {
  archetype: 'ai-app-builder',
  visualPersonality: 'Precise, flow-focused, structured',
  tokens: {
    color: {
      primary: '#7C3AED',
      primaryHover: '#6D28D9',
      surface: '#FAFAFF',
      surfaceAlt: '#F4F4FB',
      text: '#1E1B4B',
      textMuted: '#6D6A9E',
      border: '#E4E4F0',
      success: '#047857',
      warning: '#B45309',
      danger: '#B91C1C',
    },
    typography: {
      display: '600 1.75rem/1.2 "Inter", system-ui',
      heading: '600 1.15rem/1.3 "Inter", system-ui',
      body: '400 0.9rem/1.6 "Inter", system-ui',
      caption: '400 0.78rem/1.4 "Inter", system-ui',
    },
    spacing: { xs: '0.25rem', sm: '0.5rem', md: '0.875rem', lg: '1.375rem', xl: '2.25rem' },
    radius: { sm: '0.375rem', md: '0.625rem', card: '0.875rem', pill: '9999px' },
    elevation: { card: '0 1px 3px rgba(30,27,75,0.08)', dialog: '0 12px 32px rgba(30,27,75,0.2)' },
    surface: { app: '#FAFAFF', card: '#FFFFFF', overlay: 'rgba(30,27,75,0.5)' },
    component: {
      primaryButton: 'violet primary, confident action',
      builderCanvas: 'structured step flow with connectors',
      node: 'capability nodes with clear ports',
      nav: 'top bar + builder canvas',
    },
  },
  components: [
    {
      component: 'button',
      decisions: ['Violet primary for build actions', 'Ghost secondary to keep canvas clean'],
      states: ['default', 'hover', 'pressed', 'loading', 'disabled'],
    },
    {
      component: 'form',
      decisions: ['Structured step forms', 'Inline validation'],
      states: ['default', 'focused', 'valid', 'invalid'],
    },
    {
      component: 'navigation',
      decisions: ['Top bar: builder steps (Understand → Build → Validate)'],
      states: ['active', 'completed', 'inactive'],
    },
    {
      component: 'card',
      decisions: ['Capability cards with status'],
      states: ['default', 'selected', 'complete'],
    },
    { component: 'table', decisions: ['Validation results table'], states: ['default', 'hover'] },
    {
      component: 'dialog',
      decisions: ['Confirm deploy / destructive'],
      states: ['open', 'closing'],
    },
    {
      component: 'notification',
      decisions: ['Build/toast events'],
      states: ['success', 'info', 'warning', 'error'],
    },
    {
      component: 'badge',
      decisions: ['Capability/status badges'],
      states: ['neutral', 'success', 'warning', 'danger'],
    },
    {
      component: 'chart',
      decisions: ['Usage/cost dashboards'],
      states: ['loading', 'data', 'empty'],
    },
    {
      component: 'empty_state',
      decisions: ['"Describe your app to begin" + example prompts'],
      states: ['no prompt'],
    },
    {
      component: 'loading_state',
      decisions: ['Step progress with current action'],
      states: ['generating'],
    },
    {
      component: 'error_state',
      decisions: ['Step failure with retry + detail'],
      states: ['build failure'],
    },
  ],
  screens: [
    {
      id: 'builder',
      route: '/',
      title: 'App Builder',
      sections: ['Prompt input', 'Step flow', 'Generated output', 'Validation'],
      states: statesOf('LOADING', 'EMPTY', 'ERROR', 'VALIDATION_ERROR', 'SUCCESS'),
      accessibility: ['Step progress is announced', 'Canvas is keyboard navigable'],
    },
    {
      id: 'output',
      route: '/output/:id',
      title: 'Generated App',
      sections: ['File tree', 'Code view', 'Validation results'],
      states: statesOf('LOADING', 'ERROR', 'SUCCESS'),
      accessibility: ['Code in code landmark'],
    },
    {
      id: 'deploy',
      route: '/deploy',
      title: 'Deploy',
      sections: ['Target selection', 'Review', 'Deploy'],
      states: statesOf('LOADING', 'ERROR', 'FORBIDDEN', 'SUCCESS'),
      accessibility: ['Deploy confirm is explicit'],
    },
  ],
  navigation: 'Top bar with builder steps + progress indicator',
  layouts: [
    'Mobile: single column step flow',
    'Tablet: canvas + side inspector',
    'Desktop: full canvas + inspectors',
  ],
  sharedComponents: [
    'BuilderStep',
    'CapabilityCard',
    'ValidationTable',
    'FileTree',
    'EmptyState',
    'ProgressBar',
    'ErrorBanner',
  ],
  interactions: ['Step transitions with progress', 'Apply capability toggle', 'Live validation'],
  responsive: [
    {
      component: 'builder steps',
      mobile: 'Vertical stepper',
      tablet: 'Horizontal stepper',
      desktop: 'Horizontal + progress sidebar',
      rationale: 'multi-step flow stays comprehensible at any size',
    },
    {
      component: 'canvas',
      mobile: 'Card stack',
      tablet: 'Narrow canvas',
      desktop: 'Full canvas + inspectors',
      rationale: 'drag-like building needs desktop space',
    },
    {
      component: 'validation',
      mobile: 'Cards',
      tablet: 'Cards',
      desktop: 'Table',
      rationale: 'dense results only where width allows',
    },
  ],
  stateSpecs: [
    {
      state: 'LOADING',
      description: 'Generating / validating',
      component: 'ProgressBar',
      requirements: ['Current step labeled'],
    },
    {
      state: 'EMPTY',
      description: 'No app built yet',
      component: 'EmptyState',
      requirements: ['Example prompts to start'],
    },
    {
      state: 'SUCCESS',
      description: 'App generated + validated',
      component: 'ResultPanel',
      requirements: ['Next action (deploy/refine)'],
    },
    {
      state: 'ERROR',
      description: 'Generation failure',
      component: 'ErrorBanner',
      requirements: ['Which step failed + retry'],
    },
    {
      state: 'PARTIAL',
      description: 'Generated with warnings',
      component: 'WarningPanel',
      requirements: ['Warnings surfaced, not hidden'],
    },
    {
      state: 'OFFLINE',
      description: 'No connection (providers)',
      component: 'OfflineBanner',
      requirements: ['Provider dependency explained'],
    },
    {
      state: 'UNAUTHORIZED',
      description: 'Signed out',
      component: 'SignInGate',
      requirements: ['Apps are private to the user'],
    },
    {
      state: 'FORBIDDEN',
      description: 'No access to output',
      component: 'AccessDenied',
      requirements: ['No content leakage'],
    },
    {
      state: 'VALIDATION_ERROR',
      description: 'Invalid prompt',
      component: 'InlineValidation',
      requirements: ['What input is expected'],
    },
  ],
  accessibility: [
    {
      id: 'a-builder-keyboard',
      category: 'keyboard',
      requirement: 'Builder flow operable by keyboard',
      reference: 'WCAG 2.1 A',
      check: 'step navigation + focus',
    },
    {
      id: 'a-builder-focus',
      category: 'focus',
      requirement: 'Visible focus on step and canvas controls',
      reference: 'WCAG 2.4.7',
      check: 'focus CSS',
    },
    {
      id: 'a-builder-sr',
      category: 'screen_reader',
      requirement: 'Progress and status announced',
      reference: 'WCAG 4.1.3',
      check: 'aria-live',
    },
    {
      id: 'a-builder-labels',
      category: 'labels',
      requirement: 'All builder controls labeled',
      reference: 'WCAG 1.3.1',
      check: 'labels present',
    },
    {
      id: 'a-builder-contrast',
      category: 'contrast',
      requirement: 'AA contrast',
      reference: 'WCAG 1.4.3',
      check: 'token ratios',
    },
    {
      id: 'a-builder-motion',
      category: 'reduced_motion',
      requirement: 'Respect reduced motion',
      reference: 'WCAG 2.3.3',
      check: 'motion guard',
    },
  ],
  criticChecks: [
    { area: 'hierarchy', description: 'The build CTA dominates the canvas chrome' },
    { area: 'spacing', description: 'Step flow spacing signals grouping' },
    { area: 'alignment', description: 'Canvas nodes align to a grid' },
    { area: 'consistency', description: 'One node/card style per capability type' },
    { area: 'readability', description: 'Step labels legible at all sizes' },
    { area: 'responsiveness', description: 'Flow adapts to mobile without losing state' },
    { area: 'accessibility', description: 'Progress announced to screen readers' },
    { area: 'interaction_clarity', description: 'Each step has one obvious next action' },
    { area: 'visual_density', description: 'Canvas is structured, never cluttered' },
    { area: 'domain_appropriateness', description: 'Builder feel — precise and modern' },
  ],
  rationale: [
    'An app builder is a flow product: step progression must be legible and calm.',
    'Violet primary differentiates the builder experience from generic blue apps.',
  ],
};

const KNOWLEDGE: Record<AppArchetype, ArchetypeExperienceKnowledge> = {
  'restaurant-app': RESTAURANT,
  'abap-debugger': ABAP,
  'generic-web': GENERIC,
  'ai-app-builder': AI_BUILDER,
};

export function experienceKnowledgeFor(archetype: AppArchetype): ArchetypeExperienceKnowledge {
  return KNOWLEDGE[archetype];
}

export const KNOWN_ARCHETYPES: readonly AppArchetype[] = [
  'restaurant-app',
  'abap-debugger',
  'generic-web',
  'ai-app-builder',
];

/** Build the typed ApplicationDesignSystem from the catalog + an optional
 *  EPIC-009 DesignSpecification (the spec overrides catalog defaults where
 *  it declares specific values — the catalog remains the fallback). */
export function buildDesignSystem(
  applicationId: string,
  archetype: AppArchetype,
  designSpec?: DesignSpecification,
): ApplicationDesignSystem {
  const k = experienceKnowledgeFor(archetype);
  const tokens: DesignToken[] = [];
  const byGroup: Record<DesignToken['group'], string[]> = {
    typography: [],
    color: [],
    spacing: [],
    radius: [],
    elevation: [],
    surface: [],
    component: [],
  };
  for (const [group, values] of Object.entries(k.tokens)) {
    for (const [id, value] of Object.entries(values)) {
      const token: DesignToken = {
        id: `${group}.${id}`,
        group: group as DesignToken['group'],
        value,
        source: 'ARCHETYPE',
        rationale: `archetype ${archetype} visual baseline`,
      };
      tokens.push(token);
      byGroup[token.group].push(token.id);
    }
  }
  // EPIC-009 DesignSpecification overrides: personality + stated colors.
  const visualPersonality = designSpec?.visualPersonality ?? k.visualPersonality;
  if (designSpec) {
    for (const c of designSpec.colorSystem) {
      const match = /([a-z]+)\s*[:=]\s*(#[0-9a-fA-F]{3,8})/.exec(c);
      if (match && match[1] && match[2]) {
        const id = `color.${match[1].toLowerCase()}`;
        const existing = tokens.find((t) => t.id === id);
        if (existing) {
          existing.value = match[2];
          existing.source = 'DESIGN_SPEC';
          existing.rationale = 'overridden by the EPIC-009 design specification';
        } else {
          tokens.push({
            id,
            group: 'color',
            value: match[2],
            source: 'DESIGN_SPEC',
            rationale: 'from the EPIC-009 design specification',
          });
          byGroup.color.push(id);
        }
      }
    }
  }
  return {
    applicationId,
    archetype,
    tokens,
    components: k.components,
    byGroup,
    visualPersonality,
    rationale: k.rationale,
  };
}

/** Build the UI blueprint (screens, routes, navigation, components,
 *  responsive behaviors, interactions, accessibility). */
export function buildUIBlueprint(applicationId: string, archetype: AppArchetype): UIBlueprint {
  const k = experienceKnowledgeFor(archetype);
  return {
    applicationId,
    screens: k.screens,
    routes: k.screens.map((s) => s.route),
    navigation: k.navigation,
    components: k.sharedComponents,
    layouts: k.layouts,
    responsive: k.responsive,
    interactions: k.interactions,
    accessibility: k.accessibility.map((a) => `${a.category}: ${a.requirement}`),
  };
}

export { RESTAURANT, ABAP, GENERIC, AI_BUILDER };
