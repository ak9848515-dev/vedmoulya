// ──────────────────────────────────────────────────────────────────
// VedMoulya — Design Tokens Tests
// Covers: colors, typography, spacing, elevation, motion, breakpoints
// and the consolidated `tokens` object
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  brand,
  secondaryBlue,
  neutral,
  semantic,
  premium,
  surface,
  ai,
  dark,
  shadows,
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
import {
  spacing,
  space,
  responsivePadding,
  cardSpacing,
  dialogSpacing,
  formSpacing,
  navSpacing,
  sectionSpacing,
  spacingCSSVars,
} from './spacing.js';
import { radius, componentRadius, elevation, radiusCSSVars } from './elevation.js';
import { duration, easing, easingCSS, variants, transitions, motionCSSVars } from './motion.js';
import { breakpoints, mediaQuery, maxWidth, grid, zIndex, layoutCSSVars } from './breakpoints.js';
import { tokens } from './index.js';

// ── Colors ────────────────────────────────────────────────────────────────

describe('colors', () => {
  it('exposes the full brand palette', () => {
    expect(brand.primary['600']).toBe('#2B5FD9');
    expect(brand.primary['900']).toBe('#1A3D8F');
    expect(brand.secondary['500']).toBe('#1EB4B8');
    expect(brand.accent['600']).toBe('#FF6B5B');
  });

  it('exposes secondary blue and neutral scales', () => {
    expect(secondaryBlue['600']).toBe('#5B8DEF');
    expect(neutral['900']).toBe('#111827');
    expect(neutral['50']).toBe('#F5F7FA');
  });

  it('exposes semantic, premium, surface and ai colors', () => {
    expect(semantic.success).toBe('#22C55E');
    expect(semantic.danger).toBe('#EF4444');
    expect(premium.gold).toBe('#C89B3C');
    expect(surface.page).toBe('#F5F7FA');
    expect(surface.overlay).toBe('rgba(15, 23, 42, 0.5)');
    expect(ai.primary).toBe('#7C3AED');
    expect(ai.glow).toBe('rgba(124, 58, 237, 0.15)');
  });

  it('exposes dark mode palette with matching surface', () => {
    expect(dark.surface.page).toBe('#0F172A');
    expect(dark.surface.card).toBe('#1E293B');
    expect(dark.brand.primary).toBe('#6B8FEF');
    expect(dark.neutral['900']).toBe('#F8FAFC');
  });

  it('exposes shadows and gradients', () => {
    expect(shadows.standard).toContain('0 8px 30px');
    expect(shadows['5']).toContain('0 20px 25px');
    expect(gradients.primary).toContain('#2B5FD9');
    expect(gradients.ai).toContain('#7C3AED');
  });
});

// ── Typography ────────────────────────────────────────────────────────────

describe('typography', () => {
  it('exposes font families and weights', () => {
    expect(fontFamily.heading).toContain('Satoshi');
    expect(fontFamily.body).toContain('Inter');
    expect(fontFamily.mono).toContain('JetBrains Mono');
    expect(fontWeight.semiBold).toBe(600);
    expect(fontWeight.black).toBe(900);
  });

  it('exposes desktop and mobile type scales', () => {
    expect(desktopTypeScale.h1.size).toBe(40);
    expect(desktopTypeScale.h1.weight).toBe(600);
    expect(desktopTypeScale.body.size).toBe(16);
    expect(mobileTypeScale.display.size).toBe(36);
    expect(mobileTypeScale.h4.size).toBe(20);
  });

  it('exposes fluid type and CSS vars', () => {
    expect(fluidType.display).toContain('clamp(');
    expect(fluidType.body).toBe('clamp(1rem, 1vw, 1rem)');
    expect(typographyCSSVars['--font-heading']).toBe(fontFamily.heading);
    expect(typographyCSSVars['--font-mono']).toBe(fontFamily.mono);
  });
});

// ── Spacing ───────────────────────────────────────────────────────────────

describe('spacing', () => {
  it('exposes the 4px base scale', () => {
    expect(spacing['0']).toBe('0px');
    expect(spacing['1']).toBe('4px');
    expect(spacing['4']).toBe('16px');
    expect(spacing['12']).toBe('96px');
  });

  it('exposes semantic aliases', () => {
    expect(space.micro).toBe('4px');
    expect(space.base).toBe('16px');
    expect(space.section).toBe('32px');
    expect(space.hero).toBe('96px');
  });

  it('exposes responsive, card, dialog, form, nav and section spacing', () => {
    expect(responsivePadding.mobile).toBe('16px');
    expect(cardSpacing.padding.desktop).toBe('24px');
    expect(cardSpacing.gap).toBe('16px');
    expect(dialogSpacing.padding).toBe('40px');
    expect(formSpacing.fieldGap).toBe('24px');
    expect(navSpacing.sidebarWidth).toBe('280px');
    expect(navSpacing.headerHeight).toBe('64px');
    expect(sectionSpacing.betweenSections.desktop).toBe('64px');
  });

  it('generates CSS variable map from the scale', () => {
    expect(spacingCSSVars['--space-4']).toBe('16px');
    expect(spacingCSSVars['--space-12']).toBe('96px');
    expect(Object.keys(spacingCSSVars).length).toBe(Object.keys(spacing).length);
  });
});

// ── Elevation & Radius ────────────────────────────────────────────────────

describe('elevation', () => {
  it('exposes radius tokens', () => {
    expect(radius.sm).toBe('4px');
    expect(radius.xl).toBe('24px');
    expect(radius.xxl).toBe('28px');
    expect(radius.button).toBe('14px');
    expect(radius.full).toBe('9999px');
  });

  it('exposes component radius', () => {
    expect(componentRadius.card).toBe('24px');
    expect(componentRadius.dialog).toBe('28px');
    expect(componentRadius.badge).toBe('9999px');
  });

  it('exposes elevation levels with shadows and z-index', () => {
    expect(elevation.flat.shadow).toBe('none');
    expect(elevation.modal.zIndex).toBe(100);
    expect(elevation.toast.zIndex).toBe(200);
    expect(elevation.elevated.shadow).toContain('0 4px 6px');
  });

  it('maps radius CSS vars', () => {
    expect(radiusCSSVars['--radius-xl']).toBe('24px');
    expect(radiusCSSVars['--radius-card']).toBe('24px');
    expect(radiusCSSVars['--radius-dialog']).toBe('28px');
  });
});

// ── Motion ────────────────────────────────────────────────────────────────

describe('motion', () => {
  it('exposes duration scale', () => {
    expect(duration.instant).toBe(0);
    expect(duration.fast).toBe(150);
    expect(duration.normal).toBe(250);
    expect(duration.slowest).toBe(700);
  });

  it('exposes easing curves and CSS strings', () => {
    expect(easing.easeOut).toEqual([0.16, 1, 0.3, 1]);
    expect(easing.spring).toEqual({ stiffness: 300, damping: 30, mass: 1 });
    expect(easingCSS.easeOut).toBe('cubic-bezier(0.16, 1, 0.3, 1)');
  });

  it('exposes framer-motion variants', () => {
    expect(variants.fadeIn.initial).toEqual({ opacity: 0 });
    expect(variants.fadeInUp.initial).toEqual({ opacity: 0, y: 20 });
    expect(variants.slideInRight.initial).toEqual({ x: '100%' });
    expect(variants.stagger.animate.transition.staggerChildren).toBe(0.05);
    expect(variants.hoverLift.tap).toEqual({ y: -1, scale: 0.99 });
  });

  it('exposes transition presets and CSS vars', () => {
    expect(transitions.default).toContain('250ms');
    expect(transitions.fast).toContain('150ms');
    expect(transitions.color).toContain('background-color');
    expect(motionCSSVars['--duration-fast']).toBe('150ms');
    expect(motionCSSVars['--ease-out']).toBe(easingCSS.easeOut);
  });
});

// ── Breakpoints ───────────────────────────────────────────────────────────

describe('breakpoints', () => {
  it('exposes numeric breakpoints', () => {
    expect(breakpoints.mobileS).toBe(375);
    expect(breakpoints.mobile).toBe(768);
    expect(breakpoints.tablet).toBe(1024);
    expect(breakpoints.desktop).toBe(1440);
    expect(breakpoints.ultraWide).toBe(1921);
  });

  it('exposes media query strings', () => {
    expect(mediaQuery.mobileS).toBe('@media (max-width: 374px)');
    expect(mediaQuery.mobileUp).toBe('@media (max-width: 767px)');
    expect(mediaQuery.tabletUp).toBe('@media (min-width: 768px)');
    expect(mediaQuery.desktopUp).toBe('@media (min-width: 1024px)');
    expect(mediaQuery.reducedMotion).toBe('@media (prefers-reduced-motion: reduce)');
    expect(mediaQuery.prefersDark).toBe('@media (prefers-color-scheme: dark)');
  });

  it('exposes max width, grid, and z-index tokens', () => {
    expect(maxWidth.content).toBe('1280px');
    expect(grid.columns.desktop).toBe(12);
    expect(grid.gutter.mobile).toBe('16px');
    expect(zIndex.modal).toBe(110);
    expect(zIndex.tooltip).toBe(300);
  });

  it('exposes layout CSS vars', () => {
    expect(layoutCSSVars['--max-content-width']).toBe('1280px');
    expect(layoutCSSVars['--sidebar-width']).toBe('280px');
    expect(layoutCSSVars['--header-height']).toBe('64px');
  });
});

// ── Consolidated tokens object ────────────────────────────────────────────

describe('tokens (consolidated)', () => {
  it('aggregates every token group', () => {
    expect(tokens.brand.primary['600']).toBe('#2B5FD9');
    expect(tokens.neutral['50']).toBe('#F5F7FA');
    expect(tokens.semantic.success).toBe('#22C55E');
    expect(tokens.premium.gold).toBe('#C89B3C');
    expect(tokens.surface.page).toBe('#F5F7FA');
    expect(tokens.ai.primary).toBe('#7C3AED');
    expect(tokens.dark.surface.card).toBe('#1E293B');
    expect(tokens.secondaryBlue['600']).toBe('#5B8DEF');
    expect(tokens.colorShadows.standard).toContain('0 8px 30px');
    expect(tokens.gradients.warm).toContain('#FF6B5B');

    expect(tokens.fontFamily.heading).toContain('Satoshi');
    expect(tokens.fontWeight.bold).toBe(700);
    expect(tokens.desktopTypeScale.h2.size).toBe(32);
    expect(tokens.mobileTypeScale.body.size).toBe(16);
    expect(tokens.fluidType.h1).toContain('clamp(');
    expect(tokens.typographyCSSVars['--font-body']).toContain('Inter');

    expect(tokens.spacing['6']).toBe('24px');
    expect(tokens.space.component).toBe('24px');
    expect(tokens.spacingCSSVars['--space-2']).toBe('8px');

    expect(tokens.radius.xxl).toBe('28px');
    expect(tokens.componentRadius.dialog).toBe('28px');
    expect(tokens.elevationShadows.level5).toContain('0 20px 25px');
    expect(tokens.elevation.modal.zIndex).toBe(100);
    expect(tokens.radiusCSSVars['--radius-lg']).toBe('16px');

    expect(tokens.duration.normal).toBe(250);
    expect(tokens.easing.easeOut).toEqual([0.16, 1, 0.3, 1]);
    expect(tokens.easingCSS.easeInOut).toBe('cubic-bezier(0.65, 0, 0.35, 1)');
    expect(tokens.variants.fadeIn.initial).toEqual({ opacity: 0 });
    expect(tokens.transitions.slow).toContain('350ms');
    expect(tokens.motionCSSVars['--duration-slow']).toBe('350ms');

    expect(tokens.breakpoints.desktop).toBe(1440);
    expect(tokens.mediaQuery.desktopUp).toBe('@media (min-width: 1024px)');
    expect(tokens.maxWidth.wide).toBe('1536px');
    expect(tokens.grid.columns.tablet).toBe(8);
    expect(tokens.zIndex.toast).toBe(200);
    expect(tokens.layoutCSSVars['--max-wide-width']).toBe('1536px');
  });
});
