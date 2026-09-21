// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Settings notice (UX-07)
//
// The ONE honest "this section is not available yet" treatment. UX-07 forbids
// controls that look wired but are not: when a section has no real backend
// capability, it says so explicitly instead of shipping a dead switch.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card } from '@vedmoulya/ui';
import { Info, Sparkles } from 'lucide-react';

export interface SettingsNoticeProps {
  title: string;
  description: string;
  /** What will live here once it exists. Never presented as available today. */
  planned?: readonly string[];
  tone?: 'info' | 'future';
}

export function SettingsNotice({
  title,
  description,
  planned,
  tone = 'info',
}: SettingsNoticeProps): React.JSX.Element {
  const Icon = tone === 'future' ? Sparkles : Info;
  const accent =
    tone === 'future' ? 'text-[#7C3AED] dark:text-[#A78BFA]' : 'text-[#2B5FD9] dark:text-[#6B8FEF]';

  return (
    <Card
      variant="standard"
      padding="lg"
      className="border-dashed border-[#E2E8F0] dark:border-[#334155]"
      data-testid="settings-notice"
    >
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${accent}`} aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC]">{title}</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
            {description}
          </p>
          {planned && planned.length > 0 ? (
            <ul className="mt-3 space-y-1">
              {planned.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-[12.5px] text-[#94A3B8] dark:text-[#64748B]"
                >
                  <span
                    className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#CBD5E1] dark:bg-[#475569]"
                    aria-hidden="true"
                  />
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
