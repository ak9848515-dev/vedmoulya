// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Founder Dashboard Section Tests (SPRINT-047)
//
// Proves the founder-dashboard friction fixes introduced in SPRINT-047:
//   - TodayMissionCard / TopPriorityCard CTAs invoke their navigate callbacks
//     (previously inert primary buttons — a genuine founder friction).
//   - RecommendationsPanel surfaces the AI "why this matters" reasoning.
//   - ProfileCard reflects the founder's journey (WHO AM I / WHERE AM I).
// Backend/domain authority is untouched: these are pure presentation assertions.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { TodayMissionCard } from '../TodayMissionCard.js';
import { TopPriorityCard } from '../TopPriorityCard.js';
import { RecommendationsPanel } from '../RecommendationsPanel.js';
import { ProfileCard } from '../ProfileCard.js';
import type { Priority, Recommendation, ExecutionSummary, IdentitySummary } from '../types.js';

// RecommendationsPanel uses next/navigation's useRouter for its action buttons.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Isolate the section components from the (heavy) @vedmoulya/ui module graph so
// this presentation-focused unit test boots quickly and deterministically. The
// stubs still render real DOM, and Button forwards handlers so click wiring is
// exercised exactly as in production.
vi.mock('@vedmoulya/ui', () => ({
  Card: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  Button: ({
    children,
    className,
    onClick,
    ...props
  }: {
    children?: React.ReactNode;
    className?: string;
    onClick?: () => void;
  }) => (
    <button className={className} onClick={onClick} type="button" {...props}>
      {children}
    </button>
  ),
  Badge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

const execution: Pick<ExecutionSummary, 'activePlans' | 'completedToday' | 'blockedPlans'> = {
  activePlans: 2,
  completedToday: 1,
  blockedPlans: 0,
};

const activePriority: Priority = {
  id: 'p1',
  title: 'Finish the launch plan',
  description: 'Land the quarterly launch plan.',
  source: 'goals',
  priority: 1,
  isBlocked: false,
  category: 'goal',
};

const blockedPriority: Priority = {
  id: 'p2',
  title: 'Deploy update',
  description: 'Roll out the update.',
  source: 'execution',
  priority: 2,
  isBlocked: true,
  category: 'execution',
};

describe('TodayMissionCard (SPRINT-047 CTA wiring)', () => {
  it('calls onContinue when the primary action is pressed', () => {
    const onContinue = vi.fn();
    render(
      <TodayMissionCard priority={activePriority} execution={execution} onContinue={onContinue} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('calls onReviewBlockers for a blocked mission', () => {
    const onReviewBlockers = vi.fn();
    render(
      <TodayMissionCard
        priority={blockedPriority}
        execution={execution}
        onReviewBlockers={onReviewBlockers}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Review Blockers/i }));
    expect(onReviewBlockers).toHaveBeenCalledTimes(1);
  });
});

describe('TopPriorityCard (SPRINT-047 CTA wiring)', () => {
  it('calls onContinue when the primary action is pressed', () => {
    const onContinue = vi.fn();
    render(<TopPriorityCard priority={activePriority} onContinue={onContinue} />);
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('calls onReviewBlockers for a blocked priority', () => {
    const onReviewBlockers = vi.fn();
    render(<TopPriorityCard priority={blockedPriority} onReviewBlockers={onReviewBlockers} />);
    fireEvent.click(screen.getByRole('button', { name: /Review Blockers/i }));
    expect(onReviewBlockers).toHaveBeenCalledTimes(1);
  });
});

describe('RecommendationsPanel (SPRINT-047 why-it-matters)', () => {
  const recommendation: Recommendation = {
    id: 'r1',
    title: 'Prioritise customer calls',
    description: 'Talk to three customers this week.',
    priority: 2,
    confidence: 92,
    sources: ['goal-1', 'evidence-4'],
    reason: 'Revenue conversations drive your pipeline faster than any other lever.',
    actionLabel: 'Open',
    actionRoute: '/goals',
    isDismissed: false,
    category: 'business',
    createdAt: '2026-08-19T00:00:00Z',
  };

  it('renders the AI reasoning so the founder understands the why', () => {
    render(<RecommendationsPanel recommendations={[recommendation]} />);
    expect(screen.getByText(/Why this matters/i)).toBeTruthy();
    expect(
      screen.getByText(/Revenue conversations drive your pipeline faster than any other lever/i),
    ).toBeTruthy();
  });

  it('omits the why block when no reasoning is attached (honesty preserved)', () => {
    const withoutReason = { ...recommendation, reason: '' };
    render(<RecommendationsPanel recommendations={[withoutReason]} />);
    expect(screen.queryByText(/Why this matters/i)).toBeNull();
  });
});

describe('ProfileCard (SPRINT-047 journey personalisation)', () => {
  const identity: IdentitySummary = {
    displayName: 'Maya Rao',
    email: 'maya@example.com',
    role: 'founder',
    purpose: 'Build a consultancy',
    primaryGoal: 'First paying client',
    currentJourney: 'Validate & Launch',
    greeting: 'Hello',
  };

  it('surfaces the current journey so the founder knows where they are', () => {
    render(<ProfileCard identity={identity} />);
    expect(screen.getByText('Validate & Launch')).toBeTruthy();
  });

  it('renders fine without a journey (optional field)', () => {
    render(<ProfileCard identity={{ ...identity, currentJourney: '' }} />);
    expect(screen.queryByText('Validate & Launch')).toBeNull();
  });
});
