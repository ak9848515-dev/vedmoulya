'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Drawer, DrawerOverlay, DrawerContent, VisuallyHidden } from '@vedmoulya/ui';
import {
  Sparkles,
  X,
  Send,
  Brain,
  Loader2,
  Mic,
  Radar,
  Activity,
  ShieldCheck,
  Layers,
  LayoutDashboard,
} from 'lucide-react';
import { useUIStore } from '../stores/ui-store.js';
import { useAuthStore } from '../stores/auth-store.js';
import { api } from '../lib/trpc.js';
import { useProviderRuntimeStatus } from '../lib/api-client.js';
import { Badge, Avatar } from '@vedmoulya/ui';
import { VoicePanel } from './VoicePanel.js';
import { ProactivePanel } from './ProactivePanel.js';
import { FabricPanel } from './FabricPanel.js';
import { ControlPanel } from './ControlPanel.js';
import { WorldPanel } from './WorldPanel.js';
import { CommandCenter } from './CommandCenter.js';

interface Message {
  role: 'ai' | 'user';
  content: string;
  timestamp: string;
  /** Provider/model of the run that produced this message (runtime telemetry). */
  runtime?: { provider: string; model: string };
}

type RuntimeStage =
  'idle' | 'thinking' | 'preparing_context' | 'selecting_model' | 'streaming' | 'validating';

const SUGGESTED_QUESTIONS = [
  'What should I focus on today?',
  'How is my career progressing?',
  'What skills should I learn next?',
  'Summarize my recent activity',
];

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
    default:
      return '';
  }
}

export function AICompanion(): React.JSX.Element {
  const { aiPanelOpen, setAiPanelOpen, pendingQuestion, setPendingQuestion } = useUIStore();
  // AI-RUNTIME-002: the companion routes through the real ai.stream runtime
  // (capability → context optimization → EI-002/EI-004 model selection →
  // SDK streaming → validation). The stage label reflects the actual events
  // emitted by the runtime; the provider/model chip shows the run telemetry.
  const userId = useAuthStore((s) => s.user?.userId ?? '');
  const streamMutation = api.ai.stream.useMutation();
  // SPRINT-048 — honest AI readiness: "AI Ready" only when a registered
  // provider can actually execute a request (EPIC-019 runtime vocabulary,
  // never fabricated). While unknown, the badge stays neutral.
  const runtimeStatus = useProviderRuntimeStatus(userId);
  const aiReadinessKnown = !runtimeStatus.isLoading && !runtimeStatus.isError;
  const aiCanExecute = (runtimeStatus.data?.providers ?? []).some((p) => p.canExecute);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'ai',
      content:
        "Hello! I'm your AI companion. I can help you understand your progress, suggest actions, and answer questions about your Life OS.",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [stage, setStage] = useState<RuntimeStage>('idle');
  const [streamingText, setStreamingText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // SPRINT-028 — voice assistant: live capability status (MOCK/CONFIGURED/
  // UNAVAILABLE/ERROR — the server never claims CONFIGURED for a mock).
  const voiceStatus = api.voice.status.useQuery(
    { userId },
    { enabled: Boolean(userId), refetchInterval: 60_000, retry: false },
  );
  const [voicePanelOpen, setVoicePanelOpen] = useState(false);
  // SPRINT-029 — proactive intelligence panel (recommendations are evidence-gated;
  // nothing here authorizes anything — sensitive actions keep the existing approval path).
  const [proactiveOpen, setProactiveOpen] = useState(false);
  // SPRINT-030 — intelligence fabric panel (observed provider health; UNKNOWN until
  // real calls are observed — never fabricated).
  const [fabricOpen, setFabricOpen] = useState(false);
  // SPRINT-031 — autonomy control panel (explicit settings + emergency stop + TODAY;
  // fail-closed — nothing is granted without user confirmation).
  const [controlOpen, setControlOpen] = useState(false);
  // SPRINT-032 — world model & business operating system panel (bounded MY WORLD
  // snapshot + opportunity pipeline with zero/low-capital budget filters + honest
  // external-signal status).
  const [worldOpen, setWorldOpen] = useState(false);
  // SPRINT-034 — Founder Command Center (presentation-only TODAY / PORTFOLIO /
  // INTELLIGENCE / AUTOMATION / APPROVALS over the existing read models).
  const [commandCenterOpen, setCommandCenterOpen] = useState(false);

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

  const handleSend = async (): Promise<void> => {
    const prompt = input.trim();
    if (!prompt || stage !== 'idle' || !userId) return;
    const userMsg: Message = {
      role: 'user',
      content: prompt,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setStreamingText('');
    setStage('thinking');

    try {
      const result = await streamMutation.mutateAsync({
        userId,
        capability: 'reasoning',
        userInput: prompt,
        qualityTier: 'standard',
        constraints: { outputFormat: 'markdown', maxOutputTokens: 1200 },
        enableOptimization: true,
      });

      if (!result.success || !result.data) {
        throw new Error('No stream result');
      }

      // Replay the real runtime stage events so the UI communicates
      // "VedMoulya is thinking/executing" rather than appearing frozen.
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

      // Progressive reveal of the real streamed chunks.
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
    } catch {
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
  };

  function handleInputKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Enter') void handleSend();
  }

  return (
    <Drawer open={aiPanelOpen} onOpenChange={setAiPanelOpen}>
      <DrawerOverlay className="fixed inset-0 z-[100] bg-[rgba(15,23,42,0.5)]" />
      <DrawerContent
        className="fixed z-[100] right-0 top-0 h-full w-[440px] max-w-[100vw] bg-white shadow-xl flex flex-col"
        aria-label="AI Companion"
      >
        <VisuallyHidden>
          <h2>AI Companion</h2>
        </VisuallyHidden>

        {/* Header */}
        <div className="shrink-0 p-6 pb-4 border-b border-[#E2E8F0]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#F5F3FF]">
                <Brain className="h-5 w-5 text-[#7C3AED]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[18px] font-semibold text-[#111827]">AI Companion</h3>
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
                      AI setup needed
                    </span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setAiPanelOpen(false);
              }}
              className="p-2 rounded-lg hover:bg-[#F1F5F9] transition-colors"
              aria-label="Close AI Companion"
            >
              <X className="h-4 w-4 text-[#64748B]" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {msg.role === 'ai' ? (
                <div className="p-2 rounded-lg bg-[#F5F3FF] shrink-0">
                  <Sparkles className="h-4 w-4 text-[#7C3AED]" />
                </div>
              ) : (
                <Avatar alt="User" size="sm" fallback="U" />
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === 'ai' ? 'bg-[#F8FAFC] text-[#374151]' : 'bg-[#2B5FD9] text-white'}`}
              >
                <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                <div className="flex items-center justify-between mt-1">
                  <p
                    className={`text-[11px] ${msg.role === 'ai' ? 'text-[#94A3B8]' : 'text-[#93B4F5]'}`}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                  {msg.role === 'ai' && msg.runtime && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F1F5F9] text-[#64748B]">
                      {msg.runtime.provider} · {msg.runtime.model}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {stage !== 'idle' && (
            <div className="flex gap-3">
              <div className="p-2 rounded-lg bg-[#F5F3FF] shrink-0">
                <Sparkles className="h-4 w-4 text-[#7C3AED]" />
              </div>
              <div className="bg-[#F8FAFC] rounded-2xl px-4 py-3 max-w-[80%]">
                <div className="flex items-center gap-2 text-[12px] text-[#64748B]">
                  <Loader2 className="h-3.5 w-3.5 text-[#7C3AED] animate-spin" />
                  <span>{stageLabel(stage)}</span>
                </div>
                {stage === 'streaming' && streamingText && (
                  <p className="text-[14px] leading-relaxed text-[#374151] mt-2 whitespace-pre-wrap">
                    {streamingText}
                    <span className="inline-block w-1.5 h-4 bg-[#7C3AED] align-text-bottom animate-pulse ml-0.5" />
                  </p>
                )}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* SPRINT-028 — Voice assistant toggle (one coherent interaction model) */}
        <div className="shrink-0 px-6 pb-3">
          <button
            onClick={() => {
              setVoicePanelOpen((open) => !open);
            }}
            aria-expanded={voicePanelOpen}
            aria-controls="voice-panel"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] ${
              voicePanelOpen
                ? 'bg-[#F5F3FF] text-[#7C3AED]'
                : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'
            }`}
          >
            <Mic className="h-3.5 w-3.5" />
            {voicePanelOpen ? 'Hide voice' : 'Talk to VedMoulya'}
            {voiceStatus.data?.success &&
              (voiceStatus.data.data as { stt?: string }).stt === 'CONFIGURED' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" aria-hidden="true" />
              )}
          </button>
        </div>

        {/* Voice panel (collapsible) */}
        {voicePanelOpen && (
          <div id="voice-panel" className="shrink-0 px-6 pb-3 border-t border-[#E2E8F0] pt-3">
            <VoicePanel
              sttAvailable={
                voiceStatus.data?.success
                  ? (voiceStatus.data.data as { stt?: string }).stt === 'CONFIGURED'
                  : true
              }
              onTranscript={(text) => {
                setInput(text);
                inputRef.current?.focus();
              }}
            />
          </div>
        )}

        {/* SPRINT-029 — Proactive intelligence toggle */}
        <div className="shrink-0 px-6 pb-3">
          <button
            onClick={() => {
              setProactiveOpen((open) => !open);
            }}
            aria-expanded={proactiveOpen}
            aria-controls="proactive-panel"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] ${
              proactiveOpen
                ? 'bg-[#F5F3FF] text-[#7C3AED]'
                : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'
            }`}
          >
            <Radar className="h-3.5 w-3.5" />
            {proactiveOpen ? 'Hide recommendations' : 'What could help me today?'}
          </button>
        </div>

        {/* Proactive panel (collapsible) */}
        {proactiveOpen && (
          <div id="proactive-panel" className="shrink-0 px-6 pb-3 border-t border-[#E2E8F0] pt-3">
            <ProactivePanel />
          </div>
        )}

        {/* SPRINT-030 — Intelligence fabric toggle (observed provider health; UNKNOWN until evidence) */}
        <div className="shrink-0 px-6 pb-3">
          <button
            onClick={() => {
              setFabricOpen((open) => !open);
            }}
            aria-expanded={fabricOpen}
            aria-controls="fabric-panel"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] ${
              fabricOpen
                ? 'bg-[#F5F3FF] text-[#7C3AED]'
                : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            {fabricOpen ? 'Hide provider network' : 'Provider network'}
          </button>
        </div>

        {/* Intelligence fabric panel (collapsible) — observed provider health only */}
        {fabricOpen && (
          <div id="fabric-panel" className="shrink-0 px-6 pb-3 border-t border-[#E2E8F0] pt-3">
            <FabricPanel />
          </div>
        )}

        {/* SPRINT-031 — Autonomy control toggle (explicit settings + emergency stop) */}
        <div className="shrink-0 px-6 pb-3">
          <button
            onClick={() => {
              setControlOpen((open) => !open);
            }}
            aria-expanded={controlOpen}
            aria-controls="control-panel"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] ${
              controlOpen
                ? 'bg-[#F5F3FF] text-[#7C3AED]'
                : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {controlOpen ? 'Hide autonomy control' : 'Autonomy control'}
          </button>
        </div>

        {/* Autonomy control panel (collapsible) */}
        {controlOpen && (
          <div id="control-panel" className="shrink-0 px-6 pb-3 border-t border-[#E2E8F0] pt-3">
            <ControlPanel />
          </div>
        )}

        {/* SPRINT-032 — World model toggle (bounded MY WORLD + opportunity pipeline) */}
        <div className="shrink-0 px-6 pb-3">
          <button
            onClick={() => {
              setWorldOpen((open) => !open);
            }}
            aria-expanded={worldOpen}
            aria-controls="world-panel"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] ${
              worldOpen
                ? 'bg-[#F5F3FF] text-[#7C3AED]'
                : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            {worldOpen ? 'Hide my world' : 'My world & opportunities'}
          </button>
        </div>

        {/* World model panel (collapsible) */}
        {worldOpen && (
          <div id="world-panel" className="shrink-0 px-6 pb-3 border-t border-[#E2E8F0] pt-3">
            <WorldPanel />
          </div>
        )}

        {/* SPRINT-034 — Founder Command Center toggle */}
        <div className="shrink-0 px-6 pb-3">
          <button
            onClick={() => {
              setCommandCenterOpen((open) => !open);
            }}
            aria-expanded={commandCenterOpen}
            aria-controls="command-center-panel"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] ${
              commandCenterOpen
                ? 'bg-[#F5F3FF] text-[#7C3AED]'
                : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'
            }`}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            {commandCenterOpen ? 'Hide command center' : 'Founder command center'}
          </button>
        </div>

        {/* Founder Command Center panel (collapsible) — presentation only */}
        {commandCenterOpen && (
          <div
            id="command-center-panel"
            className="shrink-0 px-6 pb-3 border-t border-[#E2E8F0] pt-3"
          >
            <CommandCenter />
          </div>
        )}

        {/* Suggested Questions */}
        <div className="shrink-0 px-6 pb-3">
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => {
                  setInput(q);
                  inputRef.current?.focus();
                }}
                className="text-[12px] text-[#64748B] bg-[#F1F5F9] hover:bg-[#E2E8F0] px-3 py-1.5 rounded-full transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="shrink-0 p-6 pt-3 border-t border-[#E2E8F0]">
          <div className="flex items-center gap-2 bg-[#F1F5F9] rounded-2xl px-4 py-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
              }}
              onKeyDown={handleInputKeyDown}
              placeholder="Ask anything..."
              className="flex-1 text-[14px] text-[#1F2937] placeholder:text-[#94A3B8] bg-transparent border-none outline-none focus:outline-none"
              aria-label="Type your message"
            />
            <button
              onClick={() => {
                void handleSend();
              }}
              disabled={!input.trim() || stage !== 'idle'}
              className="p-1.5 rounded-lg bg-[#2B5FD9] text-white hover:bg-[#1E4AA8] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="text-[11px] text-[#94A3B8] mt-2 text-center">
            Powered by <span className="text-[#7C3AED] font-medium">VedMoulya Intelligence</span>
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
