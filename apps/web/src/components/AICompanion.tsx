'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Drawer, DrawerOverlay, DrawerContent, VisuallyHidden } from '@vedmoulya/ui';
import { Sparkles, X, Send, Mic, Brain, Loader2 } from 'lucide-react';
import { useUIStore } from '../stores/ui-store.js';
import { useAuthStore } from '../stores/auth-store.js';
import { api } from '../lib/trpc.js';
import { Badge, Avatar } from '@vedmoulya/ui';

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
  const { aiPanelOpen, setAiPanelOpen } = useUIStore();
  // AI-RUNTIME-002: the companion routes through the real ai.stream runtime
  // (capability → context optimization → EI-002/EI-004 model selection →
  // SDK streaming → validation). The stage label reflects the actual events
  // emitted by the runtime; the provider/model chip shows the run telemetry.
  const userId = useAuthStore((s) => s.user?.userId ?? '');
  const streamMutation = api.ai.stream.useMutation();
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
        className="fixed z-[100] right-0 top-0 h-full w-[440px] bg-white shadow-xl flex flex-col"
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
                    Phoenix
                  </Badge>
                </div>
                <p className="text-[12px] text-[#22C55E] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" /> Online
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
              onClick={() => {}}
              className="p-1.5 rounded-lg hover:bg-white transition-colors"
              aria-label="Voice input"
            >
              <Mic className="h-4 w-4 text-[#94A3B8]" />
            </button>
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
            Powered by <span className="text-[#7C3AED] font-medium">Phoenix AI</span>
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
