// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Settings → AI (UX-07 · EPIC-012A Phase 14 — Cost Policy)
//
// REAL and persisted: budget policy + daily/monthly caps through the existing
// provider-preferences procedures (useProviderPreferences /
// useSetProviderPreferences). Provider CONFIGURATION is deliberately NOT here —
// it stays in the AI experience at /providers (one canonical destination).
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import Link from 'next/link';
import { Button, Card } from '@vedmoulya/ui';
import { Coins, Cpu, Info, Save, Wallet } from 'lucide-react';
import { useProviderPreferences, useSetProviderPreferences } from '../../../lib/api-client.js';
import { useAuthStore, useAuthHydrated } from '../../../stores/auth-store.js';

const BUDGET_OPTIONS: ReadonlyArray<{
  value: 'never_paid' | 'ask_before_paid' | 'allow_within_budget';
  label: string;
  description: string;
}> = [
  {
    value: 'never_paid',
    label: 'Never spend',
    description: 'Only use free models and local inference. Paid requests are blocked.',
  },
  {
    value: 'ask_before_paid',
    label: 'Ask before paid usage',
    description: 'VedMoulya asks for approval before incurring any cost. (Default)',
  },
  {
    value: 'allow_within_budget',
    label: 'Allow within budget',
    description: 'Automatic spending up to the set daily/monthly limits.',
  },
];

export function AIPreferencesSection(): React.JSX.Element {
  const { user } = useAuthStore();
  const hydrated = useAuthHydrated();
  const userId = user?.userId ?? '';
  const { data: prefs, isLoading } = useProviderPreferences(userId);
  const setPrefsMutation = useSetProviderPreferences();
  const [budgetPolicy, setBudgetPolicy] = React.useState<
    'never_paid' | 'ask_before_paid' | 'allow_within_budget'
  >('ask_before_paid');
  const [dailyBudget, setDailyBudget] = React.useState('');
  const [monthlyBudget, setMonthlyBudget] = React.useState('');
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Load the persisted preferences once they arrive from the server.
  React.useEffect(() => {
    if (prefs) {
      setBudgetPolicy(prefs.budgetPolicy);
      setDailyBudget(prefs.budgets.dailyUsd?.toString() ?? '');
      setMonthlyBudget(prefs.budgets.monthlyUsd?.toString() ?? '');
    }
  }, [prefs]);

  if (!hydrated || !user) {
    return (
      <Card variant="standard" padding="lg">
        <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
          Sign in to configure AI preferences.
        </p>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card variant="standard" padding="lg">
        <p
          className="text-[13px] text-[#64748B] dark:text-[#94A3B8]"
          data-testid="ai-prefs-loading"
        >
          Loading preferences…
        </p>
      </Card>
    );
  }

  const handleSave = (): void => {
    setError(null);
    setSaved(false);
    void setPrefsMutation
      .mutateAsync({
        userId,
        budgetPolicy,
        budgets: {
          dailyUsd: dailyBudget ? Number(dailyBudget) : undefined,
          monthlyUsd: monthlyBudget ? Number(monthlyBudget) : undefined,
        },
      })
      .then(() => {
        setSaved(true);
        setTimeout(() => {
          setSaved(false);
        }, 3000);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to save preferences.');
      });
  };

  return (
    <Card variant="standard" padding="lg" data-testid="settings-ai">
      <h3 className="text-[18px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-2">
        AI preferences
      </h3>
      <p className="text-[14px] text-[#64748B] dark:text-[#94A3B8] mb-3">
        Control how VedMoulya spends on AI on your behalf. Which providers and models exist is
        managed in the AI experience.
      </p>
      {/* One canonical provider destination (UX-01/UX-07): Settings links to it
          rather than growing a second place to connect providers. */}
      <Link
        href="/providers"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] hover:underline mb-6"
      >
        <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
        Manage AI providers
      </Link>

      <div className="mb-6">
        <p className="text-[14px] font-medium text-[#374151] dark:text-[#E2E8F0] mb-3 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-[#2B5FD9]" aria-hidden="true" />
          Cost policy
        </p>
        <div className="space-y-2" role="radiogroup" aria-label="Cost policy">
          {BUDGET_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={budgetPolicy === option.value}
              onClick={() => {
                setBudgetPolicy(option.value);
                setSaved(false);
              }}
              className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-colors ${
                budgetPolicy === option.value
                  ? 'border-[#2B5FD9] bg-[#EFF4FE] dark:bg-[#1E3A8A]/40'
                  : 'border-[#E2E8F0] dark:border-[#334155] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]'
              }`}
            >
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                  budgetPolicy === option.value
                    ? 'border-[#2B5FD9] bg-[#2B5FD9]'
                    : 'border-[#94A3B8]'
                }`}
              >
                {budgetPolicy === option.value && (
                  <span className="h-2 w-2 rounded-full bg-white" />
                )}
              </span>
              <div>
                <p className="text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0]">
                  {option.label}
                </p>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  {option.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {budgetPolicy === 'allow_within_budget' && (
        <div className="mb-6 p-4 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#1E293B]">
          <p className="text-[14px] font-medium text-[#374151] dark:text-[#E2E8F0] mb-3 flex items-center gap-2">
            <Coins className="h-4 w-4 text-[#2B5FD9]" aria-hidden="true" />
            Budget limits (USD)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="ai-daily-budget"
                className="block text-[12px] font-medium text-[#64748B] dark:text-[#94A3B8] mb-1"
              >
                Daily budget
              </label>
              <input
                id="ai-daily-budget"
                type="number"
                min="0"
                step="0.01"
                value={dailyBudget}
                onChange={(event) => {
                  setDailyBudget(event.target.value);
                  setSaved(false);
                }}
                placeholder="e.g. 0.50"
                className="w-full rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#0F172A] px-3 py-2 text-[13px] text-[#374151] dark:text-[#E2E8F0] placeholder:text-[#94A3B8] outline-none focus:border-[#2B5FD9]"
              />
            </div>
            <div>
              <label
                htmlFor="ai-monthly-budget"
                className="block text-[12px] font-medium text-[#64748B] dark:text-[#94A3B8] mb-1"
              >
                Monthly budget
              </label>
              <input
                id="ai-monthly-budget"
                type="number"
                min="0"
                step="0.01"
                value={monthlyBudget}
                onChange={(event) => {
                  setMonthlyBudget(event.target.value);
                  setSaved(false);
                }}
                placeholder="e.g. 10.00"
                className="w-full rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#0F172A] px-3 py-2 text-[13px] text-[#374151] dark:text-[#E2E8F0] placeholder:text-[#94A3B8] outline-none focus:border-[#2B5FD9]"
              />
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 flex items-start gap-3 p-3 rounded-xl border border-[#E2E8F0] dark:border-[#334155]">
        <Info className="h-4 w-4 text-[#2B5FD9] shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0]">
            Preferred provider &amp; model
          </p>
          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
            Set your preferred provider and model on the{' '}
            <Link href="/providers" className="text-[#2B5FD9] dark:text-[#6B8FEF] underline">
              AI Providers
            </Link>{' '}
            screen. Each provider row includes a model selector — choose Auto for intelligent
            routing.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          size="md"
          className="flex items-center gap-2"
          disabled={setPrefsMutation.isPending}
          onClick={handleSave}
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {setPrefsMutation.isPending ? 'Saving…' : 'Save AI preferences'}
        </Button>
        {saved && (
          <span
            className="text-[12px] font-medium text-emerald-600 dark:text-emerald-400"
            data-testid="ai-prefs-saved"
          >
            Saved
          </span>
        )}
        {error && (
          <span
            role="alert"
            className="text-[12px] font-medium text-rose-600 dark:text-rose-400"
            data-testid="ai-prefs-error"
          >
            {error}
          </span>
        )}
      </div>
    </Card>
  );
}
