// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Section: Welcome Hero
// Identity summary with greeting, role badges, and life score
// BLD-016-B — Dashboard Landing Experience
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Badge } from '@vedmoulya/ui';
import { Sparkles } from 'lucide-react';
import type { IdentitySummary, Metrics, ExecutionSummary } from './types.js';

export interface WelcomeHeroProps {
  identity: IdentitySummary;
  metrics: Pick<Metrics, 'lifeScore'>;
  execution: Pick<ExecutionSummary, 'completedToday'>;
}

export function WelcomeHero({ identity, metrics, execution }: WelcomeHeroProps): React.JSX.Element {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-3">
        <h1 className="text-[32px] md:text-[40px] font-heading font-bold text-[#111827] tracking-tight">
          {identity.greeting}, <span className="text-[#2B5FD9]">{identity.displayName}</span>
        </h1>
        <Sparkles className="h-6 w-6 text-[#7C3AED]" />
      </div>
      <p className="text-[16px] text-[#64748B] max-w-[700px] leading-relaxed">{identity.purpose}</p>
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        <Badge variant="info" size="sm">
          {identity.role}
        </Badge>
        <Badge variant="ai" size="sm">
          Life Score: {metrics.lifeScore}/100
        </Badge>
        <Badge variant="success" size="sm">
          {execution.completedToday} done today
        </Badge>
        <Badge variant="default" size="sm">
          🎯 {identity.primaryGoal}
        </Badge>
      </div>
    </section>
  );
}
