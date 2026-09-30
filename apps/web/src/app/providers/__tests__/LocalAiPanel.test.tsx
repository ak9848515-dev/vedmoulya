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
import {
  checkLocalAgent,
  fetchLocalRuntimeStatus,
  streamLocalGeneration,
  verifyLocalRuntime,
} from '../local-ai-agent.js';

vi.mock('../local-ai-agent.js', () => ({
  DEFAULT_LOCAL_AGENT_URL: 'http://127.0.0.1:43117',
  DEFAULT_LOCAL_RUNTIME_ID: 'ollama',
  LOCAL_AGENT_URL_CANDIDATES: ['http://127.0.0.1:43117'],
  LOCAL_AGENT_PROBE_TIMEOUT_MS: 2500,
  failureForNullReport: (url: string) => ({
    code: 'AGENT_UNAVAILABLE',
    message: `No report from ${url}`,
  }),
  failureForReport: () => null,
  checkLocalAgent: vi.fn(),
  fetchLocalRuntimeStatus: vi.fn(),
  verifyLocalRuntime: vi.fn(),
  streamLocalGeneration: vi.fn(),
}));

const mockedCheck = vi.mocked(checkLocalAgent);
const mockedStatus = vi.mocked(fetchLocalRuntimeStatus);
const mockedVerify = vi.mocked(verifyLocalRuntime);
const mockedStream = vi.mocked(streamLocalGeneration);

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
  window.localStorage.clear();
  mockedStatus.mockResolvedValue(null);
  mockedVerify.mockResolvedValue(null);
  mockedStream.mockResolvedValue({ ok: true, text: '', message: 'Local generation finished.' });
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
      expect(screen.getByTestId('local-ai-agent-status').textContent).toBe('Unavailable');
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
      expect(screen.getByTestId('local-ai-agent-status').textContent).toBe('Reachable');
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

  it('carries the selected model to the agent and retains it in browser storage', async () => {
    const secondModel = {
      id: 'qwen2.5-coder:3b',
      name: 'qwen2.5-coder:3b',
      runtime: 'ollama',
      capabilities: ['completion'],
      capabilitiesProvenance: 'MEASURED' as const,
    };
    mockedCheck.mockResolvedValue({
      reachable: true,
      url: 'http://127.0.0.1:43117',
      message: 'Local Agent reachable.',
    });
    mockedStatus.mockImplementation(async (_url, _runtime, modelId) => ({
      ...STATUS_REPORT,
      models: [...STATUS_REPORT.models, secondModel],
      selectedModelId: modelId ?? STATUS_REPORT.selectedModelId,
    }));

    render(<LocalAiPanel />);
    const select = await screen.findByTestId('local-ai-model-select');
    fireEvent.change(select, { target: { value: secondModel.id } });

    await waitFor(() => {
      expect(mockedStatus).toHaveBeenCalledWith('http://127.0.0.1:43117', 'ollama', secondModel.id);
    });
    expect(window.localStorage.getItem('vedmoulya.localAi.selectedModelId')).toBe(secondModel.id);
    expect((select as HTMLSelectElement).value).toBe(secondModel.id);
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

  it('streams a generation through the agent and renders the reply incrementally', async () => {
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
    mockedStream.mockImplementation((_url, _messages, options) => {
      options?.onChunk?.({ content: 'Hel', done: false });
      options?.onChunk?.({ content: 'lo', done: true });
      return Promise.resolve({ ok: true, text: 'Hello', message: 'Local generation finished.' });
    });

    render(<LocalAiPanel />);
    await waitFor(() => {
      expect(screen.getByTestId('local-ai-prompt')).toBeTruthy();
    });

    fireEvent.change(screen.getByTestId('local-ai-prompt'), {
      target: { value: 'Reply with the single word: ok' },
    });
    fireEvent.click(screen.getByTestId('local-ai-generate'));

    await waitFor(() => {
      expect(screen.getByTestId('local-ai-output').textContent).toBe('Hello');
    });
    expect(mockedStream).toHaveBeenCalledTimes(1);
    expect(mockedStream.mock.calls[0]?.[0]).toBe('http://127.0.0.1:43117');
    expect(mockedStream.mock.calls[0]?.[2]?.modelId).toBe('qwen2.5-coder:7b-instruct');
    expect(screen.getByTestId('local-ai-stream-status').textContent).toBe(
      'Local generation finished.',
    );
  });

  it('reports the REAL runtime usage to the telemetry bridge after a successful generation', async () => {
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
    mockedStream.mockResolvedValue({
      ok: true,
      text: 'Hello',
      message: 'Local generation finished.',
      usage: { input: 12, output: 5, total: 17 },
    });

    const onLocalUsage = vi.fn();
    render(<LocalAiPanel onLocalUsage={onLocalUsage} />);
    await waitFor(() => {
      expect(screen.getByTestId('local-ai-prompt')).toBeTruthy();
    });
    fireEvent.change(screen.getByTestId('local-ai-prompt'), { target: { value: 'hi' } });
    fireEvent.click(screen.getByTestId('local-ai-generate'));

    await waitFor(() => {
      expect(onLocalUsage).toHaveBeenCalledTimes(1);
    });
    expect(onLocalUsage).toHaveBeenCalledWith({
      provider: 'ollama',
      model: 'qwen2.5-coder:7b-instruct',
      input: 12,
      output: 5,
      total: 17,
    });
  });

  it('does NOT report telemetry for a failed generation', async () => {
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
    mockedStream.mockResolvedValue({
      ok: false,
      text: '',
      message: 'The local model produced no reply.',
      failure: { code: 'GENERATION_FAILED', message: 'The local model produced no reply.' },
    });

    const onLocalUsage = vi.fn();
    render(<LocalAiPanel onLocalUsage={onLocalUsage} />);
    await waitFor(() => {
      expect(screen.getByTestId('local-ai-prompt')).toBeTruthy();
    });
    fireEvent.change(screen.getByTestId('local-ai-prompt'), { target: { value: 'hi' } });
    fireEvent.click(screen.getByTestId('local-ai-generate'));

    await waitFor(() => {
      expect(screen.getByTestId('local-ai-stream-status').textContent).toContain(
        'GENERATION_FAILED',
      );
    });
    expect(onLocalUsage).not.toHaveBeenCalled();
  });
});
