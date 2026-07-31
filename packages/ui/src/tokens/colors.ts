// ──────────────────────────────────────────────────────────────────
// VedMoulya — Design Token: Colors
// Follows DES-001 Constitution v1.0, DES-010A Experience Bible v1.0
// Every color value is frozen. No hardcoded colors in components.
// ──────────────────────────────────────────────────────────────────

// ── Brand Colors ───────────────────────────────────────────────────────────

export const brand = {
  primary: {
    900: '#1A3D8F',
    800: '#1E4AA8',
    700: '#2355BF',
    600: '#2B5FD9', // ★ PRIMARY
    500: '#3B6FE3',
    400: '#5B8AEB',
    300: '#7FA5F2',
    200: '#A8C2F7',
    100: '#D4E1FC',
    50: '#EFF4FE',
  },
  secondary: {
    700: '#0D969A',
    600: '#0EA5A9',
    500: '#1EB4B8',
    400: '#3EC2C5',
    300: '#66D0D3',
    200: '#96E0E2',
    100: '#C5EFF0',
    50: '#E8F8F9',
  },
  accent: {
    700: '#EE5545',
    600: '#FF6B5B', // ★ ACCENT (Coral)
    500: '#FF7D6E',
    400: '#FF9386',
    300: '#FFB0A5',
    200: '#FFCEC7',
    100: '#FFE8E3',
    50: '#FFF4F2',
  },
} as const;

// ── Secondary Blue (Constitution v1.0) ─────────────────────────────────────

export const secondaryBlue = {
  600: '#5B8DEF', // ★ SECONDARY BLUE
  500: '#7BA5F2',
  400: '#9BBBF5',
  300: '#BBD1F8',
  200: '#DBE7FB',
  100: '#EAF2FF', // ★ LIGHT BLUE
} as const;

// ── Neutral Scale (Warm) ───────────────────────────────────────────────────

export const neutral = {
  900: '#111827', // Heading text
  800: '#1F2937', // Body text
  700: '#374151', // Secondary text
  600: '#4B5563', // Placeholder text
  500: '#64748B', // ★ NEUTRAL
  400: '#94A3B8',
  300: '#CBD5E1', // Borders, dividers
  200: '#E2E8F0', // Disabled backgrounds
  100: '#F1F5F9', // Subtle card backgrounds
  50: '#F5F7FA', // ★ PAGE BACKGROUND (Warm Matte Light)
} as const;

// ── Semantic Colors ────────────────────────────────────────────────────────

export const semantic = {
  success: '#22C55E',
  successBg: '#F0FDF4',
  warning: '#F59E0B',
  warningBg: '#FFFBEB',
  danger: '#EF4444',
  dangerBg: '#FEF2F2',
  info: '#3B82F6',
  infoBg: '#EFF6FF',
} as const;

// ── Premium Gold (Limited Use) ─────────────────────────────────────────────

export const premium = {
  gold: '#C89B3C',
  goldLight: '#E8D5A0',
  goldDark: '#9B7630',
} as const;

// ── Surface Colors (Light Mode) ────────────────────────────────────────────

export const surface = {
  page: '#F5F7FA', // Neutral-50
  card: '#FFFFFF', // Pure White
  cardBorder: '#E8EDF5', // Constitution v1.0 card border
  elevated: '#FFFFFF', // With standard shadow
  modal: '#FFFFFF',
  overlay: 'rgba(15, 23, 42, 0.5)',
  glass: 'rgba(255, 255, 255, 0.8)',
} as const;

// ── AI Colors ──────────────────────────────────────────────────────────────

export const ai = {
  primary: '#7C3AED',
  secondary: '#8B5CF6',
  accent: '#A78BFA',
  bg: '#F5F3FF',
  border: '#E9D5FF',
  glow: 'rgba(124, 58, 237, 0.15)',
} as const;

// ── Dark Mode ──────────────────────────────────────────────────────────────

export const dark = {
  brand: {
    primary: '#6B8FEF',
    secondaryBlue: '#7BA5F2',
    lightBlue: '#1E3A5F',
    secondary: '#3EC2C5',
    accent: '#FF8B7D',
  },
  neutral: {
    900: '#F8FAFC',
    800: '#F1F5F9',
    700: '#E2E8F0',
    600: '#CBD5E1',
    500: '#94A3B8',
    400: '#64748B',
    300: '#475569',
    200: '#334155',
    100: '#1E293B',
    50: '#0F172A',
  },
  surface: {
    page: '#0F172A',
    card: '#1E293B',
    cardBorder: '#334155',
    elevated: '#334155',
    modal: '#1E293B',
    overlay: 'rgba(0, 0, 0, 0.7)',
    glass: 'rgba(30, 41, 59, 0.8)',
  },
  semantic: {
    success: '#22C55E',
    successBg: '#052E16',
    warning: '#F59E0B',
    warningBg: '#451A03',
    danger: '#EF4444',
    dangerBg: '#450A0A',
    info: '#3B82F6',
    infoBg: '#1E3A5F',
  },
  premium: {
    gold: '#D4A84B',
    goldDark: '#8B6F2E',
  },
  ai: {
    primary: '#8B5CF6',
    secondary: '#A78BFA',
    accent: '#C4B5FD',
    bg: '#1F1B2E',
    border: '#4C1D95',
    glow: 'rgba(124, 58, 237, 0.25)',
  },
} as const;

// ── Shadow Definitions ─────────────────────────────────────────────────────

export const shadows = {
  standard: '0 8px 30px rgba(15, 23, 42, 0.06)', // Cards
  1: '0 1px 2px rgba(15, 23, 42, 0.05)', // Subtle depth
  2: '0 1px 3px rgba(15, 23, 42, 0.07), 0 1px 2px rgba(15, 23, 42, 0.03)', // Dropdowns
  3: '0 4px 6px rgba(15, 23, 42, 0.06), 0 2px 4px rgba(15, 23, 42, 0.04)', // Dialogs
  4: '0 10px 15px rgba(15, 23, 42, 0.07), 0 4px 6px rgba(15, 23, 42, 0.04)', // Modals
  5: '0 20px 25px rgba(15, 23, 42, 0.09), 0 8px 10px rgba(15, 23, 42, 0.05)', // Toasts
  aiGlow: '0 0 20px rgba(124, 58, 237, 0.15)',
} as const;

// ── Gradients ──────────────────────────────────────────────────────────────

export const gradients = {
  primary: 'linear-gradient(135deg, #2B5FD9, #0EA5A9)',
  warm: 'linear-gradient(135deg, #FF6B5B, #F59E0B)',
  deep: 'linear-gradient(135deg, #1A3D8F, #0A7A7D)',
  ai: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
  glass: 'linear-gradient(135deg, rgba(255,255,255,0.6), rgba(255,255,255,0.2))',
} as const;
