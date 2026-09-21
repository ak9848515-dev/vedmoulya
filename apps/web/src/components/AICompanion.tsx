'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer, DrawerOverlay, DrawerContent, Badge, Avatar } from '@vedmoulya/ui';
import {
  Sparkles,
  X,
  Send,
  Brain,
  Loader2,
  Rocket,
  AlertTriangle,
  RotateCcw,
  Plus,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { useUIStore } from '../stores/ui-store.js';
import { useAuthStore } from '../stores/auth-store.js';
import { api } from '../lib/trpc.js';
import {
  useLifeOSSnapshot,
  useProviderRuntimeStatus,
  useMissionCreateAndRun,
} from '../lib/api-client.js';
import { missionDetailRoute } from '../lib/navigation-model.js';
import {
  classifyAskIntent,
  missionDraftFromRequest,
  buildAskContext,
  conversationHistoryFor,
  ASK_GREETING,
  ASK_INPUT_HINTS,
  type AskIntent,
} from '../lib/ask-vedmoulya.js';
import type {
  IdentitySummary,
  MemorySummary,
  AIContext as SnapshotAIContext,
} from '../app/sections/types.js';
import { AskSecondaryTools } from './AskSecondaryTools.js';

// ── Message model ─────────────────────────────

interface Message {
  role: 'ai' | 'user';
  content: string;
  timestamp: string;
  /** Provider/model of the run that produced this message (runtime telemetry). */
  runtime?: { provider: string; model: string };
  /**
   * When present this assistant message is a REAL action result, not a chat
   * reply. `missionId` is only ever set from the mission API response.
   */
  action?: {
    kind: 'mission_created' | 'mission_failed';
    title: string;
    missionId?: string;
    reason?: string;
  };
}

type RuntimeStage =
  | 'idle'
  | 'thinking'
  | 'preparing_context'
  | 'selecting_model'
  | 'streaming'
  | 'validating'
  | 'creating_mission'
  | 'navigating';

/** Map a runtime status event stage to the UI stage vocabulary (unknown
 * stages are ignored so forward-compatible runtime events never crash).
 * Exported for the Phase 13 UI test suite (deterministic unit coverage). */
export function runtimeStageFromEvent(stage: string): Exclude<RuntimeStage, 'idle'> | undefined {
  switch (stage) {
    case 'thinking':
    case 'preparing_context':
    case 'selecting_model':
    case 'streaming':
    case 'validating':
      return stage;
    default:
      return undefined;
  }
}

/** Human-readable label for a non-idle runtime stage.
 * Exported for the Phase 13 UI test suite (deterministic unit coverage). */
export function stageLabel(stage: RuntimeStage): string {
  switch (stage) {
    case 'thinking':
      return 'Understanding your request…';
    case 'preparing_context':
      return 'Preparing relevant context…';
    case 'selecting_model':
      return 'Selecting the best model…';
    case 'streaming':
      return 'Generating response…';
    case 'validating':
      return 'Validating response…';
    case 'creating_mission':
      return 'Setting up your mission…';
    case 'navigating':
      return 'Opening your mission…';
    default:
      return '';
  }
}

export function AICompanion(): React.JSX.Element {
  const router = useRouter();
  const { aiPanelOpen, setAiPanelOpen, pendingQuestion, setPendingQuestion } = useUIStore();
  // Ask routes through the real ai.stream runtime (capability → context →
  // provider/model selection → streaming → validation) for ANSWERS, and through
  // the real mission infrastructure for ACTIONS. The stage label reflects the
  // actual events; the provider/model chip is the run telemetry.
  const userId = useAuthStore((s) => s.user?.userId ?? '');
  const streamMutation = api.ai.stream.useMutation();
  const createMission = useMissionCreateAndRun();
  // Honest AI readiness: "AI Ready" only when a registered provider can
  // actually execute a request (EPIC-019 runtime vocabulary, never fabricated).
  const runtimeStatus = useProviderRuntimeStatus(userId);
  const aiReadinessKnown = !runtimeStatus.isLoading && !runtimeStatus.isError;
  const aiCanExecute = (runtimeStatus.data?.providers ?? []).some((p) => p.canExecute);
  // REAL context source: the same certified Life OS snapshot the Home, Progress
  // and Life hubs read. Absent data contributes nothing (never fabricated).
  const snapshot = useLifeOSSnapshot(userId);
  // useLifeOSSnapshot returns the raw { success, data } gateway envelope, so the
  // snapshot payload lives on `.data.data`.
  const snapshotEnvelope = snapshot.data as { success?: boolean; data?: unknown } | undefined;
  const rawSnapshot =
    snapshotEnvelope?.success && snapshotEnvelope.data !== undefined
      ? (snapshotEnvelope.data as Record<string, unknown>)
      : undefined;
  const identity = (rawSnapshot?.identity ?? null) as IdentitySummary | null;
  const memory = (rawSnapshot?.memory ?? null) as MemorySummary | null;
  const aiContextSnapshot = (rawSnapshot?.aiContext ?? null) as SnapshotAIContext | null;
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', content: ASK_GREETING, timestamp: new Date().toISOString() },
  ]);
  const [input, setInput] = useState('');
  const [stage, setStage] = useState<RuntimeStage>('idle');
  const [streamingText, setStreamingText] = useState('');
  /** The last user request that failed — enables a real retry. */
  const [lastFailedInput, setLastFailedInput] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = stage !== 'idle';
  // SPRINT-028 — voice assistant: live capability status (MOCK/CONFIGURED/
  // UNAVAILABLE/ERROR — the server never claims CONFIGURED for a mock).
  const voiceStatus = api.voice.status.useQuery(
    { userId },
    { enabled: Boolean(userId), refetchInterval: 60_000, retry: false },
  );
  const voiceEnvelope = voiceStatus.data as
    { success?: boolean; data?: { stt?: string } } | undefined;
  // The voice status endpoint reports STT as MOCK/CONFIGURED/UNAVAILABLE; the
  // companion is only "configured" for a real (non-mock) STT provider.
  const sttAvailable = voiceEnvelope?.success === true && voiceEnvelope.data?.stt === 'CONFIGURED';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, stage]);

  useEffect(() => {
    if (aiPanelOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [aiPanelOpen]);

  // SPRINT-047 — hand-off from the dashboard's "Ask AI" insights: a question
  // queued through the shared UI store is pre-filled into the input on open so
  // the founder's chosen question arrives ready to send (no dead buttons, no
  // extra navigation). Consumed exactly once per queue.
  useEffect(() => {
    if (aiPanelOpen && pendingQuestion) {
      setInput(pendingQuestion);
      setPendingQuestion(null);
    }
  }, [aiPanelOpen, pendingQuestion, setPendingQuestion]);

  /** Start a fresh conversation (used only when there is something to clear). */
  function handleNewConversation(): void {
    setMessages([{ role: 'ai', content: ASK_GREETING, timestamp: new Date().toISOString() }]);
    setStreamingText('');
    setInput('');
    setLastFailedInput(null);
    setStage('idle');
    inputRef.current?.focus();
  }

  /**
   * ACTION path — route the request into the EXISTING mission infrastructure.
   *
   * We say "Mission created" ONLY when the mission API returned a real mission
   * id. The draft comes from the person's own words; nothing is invented.
   */
  async function runMissionAction(request: string): Promise<void> {
    const draft = missionDraftFromRequest(request);
    if (!draft) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          content:
            "I couldn't work out what to start from that. Tell me the outcome you want — for example, “Create a mission to revise ABAP.”",
          timestamp: new Date().toISOString(),
        },
      ]);
      setStage('idle');
      return;
    }

    setStage('creating_mission');
    try {
      // The gateway returns the raw { success, data } envelope; guardMutation has
      // already thrown for success:false, so `data` is a real MissionStatusView.
      const result = await createMission.mutateAsync({
        userId,
        title: draft.title,
        objective: draft.objective,
      });
      const missionId = (result.data as { missionId?: string } | undefined)?.missionId;
      if (!missionId) {
        throw new Error('Mission service returned no mission id');
      }
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          content: `Your mission “${draft.title}” is set up and running. Here is what VedMoulya understood and will work on: ${draft.objective}`,
          timestamp: new Date().toISOString(),
          action: { kind: 'mission_created', title: draft.title, missionId },
        },
      ]);
      setStage('idle');
    } catch (error) {
      // Honest failure: never claim a mission was created.
      const reason =
        error instanceof Error ? error.message : 'The mission service did not respond.';
      setLastFailedInput(request);
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          content: `I understood this as a mission, but I couldn't create it: ${reason}`,
          timestamp: new Date().toISOString(),
          action: { kind: 'mission_failed', title: draft.title, reason },
        },
      ]);
      setStage('idle');
    }
  }

  /** ANSWER path — a real conversation turn through the existing AI runtime. */
  async function runAnswer(request: string): Promise<void> {
    const context = buildAskContext({ identity, memory, aiContext: aiContextSnapshot });
    const history = conversationHistoryFor(messages.slice(0, -1));

    // The runtime only receives context fields that actually exist.
    const contextPayload = {
      ...(context.identityContext ? { identityContext: context.identityContext } : {}),
      ...(context.memoryContext ? { memoryContext: context.memoryContext } : {}),
      ...(context.knowledgeContext ? { knowledgeContext: context.knowledgeContext } : {}),
      ...(history.length > 0 ? { conversationHistory: history } : {}),
    };

    const result = await streamMutation.mutateAsync({
      userId,
      capability: 'reasoning',
      userInput: request,
      qualityTier: 'standard',
      constraints: { outputFormat: 'markdown', maxOutputTokens: 1200 },
      ...(Object.keys(contextPayload).length > 0 ? { context: contextPayload } : {}),
      enableOptimization: true,
    });

    if (!result.success || !result.data) {
      throw new Error('No stream result');
    }

    // Replay the runtime's REAL stage events…
    const contentEvents = result.data.events.filter(
      (e) => e.type === 'content' && typeof e.content === 'string' && e.content.length > 0,
    );
    const chunks = contentEvents.map((e) => e.content ?? '');

    for (const event of result.data.events) {
      if (event.type === 'status' && event.stage) {
        const nextStage = runtimeStageFromEvent(event.stage);
        if (nextStage) {
          setStage(nextStage);
          await new Promise((resolve) => setTimeout(resolve, 120));
        }
      }
    }

    // …and progressively reveal the real chunks they carried.
    setStage('streaming');
    let revealed = '';
    for (const chunk of chunks) {
      revealed += chunk;
      setStreamingText(revealed);
      await new Promise((resolve) => setTimeout(resolve, 16));
    }
    setStage('validating');
    await new Promise((resolve) => setTimeout(resolve, 120));

    const final = result.data.final;
    setMessages((prev) => [
      ...prev,
      {
        role: 'ai',
        content: final.content || 'I could not generate a response for that request.',
        timestamp: new Date().toISOString(),
        runtime: { provider: final.provider, model: final.model },
      },
    ]);
    setStreamingText('');
  }

  async function handleSend(override?: string): Promise<void> {
    const prompt = (override ?? input).trim();
    if (!prompt || busy || !userId) return;

    const intent: AskIntent = classifyAskIntent(prompt);
    setLastFailedInput(null);
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: prompt, timestamp: new Date().toISOString() },
    ]);
    setInput('');
    setStreamingText('');
    setStage('thinking');

    try {
      if (intent === 'action') {
        await runMissionAction(prompt);
      } else {
        await runAnswer(prompt);
      }
    } catch {
      setLastFailedInput(prompt);
      setStreamingText('');
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          content: 'I could not complete that request right now. Please try again in a moment.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setStage('idle');
    }
  }

  function handleInputKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Enter') void handleSend();
  }

  // Provider-unavailable in-conversation state: honest and actionable, never a
  // silent failure and never a fake "Connected".
  const showProviderUnavailable = aiReadinessKnown && !aiCanExecute;

  return (
    <Drawer open={aiPanelOpen} onOpenChange={setAiPanelOpen}>
      <DrawerOverlay className="fixed inset-0 z-[100] bg-[rgba(15,23,42,0.5)]" />
      <DrawerContent
        className="fixed z-[100] right-0 top-0 h-full w-[440px] max-w-[100vw] bg-white shadow-xl flex flex-col"
        aria-label="Ask VedMoulya"
        data-testid="ask-vedmoulya-panel"
      >
        {/* UX-09 a11y — the drawer's accessible name comes from DrawerContent's
            owned DialogPrimitive.Title (aria-label="Ask VedMoulya"). The former
            VisuallyHidden <h2> duplicated that name and is removed to keep
            exactly one dialog title in the accessibility tree. */}

        {/* Header */}
        <div className="shrink-0 p-6 pb-4 border-b border-[#E2E8F0]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#F5F3FF]">
                <Brain className="h-5 w-5 text-[#7C3AED]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[18px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                    Ask VedMoulya
                  </h3>
                  <Badge variant="ai" size="sm">
                    VedMoulya
                  </Badge>
                </div>
                <p className="text-[12px] flex items-center gap-1">
                  {!aiReadinessKnown ? (
                    <span className="text-[#94A3B8]">Checking AI…</span>
                  ) : aiCanExecute ? (
                    <span className="text-[#22C55E]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] mr-1 inline-block" />{' '}
                      AI Ready
                    </span>
                  ) : (
                    <span
                      className="text-[#B45309]"
                      title="No AI provider can answer right now — add one in AI Providers."
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] mr-1 inline-block" />{' '}
                      AI not available
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {messages.length > 1 && (
                <button
                  type="button"
                  onClick={handleNewConversation}
                  className="rounded-lg p-2 transition-colors hover:bg-[#F1F5F9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] dark:hover:bg-[#1E293B]"
                  aria-label="Start a new conversation"
                  title="New conversation"
                >
                  <Plus className="h-4 w-4 text-[#64748B]" aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setAiPanelOpen(false);
                }}
                className="rounded-lg p-2 transition-colors hover:bg-[#F1F5F9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] dark:hover:bg-[#1E293B]"
                aria-label="Close Ask VedMoulya"
              >
                <X className="h-4 w-4 text-[#64748B]" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto p-5 space-y-4"
          role="log"
          aria-live="polite"
          aria-label="Conversation"
        >
          {messages.map((msg, i) => {
            const isResult = msg.action?.kind === 'mission_created';
            const isFailure = msg.action?.kind === 'mission_failed';
            const missionRoute = msg.action?.missionId
              ? missionDetailRoute(msg.action.missionId)
              : null;
            return (
              <div
                key={i}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {msg.role === 'ai' ? (
                  <div className="shrink-0 rounded-lg bg-[#F5F3FF] p-2 dark:bg-[#1E3A8A]/30">
                    <Sparkles className="h-4 w-4 text-[#7C3AED]" aria-hidden="true" />
                  </div>
                ) : (
                  <Avatar alt="You" size="sm" fallback="U" />
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === 'ai'
                      ? isFailure
                        ? 'bg-[#FEF2F2] text-[#7F1D1D] dark:bg-[#450A0A] dark:text-[#FCA5A5]'
                        : 'bg-[#F8FAFC] text-[#374151] dark:bg-[#1E293B] dark:text-[#E2E8F0]'
                      : 'bg-[#2B5FD9] text-white'
                  }`}
                >
                  {isResult && (
                    <p className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-[#15803D] dark:text-[#4ADE80]">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Mission created
                    </p>
                  )}
                  {isFailure && (
                    <p className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-[#B91C1C] dark:text-[#FCA5A5]">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                      Couldn&apos;t create the mission
                    </p>
                  )}
                  <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{msg.content}</p>

                  {isResult && missionRoute && (
                    <button
                      type="button"
                      onClick={() => {
                        setAiPanelOpen(false);
                        router.push(missionRoute);
                      }}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-[#2B5FD9] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#1E4AA8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
                    >
                      <Rocket className="h-3.5 w-3.5" aria-hidden="true" />
                      Open mission
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </button>
                  )}

                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p
                      className={`text-[11px] ${
                        msg.role === 'ai' ? 'text-[#94A3B8]' : 'text-[#93B4F5]'
                      }`}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                    {msg.role === 'ai' && msg.runtime && (
                      <span className="rounded-full bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] text-[#64748B] dark:bg-[#0F172A] dark:text-[#94A3B8]">
                        {msg.runtime.provider} · {msg.runtime.model}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {busy && (
            <div className="flex gap-3">
              <div className="shrink-0 rounded-lg bg-[#F5F3FF] p-2 dark:bg-[#1E3A8A]/30">
                <Sparkles className="h-4 w-4 text-[#7C3AED]" aria-hidden="true" />
              </div>
              <div className="max-w-[80%] rounded-2xl bg-[#F8FAFC] px-4 py-3 dark:bg-[#1E293B]">
                <div
                  className="flex items-center gap-2 text-[12px] text-[#64748B] dark:text-[#94A3B8]"
                  role="status"
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#7C3AED]" aria-hidden="true" />
                  <span>{stageLabel(stage)}</span>
                </div>
                {stage === 'streaming' && streamingText && (
                  <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-[#374151] dark:text-[#E2E8F0]">
                    {streamingText}
                    <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-[#7C3AED] align-text-bottom" />
                  </p>
                )}
              </div>
            </div>
          )}

          {!busy && lastFailedInput && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => {
                  void handleSend(lastFailedInput);
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#F1F5F9] px-3 py-1.5 text-[12px] font-medium text-[#374151] transition-colors hover:bg-[#E2E8F0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] dark:bg-[#1E293B] dark:text-[#E2E8F0]"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Try again
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
        {/* ── Provider-unavailable state (honest, actionable) ─────── */}
        {showProviderUnavailable && (
          <div
            role="status"
            className="mx-5 mb-2 flex items-start gap-2 rounded-[12px] border-amber-200 bg-[#FFFBEB] px-3 py-2 text-[12px] text-[#92400E] dark:border-amber-900 dark:bg-[#291704] dark:text-[#FDE68A]"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="flex-1">
              AI is not currently available. Configure or enable an AI provider to ask questions.
            </span>
            <button
              type="button"
              onClick={() => {
                setAiPanelOpen(false);
                router.push('/providers');
              }}
              className="shrink-0 font-semibold underline"
            >
              Set up AI
            </button>
          </div>
        )}

        {/* ── Secondary tools (existing panels, demoted) ──────────── */}
        <AskSecondaryTools
          sttAvailable={sttAvailable}
          onTranscript={(text) => {
            setInput(text);
            inputRef.current?.focus();
          }}
        />

        {/* ── Non-persisted input hints ───────────────────────────── */}
        <div className="shrink-0 px-5 pb-2">
          <div className="flex flex-wrap gap-1.5">
            {ASK_INPUT_HINTS.map((hint) => (
              <button
                key={hint}
                type="button"
                disabled={busy}
                onClick={() => {
                  setInput(hint);
                  inputRef.current?.focus();
                }}
                className="rounded-full bg-[#F1F5F9] px-3 py-1.5 text-[12px] text-[#64748B] transition-colors hover:bg-[#E2E8F0] disabled:opacity-50 dark:bg-[#1E293B] dark:text-[#94A3B8]"
              >
                {hint}
              </button>
            ))}
          </div>
        </div>

        {/* ── Input ───────────────── */}
        <div className="shrink-0 border-t border-[#E2E8F0] p-5 pt-3 dark:border-[#334155]">
          <div className="flex items-center gap-2 rounded-2xl bg-[#F1F5F9] px-4 py-2 dark:bg-[#1E293B]">
            <label htmlFor="ask-vedmoulya-input" className="sr-only">
              Ask VedMoulya anything
            </label>
            <input
              id="ask-vedmoulya-input"
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
              }}
              onKeyDown={handleInputKeyDown}
              placeholder="Ask anything…"
              autoComplete="off"
              className="flex-1 border-none bg-transparent text-[14px] text-[#1F2937] outline-none placeholder:text-[#94A3B8] focus:outline-none dark:text-[#E2E8F0]"
              aria-label="Ask VedMoulya anything"
            />
            <button
              type="button"
              onClick={() => {
                void handleSend();
              }}
              disabled={!input.trim() || busy || !userId}
              className="rounded-lg bg-[#2B5FD9] p-1.5 text-white transition-colors hover:bg-[#1E4AA8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-[#94A3B8]">
            Powered by <span className="font-medium text-[#7C3AED]">VedMoulya Intelligence</span>
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
