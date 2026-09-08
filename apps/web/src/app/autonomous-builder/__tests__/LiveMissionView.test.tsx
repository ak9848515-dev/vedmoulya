// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — LiveMissionView tests (BLD-024)
//
// Proves the live view renders REAL backend state truthfully across every
// mission state, shows honest panels for approval/provider-wait, displays
// "Unavailable" for missing values, and NEVER fabricates progress.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { LiveMissionView } from '../LiveMissionView.js';
import type { MissionStatusView } from '../../../lib/api-client.js';

function statusView(overrides: Partial<MissionStatusView> = {}): MissionStatusView {
  return {
    missionId: 'm-1',
    userId: 'u-1',
    title: 'Certification mission',
    objective: 'Improve the workspace autonomously',
    state: 'RUNNING',
    autonomyLevel: 'CONTROLLED_AUTONOMOUS',
    createdAt: '2026-09-06T00:00:00.000Z',
    updatedAt: '2026-09-06T00:00:00.000Z',
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
    loopRunning: true,
    ...overrides,
  };
}

const noop = (): Promise<void> => Promise.resolve();

function renderView(
  overrides: Partial<MissionStatusView> = {},
  handlers: Partial<
    Record<'onPause' | 'onResume' | 'onCancel' | 'onApprove' | 'onReject', () => Promise<void>>
  > = {},
) {
  return render(
    <LiveMissionView
      status={statusView(overrides)}
      loopPending={false}
      onPause={handlers.onPause ?? noop}
      onResume={handlers.onResume ?? noop}
      onCancel={handlers.onCancel ?? noop}
      onApprove={handlers.onApprove ?? noop}
      onReject={handlers.onReject ?? noop}
    />,
  );
}

describe('LiveMissionView — honest state display (BLD-024)', () => {
  it('READY→RUNNING: renders RUNNING state with loop-running indicator', () => {
    renderView({ state: 'RUNNING' });
    expect(screen.getByTestId('mission-state').textContent).toBe('RUNNING');
    expect(screen.getByTestId('loop-running')).toBeTruthy();
    expect(screen.getByTestId('pause-btn')).toBeTruthy();
  });

  it('RUNNING→PAUSED: PAUSED state shows RESUME and no PAUSE button', () => {
    renderView({ state: 'PAUSED', loopRunning: false });
    expect(screen.getByTestId('mission-state').textContent).toBe('PAUSED');
    expect(screen.queryByTestId('pause-btn')).toBeNull();
    expect(screen.getByTestId('resume-btn')).toBeTruthy();
  });

  it('RUNNING→WAITING_FOR_PROVIDER: shows the provider-wait panel, never fabricated availability', () => {
    renderView({ state: 'WAITING_FOR_PROVIDER', provider: undefined, model: undefined });
    expect(screen.getByTestId('provider-wait-panel')).toBeTruthy();
    expect(screen.getByTestId('provider-wait-panel').textContent).toContain(
      'No eligible provider is currently available',
    );
    expect(screen.getByTestId('provider-wait-panel').textContent).toContain(
      'checkpoint has been saved',
    );
    // No provider exists — the facts grid says Unavailable, never a fake name.
    expect(screen.getByTestId('fact-provider').textContent).toBe('Unavailable');
    expect(screen.getByTestId('fact-model').textContent).toBe('Unavailable');
    expect(screen.getByTestId('resume-btn')).toBeTruthy();
  });

  it('WAITING_FOR_APPROVAL→RUNNING: APPROVE reaches the operator approval callback (the model cannot approve itself)', async () => {
    const onApprove = vi.fn(async () => {});
    renderView(
      {
        state: 'WAITING_FOR_APPROVAL',
        currentObjective: {
          objectiveId: 'o-9',
          title: 'Deploy to production',
          state: 'RUNNING',
          reason: 'High-risk deployment operation',
          evidence: [],
          retryCount: 0,
          failureReason: 'Deployment requires explicit operator approval',
        },
      },
      { onApprove },
    );
    expect(screen.getByTestId('approval-panel')).toBeTruthy();
    expect(screen.getByTestId('approval-operation').textContent).toContain('Deploy to production');
    expect(screen.getByTestId('approval-reason').textContent).toContain(
      'High-risk deployment operation',
    );
    expect(screen.getByTestId('approval-risk').textContent).toContain('operator approval');
    // Operator-supplied callback only — the UI cannot grant authority itself.
    fireEvent.click(screen.getByTestId('approve-btn'));
    await vi.waitFor(() => expect(onApprove).toHaveBeenCalled());
  });

  it('WAITING_FOR_APPROVAL: REJECT reaches the operator rejection callback', async () => {
    const onReject = vi.fn(async () => {});
    renderView({ state: 'WAITING_FOR_APPROVAL' }, { onReject });
    expect(screen.getByTestId('approval-panel')).toBeTruthy();
    fireEvent.click(screen.getByTestId('reject-btn'));
    await vi.waitFor(() => expect(onReject).toHaveBeenCalled());
  });

  it('WAITING_FOR_APPROVAL: the panel shows the RUNTIME-recorded reason (outcomeReason) verbatim', () => {
    renderView({
      state: 'WAITING_FOR_APPROVAL',
      outcomeReason:
        'Operator approval required before this objective may continue — write rejected by workspace content policy',
      currentObjective: {
        objectiveId: 'o-9',
        title: 'Create the workspace file approval-risky.md with the risky summary',
        state: 'PENDING',
        reason: 'Initial objective',
        evidence: [],
        retryCount: 0,
      },
    });
    expect(screen.getByTestId('approval-panel')).toBeTruthy();
    // The operation is the objective the operator must decide on.
    expect(screen.getByTestId('approval-operation').textContent).toContain('approval-risky.md');
    // The reason is the controller's own recorded text — never invented by the UI.
    expect(screen.getByTestId('approval-reason').textContent).toContain(
      'Operator approval required',
    );
    expect(screen.getByTestId('approval-reason').textContent).toContain('workspace content policy');
  });

  it('WAITING_FOR_PROVIDER: shows the runtime-recorded wait reason when available', () => {
    renderView({
      state: 'WAITING_FOR_PROVIDER',
      provider: undefined,
      model: undefined,
      outcomeReason: 'No capable provider available (required capabilities: coding)',
    });
    expect(screen.getByTestId('provider-wait-panel')).toBeTruthy();
    expect(screen.getByTestId('provider-wait-reason').textContent).toContain(
      'No capable provider available',
    );
    // Never fabricates availability or recovery time.
    expect(screen.getByTestId('fact-provider').textContent).toBe('Unavailable');
  });

  it('operator holds: the header shows the runtime reason line (never only a bare state)', () => {
    renderView({
      state: 'BLOCKED',
      outcomeReason:
        'Watchdog: mission RUNNING with no progress — transitioned to a recoverable state',
      loopRunning: false,
    });
    expect(screen.getByTestId('mission-state').textContent).toBe('BLOCKED');
    expect(screen.getByTestId('mission-reason').textContent).toContain('Watchdog');
  });

  it('RUNNING→COMPLETED: terminal state stops controls and shows outcome', () => {
    renderView({
      state: 'COMPLETED',
      outcome: 'ACHIEVED',
      loopRunning: false,
      objectives: [
        {
          objectiveId: 'o-1',
          title: 'Objective 1',
          state: 'VERIFIED',
          reason: 'Initial objective',
          evidence: ['step s1: status=completed verified=true'],
          retryCount: 0,
          verificationMethod: 'agent_execution_verification',
          verifiedAt: '2026-09-06T00:01:00.000Z',
        },
      ],
      checkpoints: [
        {
          checkpointId: 'c-1',
          objectiveId: 'o-1',
          state: 'VERIFIED',
          completedWork: ['done'],
          remainingWork: [],
          failures: [],
          timestamp: '2026-09-06T00:01:00.000Z',
        },
      ],
      budgetUsage: {
        objectivesCompleted: 1,
        objectivesFailed: 0,
        actionsExecuted: 2,
        toolCallsExecuted: 3,
        retriesConsumed: 0,
        tokensConsumed: 420,
        costUsdConsumed: 0.0021,
      },
    });
    expect(screen.getByTestId('mission-state').textContent).toBe('COMPLETED');
    expect(screen.getByTestId('mission-outcome').textContent).toContain('ACHIEVED');
    expect(screen.queryByTestId('pause-btn')).toBeNull();
    expect(screen.queryByTestId('resume-btn')).toBeNull();
    expect(screen.queryByTestId('cancel-btn')).toBeNull();
    expect(screen.getByTestId('fact-verified').textContent).toBe('1');
    expect(screen.getByTestId('fact-tokens').textContent).toBe('420');
  });

  it('RUNNING→FAILED: terminal FAILED state shows outcome reason', () => {
    renderView({
      state: 'FAILED',
      outcome: 'FAILED',
      outcomeReason: 'Budget exhausted',
      loopRunning: false,
    });
    expect(screen.getByTestId('mission-state').textContent).toBe('FAILED');
    expect(screen.getByTestId('mission-outcome').textContent).toContain('Budget exhausted');
  });

  it('CANCELED state renders terminal without controls', () => {
    renderView({ state: 'CANCELLED', outcome: 'CANCELLED', loopRunning: false });
    expect(screen.getByTestId('mission-state').textContent).toBe('CANCELLED');
    expect(screen.queryByTestId('cancel-btn')).toBeNull();
  });

  it('timeline: verified / running / pending / blocked states render with real reasons', () => {
    renderView({
      state: 'RUNNING',
      objectives: [
        {
          objectiveId: 'o-1',
          title: 'Objective 1',
          state: 'VERIFIED',
          reason: 'r',
          evidence: ['e'],
          retryCount: 0,
        },
        {
          objectiveId: 'o-2',
          title: 'Objective 2',
          state: 'VERIFIED',
          reason: 'r',
          evidence: ['e'],
          retryCount: 0,
        },
        {
          objectiveId: 'o-3',
          title: 'Objective 3',
          state: 'RUNNING',
          reason: 'r',
          evidence: [],
          retryCount: 0,
        },
        {
          objectiveId: 'o-4',
          title: 'Objective 4',
          state: 'PENDING',
          reason: 'r',
          evidence: [],
          retryCount: 0,
        },
      ],
    });
    const timeline = screen.getByTestId('objective-timeline');
    expect(timeline.textContent).toContain('Objective 1');
    expect(timeline.textContent).toContain('VERIFIED');
    expect(timeline.textContent).toContain('RUNNING');
    expect(timeline.textContent).toContain('PENDING');
  });

  it('blocked objective shows the actual reason from mission state', () => {
    renderView({
      state: 'BLOCKED',
      objectives: [
        {
          objectiveId: 'o-4',
          title: 'Objective 4',
          state: 'BLOCKED',
          reason: 'r',
          evidence: [],
          retryCount: 0,
          failureReason: 'Required capability unavailable',
        },
      ],
    });
    expect(screen.getByTestId('objective-timeline').textContent).toContain(
      'Reason: Required capability unavailable',
    );
  });

  it('NEVER fabricates: missing provider/model/attempt values display "Unavailable" and no percentage text exists', () => {
    renderView({
      state: 'RUNNING',
      provider: undefined,
      model: undefined,
      attempts: undefined,
      revisions: undefined,
      currentObjective: undefined,
    });
    expect(screen.getByTestId('fact-provider').textContent).toBe('Unavailable');
    expect(screen.getByTestId('fact-model').textContent).toBe('Unavailable');
    // No fabricated progress percentage anywhere in the live view.
    expect(screen.queryByText(/\d+% complete/i)).toBeNull();
    expect(screen.queryByText(/percent/i)).toBeNull();
  });

  it('shows the ACTUAL provider/model selected by the orchestrator (no hard-coding)', () => {
    renderView({ state: 'RUNNING', provider: 'Ollama', model: 'qwen2.5-coder:3b' });
    expect(screen.getByTestId('fact-provider').textContent).toBe('Ollama');
    expect(screen.getByTestId('fact-model').textContent).toBe('qwen2.5-coder:3b');
  });

  it('CANCEL requires explicit confirmation before invoking the backend', () => {
    const onCancel = vi.fn(async () => {});
    renderView({ state: 'RUNNING' }, { onCancel });
    fireEvent.click(screen.getByTestId('cancel-btn'));
    // Confirmation step is shown; backend NOT yet called.
    expect(screen.getByTestId('cancel-confirm-btn')).toBeTruthy();
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('cancel-confirm-btn'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('displays the real activity log; empty log says so instead of fabricating', () => {
    renderView({
      state: 'RUNNING',
      activity: [
        {
          id: 'e-1',
          at: '2026-09-06T00:00:00.000Z',
          kind: 'OBJECTIVE_VERIFIED',
          message: 'Objective verified: Objective 1',
        },
      ],
    });
    expect(screen.getByTestId('activity-log').textContent).toContain('OBJECTIVE VERIFIED');
    expect(screen.getByTestId('activity-log').textContent).toContain(
      'Objective verified: Objective 1',
    );
  });

  it('empty activity log shows the honest empty state', () => {
    renderView({ state: 'RUNNING', activity: [] });
    expect(screen.getByTestId('activity-empty')).toBeTruthy();
  });
});
