// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Section: Module Status Grid
// Status cards for Career, Learning, Business, and Marketplace modules
// BLD-016-B — Dashboard Landing Experience
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card, Badge } from '@vedmoulya/ui';
import { Briefcase, BookOpen, BarChart3, Store, Lightbulb } from 'lucide-react';
import type { ModuleSummary, ModuleKey } from './types.js';
import { statusDotColors } from './types.js';

export interface ModuleStatusGridProps {
  career: ModuleSummary;
  learning: ModuleSummary;
  business: ModuleSummary;
  marketplace: ModuleSummary;
}

const moduleIcons: Record<ModuleKey, React.ReactNode> = {
  career: <Briefcase className="h-5 w-5 text-[#2B5FD9]" />,
  learning: <BookOpen className="h-5 w-5 text-[#7C3AED]" />,
  business: <BarChart3 className="h-5 w-5 text-[#22C55E]" />,
  marketplace: <Store className="h-5 w-5 text-[#F59E0B]" />,
};

const moduleKeys: ModuleKey[] = ['career', 'learning', 'business', 'marketplace'];

function formatMetricLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/score/i, 'Score')
    .replace(/rate/i, 'Rate')
    .trim();
}

export function ModuleStatusGrid({
  career,
  learning,
  business,
  marketplace,
}: ModuleStatusGridProps): React.JSX.Element {
  const modules: Record<ModuleKey, ModuleSummary> = { career, learning, business, marketplace };

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[20px] font-heading font-semibold text-[#111827]">Your Modules</h2>
        <Badge variant="default" size="sm">
          {moduleKeys.length} active
        </Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {moduleKeys.map((key) => {
          const mod = modules[key];
          return (
            <Card key={mod.module} variant="interactive" padding="md">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-[#F5F7FA]">
                  {moduleIcons[key] ?? <Lightbulb className="h-5 w-5 text-[#64748B]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[16px] font-semibold text-[#111827] capitalize">
                      {mod.module}
                    </h3>
                    <div
                      className={`w-2 h-2 rounded-full ${statusDotColors[mod.status] ?? 'bg-[#CBD5E1]'}`}
                      title={mod.status}
                    />
                    {mod.notificationCount > 0 && (
                      <span className="ml-auto text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-[#EFF4FE] text-[#2B5FD9]">
                        {mod.notificationCount}
                      </span>
                    )}
                  </div>
                  <p className="text-[14px] text-[#64748B] mt-0.5 truncate">{mod.summary}</p>
                  <div className="flex items-center gap-3 mt-2">
                    {Object.entries(mod.metrics)
                      .slice(0, 3)
                      .map(([metric, value]) => (
                        <span key={metric} className="text-[11px] text-[#94A3B8] whitespace-nowrap">
                          {formatMetricLabel(metric)}:{' '}
                          <strong className="text-[#64748B]">{value}</strong>
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
