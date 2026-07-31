// ──────────────────────────────────────────────────────────────────
// VedMoulya — Utility barrel exports
// ──────────────────────────────────────────────────────────────────

export { cn } from './cn.js';
export {
  focusRing,
  interactiveClass,
  ariaLabel,
  ariaToggle,
  SkipLink,
  VisuallyHidden,
} from './accessibility.js'; // .tsx file, but imports use .js convention
export {
  responsive,
  colSpan,
  hideOnMobile,
  showOnMobile,
  containerStyles,
  sectionPadding,
} from './responsive.js';
export {
  createTransition,
  fadeIn,
  fadeInUp,
  fadeInScale,
  slideIn,
  staggerContainer,
  prefersReducedMotion,
  respectfulTransition,
} from './animation.js';
