// ──────────────────────────────────────────────────────────────────
// VedMoulya — Design Token: Elevation & Radius
// Follows DES-001 Constitution v1.0
// ──────────────────────────────────────────────────────────────────

// ── Corner Radius (FROZEN in Constitution v1.0) ────────────────────────────

export const radius = {
  none: '0px',
  sm: '4px',
  md: '8px',
  lg: '16px',
  xl: '24px', // ★ Cards
  xxl: '28px', // ★ Dialogs
  button: '14px', // ★ Buttons
  input: '16px', // ★ Inputs
  chart: '24px', // ★ Charts
  badge: '9999px', // Full (pill)
  tooltip: '8px',
  full: '9999px',
} as const;

// ── Radius by Component ────────────────────────────────────────────────────

export const componentRadius = {
  card: '24px',
  button: '14px',
  input: '16px',
  dialog: '28px',
  chart: '24px',
  badge: '9999px',
  tooltip: '8px',
  tabs: '8px',
  sidebar: '8px',
  skeleton: '8px',
} as const;

// ── Shadows ────────────────────────────────────────────────────────────────

export const shadows = {
  none: 'none',
  standard: '0 8px 30px rgba(15, 23, 42, 0.06)', // Cards
  level1: '0 1px 2px rgba(15, 23, 42, 0.05)', // Subtle depth
  level2: '0 1px 3px rgba(15, 23, 42, 0.07), 0 1px 2px rgba(15, 23, 42, 0.03)', // Dropdowns
  level3: '0 4px 6px rgba(15, 23, 42, 0.06), 0 2px 4px rgba(15, 23, 42, 0.04)', // Dialogs
  level4: '0 10px 15px rgba(15, 23, 42, 0.07), 0 4px 6px rgba(15, 23, 42, 0.04)', // Modals
  level5: '0 20px 25px rgba(15, 23, 42, 0.09), 0 8px 10px rgba(15, 23, 42, 0.05)', // Toasts
  aiGlow: '0 0 20px rgba(124, 58, 237, 0.15)',
} as const;

// ── Elevation Levels ───────────────────────────────────────────────────────

export const elevation = {
  flat: {
    shadow: shadows.none,
    zIndex: 0,
  },
  subtle: {
    shadow: shadows.level1,
    zIndex: 1,
  },
  raised: {
    shadow: shadows.level2,
    zIndex: 10,
  },
  elevated: {
    shadow: shadows.level3,
    zIndex: 50,
  },
  modal: {
    shadow: shadows.level4,
    zIndex: 100,
  },
  toast: {
    shadow: shadows.level5,
    zIndex: 200,
  },
} as const;

export type ElevationLevel = keyof typeof elevation;
export type RadiusToken = keyof typeof radius;

// ── CSS Variable Maps ──────────────────────────────────────────────────────

export const radiusCSSVars: Record<string, string> = {
  '--radius-sm': radius.sm,
  '--radius-md': radius.md,
  '--radius-lg': radius.lg,
  '--radius-xl': radius.xl,
  '--radius-xxl': radius.xxl,
  '--radius-button': radius.button,
  '--radius-input': radius.input,
  '--radius-card': componentRadius.card,
  '--radius-dialog': componentRadius.dialog,
  '--radius-full': radius.full,
};
