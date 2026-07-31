// ──────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Configuration Service
// Configuration management for the Dashboard Experience Platform
// BLD-010 — Dashboard Experience Platform
// ──────────────────────────────────────────────────────────────────

import type {
  DashboardConfigDTO,
  PersonalizationConfigDTO,
  WidgetStateDTO,
} from './DashboardDTO.js';

const DEFAULT_WIDGET_STATES: Record<string, WidgetStateDTO> = {
  identity: {
    id: 'identity',
    isVisible: true,
    isCollapsed: false,
    order: 0,
    size: 'small',
    refreshInterval: 300_000,
  },
  focus: {
    id: 'focus',
    isVisible: true,
    isCollapsed: false,
    order: 1,
    size: 'medium',
    refreshInterval: 60_000,
  },
  execution: {
    id: 'execution',
    isVisible: true,
    isCollapsed: false,
    order: 2,
    size: 'large',
    refreshInterval: 30_000,
  },
  decisions: {
    id: 'decisions',
    isVisible: true,
    isCollapsed: false,
    order: 3,
    size: 'medium',
    refreshInterval: 120_000,
  },
  memory: {
    id: 'memory',
    isVisible: true,
    isCollapsed: false,
    order: 4,
    size: 'medium',
    refreshInterval: 300_000,
  },
  knowledge: {
    id: 'knowledge',
    isVisible: true,
    isCollapsed: false,
    order: 5,
    size: 'small',
    refreshInterval: 300_000,
  },
  growth: {
    id: 'growth',
    isVisible: true,
    isCollapsed: false,
    order: 6,
    size: 'large',
    refreshInterval: 300_000,
  },
  journey: {
    id: 'journey',
    isVisible: true,
    isCollapsed: false,
    order: 7,
    size: 'medium',
    refreshInterval: 60_000,
  },
  timeline: {
    id: 'timeline',
    isVisible: true,
    isCollapsed: false,
    order: 8,
    size: 'medium',
    refreshInterval: 300_000,
  },
  insights: {
    id: 'insights',
    isVisible: true,
    isCollapsed: false,
    order: 9,
    size: 'medium',
    refreshInterval: 300_000,
  },
  recommendations: {
    id: 'recommendations',
    isVisible: true,
    isCollapsed: false,
    order: 10,
    size: 'medium',
    refreshInterval: 300_000,
  },
  notifications: {
    id: 'notifications',
    isVisible: true,
    isCollapsed: false,
    order: 11,
    size: 'small',
    refreshInterval: 60_000,
  },
  quickActions: {
    id: 'quickActions',
    isVisible: true,
    isCollapsed: false,
    order: 12,
    size: 'small',
    refreshInterval: 300_000,
  },
  health: {
    id: 'health',
    isVisible: true,
    isCollapsed: false,
    order: 13,
    size: 'small',
    refreshInterval: 60_000,
  },
  metrics: {
    id: 'metrics',
    isVisible: true,
    isCollapsed: false,
    order: 14,
    size: 'small',
    refreshInterval: 60_000,
  },
};

const DEFAULT_PERSONALIZATION: PersonalizationConfigDTO = {
  greetingStyle: 'motivational',
  showMetrics: true,
  showAICompanion: true,
  insightFrequency: 'medium',
  notificationPreferences: ['info', 'warning', 'reminder'],
  favoriteSections: ['focus', 'execution', 'journey'],
};

export class DashboardConfigurationService {
  private readonly configs = new Map<string, DashboardConfigDTO>();

  /** Get configuration for a user */
  getConfig(userId: string): DashboardConfigDTO {
    const existing = this.configs.get(userId);
    if (existing) return existing;

    const config = this.createDefaultConfig(userId);
    this.configs.set(userId, config);
    return config;
  }

  /** Update configuration for a user */
  updateConfig(userId: string, updates: Partial<DashboardConfigDTO>): DashboardConfigDTO {
    const current = this.getConfig(userId);
    const updated: DashboardConfigDTO = { ...current, ...updates };
    this.configs.set(userId, updated);
    return updated;
  }

  /** Update widget state for a user */
  updateWidgetState(
    userId: string,
    widgetId: string,
    state: Partial<WidgetStateDTO>,
  ): WidgetStateDTO {
    const config = this.getConfig(userId);
    const current = config.widgets[widgetId] ?? DEFAULT_WIDGET_STATES[widgetId];
    if (!current) throw new Error(`Unknown widget: ${widgetId}`);
    const updated: WidgetStateDTO = { ...current, ...state };
    config.widgets[widgetId] = updated;
    return updated;
  }

  /** Update personalization for a user */
  updatePersonalization(
    userId: string,
    updates: Partial<PersonalizationConfigDTO>,
  ): PersonalizationConfigDTO {
    const config = this.getConfig(userId);
    const updated: PersonalizationConfigDTO = { ...config.personalization, ...updates };
    config.personalization = updated;
    return updated;
  }

  /** Reset configuration to defaults */
  resetConfig(userId: string): DashboardConfigDTO {
    const config = this.createDefaultConfig(userId);
    this.configs.set(userId, config);
    return config;
  }

  /** Toggle a section's visibility */
  toggleSection(userId: string, sectionId: string): boolean {
    const config = this.getConfig(userId);
    const widget = config.widgets[sectionId];
    if (!widget) return false;
    widget.isVisible = !widget.isVisible;
    return widget.isVisible;
  }

  /** Toggle a section's collapsed state */
  toggleCollapsed(userId: string, sectionId: string): boolean {
    const config = this.getConfig(userId);
    const widget = config.widgets[sectionId];
    if (!widget) return false;
    widget.isCollapsed = !widget.isCollapsed;
    return widget.isCollapsed;
  }

  /** Pin a section */
  pinSection(userId: string, sectionId: string): boolean {
    const config = this.getConfig(userId);
    if (!config.pinnedSections.includes(sectionId)) {
      config.pinnedSections.push(sectionId);
      return true;
    }
    return false;
  }

  /** Unpin a section */
  unpinSection(userId: string, sectionId: string): boolean {
    const config = this.getConfig(userId);
    const index = config.pinnedSections.indexOf(sectionId);
    if (index >= 0) {
      config.pinnedSections.splice(index, 1);
      return true;
    }
    return false;
  }

  private createDefaultConfig(userId: string): DashboardConfigDTO {
    return {
      userId,
      layout: Object.values(DEFAULT_WIDGET_STATES)
        .sort((a, b) => a.order - b.order)
        .map((w) => ({ section: w.id, order: w.order, size: w.size })),
      widgets: { ...DEFAULT_WIDGET_STATES },
      theme: 'system',
      refreshInterval: 60_000,
      pinnedSections: ['focus', 'execution'],
      collapsedSections: [],
      personalization: { ...DEFAULT_PERSONALIZATION },
    };
  }
}
