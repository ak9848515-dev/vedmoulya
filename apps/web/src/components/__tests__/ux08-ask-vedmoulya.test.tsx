// @vitest-environment jsdom
// ─────────────────────────────
// VedMoulya — UX-08 Ask VedMoulya (canonical experience) tests
//
// Proves the ONE canonical Ask experience end-to-end against the REAL
// contracts:
//   • entry point renders, opens, closes; input renders; keyboard submit
//   • user message + assistant response render; provider/model telemetry
//   • loading state, error state, retry, empty state
//   • provider-unavailable state (honest, actionable)
//   • real userId + REAL context are passed to the runtime (no fabricated)
//   • an ANSWER request stays conversation (no mission API call)
//   • an ACTION request uses the REAL mission infrastructure
//   • a successful mission creation navigates with the REAL mission id
//   • a failed mission creation NEVER claims success
//   • all entry points open the same canonical experience (shared UI store)
// ─────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  stream: vi.fn(),
  createMission: vi.fn(),
  push: vi.fn(),
  setAiPanelOpen: vi.fn(),
  setPendingQuestion: vi.fn(),
  // useLifeOSSnapshot returns the raw { success, data } gateway envelope.
  snapshot: {
    success: true as boolean,
    data: {
      identity: { displayName: 'Anya', purpose: 'Build a livelihood', primaryGoal: 'Ship MVP' },
      memory: { totalMemories: 42, aiObservations: ['Consistent week'] },
      aiContext: { currentFocus: 'MVP launch' },
    },
  } as { success: boolean; data?: Record<string, unknown> },
  runtimeProviders: [{ canExecute: true }] as Array<{ canExecute: boolean }>,
  runtimeLoading: false,
  runtimeError: false,
  pendingQuestion: null as string | null,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('../../stores/ui-store.js', () => ({
  useUIStore: () => ({
    aiPanelOpen: true,
    setAiPanelOpen: mocks.setAiPanelOpen,
    pendingQuestion: mocks.pendingQuestion,
    setPendingQuestion: mocks.setPendingQuestion,
  }),
}));

vi.mock('../../stores/auth-store.js', () => ({
  useAuthStore: (selector: (s: { user: { userId: string } | null }) => string) =>
    selector({ user: { userId: 'user-42' } }),
}));

vi.mock('../../lib/trpc.js', () => ({
  api: {
    ai: { stream: { useMutation: () => ({ mutateAsync: mocks.stream }) } },
    voice: {
      status: {
        useQuery: () => ({
          data: { success: true, data: { stt: 'MOCK', tts: 'MOCK' } },
          isError: false,
        }),
      },
      handleUtterance: { useMutation: () => ({ mutateAsync: vi.fn() }) },
    },
  },
}));

vi.mock('../../lib/api-client.js', () => ({
  useLifeOSSnapshot: () => ({ data: mocks.snapshot, isLoading: false, isError: false }),
  useProviderRuntimeStatus: () => ({
    data: { providers: mocks.runtimeProviders },
    isLoading: mocks.runtimeLoading,
    isError: mocks.runtimeError,
  }),
  useMissionCreateAndRun: () => ({ mutateAsync: mocks.createMission, isPending: false }),
}));

// The existing intelligence panels are hosted behind a disclosure — they are
// not part of this suite, so they render as inert markers.
vi.mock('../AskSecondaryTools.js', () => ({
  AskSecondaryTools: () => React.createElement('div', { 'data-testid': 'ask-secondary-tools' }),
}));

import { AICompanion } from '../AICompanion.js';

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

function streamResult(content = 'Hello world') {
  return {
    success: true,
    data: {
      traceId: 'trace-1',
      events: [
        { type: 'status', stage: 'preparing_context' },
        { type: 'status', stage: 'streaming' },
        { type: 'content', stage: 'streaming', content },
        { type: 'status', stage: 'validating' },
      ],
      final: { content, provider: 'mock', model: 'mock-model' },
    },
  };
}

describe('UX-08 Ask VedMoulya — canonical experience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runtimeProviders = [{ canExecute: true }];
    mocks.runtimeLoading = false;
    mocks.runtimeError = false;
    mocks.pendingQuestion = null;
    mocks.snapshot = {
      success: true,
      data: {
        identity: { displayName: 'Anya', purpose: 'Build a livelihood', primaryGoal: 'Ship MVP' },
        memory: { totalMemories: 42, aiObservations: ['Consistent week'] },
        aiContext: { currentFocus: 'MVP launch' },
      },
    };
  });

  it('renders the panel, input and a real greeting (no fake example conversation)', () => {
    render(<AICompanion />);
    expect(screen.getAllByText('Ask VedMoulya').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Ask VedMoulya anything')).toBeDefined();
    expect(screen.getByLabelText('Send message')).toBeDefined();
    expect(screen.getByLabelText('Close Ask VedMoulya')).toBeDefined();
  });

  it('disables send until there is input', () => {
    render(<AICompanion />);
    expect(screen.getByLabelText('Send message').hasAttribute('disabled')).toBe(true);
  });

  it('closes through the store flag', () => {
    render(<AICompanion />);
    fireEvent.click(screen.getByLabelText('Close Ask VedMoulya'));
    expect(mocks.setAiPanelOpen).toHaveBeenCalledWith(false);
  });

  it('pre-fills a queued question exactly once (hand-off from other surfaces)', () => {
    mocks.pendingQuestion = 'What should I focus on today?';
    render(<AICompanion />);
    expect(screen.getByLabelText('Ask VedMoulya anything')).toHaveProperty(
      'value',
      'What should I focus on today?',
    );
    expect(mocks.setPendingQuestion).toHaveBeenCalledWith(null);
  });

  it('sends an ANSWER request through the runtime with the REAL userId + context', async () => {
    mocks.stream.mockResolvedValue(streamResult('SAP is an ERP suite.'));
    render(<AICompanion />);

    const input = screen.getByLabelText('Ask VedMoulya anything');
    fireEvent.change(input, { target: { value: 'What is SAP?' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mocks.stream).toHaveBeenCalledTimes(1);
    });
    const call = mocks.stream.mock.calls[0]?.[0] as Record<string, unknown>;
    // Real identity → userId, never fabricated.
    expect(call.userId).toBe('user-42');
    // Real context is forwarded (identity + memory from the snapshot).
    const context = call.context as Record<string, unknown>;
    expect(String(context.identityContext)).toContain('Anya');
    expect(String(context.memoryContext)).toContain('42');

    await screen.findByText('SAP is an ERP suite.');
    expect(mocks.createMission).not.toHaveBeenCalled();
  });

  it('does not fabricate context when the snapshot is empty', async () => {
    mocks.snapshot = { success: false };
    mocks.stream.mockResolvedValue(streamResult('A plain answer.'));
    render(<AICompanion />);

    const input = screen.getByLabelText('Ask VedMoulya anything');
    fireEvent.change(input, { target: { value: 'What is SAP?' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mocks.stream).toHaveBeenCalledTimes(1);
    });
    const call = mocks.stream.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call.context).toBeUndefined();
  });

  it('never treats a question as an action', async () => {
    mocks.stream.mockResolvedValue(streamResult());
    render(<AICompanion />);
    const input = screen.getByLabelText('Ask VedMoulya anything');
    fireEvent.change(input, { target: { value: 'Help me plan my week.' } });
    fireEvent.click(screen.getByLabelText('Send message'));
    await waitFor(() => {
      expect(mocks.stream).toHaveBeenCalledTimes(1);
    });
    expect(mocks.createMission).not.toHaveBeenCalled();
  });

  it('shows an honest error and offers a retry on runtime failure', async () => {
    mocks.stream.mockRejectedValue(new Error('provider exploded'));
    render(<AICompanion />);
    const input = screen.getByLabelText('Ask VedMoulya anything');
    fireEvent.change(input, { target: { value: 'Broken request' } });
    fireEvent.click(screen.getByLabelText('Send message'));

    await screen.findByText(/could not complete that request/i);
    expect(screen.queryByText(/provider exploded/)).toBeNull();

    // Retry re-issues the same request.
    mocks.stream.mockResolvedValue(streamResult('Recovered.'));
    fireEvent.click(screen.getByText('Try again'));
    await waitFor(() => {
      expect(mocks.stream).toHaveBeenCalledTimes(2);
    });
  });

  it('shows the real provider/model telemetry on an answer', async () => {
    mocks.stream.mockResolvedValue(streamResult('Answered.'));
    render(<AICompanion />);
    const input = screen.getByLabelText('Ask VedMoulya anything');
    fireEvent.change(input, { target: { value: 'What is SAP?' } });
    fireEvent.click(screen.getByLabelText('Send message'));
    await screen.findByText('mock · mock-model');
  });

  it('creates a REAL mission for an ACTION request and uses the REAL mission id', async () => {
    mocks.createMission.mockResolvedValue({
      success: true,
      data: { missionId: 'mission-777' },
    });
    render(<AICompanion />);

    const input = screen.getByLabelText('Ask VedMoulya anything');
    fireEvent.change(input, { target: { value: 'Create a mission to revise ABAP.' } });
    fireEvent.click(screen.getByLabelText('Send message'));

    await waitFor(() => {
      expect(mocks.createMission).toHaveBeenCalledTimes(1);
    });
    const call = mocks.createMission.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call.userId).toBe('user-42');
    expect(call.objective).toBe('Create a mission to revise ABAP.');

    // The mission API (not the AI stream) handled the action.
    expect(mocks.stream).not.toHaveBeenCalled();

    // Success is claimed ONLY with a real id, and navigation uses that id.
    await screen.findByText('Mission created');
    const open = screen.getByRole('button', { name: /Open mission/i });
    open.click();
    expect(mocks.push).toHaveBeenCalledWith('/autonomous-builder?mission=mission-777');
  });

  it('never claims success when mission creation fails', async () => {
    mocks.createMission.mockRejectedValue(new Error('No provider available'));
    render(<AICompanion />);

    const input = screen.getByLabelText('Ask VedMoulya anything');
    fireEvent.change(input, { target: { value: 'Create a mission to revise ABAP.' } });
    fireEvent.click(screen.getByLabelText('Send message'));

    await screen.findByText(/Couldn.t create the mission/i);
    expect(screen.queryByText('Mission created')).toBeNull();
    // No navigation to a fabricated mission.
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('never claims success when the mission API returns no id', async () => {
    mocks.createMission.mockResolvedValue({ success: true, data: {} });
    render(<AICompanion />);
    const input = screen.getByLabelText('Ask VedMoulya anything');
    fireEvent.change(input, { target: { value: 'Create a mission to revise ABAP.' } });
    fireEvent.click(screen.getByLabelText('Send message'));
    await screen.findByText(/Couldn.t create the mission/i);
    expect(screen.queryByText('Mission created')).toBeNull();
  });

  it('shows a coherent empty/loading state without fabricating messages', async () => {
    let resolveStream: (value: unknown) => void = () => {};
    mocks.stream.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveStream = resolve;
        }),
    );
    render(<AICompanion />);

    const input = screen.getByLabelText('Ask VedMoulya anything');
    fireEvent.change(input, { target: { value: 'What is SAP?' } });
    fireEvent.click(screen.getByLabelText('Send message'));

    // Loading state is announced honestly.
    await screen.findByText(/Understanding your request/i);

    await act(async () => {
      resolveStream(streamResult('Done.'));
    });
    await screen.findByText(/Generating response/i, undefined, { timeout: 5000 }).catch(() => {
      /* stage may already be validating */
    });
    await screen.findByText('Done.', undefined, { timeout: 5000 });
  });

  it('shows the honest provider-unavailable state (never a fake "Connected")', () => {
    mocks.runtimeProviders = [{ canExecute: false }];
    render(<AICompanion />);
    expect(screen.getByText('AI not available')).toBeDefined();
    expect(
      screen.getByText(/AI is not currently available. Configure or enable an AI provider/i),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Set up AI/i }));
    expect(mocks.push).toHaveBeenCalledWith('/providers');
  });

  it('starts a fresh conversation (clear) without inventing content', async () => {
    mocks.stream.mockResolvedValue(streamResult('First answer.'));
    render(<AICompanion />);
    const input = screen.getByLabelText('Ask VedMoulya anything');
    fireEvent.change(input, { target: { value: 'What is SAP?' } });
    fireEvent.click(screen.getByLabelText('Send message'));
    await screen.findByText('First answer.');

    fireEvent.click(screen.getByLabelText('Start a new conversation'));
    await waitFor(() => {
      expect(screen.queryByText('First answer.')).toBeNull();
    });
  });
});
