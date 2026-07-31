import { describe, it, expect } from 'vitest';
import { DashboardConfigurationService } from '../DashboardConfigurationService.js';

describe('DashboardConfigurationService', () => {
  let config: DashboardConfigurationService;

  beforeEach(() => {
    config = new DashboardConfigurationService();
  });

  describe('getConfig', () => {
    it('returns default config for new user', () => {
      const cfg = config.getConfig('user_1');
      expect(cfg.userId).toBe('user_1');
      expect(cfg.theme).toBe('system');
      expect(cfg.widgets).toBeDefined();
      expect(cfg.layout).toHaveLength(15);
      expect(cfg.pinnedSections).toContain('focus');
      expect(cfg.personalization.greetingStyle).toBe('motivational');
    });

    it('returns same config for repeated calls', () => {
      const cfg1 = config.getConfig('user_1');
      const cfg2 = config.getConfig('user_1');
      expect(cfg1).toBe(cfg2);
    });
  });

  describe('updateConfig', () => {
    it('updates existing config', () => {
      const updated = config.updateConfig('user_1', { theme: 'dark' });
      expect(updated.theme).toBe('dark');
      expect(config.getConfig('user_1').theme).toBe('dark');
    });
  });

  describe('updateWidgetState', () => {
    it('updates widget state', () => {
      const state = config.updateWidgetState('user_1', 'focus', { isCollapsed: true });
      expect(state.isCollapsed).toBe(true);
      expect(config.getConfig('user_1').widgets['focus']?.isCollapsed).toBe(true);
    });

    it('throws for unknown widget', () => {
      expect(() => config.updateWidgetState('user_1', 'unknown_widget', {})).toThrow(
        'Unknown widget',
      );
    });
  });

  describe('updatePersonalization', () => {
    it('updates personalization preferences', () => {
      const updated = config.updatePersonalization('user_1', { showMetrics: false });
      expect(updated.showMetrics).toBe(false);
      expect(config.getConfig('user_1').personalization.showMetrics).toBe(false);
    });
  });

  describe('resetConfig', () => {
    it('resets to defaults', () => {
      config.updateConfig('user_1', { theme: 'dark' });
      const reset = config.resetConfig('user_1');
      expect(reset.theme).toBe('system');
    });
  });

  describe('toggleSection', () => {
    it('toggles section visibility', () => {
      const state = config.toggleSection('user_1', 'focus');
      expect(state).toBe(false); // was visible, now hidden
      const state2 = config.toggleSection('user_1', 'focus');
      expect(state2).toBe(true); // was hidden, now visible
    });

    it('returns false for unknown section', () => {
      expect(config.toggleSection('user_1', 'unknown')).toBe(false);
    });
  });

  describe('toggleCollapsed', () => {
    it('toggles collapsed state', () => {
      const collapsed = config.toggleCollapsed('user_1', 'focus');
      expect(collapsed).toBe(true);
      const expanded = config.toggleCollapsed('user_1', 'focus');
      expect(expanded).toBe(false);
    });
  });

  describe('pinSection / unpinSection', () => {
    it('pins a section', () => {
      expect(config.pinSection('user_1', 'memory')).toBe(true);
      expect(config.getConfig('user_1').pinnedSections).toContain('memory');
    });

    it('does not duplicate pins', () => {
      config.pinSection('user_1', 'focus');
      expect(config.pinSection('user_1', 'focus')).toBe(false);
    });

    it('unpins a section', () => {
      config.pinSection('user_1', 'memory');
      expect(config.unpinSection('user_1', 'memory')).toBe(true);
      expect(config.getConfig('user_1').pinnedSections).not.toContain('memory');
    });

    it('returns false when unpinning non-pinned section', () => {
      expect(config.unpinSection('user_1', 'nonexistent')).toBe(false);
    });
  });
});
