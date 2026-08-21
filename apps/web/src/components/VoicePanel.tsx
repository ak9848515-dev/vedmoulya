'use client';
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — VoicePanel
// SPRINT-028 — the production voice-assistant UX.
//
// ONE coherent voice interaction model — no competing widgets, no Phoenix
// remnants, same design tokens as the AICompanion it lives in. Voice is an
// INTERFACE, never an authorization mechanism: the panel renders the assistant
// state machine and the non-voice confirmation surface for sensitive actions.
//
// States: IDLE · LISTENING · TRANSCRIBING · THINKING · WAITING_FOR_APPROVAL ·
//         RESPONDING · SPEAKING · ERROR · CANCELLED
//
// Honesty rules:
//   • the mic button never claims a capability that is not configured
//     (voice.status from the server: MOCK/CONFIGURED/UNAVAILABLE/ERROR);
//   • a sensitive action shows a NON-VOICE confirmation button — speaking
//     "yes" can never approve (VOICE ≠ AUTHORIZATION);
//   • TTS failure is never a task failure — the text response stands;
//   • permission denied shows an explanation + recovery path, never a crash.
//
// Performance/security:
//   • bounded recording (MAX_RECORDING_MS) + payload bound checked client-side
//     before upload (matches the server's MAX_AUDIO_BYTES);
//   • request cancellation (AbortSignal) for barge-in/stop;
//   • cancellable playback; no raw API keys anywhere (server-side only);
//   • no sensitive transcript logging.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Square,
  X,
  Volume2,
  VolumeX,
  Loader2,
  RotateCcw,
  Check,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../lib/trpc.js';
import { useAuthStore } from '../stores/auth-store.js';

/** Client-side voice state machine (exported for deterministic UI tests). */
export type VoiceUiState =
  | 'IDLE'
  | 'LISTENING'
  | 'TRANSCRIBING'
  | 'THINKING'
  | 'WAITING_FOR_APPROVAL'
  | 'RESPONDING'
  | 'SPEAKING'
  | 'ERROR'
  | 'CANCELLED';

/** Hard recording cap (seconds) — bounded payload, never an unbounded buffer. */
export const MAX_RECORDING_MS = 60_000;
/** Client-side payload bound (bytes) — mirrors the server MAX_AUDIO_BYTES. */
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

/** Human-readable, screen-reader-friendly label for every voice state.
 * Exported for deterministic unit coverage. */
export function voiceStateLabel(state: VoiceUiState): string {
  switch (state) {
    case 'IDLE':
      return 'Ready to listen';
    case 'LISTENING':
      return 'Listening…';
    case 'TRANSCRIBING':
      return 'Transcribing…';
    case 'THINKING':
      return 'Thinking…';
    case 'WAITING_FOR_APPROVAL':
      return 'Awaiting your confirmation';
    case 'RESPONDING':
      return 'Responding';
    case 'SPEAKING':
      return 'Speaking…';
    case 'ERROR':
      return 'Something went wrong';
    case 'CANCELLED':
      return 'Cancelled';
  }
}

/** Map the server VoiceTurnState into the UI state machine (RESPONDING stays
 *  RESPONDING; SPEAKING is entered only while playback runs). */
export function uiStateFromTurnState(state: string): VoiceUiState {
  switch (state) {
    case 'RESPONDING':
      return 'RESPONDING';
    case 'WAITING_FOR_APPROVAL':
      return 'WAITING_FOR_APPROVAL';
    case 'CANCELLED':
      return 'CANCELLED';
    case 'ERROR':
      return 'ERROR';
    default:
      return 'ERROR';
  }
}

interface VoicePanelProps {
  /** Voice capability status from the server (voice.status). */
  sttAvailable?: boolean;
  ttsAvailable?: boolean;
  onTranscript?: (text: string) => void;
}

interface TurnResult {
  state: string;
  transcript: string;
  text: string;
  conversationId?: string;
  taskId?: string;
  sensitiveActionsMentioned?: string[];
  audio?: { data: string; format: string };
  ttsFailed?: boolean;
  code?: string;
}

/** Decode a base64 audio payload into a Blob for playback. */
export function audioBlobFromBase64(data: string, format: string): Blob {
  const binary = atob(data);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new Blob([bytes], { type: format });
}

export function VoicePanel({
  sttAvailable = true,
  onTranscript,
}: VoicePanelProps): React.JSX.Element {
  const userId = useAuthStore((s) => s.user?.userId ?? '');
  const handleUtterance = api.voice.handleUtterance.useMutation();
  const confirmSensitive = api.voice.confirmSensitive.useMutation();
  const rejectSensitive = api.voice.rejectSensitive.useMutation();

  const [state, setState] = useState<VoiceUiState>('IDLE');
  const [transcript, setTranscript] = useState('');
  const [responseText, setResponseText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [sensitive, setSensitive] = useState<{
    conversationId: string;
    taskId: string;
    actions: string[];
  } | null>(null);
  const [lastTurn, setLastTurn] = useState<TurnResult | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveRegionRef = useRef<HTMLDivElement>(null);

  // ── Recording helpers ──────────────────────────────────────────────────

  const stopTracks = useCallback((): void => {
    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    streamRef.current = null;
  }, []);

  const clearTimer = useCallback((): void => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopRecording = useCallback((): void => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    clearTimer();
  }, [clearTimer]);

  // Cleanup on unmount — never leave dangling streams/recorders/timers.
  useEffect(() => {
    return (): void => {
      stopTracks();
      clearTimer();
      abortRef.current?.abort();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, [stopTracks, clearTimer]);

  const announce = useCallback((message: string): void => {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = message;
    }
  }, []);

  /** Begin listening: request the mic, start MediaRecorder, start the cap
   *  timer. Never crashes on permission denial — explains + recovers. */
  const startListening = useCallback(async (): Promise<void> => {
    setPermissionDenied(false);
    setErrorMessage('');
    setTranscript('');
    setResponseText('');
    setSensitive(null);
    setLastTurn(null);
    setRecordingSeconds(0);

    const mediaDevices = navigator.mediaDevices as MediaDevices | undefined;
    if (!mediaDevices?.getUserMedia) {
      setState('ERROR');
      setErrorMessage(
        'Your browser does not support microphone access. You can type your request instead.',
      );
      announce('Your browser does not support microphone access. Type your request instead.');
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setPermissionDenied(true);
      setState('ERROR');
      setErrorMessage(
        'Microphone access was denied. Allow microphone access in your browser settings, then try again — or type your request.',
      );
      announce('Microphone access was denied. Check your browser settings or type your request.');
      return;
    }

    streamRef.current = stream;
    try {
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event: BlobEvent): void => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = (): void => {
        handleRecordingStop();
      };
      recorder.start();
      setState('LISTENING');
      announce('Listening. Speak now.');
      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => {
          const next = s + 1;
          if (next >= Math.floor(MAX_RECORDING_MS / 1000)) {
            stopRecording();
          }
          return next;
        });
      }, 1000);
    } catch {
      stopTracks();
      setState('ERROR');
      setErrorMessage('Could not start the microphone. Please try again or type your request.');
    }
  }, [announce, stopRecording, stopTracks]);

  const handleRecordingStop = useCallback((): void => {
    const recorder = mediaRecorderRef.current;
    if (recorder) {
      recorder.stream.getTracks().forEach((track) => {
        track.stop();
      });
    }
    streamRef.current = null;
    setState('TRANSCRIBING');
    announce('Transcribing what you said.');

    const blob = new Blob(chunksRef.current, { type: recorder?.mimeType || 'audio/webm' });
    chunksRef.current = [];
    void sendBlob(blob);
  }, [announce]);

  const sendBlob = useCallback(
    async (blob: Blob): Promise<void> => {
      if (!userId) return;
      // Client-side payload bound — never upload an oversized recording.
      if (blob.size === 0) {
        setState('ERROR');
        setErrorMessage('The recording was empty. Please try again.');
        return;
      }
      if (blob.size > MAX_AUDIO_BYTES) {
        setState('ERROR');
        setErrorMessage('The recording was too large to process. Please try a shorter one.');
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const base64 = await blobToBase64(blob);
      try {
        // NOTE: tRPC mutations do not expose an AbortSignal — cancellation is
        // enforced client-side: an aborted controller discards the result and
        // the UI returns to IDLE (the server-side turn still completes, which
        // is safe: a cancelled client simply never sees it).
        const result = await handleUtterance.mutateAsync({
          userId,
          format: blob.type || 'audio/webm',
          audioBase64: base64,
        });
        if (controller.signal.aborted) {
          setState('CANCELLED');
          return;
        }
        if (!result.success || !result.data) {
          throw new Error(result.error?.message ?? 'Voice request failed');
        }
        applyTurn(result.data as unknown as TurnResult);
      } catch {
        if (controller.signal.aborted) {
          setState('CANCELLED');
          return;
        }
        setState('ERROR');
        setErrorMessage(
          'I could not process that. Please try again in a moment — or type your request.',
        );
      }
    },
    [userId, handleUtterance],
  );

  /** Translate one assistant turn into the UI (never claims success the
   *  server did not verify). */
  const applyTurn = useCallback(
    (turn: TurnResult): void => {
      setTranscript(turn.transcript);
      setResponseText(turn.text);
      setLastTurn(turn);

      if (turn.state === 'WAITING_FOR_APPROVAL') {
        setSensitive({
          conversationId: turn.conversationId ?? '',
          taskId: turn.taskId ?? '',
          actions: turn.sensitiveActionsMentioned ?? [],
        });
        setState('WAITING_FOR_APPROVAL');
        announce(
          `This action needs your confirmation: ${(turn.sensitiveActionsMentioned ?? []).join(', ')}. Please use the confirmation button — a voice instruction cannot authorize it.`,
        );
        return;
      }
      if (turn.state === 'CANCELLED') {
        setState('CANCELLED');
        return;
      }
      if (turn.state === 'ERROR') {
        setState('ERROR');
        setErrorMessage(turn.text || 'I could not complete that request.');
        return;
      }

      // RESPONDING — the text response ALWAYS stands (TTS is additive; a TTS
      // failure is never a task failure). Play the audio when present.
      setState('RESPONDING');
      onTranscript?.(turn.transcript);
      if (turn.audio?.data) {
        playAudio(turn.audio.data, turn.audio.format);
      }
    },
    [announce, onTranscript],
  );

  /** Cancellable TTS playback. Entering SPEAKING only during playback; a
   *  playback failure returns to the textual RESPONDING state (never ERROR —
   *  the text response is the source of truth). */
  const playAudio = useCallback(
    (data: string, format: string): void => {
      try {
        const blob = audioBlobFromBase64(data, format);
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current?.pause();
        audioRef.current = audio;
        setState('SPEAKING');
        announce('Speaking the response.');
        audio.onended = (): void => {
          URL.revokeObjectURL(url);
          setState((prev) => (prev === 'SPEAKING' ? 'RESPONDING' : prev));
        };
        audio.onerror = (): void => {
          URL.revokeObjectURL(url);
          setState((prev) => (prev === 'SPEAKING' ? 'RESPONDING' : prev));
        };
        void audio.play().catch(() => {
          URL.revokeObjectURL(url);
          setState((prev) => (prev === 'SPEAKING' ? 'RESPONDING' : prev));
        });
      } catch {
        setState((prev) => (prev === 'SPEAKING' ? 'RESPONDING' : prev));
      }
    },
    [announce],
  );

  const stopPlayback = useCallback((): void => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setState((prev) => (prev === 'SPEAKING' ? 'RESPONDING' : prev));
  }, []);

  const cancel = useCallback((): void => {
    abortRef.current?.abort();
    stopRecording();
    stopTracks();
    stopPlayback();
    clearTimer();
    setState('IDLE');
    setTranscript('');
    setResponseText('');
    setErrorMessage('');
    setSensitive(null);
    setPermissionDenied(false);
    announce('Cancelled.');
  }, [abortRef, stopRecording, stopTracks, stopPlayback, clearTimer, announce]);

  const retry = useCallback((): void => {
    setErrorMessage('');
    void startListening();
  }, [startListening]);

  const confirmAction = useCallback((): void => {
    if (!sensitive || !userId) return;
    setState('THINKING');
    void confirmSensitive
      .mutateAsync({
        userId,
        conversationId: sensitive.conversationId,
        taskId: sensitive.taskId,
        action: sensitive.actions[0] ?? '',
      })
      .then((result) => {
        if (!result.success || !result.data) {
          throw new Error(result.error?.message ?? 'Approval failed');
        }
        applyTurn(result.data as unknown as TurnResult);
      })
      .catch(() => {
        setState('ERROR');
        setErrorMessage('I could not confirm that action. Please try again.');
      });
  }, [sensitive, userId, confirmSensitive, applyTurn]);

  const rejectAction = useCallback((): void => {
    if (!sensitive || !userId) return;
    setState('CANCELLED');
    void rejectSensitive
      .mutateAsync({
        userId,
        conversationId: sensitive.conversationId,
        taskId: sensitive.taskId,
        action: sensitive.actions[0] ?? '',
      })
      .then(() => {
        setState('IDLE');
      })
      .catch(() => {
        setState('IDLE');
      });
    setSensitive(null);
  }, [sensitive, userId, rejectSensitive]);

  const isBusy =
    state === 'LISTENING' ||
    state === 'TRANSCRIBING' ||
    state === 'THINKING' ||
    state === 'SPEAKING';

  return (
    <div className="voice-panel w-full" data-testid="voice-panel">
      {/* Screen-reader live region — announces every state transition. */}
      <div aria-live="polite" role="status" className="sr-only" ref={liveRegionRef} />

      {/* Status line */}
      <div className="flex items-center gap-2 px-1 pb-2">
        <span className="text-[12px] text-[#64748B]">{voiceStateLabel(state)}</span>
        {state === 'LISTENING' && (
          <span className="text-[11px] text-[#DC2626] tabular-nums">{recordingSeconds}s</span>
        )}
        {!sttAvailable && state === 'IDLE' && (
          <span className="text-[11px] text-[#94A3B8]">
            Voice transcription is not configured — type instead.
          </span>
        )}
      </div>

      {/* Transcript preview */}
      {(state === 'TRANSCRIBING' || state === 'THINKING' || transcript) && (
        <div className="rounded-xl bg-[#F1F5F9] px-3 py-2 mb-2">
          {state === 'TRANSCRIBING' && !transcript && (
            <p className="text-[12px] text-[#64748B] flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Listening to your words…
            </p>
          )}
          {transcript && <p className="text-[13px] text-[#1F2937]">“{transcript}”</p>}
        </div>
      )}

      {/* Response text — the textual answer always stands (TTS is additive). */}
      {responseText && (
        <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-2 mb-2">
          <p className="text-[13px] leading-relaxed text-[#374151]">{responseText}</p>
          {lastTurn?.ttsFailed && (
            <p className="text-[11px] text-[#94A3B8] mt-1">
              (I could not speak this aloud, but the answer is above.)
            </p>
          )}
        </div>
      )}

      {/* Sensitive action — NON-VOICE confirmation only. */}
      {state === 'WAITING_FOR_APPROVAL' && sensitive && (
        <div
          className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-3 py-3 mb-2"
          role="alert"
        >
          <p className="text-[12px] font-medium text-[#92400E] flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4" /> Confirmation required
          </p>
          <p className="text-[12px] text-[#78350F] mt-1">
            This involves {sensitive.actions.join(' and ')} — a sensitive action. A voice
            instruction cannot authorize it. Confirm below to proceed through the normal approval
            channel, or reject to cancel.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={confirmAction}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#16A34A] text-white text-[12px] font-medium hover:bg-[#15803D] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]"
              aria-label="Confirm the sensitive action"
            >
              <Check className="h-3.5 w-3.5" /> Confirm
            </button>
            <button
              onClick={rejectAction}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F1F5F9] text-[#64748B] text-[12px] font-medium hover:bg-[#E2E8F0] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#94A3B8]"
              aria-label="Reject the sensitive action"
            >
              <X className="h-3.5 w-3.5" /> Reject
            </button>
          </div>
        </div>
      )}

      {/* Error state — graceful, with a recovery path. */}
      {state === 'ERROR' && errorMessage && (
        <div
          className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-3 mb-2"
          role="alert"
        >
          <p className="text-[12px] text-[#B91C1C]">{errorMessage}</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={retry}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2B5FD9] text-white text-[12px] font-medium hover:bg-[#1E4AA8] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B5FD9]"
              aria-label="Retry voice input"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Retry
            </button>
            {permissionDenied && (
              <button
                onClick={cancel}
                className="px-3 py-1.5 rounded-lg bg-[#F1F5F9] text-[#64748B] text-[12px] font-medium hover:bg-[#E2E8F0] transition-colors"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}

      {/* CANCELLED state — transient acknowledgement. */}
      {state === 'CANCELLED' && (
        <div className="px-1 pb-2 text-[12px] text-[#94A3B8]">Cancelled.</div>
      )}

      {/* Mic control — large touch-friendly target, clearly disabled while busy. */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            if (state === 'LISTENING') {
              stopRecording();
            } else if (state === 'IDLE') {
              void startListening();
            } else if (state === 'SPEAKING') {
              stopPlayback();
            }
          }}
          disabled={
            state === 'TRANSCRIBING' || state === 'THINKING' || state === 'WAITING_FOR_APPROVAL'
          }
          aria-label={
            state === 'LISTENING'
              ? 'Stop recording'
              : state === 'SPEAKING'
                ? 'Stop speaking'
                : 'Start voice input'
          }
          aria-pressed={state === 'LISTENING' || state === 'SPEAKING'}
          className={`flex items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] disabled:opacity-40 disabled:cursor-not-allowed ${
            state === 'LISTENING'
              ? 'h-11 w-11 bg-[#DC2626] text-white hover:bg-[#B91C1C] animate-pulse'
              : state === 'SPEAKING'
                ? 'h-11 w-11 bg-[#7C3AED] text-white hover:bg-[#6D28D9]'
                : 'h-11 w-11 bg-[#F1F5F9] text-[#7C3AED] hover:bg-[#E2E8F0]'
          }`}
        >
          {state === 'LISTENING' ? (
            <Square className="h-4 w-4" />
          ) : state === 'SPEAKING' ? (
            <Volume2 className="h-4 w-4" />
          ) : state === 'TRANSCRIBING' || state === 'THINKING' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </button>

        {isBusy && (
          <button
            onClick={cancel}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#F1F5F9] text-[#64748B] text-[12px] font-medium hover:bg-[#E2E8F0] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#94A3B8]"
            aria-label="Cancel voice input"
          >
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
        )}
        {state === 'RESPONDING' && lastTurn?.audio && (
          <button
            onClick={stopPlayback}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#F1F5F9] text-[#64748B] text-[12px] font-medium hover:bg-[#E2E8F0] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#94A3B8]"
            aria-label="Stop playback"
          >
            <VolumeX className="h-3.5 w-3.5" /> Stop audio
          </button>
        )}
        {state === 'ERROR' && !permissionDenied && (
          <button
            onClick={retry}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#F1F5F9] text-[#64748B] text-[12px] font-medium hover:bg-[#E2E8F0] transition-colors"
            aria-label="Retry voice input"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Retry
          </button>
        )}
        {!sttAvailable && state === 'IDLE' && (
          <MicOff className="h-4 w-4 text-[#CBD5E1]" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}

/** Convert a Blob to a base64 payload (bounded by the caller). FileReader is
 *  used first — it is available in every browser AND in jsdom tests, whereas
 *  Blob.arrayBuffer() is browser-only. Chunked encoding avoids stack growth. */
async function blobToBase64(blob: Blob): Promise<string> {
  const buffer: ArrayBuffer = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (): void => {
      resolve(reader.result as ArrayBuffer);
    };
    reader.onerror = (): void => {
      reject(reader.error ?? new Error('read failed'));
    };
    reader.readAsArrayBuffer(blob);
  });
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
