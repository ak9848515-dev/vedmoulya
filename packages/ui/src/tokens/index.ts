// ──────────────────────────────────────────────────────────────────
// VedMoulya — Design Tokens
// Follows DES-001 Constitution v1.0, DES-010A Experience Bible v1.0
// ──────────────────────────────────────────────────────────────────

export * from './colors.js';
export * from './typography.js';
export * from './spacing.js';
export { radius, componentRadius, elevation, radiusCSSVars } from './elevation.js';
export type { ElevationLevel, RadiusToken } from './elevation.js';
export * from './motion.js';
export * from './breakpoints.js';

// ── Consolidated tokens object ─────────────────────────────────────────────

import {
  brand,
  neutral,
  semantic,
  premium,
  surface,
  ai,
  dark,
  secondaryBlue,
  shadows as colorShadowsToken,
  gradients,
} from './colors.js';
import {
  fontFamily,
  fontWeight,
  desktopTypeScale,
  mobileTypeScale,
  fluidType,
  typographyCSSVars,
} from './typography.js';
import { spacing, space, spacingCSSVars } from './spacing.js';
import {
  radius,
  componentRadius,
  shadows as elevationShadows,
  elevation,
  radiusCSSVars,
} from './elevation.js';
import { duration, easing, easingCSS, variants, transitions, motionCSSVars } from './motion.js';
import { breakpoints, mediaQuery, maxWidth, grid, zIndex, layoutCSSVars } from './breakpoints.js';

export const tokens = {
  brand,
  neutral,
  semantic,
  premium,
  surface,
  ai,
  dark,
  secondaryBlue,
  colorShadows: colorShadowsToken,
  gradients,
  fontFamily,
  fontWeight,
  desktopTypeScale,
  mobileTypeScale,
  fluidType,
  typographyCSSVars,
  spacing,
  space,
  spacingCSSVars,
  radius,
  componentRadius,
  elevationShadows,
  elevation,
  radiusCSSVars,
  duration,
  easing,
  easingCSS,
  variants,
  transitions,
  motionCSSVars,
  breakpoints,
  mediaQuery,
  maxWidth,
  grid,
  zIndex,
  layoutCSSVars,
} as const;

export type Tokens = typeof tokens;
