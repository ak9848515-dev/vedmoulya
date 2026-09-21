// ─────────────────────────────
// VedMoulya — Ask VedMoulya · Secondary tools (UX-08)
//
// Ask VedMoulya is a CONVERSATION layer first. The established intelligence
// panels (voice, proactive recommendations, provider network, autonomy control,
// world model, founder command center) are still here — they were already part
// of this drawer — but they are demoted behind a single "More from VedMoulya"
// disclosure so they no longer compete with the conversation for the primary
// surface.
//
// This file adds NO new capability and NO new engine. It only re-hosts the
// existing panels verbatim, one tap away, so the coherence problem (six panels
// stacked above the input) is solved without deleting anything.
// ─────────────────────────────

'use client';

import React, { useState } from 'react';
import {
  ChevronDown,
  Mic,
  Radar,
  Activity,
  ShieldCheck,
  Layers,
  LayoutDashboard,
} from 'lucide-react';
import { VoicePanel } from './VoicePanel.js';
import { ProactivePanel } from './ProactivePanel.js';
import { FabricPanel } from './FabricPanel.js';
import { ControlPanel } from './ControlPanel.js';
import { WorldPanel } from './WorldPanel.js';
import { CommandCenter } from './CommandCenter.js';

type ToolId = 'voice' | 'proactive' | 'fabric' | 'control' | 'world' | 'command';

interface Tool {
  id: ToolId;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}

const TOOLS: readonly Tool[] = [
  { id: 'voice', label: 'Talk to VedMoulya', description: 'Speak instead of typing.', icon: Mic },
  {
    id: 'proactive',
    label: 'What could help me today?',
    description: 'Recommendations backed by evidence.',
    icon: Radar,
  },
  {
    id: 'fabric',
    label: 'Provider network',
    description: 'Which AI providers are reachable.',
    icon: Activity,
  },
  {
    id: 'control',
    label: 'Autonomy control',
    description: 'What VedMoulya may do on its own.',
    icon: ShieldCheck,
  },
  {
    id: 'world',
    label: 'My world & opportunities',
    description: 'Your world snapshot.',
    icon: Layers,
  },
  {
    id: 'command',
    label: 'Founder command center',
    description: 'Today, portfolio, approvals.',
    icon: LayoutDashboard,
  },
];

export interface AskSecondaryToolsProps {
  /** Live voice capability state from the existing voice runtime. */
  sttAvailable: boolean;
  /** Fills the Ask input with a transcribed sentence. */
  onTranscript: (text: string) => void;
}

export function AskSecondaryTools({
  sttAvailable,
  onTranscript,
}: AskSecondaryToolsProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<ToolId | null>(null);

  return (
    <div className="shrink-0 px-4 pb-2">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
        }}
        aria-expanded={open}
        aria-controls="ask-secondary-tools"
        className="flex w-full items-center justify-between gap-2 rounded-[12px] px-2 py-1.5 text-[12px] font-medium text-[#64748B] transition-colors hover:bg-[#F1F5F9] dark:text-[#94A3B8] dark:hover:bg-[#0F172A]"
      >
        <span>More from VedMoulya</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div id="ask-secondary-tools" className="mt-1.5 flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              const isActive = active === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => {
                    setActive(isActive ? null : tool.id);
                  }}
                  aria-expanded={isActive}
                  aria-pressed={isActive}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] ${
                    isActive
                      ? 'bg-[#F5F3FF] text-[#7C3AED]'
                      : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0] dark:bg-[#1E293B] dark:text-[#94A3B8]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden={true} />
                  {tool.label}
                </button>
              );
            })}
          </div>

          {active === 'voice' && (
            <div className="rounded-[12px] border-[#E2E8F0] p-3 dark:border-[#334155]">
              <VoicePanel sttAvailable={sttAvailable} onTranscript={onTranscript} />
            </div>
          )}
          {active === 'proactive' && <ProactivePanel />}
          {active === 'fabric' && <FabricPanel />}
          {active === 'control' && <ControlPanel />}
          {active === 'world' && <WorldPanel />}
          {active === 'command' && <CommandCenter />}
        </div>
      )}
    </div>
  );
}
