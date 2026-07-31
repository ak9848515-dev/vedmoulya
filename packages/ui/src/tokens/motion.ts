// ──────────────────────────────────────────────────────────────────
// VedMoulya — Design Token: Motion
// Follows DES-001 Constitution v1.0, DES-010A Experience Bible v1.0
// Apple-quality: 200-300ms standard range. Ease-out preferred.
// ──────────────────────────────────────────────────────────────────

// ── Duration Scale (in milliseconds) ───────────────────────────────────────

export const duration = {
  instant: 0, // State changes with no visible transition
  fast: 150, // Hover states, micro-interactions
  normal: 250, // Standard transitions ← Constitution v1.0 default
  slow: 350, // Element movement (cards, modals entering)
  slower: 500, // Page transitions, complex animations
  slowest: 700, // Hero animations, celebratory moments
  delay: 900, // Purposeful pauses (AI thinking indicator)
} as const;

// ── Easing Curves ──────────────────────────────────────────────────────────

export const easing = {
  easeOut: [0.16, 1, 0.3, 1] as const, // ★ Constitution v1.0 PREFERRED
  easeInOut: [0.65, 0, 0.35, 1] as const,
  easeIn: [0.4, 0, 0.6, 1] as const,
  spring: { stiffness: 300, damping: 30, mass: 1 } as const,
} as const;

// ── CSS Easing Strings ─────────────────────────────────────────────────────

export const easingCSS = {
  easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
  easeInOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  easeIn: 'cubic-bezier(0.4, 0, 0.6, 1)',
} as const;

// ── Framer Motion Variants ─────────────────────────────────────────────────

export const variants = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: duration.normal / 1000, ease: easing.easeOut },
  },
  fadeInUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
    transition: { duration: duration.normal / 1000, ease: easing.easeOut },
  },
  fadeInScale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { duration: duration.normal / 1000, ease: easing.easeOut },
  },
  slideInRight: {
    initial: { x: '100%' },
    animate: { x: 0 },
    exit: { x: '100%' },
    transition: { duration: duration.slow / 1000, ease: easing.easeOut },
  },
  slideInLeft: {
    initial: { x: '-100%' },
    animate: { x: 0 },
    exit: { x: '-100%' },
    transition: { duration: duration.slow / 1000, ease: easing.easeOut },
  },
  slideInDown: {
    initial: { y: -20, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: -10, opacity: 0 },
    transition: { duration: duration.fast / 1000, ease: easing.easeOut },
  },
  stagger: {
    animate: {
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
  },
  staggerItem: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: duration.normal / 1000, ease: easing.easeOut },
  },
  hoverLift: {
    rest: { y: 0, boxShadow: '0 8px 30px rgba(15, 23, 42, 0.06)' },
    hover: {
      y: -2,
      boxShadow: '0 4px 6px rgba(15, 23, 42, 0.06), 0 2px 4px rgba(15, 23, 42, 0.04)',
    },
    tap: { y: -1, scale: 0.99 },
  },
} as const;

// ── Transition Presets ─────────────────────────────────────────────────────

export const transitions = {
  default: `all ${String(duration.normal)}ms ${easingCSS.easeOut}`,
  fast: `all ${String(duration.fast)}ms ${easingCSS.easeOut}`,
  slow: `all ${String(duration.slow)}ms ${easingCSS.easeOut}`,
  color: `background-color ${String(duration.fast)}ms ${easingCSS.easeOut}, color ${String(duration.fast)}ms ${easingCSS.easeOut}`,
  shadow: `box-shadow ${String(duration.normal)}ms ${easingCSS.easeOut}`,
  transform: `transform ${String(duration.normal)}ms ${easingCSS.easeOut}`,
} as const;

// ── Motion Tokens Type ─────────────────────────────────────────────────────

export type DurationToken = keyof typeof duration;
export type EasingToken = keyof typeof easing;

// ── CSS Variable Map ───────────────────────────────────────────────────────

export const motionCSSVars = {
  '--duration-fast': `${String(duration.fast)}ms`,
  '--duration-normal': `${String(duration.normal)}ms`,
  '--duration-slow': `${String(duration.slow)}ms`,
  '--ease-out': easingCSS.easeOut,
  '--ease-in-out': easingCSS.easeInOut,
  '--ease-in': easingCSS.easeIn,
} as const;
