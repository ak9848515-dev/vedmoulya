// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — LiveMissionView provider/model truthfulness (PROVIDER-01)
//
// Pins the corrected provider/model display contract:
//   • provider/model undefined + not WAITING_FOR_PROVIDER → "Not yet run"
//     (no executed run has recorded one; this is NOT an availability failure)
//   • provider/model undefined + WAITING_FOR_PROVIDER     → "Unavailable"
//     (the runtime genuinely decided no capable provider can serve it)
//   • provider/model present                              → the real value
//
// The old code rendered every missing value as "Unavailable", which made a
// mission that simply had not recorded a generation look like a provider
// outage — the exact false signal from the production screenshot
// (Provider: Unavailable / Model: Unavailable / Tool calls: 0).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { LiveMissionView } from '../LiveMissionView.js';
import type { MissionStatusView } from '../../lib/api-client.js';

const noop = async (): Promise<void> => undefined;

function statusFixture(overrides: Partial<MissionStatusView>): MissionStatusView {
  return {
    missionId: 'mission-1',
    userId: 'u-1',
    title: 'Integration mission',
    objective: 'Implement integration inside the workspace',
    state: 'RUNNING',
    autonomyLevel: 'CONTROLLED_AUTONOMOUS',
    createdAt: '2026-09-30T13:00:00.000Z',
    updatedAt: '2026-09-30T13:00:00.000Z',
    objectives: [],
    checkpoints: [],
    budgetUsage: {
      objectivesCompleted: 0,
      objectivesFailed: 0,
      actionsExecuted: 0,
      toolCallsExecuted: 0,
      retriesConsumed: 0,
      tokensConsumed: 0,
      costUsdConsumed: 0,
    },
    budgetRemaining: {
      objectives: 5,
      actions: 100,
      runtimeMs: 3_600_000,
      tokens: 1_000_000,
      costUsd: 10,
    },
    activity: [],
    loopRunning: false,
    ...overrides,
  };
}

function renderView(status: MissionStatusView): void {
  render(
    React.createElement(LiveMissionView, {
      status,
      onPause: noop,
      onResume: noop,
      onCancel: noop,
      onApprove: noop,
      onReject: noop,
      loopPending: false,
    }),
  );
}

describe('LiveMissionView — provider/model truth (PROVIDER-01)', () => {
  it('A: undefined provider + model outside WAITING_FOR_PROVIDER reads "Not yet run"', () => {
    renderView(statusFixture({ state: 'RUNNING', provider: undefined, model: undefined }));
    expect(screen.getByTestId('fact-provider').textContent).toBe('Not yet run');
    expect(screen.getByTestId('fact-model').textContent).toBe('Not yet run');
    expect(screen.getByTestId('fact-provider').textContent).not.toBe('Unavailable');
  });

  it('B: undefined provider + model in WAITING_FOR_PROVIDER reads "Unavailable"', () => {
    renderView(
      statusFixture({ state: 'WAITING_FOR_PROVIDER', provider: undefined, model: undefined }),
    );
    expect(screen.getByTestId('fact-provider').textContent).toBe('Unavailable');
    expect(screen.getByTestId('fact-model').textContent).toBe('Unavailable');
  });

  it('C: a recorded provider renders its real value', () => {
    renderView(statusFixture({ state: 'RUNNING', provider: 'ollama', model: undefined }));
    expect(screen.getByTestId('fact-provider').textContent).toBe('ollama');
  });

  it('D: a recorded model renders its real value', () => {
    renderView(statusFixture({ state: 'RUNNING', model: 'llama3.1:8b' }));
    expect(screen.getByTestId('fact-model').textContent).toBe('llama3.1:8b');
  });

  it('a FAILED mission with no recorded run still reads "Not yet run" (not "Unavailable")', () => {
    renderView(
      statusFixture({
        state: 'FAILED',
        outcome: 'FAILED',
        outcomeReason: 'Maximum replans reached',
        provider: undefined,
        model: undefined,
      }),
    );
    expect(screen.getByTestId('fact-provider').textContent).toBe('Not yet run');
    expect(screen.getByTestId('fact-model').textContent).toBe('Not yet run');
  });
});
