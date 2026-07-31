// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Section: Quick Actions
// Action buttons for common tasks across modules
// BLD-016-B — Dashboard Landing Experience
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Button } from '@vedmoulya/ui';
import { Target, Users, BookOpen, Brain, BarChart3, Store } from 'lucide-react';

export interface QuickAction {
  label: string;
  icon: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  route?: string;
  onClick?: () => void;
}

const defaultActions: QuickAction[] = [
  { label: 'Continue Mission', icon: <Target className="h-4 w-4" />, variant: 'primary' },
  { label: 'Review Career', icon: <Users className="h-4 w-4" />, variant: 'secondary' },
  { label: 'Start Learning', icon: <BookOpen className="h-4 w-4" />, variant: 'secondary' },
  { label: 'Review Decisions', icon: <Brain className="h-4 w-4" />, variant: 'secondary' },
  { label: 'View Business', icon: <BarChart3 className="h-4 w-4" />, variant: 'ghost' },
  { label: 'Browse Marketplace', icon: <Store className="h-4 w-4" />, variant: 'ghost' },
];

export interface QuickActionsProps {
  actions?: QuickAction[];
}

export function QuickActions({ actions = defaultActions }: QuickActionsProps): React.JSX.Element {
  return (
    <section>
      <h2 className="text-[20px] font-heading font-semibold text-[#111827] mb-4">Quick Actions</h2>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant={action.variant ?? 'secondary'}
            size="md"
            icon={action.icon}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </section>
  );
}
