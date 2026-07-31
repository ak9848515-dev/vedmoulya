// ──────────────────────────────────────────────────────────────────
// VedMoulya — Shared Quick Action DTO
// Shared across all platform modules to prevent type duplication
// BLD-014A — Marketplace Platform Quality Hardening
// ──────────────────────────────────────────────────────────────────

/**
 * QuickActionDTO represents a single quick-action button shown
 * in dashboard-style views across all platform modules.
 *
 * Shared to prevent identical redefinitions in Business, Marketplace,
 * Learning, Career, and other modules.
 */
export interface QuickActionDTO {
  id: string;
  label: string;
  description: string;
  icon: string;
  route: string;
  priority: number;
  category: string;
  isAvailable: boolean;
  disabledReason?: string;
}
