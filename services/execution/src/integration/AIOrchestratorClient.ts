// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Orchestrator Integration Client
// Uses ONLY BLD-005 contracts.
// Adaptive planning, execution summaries, recovery recommendations,
// context generation, daily brief generation.
// Never bypass AI Orchestrator.
// ──────────────────────────────────────────────────────────────────

export class AIOrchestratorClient {
  private readonly baseUrl: string;
  private readonly enabled: boolean;

  constructor() {
    this.baseUrl = process.env.ORCHESTRATOR_SERVICE_URL ?? 'http://localhost:4001';
    this.enabled = process.env.EXECUTION_AI_ENABLED !== 'false';
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** Generate daily brief from plan data */
  async generateDailyBrief(planData: Record<string, unknown>): Promise<string> {
    if (!this.enabled) return '';
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/orchestrator/capability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capability: 'text-generation',
          userInput: 'Generate a daily brief',
          context: { ...planData, purpose: 'daily_brief' },
          qualityTier: 'standard',
        }),
      });
      if (!res.ok) return '';
      const data = (await res.json()) as { content?: string };
      return data.content ?? '';
    } catch {
      return '';
    }
  }

  /** Generate recovery recommendations */
  async generateRecoveryRecommendations(
    failureContext: Record<string, unknown>,
  ): Promise<string[]> {
    if (!this.enabled) return [];
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/orchestrator/capability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capability: 'text-generation',
          userInput: 'Suggest recovery options',
          context: { ...failureContext, purpose: 'recovery' },
          qualityTier: 'standard',
        }),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { content?: string };
      return data.content
        ? data.content
            .split('\n')
            .filter((l: string) => l.trim().startsWith('-'))
            .map((l: string) => l.replace(/^-\s*/, '').trim())
        : [];
    } catch {
      return [];
    }
  }
}
