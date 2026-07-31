// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Card Component
// Specialized card for AI-generated content
// Purple border + AI icon, confidence indicator
// Follows DES-010A/D07 Component Behaviour
// ──────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';
import { Card, type CardProps } from './Card.js';
import { cn } from '../../utilities/cn.js';

export interface AICardProps extends Omit<CardProps, 'variant'> {
  confidence?: number; // 0-100
  source?: string;
  onTalk?: () => void;
  onDismiss?: () => void;
  onWhy?: () => void;
}

export function AICard({
  children,
  className,
  confidence,
  source,
  onTalk,
  onDismiss,
  onWhy,
  ...props
}: AICardProps): React.JSX.Element {
  return (
    <Card
      variant="standard"
      className={cn(
        'border-l-4 border-l-[#7C3AED] bg-gradient-to-br from-white to-[#F5F3FF]',
        'relative overflow-hidden',
        className,
      )}
      {...props}
    >
      {/* AI Glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#7C3AED] opacity-[0.03] rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#7C3AED]" aria-hidden="true" />
          <span className="text-[14px] font-medium text-[#7C3AED]">AI Coach</span>
        </div>
        {confidence !== undefined && (
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] text-[#64748B]">Confidence</span>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((dot) => (
                <div
                  key={dot}
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    confidence / 20 >= dot ? 'bg-[#7C3AED]' : 'bg-[#E2E8F0]',
                  )}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="text-[14px] text-[#374151] leading-[22px]">{children}</div>

      {/* Footer */}
      {(onTalk || onDismiss || onWhy || source) && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#E9D5FF]">
          {source && <span className="text-[12px] text-[#94A3B8]">Source: {source}</span>}
          <div className="flex gap-2 ml-auto">
            {onWhy && (
              <button
                onClick={onWhy}
                className="text-[12px] text-[#7C3AED] hover:text-[#8B5CF6] font-medium transition-colors"
              >
                Why?
              </button>
            )}
            {onTalk && (
              <button
                onClick={onTalk}
                className="text-[12px] text-[#2B5FD9] hover:text-[#3B6FE3] font-medium transition-colors"
              >
                Talk
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-[12px] text-[#94A3B8] hover:text-[#64748B] transition-colors"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

AICard.displayName = 'AICard';
