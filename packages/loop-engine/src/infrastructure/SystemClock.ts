// ──────────────────────────────────────────────────────────────────
// VedMoulya — Loop Engine: System Clock
// EPIC-006 — wall-clock port implementation (tests use a fake clock).
// ──────────────────────────────────────────────────────────────────

import type { ClockPort } from '../contracts/loop-ports.js';

export class SystemClock implements ClockPort {
  now(): string {
    return new Date().toISOString();
  }

  timestampMs(): number {
    return Date.now();
  }

  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, Math.max(0, ms));
    });
  }
}
