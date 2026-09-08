// ──────────────────────────────────────────────────────────────────
// VedMoulya — Agent Execution Intelligence: In-Memory Run Store
// Owner-scoped, deterministic, hermetic (dev/test default). Production
// persistence follows the estate's WriteThroughDocumentStore pattern
// behind the same AgentExecutionRunStorePort.
// ──────────────────────────────────────────────────────────────────

import type { AgentExecutionRunStorePort } from '../contracts/agent-execution-ports.js';
import type { AgentExecutionRun } from '../types/agent-execution-types.js';

export class InMemoryAgentExecutionStore implements AgentExecutionRunStorePort {
  private readonly runs = new Map<string, AgentExecutionRun>();

  save(run: AgentExecutionRun): void {
    this.runs.set(run.runId, run);
  }

  get(runId: string): AgentExecutionRun | undefined {
    return this.runs.get(runId);
  }

  list(ownerId?: string): AgentExecutionRun[] {
    const all = [...this.runs.values()];
    if (ownerId === undefined) return all;
    return all.filter((run) => run.userId === ownerId);
  }
}
