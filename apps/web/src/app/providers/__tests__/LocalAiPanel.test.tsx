// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Local AI panel tests
//
// Proves the minimal integration distinguishes LOCAL AGENT from OLLAMA from the
// MODEL, and that an absent agent degrades honestly instead of crashing.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { LocalAiPanel } from '../LocalAiPanel.js';
import { checkLocalAgent, fetchLocalRuntimeStatus, verifyLocalRuntime } from '../local-ai-agent.js';

vi.mock('../local-ai-agent.js', () => ({
  DEFAULT_LOCAL_AGENT_URL: 'http://127.0.0.1:43117',
  DEFAULT_LOCAL_RUNTIME_ID: 'ollama',
  LOCAL_AGENT_URL_CANDIDATES: ['http://127.0.0.1:43117'],
  LOCAL_AGENT_PROBE_TIMEOUT_MS: 2500,
  checkLocalAgent: vi.fn(),
  fetchLocalRuntimeStatus: vi.fn(),
  verifyLocalRuntime: vi.fn(),
}));

const mockedCheck = vi.mocked(checkLocalAgent);
const mockedStatus = vi.mocked(fetchLocalRuntimeStatus);
const mockedVerify = vi.mocked(verifyLocalRuntime);

const STATUS_REPORT = {
  runtime: 'ollama',
  displayName: 'Ollama',
  endpoint: 'http://127.0.0.1:11434',
  state: 'OLLAMA_MODELS_FOUND' as const,
  label: 'Models found',
  tone: 'ok' as const,
  message: 'Ollama reported 1 model.',
  modelCount: 1,
  models: [
    {
      id: 'qwen2.5-coder:7b-instruct',
      name: 'qwen2.5-coder:7b-instruct',
      runtime: 'ollama',
      capabilities: ['completion'],
      capabilitiesProvenance: 'MEASURED' as const,
    },
  ],
  selectedModelId: 'qwen2.5-coder:7b-instruct',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedStatus.mockResolvedValue(null);
  mockedVerify.mockResolvedValue(null);
});

describe('LocalAiPanel', () => {
  it('shows Local Agent not connected when nothing is running, without crashing', async () => {
    mockedCheck.mockResolvedValue({
      reachable: false,
      url: 'http://127.0.0.1:43117',
      message: 'The Local Agent is not running on this computer.',
    });

    render(<LocalAiPanel />);

    expect(screen.getByTestId('local-ai-panel')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByTestId('local-ai-agent-status').textContent).toBe('Not connected');
    });
    expect(screen.getByTestId('local-ai-runtime').textContent).toBe('—');
    expect(screen.getByTestId('local-ai-connection').textContent).toBe('Not connected');
    expect(screen.getByTestId('local-ai-connect').hasAttribute('disabled')).toBe(true);
  });

  it('separates the agent, the runtime and the model and shows the connection state', async () => {
    mockedCheck.mockResolvedValue({
      reachable: true,
      url: 'http://127.0.0.1:43117',
      health: {
        status: 'RUNNING',
        version: '1.0.0',
        startedAt: '2026-01-01T00:00:00.000Z',
        runtimes: ['ollama'],
      },
      message: 'Local Agent connected.',
    });
    mockedStatus.mockResolvedValue(STATUS_REPORT);

    render(<LocalAiPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('local-ai-agent-status').textContent).toBe('Connected');
    });
    expect(screen.getByTestId('local-ai-runtime').textContent).toBe('Ollama');
    expect(screen.getByTestId('local-ai-model').textContent).toBe('qwen2.5-coder:7b-instruct');
    expect(screen.getByTestId('local-ai-connection').textContent).toBe('Models found');
    expect(screen.getByTestId('local-ai-message').textContent).toContain(
      'Ollama reported 1 model.',
    );
    expect(screen.getByTestId('local-ai-model-select')).toBeTruthy();
    expect(screen.getByTestId('local-ai-connect').hasAttribute('disabled')).toBe(false);
  });

  it('runs the strict connect check through the agent and shows the evidence', async () => {
    mockedCheck.mockResolvedValue({
      reachable: true,
      url: 'http://127.0.0.1:43117',
      health: {
        status: 'RUNNING',
        version: '1.0.0',
        startedAt: '2026-01-01T00:00:00.000Z',
        runtimes: ['ollama'],
      },
      message: 'Local Agent connected.',
    });
    mockedStatus.mockResolvedValue(STATUS_REPORT);
    mockedVerify.mockResolvedValue({
      ...STATUS_REPORT,
      state: 'OLLAMA_CONNECTED',
      label: 'Connected',
      message: 'Ollama answered on qwen2.5-coder:7b-instruct.',
      connected: true,
      checks: [
        { key: 'agent', label: 'Local Agent running', ok: true },
        { key: 'generation', label: 'Real generation succeeded', ok: true },
      ],
    });

    render(<LocalAiPanel />);
    await waitFor(() => {
      expect(screen.getByTestId('local-ai-connect').hasAttribute('disabled')).toBe(false);
    });

    fireEvent.click(screen.getByTestId('local-ai-connect'));

    await waitFor(() => {
      expect(screen.getByTestId('local-ai-connection').textContent).toBe('Connected');
    });
    expect(mockedVerify).toHaveBeenCalledWith(
      'http://127.0.0.1:43117',
      'ollama',
      'qwen2.5-coder:7b-instruct',
    );
    expect(screen.getByTestId('local-ai-checks').textContent).toContain(
      'Real generation succeeded',
    );
  });
});
