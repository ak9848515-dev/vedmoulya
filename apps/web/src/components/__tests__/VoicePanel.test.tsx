// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — VoicePanel Component Tests
// SPRINT-028 §13.G — all voice states · permission denied · cancellation ·
// retry · loading · error · accessibility.
//
// Pure helpers (voiceStateLabel / uiStateFromTurnState / audioBlobFromBase64)
// get deterministic unit coverage; the component is exercised through jsdom
// with mocked tRPC + MediaRecorder/getUserMedia so no real microphone is
// ever required. Voice remains an interface — the WAITING_FOR_APPROVAL state
// proves the NON-VOICE confirmation surface.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import {
  VoicePanel,
  voiceStateLabel,
  uiStateFromTurnState,
  audioBlobFromBase64,
  MAX_RECORDING_MS,
  type VoiceUiState,
} from '../VoicePanel.js';

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  confirmAsync: vi.fn(),
  rejectAsync: vi.fn(),
  getUserMedia: vi.fn(),
}));

vi.mock('../../stores/auth-store.js', () => ({
  useAuthStore: (selector: (s: { user: { userId: string } | null }) => string) =>
    selector({ user: { userId: 'user-1' } }),
}));

vi.mock('../../lib/trpc.js', () => ({
  api: {
    voice: {
      handleUtterance: { useMutation: () => ({ mutateAsync: mocks.mutateAsync }) },
      confirmSensitive: { useMutation: () => ({ mutateAsync: mocks.confirmAsync }) },
      rejectSensitive: { useMutation: () => ({ mutateAsync: mocks.rejectAsync }) },
    },
  },
}));

/** Deterministic MediaRecorder stub: collects chunks, stops on stop(). */
class FakeMediaRecorder {
  static isTypeSupported = (): boolean => true;
  state: 'inactive' | 'recording' = 'inactive';
  mimeType = 'audio/webm';
  stream: MediaStream;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  private chunks: Blob[] = [];
  constructor(stream: MediaStream) {
    this.stream = stream;
  }
  start(): void {
    this.state = 'recording';
  }
  stop(): void {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['audio-bytes'], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

beforeEach(() => {
  mocks.mutateAsync.mockReset();
  mocks.confirmAsync.mockReset();
  mocks.rejectAsync.mockReset();
  mocks.getUserMedia.mockReset();
  // MediaRecorder stub + getUserMedia stub (no real microphone).
  (globalThis as Record<string, unknown>).MediaRecorder = FakeMediaRecorder;
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: mocks.getUserMedia },
  });
  // jsdom has no scrollIntoView / Audio — stub Audio.
  Element.prototype.scrollIntoView = vi.fn();
  (globalThis as Record<string, unknown>).Audio = class {
    src = '';
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    pause = vi.fn();
    play = vi.fn().mockResolvedValue(undefined);
  };
});

function turnResult(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    data: {
      state: 'RESPONDING',
      transcript: 'What should I focus on today?',
      text: 'Your top priority is the report draft.',
      conversationId: 'conv-1',
      ...overrides,
    },
  };
}

const ALL_STATES: VoiceUiState[] = [
  'IDLE',
  'LISTENING',
  'TRANSCRIBING',
  'THINKING',
  'WAITING_FOR_APPROVAL',
  'RESPONDING',
  'SPEAKING',
  'ERROR',
  'CANCELLED',
];

// ── Pure helpers ────────────────────────────────────────────────────────────

describe('voiceStateLabel', () => {
  it('returns a human-readable label for every voice state', () => {
    for (const s of ALL_STATES) {
      expect(voiceStateLabel(s).length).toBeGreaterThan(0);
    }
    expect(voiceStateLabel('LISTENING')).toContain('Listening');
    expect(voiceStateLabel('WAITING_FOR_APPROVAL')).toContain('confirmation');
    expect(voiceStateLabel('SPEAKING')).toContain('Speaking');
  });
});

describe('uiStateFromTurnState', () => {
  it('maps server turn states onto the UI vocabulary', () => {
    expect(uiStateFromTurnState('RESPONDING')).toBe('RESPONDING');
    expect(uiStateFromTurnState('WAITING_FOR_APPROVAL')).toBe('WAITING_FOR_APPROVAL');
    expect(uiStateFromTurnState('CANCELLED')).toBe('CANCELLED');
    expect(uiStateFromTurnState('ERROR')).toBe('ERROR');
    expect(uiStateFromTurnState('unexpected')).toBe('ERROR'); // fail-safe
  });
});

describe('audioBlobFromBase64', () => {
  it('decodes a base64 payload into a typed blob', () => {
    const data = btoa('RIFF....');
    const blob = audioBlobFromBase64(data, 'audio/wav');
    expect(blob.type).toBe('audio/wav');
    expect(blob.size).toBe(8);
  });
});

// ── Component behaviour ─────────────────────────────────────────────────────

describe('VoicePanel', () => {
  it('renders the mic control and an accessible live region', () => {
    render(<VoicePanel />);
    expect(screen.getByLabelText('Start voice input')).toBeDefined();
    expect(screen.getByRole('status')).toBeDefined(); // aria-live region
  });

  it('starts listening and shows the recording indicator when the mic grants access', async () => {
    mocks.getUserMedia.mockResolvedValue({ getTracks: () => [] } as unknown as MediaStream);
    render(<VoicePanel />);
    fireEvent.click(screen.getByLabelText('Start voice input'));

    await waitFor(() => {
      expect(screen.getByText('Listening…')).toBeDefined();
    });
    expect(screen.getByLabelText('Stop recording')).toBeDefined();
    // aria-pressed communicates the active state to assistive tech.
    expect(screen.getByLabelText('Stop recording').getAttribute('aria-pressed')).toBe('true');
  });

  it('shows a useful explanation + recovery when microphone permission is denied (no crash)', async () => {
    mocks.getUserMedia.mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'));
    render(<VoicePanel />);
    fireEvent.click(screen.getByLabelText('Start voice input'));

    await waitFor(() => {
      expect(screen.getByText(/microphone access was denied/i)).toBeDefined();
    });
    // Recovery path: a Retry button is rendered.
    expect(screen.getByLabelText('Retry voice input')).toBeDefined();
  });

  it('routes a successful utterance to the AI Q&A and shows the transcript + response text', async () => {
    mocks.getUserMedia.mockResolvedValue({ getTracks: () => [] } as unknown as MediaStream);
    mocks.mutateAsync.mockResolvedValue(turnResult());
    render(<VoicePanel />);

    fireEvent.click(screen.getByLabelText('Start voice input'));
    await waitFor(() => {
      expect(screen.getByLabelText('Stop recording')).toBeDefined();
    });
    fireEvent.click(screen.getByLabelText('Stop recording'));

    await waitFor(() => {
      expect(screen.getByText(/What should I focus on today\?/)).toBeDefined();
    });
    await waitFor(() => {
      expect(screen.getByText(/report draft/)).toBeDefined();
    });
  });

  it('enters WAITING_FOR_APPROVAL for a sensitive action and offers a NON-VOICE confirm', async () => {
    mocks.getUserMedia.mockResolvedValue({ getTracks: () => [] } as unknown as MediaStream);
    mocks.mutateAsync.mockResolvedValue(
      turnResult({
        state: 'WAITING_FOR_APPROVAL',
        taskId: 'brain-1',
        sensitiveActionsMentioned: ['delete'],
        text: 'This needs confirmation.',
      }),
    );
    render(<VoicePanel />);
    fireEvent.click(screen.getByLabelText('Start voice input'));
    await waitFor(() => screen.getByLabelText('Stop recording'));
    fireEvent.click(screen.getByLabelText('Stop recording'));

    await waitFor(() => {
      expect(screen.getByText(/Confirmation required/)).toBeDefined();
    });
    expect(screen.getByLabelText('Confirm the sensitive action')).toBeDefined();
    expect(screen.getByLabelText('Reject the sensitive action')).toBeDefined();
    // The panel explicitly communicates VOICE ≠ AUTHORIZATION (appears in the
    // confirmation box AND the aria-live announcement — both are fine).
    expect(screen.getAllByText(/voice instruction cannot authorize/i).length).toBeGreaterThan(0);
  });

  it('confirmSensitive resolves the approval and returns to a RESPONDING turn', async () => {
    mocks.getUserMedia.mockResolvedValue({ getTracks: () => [] } as unknown as MediaStream);
    mocks.mutateAsync.mockResolvedValue(
      turnResult({
        state: 'WAITING_FOR_APPROVAL',
        taskId: 'brain-1',
        sensitiveActionsMentioned: ['delete'],
      }),
    );
    mocks.confirmAsync.mockResolvedValue(
      turnResult({ state: 'RESPONDING', text: 'Approved and planned.' }),
    );
    render(<VoicePanel />);
    fireEvent.click(screen.getByLabelText('Start voice input'));
    await waitFor(() => screen.getByLabelText('Stop recording'));
    fireEvent.click(screen.getByLabelText('Stop recording'));
    await waitFor(() => screen.getByLabelText('Confirm the sensitive action'));

    fireEvent.click(screen.getByLabelText('Confirm the sensitive action'));
    await waitFor(() => {
      expect(screen.getByText(/approved and planned/i)).toBeDefined();
    });
    expect(mocks.confirmAsync).toHaveBeenCalled();
  });

  it('rejectSensitive cancels via the existing mechanism (nothing executed)', async () => {
    mocks.getUserMedia.mockResolvedValue({ getTracks: () => [] } as unknown as MediaStream);
    mocks.mutateAsync.mockResolvedValue(
      turnResult({
        state: 'WAITING_FOR_APPROVAL',
        taskId: 'brain-1',
        sensitiveActionsMentioned: ['send'],
      }),
    );
    mocks.rejectAsync.mockResolvedValue(turnResult({ state: 'CANCELLED' }));
    render(<VoicePanel />);
    fireEvent.click(screen.getByLabelText('Start voice input'));
    await waitFor(() => screen.getByLabelText('Stop recording'));
    fireEvent.click(screen.getByLabelText('Stop recording'));
    await waitFor(() => screen.getByLabelText('Reject the sensitive action'));

    fireEvent.click(screen.getByLabelText('Reject the sensitive action'));
    await waitFor(() => {
      expect(screen.getByText('Cancelled.')).toBeDefined();
    });
    expect(mocks.rejectAsync).toHaveBeenCalled();
  });

  it('handles a failed request with a graceful error and a retry path', async () => {
    mocks.getUserMedia.mockResolvedValue({ getTracks: () => [] } as unknown as MediaStream);
    mocks.mutateAsync.mockRejectedValue(new Error('boom'));
    render(<VoicePanel />);
    fireEvent.click(screen.getByLabelText('Start voice input'));
    await waitFor(() => screen.getByLabelText('Stop recording'));
    fireEvent.click(screen.getByLabelText('Stop recording'));

    await waitFor(() => {
      expect(screen.getByText(/could not process that/i)).toBeDefined();
    });
    // Retry is offered — no dead end.
    expect(screen.getAllByLabelText('Retry voice input').length).toBeGreaterThan(0);
  });

  it('cancel returns to IDLE and cleans up', async () => {
    mocks.getUserMedia.mockResolvedValue({ getTracks: () => [] } as unknown as MediaStream);
    render(<VoicePanel />);
    fireEvent.click(screen.getByLabelText('Start voice input'));
    await waitFor(() => screen.getByLabelText('Stop recording'));

    fireEvent.click(screen.getByLabelText('Cancel voice input'));
    await waitFor(() => {
      expect(screen.getByLabelText('Start voice input')).toBeDefined();
    });
    // The mic control is usable again (no stuck state).
    expect(screen.queryByLabelText('Stop recording')).toBeNull();
  });

  it('reports the recording cap is bounded (performance guard)', () => {
    expect(MAX_RECORDING_MS).toBeLessThanOrEqual(60_000);
  });

  it('is keyboard accessible — the mic button is a real focusable <button>', () => {
    render(<VoicePanel />);
    const mic = screen.getByLabelText('Start voice input');
    expect(mic.tagName).toBe('BUTTON');
    // Native button semantics: keyboard activation (Enter/Space) fires click.
    mic.focus();
    expect(document.activeElement).toBe(mic);
    fireEvent.click(mic);
    expect(mocks.getUserMedia).toHaveBeenCalled(); // activation starts listening
  });
});
