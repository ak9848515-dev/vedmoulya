// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory Engine Integration Client
// Stores execution history, lessons learned, outcomes, timeline updates
// Never modifies Memory directly. Uses Memory contracts only.
// BLD-007 — Memory Engine Integration
// ──────────────────────────────────────────────────────────────────

export class MemoryEngineClient {
  private readonly baseUrl: string;
  private readonly enabled: boolean;

  constructor() {
    this.baseUrl = process.env.MEMORY_SERVICE_URL ?? 'http://localhost:4004';
    this.enabled = process.env.EXECUTION_MEMORY_ENABLED !== 'false';
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** Store execution outcome in Memory */
  async storeExecutionOutcome(params: {
    planId: string;
    taskId: string;
    result: string;
    description: string;
    duration?: number;
    quality?: number;
  }): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/memory/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'execution',
          title: `Task ${params.taskId}`,
          content: params.description,
          sourceType: 'execution',
          tags: [params.result],
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
