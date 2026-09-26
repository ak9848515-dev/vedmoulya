// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Local AI overview card tests
//
// The card is PRESENTATIONAL: it renders whatever the shared Local AI
// controller reports, so these tests prove it reflects the live connection
// state (connected vs not) without probing anything itself.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { LocalAiOverviewCard } from '../LocalAiPanel.js';
import type { LocalAiStatus, LocalAiSnapshot } from '../use-local-ai-status.js';

const CONNECTED_SNAPSHOT: LocalAiSnapshot = {
  agentReachable: true,
  checking: false,
  connecting: false,
  state: 'OLLAMA_CONNECTED',
  label: 'Connected',
  tone: 'ok',
  message: 'Ollama answered on qwen2.5-coder:3b.',
  runtimeName: 'Ollama',
  modelId: 'qwen2.5-coder:3b',
};

function stubStatus(
  snapshot: Partial<LocalAiSnapshot> = {},
  overrides: Partial<LocalAiStatus> = {},
): LocalAiStatus {
  const merged = { ...CONNECTED_SNAPSHOT, ...snapshot };
  return {
    check: null,
    report: null,
    selectedModelId: merged.modelId ?? '',
    setSelectedModelId: vi.fn(),
    checking: merged.checking,
    connecting: merged.connecting,
    agentReachable: merged.agentReachable,
    snapshot: merged,
    refresh: vi.fn(() => Promise.resolve()),
    connect: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
}

describe('LocalAiOverviewCard', () => {
  it('shows the live connected state, runtime and model', () => {
    render(<LocalAiOverviewCard localAi={stubStatus()} />);

    expect(screen.getByTestId('local-ai-overview-card')).toBeTruthy();
    expect(screen.getByTestId('local-ai-overview-connection').textContent).toBe('Connected');
    expect(screen.getByTestId('local-ai-overview-agent').textContent).toBe('Connected');
    expect(screen.getByTestId('local-ai-overview-runtime').textContent).toBe('Ollama');
    expect(screen.getByTestId('local-ai-overview-model').textContent).toBe('qwen2.5-coder:3b');
  });

  it('shows not connected honestly when the Local Agent is not running', () => {
    render(
      <LocalAiOverviewCard
        localAi={stubStatus({
          agentReachable: false,
          state: 'LOCAL_AGENT_NOT_RUNNING',
          label: 'Local Agent not connected',
          tone: 'neutral',
          message: 'The Local Agent is not running on this computer.',
          runtimeName: null,
          modelId: null,
        })}
      />,
    );

    expect(screen.getByTestId('local-ai-overview-agent').textContent).toBe('Not connected');
    expect(screen.getByTestId('local-ai-overview-connection').textContent).toBe(
      'Local Agent not connected',
    );
    expect(screen.getByTestId('local-ai-overview-runtime').textContent).toBe('—');
    expect(screen.getByTestId('local-ai-overview-model').textContent).toBe('—');
  });

  it('re-checks the shared state when refreshed', () => {
    const refresh = vi.fn(() => Promise.resolve());
    render(<LocalAiOverviewCard localAi={stubStatus({}, { refresh })} />);

    fireEvent.click(screen.getByTestId('local-ai-overview-refresh'));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
