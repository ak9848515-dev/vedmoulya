/* eslint-disable security/detect-object-injection -- Heuristic rule
   false-positive: dynamic member access here uses typed/closed-union keys,
   constant environment names, or fixed internal lists — never
   attacker-controlled property names. */
// ──────────────────────────────────────────────────────────────────
// VedMoulya — Utility: Animation helpers
// Wraps Framer Motion with Design System motion tokens
// Follows DES-001/D09 Motion System, DES-010A/D05 Animation and Motion
// ──────────────────────────────────────────────────────────────────

import { type Variants, type Transition } from 'framer-motion';
import { duration, easing } from '../tokens/motion.js';

// ── Transition Factory ─────────────────────────────────────────────────────

export function createTransition(
  duration$: number = duration.normal,
  ease: readonly number[] = easing.easeOut,
  delay?: number,
): Transition {
  return {
    duration: duration$ / 1000,
    ease: ease as [number, number, number, number],
    delay: delay ? delay / 1000 : undefined,
  };
}

// ── Animation Variant Factories ────────────────────────────────────────────

export function fadeIn(delay?: number): Variants {
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: createTransition(duration.normal, easing.easeOut, delay) },
    exit: { opacity: 0, transition: createTransition(duration.fast, easing.easeIn) },
  };
}

export function fadeInUp(y: number = 20, delay?: number): Variants {
  return {
    initial: { opacity: 0, y },
    animate: {
      opacity: 1,
      y: 0,
      transition: createTransition(duration.normal, easing.easeOut, delay),
    },
    exit: { opacity: 0, y: -10, transition: createTransition(duration.fast, easing.easeIn) },
  };
}

export function fadeInScale(from: number = 0.95, delay?: number): Variants {
  return {
    initial: { opacity: 0, scale: from },
    animate: {
      opacity: 1,
      scale: 1,
      transition: createTransition(duration.normal, easing.easeOut, delay),
    },
    exit: { opacity: 0, scale: from, transition: createTransition(duration.fast, easing.easeIn) },
  };
}

export function slideIn(direction: 'left' | 'right' | 'up' | 'down'): Variants {
  const from = { left: { x: '-100%' }, right: { x: '100%' }, up: { y: 20 }, down: { y: -20 } };
  return {
    initial: { ...from[direction], opacity: 0 },
    animate: {
      x: 0,
      y: 0,
      opacity: 1,
      transition: createTransition(duration.slow, easing.easeOut),
    },
    exit: {
      ...from[direction],
      opacity: 0,
      transition: createTransition(duration.fast, easing.easeIn),
    },
  };
}

export function staggerContainer(staggerMs: number = 50, delayMs: number = 100): Variants {
  return {
    animate: {
      transition: {
        staggerChildren: staggerMs / 1000,
        delayChildren: delayMs / 1000,
      },
    },
  };
}

/**
 * Reduced motion guard — returns true if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Respect reduced motion — sets duration to 0 if reduced motion is preferred
 */
export function respectfulTransition(durationMs: number = duration.normal): Transition {
  if (prefersReducedMotion()) {
    return { duration: 0 };
  }
  return createTransition(durationMs, easing.easeOut);
}
