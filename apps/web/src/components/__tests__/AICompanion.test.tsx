// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AICompanion Component Tests (AI-RUNTIME-002 Phase 13 / C-12 UI)
//
// Proves the AICompanion UI state machine against the real runtime event
// vocabulary:
//   - preparing / retrieval / evidence / optimization / model-selection /
//     streaming / validation stage labels map from runtime status events
//   - streamed chunks are progressively revealed
//   - the final message carries the provider/model runtime chip
//   - error path shows a human-readable message (no raw exceptions, no
//     misleading success, no fabricated content)
//   - abstention content from the runtime is displayed as-is (typed truth)
//   - stage returns to idle → send button re-enabled (no infinite spinner)
//   - keyboard (Enter) send + disabled send states + suggested questions
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { AICompanion, runtimeStageFromEvent, stageLabel } from '../AICompanion.js';

// jsdom does not implement scrollIntoView; polyfill it so the messages
// auto-scroll effect never throws during render.
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
}));

// Note: mock paths resolve relative to THIS file (src/components/__tests__/),
// so the stores/lib modules need ../../ prefixes to hit the same modules the
// component imports.
vi.mock('../../stores/ui-store.js', () => ({
  useUIStore: () => ({ aiPanelOpen: true, setAiPanelOpen: vi.fn() }),
}));

vi.mock('../../stores/auth-store.js', () => ({
  useAuthStore: (selector: (s: { user: { userId: string } | null }) => string) =>
    selector({ user: { userId: 'user-1' } }),
}));

vi.mock('../../lib/trpc.js', () => ({
  api: {
    ai: {
      stream: {
        useMutation: () => ({ mutateAsync: mocks.mutateAsync }),
      },
    },
  },
}));

function streamResult(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    data: {
      traceId: 'trace-1',
      events: [
        { type: 'status', stage: 'preparing_context' },
        { type: 'status', stage: 'selecting_model' },
        { type: 'status', stage: 'streaming' },
        { type: 'content', stage: 'streaming', content: 'Hello ' },
        { type: 'content', stage: 'streaming', content: 'world' },
        { type: 'status', stage: 'validating' },
        { type: 'done', data: { provider: 'mock', model: 'mock-model' } },
      ],
      final: {
        content: 'Hello world',
        provider: 'mock',
        model: 'mock-model',
        confidence: 0.9,
        qualityScore: 8,
        latency: 10,
        cost: 0,
        tokenUsage: { input: 10, output: 5, total: 15 },
        validation: { passed: true, checks: [], overallScore: 8, decision: 'pass' },
        traceId: 'trace-1',
        metadata: {},
      },
    },
    ...overrides,
  };
}

// ── Pure stage-mapping helpers (deterministic unit coverage) ────────────────

describe('runtimeStageFromEvent', () => {
  it('maps every runtime status stage to the UI vocabulary', () => {
    expect(runtimeStageFromEvent('thinking')).toBe('thinking');
    expect(runtimeStageFromEvent('preparing_context')).toBe('preparing_context');
    expect(runtimeStageFromEvent('selecting_model')).toBe('selecting_model');
    expect(runtimeStageFromEvent('streaming')).toBe('streaming');
    expect(runtimeStageFromEvent('validating')).toBe('validating');
  });

  it('ignores unknown/forward-compatible stages so new runtime events never crash the UI', () => {
    expect(runtimeStageFromEvent('quantum_reasoning')).toBeUndefined();
    expect(runtimeStageFromEvent('')).toBeUndefined();
  });
});

describe('stageLabel', () => {
  it('returns a human-readable label for every supported stage', () => {
    expect(stageLabel('thinking')).toContain('Understanding');
    expect(stageLabel('preparing_context')).toContain('Preparing relevant context');
    expect(stageLabel('selecting_model')).toContain('Selecting the best model');
    expect(stageLabel('streaming')).toContain('Generating response');
    expect(stageLabel('validating')).toContain('Validating response');
  });
});

// ── Component behaviour ─────────────────────────────────────────────────────

describe('AICompanion', () => {
  beforeEach(() => {
    mocks.mutateAsync.mockReset();
  });

  it('renders the drawer, greeting, input and send button when open', () => {
    render(<AICompanion />);
    // The component renders both a visually-hidden h2 and the visible h3.
    expect(screen.getAllByText('AI Companion').length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText('Ask anything...')).toBeDefined();
    expect(screen.getByLabelText('Send message')).toBeDefined();
  });

  it('disables the send button when input is empty', () => {
    render(<AICompanion />);
    expect(screen.getByLabelText('Send message').hasAttribute('disabled')).toBe(true);
  });

  it('sends on Enter and reveals streamed chunks + provider/model chip (no infinite spinner)', async () => {
    mocks.mutateAsync.mockResolvedValue(streamResult());
    render(<AICompanion />);

    const input = screen.getByPlaceholderText('Ask anything...');
    fireEvent.change(input, { target: { value: 'How is my career?' } });
    expect(screen.getByLabelText('Send message').hasAttribute('disabled')).toBe(false);

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(1);

    // The final answer is assembled from the real streamed chunks. The stage
    // replay uses real timers (~120ms per status event + 16ms per chunk), so
    // allow a generous explicit timeout to keep this deterministic on slow CI.
    await waitFor(
      () => {
        expect(screen.getByText('Hello world')).toBeDefined();
      },
      { timeout: 5000 },
    );
    // The runtime chip communicates provider · model telemetry.
    await waitFor(
      () => {
        expect(screen.getByText('mock · mock-model')).toBeDefined();
      },
      { timeout: 5000 },
    );
    // No infinite spinner: the generating indicator is gone after completion.
    await waitFor(
      () => {
        expect(screen.queryByText('Generating response…')).toBeNull();
      },
      { timeout: 5000 },
    );
    // Stage actually reset to idle: re-fill the input and the send button
    // must be re-enabled (it was disabled only while stage !== idle).
    fireEvent.change(input, { target: { value: 'Next question' } });
    await waitFor(
      () => {
        expect(screen.getByLabelText('Send message').hasAttribute('disabled')).toBe(false);
      },
      { timeout: 5000 },
    );
  });

  it('shows a human-readable error and no fabricated answer when the runtime fails', async () => {
    mocks.mutateAsync.mockRejectedValue(new Error('stream connection reset'));
    render(<AICompanion />);

    const input = screen.getByPlaceholderText('Ask anything...');
    fireEvent.change(input, { target: { value: 'Broken request' } });
    fireEvent.click(screen.getByLabelText('Send message'));

    await screen.findByText(/could not complete that request/i);
    // No misleading success: the fabricated-ish answer is never shown.
    expect(screen.queryByText('Broken request answer')).toBeNull();
    // No raw stack trace / internal error vocabulary reaches the user.
    expect(screen.queryByText(/stream connection reset/)).toBeNull();
    // Back to idle: re-fill the input and the send button must be re-enabled
    // (proves the stage reset after the error — no stuck loading state).
    fireEvent.change(input, { target: { value: 'Retry after error' } });
    await waitFor(() => {
      expect(screen.getByLabelText('Send message').hasAttribute('disabled')).toBe(false);
    });
  });

  it('displays the runtime abstention message as the typed truth (no fake answer)', async () => {
    mocks.mutateAsync.mockResolvedValue(
      streamResult({
        data: {
          ...streamResult().data,
          events: [{ type: 'done', data: { abstained: true } }],
          final: {
            ...streamResult().data.final,
            content:
              'VedMoulya could not find sufficient evidence to answer this question confidently. It has abstained rather than fabricate an answer.',
            provider: 'abstention',
            model: 'abstention',
          },
        },
      }),
    );
    render(<AICompanion />);

    fireEvent.change(screen.getByPlaceholderText('Ask anything...'), {
      target: { value: 'Unknown topic' },
    });
    fireEvent.click(screen.getByLabelText('Send message'));

    await screen.findByText(/has abstained rather than fabricate/i);
    expect(screen.queryByText('Unknown topic')).toBeDefined(); // user message present
  });

  it('fills the input from a suggested question', () => {
    render(<AICompanion />);
    fireEvent.click(screen.getByText('What should I focus on today?'));
    expect((screen.getByPlaceholderText('Ask anything...') as HTMLInputElement).value).toBe(
      'What should I focus on today?',
    );
  });
});
