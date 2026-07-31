// ──────────────────────────────────────────────────────────────────
// VedMoulya — Design Token: Spacing
// Follows DES-001 Constitution v1.0 — 4px base unit
// ──────────────────────────────────────────────────────────────────

// ── Spacing Scale (4px base unit) ──────────────────────────────────────────

export const spacing: Record<string, string> = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px', // BASE
  5: '20px',
  6: '24px',
  7: '32px',
  8: '40px',
  9: '48px',
  10: '64px',
  11: '80px',
  12: '96px',
} as const;

// ── Semantic Spacing Aliases ───────────────────────────────────────────────

export const space = {
  none: '0px',
  micro: '4px',
  tight: '8px',
  dense: '12px',
  base: '16px',
  comfortable: '20px',
  component: '24px',
  section: '32px',
  large: '40px',
  pageSection: '48px',
  major: '64px',
  page: '80px',
  hero: '96px',
} as const;

// ── Responsive Padding ─────────────────────────────────────────────────────

export const responsivePadding = {
  mobile: '16px', // space-4
  tablet: '24px', // space-6
  desktop: '32px', // space-7
} as const;

// ── Card Spacing ───────────────────────────────────────────────────────────

export const cardSpacing = {
  padding: {
    desktop: '24px', // space-6
    mobile: '16px', // space-4
  },
  gap: '16px', // space-4
  titleToSubtitle: '8px',
  contentToActions: '24px',
  stackGap: '16px',
} as const;

// ── Dialog Spacing ─────────────────────────────────────────────────────────

export const dialogSpacing = {
  padding: '40px', // space-8
  titleGap: '16px', // space-4
  contentGap: '24px', // space-6
  actionsGap: '16px', // space-4
  edgeMinimum: '24px', // space-6
} as const;

// ── Form Spacing ───────────────────────────────────────────────────────────

export const formSpacing = {
  fieldGap: '24px',
  labelToInput: '8px',
  inputToHint: '4px',
  inputToError: '4px',
  buttonToFormEnd: '40px',
  inlineFieldsGap: '16px',
} as const;

// ── Navigation Spacing ─────────────────────────────────────────────────────

export const navSpacing = {
  sidebarWidth: '280px',
  sidebarCollapsed: '64px',
  sidebarItemPadding: '12px 16px',
  navItemGap: '4px',
  navGroupGap: '24px',
  headerHeight: '64px',
  headerPadding: '16px 24px',
} as const;

// ── Section Spacing ────────────────────────────────────────────────────────

export const sectionSpacing = {
  betweenSections: {
    desktop: '64px',
    mobile: '40px',
  },
  withinSection: {
    desktop: '40px',
    mobile: '24px',
  },
  subSection: '24px',
  contentGrouping: '16px',
} as const;

// ── CSS Variable Map for Spacing ───────────────────────────────────────────

export const spacingCSSVars: Record<string, string> = {};
for (const [key, value] of Object.entries(spacing)) {
  spacingCSSVars[`--space-${key}`] = value;
}
