// ──────────────────────────────────────────────────────────────────
// VedMoulya — Design Token: Typography
// Follows DES-001 Constitution v1.0, DES-010A Experience Bible v1.0
// Fonts: Satoshi (headings), Inter (body), JetBrains Mono (code)
// ──────────────────────────────────────────────────────────────────

// ── Font Families ──────────────────────────────────────────────────────────

export const fontFamily = {
  heading: "'Satoshi', 'Inter', system-ui, sans-serif",
  body: "'Inter', system-ui, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
} as const;

// ── Font Weights ───────────────────────────────────────────────────────────

export const fontWeight = {
  light: 300,
  regular: 400,
  medium: 500,
  semiBold: 600,
  bold: 700,
  black: 900,
} as const;

// ── Desktop Type Scale ─────────────────────────────────────────────────────

export const desktopTypeScale = {
  display: { size: 56, lineHeight: 68, weight: 700, letterSpacing: '-0.02em' },
  hero: { size: 48, lineHeight: 58, weight: 700, letterSpacing: '-0.02em' },
  h1: { size: 40, lineHeight: 50, weight: 600, letterSpacing: '-0.015em' },
  h2: { size: 32, lineHeight: 42, weight: 600, letterSpacing: '-0.01em' },
  h3: { size: 28, lineHeight: 38, weight: 600, letterSpacing: '0em' },
  h4: { size: 24, lineHeight: 34, weight: 500, letterSpacing: '0em' },
  section: { size: 20, lineHeight: 28, weight: 600, letterSpacing: '0em' },
  body: { size: 16, lineHeight: 26, weight: 400, letterSpacing: '0em' },
  caption: { size: 14, lineHeight: 20, weight: 500, letterSpacing: '0.02em' },
  tiny: { size: 12, lineHeight: 16, weight: 400, letterSpacing: '0em' },
  button: { size: 14, lineHeight: 20, weight: 500, letterSpacing: '0.02em' },
  label: { size: 14, lineHeight: 18, weight: 500, letterSpacing: '0.02em' },
  input: { size: 16, lineHeight: 24, weight: 400, letterSpacing: '0em' },
  overline: { size: 12, lineHeight: 16, weight: 600, letterSpacing: '0.08em' },
} as const;

// ── Mobile Type Scale ──────────────────────────────────────────────────────

export const mobileTypeScale = {
  display: { size: 36, lineHeight: 44, weight: 700, letterSpacing: '-0.02em' },
  hero: { size: 32, lineHeight: 40, weight: 700, letterSpacing: '-0.02em' },
  h1: { size: 28, lineHeight: 36, weight: 600, letterSpacing: '-0.015em' },
  h2: { size: 24, lineHeight: 32, weight: 600, letterSpacing: '-0.01em' },
  h3: { size: 22, lineHeight: 30, weight: 600, letterSpacing: '0em' },
  h4: { size: 20, lineHeight: 28, weight: 500, letterSpacing: '0em' },
  section: { size: 18, lineHeight: 26, weight: 600, letterSpacing: '0em' },
  body: { size: 16, lineHeight: 24, weight: 400, letterSpacing: '0em' },
  caption: { size: 14, lineHeight: 20, weight: 500, letterSpacing: '0.02em' },
  tiny: { size: 12, lineHeight: 16, weight: 400, letterSpacing: '0em' },
  button: { size: 14, lineHeight: 20, weight: 500, letterSpacing: '0.02em' },
} as const;

// ── Fluid Typography (clamp values) ────────────────────────────────────────

export const fluidType = {
  display: 'clamp(2.25rem, 4vw, 3.5rem)',
  hero: 'clamp(2rem, 3.5vw, 3rem)',
  h1: 'clamp(1.75rem, 3vw, 2.5rem)',
  h2: 'clamp(1.5rem, 2.5vw, 2rem)',
  h3: 'clamp(1.375rem, 2vw, 1.75rem)',
  body: 'clamp(1rem, 1vw, 1rem)', // 16px — never below
} as const;

// ── Typography Utility Types ───────────────────────────────────────────────

export type TypeScaleToken = keyof typeof desktopTypeScale;
export type FontWeightToken = keyof typeof fontWeight;

// ── CSS Variable Map for Typography ────────────────────────────────────────

export const typographyCSSVars = {
  '--font-heading': fontFamily.heading,
  '--font-body': fontFamily.body,
  '--font-mono': fontFamily.mono,
} as const;
