// ──────────────────────────────────────────────────────────────────
// VedMoulya — Agent Execution Intelligence: System Clock
// Real wall-clock timestamps. Tests inject a deterministic fake clock
// behind the same AgentClockPort.
// ──────────────────────────────────────────────────────────────────

import type { AgentClockPort } from '../contracts/agent-execution-ports.js';

export class SystemClock implements AgentClockPort {
  now(): string {
    return new Date().toISOString();
  }

  timestampMs(): number {
    return Date.now();
  }
}
