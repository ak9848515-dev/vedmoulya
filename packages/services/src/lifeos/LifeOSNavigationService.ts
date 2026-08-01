/* eslint-disable security/detect-object-injection -- Heuristic rule
   false-positive: dynamic member access here uses typed/closed-union keys,
   constant environment names, or fixed internal lists — never
   attacker-controlled property names. */
// ──────────────────────────────────────────────────────────────────
// VedMoulya — Life OS Navigation Service
// BLD-015 — Life OS Integration & Unified Experience
// ──────────────────────────────────────────────────────────────────

import type { LifeOSModule } from './LifeOSDTO.js';

export interface NavigationItem {
  module: LifeOSModule;
  label: string;
  icon: string;
  route: string;
  priority: number;
  badge?: number;
}

export class LifeOSNavigationService {
  private readonly modules: Map<
    LifeOSModule,
    { label: string; icon: string; route: string; priority: number }
  >;

  constructor() {
    this.modules = new Map([
      [
        'dashboard',
        { label: 'Dashboard', icon: 'layout-dashboard', route: '/dashboard', priority: 1 },
      ],
      ['career', { label: 'Career', icon: 'briefcase', route: '/career', priority: 2 }],
      ['learning', { label: 'Learning', icon: 'book-open', route: '/learning', priority: 3 }],
      ['business', { label: 'Business', icon: 'building', route: '/business', priority: 4 }],
      [
        'marketplace',
        { label: 'Marketplace', icon: 'shopping-bag', route: '/marketplace', priority: 5 },
      ],
    ]);
  }

  getNavigation(badges?: Partial<Record<LifeOSModule, number>>): NavigationItem[] {
    return Array.from(this.modules.entries())
      .map(([module, info]) => ({
        module,
        ...info,
        badge: badges?.[module],
      }))
      .sort((a, b) => a.priority - b.priority);
  }

  getPrimaryNavigation(): NavigationItem[] {
    return this.getNavigation().slice(0, 3);
  }

  getModuleRoute(module: LifeOSModule): string | undefined {
    return this.modules.get(module)?.route;
  }

  getModuleLabel(module: LifeOSModule): string | undefined {
    return this.modules.get(module)?.label;
  }
}
