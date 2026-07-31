// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/ui
// Design System Implementation v1.0
// Follows DES-001 Constitution, DES-010A Experience Bible
// Implements BLD-003 Design System Implementation
// ──────────────────────────────────────────────────────────────────

// ── Design Tokens ──────────────────────────────────────────────────────────

export {
  tokens,
  brand,
  neutral,
  semantic,
  premium,
  surface,
  ai,
  dark,
  secondaryBlue,
  shadows as colorShadows,
  gradients,
  fontFamily,
  fontWeight,
  desktopTypeScale,
  mobileTypeScale,
  fluidType,
  spacing,
  space,
  radius,
  componentRadius,
  shadows as elevationShadows,
  elevation,
  duration,
  easing,
  easingCSS,
  variants,
  transitions,
  breakpoints,
  mediaQuery,
  maxWidth,
  grid,
  zIndex,
} from './tokens/index.js';

export type { Tokens, TypeScaleToken, FontWeightToken } from './tokens/index.js';
export type { ElevationLevel, RadiusToken } from './tokens/elevation.js';
export type { DurationToken, EasingToken } from './tokens/motion.js';
export type { BreakpointToken, MediaQueryToken, ZIndexToken } from './tokens/breakpoints.js';

// ── Theme System ───────────────────────────────────────────────────────────

export { ThemeProvider, useTheme } from './theme/index.js';
export type { Theme, ThemeProviderProps } from './theme/index.js';

// ── Utilities ──────────────────────────────────────────────────────────────

export { cn } from './utilities/cn.js';
export {
  focusRing,
  interactiveClass,
  ariaLabel,
  ariaToggle,
  SkipLink,
  VisuallyHidden,
} from './utilities/accessibility.js';
export {
  responsive,
  colSpan,
  hideOnMobile,
  showOnMobile,
  containerStyles,
  sectionPadding,
} from './utilities/responsive.js';
export {
  createTransition,
  fadeIn,
  fadeInUp,
  fadeInScale,
  slideIn,
  staggerContainer,
  prefersReducedMotion,
  respectfulTransition,
} from './utilities/animation.js';

// ── Components — Button ────────────────────────────────────────────────────

export {
  Button,
  buttonVariants,
  IconButton,
  iconButtonVariants,
} from './components/button/index.js';
export type { ButtonProps, IconButtonProps } from './components/button/index.js';

// ── Components — Input ─────────────────────────────────────────────────────

export {
  TextField,
  Textarea,
  Select,
  Checkbox,
  RadioGroup,
  Switch,
} from './components/input/index.js';
export type {
  TextFieldProps,
  TextareaProps,
  SelectProps,
  SelectOption,
  CheckboxProps,
  RadioGroupProps,
  RadioOption,
  SwitchProps,
} from './components/input/index.js';

// ── Components — Card ──────────────────────────────────────────────────────

export {
  Card,
  cardVariants,
  AICard,
  KnowledgeCard,
  MemoryCard,
  CareerCard,
  BusinessCard,
  MarketplaceCard,
  LifeOSCard,
} from './components/card/index.js';
export type {
  CardProps,
  AICardProps,
  KnowledgeCardProps,
  MemoryCardProps,
  CareerCardProps,
  BusinessCardProps,
  MarketplaceCardProps,
  LifeOSCardProps,
} from './components/card/index.js';

// ── Components — Overlay ───────────────────────────────────────────────────

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Drawer,
  DrawerTrigger,
  DrawerOverlay,
  DrawerContent,
  BottomSheet,
  BottomSheetTrigger,
  BottomSheetOverlay,
  BottomSheetContent,
  ToastProvider,
  ToastViewport,
  useToast,
  Snackbar,
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from './components/overlay/index.js';
export type {
  DialogContentProps,
  DrawerContentProps,
  BottomSheetContentProps,
  SnackbarProps,
} from './components/overlay/index.js';

// ── Components — Navigation ────────────────────────────────────────────────

export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  NavBar,
  Sidebar,
  Breadcrumb,
  Search,
} from './components/navigation/index.js';
export type {
  NavBarProps,
  SidebarProps,
  SidebarItem,
  SidebarGroup,
  BreadcrumbProps,
  BreadcrumbItem,
  SearchProps,
} from './components/navigation/index.js';

// ── Components — Display ───────────────────────────────────────────────────

export {
  Badge,
  badgeVariants,
  Avatar,
  Progress,
  Loading,
  Skeleton,
  Divider,
} from './components/display/index.js';
export type {
  BadgeProps,
  AvatarProps,
  ProgressProps,
  LoadingProps,
  SkeletonProps,
  DividerProps,
} from './components/display/index.js';

// ── Components — State ─────────────────────────────────────────────────────

export { EmptyState, ErrorState, OfflineState, SuccessState } from './components/state/index.js';
export type {
  EmptyStateProps,
  ErrorStateProps,
  OfflineStateProps,
  SuccessStateProps,
} from './components/state/index.js';
