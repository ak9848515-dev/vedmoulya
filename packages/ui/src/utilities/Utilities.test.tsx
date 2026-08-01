// ──────────────────────────────────────────────────────────────────
// VedMoulya — Utilities Tests
// Covers: animation helpers, accessibility helpers, responsive helpers
// ──────────────────────────────────────────────────────────────────

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  focusRing,
  interactiveClass,
  ariaLabel,
  ariaToggle,
  SkipLink,
  VisuallyHidden,
} from './accessibility.js';
import {
  responsive,
  colSpan,
  hideOnMobile,
  showOnMobile,
  containerStyles,
  sectionPadding,
} from './responsive.js';
import {
  createTransition,
  fadeIn,
  fadeInUp,
  fadeInScale,
  slideIn,
  staggerContainer,
  prefersReducedMotion,
  respectfulTransition,
} from './animation.js';
import { duration, easing, easingCSS } from '../tokens/motion.js';

// ── cn / interactiveClass ────────────────────────────────────────────────

describe('cn (via interactiveClass)', () => {
  it('merges focus ring base with custom classes', () => {
    const result = interactiveClass('px-4', 'py-2');
    expect(result).toContain('px-4');
    expect(result).toContain('py-2');
    expect(result).toContain('focus-visible:outline-2');
  });

  it('handles no extra classes', () => {
    expect(interactiveClass()).toContain('focus-visible:outline-2');
  });
});

describe('focusRing', () => {
  it('exposes base, within and none variants', () => {
    expect(focusRing.base).toContain('outline-none');
    expect(focusRing.within).toContain('focus-within');
    expect(focusRing.none).toBe('focus:outline-none');
  });
});

// ── aria helpers ──────────────────────────────────────────────────────────

describe('ariaLabel', () => {
  it('returns full props when all fields provided', () => {
    const props = ariaLabel({ label: 'Close', describedBy: 'hint-1', hidden: true });
    expect(props['aria-label']).toBe('Close');
    expect(props['aria-describedby']).toBe('hint-1');
    expect(props['aria-hidden']).toBe(true);
  });

  it('omits optional fields when not provided', () => {
    const props = ariaLabel({ label: 'Close' });
    expect(props['aria-label']).toBe('Close');
    expect(props['aria-describedby']).toBeUndefined();
    expect(props['aria-hidden']).toBeUndefined();
  });
});

describe('ariaToggle', () => {
  it('creates switch semantics', () => {
    const props = ariaToggle(false, vi.fn(), 'Dark mode');
    expect(props.role).toBe('switch');
    expect(props['aria-checked']).toBe(false);
    expect(props['aria-label']).toBe('Dark mode');
    expect(props.tabIndex).toBe(0);
  });

  it('toggles on click', () => {
    const onChange = vi.fn();
    const props = ariaToggle(false, onChange, 'Toggle');
    (props.onClick as () => void)();
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('toggles on Space and Enter keydown', () => {
    const onChange = vi.fn();
    const preventDefault = vi.fn();
    const props = ariaToggle(true, onChange, 'Toggle');

    (props.onKeyDown as (e: React.KeyboardEvent) => void)({
      key: ' ',
      preventDefault,
    } as unknown as React.KeyboardEvent);
    (props.onKeyDown as (e: React.KeyboardEvent) => void)({
      key: 'Enter',
      preventDefault,
    } as unknown as React.KeyboardEvent);

    // ariaToggle captures the checked param, so both keys call onChange(!checked)
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenNthCalledWith(1, false);
    expect(onChange).toHaveBeenNthCalledWith(2, false);
    expect(preventDefault).toHaveBeenCalledTimes(2);
  });

  it('ignores other keys', () => {
    const onChange = vi.fn();
    const preventDefault = vi.fn();
    const props = ariaToggle(false, onChange, 'Toggle');
    (props.onKeyDown as (e: React.KeyboardEvent) => void)({
      key: 'Tab',
      preventDefault,
    } as unknown as React.KeyboardEvent);
    expect(onChange).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });
});

// ── SkipLink & VisuallyHidden ─────────────────────────────────────────────

describe('SkipLink', () => {
  it('renders with default href', () => {
    render(<SkipLink />);
    const link = screen.getByText('Skip to main content');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '#main-content');
  });

  it('renders with custom href', () => {
    render(<SkipLink href="#content" />);
    expect(screen.getByText('Skip to main content')).toHaveAttribute('href', '#content');
  });
});

describe('VisuallyHidden', () => {
  it('renders children in an sr-only span', () => {
    const { container } = render(<VisuallyHidden>Secret</VisuallyHidden>);
    const span = container.querySelector('span');
    expect(span).toHaveClass('sr-only');
    expect(span?.textContent).toBe('Secret');
  });
});

// ── responsive helpers ────────────────────────────────────────────────────

describe('responsive', () => {
  it('adds breakpoint prefixes for tablet and desktop', () => {
    expect(responsive('px-4', 'px-6', 'px-8')).toBe('px-4 md:px-6 lg:px-8');
  });

  it('omits breakpoint classes when not provided', () => {
    expect(responsive('px-4')).toBe('px-4');
    expect(responsive('px-4', 'px-6')).toBe('px-4 md:px-6');
  });
});

describe('colSpan', () => {
  it('returns unprefixed span for base', () => {
    expect(colSpan(6)).toBe('col-span-6');
  });

  it('prefixes span at a breakpoint', () => {
    expect(colSpan(4, 'lg')).toBe('lg:col-span-4');
  });
});

describe('layout constants', () => {
  it('exposes responsive display constants', () => {
    expect(hideOnMobile).toBe('hidden md:block');
    expect(showOnMobile).toBe('block md:hidden');
    expect(containerStyles).toContain('max-w-[1280px]');
    expect(containerStyles).toContain('md:px-8');
    expect(sectionPadding).toBe('py-8 md:py-10 lg:py-12');
  });
});

// ── animation helpers ─────────────────────────────────────────────────────

describe('createTransition', () => {
  it('uses motion token defaults', () => {
    const t = createTransition();
    expect(t.duration).toBe(duration.normal / 1000);
    expect(t.ease).toEqual([0.16, 1, 0.3, 1]);
    expect(t.delay).toBeUndefined();
  });

  it('converts duration and delay from ms to seconds', () => {
    const t = createTransition(500, easing.easeIn, 200);
    expect(t.duration).toBe(0.5);
    expect(t.ease).toEqual([0.4, 0, 0.6, 1]);
    expect(t.delay).toBe(0.2);
  });
});

describe('variant factories', () => {
  it('fadeIn returns fade variant with transitions', () => {
    const v = fadeIn();
    expect(v.initial).toEqual({ opacity: 0 });
    expect(v.animate).toMatchObject({ opacity: 1 });
    expect(v.exit).toMatchObject({ opacity: 0 });
  });

  it('fadeIn accepts a delay', () => {
    const v = fadeIn(150);
    expect(v.animate).toMatchObject({ opacity: 1 });
    expect((v.animate as { transition?: { delay?: number } }).transition?.delay).toBe(0.15);
  });

  it('fadeInUp uses y offset and exit shift', () => {
    const v = fadeInUp(40);
    expect(v.initial).toEqual({ opacity: 0, y: 40 });
    expect(v.animate).toMatchObject({ opacity: 1, y: 0 });
    expect(v.exit).toMatchObject({ y: -10 });
  });

  it('fadeInUp defaults y to 20', () => {
    expect(fadeInUp().initial).toEqual({ opacity: 0, y: 20 });
  });

  it('fadeInScale uses from scale and restores on exit', () => {
    const v = fadeInScale(0.8);
    expect(v.initial).toEqual({ opacity: 0, scale: 0.8 });
    expect(v.animate).toMatchObject({ opacity: 1, scale: 1 });
    expect(v.exit).toMatchObject({ scale: 0.8 });
  });

  it('fadeInScale defaults from to 0.95', () => {
    expect(fadeInScale().initial).toEqual({ opacity: 0, scale: 0.95 });
  });

  it('slideIn handles all four directions', () => {
    expect(slideIn('left').initial).toEqual({ x: '-100%', opacity: 0 });
    expect(slideIn('right').initial).toEqual({ x: '100%', opacity: 0 });
    expect(slideIn('up').initial).toEqual({ y: 20, opacity: 0 });
    expect(slideIn('down').initial).toEqual({ y: -20, opacity: 0 });
    expect(slideIn('left').exit).toMatchObject({ x: '-100%' });
  });

  it('staggerContainer applies stagger and delay in seconds', () => {
    const v = staggerContainer();
    expect(v.animate.transition).toMatchObject({ staggerChildren: 0.05, delayChildren: 0.1 });
    const custom = staggerContainer(100, 200);
    expect(custom.animate.transition).toMatchObject({ staggerChildren: 0.1, delayChildren: 0.2 });
  });
});

// ── reduced motion ────────────────────────────────────────────────────────

function stubMatchMedia(matches: boolean): void {
  const mql = {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mql));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('prefersReducedMotion', () => {
  it('returns true when reduced motion is preferred', () => {
    stubMatchMedia(true);
    expect(prefersReducedMotion()).toBe(true);
  });

  it('returns false when not preferred', () => {
    stubMatchMedia(false);
    expect(prefersReducedMotion()).toBe(false);
  });

  it('returns false when window is undefined', () => {
    vi.stubGlobal('window', undefined);
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe('respectfulTransition', () => {
  it('zeroes the duration when reduced motion is preferred', () => {
    stubMatchMedia(true);
    expect(respectfulTransition(300)).toEqual({ duration: 0 });
  });

  it('falls back to a normal transition otherwise', () => {
    stubMatchMedia(false);
    const t = respectfulTransition(300);
    expect(t.duration).toBe(0.3);
    expect(t.ease).toEqual(easing.easeOut as unknown as [number, number, number, number]);
    expect(t.easingCSS ?? easingCSS.easeOut).toBe(easingCSS.easeOut);
  });
});
