// ──────────────────────────────────────────────────────────────────
// VedMoulya — Design Token: Breakpoints & Layout
// Follows DES-001 Constitution v1.0, DES-010A Experience Bible v1.0
// ──────────────────────────────────────────────────────────────────

// ── Breakpoints ────────────────────────────────────────────────────────────

export const breakpoints = {
  mobileS: 375,
  mobile: 768,
  tablet: 1024,
  desktop: 1440,
  desktopL: 1920,
  ultraWide: 1921,
} as const;

// ── Breakpoint Query Strings ───────────────────────────────────────────────

export const mediaQuery = {
  mobileS: `@media (max-width: ${String(breakpoints.mobileS - 1)}px)`,
  mobile: `@media (min-width: ${String(breakpoints.mobileS)}px) and (max-width: ${String(breakpoints.mobile - 1)}px)`,
  mobileUp: `@media (max-width: ${String(breakpoints.mobile - 1)}px)`,
  tablet: `@media (min-width: ${String(breakpoints.mobile)}px) and (max-width: ${String(breakpoints.tablet - 1)}px)`,
  tabletUp: `@media (min-width: ${String(breakpoints.mobile)}px)`,
  desktop: `@media (min-width: ${String(breakpoints.tablet)}px) and (max-width: ${String(breakpoints.desktop - 1)}px)`,
  desktopUp: `@media (min-width: ${String(breakpoints.tablet)}px)`,
  desktopL: `@media (min-width: ${String(breakpoints.desktop)}px) and (max-width: ${String(breakpoints.desktopL - 1)}px)`,
  ultraWide: `@media (min-width: ${String(breakpoints.desktopL)}px)`,
  reducedMotion: '@media (prefers-reduced-motion: reduce)',
  prefersDark: '@media (prefers-color-scheme: dark)',
  prefersLight: '@media (prefers-color-scheme: light)',
} as const;

// ── Max Content Widths ─────────────────────────────────────────────────────

export const maxWidth = {
  content: '1280px',
  wide: '1536px',
  sidebarContent: 'calc(100% - 280px)',
} as const;

// ── Grid System ────────────────────────────────────────────────────────────

export const grid = {
  columns: {
    mobile: 4,
    tablet: 8,
    desktop: 12,
    wide: 12,
  },
  gutter: {
    mobile: '16px',
    tablet: '24px',
    desktop: '24px',
  },
  margin: {
    mobile: '16px',
    tablet: '32px',
    desktop: '64px',
  },
} as const;

// ── Z-Index Scale ─────────────────────────────────────────────────────────

export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  nav: 30,
  sidebar: 40,
  overlay: 50,
  dialog: 100,
  modal: 110,
  toast: 200,
  tooltip: 300,
} as const;

// ── CSS Variable Map ───────────────────────────────────────────────────────

export const layoutCSSVars = {
  '--max-content-width': maxWidth.content,
  '--max-wide-width': maxWidth.wide,
  '--sidebar-width': '280px',
  '--sidebar-collapsed': '64px',
  '--header-height': '64px',
} as const;

// ── Types ──────────────────────────────────────────────────────────────────

export type BreakpointToken = keyof typeof breakpoints;
export type MediaQueryToken = keyof typeof mediaQuery;
export type ZIndexToken = keyof typeof zIndex;
