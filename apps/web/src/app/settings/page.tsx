'use client';

import React, { useEffect } from 'react';
import {
  Card,
  Badge,
  Tabs as TabsRoot,
  TabsList,
  TabsTrigger,
  TabsContent,
  TextField,
  Switch,
  Button,
} from '@vedmoulya/ui';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';
import { useTheme } from '@vedmoulya/ui';
import { logout } from '../../auth/session-manager.js';
import { setHapticsEnabled, hapticTap } from '../../lib/haptics.js';
import {
  User,
  Bell,
  Palette,
  Key,
  Shield,
  Save,
  Sun,
  Moon,
  Monitor,
  Vibrate,
  LogOut,
  Cpu,
  Wallet,
  Coins,
  Info,
} from 'lucide-react';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { useProviderPreferences, useSetProviderPreferences } from '../../lib/api-client.js';
import { useNavigationStore } from '../../stores/navigation-store.js';

const HAPTICS_KEY = 'vedmoulya-haptics';

function readHapticsEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(HAPTICS_KEY) !== 'off';
  } catch {
    return true;
  }
}

export default function SettingsPage(): React.JSX.Element {
  const { setActiveSection, setBreadcrumbs } = useNavigationStore();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = React.useState('profile');
  const [density, setDensity] = React.useState('Comfortable');
  const [haptics, setHaptics] = React.useState(readHapticsEnabled);
  const [notifications, setNotifications] = React.useState({
    email: true,
    push: true,
    weeklyDigest: false,
  });

  useEffect(() => {
    setActiveSection('settings');
    setBreadcrumbs([{ label: 'Settings' }]);
  }, [setActiveSection, setBreadcrumbs]);

  // Logout: clear the JWT + cached user state, then return to the login screen.
  async function handleLogout(): Promise<void> {
    await logout();
    window.location.assign('/login');
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-[28px] font-heading font-bold text-[#111827] dark:text-[#F8FAFC]">
              Settings
            </h1>
            <Badge variant="info" size="sm">
              Preferences
            </Badge>
          </div>
          <p className="text-[15px] text-[#64748B] dark:text-[#94A3B8]">
            Manage your profile, preferences, and application configuration
          </p>
        </div>
      </div>

      <TabsRoot value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-1.5" /> Profile
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-1.5" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Palette className="h-4 w-4 mr-1.5" /> Appearance
          </TabsTrigger>
          <TabsTrigger value="ai">
            <Cpu className="h-4 w-4 mr-1.5" /> AI
          </TabsTrigger>
          <TabsTrigger value="api">
            <Key className="h-4 w-4 mr-1.5" /> API & Integrations
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 mr-1.5" /> Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ErrorBoundary section="settings-profile">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827] mb-6">Profile Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TextField
                  label="Display Name"
                  placeholder="Enter your name"
                  defaultValue="User"
                  size="md"
                />
                <TextField
                  label="Email"
                  placeholder="email@example.com"
                  type="email"
                  defaultValue="user@vedmoulya.com"
                  size="md"
                />
                <TextField
                  label="Role / Title"
                  placeholder="Your role"
                  defaultValue="Product Engineer"
                  size="md"
                />
                <TextField
                  label="Timezone"
                  placeholder="UTC"
                  defaultValue="America/New_York"
                  size="md"
                />
              </div>
              <div className="mt-6 pt-6 border-t border-[#E2E8F0]">
                <Button variant="primary" size="md" className="flex items-center gap-2">
                  <Save className="h-4 w-4" /> Save Changes
                </Button>
              </div>
            </Card>
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="notifications">
          <ErrorBoundary section="settings-notifications">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827] mb-6">
                Notification Preferences
              </h3>
              <div className="space-y-6">
                {[
                  {
                    key: 'email' as const,
                    label: 'Email Notifications',
                    desc: 'Receive daily digest and important alerts via email',
                  },
                  {
                    key: 'push' as const,
                    label: 'Push Notifications',
                    desc: 'Get real-time notifications in your browser',
                  },
                  {
                    key: 'weeklyDigest' as const,
                    label: 'Weekly Digest',
                    desc: 'Receive a weekly summary of your activity and progress',
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between py-3 border-b border-[#F1F5F9] last:border-0"
                  >
                    <div>
                      <p className="text-[14px] font-medium text-[#374151]">{item.label}</p>
                      <p className="text-[13px] text-[#64748B]">{item.desc}</p>
                    </div>
                    <Switch
                      checked={notifications[item.key]}
                      onCheckedChange={(checked) => {
                        setNotifications((prev) => ({ ...prev, [item.key]: checked }));
                      }}
                    />
                  </div>
                ))}
              </div>
            </Card>
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="appearance">
          <ErrorBoundary section="settings-appearance">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-6">
                Appearance
              </h3>
              <div className="space-y-6">
                <div>
                  <p className="text-[14px] font-medium text-[#374151] dark:text-[#E2E8F0] mb-3">
                    Theme
                  </p>
                  <div className="flex gap-3">
                    {[
                      { id: 'light' as const, label: 'Light', icon: <Sun className="h-5 w-5" /> },
                      { id: 'dark' as const, label: 'Dark', icon: <Moon className="h-5 w-5" /> },
                      {
                        id: 'system' as const,
                        label: 'System',
                        icon: <Monitor className="h-5 w-5" />,
                      },
                    ].map((option) => {
                      const isActive = theme === option.id;
                      return (
                        <button
                          key={option.id}
                          onClick={() => {
                            void hapticTap();
                            setTheme(option.id);
                          }}
                          aria-pressed={isActive}
                          className={`
                            flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors
                            ${
                              isActive
                                ? 'border-[#2B5FD9] bg-[#EFF4FE] dark:bg-[#1E3A5F]'
                                : 'border-[#E2E8F0] dark:border-[#334155] hover:border-[#2B5FD9] hover:bg-[#EFF4FE] dark:hover:bg-[#1E293B]'
                            }
                          `}
                        >
                          <span
                            className={
                              isActive
                                ? 'text-[#2B5FD9] dark:text-[#6B8FEF]'
                                : 'text-[#64748B] dark:text-[#94A3B8]'
                            }
                          >
                            {option.icon}
                          </span>
                          <span className="text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0]">
                            {option.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#334155]">
                  <p className="text-[14px] font-medium text-[#374151] dark:text-[#E2E8F0] mb-2">
                    Content Density
                  </p>
                  <div className="flex gap-3">
                    {['Spacious', 'Comfortable', 'Compact'].map((option) => (
                      <button
                        key={option}
                        onClick={() => {
                          setDensity(option);
                        }}
                        aria-pressed={density === option}
                        className={`px-4 py-2 rounded-lg border text-[13px] font-medium transition-colors
                          ${
                            density === option
                              ? 'border-[#2B5FD9] bg-[#EFF4FE] text-[#2B5FD9] dark:bg-[#1E3A5F] dark:text-[#6B8FEF]'
                              : 'border-[#E2E8F0] dark:border-[#334155] text-[#374151] dark:text-[#E2E8F0] hover:border-[#2B5FD9]'
                          }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#334155]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Vibrate className="h-5 w-5 text-[#64748B] dark:text-[#94A3B8]" />
                      <div>
                        <p className="text-[14px] font-medium text-[#374151] dark:text-[#E2E8F0]">
                          Haptic Feedback
                        </p>
                        <p className="text-[12px] text-[#94A3B8]">
                          Subtle vibration on taps and refreshes (Android)
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={haptics}
                      onCheckedChange={(checked) => {
                        setHaptics(checked);
                        setHapticsEnabled(checked);
                        try {
                          window.localStorage.setItem(HAPTICS_KEY, checked ? 'on' : 'off');
                        } catch {
                          // best-effort persistence
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </Card>
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="ai">
          <ErrorBoundary section="settings-ai">
            <AIPreferencesTab />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="api">
          <ErrorBoundary section="settings-api">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827] mb-2">API & Integrations</h3>
              <p className="text-[14px] text-[#64748B] mb-6">
                Manage API keys and third-party integrations
              </p>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <div>
                    <p className="text-[14px] font-medium text-[#374151]">API Access</p>
                    <p className="text-[12px] text-[#94A3B8]">Connected via tRPC</p>
                  </div>
                  <Badge variant="success" size="md">
                    Active
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <div>
                    <p className="text-[14px] font-medium text-[#374151]">AI Providers</p>
                    <p className="text-[12px] text-[#94A3B8]">3 providers configured</p>
                  </div>
                  <Badge variant="info" size="md">
                    Configured
                  </Badge>
                </div>
              </div>
            </Card>
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="security">
          <ErrorBoundary section="settings-security">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-2">
                Security
              </h3>
              <p className="text-[14px] text-[#64748B] dark:text-[#94A3B8] mb-6">
                Manage your security preferences and authentication
              </p>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155]">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-[#22C55E]" />
                    <div>
                      <p className="text-[14px] font-medium text-[#374151] dark:text-[#E2E8F0]">
                        Two-Factor Authentication
                      </p>
                      <p className="text-[12px] text-[#94A3B8]">Add an extra layer of security</p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm">
                    Enable
                  </Button>
                </div>
                <div className="flex items-center justify-between p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155]">
                  <div className="flex items-center gap-3">
                    <LogOut className="h-5 w-5 text-[#EF4444]" />
                    <div>
                      <p className="text-[14px] font-medium text-[#374151] dark:text-[#E2E8F0]">
                        Sign Out
                      </p>
                      <p className="text-[12px] text-[#94A3B8]">
                        Clear your session and return to the login screen
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="text-[#EF4444]"
                    onClick={() => {
                      void handleLogout();
                    }}
                  >
                    <LogOut className="h-4 w-4 mr-1.5" /> Logout
                  </Button>
                </div>
              </div>
            </Card>
          </ErrorBoundary>
        </TabsContent>
      </TabsRoot>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ── AI Preferences Tab (EPIC-012A Phase 14 — Cost Policy) ────────────────────
// ═════════════════════════════════════════════════════════════════════════════

function AIPreferencesTab(): React.JSX.Element {
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

  // Load preferences once.
  React.useEffect(() => {
    if (prefs) {
      setBudgetPolicy(prefs.budgetPolicy);
      setDailyBudget(prefs.budgets.dailyUsd?.toString() ?? '');
      setMonthlyBudget(prefs.budgets.monthlyUsd?.toString() ?? '');
    }
  }, [prefs]);

  if (!hydrated || !user) {
    return <p className="text-xs text-slate-400">Sign in to configure AI preferences.</p>;
  }

  if (isLoading) {
    return <p className="text-xs text-slate-400">Loading preferences…</p>;
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

  const BUDGET_OPTIONS: Array<{
    value: 'never_paid' | 'ask_before_paid' | 'allow_within_budget';
    label: string;
    desc: string;
  }> = [
    {
      value: 'never_paid',
      label: 'Never spend',
      desc: 'Only use free models and local inference. Paid requests are blocked.',
    },
    {
      value: 'ask_before_paid',
      label: 'Ask before paid usage',
      desc: 'VedMoulya asks for approval before incurring any cost. (Default)',
    },
    {
      value: 'allow_within_budget',
      label: 'Allow within budget',
      desc: 'Automatic spending up to the set daily/monthly limits.',
    },
  ];

  return (
    <Card variant="standard" padding="lg">
      <h3 className="text-[18px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-2">
        AI Preferences
      </h3>
      <p className="text-[14px] text-[#64748B] dark:text-[#94A3B8] mb-6">
        Control how VedMoulya uses AI providers, models, and budgets on your behalf.
      </p>

      {/* Budget policy */}
      <div className="mb-6">
        <p className="text-[14px] font-medium text-[#374151] dark:text-[#E2E8F0] mb-3 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-[#2B5FD9]" />
          Cost policy
        </p>
        <div className="space-y-2">
          {BUDGET_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setBudgetPolicy(opt.value);
                setSaved(false);
              }}
              className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-colors ${
                budgetPolicy === opt.value
                  ? 'border-[#2B5FD9] bg-[#EFF4FE] dark:bg-[#1E3A8A]/40'
                  : 'border-[#E2E8F0] dark:border-[#334155] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]'
              }`}
            >
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                  budgetPolicy === opt.value ? 'border-[#2B5FD9] bg-[#2B5FD9]' : 'border-[#94A3B8]'
                }`}
              >
                {budgetPolicy === opt.value && <span className="h-2 w-2 rounded-full bg-white" />}
              </span>
              <div>
                <p className="text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0]">
                  {opt.label}
                </p>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Budget limits (only when allow_within_budget) */}
      {budgetPolicy === 'allow_within_budget' && (
        <div className="mb-6 p-4 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#1E293B]">
          <p className="text-[14px] font-medium text-[#374151] dark:text-[#E2E8F0] mb-3 flex items-center gap-2">
            <Coins className="h-4 w-4 text-[#2B5FD9]" />
            Budget limits (USD)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">
                Daily budget
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={dailyBudget}
                onChange={(e) => {
                  setDailyBudget(e.target.value);
                  setSaved(false);
                }}
                placeholder="e.g. 0.50"
                className="w-full rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#0F172A] px-3 py-2 text-[13px] text-[#374151] dark:text-[#E2E8F0] placeholder:text-[#94A3B8] outline-none focus:border-[#2B5FD9]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">
                Monthly budget
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={monthlyBudget}
                onChange={(e) => {
                  setMonthlyBudget(e.target.value);
                  setSaved(false);
                }}
                placeholder="e.g. 10.00"
                className="w-full rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#0F172A] px-3 py-2 text-[13px] text-[#374151] dark:text-[#E2E8F0] placeholder:text-[#94A3B8] outline-none focus:border-[#2B5FD9]"
              />
            </div>
          </div>
        </div>
      )}

      {/* Preferred model note */}
      <div className="mb-6 flex items-start gap-3 p-3 rounded-xl border border-[#E2E8F0] dark:border-[#334155]">
        <Info className="h-4 w-4 text-[#2B5FD9] shrink-0 mt-0.5" />
        <div>
          <p className="text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0]">
            Preferred provider & model
          </p>
          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
            Set your preferred provider and model on the{' '}
            <a href="/providers" className="text-[#2B5FD9] dark:text-[#6B8FEF] underline">
              AI Providers
            </a>{' '}
            screen. Each provider row includes a model selector — choose Auto for intelligent
            routing.
          </p>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          size="md"
          className="flex items-center gap-2"
          disabled={setPrefsMutation.isPending}
          onClick={handleSave}
        >
          <Save className="h-4 w-4" />
          {setPrefsMutation.isPending ? 'Saving…' : 'Save AI preferences'}
        </Button>
        {saved && (
          <span className="text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
            Saved
          </span>
        )}
        {error && (
          <span className="text-[12px] font-medium text-rose-600 dark:text-rose-400">{error}</span>
        )}
      </div>
    </Card>
  );
}
