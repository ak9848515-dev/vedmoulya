// ──────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Personalization Service
// Personalization for the Dashboard Experience Platform
// BLD-010 — Dashboard Experience Platform
// ──────────────────────────────────────────────────────────────────

import type {
  GreetingDTO,
  PersonalizationConfigDTO,
  AICompanionContextDTO,
} from './DashboardDTO.js';

export class DashboardPersonalizationService {
  /** Generate a personalized greeting */
  generateGreeting(displayName: string, config: PersonalizationConfigDTO): GreetingDTO {
    const hour = new Date().getHours();
    const timeOfDay =
      hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';
    const emoji =
      timeOfDay === 'morning'
        ? '🌅'
        : timeOfDay === 'afternoon'
          ? '☀️'
          : timeOfDay === 'evening'
            ? '🌆'
            : '🌙';

    let text: string;
    switch (config.greetingStyle) {
      case 'formal':
        text = `Good ${timeOfDay}, ${displayName}.`;
        break;
      case 'casual':
        text = `Hey ${displayName}! Good ${timeOfDay}!`;
        break;
      case 'motivational':
      default:
        text = this.getMotivationalGreeting(timeOfDay, displayName);
        break;
    }

    return { text, timeOfDay, emoji, personalized: true };
  }

  /** Generate AI companion context */
  generateAICompanionContext(
    currentFocus: string,
    recentActivity: string[],
    contextSummary: string,
  ): AICompanionContextDTO {
    return {
      currentFocus,
      recentActivity,
      suggestedQuestions: this.generateSuggestedQuestions(currentFocus, recentActivity),
      contextSummary,
    };
  }

  /** Get visible sections based on config */
  getVisibleSections(config: PersonalizationConfigDTO, allSections: string[]): string[] {
    let sections = [...allSections];

    if (!config.showMetrics) {
      sections = sections.filter((s) => s !== 'metrics');
    }
    if (!config.showAICompanion) {
      sections = sections.filter((s) => s !== 'aiContext');
    }

    // Move favorite sections to top
    const favorites = sections.filter((s) => config.favoriteSections.includes(s));
    const rest = sections.filter((s) => !config.favoriteSections.includes(s));
    return [...favorites, ...rest];
  }

  /** Get insight frequency in milliseconds */
  getInsightInterval(frequency: 'high' | 'medium' | 'low'): number {
    switch (frequency) {
      case 'high':
        return 60_000;
      case 'medium':
        return 300_000;
      case 'low':
        return 900_000;
    }
  }

  private getMotivationalGreeting(timeOfDay: string, name: string): string {
    const morningGreetings = [
      `Rise and shine, ${name}! A new day of possibilities awaits. 🌅`,
      `Good morning, ${name}! Let's make today extraordinary. ⭐`,
      `Morning, ${name}! Your journey continues. Let's go! 🚀`,
    ];
    const afternoonGreetings = [
      `Keep going, ${name}! You're making progress. 💪`,
      `Good afternoon, ${name}! Stay focused and energized. ⚡`,
      `You've got this, ${name}! Keep pushing forward. 🔥`,
    ];
    const eveningGreetings = [
      `Great work today, ${name}! Time to reflect and recharge. 🌆`,
      `Evening, ${name}! Review your wins and plan tomorrow. 📋`,
      `You're doing amazing, ${name}! Rest and recover. 🌙`,
    ];
    const nightGreetings = [
      `Time to rest, ${name}! Tomorrow is a new opportunity. 🌙`,
      `Good night, ${name}! Reflect on today's achievements. ✨`,
      `Rest well, ${name}! Your future self will thank you. 🌟`,
    ];

    const pool =
      timeOfDay === 'morning'
        ? morningGreetings
        : timeOfDay === 'afternoon'
          ? afternoonGreetings
          : timeOfDay === 'evening'
            ? eveningGreetings
            : nightGreetings;

    return pool[Math.floor(Math.random() * pool.length)] ?? pool[0] ?? 'Hello!';
  }

  private generateSuggestedQuestions(currentFocus: string, recentActivity: string[]): string[] {
    const questions: string[] = [
      `What's blocking progress on "${currentFocus}"?`,
      'What should I prioritize next?',
      'How can I improve my focus today?',
    ];

    if (recentActivity.length > 0) {
      questions.push(`How did "${recentActivity[0] ?? ''}" go?`);
    }

    questions.push('What opportunities should I explore?');
    questions.push('How am I tracking against my goals?');

    return questions;
  }
}
