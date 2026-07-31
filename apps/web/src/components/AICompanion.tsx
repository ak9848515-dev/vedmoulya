'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Drawer, DrawerOverlay, DrawerContent, VisuallyHidden } from '@vedmoulya/ui';
import { Sparkles, X, Send, Mic, Brain } from 'lucide-react';
import { useUIStore } from '../stores/ui-store.js';
import { Badge, Avatar } from '@vedmoulya/ui';

interface Message {
  role: 'ai' | 'user';
  content: string;
  timestamp: string;
}

const SUGGESTED_QUESTIONS = [
  'What should I focus on today?',
  'How is my career progressing?',
  'What skills should I learn next?',
  'Summarize my recent activity',
];

export function AICompanion(): React.JSX.Element {
  const { aiPanelOpen, setAiPanelOpen } = useUIStore();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'ai',
      content:
        "Hello! I'm your AI companion. I can help you understand your progress, suggest actions, and answer questions about your Life OS.",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (aiPanelOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [aiPanelOpen]);

  const handleSend = (): void => {
    if (!input.trim()) return;
    const userMsg: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    setTimeout(() => {
      const responses: Record<string, string> = {
        today:
          'Based on your current data, your top priority today is completing the Q3 Strategy project. You have 3 pending decisions and 2 learning goals due.',
        career:
          "Your career progress is on track. You've completed 65% of your senior role roadmap. Consider focusing on cloud architecture skills next.",
        skills:
          'Based on your career goals and market trends, I recommend focusing on: 1) Cloud Architecture (critical gap), 2) System Design (moderate gap), 3) AI/ML fundamentals.',
      };
      let response =
        "I understand your question. Let me analyze your data and provide personalized insights. Is there a specific area you'd like to explore: Career, Learning, Business, or something else?";
      for (const [key, val] of Object.entries(responses)) {
        if (input.toLowerCase().includes(key)) {
          response = val;
          break;
        }
      }
      const aiMsg: Message = { role: 'ai', content: response, timestamp: new Date().toISOString() };
      setMessages((prev) => [...prev, aiMsg]);
      setIsThinking(false);
    }, 1200);
  };

  function handleInputKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Enter') handleSend();
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
                <p className="text-[14px] leading-relaxed">{msg.content}</p>
                <p
                  className={`text-[11px] mt-1 ${msg.role === 'ai' ? 'text-[#94A3B8]' : 'text-[#93B4F5]'}`}
                >
                  {new Date(msg.timestamp).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          ))}
          {isThinking && (
            <div className="flex gap-3">
              <div className="p-2 rounded-lg bg-[#F5F3FF] shrink-0">
                <Sparkles className="h-4 w-4 text-[#7C3AED]" />
              </div>
              <div className="bg-[#F8FAFC] rounded-2xl px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full bg-[#7C3AED] animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <div
                    className="w-2 h-2 rounded-full bg-[#7C3AED] animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <div
                    className="w-2 h-2 rounded-full bg-[#7C3AED] animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
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
              onClick={handleSend}
              disabled={!input.trim() || isThinking}
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
