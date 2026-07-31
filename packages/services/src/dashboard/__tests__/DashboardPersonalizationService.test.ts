import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DashboardPersonalizationService } from '../DashboardPersonalizationService.js';

describe('DashboardPersonalizationService', () => {
  let service: DashboardPersonalizationService;

  beforeEach(() => {
    service = new DashboardPersonalizationService();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Greeting Generation ────────────────────────────────────────

  describe('generateGreeting', () => {
    it('generates morning greeting', () => {
      vi.setSystemTime(new Date('2026-06-01T09:00:00'));
      const greeting = service.generateGreeting('Alice', {
        greetingStyle: 'casual',
        showMetrics: true,
        showAICompanion: true,
        insightFrequency: 'medium',
        notificationPreferences: [],
        favoriteSections: [],
      });
      expect(greeting.timeOfDay).toBe('morning');
      expect(greeting.emoji).toBe('🌅');
      expect(greeting.personalized).toBe(true);
      expect(greeting.text).toContain('Alice');
    });

    it('generates afternoon greeting', () => {
      vi.setSystemTime(new Date('2026-06-01T14:00:00'));
      const greeting = service.generateGreeting('Bob', {
        greetingStyle: 'formal',
        showMetrics: true,
        showAICompanion: true,
        insightFrequency: 'medium',
        notificationPreferences: [],
        favoriteSections: [],
      });
      expect(greeting.timeOfDay).toBe('afternoon');
      expect(greeting.emoji).toBe('☀️');
      expect(greeting.text).toContain('Bob');
    });

    it('generates evening greeting', () => {
      vi.setSystemTime(new Date('2026-06-01T19:00:00'));
      const greeting = service.generateGreeting('Carol', {
        greetingStyle: 'motivational',
        showMetrics: true,
        showAICompanion: true,
        insightFrequency: 'medium',
        notificationPreferences: [],
        favoriteSections: [],
      });
      expect(greeting.timeOfDay).toBe('evening');
      expect(greeting.emoji).toBe('🌆');
    });

    it('generates night greeting', () => {
      vi.setSystemTime(new Date('2026-06-01T23:00:00'));
      const greeting = service.generateGreeting('Dave', {
        greetingStyle: 'casual',
        showMetrics: true,
        showAICompanion: true,
        insightFrequency: 'medium',
        notificationPreferences: [],
        favoriteSections: [],
      });
      expect(greeting.timeOfDay).toBe('night');
      expect(greeting.emoji).toBe('🌙');
    });

    it('generates formal greeting', () => {
      vi.setSystemTime(new Date('2026-06-01T10:00:00'));
      const greeting = service.generateGreeting('Alice', {
        greetingStyle: 'formal',
        showMetrics: true,
        showAICompanion: true,
        insightFrequency: 'medium',
        notificationPreferences: [],
        favoriteSections: [],
      });
      expect(greeting.text).toBe('Good morning, Alice.');
    });
  });

  // ── AI Companion Context ───────────────────────────────────────

  describe('generateAICompanionContext', () => {
    it('generates context with suggested questions', () => {
      const context = service.generateAICompanionContext(
        'Complete Project',
        ['Started Task A', 'Finished Task B'],
        'User is progressing well',
      );
      expect(context.currentFocus).toBe('Complete Project');
      expect(context.recentActivity).toHaveLength(2);
      expect(context.suggestedQuestions.length).toBeGreaterThanOrEqual(4);
      expect(context.contextSummary).toBe('User is progressing well');
    });
  });

  // ── Visible Sections ───────────────────────────────────────────

  describe('getVisibleSections', () => {
    const allSections = ['focus', 'execution', 'metrics', 'aiContext', 'journey'];

    it('returns all sections by default', () => {
      const visible = service.getVisibleSections(
        {
          greetingStyle: 'casual',
          showMetrics: true,
          showAICompanion: true,
          insightFrequency: 'medium',
          notificationPreferences: [],
          favoriteSections: [],
        },
        allSections,
      );
      expect(visible).toHaveLength(5);
    });

    it('hides metrics when disabled', () => {
      const visible = service.getVisibleSections(
        {
          greetingStyle: 'casual',
          showMetrics: false,
          showAICompanion: true,
          insightFrequency: 'medium',
          notificationPreferences: [],
          favoriteSections: [],
        },
        allSections,
      );
      expect(visible).not.toContain('metrics');
    });

    it('hides AI companion when disabled', () => {
      const visible = service.getVisibleSections(
        {
          greetingStyle: 'casual',
          showMetrics: true,
          showAICompanion: false,
          insightFrequency: 'medium',
          notificationPreferences: [],
          favoriteSections: [],
        },
        allSections,
      );
      expect(visible).not.toContain('aiContext');
    });

    it('prioritizes favorite sections', () => {
      const visible = service.getVisibleSections(
        {
          greetingStyle: 'casual',
          showMetrics: true,
          showAICompanion: true,
          insightFrequency: 'medium',
          notificationPreferences: [],
          favoriteSections: ['journey', 'focus'],
        },
        allSections,
      );
      // Favorites preserve original order from allSections: focus appears first
      expect(visible[0]).toBe('focus');
      expect(visible[1]).toBe('journey');
    });
  });

  // ── Insight Interval ───────────────────────────────────────────

  describe('getInsightInterval', () => {
    it('returns correct intervals', () => {
      expect(service.getInsightInterval('high')).toBe(60_000);
      expect(service.getInsightInterval('medium')).toBe(300_000);
      expect(service.getInsightInterval('low')).toBe(900_000);
    });
  });
});
